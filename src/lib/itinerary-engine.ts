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
import { asPickLocale, type PickLocale } from "./i18n-pick";
import type { ItineraryPlan, MyTripItem, TripStop } from "./types";

/**
 * Jezik načrtovalca — od 2.21.0 (4-c) vsi podprti jeziki lupine
 * (prej „sl" | "en": it/de/fr/es uporabniki so dobili slovenski načrt).
 * Zgodovinsko ime tipa se ohranja (javní podpis), identičen PickLocale.
 */
export type PlannerLang = PickLocale;

/**
 * Sporočila motorja načrta (6 jezikov, isti vzorec kot GEO_MSG).
 * sl/en izhodi so BAJTNO identični predhodnim ternarijem; it/de/fr/es
 * so novi prevodi (4-c, PRODUCT-AUDIT §9).
 */
const PLANNER_MSG = {
  dayTitle: {
    sl: (n: number, head: string, name: string) => `Dan ${n} · ${head}${name}`,
    en: (n: number, head: string, name: string) => `Day ${n} · ${head}${name}`,
    it: (n: number, head: string, name: string) => `Giorno ${n} · ${head}${name}`,
    de: (n: number, head: string, name: string) => `Tag ${n} · ${head}${name}`,
    fr: (n: number, head: string, name: string) => `Jour ${n} · ${head}${name}`,
    es: (n: number, head: string, name: string) => `Día ${n} · ${head}${name}`,
  },
  daysWord: {
    sl: (n: number) => `${n} ${n === 1 ? "dan" : "dni"}`,
    en: (n: number) => `${n} ${n === 1 ? "day" : "days"}`,
    it: (n: number) => `${n} ${n === 1 ? "giorno" : "giorni"}`,
    de: (n: number) => `${n} ${n === 1 ? "Tag" : "Tage"}`,
    fr: (n: number) => `${n} ${n === 1 ? "jour" : "jours"}`,
    es: (n: number) => `${n} ${n === 1 ? "día" : "días"}`,
  },
  stopsWord: {
    sl: (n: number) => `${n} ${n === 1 ? "postanek" : n === 2 ? "postanka" : "postankov"}`,
    en: (n: number) => `${n} ${n === 1 ? "stop" : "stops"}`,
    it: (n: number) => `${n} ${n === 1 ? "tappa" : "tappe"}`,
    de: (n: number) => `${n} ${n === 1 ? "Stopp" : "Stopps"}`,
    fr: (n: number) => `${n} ${n === 1 ? "arrêt" : "arrêts"}`,
    es: (n: number) => `${n} ${n === 1 ? "parada" : "paradas"}`,
  },
  regionsWord: {
    sl: (n: number) => `${n} ${n === 1 ? "regija" : n === 2 ? "regiji" : n <= 4 ? "regije" : "regij"}`,
    en: (n: number) => `${n} ${n === 1 ? "region" : "regions"}`,
    it: (n: number) => `${n} ${n === 1 ? "regione" : "regioni"}`,
    de: (n: number) => `${n} ${n === 1 ? "Region" : "Regionen"}`,
    fr: (n: number) => `${n} ${n === 1 ? "région" : "régions"}`,
    es: (n: number) => `${n} ${n === 1 ? "región" : "regiones"}`,
  },
  planTitle: {
    sl: (names: string) => `Načrt: ${names || "—"}`,
    en: (names: string) => `Plan: ${names || "—"}`,
    it: (names: string) => `Piano: ${names || "—"}`,
    de: (names: string) => `Plan: ${names || "—"}`,
    fr: (names: string) => `Itinéraire : ${names || "—"}`,
    es: (names: string) => `Plan: ${names || "—"}`,
  },
  summary: {
    sl: (daysWord: string, stopsWord: string, regionsWord: string, cost: number, speed: number) => `Deterministični načrt za ${daysWord}: ${stopsWord} v ${regionsWord}, ocena ${cost} € na osebo. Časi so predlogi (09:00–19:00); vožnje so ocene (premočna ×1,3 pri ~${speed} km/h).`,
    en: (daysWord: string, stopsWord: string, regionsWord: string, cost: number, speed: number) => `Deterministic ${daysWord} plan: ${stopsWord} across ${regionsWord}, estimated ${cost} € per person. Times are proposals (09:00–19:00); drives are straight-line ×1.3 estimates at ~${speed} km/h.`,
    it: (daysWord: string, stopsWord: string, regionsWord: string, cost: number, speed: number) => `Piano deterministico di ${daysWord}: ${stopsWord} in ${regionsWord}, stima ${cost} € a persona. Gli orari sono proposte (09:00–19:00); i tragitti sono stime (linea d'aria ×1,3 a ~${speed} km/h).`,
    de: (daysWord: string, stopsWord: string, regionsWord: string, cost: number, speed: number) => `Deterministischer Plan über ${daysWord}: ${stopsWord} in ${regionsWord}, geschätzt ${cost} € pro Person. Zeiten sind Vorschläge (09:00–19:00); Fahrten sind Schätzungen (Luftlinie ×1,3 bei ~${speed} km/h).`,
    fr: (daysWord: string, stopsWord: string, regionsWord: string, cost: number, speed: number) => `Itinéraire déterministe de ${daysWord} : ${stopsWord} à travers ${regionsWord}, estimation ${cost} € par personne. Les horaires sont des propositions (09:00–19:00) ; les trajets sont des estimations (à vol d'oiseau ×1,3 à ~${speed} km/h).`,
    es: (daysWord: string, stopsWord: string, regionsWord: string, cost: number, speed: number) => `Plan determinista de ${daysWord}: ${stopsWord} por ${regionsWord}, estimación ${cost} € por persona. Los horarios son propuestas (09:00–19:00); los trayectos son estimaciones (línea recta ×1,3 a ~${speed} km/h).`,
  },
  matchedInterests: {
    sl: (m: string) => `Želje z zadetkom: ${m}.`,
    en: (m: string) => `Interests matched: ${m}.`,
    it: (m: string) => `Interessi trovati: ${m}.`,
    de: (m: string) => `Getroffene Wünsche: ${m}.`,
    fr: (m: string) => `Envies trouvées : ${m}.`,
    es: (m: string) => `Intereses con coincidencia: ${m}.`,
  },
  noMatch: {
    sl: (u: string) => `Brez neposrednega zadetka: ${u} — poskusi podobno besedo.`,
    en: (u: string) => `No direct match for: ${u} — try a similar word.`,
    it: (u: string) => `Nessuna corrispondenza diretta per: ${u} — prova una parola simile.`,
    de: (u: string) => `Kein direkter Treffer für: ${u} — versuche ein ähnliches Wort.`,
    fr: (u: string) => `Pas de correspondance directe pour : ${u} — essaie un mot similaire.`,
    es: (u: string) => `Sin coincidencia directa para: ${u} — prueba una palabra similar.`,
  },
  selectedCount: {
    sl: (sel: number, total: number) => `Izbranih ${sel} od ${total} destinacij.`,
    en: (sel: number, total: number) => `${sel} of ${total} destinations selected.`,
    it: (sel: number, total: number) => `Selezionate ${sel} di ${total} destinazioni.`,
    de: (sel: number, total: number) => `${sel} von ${total} Zielen ausgewählt.`,
    fr: (sel: number, total: number) => `${sel} destinations sur ${total} sélectionnées.`,
    es: (sel: number, total: number) => `${sel} de ${total} destinos seleccionados.`,
  },
  regionFilter: {
    sl: (label: string) => `Filter regije: ${label}.`,
    en: (label: string) => `Region filter: ${label}.`,
    it: (label: string) => `Filtro regione: ${label}.`,
    de: (label: string) => `Regionsfilter: ${label}.`,
    fr: (label: string) => `Filtre région : ${label}.`,
    es: (label: string) => `Filtro de región: ${label}.`,
  },
  seasonPref: {
    sl: (s: string, fit: number, total: number) => `Sezonska prednost (${s}): ${fit}/${total} postankov je takrat najboljših.`,
    en: (s: string, fit: number, total: number) => `Season preference (${s}): ${fit}/${total} stops are at their best then.`,
    it: (s: string, fit: number, total: number) => `Preferenza stagionale (${s}): ${fit}/${total} tappe sono al meglio in quel periodo.`,
    de: (s: string, fit: number, total: number) => `Jahreszeitenpräferenz (${s}): ${fit}/${total} Stopps sind dann am besten.`,
    fr: (s: string, fit: number, total: number) => `Préférence de saison (${s}) : ${fit}/${total} arrêts sont alors au meilleur.`,
    es: (s: string, fit: number, total: number) => `Preferencia de temporada (${s}): ${fit}/${total} paradas están en su mejor momento entonces.`,
  },
  budgetFilter: {
    sl: (b: string) => `Proračunski filter: do ${b}.`,
    en: (b: string) => `Budget filter: up to ${b}.`,
    it: (b: string) => `Filtro budget: fino a ${b}.`,
    de: (b: string) => `Budgetfilter: bis ${b}.`,
    fr: (b: string) => `Filtre budget : jusqu'à ${b}.`,
    es: (b: string) => `Filtro de presupuesto: hasta ${b}.`,
  },
  budgetRelaxed: {
    sl: () => `Proračunski filter je bil sproščen — premogo destinacij za vse filtre.`,
    en: () => `The budget filter was relaxed — too few destinations matched all filters.`,
    it: () => `Il filtro budget è stato allentato — troppo poche destinazioni corrispondono a tutti i filtri.`,
    de: () => `Der Budgetfilter wurde gelockert — zu wenige Ziele entsprachen allen Filtern.`,
    fr: () => `Le filtre budget a été assoupli — trop peu de destinations correspondaient à tous les filtres.`,
    es: () => `El filtro de presupuesto se relajó — muy pocos destinos coincidían con todos los filtros.`,
  },
  onlyDays: {
    sl: (filled: number, requested: number) => `Zapolniti je bilo mogoče le ${filled} ${filled === 1 ? "dan" : "dni"} (zahtevanih ${requested}).`,
    en: (filled: number, requested: number) => `Only ${filled} day(s) could be filled (you asked for ${requested}).`,
    it: (filled: number, requested: number) => `È stato possibile riempire solo ${filled} ${filled === 1 ? "giorno" : "giorni"} (richiesti ${requested}).`,
    de: (filled: number, requested: number) => `Nur ${filled} Tag(e) konnten gefüllt werden (angefragt waren ${requested}).`,
    fr: (filled: number, requested: number) => `Seulement ${filled} jour(s) ont pu être remplis (tu en avais demandé ${requested}).`,
    es: (filled: number, requested: number) => `Solo se pudieron llenar ${filled} día(s) (pediste ${requested}).`,
  },
  singleStop: {
    sl: (d: number) => `Dan ${d} ima le en postanek — nabor s filtri je ozek.`,
    en: (d: number) => `Day ${d} has a single stop — the filtered set is narrow.`,
    it: (d: number) => `Il giorno ${d} ha una sola tappa — l'insieme filtrato è ristretto.`,
    de: (d: number) => `Tag ${d} hat nur einen Stopp — die gefilterte Auswahl ist eng.`,
    fr: (d: number) => `Le jour ${d} n'a qu'un seul arrêt — l'ensemble filtré est restreint.`,
    es: (d: number) => `El día ${d} tiene una sola parada — el conjunto filtrado es reducido.`,
  },
  datasetNote: {
    sl: (total: number) => `Vseh destinacij v naboru: ${total}; motor je determinističen — isti vhod vedno da isti načrt.`,
    en: (regionsCount: number) => `All ${regionsCount} regions available in the dataset; engine is deterministic — the same input always yields the same plan.`,
    it: (total: number) => `Destinazioni totali nel dataset: ${total}; il motore è deterministico — lo stesso input dà sempre lo stesso piano.`,
    de: (total: number) => `Alle Ziele im Datensatz: ${total}; die Engine ist deterministisch — dieselbe Eingabe ergibt immer denselben Plan.`,
    fr: (total: number) => `Toutes les destinations du jeu de données : ${total} ; le moteur est déterministe — la même entrée donne toujours le même itinéraire.`,
    es: (total: number) => `Todos los destinos del conjunto de datos: ${total}; el motor es determinista — la misma entrada da siempre el mismo plan.`,
  },
  geoChain: {
    sl: () => `Dnevi so urejeni geografsko (naslednji dan blizu prejšnjega, do ~120 km).`,
    en: () => `Days are ordered geographically (each day near the previous one, up to ~120 km).`,
    it: () => `I giorni sono ordinati geograficamente (ogni giorno vicino al precedente, fino a ~120 km).`,
    de: () => `Die Tage sind geografisch geordnet (jeder Tag in der Nähe des vorherigen, bis ~120 km).`,
    fr: () => `Les jours sont ordonnés géographiquement (chaque jour près du précédent, jusqu'à ~120 km).`,
    es: () => `Los días están ordenados geográficamente (cada día cerca del anterior, hasta ~120 km).`,
  },
  geoHop: {
    sl: (day: number, km: number) => `Dan ${day} je geografsko ločen (preskok ~${km} km) — tvoje želje so razpršene po regijah; dolgo vožnjo izrecno priznavamo.`,
    en: (day: number, km: number) => `Day ${day} is geographically separated (a ~${km} km hop) — your interests are spread across regions; we acknowledge the long drive explicitly.`,
    it: (day: number, km: number) => `Il giorno ${day} è separato geograficamente (un salto di ~${km} km) — i tuoi interessi sono sparsi tra le regioni; riconosciamo esplicitamente il lungo tragitto.`,
    de: (day: number, km: number) => `Tag ${day} ist geografisch getrennt (ein Sprung von ~${km} km) — deine Interessen sind über Regionen verteilt; wir weisen ausdrücklich auf die lange Fahrt hin.`,
    fr: (day: number, km: number) => `Le jour ${day} est géographiquement séparé (un saut de ~${km} km) — tes envies sont réparties entre les régions ; nous signalons explicitement le long trajet.`,
    es: (day: number, km: number) => `El día ${day} está geográficamente separado (un salto de ~${km} km) — tus intereses están repartidos por regiones; reconocemos explícitamente el trayecto largo.`,
  },
  draftTitle: {
    sl: () => `Osnutek: Moja pot`,
    en: () => `Draft: My trip`,
    it: () => `Bozza: Il mio viaggio`,
    de: () => `Entwurf: Meine Reise`,
    fr: () => `Brouillon : Mon voyage`,
    es: () => `Borrador: Mi viaje`,
  },
  draftSummary: {
    sl: (n: number, cost: number, speed: number) => `Osnutek iz zbirke „Moja pot“ v tvojem vrstnem redu: ${n} ${n === 1 ? "postanek" : "postankov"}, ocena ${cost} € na osebo. Časi so predlogi (začetek 09:00, vožnje ocenjene pri ~${speed} km/h).`,
    en: (n: number, cost: number, speed: number) => `Draft built from your “My trip” collection in your order: ${n} stop(s), estimated ${cost} € per person. Times are proposals (09:00 start, drives estimated at ~${speed} km/h).`,
    it: (n: number, cost: number, speed: number) => `Bozza creata dalla collezione “Il mio viaggio” nel tuo ordine: ${n} ${n === 1 ? "tappa" : "tappe"}, stima ${cost} € a persona. Gli orari sono proposte (inizio 09:00, tragitti stimati a ~${speed} km/h).`,
    de: (n: number, cost: number, speed: number) => `Entwurf aus deiner Sammlung „Meine Reise“ in deiner Reihenfolge: ${n} Stopp(s), geschätzt ${cost} € pro Person. Zeiten sind Vorschläge (Start 09:00, Fahrten geschätzt bei ~${speed} km/h).`,
    fr: (n: number, cost: number, speed: number) => `Brouillon construit depuis ta collection « Mon voyage » dans ton ordre : ${n} ${n === 1 ? "arrêt" : "arrêts"}, estimation ${cost} € par personne. Les horaires sont des propositions (départ 09:00, trajets estimés à ~${speed} km/h).`,
    es: (n: number, cost: number, speed: number) => `Borrador creado desde tu colección «Mi viaje» en tu orden: ${n} ${n === 1 ? "parada" : "paradas"}, estimación ${cost} € por persona. Los horarios son propuestas (inicio 09:00, trayectos estimados a ~${speed} km/h).`,
  },
  draftDayTitle: {
    sl: () => `Dan 1 · Moja pot (osnutek)`,
    en: () => `Day 1 · My trip (draft)`,
    it: () => `Giorno 1 · Il mio viaggio (bozza)`,
    de: () => `Tag 1 · Meine Reise (Entwurf)`,
    fr: () => `Jour 1 · Mon voyage (brouillon)`,
    es: () => `Día 1 · Mi viaje (borrador)`,
  },
  draftCoverage: {
    sl: () => `Osnutek iz lokalne zbirke — pred odhodom preveri izvedljivost.`,
    en: () => `Draft from your local collection — check feasibility before you go.`,
    it: () => `Bozza dalla collezione locale — verifica la fattibilità prima di partire.`,
    de: () => `Entwurf aus der lokalen Sammlung — prüfe vor der Abfahrt die Machbarkeit.`,
    fr: () => `Brouillon depuis la collection locale — vérifie la faisabilité avant de partir.`,
    es: () => `Borrador desde la colección local — comprueba la viabilidad antes de ir.`,
  },
} as const;

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
/**
 * Ali interesna beseda ujame destinacijo (sinonimi vključeni) — izvoženo
 * za P1-B recommendation-reasons (isti kanon ujemanja kot načrtovalnik).
 */
