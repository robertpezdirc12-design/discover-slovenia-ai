/**
 * TRIP-DATES — DST-VARNO DATUMSKO JEDRO POTI (P0-E, issue #1 §10).
 * ============================================================================
 * Kanon (izvirnik „DST-safe dates"):
 *  - datumi poti so LOCALDATE nizi "YYYY-MM-DD" — NIKOLI UTC polnoč:
 *    Date.parse("2026-10-30") v JS pomeni UTC polnoč, kar v conah z DST
 *    (Evropa/Ljubljana) ob preklopu uro zdrsne v sosednji dan;
 *  - VSE datumsko računanje teče prek LOKALNIH komponent (leto/mesec/dan)
 *    z zasidranjem ob 12:00 lokalnega časa (poldne obstaja v vsaki coni
 *    tudi ob preklopu — polnoč v redkih conah ne);
 *  - enkraten vir resnice za UI (dnevi poti z realnimi datumi) in za
 *    vremenski sloj (horizont napovedi — iskrenost, nikoli izmišljeno).
 *
 * Ta modul je CLIENT-SAFE: čiste funkcije, brez Node API-jev.
 * ============================================================================
 */

import type { PickLocale } from "./i18n-pick";

/** Datumska množica poti — lokalna datuma "YYYY-MM-DD". */
export interface TripDates {
  start: string;
  end: string;
}

/** En dan poti: zaporedna številka (1-based, enaka dayIndex rezervacij) + lokalni datum. */
export interface TripDay {
  dayIndex: number;
  iso: string;
}

/** Zgornja meja dolžine poti (enaka zgornji meji dayIndex v S1 poti). */
export const MAX_TRIP_DAYS = 30;

/** Horizont Open-Meteo dnevne napovedi (iskrena meja vira — 16 dni). */
export const FORECAST_MAX_DAYS = 16;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Ali je niz stroga lokalna oblika "YYYY-MM-DD"? */
export function isIsoDate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const { y, m, d } = parseIsoDate(s)!;
  return isValidYmd(y, m, d);
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  if (y < 2000 || y > 2100) return false; // sanity okvir potovalnih datumov
  const dim = daysInMonth(y, m);
  return d <= dim;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate(); // dan 0 naslednjega meseca = zadnji dan tega
}

