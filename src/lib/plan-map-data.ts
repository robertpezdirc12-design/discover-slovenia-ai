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
