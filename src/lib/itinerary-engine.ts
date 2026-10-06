/**
 * DETERMINISTIČNI MOTOR ITINERERJA (rekonstrukcija naloge 45-d).
 *
 * Po vzorcu izvirnika (/api/itinerary + lib/deterministic-itinerary.ts,
 * geo-validacija P0.2), poenostavljeno na 38 destinacij kanonskega nabora:
 * - 0 AI žetonov, 0 omrežja, 0 ure — ČIST modul (strežnik + klient);
 * - ISTI vhod → ISTI izhod (nobenih klicev ure/naključja);
 * - iskrenostni kanon: vse ocene so razkrite ("~", hevristika
 *   haversine × 1,3 pri ~60 km/h), manjkajoči podatki ostanejo NEZNANI.
 *
 * Struktura dneva: 2–4 postanki znotraj 09:00–19:00, trajanja iz
 * destination.duration, cene iz costPerPerson, razpršitev tipov,
 * sezonska prednost (bestSeason), regija kot trdi filter.
 */

import {
  DESTINATIONS,
  REGIONS,
  regionLabel,
  typeLabel,
  type Budget,
  type Destination,
  type Season,
} from "./slovenia-data";
import type { ItineraryPlan, MyTripItem, TripStop } from "./types";

export type PlannerLang = "sl" | "en";

// ---------------------------------------------------------------------------
// Geometrija (isti kanon kot geo-validacija P0.2 izvirnika)
// ---------------------------------------------------------------------------

/** Cestni faktor premočne razdalje (pošteno razkrit z "~"). */
export const ROAD_FACTOR = 1.3;
/** Povprečna hitrost za hevristične čase vožnje (km/h). */
export const AVG_SPEED_KMH = 60;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Zaokroži na 5 (km ali minute) — brez lažne natančnosti "137 km". */
export function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

/** Ocena cestne razdalje (premočna × 1,3) — vedno "~" v prikazu. */
export function roadKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  return haversineKm(a, b) * ROAD_FACTOR;
}

/** Ocena časa vožnje v minutah (~60 km/h, zaokroženo na 5). */
export function travelMinutes(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  return round5((roadKm(a, b) / AVG_SPEED_KMH) * 60);
}

// ---------------------------------------------------------------------------
// Trajanja: destination.duration ("1 dan", "1-2 dni", "2 dni", "2-3 dni") →
// predlog trajanja OBISKA v minutah (deterministična preslikava, dokumentirana)
// ---------------------------------------------------------------------------

export function durationToMinutes(duration: string): number {
  const d = duration.trim().toLowerCase();
  if (d.includes("pol")) return 120;
  const range = d.match(/(\d+)\s*-\s*(\d+)/);
  const single = d.match(/(\d+)/);
  const n = range ? Number(range[2]) : single ? Number(single[1]) : 1;
  if (n >= 3) return 300;
  if (n === 2) return 270;
  return 150;
}

// ---------------------------------------------------------------------------
// Ujemanje interesov (normalizacija brez diakritik + stabilni jezikoslovni
// koren + sinhroni slovar za pogoste potovalne besede)
// ---------------------------------------------------------------------------

/** Male črke, odstranjene diakritike (čšžđć), samo znaki a-z0-9. */
export function normText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Koren besede (odstranjen samoglasni končnik za sklone/množino). */
function stemWord(s: string): string {
  return s.replace(/[aeiou]$/, "");
}

/**
 * Sinhroni slovar: pogoste proste besede, ki se NE pojavijo dobesedno v
 * podatkih (npr. "morje" vs. tip "obala"). Vrednosti so iskalni koreni.
 */