function parseIsoDate(s: string): { y: number; m: number; d: number } | null {
  const m = ISO_DATE_RE.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/**
 * Lokalni datum ob poldnevu (DST-varno sidro) — null za neveljavni niz.
 * Nikoli ne uporabljaj Date.parse na nizu brez časa (UTC polnoč!).
 */
export function toLocalNoon(iso: string): Date | null {
  const p = parseIsoDate(iso);
  if (!p || !isValidYmd(p.y, p.m, p.d)) return null;
  return new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
}

/** Inverz: lokalni datum → niz "YYYY-MM-DD" (formatiranje VEDRO prek lokalnih komponent). */
export function isoOfLocalDate(dt: Date): string {
  const y = String(dt.getFullYear()).padStart(4, "0");
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Danes (lokalno) kot "YYYY-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  return isoOfLocalDate(now);
}

/**
 * Prištevanje dni DST-VARNO: komponente + poldnevno sidro.
 * "2026-10-24" + 7 = "2026-10-31" tudi čez preklop ure (25. 10. 2026 CEST→CET).
 */
export function addDaysIso(iso: string, days: number): string | null {
  const noon = toLocalNoon(iso);
  if (!noon) return null;
  noon.setDate(noon.getDate() + days);
  return isoOfLocalDate(noon);
}

/** Število dni od a do b (b − a; pozitivno, če je b kasneje). Null ob napaki. */
export function daysBetweenIso(a: string, b: string): number | null {
  const x = toLocalNoon(a);
  const y = toLocalNoon(b);
  if (!x || !y) return null;
  const ms = y.getTime() - x.getTime();
  return Math.round(ms / 86_400_000); // zaokroženo — poldnevna sidra so na isti uri
}

/** Veljavnost množice: oba datuma veljavna, start ≤ end, razpon ≤ 30 dni. */
export function validateTripDates(
  dates: unknown
): { ok: true; dates: TripDates } | { ok: false; error: string } {
  if (dates === null || dates === undefined) {
    return { ok: false, error: "Datumi poti manjkajo." };
  }
  if (typeof dates !== "object") {
    return { ok: false, error: "Datumi poti morajo biti objekt { start, end }." };
  }
  const obj = dates as Record<string, unknown>;
  if (typeof obj.start !== "string" || typeof obj.end !== "string") {
    return { ok: false, error: "Datuma poti morata biti niza YYYY-MM-DD." };
  }
  if (!isIsoDate(obj.start) || !isIsoDate(obj.end)) {
    return {
      ok: false,
      error: "Datuma poti morata biti veljavna lokalna datuma YYYY-MM-DD.",
    };
  }
  const span = daysBetweenIso(obj.start, obj.end);
  if (span === null || span < 0) {
    return { ok: false, error: "Datum začetka mora biti pred datumom konca (ali enak)." };
  }
  if (span + 1 > MAX_TRIP_DAYS) {
    return {
      ok: false,
      error: `Pot je največ ${MAX_TRIP_DAYS} dni (dobljeno: ${span + 1}).`,
    };
  }
  return { ok: true, dates: { start: obj.start, end: obj.end } };
}

/** Vsi dnevi poti 1..N (dayIndex == zaporedna številka dneva). Null ob napaki. */
export function eachTripDay(dates: TripDates): TripDay[] | null {
  const span = daysBetweenIso(dates.start, dates.end);
  if (span === null || span < 0 || span + 1 > MAX_TRIP_DAYS) return null;
  const out: TripDay[] = [];
  for (let i = 0; i <= span; i++) {
    const iso = i === 0 ? dates.start : addDaysIso(dates.start, i);
    if (!iso) return null;
    out.push({ dayIndex: i + 1, iso });
  }
  return out;
}

// ── Oznake (SL/EN — enak kanon kot day-segments/statusne oznake) ────────────

const WEEKDAYS_SL = [
  "nedelja",
  "ponedeljek",
  "torek",
  "sreda",
  "četrtek",
  "petek",
  "sobota",
] as const;
const WEEKDAYS_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
const WEEKDAYS_SHORT_SL = ["ned", "pon", "tor", "sre", "čet", "pet", "sob"] as const;
const WEEKDAYS_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAYS_SHORT_IT = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"] as const;
const WEEKDAYS_SHORT_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAYS_SHORT_FR = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"] as const;
const WEEKDAYS_SHORT_ES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;

const WEEKDAYS_LONG: Record<PickLocale, readonly string[]> = {
  sl: WEEKDAYS_SL,
  en: WEEKDAYS_EN,
  it: ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"],
  de: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
  fr: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
  es: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
};

const WEEKDAYS_SHORT: Record<PickLocale, readonly string[]> = {
  sl: WEEKDAYS_SHORT_SL,
  en: WEEKDAYS_SHORT_EN,
  it: WEEKDAYS_SHORT_IT,
  de: WEEKDAYS_SHORT_DE,
  fr: WEEKDAYS_SHORT_FR,
  es: WEEKDAYS_SHORT_ES,
};

const MONTHS_SHORT_SL = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "avg",
  "sep",
  "okt",
  "nov",
  "dec",
] as const;
const MONTHS_SHORT_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const MONTHS_SHORT_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"] as const;
const MONTHS_SHORT_DE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"] as const;
const MONTHS_SHORT_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."] as const;
const MONTHS_SHORT_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

/** Dolgi meseci po jeziku (sl v rodilniku — "17. oktobra"; ostali nominativ). */
const MONTHS_LONG: Record<Exclude<PickLocale, "sl" | "en">, string[]> = {
  it: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
};

