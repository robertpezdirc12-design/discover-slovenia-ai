/**
 * PLAN-MAP-DATA — čista izpeljava podatkov za zemljevid ob načrtu
 * (izdaja 2.29.0, POLIR2 skupina B; navdih Atlist/Wanderlog iz raziskave
 * 2026-10-12-polir2.md — „barvni markerji po dnevih, pot med postanki").
 *
 * Vhod: dnevi načrta (TripStop[][]) — izhod motorja buildItinerary ali
 * ročno urejanje dnevnega reda. Izhod: markerji, črtkane povezave po
 * dnevih in ISKREN števec postankov brez koordinat.
 *
 * Kanoni:
 *  - ČISTO: isti vhod → isti izhod; 0 omrežja, 0 ure, 0 mutacij vhoda
 *    (koordinate in časi se kopirajo v lastne tipe — izhod ne deli
 *    objektov z vhodom).
 *  - ISKRENOST: manjkajočih koordinat se NE izmišljuje — postanek brez
 *    coords preprosto ni prikazan na zemljevidu, števec skippedNoCoords
 *    pa uporabniku izrecno pove, koliko postankov manjka.
 *  - DAY_COLORS: 8 temnih, med seboj razločnih barv (Tailwind lestvica
 *    700–800, ~7:1 kontrast z belo — WCAG AA) z zadostnim kontrastom za
 *    BELO številko dneva. Barva je KATEGORIJA DNEVA (podatkovna
 *    vizualizacija po vzorcu vrstnih izdelkov), ne UI tema — zato
 *    namerno IZVEN modro-indigo družine (ta pripada temi aplikacije):
 *    rdeča · oranžna · rjava · olivna · zelena · turkizna · magenta ·
 *    vijolična. Za barvno slepe uporabnike se dnevi ločujejo tudi po
 *    številki — barva je le dopolnilo.
 */

import { roadKm, round5, travelMinutes } from "./itinerary-engine";
import type { TripStop } from "./types";

/**
 * Paleta barv dni — določilen niz: barva dneva je vedno
 * DAY_COLORS[dayIdx % DAY_COLORS.length] (načrti z več kot 8 dnevi se
 * paleta ponovi; motor sicer omeji načrt na 5 dni).
 */
export const DAY_COLORS: readonly string[] = [
  "#b91c1c", // dan 1 — rdeča (red-700)
  "#c2410c", // dan 2 — oranžna (orange-700)
  "#92400e", // dan 3 — rjava (amber-800)
  "#3f6212", // dan 4 — olivna (lime-800)
  "#15803d", // dan 5 — zelena (green-700)
  "#0f766e", // dan 6 — turkizna (teal-700)
  "#be185d", // dan 7 — magenta (pink-700)
  "#7e22ce", // dan 8 — vijolična (purple-700)
];

/** En postanek načrta, pripravljen za prikaz na zemljevidu. */
export interface PlanMapMarker {
  id: string;
  name: string;
  /** Indeks dneva v vhodnem `days` (0-based). */
  dayIdx: number;
  /**
   * Zaporedna številka med PRIKAZANIMI postanki dneva (0-based, tesna —
   * postanki brez koordinat se preskočijo in ne puščajo lukenj).
   */
  orderInDay: number;
  coords: { lat: number; lng: number };
  /** Čas postanka "HH:mm" | null, ko ura ni znana (iskrenostni kanon). */
  time: string | null;
}

/**
 * Premočrtna povezava med postanki enega dneva (prikazana ČRTKANO —
 * ni vozljiva pot; glej opombo komponente PlanMap).
 */
export interface PlanMapDayLine {
  dayIdx: number;
  /** Točke v vrstnem redu postankov dneva (samo postanki s coords). */
  points: { lat: number; lng: number }[];
}

/** Celotna izpeljava za PlanMap (vhod komponente ne dotika TripStopov). */
export interface PlanMapData {
  markers: PlanMapMarker[];
  dayLines: PlanMapDayLine[];
  /** Iskren števec postankov brez znanih koordinat (niso prikazani). */
  skippedNoCoords: number;
}

/**
 * Zgradi podatke zemljevida iz dni načrta (ČISTA funkcija):
 * - markers: vsi postanki Z znanimi koordinatami, po vrstnem redu dni in
 *   postankov znotraj dneva; time se prenese (null ostane null);
 * - dayLines: za vsak dan z vsaj 2 točkama s coords (enojna točka ni
 *   povezava) — points v vrstnem redu postankov tistega dne;
 * - skippedNoCoords: iskren števec vseh postankov brez coords.
 *
 * Prazni dnevi ostanejo brez markerjev in brez povezave — iskreno
 * prazno stanje (dni ne brišemo in ne izmišljujemo vsebine).
 */
