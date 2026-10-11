/**
 * PLAN-REORDER — POVLECI-IN-SPUSTI preurejanje dni na /nacrtuj (2.29.0).
 *
 * ČISTI MODUL (0 AI, 0 omrežja, 0 strežniških odvisnosti): nemutabilne
 * transformacije nad ItineraryPlan.days, ki jih pokliče view.tsx ob spustu
 * vlečenja. Isti vhod vedno da isti izhod (determinizem kanona).
 *
 * Kanoni:
 *  - URNIK po preureditvi zrcali motor (itinerary-engine.ts, točka
 *    „3) URNIK vsakega dne"): dan se začne ob 09:00, vsak naslednji postanek
 *    = prejšnji + trajanje + ocenjena vožnja (travelMinutes, ~60 km/h).
 *    Reorder NE izmišljuje novih časov — samo prestavlja postanke in
 *    preračuna isti kanon.
 *  - ISKRENOST: če kateremu od sosednjih postankov manjkajo koordinate,
 *    vožnje ne moremo oceniti → od tega postanka naprej time = null
 *    („ura ni znana"), nikoli izmišljene ure.
 *  - STABILNI KLJUČI: id-ji postankov se OHRANIJO tudi po premiku med dnevi.
 *    Id vsebuje izvorni indeks (npr. „dest--d1s2" = dan 1, mesto 2), a to
 *    je SAMO unikatni ključ za React/dnd-kit (raziskava 2026-10-12: dnd-kit
 *    PAST — id-ji morajo biti nizi, ne številke), NE pozicijska resnica:
 *    po preureditvi „d1s2" lahko stoji v dnevu 3 na mestu 1.
 */

import { travelMinutes, type PlannerLang } from "./itinerary-engine";
import { regionLabel } from "./slovenia-data";
import type { TripStop } from "./types";

/**
 * Začetek dneva v minutah — ZRCALI neizvoženo konstanto DAY_START_MIN iz
 * itinerary-engine.ts (9 * 60 = 09:00). Če jo motor kdaj spremeni, se
 * idempotentnostni zaklep v tests/nacrtuj-dnd.test.ts sproži takoj.
 */
const DAY_START_MIN = 9 * 60;

/** Minute → „HH:MM" (ista oblika kot hhmm v motorju). */
function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// moveStop — en sam kanonični premik postanka (znotraj dneva ali med dnevi)
// ---------------------------------------------------------------------------

/**
 * Premakne postanek `stopId` na dan `toDay`, mesto `toIndex`.
 *
 * NEMUTABILNO: vrne NOVO strukturo dni; vhod ostane nedotaknjen (iste
 * referencce objektov postankov, nove tabele dni).
 *
 * Pravila:
 *  - `toDay` je clampano na [0, days.length - 1];
 *  - `toIndex` je clampano na [0, dolžina ciljnega dneva PO odstranitvi]
 *    (premik v istem dnevu najprej odstrani postanek — indeks cilja se
 *    nanaša na končno lego, kar je natanko semantika arrayMove/dnd-kit);
 *  - če `stopId` ne obstaja → vrne ISTO referenco (nespremenjeno);
 *  - prazni ciljni dnevi so podprti (vstavljanje na indeks 0);
 *  - id-ji postankov se OHRANIJO (stabilni React/dnd-kit ključi).
 */
export function moveStop(
  days: TripStop[][],
  stopId: string,
  toDay: number,
  toIndex: number
): TripStop[][] {
  // Poišči izvorni dan + mesto (id-ji so globalno unikatni — prvi zadetek).
  let fromDay = -1;
  let fromIndex = -1;
  for (let d = 0; d < days.length; d++) {
    const i = days[d].findIndex((s) => s.id === stopId);
    if (i !== -1) {
      fromDay = d;
      fromIndex = i;
      break;
    }
  }
  // Neznan id → ista referenca (klicatelj lahko z === prepozna brezspremembo).
  if (fromDay === -1) return days;

  // Clamp ciljnega dne na veljavno območje.
  const day = Math.max(0, Math.min(Math.trunc(toDay), days.length - 1));

  // Nova struktura: plitve kopije tabel dni, objekti postankov ostanejo isti.
  const next = days.map((stops) => [...stops]);
  const [moved] = next[fromDay].splice(fromIndex, 1);
  // Clamp indeksa na dolžino ciljnega dneva PO odstranitvi premaknjenega.
  const idx = Math.max(0, Math.min(Math.trunc(toIndex), next[day].length));
  next[day].splice(idx, 0, moved);
  return next;
}

