/**
 * SEZONSKI HERO — POLIR15-b (issue #34): sezonska afiniteta heroja.
 * ============================================================================
 * Vrzel #3 iz raziskave POLIR15 (zgled: Švica myswitzerland.com sezonski
 * koledar kampanj — zima/pomlad/poletje/jesen; Tourism Ireland »Home of
 * Halloween« — dogodek kot sezonski pripovedovalec): domači hero je bil
 * STATIČEN skozi vse leto, čeprav turistična ponudba Slovenije močno
 * variira po sezonah (zima: smučanje/termalni; pomlad: sapi in hribi;
 * poletje: Soča/obala; jesen: martinovanje in vinske gorice).
 *
 * ČIST modul (0 uvozov, 0 okolja, 0 AI): determinističen MMDD resolver z
 * OVITKOM čez leto (zima 1.12.–15.3.) + IZVORNI SI mikro-dogodki, ki v svojem
 * oknu NADOMESTIJO sezonski čip (martinovanje 8.–14.11., kurentovanje 2.–5.2.,
 * december 1.–26.12. — božični sejmi). Strežnik (page.tsx) razreši varianto
 * ENKRAT na zahtevo in jo posreduje kot prop — 0 hidracijskega tveganja
 * (klient nikoli ne računa datuma sam).
 *
 * QA kavelj: `?sezona=winter|spring|summer|autumn` override za E2E preverbo
 * vseh štirih variant brez čakanja na koledar (iskreno: samo testna pot,
 * produkcija vedno uporabi now).
 */

/** Sezona heroja (MMDD okna, ovitek čez leto za zimo). */
export type HeroSeason = "winter" | "spring" | "summer" | "autumn";

/** Izvorni SI mikro-dogodki (nadomestijo sezonski čip v svojem oknu). */
export type HeroMicroEvent = "martinovanje" | "kurentovanje" | "december";

/** 6-jezični niz (isti vzorec kot komponentni L slovarji — sl je kanon). */
export type HeroL6 = Record<
  "sl" | "en" | "it" | "de" | "fr" | "es",
  string
>;

/** Razreši sezono iz datuma (MMDD okna; zima se ovije čez leto). */
export function resolveHeroSeason(date = new Date()): HeroSeason {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  if (md >= 1201 || md <= 315) return "winter";
  if (md <= 531) return "spring";
  if (md <= 914) return "summer";
  return "autumn";
}

/**
 * Mikro-dogodki: MMDD okna (vključni robovi) + sezona, v kateri nastopajo.
 * Izvorni SI koledar (raziskava §b): martinovanje (8.–14.11. — ST sezonski
 * koledar »Martinovanje«), kurentovanje (2.–5.2. — Ptuj, UNESCO pustni značaj),
 * december (1.–26.12. — božični sejmi po mestih).
 */
export const HERO_MICRO_WINDOWS: Record<
  HeroMicroEvent,
  { from: number; to: number; season: HeroSeason }
> = {
  kurentovanje: { from: 202, to: 205, season: "winter" },
  december: { from: 1201, to: 1226, season: "winter" },
  martinovanje: { from: 1108, to: 1114, season: "autumn" },
};

/** Razreši mikro-dogodek (ali null izven vseh oken). */
export function resolveHeroMicroEvent(
  date = new Date()
): HeroMicroEvent | null {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  for (const ev of Object.keys(HERO_MICRO_WINDOWS) as HeroMicroEvent[]) {
    const w = HERO_MICRO_WINDOWS[ev];
    if (md >= w.from && md <= w.to) return ev;
  }
  return null;
}

/** Sezonski čipi (nad kickerjem) — ST kanon: sezona kot pripoved. */
const SEASON_BADGE: Record<HeroSeason, HeroL6> = {
  winter: {
    sl: "Zima v Sloveniji",
    en: "Winter in Slovenia",
    it: "Inverno in Slovenia",
    de: "Winter in Slowenien",
    fr: "Hiver en Slovénie",
    es: "Invierno en Eslovenia",
  },
  spring: {
    sl: "Pomlad v Sloveniji",
    en: "Spring in Slovenia",
    it: "Primavera in Slovenia",
    de: "Frühling in Slowenien",
    fr: "Printemps en Slovénie",
    es: "Primavera en Eslovenia",
  },
  summer: {
    sl: "Poletje v Sloveniji",
    en: "Summer in Slovenia",
    it: "Estate in Slovenia",
    de: "Sommer in Slowenien",
    fr: "Été en Slovénie",
    es: "Verano en Eslovenia",
  },
  autumn: {
    sl: "Jeseni v Sloveniji",
    en: "Autumn in Slovenia",
    it: "Autunno in Slovenia",
    de: "Herbst in Slowenien",
    fr: "Automne en Slovénie",
    es: "Otoño en Eslovenia",
  },
};

/** Mikro-dogodki z datumom v nizu (iskreno: koledarsko okno je vidno). */
const MICRO_BADGE: Record<HeroMicroEvent, HeroL6> = {
  martinovanje: {
    sl: "Martinovanje — 8.–14. november",
    en: "St. Martin's Day — Nov 8–14",
    it: "San Martino — 8–14 novembre",
    de: "Martinifest — 8.–14. November",
    fr: "Saint-Martin — 8–14 novembre",
    es: "San Martín — 8–14 de noviembre",
  },
  kurentovanje: {
    sl: "Kurentovanje — 2.–5. februar",
    en: "Kurentovanje — Feb 2–5",
    it: "Kurentovanje — 2–5 febbraio",
    de: "Kurentovanje — 2.–5. Februar",
    fr: "Kurentovanje — 2–5 février",
    es: "Kurentovanje — 2–5 de febrero",
  },
  december: {
    sl: "December — božični sejmi",
    en: "December — Christmas markets",
    it: "Dicembre — mercatini di Natale",
    de: "Dezember — Weihnachtsmärkte",
    fr: "Décembre — marchés de Noël",
    es: "Diciembre — mercados navideños",
  },
};

/** Razrešena sezonska varianta heroja (strežnik → prop → 0 hidracijske razlike). */
export interface HeroSeasonalVariant {
  season: HeroSeason;
  microEvent: HeroMicroEvent | null;
  badge: HeroL6;
}

const SEASONS: HeroSeason[] = ["winter", "spring", "summer", "autumn"];

/**
 * Razreši sezonsko varianto heroja.
 * @param override QA kavelj (`?sezona=`) — prisili sezono in UTIŠA mikro-dogodek
 *        (čist sezonski pogled; produkcija vedno resolve po now).
 */
export function getHeroSeasonal({
  now = new Date(),
  override,
}: {
  now?: Date;
  override?: string | null;
} = {}): HeroSeasonalVariant {
  const forced = SEASONS.find((s) => s === override);
  if (forced) {
    return { season: forced, microEvent: null, badge: SEASON_BADGE[forced] };
  }
  const season = resolveHeroSeason(now);
  const microEvent = resolveHeroMicroEvent(now);
  return {
    season,
    microEvent,
    badge: microEvent ? MICRO_BADGE[microEvent] : SEASON_BADGE[season],
  };
}