const SYNONYMS: Record<string, string[]> = {
  morje: ["obala", "coast", "morska", "morje"],
  morju: ["obala", "coast", "morska"],
  mor: ["obala", "coast", "morska"],
  kopanje: ["kopanje", "plavanje", "plaza"],
  plavanje: ["plavanje", "kopanje"],
  gora: ["gorovje", "mountain", "triglav"],
  gore: ["gorovje", "mountain", "triglav"],
  planine: ["gorovje", "mountain", "pohodnistvo"],
  planin: ["gorovje", "mountain"],
  pohod: ["pohodnistvo", "pohod"],
  sprehodi: ["sprehod"],
  jame: ["jama", "cave"],
  jam: ["jama", "cave"],
  gradovi: ["grad", "castle"],
  mesta: ["mesto", "city"],
  mest: ["mesto", "city"],
  reke: ["reka", "river"],
  reki: ["reka", "river"],
  jezera: ["jezero", "lake"],
  jezeru: ["jezero", "lake"],
  soteske: ["soteska", "gorge"],
  sotesk: ["soteska", "gorge"],
  zdravje: ["zdravje", "zdravilisce", "spa", "wellness"],
  sprostitev: ["sprostitev", "wellness", "spa", "zdravilisce"],
  kulinarika: ["kulinaricna", "hrana", "gourmet"],
  kulinarike: ["kulinaricna", "hrana"],
  vecerja: ["vecerja", "hrana", "kulinaricna", "restavracija"],
  hrani: ["hrana", "kulinaricna"],
  vina: ["vino", "degustac"],
  vinski: ["vino", "degustac"],
  smuci: ["smucanje"],
  zimu: ["smucanje", "zim"],
  adrenalinu: ["adrenalin", "rafting", "canyoning", "zip"],
  avanturu: ["avantura"],
  druzini: ["druzina"],
  // EN → SL most common travel words (chips so podatkov nabora so slovenski).
  family: ["druzina"],
  families: ["druzina"],
  kids: ["druzina", "otrok"],
  hiking: ["pohodnistvo", "pohod"],
  walk: ["sprehod"],
  walking: ["sprehod"],
  wine: ["vino", "degustac"],
  food: ["hrana", "kulinaricna"],
  sea: ["obala", "morska", "morje"],
  beach: ["plaza", "kopanje"],
  mountains: ["gorovje", "mountain"],
  caves: ["jama", "cave"],
  cave: ["jama"],
  castle: ["grad", "castle"],
  city: ["mesto", "city"],
  river: ["reka", "river"],
  spa: ["zdravilisce", "spa"],
  nature: ["narava"],
  romance: ["romantika"],
  romantic: ["romantika"],
  history: ["zgodovina"],
  adventure: ["avantura", "adrenalin"],
  swimming: ["plavanje", "kopanje"],
  kayaking: ["kajak"],
  biking: ["kolo"],
  cycling: ["kolo"],
  skiing: ["smucanje"],
  photography: ["fotografija"],
  museums: ["muzej"],
  museum: ["muzej"],
};

/** Sinhroni slovar s normaliziranimi (brezdiakritičnimi) ključi. */
const SYNONYMS_N = new Map<string, string[]>(
  Object.entries(SYNONYMS).map(([k, v]) => [normText(k), v])
);

function destinationBlob(d: Destination): string {
  return normText(
    [
      d.name,
      d.slug,
      d.tagline,
      d.type,
      typeLabel(d.type, "sl"),
      typeLabel(d.type, "en"),
      d.region,
      regionLabel(d.region, "sl"),
      regionLabel(d.region, "en"),
      ...d.highlights,
      ...d.activities,
      ...d.bestFor,
      ...d.bestSeason,
    ].join(" | ")
  );
}