// ---------------------------------------------------------------------------
// recomputeDayTimes — preračun urnika dneva po kanonu motorja
// ---------------------------------------------------------------------------

/**
 * Preračuna ure postankov enega dne po ISTEM kanonu kot motor
 * (itinerary-engine.ts, „3) URNIK vsakega dne"):
 *
 *  - t se začne na 540 (09:00);
 *  - za i > 0: če prejšnji in trenutni postanek imata coords →
 *    t += travelMinutes(prev.coords, cur.coords), sicer (katere koli
 *    koordinate manjkajo) od tega postanka naprej time = null — iskreno
 *    „ura ni znana", ker vožnje ne moremo oceniti;
 *  - znanemu postanku time = HH:MM; po vsakem postanku t += durationMin.
 *
 * IDEMPOTENTNOST: za NEPREUREJEN dan iz buildItinerary vrne IDENTIČNE čase
 * (zaklenjeno v tests/nacrtuj-dnd.test.ts) — preračun dotaknjenih dni po
 * spustu zato nikoli ne pokvari nedotaknjenih dni.
 *
 * Nemutabilno: vrača nove objekte postankov (spremenjen time), vhod ostane
 * nedotaknjen.
 */
export function recomputeDayTimes(stops: TripStop[]): TripStop[] {
  let t = DAY_START_MIN;
  let unknown = false; // od prve neznanke naprej ura ni znana
  const out: TripStop[] = [];
  for (let i = 0; i < stops.length; i++) {
    const cur = stops[i];
    if (i > 0) {
      const prev = stops[i - 1];
      // Vožnjo ocenimo samo, če oba sosednja postanka imata koordinati IN
      // doslej ni bilo neznanke (t bi bil sicer izmišljen).
      if (!unknown && prev.coords && cur.coords) {
        t += travelMinutes(prev.coords, cur.coords);
      } else {
        unknown = true;
      }
    }
    out.push({ ...cur, time: unknown ? null : hhmm(t) });
    t += cur.durationMin;
  }
  return out;
}

// ---------------------------------------------------------------------------
// recomputeDayTitle — pošten naslov dneva po ročni preureditvi
// ---------------------------------------------------------------------------

/** Beseda „Dan" v vseh 6 jezikih (isti vrstni red kot PickLocale). */
const DAY_WORD: Record<PlannerLang, string> = {
  sl: "Dan",
  en: "Day",
  it: "Giorno",
  de: "Tag",
  fr: "Jour",
  es: "Día",
};

/**
 * Naslov dneva po ročni preureditvi: „Dan 2 · Gorenjska, Primorska".
 *
 * Motorjevih naslovov („Dan 1 · Gorenjska — Bled", ki vkodirajo ime prvenga
 * postanka) po preureditvi NE moremo reproducirati — zato iskren,
 * determinističen nadomestek: številka dneva + UNIKATNE regije dneva po
 * vrstnem redu pojavljanja, združene z „, ". Brez regij → samo „Dan 2".
 */
export function recomputeDayTitle(
  dayIdx: number,
  stops: TripStop[],
  lang: PlannerLang
): string {
  const base = `${DAY_WORD[lang]} ${dayIdx + 1}`;
  const regions: string[] = [];
  for (const s of stops) {
    if (s.region && !regions.includes(s.region)) regions.push(s.region);
  }
  if (regions.length === 0) return base;
  const labels = regions.map((r) => regionLabel(r, lang));
  return `${base} · ${labels.join(", ")}`;
}

// ---------------------------------------------------------------------------
// isSameOrder — ali se vrstni red (in razpored po dnevih) ni spremenil
// ---------------------------------------------------------------------------

/**
 * Primerjava ravnih zaporedij id-jev obeh načrtov. V ključ je DEL zaporedja
 * tudi MEJA DNI (notranji ločili \u0000/\u0001, ki v id-jih ne moreta
 * nastopati): premik čez mejo dni spremeni načrt ([[A],[B]] → [[],[A,B]]
 * ima sicer enako ravno zaporedje A,B, a drugačno strukturo dni — takšnega
 * spusta ne smemo tiho zavreči kot „nič se ni spremenilo").
 */
export function isSameOrder(a: TripStop[][], b: TripStop[][]): boolean {
  const key = (days: TripStop[][]) =>
    days.map((stops) => stops.map((s) => s.id).join("\u0000")).join("\u0001");
  return key(a) === key(b);
}