export function planMapData(days: TripStop[][]): PlanMapData {
  const markers: PlanMapMarker[] = [];
  const dayLines: PlanMapDayLine[] = [];
  let skippedNoCoords = 0;

  days.forEach((stops, dayIdx) => {
    const points: { lat: number; lng: number }[] = [];
    for (const stop of stops) {
      // Iskrenost: brez koordinat ni markerja — raste samo števec.
      if (!stop.coords) {
        skippedNoCoords += 1;
        continue;
      }
      markers.push({
        id: stop.id,
        name: stop.name,
        dayIdx,
        // Gosto zaporedje prikazanih postankov dneva (brez lukenj).
        orderInDay: points.length,
        coords: { lat: stop.coords.lat, lng: stop.coords.lng },
        time: stop.time ?? null,
      });
      points.push({ lat: stop.coords.lat, lng: stop.coords.lng });
    }
    if (points.length >= 2) {
      dayLines.push({ dayIdx, points });
    }
  });

  return { markers, dayLines, skippedNoCoords };
}

// ── POLIR3 A (2.30.0): vozljiva pot (OSRM) nad premočrtnimi črtami ────────
//
// Čista odločitev IZRISA (polna/črtkana) + opomb pod zemljevidom. Živi tu in
// ne v komponenti, ker komponente plan-map.tsx ni mogoče uvoziti v testih
// (uvoz leaflet modula zahteva window) — brez tega odseka logika polne/črtkane
// črte ne bi bila testabilna na čistem izhodu planMapData + simuliranega
// odgovora proxyja (edino mesto, kjer je sprememba te datoteke nujna).

/**
 * Usmerjena geometrija enega dneva iz odgovora /api/plan/directions:
 * [[lat, lon], …] (Leaflet vrstni red). Manjkajoč dan = ni vozljive poti.
 */
export type DayGeometry = ReadonlyArray<readonly [number, number]>;

/**
 * Ena povezava dneva po vrsti izrisa:
 *  - solid: true  → POLNA črta iz DEJANSKE OSRM geometry (weight 4,
 *    opacity 0.9, barva dneva) — nikoli izmišljena;
 *  - solid: false → ČRTKANA premočrtna črta (dashArray "6 8", weight 3) —
 *    iskren nadomestek, ko OSRM poti ni (padec, timeout, dan s postankom
 *    brez koordinat ali nalaganje).
 */
export interface PlanMapLine {
  dayIdx: number;
  /** Točke [lat, lng] v vrstnem redu postankov oziroma OSRM geometry. */
  points: [number, number][];
  solid: boolean;
}

/**
 * Odločitev opomb pod zemljevidom (iskrenost — opombi se nikoli ne lažeta):
 *  - routed:  vsaj ena POLNA črta → opomba „Vozljiva pot (OSRM/…)";
 *  - straight: vsaj ena ČRTKANA črta ALI nobene poti (nalaganje/napaka)
 *    → opomba „Povezave so premočrtne (ne vozljiva pot)".
 * Mešano stanje (del dni vozljiv, del ne) pokaže OBE opombi.
 */
export interface PlanMapNotes {
  routed: boolean;
  straight: boolean;
}

/** Izhod čiste odločitve izrisa: črte dneva + zastavici opomb. */
export interface PlanMapLineState {
  lines: PlanMapLine[];
  notes: PlanMapNotes;
}

/**
 * Čista presodba črt po dnevih (PLAN-MAP, izdaja 2.30.0):
 * za vsak dan iz data.dayLines pogleda, ali ima dan usmerjeno geometrijo
 * v `routed` (ključ = indeks dneva). Izhod NE deli tabel s vhodom
 * (točke se skopirajo — kanon čistosti planMapData).
 */
export function planMapLines(
  data: PlanMapData,
  routed: Readonly<Record<number, DayGeometry>>
): PlanMapLineState {
  const lines: PlanMapLine[] = data.dayLines.map((line) => {
    const geometry = routed[line.dayIdx];
    if (geometry && geometry.length >= 2) {
      // POLNA črta: kopija točk [lat, lon] iz OSRM geometry.
      return {
        dayIdx: line.dayIdx,
        points: geometry.map((p) => [p[0], p[1]] as [number, number]),
        solid: true,
      };
    }
    // ČRTKANA premočrtna črta: točke postankov dneva (iz planMapData).
    return {
      dayIdx: line.dayIdx,
      points: line.points.map((p) => [p.lat, p.lng] as [number, number]),
      solid: false,
    };
  });

  const routedCount = lines.filter((l) => l.solid).length;
  const dashedCount = lines.length - routedCount;
  return {
    lines,
    notes: {
      routed: routedCount > 0,
      straight: dashedCount > 0 || routedCount === 0,
    },
  };
}