/** Ali se interes ujema z destinacijo (interes se normalizira tu). */
function interestMatches(blobTokens: string[], blob: string, interestRaw: string): boolean {
  const interest = normText(interestRaw);
  if (!interest) return false;
  if (blob.includes(interest)) return true;
  const stem = stemWord(interest);
  if (stem.length >= 3) {
    for (const token of blobTokens) {
      if (token.startsWith(stem)) return true;
    }
  }
  for (const syn of SYNONYMS_N.get(interest) ?? []) {
    if (blob.includes(syn)) return true;
    const synStem = stemWord(syn);
    if (synStem.length >= 3) {
      for (const token of blobTokens) {
        if (token.startsWith(synStem)) return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Vhod/izhod motorja
// ---------------------------------------------------------------------------

export interface PlannerQuery {
  interests: string[];
  days: number;
  region?: string;
  season?: Season;
  budget?: Budget;
  locale?: PlannerLang;
}

const DAY_START_MIN = 9 * 60;
const DAY_END_MIN = 19 * 60;
const MAX_STOPS_PER_DAY = 4;
const NEIGHBOR_POOL = 12;

function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Preslikava budget ravni (€=1 … €€€=3). */
export function budgetTier(b: Budget): number {
  return b.length;
}

// ---------------------------------------------------------------------------
// JEDRO: deterministična sestava načrta
// ---------------------------------------------------------------------------

export function buildItinerary(query: PlannerQuery): ItineraryPlan {
  const lang: PlannerLang = query.locale === "en" ? "en" : "sl";
  const interests = query.interests.filter((i) => i.length > 0);

  // 1) OCENA kandidatov: ujemanje interesov + sezonska prednost + rating.
  const blobs = new Map<string, { blob: string; tokens: string[] }>();
  for (const d of DESTINATIONS) {
    const blob = destinationBlob(d);
    blobs.set(d.id, { blob, tokens: blob.split(" ").filter(Boolean) });
  }

  interface Candidate {
    dest: Destination;
    matched: string[];
    seasonFit: boolean;
    score: number;
  }

  let budgetRelaxed = false;
  const inBudget = (d: Destination) =>
    !query.budget || budgetTier(d.budget) <= budgetTier(query.budget);

  const score = (d: Destination): Candidate => {
    const { blob, tokens } = blobs.get(d.id) ?? { blob: "", tokens: [] };
    const matched = interests.filter((i) => interestMatches(tokens, blob, i));
    const seasonFit = query.season ? d.bestSeason.includes(query.season) : false;
    return {
      dest: d,
      matched,
      seasonFit,
      score: matched.length * 3 + (seasonFit ? 2 : 0) + d.rating / 10,
    };
  };

  const regionOk = (d: Destination) => !query.region || d.region === query.region;

  let pool = DESTINATIONS.filter((d) => regionOk(d) && inBudget(d)).map(score);
  if (pool.length < query.days * 2 && query.budget) {
    // Proračunski filter sprostimo (iskreno razkrito v coverageNote).
    budgetRelaxed = true;
    pool = DESTINATIONS.filter(regionOk).map(score);
  }

  // Deterministično urejanje: score ↓, rating ↓, id ↑.
  const sorted = [...pool].sort(
    (a, b) =>
      b.score - a.score || b.dest.rating - a.dest.rating || a.dest.id.localeCompare(b.dest.id)
  );

  // 2) SESTAVA DNI: sidro (najboljša neuporabljena) + najbližji sosedje
  //    iz vrha urejene liste (razpršitev tipov, časovni okvir 09:00–19:00).
  const used = new Set<string>();
  const daysOut: Destination[][] = [];

  for (let dayIdx = 0; dayIdx < query.days; dayIdx++) {
    const anchor = sorted.find((c) => !used.has(c.dest.id));
    if (!anchor) break;

    const dayList: Destination[] = [anchor.dest];
    used.add(anchor.dest.id);

    let cursor = anchor.dest;
    let t = DAY_START_MIN + durationToMinutes(anchor.dest.duration);

    while (dayList.length < MAX_STOPS_PER_DAY) {
      const unused = sorted.filter((c) => !used.has(c.dest.id));
      if (unused.length === 0) break;

      // Sojedstvena izbira: najprej kandidati v radiju ~100 km (premočno)
      // od SIDRA dneva (koherenten izlet), sicer od kurzorja, sicer vrh
      // lestvice (iskreno — dolge noge bo validacija označila).
      const nearAnchor = unused.filter(
        (c) => haversineKm(anchor.dest.coords, c.dest.coords) <= 100
      );
      const pool2 =
        nearAnchor.length > 0
          ? nearAnchor
          : unused.filter(
              (c) => haversineKm(cursor.coords, c.dest.coords) <= 100
            );
      const neighbors = (pool2.length > 0 ? pool2 : unused).slice(0, NEIGHBOR_POOL);

      const dayTypes = new Set(dayList.map((d) => d.type));
      const byTravel = [...neighbors].sort((a, b) => {
        const ta = travelMinutes(cursor.coords, a.dest.coords);
        const tb = travelMinutes(cursor.coords, b.dest.coords);
        return ta - tb || a.dest.id.localeCompare(b.dest.id);
      });
      const fresh = byTravel.find((c) => !dayTypes.has(c.dest.type));
      const pick = fresh ?? byTravel[0];

      const travel = travelMinutes(cursor.coords, pick.dest.coords);
      const dur = durationToMinutes(pick.dest.duration);
      if (t + travel + dur > DAY_END_MIN) break;

      dayList.push(pick.dest);
      used.add(pick.dest.id);
      t += travel + dur;
      cursor = pick.dest;
    }

    daysOut.push(dayList);
  }

  // 3) URNIK vsakega dne (09:00 + trajanja + ocenjene vožnje).
  const days: TripStop[][] = daysOut.map((dayList, dayIdx) => {
    let t = DAY_START_MIN;
    const stops: TripStop[] = [];
    dayList.forEach((dest, stopIdx) => {
      if (stopIdx > 0) {
        t += travelMinutes(dayList[stopIdx - 1].coords, dest.coords);
      }
      stops.push({
        id: `${dest.id}--d${dayIdx}s${stopIdx}`,
        name: dest.name,
        time: hhmm(t),
        durationMin: durationToMinutes(dest.duration),
        cost: dest.costPerPerson,
        kind: dest.type,
        coords: dest.coords,
        slug: dest.slug,
        region: dest.region,
      });
      t += stops[stopIdx].durationMin;
    });
    return stops;
  });

  const allStops = days.flat();
  const totalCost = allStops.reduce((sum, s) => sum + s.cost, 0);
  const regionsUsed = [...new Set(allStops.map((s) => s.region ?? ""))].filter(Boolean);

  const names = [...new Set(allStops.map((s) => s.name))];
  const dayTitles = days.map((stops, i) => {
    const r = stops[0]?.region;
    const regionTxt = r ? regionLabel(r, lang) : "";
    const head = regionTxt ? `${regionTxt} — ` : "";
    return lang === "en"
      ? `Day ${i + 1} · ${head}${stops[0]?.name ?? ""}`
      : `Dan ${i + 1} · ${head}${stops[0]?.name ?? ""}`;
  });

  const daysWord =
    lang === "en"
      ? `${days.length} ${days.length === 1 ? "day" : "days"}`
      : `${days.length} ${days.length === 1 ? "dan" : days.length === 2 ? "dni" : "dni"}`;

  const titleNames = names.slice(0, 2).join(" · ") + (names.length > 2 ? ` +${names.length - 2}` : "");
  const title =
    lang === "en" ? `Plan: ${titleNames || "—"}` : `Načrt: ${titleNames || "—"}`;

  const stopsWord =
    lang === "en"
      ? `${allStops.length} ${allStops.length === 1 ? "stop" : "stops"}`
      : `${allStops.length} ${allStops.length === 1 ? "postanek" : allStops.length === 2 ? "postanka" : "postankov"}`;

  const regionsWord =
    lang === "en"
      ? `${regionsUsed.length} ${regionsUsed.length === 1 ? "region" : "regions"}`
      : `${regionsUsed.length} ${regionsUsed.length === 1 ? "regija" : regionsUsed.length === 2 ? "regiji" : regionsUsed.length <= 4 ? "regije" : "regij"}`;

  const summary =
    lang === "en"
      ? `Deterministic ${daysWord} plan: ${stopsWord} across ${regionsWord}, estimated ${totalCost} € per person. Times are proposals (09:00–19:00); drives are straight-line ×1.3 estimates at ~${AVG_SPEED_KMH} km/h.`
      : `Deterministični načrt za ${daysWord}: ${stopsWord} v ${regionsWord}, ocena ${totalCost} € na osebo. Časi so predlogi (09:00–19:00); vožnje so ocene (premočna ×1,3 pri ~${AVG_SPEED_KMH} km/h).`;

  return {
    days,
    dayTitles,
    title,
    summary,
    totalCost,
    coverageNote: buildCoverageNote({
      lang,
      interests,
      pool,
      selected: allStops,
      days,
      requestedDays: query.days,
      region: query.region,
      season: query.season,
      budget: query.budget,
      budgetRelaxed,
    }),
    meta: {
      interests,
      days: query.days,
      region: query.region,
      season: query.season,
      budget: query.budget,
      locale: lang,
    },
  };
}

// ---------------------------------------------------------------------------
// CoverageNote — iskrena opomba o pokritju želja/filtrov
// ---------------------------------------------------------------------------

function buildCoverageNote(args: {
  lang: PlannerLang;
  interests: string[];
  pool: { dest: Destination; matched: string[] }[];
  selected: TripStop[];
  days: TripStop[][];
  requestedDays: number;
  region?: string;
  season?: Season;
  budget?: Budget;
  budgetRelaxed: boolean;
}): string {
  const { lang, interests, pool, selected, days, requestedDays } = args;
  const parts: string[] = [];

  const matchedInterests = interests.filter((i) =>
    pool.some((c) => c.matched.includes(i))
  );
  const unmatched = interests.filter((i) => !matchedInterests.includes(i));

  if (lang === "en") {
    if (matchedInterests.length)
      parts.push(`Interests matched: ${matchedInterests.join(", ")}.`);
    if (unmatched.length)
      parts.push(`No direct match for: ${unmatched.join(", ")} — try a similar word.`);
    parts.push(`${selected.length} of ${DESTINATIONS.length} destinations selected.`);
  } else {
    if (matchedInterests.length)
      parts.push(`Želje z zadetkom: ${matchedInterests.join(", ")}.`);
    if (unmatched.length)
      parts.push(`Brez neposrednega zadetka: ${unmatched.join(", ")} — poskusi podobno besedo.`);
    parts.push(`Izbranih ${selected.length} od ${DESTINATIONS.length} destinacij.`);
  }

  if (args.region) {
    parts.push(
      lang === "en"
        ? `Region filter: ${regionLabel(args.region, "en")}.`
        : `Filter regije: ${regionLabel(args.region, "sl")}.`
    );
  }
  if (args.season) {
    const seasonName: Record<Season, { sl: string; en: string }> = {
      spring: { sl: "pomlad", en: "spring" },
      summer: { sl: "poletje", en: "summer" },
      autumn: { sl: "jesen", en: "autumn" },
      winter: { sl: "zima", en: "winter" },
    };
    const destIds = new Set(selected.map((s) => s.id.split("--")[0]));
    const fitCount = pool.filter(
      (c) => destIds.has(c.dest.id) && c.dest.bestSeason.includes(args.season!)
    ).length;
    parts.push(
      lang === "en"
        ? `Season preference (${seasonName[args.season].en}): ${fitCount}/${selected.length} stops are at their best then.`
        : `Sezonska prednost (${seasonName[args.season].sl}): ${fitCount}/${selected.length} postankov je takrat najboljših.`
    );
  }
  if (args.budget) {
    parts.push(
      lang === "en"
        ? `Budget filter: up to ${args.budget}.`
        : `Proračunski filter: do ${args.budget}.`
    );
    if (args.budgetRelaxed)
      parts.push(
        lang === "en"
          ? "The budget filter was relaxed — too few destinations matched all filters."
          : "Proračunski filter je bil sproščen — premogo destinacij za vse filtre."
      );
  }
  if (days.length < requestedDays) {
    parts.push(
      lang === "en"
        ? `Only ${days.length} day(s) could be filled (you asked for ${requestedDays}).`
        : `Zapolniti je bilo mogoče le ${days.length} ${days.length === 1 ? "dan" : "dni"} (zahtevanih ${requestedDays}).`
    );
  }
  days.forEach((d, i) => {
    if (d.length === 1) {
      parts.push(
        lang === "en"
          ? `Day ${i + 1} has a single stop — the filtered set is narrow.`
          : `Dan ${i + 1} ima le en postanek — nabor s filtri je ozek.`
      );
    }
  });
  parts.push(
    lang === "en"
      ? `All ${REGIONS ? Object.keys(REGIONS).length : 20} regions available in the dataset; engine is deterministic — the same input always yields the same plan.`
      : `Vseh destinacij v naboru: ${DESTINATIONS.length}; motor je determinističen — isti vhod vedno da isti načrt.`
  );
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// OSNUTEK iz zbirke "Moja pot" (vrstni red uporabnika se spoštuje)
// ---------------------------------------------------------------------------

export interface MyTripDraft {
  plan: ItineraryPlan;
  /** Zapisi zbirke brez kanonske destinacije (brez geo/časov — iskreno). */
  unmatched: MyTripItem[];
}

export function buildPlanFromMyTrip(items: MyTripItem[], locale?: PlannerLang): MyTripDraft {
  const lang: PlannerLang = locale === "en" ? "en" : "sl";
  const unmatched: MyTripItem[] = [];
  const dests: Destination[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const dest = DESTINATIONS.find((d) => d.slug === item.refId || d.id === item.refId);
    if (dest && !seen.has(dest.id)) {
      seen.add(dest.id);
      dests.push(dest);
    } else if (!dest) {
      unmatched.push(item);
    }
  }

  let t = DAY_START_MIN;
  const stops: TripStop[] = dests.map((dest, idx) => {
    if (idx > 0) t += travelMinutes(dests[idx - 1].coords, dest.coords);
    const stop: TripStop = {
      id: `${dest.id}--mytrip${idx}`,
      name: dest.name,
      time: hhmm(t),
      durationMin: durationToMinutes(dest.duration),
      cost: dest.costPerPerson,
      kind: dest.type,
      coords: dest.coords,
      slug: dest.slug,
      region: dest.region,
    };
    t += stop.durationMin;
    return stop;
  });

  const totalCost = stops.reduce((s, x) => s + x.cost, 0);
  const title = lang === "en" ? "Draft: My trip" : "Osnutek: Moja pot";
  const summary =
    lang === "en"
      ? `Draft built from your “My trip” collection in your order: ${stops.length} stop(s), estimated ${totalCost} € per person. Times are proposals (09:00 start, drives estimated at ~${AVG_SPEED_KMH} km/h).`
      : `Osnutek iz zbirke „Moja pot“ v tvojem vrstnem redu: ${stops.length} ${stops.length === 1 ? "postanek" : "postankov"}, ocena ${totalCost} € na osebo. Časi so predlogi (začetek 09:00, vožnje ocenjene pri ~${AVG_SPEED_KMH} km/h).`;

  return {
    plan: {
      days: stops.length > 0 ? [stops] : [],
      dayTitles:
        stops.length > 0
          ? [lang === "en" ? "Day 1 · My trip (draft)" : "Dan 1 · Moja pot (osnutek)"]
          : [],
      title,
      summary,
      totalCost,
      coverageNote:
        lang === "en"
          ? "Draft from your local collection — check feasibility before you go."
          : "Osnutek iz lokalne zbirke — pred odhodom preveri izvedljivost.",
      meta: { interests: [], days: 1, locale: lang },
    },
    unmatched,
  };
}

// ---------------------------------------------------------------------------
// GEO/ČASOVNA VALIDACIJA (poenostavljena P0.2 — plast NAD načrtom)
// ---------------------------------------------------------------------------

export type GeoIssueLevel = "warn" | "error";
export type GeoRuleId =
  | "leg_distance"
  | "day_km"
  | "day_stops"
  | "day_overload"
  | "schedule_overlap"
  | "schedule_gap"
  | "long_gap"
  | "duplicate_stop"
  | "missing_coords"
  | "missing_time";

export interface GeoValidationIssue {
  day: number;
  level: GeoIssueLevel;
  rule: GeoRuleId;
  message: string;
}

export interface DayGeoMetrics {
  day: number;
  stops: number;
  km: number;
  drivingMinutes: number;
  activityMinutes: number;
  loadMinutes: number;
}

export interface GeoValidation {
  days: DayGeoMetrics[];
  issues: GeoValidationIssue[];
  tripKm: number;
  worst: "ok" | "warn" | "error";
}

function parseTimeToMin(t: string | null): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const GEO_MSG = {
  legWarn: { sl: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km v enem kosu (udobno je do 80 km).`, en: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km in one leg (comfortable limit is 80 km).` },
  legErr: { sl: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km v enem kosu — premik se splača razdeliti ali prenočiti na pol poti.`, en: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km in one leg — consider splitting the transfer or an overnight stop.` },
  dayKm: { sl: (n: number) => `~${n} km vožnje v enem dnevu (udoben okvir je okoli 150 km).`, en: (n: number) => `~${n} km of driving in one day (comfortable limit is around 150 km).` },
  dayStops: { sl: (n: number) => `${n} postankov v enem dnevu — zelo malo časa, da karkoli res doživiš.`, en: (n: number) => `${n} stops in one day — very little time to actually experience each place.` },
  overload: { sl: (h: string) => `Dan je preobremenjen: ~${h} h aktivnosti in vožnje skupaj.`, en: (h: string) => `Day is overloaded: ~${h} h of activities and driving together.` },
  overlap: { sl: (a: string, b: string) => `Urnik se prekriva: ${a} se konča po začetku ${b}.`, en: (a: string, b: string) => `Schedule overlaps: ${a} ends after ${b} starts.` },
  gapErr: { sl: (a: string, b: string, gap: number, drive: number) => `Urnik ne gre skupaj: ${a} → ${b} ima ${gap} min razlike, sama vožnja pa vzame ~${drive} min.`, en: (a: string, b: string, gap: number, drive: number) => `Schedule doesn't work: ${a} → ${b} has ${gap} min between, but the drive alone takes ~${drive} min.` },
  gapWarn: { sl: (a: string, b: string, gap: number, drive: number) => `Urnik je tesen: ${a} → ${b} ima ${gap} min razlike, vožnja pa ~${drive} min — brez rezerve.`, en: (a: string, b: string, gap: number, drive: number) => `Schedule is tight: ${a} → ${b} has ${gap} min between, the drive ~${drive} min — no buffer.` },
  longGap: { sl: (a: string, b: string, idle: number) => `Dolg presledek: med ${a} in ${b} ostane ~${idle} min prostega časa po vožnji.`, en: (a: string, b: string, idle: number) => `Long gap: ~${idle} min of idle time remains between ${a} and ${b} after the drive.` },
  duplicate: { sl: (n: string) => `${n} je v istem dnevu dvakrat.`, en: (n: string) => `${n} appears twice in the same day.` },
  missingCoords: { sl: (n: string) => `${n}: koordinate niso znane — razdalje ni mogoče preveriti.`, en: (n: string) => `${n}: coordinates unknown — distances cannot be checked.` },
  missingTime: { sl: (n: string) => `${n}: ura ni znana — urnika ni mogoče preveriti.`, en: (n: string) => `${n}: time unknown — the schedule cannot be checked.` },
} as const;

export function validatePlanGeo(plan: ItineraryPlan, locale?: PlannerLang): GeoValidation {
  const lang: PlannerLang = locale === "en" ? "en" : "sl";
  const issues: GeoValidationIssue[] = [];
  const metrics: DayGeoMetrics[] = [];
  let tripKm = 0;

  plan.days.forEach((stops, dayIdx) => {
    const day = dayIdx + 1;
    let km = 0;
    let driving = 0;
    let activity = 0;
    const seenIds = new Set<string>();

    stops.forEach((stop, i) => {
      activity += stop.durationMin;
      if (!stop.coords) {
        issues.push({
          day,
          level: "warn",
          rule: "missing_coords",
          message: GEO_MSG.missingCoords[lang](stop.name),
        });
      }
      if (stop.time == null) {
        issues.push({
          day,
          level: "warn",
          rule: "missing_time",
          message: GEO_MSG.missingTime[lang](stop.name),
        });
      }
      const key = stop.id.split("--")[0];
      if (seenIds.has(key)) {
        issues.push({
          day,
          level: "warn",
          rule: "duplicate_stop",
          message: GEO_MSG.duplicate[lang](stop.name),
        });
      }
      seenIds.add(key);

      const next = stops[i + 1];
      if (!next) return;
      if (stop.coords && next.coords) {
        const legKm = round5(roadKm(stop.coords, next.coords));
        const driveMin = travelMinutes(stop.coords, next.coords);
        km += legKm;
        driving += driveMin;

        if (legKm > 150) {
          issues.push({ day, level: "error", rule: "leg_distance", message: GEO_MSG.legErr[lang](stop.name, next.name, legKm) });
        } else if (legKm > 80) {
          issues.push({ day, level: "warn", rule: "leg_distance", message: GEO_MSG.legWarn[lang](stop.name, next.name, legKm) });
        }

        const sEnd = parseTimeToMin(stop.time);
        const nStart = parseTimeToMin(next.time);
        if (sEnd != null && nStart != null) {
          const gap = nStart - (sEnd + stop.durationMin);
          if (gap < 0) {
            issues.push({ day, level: "error", rule: "schedule_overlap", message: GEO_MSG.overlap[lang](stop.name, next.name) });
          } else if (gap + 1 < driveMin) {
            issues.push({ day, level: "error", rule: "schedule_gap", message: GEO_MSG.gapErr[lang](stop.name, next.name, gap, driveMin) });
          } else if (gap < driveMin) {
            issues.push({ day, level: "warn", rule: "schedule_gap", message: GEO_MSG.gapWarn[lang](stop.name, next.name, gap, driveMin) });
          } else if (gap - driveMin > 180) {
            issues.push({ day, level: "warn", rule: "long_gap", message: GEO_MSG.longGap[lang](stop.name, next.name, gap - driveMin) });
          }
        }
      }
    });

    if (km > 250) {
      issues.push({ day, level: "error", rule: "day_km", message: GEO_MSG.dayKm[lang](km) });
    } else if (km > 150) {
      issues.push({ day, level: "warn", rule: "day_km", message: GEO_MSG.dayKm[lang](km) });
    }
    if (stops.length > 4) {
      issues.push({ day, level: "warn", rule: "day_stops", message: GEO_MSG.dayStops[lang](stops.length) });
    }
    const load = activity + driving;
    if (load > 13 * 60) {
      issues.push({ day, level: "error", rule: "day_overload", message: GEO_MSG.overload[lang](((load / 60) as number).toFixed(1)) });
    } else if (load > 11 * 60) {
      issues.push({ day, level: "warn", rule: "day_overload", message: GEO_MSG.overload[lang](((load / 60) as number).toFixed(1)) });
    }

    tripKm += km;
    metrics.push({
      day,
      stops: stops.length,
      km,
      drivingMinutes: driving,
      activityMinutes: activity,
      loadMinutes: load,
    });
  });

  const worst: GeoValidation["worst"] = issues.some((i) => i.level === "error")
    ? "error"
    : issues.some((i) => i.level === "warn")
      ? "warn"
      : "ok";

  return { days: metrics, issues, tripKm, worst };
}

// ---------------------------------------------------------------------------
// Predlogi interesov (chips) — activities ∪ bestFor s števci pojavov
// ---------------------------------------------------------------------------

export interface InterestChip {
  label: string;
  count: number;
}

export function interestChips(): InterestChip[] {
  const counts = new Map<string, number>();
  for (const d of DESTINATIONS) {
    for (const a of [...d.activities, ...d.bestFor]) {
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "sl"));
}

// ---------------------------------------------------------------------------
// Oblikovanje (SL/EN)
// ---------------------------------------------------------------------------

export function formatMoney(amount: number, locale?: PlannerLang): string {
  return locale === "en" ? `€${amount}` : `${amount} €`;
}

export function formatDuration(min: number, locale?: PlannerLang): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Povezava OSM navigacije (legal, brez ključev) — ciljni koordinati. */
export function osmDirectionsUrl(coords: { lat: number; lng: number }): string {
  return `https://www.openstreetmap.org/directions?to=${coords.lat}%2C${coords.lng}`;
}
