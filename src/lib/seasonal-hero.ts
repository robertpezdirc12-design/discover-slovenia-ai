/**
 * SEASONAL-HERO (POLIR15-b, 2.42.0) — SEZONSKA AFINITETA HEROJA.
 *
 * Vrzel #3 iz raziskave POLIR15 (primerjava z najboljšimi platformami):
 * Švica (myswitzerland.com) vodijo z aktualno sezono (»Winter« časovnica),
 * Irska (ireland.com) z »Home of Halloween« v sezonskem oknu — heroj je
 * VEDNO vpenjan v trenutni koledar. Naši heroj je bil statičen (isti
 * vsebin: januar kot julij).
 *
 * Rešitev: determinističen SSR resolver (MMDD okna + izvorni SI
 * mikro- dogodki) — strežnik izračuna varianto ENKRAT in jo kot
 * serializiran prop poda HomeView (0 hidracijskih razlik, 0 CLS).
 * Sezonski namig je iskrena afiniteta (brez leto-datumov, ki jih
 * ne moremo potrditi — po Omejitvah issue #34 »nikoli ne ugibaj«),
 * vodi na /dogodki, kjer so aktualni dogodki.
 *
 * Okna (MMDD, vključno):
 *  - zima:        12.01 – 15.03
 *  - pomlad:      16.03 – 31.05
 *  - poletje:     06.01 – 14.09
 *  - jesen:       15.09 – 30.11
 * Mikro-dogodki (izvorni SI kanon, najožja okna zmagajo):
 *  - december v Ljubljani: 12.01 – 26.12 (zimska)
 *  - kurentovanje (Ptuj):  02.02 – 05.02 (zimska)
 *  - martinovanje:         11.08 – 11.14 (jesenska)
 * Demo/QA override: ?season=winter|spring|summer|autumn (prebere
 * page.tsx iz searchParams in poda kot seasonOverride).
 */

export type Season = "winter" | "spring" | "summer" | "autumn";

/** Varianti mikro-dogodkov so najožja sezonska okna SEZONA. */
export type SeasonVariant =
  | Season
  | "december"
  | "kurentovanje"
  | "martinovanje";

/** Objekt 6 jezikov (isti kanon kot polja L v komponentah). */
export type Localized6 = {
  sl: string;
  en: string;
  it: string;
  de: string;
  fr: string;
  es: string;
};

export interface SeasonalHeroInfo {
  /** Osnovna sezona (za ikono/analitiko). */
  season: Season;
  /** Najožja veljavna varianta (mikro-dogodki premagajo sezono). */
  variant: SeasonVariant;
  /** Enovrstični sezonski namig (6 jezikov). */
  hint: Localized6;
  /** Vedno /dogodki — aktualni dogodki so tam. */
  href: "/dogodki";
}