// ── POLIR5 A (2.32.0): IZMERJENE razdalje/časi dneva (OSRM poročanje) ──────
//
// OSRM odgovor, ki ga proxy /api/plan/directions ŽE pobira za polno črto,
// vsebuje tudi IZMERJENI routes[0].distance (m) in routes[0].duration (s)
// (raziskava 2026-10-11-polir5.md, preizkus B: Bled→Vintgar→Bohinj
// 21551 m / 2173 s) — 0 dodatnih poizvedb. Ta odsek je ČISTA plasti
// teh vrednosti (tip + zaokrožitvi + povzetek), da sta testabilni v bun
// (komponente plan-map.tsx ni mogoče uvoziti v testih — listat potrebuje
// window; precedens planMapLines zgoraj).

/**
 * Izmerjen podatek enega dneva iz odgovora proxyja (POVZETEK NAČRTA):
 *  - status "route": dan ima vozljivo pot, km/min sta IZMERJENI vrednosti
 *    (distanceM/1000 na 1 decimalko, durationS/60 na 5 — glej measuredKm /
 *    measuredMin);
 *  - status "straight": dan je PADel (fail-closed proxyja) — BREZ km/min
 *    (iskrena odsotnost; povzetek tedaj pokaže oceno, ne izmišljene številke).
 */
export interface MeasuredDay {
  /** Indeks dneva v `days` načrta (0-based — isti ključ kot pri planMapLines). */
  day: number;
  status: "route" | "straight";
  /** Kilometri (distanceM / 1000, 1 decimala) — samo za status "route". */
  km?: number;
  /** Minute vožnje (durationS / 60, zaokroženo na 5) — samo za status "route". */
  min?: number;
}

/**
 * IZMERJENI kilometri dneva: distanceM / 1000, zaokroženo na 1 decimalko
 * (prikaz — brez lažne natančnosti). Čista funkcija, kliče jo PlanMap ob
 * odgovoru proxyja (zaokrožitev živi tukaj, da jo testi zaklenejo).
 */
export function measuredKm(distanceM: number): number {
  return Math.round((distanceM / 1000) * 10) / 10;
}

/**
 * IZMERJENE minute vožnje dneva: durationS / 60, zaokroženo na 5 (ISTI kanon
 * round5 iz itinerary-engine — enaka semantika kot pri LegRow/oceni, da se
 * izmerjene in ocenjene minute lahko pošteno primerjajo).
 */
export function measuredMin(durationS: number): number {
  return round5(durationS / 60);
}

/** Vrstica povzetka enega dneva: izmerjeno (s številkami) ali ocena. */
export type MeasuredRow =
  | { day: number; kind: "measured"; km: number; min: number }
  | { day: number; kind: "estimate" };

/** Povzetek izmerjenih dni (čista izpeljava za povzetek načrta). */
export interface MeasuredSummary {
  /** Ena vrstica na dan načrta (0 … dayCount-1, po vrstnem redu dni). */
  rows: MeasuredRow[];
  /** Vsota km SAMO izmerjenih dni (null, če ni nobenega izmerjenega dneva). */
  totalKm: number | null;
  /** Vsota minut SAMO izmerjenih dni (null, če ni nobenega izmerjenega dneva). */
  totalMin: number | null;
  /** Število izmerjenih dni (status "route" z veljavnima km in min). */
  measuredCount: number;
  /** Število dni BREZ izmere (padli pri OSRM ali sploh neupravičeni). */
  failedCount: number;
}

/**
 * Čista presodba povzetka izmerjenih dni (POLIR5 A, 2.32.0):
 *  - za vsak dan 0 … dayCount-1 ena vrstica: "measured" (status "route" z
 *    veljavnima, končnima, nenegativnima km/min) ali "estimate" (vse
 *    ostalo: padel dan pri OSRM, dan, ki ga proxy sploh ni smel dobiti —
 *    npr. postanek brez koordinat — ali obrambno zavrnjen vnos);
 *  - totalKm/totalMin = vsota SAMO izmerjenih dni (Roadtrippersova past:
 *    mešana vsota bi tiho zavajala; padli dnevi se izrecno preštejejo v
 *    failedCount in ne prispevajo nič k vsoti);
 *  - ni izmerjenih dni → totalKm/totalMin null (iskrena odsotnost, ne laž);
 *  - 0 omrežja, 0 ure, 0 mutacij vhoda (kanon te datoteke).
 */