export function interestMatches(blobTokens: string[], blob: string, interestRaw: string): boolean {
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

/**
 * GEO KOHERENCA (2.24.0-geo prototip, QA U1 2026-10-11):
 * radij veriženja sidrov dni — naslednji dan se sidro izbere znotraj
 * ~120 km premočno od sidra prejšnjega dneva (~156 km cestne ocene).
 */
const GEO_CHAIN_KM = 120;
/**
 * Toleranca sidrne izbire: kandidat za sidro dneva N sme biti kvečjemu
 * ANCHOR_TIER_MARGIN točk pod najboljšim kandidatom (≈ utež enega redkega
 * interesa) — znotraj te tolerance zmaga bližina, nad njo zmaga kakovost.
 */
const ANCHOR_TIER_MARGIN = 2.0;

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
// GEO KOHERENCA — uteži interesov (IDF po korpusu) + tipska afiniteta
// (QA U1 2026-10-11: „vikend ob jezeru" je začel v Murski Soboti, ker je
// besedilno omenila vse tri želje; Bled JE jezero po tipu in izgubi)
// ---------------------------------------------------------------------------

/**
 * IDF utež interesa po korpusu 38 destinacij: REDI interes (»jezero« —
 * zadetkov malo) razločuje destinacije bolj kot VSEPOVEDEN (»kolo« —
 * zadetkov povsod). Deterministično: fiksni korpus → fiksne uteži.
 * Glajenje ln(1 + N/(df+1)) drži df=0 končno (tak interes ne zadene ničesar).
 */
export function interestIdfWeight(df: number, corpusN: number): number {
  return Math.log(1 + corpusN / (df + 1));
}

/**
 * TIPSKA AFINITETA: če TIP destinacije sam ujame interes (typeLabel sl/en,
 * ključ tipa ali sinonim — npr. »jezero« → lake), se utež interesa
 * PODVOJI. „Destinacija JE jezero" > „destinacija OMEMBJE jezero"
 * (Murska Sobota je mesto, ki omenja kolesarske poti ob jezeru; Bled je
 * jezero). Deterministično, brez ugibanj — čisti kanon podatkov.
 */
export function typeAffinityMatches(d: Destination, interestRaw: string): boolean {
  const interest = normText(interestRaw);
  if (!interest) return false;
  const names = new Set<string>([
    d.type,
    normText(typeLabel(d.type, "sl")),
    normText(typeLabel(d.type, "en")),
  ]);
  if (names.has(interest)) return true;
  for (const syn of SYNONYMS_N.get(interest) ?? []) {
    if (names.has(syn)) return true;
    const stem = stemWord(syn);
    if (stem.length >= 3) {
      for (const n of names) {
        if (n.startsWith(stem)) return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// JEDRO: deterministična sestava načrta
// ---------------------------------------------------------------------------

export function buildItinerary(query: PlannerQuery): ItineraryPlan {
  const lang: PlannerLang = asPickLocale(query.locale);
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
    // IDF uteženi zadetki + tipska afiniteta (×2) — redki interesi
    // razločujejo močneje; tip destinacije podvoji utež svojega interesa.
    let weighted = 0;
    for (const i of matched) {
      const w = interestIdfWeight(dfMap.get(i) ?? 0, DESTINATIONS.length);
      weighted += typeAffinityMatches(d, i) ? w * 2 : w;
    }
    return {
      dest: d,
      matched,
      seasonFit,
      score: weighted + (seasonFit ? 2 : 0) + d.rating / 10,
    };
  };

  const regionOk = (d: Destination) => !query.region || d.region === query.region;

  // IDF statistika po CELOTNEM korpusu (ne filtriranem naboru) — fiksna,
  // deterministična in stabilna ne glede na filtre poizvedbe. Izračunana
  // PRED ocenjevanjem (score jo uporablja).
  const dfMap = new Map<string, number>();
  for (const interest of interests) {
    if (dfMap.has(interest)) continue;
    let n = 0;
    for (const d of DESTINATIONS) {
      const { blob, tokens } = blobs.get(d.id) ?? { blob: "", tokens: [] };
      if (interestMatches(tokens, blob, interest)) n++;
    }
    dfMap.set(interest, n);
  }

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

  // 2) SESTAVA DNI: GEO VERIŽENJE SIDROV — dan 1 prevzame najboljšega
  //    kandidata; sidro dneva N se izbere med kandidati znotraj
  //    ANCHOR_TIER_MARGIN od vrha, ki so znotraj GEO_CHAIN_KM od sidra
  //    prejšnjega dne (koherentna pot); če takih ni, pošteno prevzamemo
  //    vrh lestvice (dolgo vožnjo razkrijemo v geoHop opombi).
  //    Sosedi dneva ostajajo po starem kanonu (≤ 100 km od sidra).
  const used = new Set<string>();
  const daysOut: Destination[][] = [];
  const geoHops: { day: number; km: number }[] = [];
  let prevAnchor: Candidate | undefined;

  for (let dayIdx = 0; dayIdx < query.days; dayIdx++) {
    const unusedSorted = sorted.filter((c) => !used.has(c.dest.id));
    if (unusedSorted.length === 0) break;

    let anchor: Candidate;
    if (dayIdx === 0 || !prevAnchor) {
      anchor = unusedSorted[0];
    } else {
      const topScore = unusedSorted[0].score;
      const tier = unusedSorted.filter(
        (c) => c.score >= topScore - ANCHOR_TIER_MARGIN
      );
      const near = tier.filter(
        (c) => haversineKm(prevAnchor!.dest.coords, c.dest.coords) <= GEO_CHAIN_KM
      );
      if (near.length > 0) {
        anchor = near[0]; // najvišje ocenjeni v radiju (tier je že urejen)
      } else {
        // Iskren fallback: želje so geografsko razpršene — zapiši preskok.
        anchor = unusedSorted[0];
        geoHops.push({
          day: dayIdx + 1,
          km: round5(roadKm(prevAnchor.dest.coords, anchor.dest.coords)),
        });
      }
    }
    prevAnchor = anchor;

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
    return PLANNER_MSG.dayTitle[lang](i + 1, head, stops[0]?.name ?? "");
  });

  const daysWord = PLANNER_MSG.daysWord[lang](days.length);

  const titleNames = names.slice(0, 2).join(" · ") + (names.length > 2 ? ` +${names.length - 2}` : "");
  const title = PLANNER_MSG.planTitle[lang](titleNames);

  const stopsWord = PLANNER_MSG.stopsWord[lang](allStops.length);

  const regionsWord = PLANNER_MSG.regionsWord[lang](regionsUsed.length);

  const summary = PLANNER_MSG.summary[lang](daysWord, stopsWord, regionsWord, totalCost, AVG_SPEED_KMH);

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
      geoHops,
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
  geoHops?: { day: number; km: number }[];
}): string {
  const { lang, interests, pool, selected, days, requestedDays } = args;
  const parts: string[] = [];

  const matchedInterests = interests.filter((i) =>
    pool.some((c) => c.matched.includes(i))
  );
  const unmatched = interests.filter((i) => !matchedInterests.includes(i));

  if (matchedInterests.length)
    parts.push(PLANNER_MSG.matchedInterests[lang](matchedInterests.join(", ")));
  if (unmatched.length)
    parts.push(PLANNER_MSG.noMatch[lang](unmatched.join(", ")));
  parts.push(PLANNER_MSG.selectedCount[lang](selected.length, DESTINATIONS.length));

  if (args.region) {
    parts.push(PLANNER_MSG.regionFilter[lang](regionLabel(args.region, lang)));
  }
  if (args.season) {
    const seasonName: Record<Season, { sl: string; en: string; it: string; de: string; fr: string; es: string }> = {
      spring: { sl: "pomlad", en: "spring", it: "primavera", de: "Frühling", fr: "printemps", es: "primavera" },
      summer: { sl: "poletje", en: "summer", it: "estate", de: "Sommer", fr: "été", es: "verano" },
      autumn: { sl: "jesen", en: "autumn", it: "autunno", de: "Herbst", fr: "automne", es: "otoño" },
      winter: { sl: "zima", en: "winter", it: "inverno", de: "Winter", fr: "hiver", es: "invierno" },
    };
    const destIds = new Set(selected.map((s) => s.id.split("--")[0]));
    const fitCount = pool.filter(
      (c) => destIds.has(c.dest.id) && c.dest.bestSeason.includes(args.season!)
    ).length;
    parts.push(
      PLANNER_MSG.seasonPref[lang](seasonName[args.season][lang], fitCount, selected.length)
    );
  }
  if (args.budget) {
    parts.push(PLANNER_MSG.budgetFilter[lang](args.budget));
    if (args.budgetRelaxed)
      parts.push(PLANNER_MSG.budgetRelaxed[lang]());
  }
  if (days.length < requestedDays) {
    parts.push(PLANNER_MSG.onlyDays[lang](days.length, requestedDays));
  }
  // GEO KOHERENCA (QA U1): povezanost dni razkrijemo iskreno — bodisi
  // potrdimo veriženje bodisi priznamo preskok med dnevoma z razdaljo.
  if (days.length > 1) {
    const hops = args.geoHops ?? [];
    if (hops.length === 0) {
      parts.push(PLANNER_MSG.geoChain[lang]());
    } else {
      for (const h of hops) {
        parts.push(PLANNER_MSG.geoHop[lang](h.day, h.km));
      }
    }
  }
  days.forEach((d, i) => {
    if (d.length === 1) {
      parts.push(PLANNER_MSG.singleStop[lang](i + 1));
    }
  });
  parts.push(
    lang === "en"
      ? PLANNER_MSG.datasetNote[lang](REGIONS ? Object.keys(REGIONS).length : 20)
      : PLANNER_MSG.datasetNote[lang](DESTINATIONS.length)
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
  const lang: PlannerLang = asPickLocale(locale);
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
  const title = PLANNER_MSG.draftTitle[lang]();
  const summary = PLANNER_MSG.draftSummary[lang](stops.length, totalCost, AVG_SPEED_KMH);

  return {
    plan: {
      days: stops.length > 0 ? [stops] : [],
      dayTitles:
        stops.length > 0 ? [PLANNER_MSG.draftDayTitle[lang]()] : [],
      title,
      summary,
      totalCost,
      coverageNote: PLANNER_MSG.draftCoverage[lang](),
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
  | "missing_time"
  | "day_hop";

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
  legWarn: { sl: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km v enem kosu (udobno je do 80 km).`, en: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km in one leg (comfortable limit is 80 km).`, it: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km in un'unica tappa (il limite comodo è 80 km).`, de: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km in einem Stück (komfortabel sind bis zu 80 km).`, fr: (a: string, b: string, km: number) => `${a} → ${b} : ~${km} km en une seule étape (la limite confortable est de 80 km).`, es: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km en un solo tramo (el límite cómodo son 80 km).` },
  legErr: { sl: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km v enem kosu — premik se splača razdeliti ali prenočiti na pol poti.`, en: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km in one leg — consider splitting the transfer or an overnight stop.`, it: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km in un'unica tappa — valuta di dividere il trasferimento o pernottare a metà strada.`, de: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km in einem Stück — ziehe in Betracht, den Transfer aufzuteilen oder auf halbem Weg zu übernachten.`, fr: (a: string, b: string, km: number) => `${a} → ${b} : ~${km} km en une seule étape — pense à scinder le transfert ou à faire une nuit à mi-chemin.`, es: (a: string, b: string, km: number) => `${a} → ${b}: ~${km} km en un solo tramo — plantea dividir el traslado o hacer noche a mitad de camino.` },
  dayKm: { sl: (n: number) => `~${n} km vožnje v enem dnevu (udoben okvir je okoli 150 km).`, en: (n: number) => `~${n} km of driving in one day (comfortable limit is around 150 km).`, it: (n: number) => `~${n} km di guida in un giorno (il limite comodo è circa 150 km).`, de: (n: number) => `~${n} km Fahrt an einem Tag (komfortabel sind etwa 150 km).`, fr: (n: number) => `~${n} km de route en une journée (la limite confortable est d'environ 150 km).`, es: (n: number) => `~${n} km de conducción en un día (el límite cómodo ronda los 150 km).` },
  dayStops: { sl: (n: number) => `${n} postankov v enem dnevu — zelo malo časa, da karkoli res doživiš.`, en: (n: number) => `${n} stops in one day — very little time to actually experience each place.`, it: (n: number) => `${n} tappe in un giorno — pochissimo tempo per vivere davvero ogni luogo.`, de: (n: number) => `${n} Stopps an einem Tag — sehr wenig Zeit, um jeden Ort wirklich zu erleben.`, fr: (n: number) => `${n} arrêts en une journée — très peu de temps pour vraiment profiter de chaque lieu.`, es: (n: number) => `${n} paradas en un día — muy poco tiempo para vivir de verdad cada lugar.` },
  overload: { sl: (h: string) => `Dan je preobremenjen: ~${h} h aktivnosti in vožnje skupaj.`, en: (h: string) => `Day is overloaded: ~${h} h of activities and driving together.`, it: (h: string) => `Giorno sovraccarico: ~${h} h di attività e guida insieme.`, de: (h: string) => `Der Tag ist überladen: ~${h} h Aktivität und Fahrt zusammen.`, fr: (h: string) => `Journée surchargée : ~${h} h d'activités et de route cumulées.`, es: (h: string) => `Día sobrecargado: ~${h} h de actividad y conducción sumadas.` },
  overlap: { sl: (a: string, b: string) => `Urnik se prekriva: ${a} se konča po začetku ${b}.`, en: (a: string, b: string) => `Schedule overlaps: ${a} ends after ${b} starts.`, it: (a: string, b: string) => `Orario sovrapposto: ${a} finisce dopo l'inizio di ${b}.`, de: (a: string, b: string) => `Zeitplan überschneidet sich: ${a} endet nach dem Beginn von ${b}.`, fr: (a: string, b: string) => `Horaire qui se chevauche : ${a} se termine après le début de ${b}.`, es: (a: string, b: string) => `Horario superpuesto: ${a} termina después de que empiece ${b}.` },
  gapErr: { sl: (a: string, b: string, gap: number, drive: number) => `Urnik ne gre skupaj: ${a} → ${b} ima ${gap} min razlike, sama vožnja pa vzame ~${drive} min.`, en: (a: string, b: string, gap: number, drive: number) => `Schedule doesn't work: ${a} → ${b} has ${gap} min between, but the drive alone takes ~${drive} min.`, it: (a: string, b: string, gap: number, drive: number) => `Orario impossibile: tra ${a} e ${b} ci sono ${gap} min di intervallo, ma la sola guida richiede ~${drive} min.`, de: (a: string, b: string, gap: number, drive: number) => `Zeitplan geht nicht auf: ${a} → ${b} hat ${gap} min Abstand, aber allein die Fahrt dauert ~${drive} min.`, fr: (a: string, b: string, gap: number, drive: number) => `Horaire incompatible : ${a} → ${b} a ${gap} min d'écart, mais le trajet seul prend ~${drive} min.`, es: (a: string, b: string, gap: number, drive: number) => `El horario no encaja: ${a} → ${b} tiene ${gap} min de hueco, pero el trayecto solo ya lleva ~${drive} min.` },
  gapWarn: { sl: (a: string, b: string, gap: number, drive: number) => `Urnik je tesen: ${a} → ${b} ima ${gap} min razlike, vožnja pa ~${drive} min — brez rezerve.`, en: (a: string, b: string, gap: number, drive: number) => `Schedule is tight: ${a} → ${b} has ${gap} min between, the drive ~${drive} min — no buffer.`, it: (a: string, b: string, gap: number, drive: number) => `Orario tirato: ${a} → ${b} ha ${gap} min di intervallo, la guida ~${drive} min — senza margine.`, de: (a: string, b: string, gap: number, drive: number) => `Zeitplan ist knapp: ${a} → ${b} hat ${gap} min Abstand, die Fahrt ~${drive} min — ohne Puffer.`, fr: (a: string, b: string, gap: number, drive: number) => `Horaire juste : ${a} → ${b} a ${gap} min d'écart, le trajet ~${drive} min — sans marge.`, es: (a: string, b: string, gap: number, drive: number) => `Horario apretado: ${a} → ${b} tiene ${gap} min de hueco, el trayecto ~${drive} min — sin margen.` },
  longGap: { sl: (a: string, b: string, idle: number) => `Dolg presledek: med ${a} in ${b} ostane ~${idle} min prostega časa po vožnji.`, en: (a: string, b: string, idle: number) => `Long gap: ~${idle} min of idle time remains between ${a} and ${b} after the drive.`, it: (a: string, b: string, idle: number) => `Lunga pausa: tra ${a} e ${b} restano ~${idle} min di tempo libero dopo la guida.`, de: (a: string, b: string, idle: number) => `Lange Pause: Zwischen ${a} und ${b} bleiben ~${idle} min Freizeit nach der Fahrt.`, fr: (a: string, b: string, idle: number) => `Longue pause : ~${idle} min de temps libre restent entre ${a} et ${b} après le trajet.`, es: (a: string, b: string, idle: number) => `Largo hueco: entre ${a} y ${b} quedan ~${idle} min de tiempo libre tras la conducción.` },
  duplicate: { sl: (n: string) => `${n} je v istem dnevu dvakrat.`, en: (n: string) => `${n} appears twice in the same day.`, it: (n: string) => `${n} compare due volte nello stesso giorno.`, de: (n: string) => `${n} kommt zweimal am selben Tag vor.`, fr: (n: string) => `${n} apparaît deux fois le même jour.`, es: (n: string) => `${n} aparece dos veces el mismo día.` },
  missingCoords: { sl: (n: string) => `${n}: koordinate niso znane — razdalje ni mogoče preveriti.`, en: (n: string) => `${n}: coordinates unknown — distances cannot be checked.`, it: (n: string) => `${n}: coordinate sconosciute — le distanze non si possono verificare.`, de: (n: string) => `${n}: Koordinaten unbekannt — Entfernungen können nicht geprüft werden.`, fr: (n: string) => `${n} : coordonnées inconnues — les distances ne peuvent pas être vérifiées.`, es: (n: string) => `${n}: coordenadas desconocidas — no se pueden comprobar las distancias.` },
  missingTime: { sl: (n: string) => `${n}: ura ni znana — urnika ni mogoče preveriti.`, en: (n: string) => `${n}: time unknown — the schedule cannot be checked.`, it: (n: string) => `${n}: ora sconosciuta — l'orario non si può verificare.`, de: (n: string) => `${n}: Zeit unbekannt — der Zeitplan kann nicht geprüft werden.`, fr: (n: string) => `${n} : heure inconnue — l'horaire ne peut pas être vérifié.`, es: (n: string) => `${n}: hora desconocida — no se puede comprobar el horario.` },
  dayHop: { sl: (a: string, b: string, km: number) => `Preskok med dnevi: ${a} → ${b} je ~${km} km (udobno je do 120 km cestne ocene) — razmislite o prenočišču bližje.`, en: (a: string, b: string, km: number) => `Hop between days: ${a} → ${b} is ~${km} km (comfortable is up to 120 km road estimate) — consider staying closer overnight.`, it: (a: string, b: string, km: number) => `Salto tra i giorni: ${a} → ${b} è ~${km} km (comodo fino a 120 km stimati su strada) — valuta un pernottamento più vicino.`, de: (a: string, b: string, km: number) => `Sprung zwischen Tagen: ${a} → ${b} sind ~${km} km (komfortabel sind bis zu 120 km Straßenschätzung) — erwäge eine nähere Übernachtung.`, fr: (a: string, b: string, km: number) => `Saut entre les jours : ${a} → ${b} fait ~${km} km (confortable jusqu'à 120 km d'estimation routière) — envisage un hébergement plus proche.`, es: (a: string, b: string, km: number) => `Salto entre días: ${a} → ${b} son ~${km} km (cómodo hasta 120 km de estimación por carretera) — considera alojarte más cerca.` },
} as const;

export function validatePlanGeo(plan: ItineraryPlan, locale?: PlannerLang): GeoValidation {
  const lang: PlannerLang = asPickLocale(locale);
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

    // GEO KOHERENCA (QA U1): preskok MED dnevi — zadnji postanek dneva N
    // → prvi postanek dneva N+1. Notranje noge pokriva zgornja zanka; ta
    // presledek je prej ostajal NEOPOZORAN (Rogaška Slatina → Bled ~200 km).
    const nextDay = plan.days[dayIdx + 1];
    const last = stops[stops.length - 1];
    const first = nextDay?.[0];
    if (nextDay && first && last?.coords && first.coords) {
      const hopKm = round5(roadKm(last.coords, first.coords));
      if (hopKm > 120) {
        issues.push({
          day,
          level: "warn",
          rule: "day_hop",
          message: GEO_MSG.dayHop[lang](last.name, first.name, hopKm),
        });
      }
    }
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
// Oblikovanje (6 jezikov — € pred številom samo v EN, ostali za njo)
// ---------------------------------------------------------------------------

export function formatMoney(amount: number, locale?: PlannerLang): string {
  const lang = asPickLocale(locale);
  return lang === "en" ? `€${amount}` : `${amount} €`;
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