/** Kratek oznak dneva v tednu ("pet" / "Fri" / "ven"). Neznan datum → "". */
export function weekdayShort(iso: string, lang: PickLocale = "sl"): string {
  const noon = toLocalNoon(iso);
  if (!noon) return "";
  return (WEEKDAYS_SHORT[lang] ?? WEEKDAYS_SHORT_SL)[noon.getDay()] ?? "";
}

/** Polni oznak dneva v tednu ("petek" / "Friday" / "venerdì"). Neznan datum → "". */
export function weekdayLong(iso: string, lang: PickLocale = "sl"): string {
  const noon = toLocalNoon(iso);
  if (!noon) return "";
  return (WEEKDAYS_LONG[lang] ?? WEEKDAYS_SL)[noon.getDay()] ?? "";
}

/** "17. okt 2026" / "Oct 17, 2026" / "17 ott 2026" (krajša oblika za čipe). */
export function formatDateShort(iso: string, lang: PickLocale = "sl"): string {
  const p = parseIsoDate(iso);
  if (!p || !isValidYmd(p.y, p.m, p.d)) return iso;
  if (lang === "en") return `${MONTHS_SHORT_EN[p.m - 1]} ${p.d}, ${p.y}`;
  if (lang === "it") return `${p.d} ${MONTHS_SHORT_IT[p.m - 1]} ${p.y}`;
  if (lang === "de") return `${p.d}. ${MONTHS_SHORT_DE[p.m - 1]} ${p.y}`;
  if (lang === "fr") return `${p.d} ${MONTHS_SHORT_FR[p.m - 1]} ${p.y}`;
  if (lang === "es") return `${p.d} ${MONTHS_SHORT_ES[p.m - 1]} ${p.y}`;
  return `${p.d}. ${MONTHS_SHORT_SL[p.m - 1]} ${p.y}`;
}

/** "17. oktobra 2026" (sl) / "October 17, 2026" (en) / "17. Oktober 2026" (de). */
export function formatDateLong(iso: string, lang: PickLocale = "sl"): string {
  const p = parseIsoDate(iso);
  if (!p || !isValidYmd(p.y, p.m, p.d)) return iso;
  if (lang === "en") {
    const monthsLongEn = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${monthsLongEn[p.m - 1]} ${p.d}, ${p.y}`;
  }
  if (lang === "it") return `${p.d} ${MONTHS_LONG.it[p.m - 1]} ${p.y}`;
  if (lang === "de") return `${p.d}. ${MONTHS_LONG.de[p.m - 1]} ${p.y}`;
  if (lang === "fr") return `${p.d} ${MONTHS_LONG.fr[p.m - 1]} ${p.y}`;
  if (lang === "es") return `${p.d} de ${MONTHS_LONG.es[p.m - 1]} de ${p.y}`;
  const monthsSl = [
    "januarja",
    "februarja",
    "marca",
    "aprila",
    "maja",
    "junija",
    "julija",
    "avgusta",
    "septembra",
    "oktobra",
    "novembra",
    "decembra",
  ];
  return `${p.d}. ${monthsSl[p.m - 1]} ${p.y}`;
}

// ── Horizont napovedi (iskrenost vremenskega sloja) ─────────────────────────

/** Razpoložljivost dneva za dnevno napoved glede na danes. */
export type ForecastAvailability =
  | "available" // znotraj horizonta → napoved obstaja
  | "past" // za nazaj Open-Meteo dnevne napovedi ne izdaja
  | "too_far"; // presegli 16-dnevni horizont vira

/**
 * Ali dan pade v horizont DNEVNE napovedi (iskreno glede na vir):
 *  - pretekli dnevi → "past" (napoved za preteklost ne obstaja);
 *  - danes .. danes+15 → "available";
 *  - kasneje → "too_far" (16-dnevni horizont Open-Meteo).
 */
export function forecastAvailabilityFor(
  iso: string,
  today: string = todayIso()
): ForecastAvailability {
  const diff = daysBetweenIso(today, iso);
  if (diff === null) return "too_far";
  if (diff < 0) return "past";
  if (diff >= FORECAST_MAX_DAYS) return "too_far";
  return "available";
}