export function summarizeMeasured(
  dayCount: number,
  stats: readonly MeasuredDay[]
): MeasuredSummary {
  // Zemljevid dan → izmerjen vnos (podvojeni vnosi: zadnji zmaga — v praksi
  // jih PlanMap ne pošilja, obrambno pa je odločitev deterministična).
  const byDay = new Map<number, MeasuredDay>();
  for (const s of stats) {
    if (s.day >= 0 && s.day < dayCount) byDay.set(s.day, s);
  }

  const rows: MeasuredRow[] = [];
  let totalKm = 0;
  let totalMin = 0;
  let measuredCount = 0;
  for (let day = 0; day < dayCount; day++) {
    const s = byDay.get(day);
    // Veljaven izmerjen vnos: status "route" + končni, nenegativni km/min
    // (drugo je obrambno zavrnjeno — prikaz ocene, ne izmišljene izmere).
    if (
      s &&
      s.status === "route" &&
      typeof s.km === "number" &&
      typeof s.min === "number" &&
      Number.isFinite(s.km) &&
      Number.isFinite(s.min) &&
      s.km >= 0 &&
      s.min >= 0
    ) {
      rows.push({ day, kind: "measured", km: s.km, min: s.min });
      totalKm += s.km;
      totalMin += s.min;
      measuredCount += 1;
    } else {
      rows.push({ day, kind: "estimate" });
    }
  }

  return {
    rows,
    // Vsota 1-decimalnih km lahko odplava v plavajoči vejici (21,6 + 13,5) —
    // zaokrožitev nazaj na 1 decimalko je deterministična in brez izgube.
    totalKm: measuredCount > 0 ? Math.round(totalKm * 10) / 10 : null,
    totalMin: measuredCount > 0 ? totalMin : null,
    measuredCount,
    failedCount: dayCount - measuredCount,
  };
}

// ── POLIR6 A (2.33.0): IZMERJENE VRSTICE V VSEH POGLEDIH POTI ───────────────
//
// dayEstimate + fmtKm1 sta se PRESTAVILI iz nacrtuj/view.tsx (2.32.0), da so
// izmerjene/ocenjene vrstice pod glavo dneva iz ENEGA izvora resnice na
// VSEH pogledih (/nacrtuj, /potovanje, /pot/[shareId] — oblak in lokalno).
// Obe funkciji sta ČISTI in klientansko varni (0 omrežja, 0 ure, 0 Intl),
// zato živita tukaj poleg summarizeMeasured, kjer ju lahko testi uvozijo.

/**
 * Ocena vožnje CELEGA dneva = VSOTA LegRow vrednosti tistega dneva: po
 * skokih (sosednja postanka OBA z koordinatama) sešteje round5(roadKm) in
 * travelMinutes — ISTI hevristiki kot LegRow (premočna ×1,3 @ ~60 km/h),
 * zato se vrstica pod glavo dneva in noge med postanki NIKOLI ne
 * nasprotujeta. Skok brez koordinat se izpusti (LegRow zanj ne kaže
 * vrstice); dan brez nobenega skoka → null (iskrena odsotnost — ni
 * vožnje, ni vrstice). Urnik motorja to NE spreminja (OSRM je poročevalna
 * plast, ne vir urnika — odločitev 2.30.0).
 */
export function dayEstimate(stops: TripStop[]): { km: number; min: number } | null {
  let km = 0;
  let min = 0;
  let hops = 0;
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const stop = stops[i];
    if (!prev.coords || !stop.coords) continue; // LegRow: brez koordinat ni vrstice
    km += round5(roadKm(prev.coords, stop.coords));
    min += travelMinutes(prev.coords, stop.coords);
    hops += 1;
  }
  return hops > 0 ? { km, min } : null;
}

/**
 * Kilometri z 1 decimalko po jeziku (EN pika, ostali vejica — deterministično,
 * brez Intl; vzorec fmtKm iz plan-import). Izmerjene vrednosti iz OSRM so
 * dostojne 1 decimale, ne več (21,6 km — ne 21,5512).
 */
export function fmtKm1(l: string, km: number): string {
  const s = km.toFixed(1);
  return l === "en" ? s : s.replace(".", ",");
}