/** Sezonski namigi (iskreno, brez leto-datumov — glej glavo). */
export const SEASONAL_HERO: Record<SeasonVariant, Localized6> = {
  winter: {
    sl: "Zimska sezona: kurenti, smučarski poleti in snežene pravljice",
    en: "Winter season: kurents, ski jumps and snowy fairy tales",
    it: "Stagione invernale: kurents, salti sciistici e fiabe innevate",
    de: "Wintersaison: Kurents, Skispringen und Schneemärchen",
    fr: "Saison d'hiver : kurents, sauts à ski et contes enneigés",
    es: "Temporada de invierno: kurents, saltos de esquí y cuentos de nieve",
  },
  december: {
    sl: "Decembri: mesto v lučkah, ledene strasti in božični sejmi",
    en: "December: the city of lights, ice magic and Christmas markets",
    it: "Dicembre: la città di luci, magia del ghiaccio e mercatini natalizi",
    de: "Dezember: die Stadt im Lichterglanz, Eismagie und Weihnachtsmärkte",
    fr: "Décembre : la ville aux lumières, magie de la glace et marchés de Noël",
    es: "Diciembre: la ciudad de las luces, magia del hielo y mercados navideños",
  },
  kurentovanje: {
    sl: "Kurentovanje: čas kurentov, ptujska pustna domačija",
    en: "Kurentovanje: time of the kurents, the Ptuj carnival",
    it: "Kurentovanje: tempo dei kurents, il carnevale di Ptuj",
    de: "Kurentovanje: Zeit der Kurents, der Karneval von Ptuj",
    fr: "Kurentovanje : le temps des kurents, carnaval de Ptuj",
    es: "Kurentovanje: tiempo de los kurents, el carnaval de Ptuj",
  },
  spring: {
    sl: "Pomlad: cvetoče češnje, zeleni griči in prvi izleti na Sočo",
    en: "Spring: blossoming cherries, green hills and first Soča trips",
    it: "Primavera: ciliegi in fiore, colline verdi e prime gite sull'Isonzo",
    de: "Frühling: blühende Kirschbäume, grüne Hügel und erste Soča-Ausflüge",
    fr: "Printemps : cerisiers en fleurs, collines verdoyantes et premiers séjours sur la Soča",
    es: "Primavera: cerezos en flor, colinas verdes y primeros viajes al Soča",
  },
  summer: {
    sl: "Poletje: smaragdne reke, alpska jezera in večeri na obali",
    en: "Summer: emerald rivers, Alpine lakes and evenings by the coast",
    it: "Estate: fiumi smeraldo, laghi alpini e serate sulla costa",
    de: "Sommer: smaragdgrüne Flüsse, Alpenseen und Abende an der Küste",
    fr: "Été : rivières émeraude, lacs alpins et soirées sur la côte",
    es: "Verano: ríos esmeralda, lagos alpinos y noches en la costa",
  },
  martinovanje: {
    sl: "Martinovanje: mlado vino in pogostitve na slovenskih vinskih gričih",
    en: "St. Martin's Day: celebrating young wine on Slovenia's wine hills",
    it: "San Martino: si celebra il vino novello sulle colline viticole slovene",
    de: "Martinifest: junger Wein an Sloweniens Weinhügeln",
    fr: "Saint-Martin : le vin nouveau fêté sur les collines viticoles slovènes",
    es: "San Martín: celebración del vino nuevo en las colinas vinícolas eslovenas",
  },
  autumn: {
    sl: "Jeseni: martinovanje, barviti griči in kulinarični pohodi",
    en: "Autumn: St. Martin's festivities, colourful hills and food hikes",
    it: "Autunno: festività di San Martino, colline colorate ed escursioni",
    de: "Herbst: Martinifest, farbenprächtige Hügel und Kulinarik-Wanderungen",
    fr: "Automne : fête de la Saint-Martin, collines colorées et randonnées gourmandes",
    es: "Otoño: festividad de San Martín, colinas coloridas y rutas gastronómicas",
  },
};

/** MMDD pomočnik (npr. 1201 = 1. december). */
function mmdd(d: Date): number {
  return (d.getMonth() + 1) * 100 + d.getDate();
}

/** Osnovna sezona po MMDD oknih (glej glavo). */
export function resolveSeason(date: Date = new Date()): Season {
  const md = mmdd(date);
  if (md >= 1201 || md <= 315) return "winter";
  if (md <= 531) return "spring";
  if (md <= 914) return "summer";
  return "autumn";
}

const isSeason = (v: string): v is Season =>
  v === "winter" || v === "spring" || v === "summer" || v === "autumn";

/**
 * Razreši heroj varianto. Mikro-dogodki (december/kurentovanje/
 * martinovanje) premagajo osnovno sezono; `seasonOverride` (QA param
 * ?season=) premaguje vse — mikro-dogodki se pri overridu izpustijo
 * (overrida se SEZONA, ne koledar).
 */
export function getHeroVariant({
  seasonOverride,
  now = new Date(),
}: {
  seasonOverride?: string;
  now?: Date;
} = {}): SeasonalHeroInfo {
  if (seasonOverride && isSeason(seasonOverride)) {
    return {
      season: seasonOverride,
      variant: seasonOverride,
      hint: SEASONAL_HERO[seasonOverride],
      href: "/dogodki",
    };
  }
  const season = resolveSeason(now);
  const md = mmdd(now);
  let variant: SeasonVariant = season;
  if (md >= 1201 && md <= 1226) variant = "december";
  else if (md >= 202 && md <= 205) variant = "kurentovanje";
  else if (md >= 1108 && md <= 1114) variant = "martinovanje";
  return { season, variant, hint: SEASONAL_HERO[variant], href: "/dogodki" };
}
