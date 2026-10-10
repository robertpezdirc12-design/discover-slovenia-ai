/**
 * TRIP-PDF-DOC — kanonski vsebinski model PDF izvoza (P5).
 *
 * Kanoni (enaki kot ostalo jedro):
 *  - ČISTA FUNKCIJA: isti vhod → bitno isti izhod (0 odvisnosti od časa,
 *    brskalnika ali omrežja; datume formatira Intl z eksplicitnim locale);
 *  - ISKRENOST: ure, ki niso znane, se ne izmislé (lokacija brez časa =
 *    brez časa); stroški se označijo kot »ocena«; vir se vedno zapiše;
 *  - 0 AI: izvozi se iz kanonske strani resnice (načrt iz /nacrtuj ali
 *    deljena pote) — brez generiranja besedila.
 *
 * Adapterja: fromItineraryPlan (/potovanje — zadnji načrt) in
 * fromSharedPlan (/pot/[shareId] — pote v oblaku ali lokalna).
 */

import { asPickLocale, pick } from "@/lib/i18n-pick";
import {
  eachTripDay,
  formatDateLong,
  weekdayLong,
  type TripDates,
} from "@/lib/trip-dates";
import type { ItineraryPlan } from "@/lib/types";
import type { SharedPlan } from "@/lib/shared-plan";

export type PdfLang = "sl" | "en" | "it" | "de" | "fr" | "es";

/** Lokacija v PDF dnevu — ura je null, kadar ni znana (iskrenostni kanon). */
export interface PdfDayLocation {
  time: string | null;
  name: string;
}

/** En dan v PDF: zaporedna številka + datum (če so realni datumi določeni). */
export interface PdfDay {
  dayIndex: number;
  dateIso: string | null;
  weekday: string | null;
  title: string | null;
  locations: PdfDayLocation[];
}

/** Skupni vhod builderja — adapterja ga sestavita iz vrst resnice. */
export interface TripPdfInput {
  /** Ime pote (naslov dokumenta pod glavo). */
  name: string | null;
  /** Realni datumi (null, če niso določeni — iskrena odsotnost). */
  dates: TripDates | null;
  days: PdfDay[];
  /** Skupni stroški na osebo v EUR (null, če vir ne pozna stroke). */
  totalCost: number | null;
  /** Skupni proračun v EUR (null, če ni znan). */
  totalBudget: number | null;
  /** Iskrena opomba o pokritju želja (samo za načrte iz /nacrtuj). */
  coverageNote: string | null;
  /** Opomba vira — kaj je izvozil in iz kod. */
  sourceNote: string;
}

/** Zgrajen dokument — podatek, ki ga renderer pretvori v PDF. */
export interface TripPdfDoc {
  filename: string;
  heading: string;
  subtitle: string;
  metaLines: string[];
  daySections: {
    label: string;
    dateLine: string | null;
    locations: PdfDayLocation[];
  }[];
  coverageHeading: string | null;
  coverage: string | null;
  honesty: string;
  issuedLabel: string;
  pageOfLabel: (page: number, total: number) => string;
  sourceLine: string;
  lang: PdfLang;
}

const L = {
  heading: {
    sl: "Načrt potovanja po Sloveniji",
    en: "Slovenia travel plan",
    it: "Piano di viaggio in Slovenia",
    de: "Slovenien-Reiseplan",
    fr: "Plan de voyage en Slovénie",
    es: "Plan de viaje por Eslovenia",
  },
  datesLabel: { sl: "Datumi", en: "Dates", it: "Date", de: "Termine", fr: "Dates", es: "Fechas" },
  datesNotSet: {
    sl: "datumi niso določeni",
    en: "dates not set",
    it: "date non impostate",
    de: "Termine nicht festgelegt",
    fr: "dates non définies",
    es: "fechas sin definir",
  },
  daysLabel: { sl: "Dni", en: "Days", it: "Giorni", de: "Tage", fr: "Jours", es: "Días" },
  stopsLabel: { sl: "Postanki", en: "Stops", it: "Tappe", de: "Stopps", fr: "Étapes", es: "Paradas" },
  dayWord: { sl: "Dan", en: "Day", it: "Giorno", de: "Tag", fr: "Jour", es: "Día" },
  stopsOne: { sl: "postanek", en: "stop", it: "tappa", de: "Stopp", fr: "étape", es: "parada" },
  stopsFew: { sl: "postanka", en: "stops", it: "tappe", de: "Stopps", fr: "étapes", es: "paradas" },
  stopsMany: { sl: "postankov", en: "stops", it: "tappe", de: "Stopps", fr: "étapes", es: "paradas" },
  costLabel: {
    sl: "Skupni stroški (ocena, na osebo)",
    en: "Total cost (estimate, per person)",
    it: "Costo totale (stima, per persona)",
    de: "Gesamtkosten (Schätzung, pro Person)",
    fr: "Coût total (estimation, par personne)",
    es: "Coste total (estimación, por persona)",
  },
  budgetLabel: { sl: "Proračun", en: "Budget", it: "Budget", de: "Budget", fr: "Budget", es: "Presupuesto" },
  planWord: { sl: "načrt", en: "plan", it: "piano", de: "Plan", fr: "plan", es: "plan" },
  coverageHeading: { sl: "Opomba o pokritju", en: "Coverage note", it: "Nota di copertura", de: "Hinweis zur Abdeckung", fr: "Note de couverture", es: "Nota de cobertura" },
  honesty: {
    sl: "Iskrenost: tega dokumenta ni izdelal AI model — izvožen je iz determinističnega načrta. Ure, ki niso znane, niso zapisane; stroški so ocene iz kanonskega registra.",
    en: "Honesty: this document was not produced by an AI model — it is exported from a deterministic plan. Unknown times are not written down; costs are estimates from the canonical register.",
    it: "Onestà: questo documento non è stato prodotto da un modello AI — è esportato da un piano deterministico. Gli orari sconosciuti non vengono scritti; i costi sono stime dal registro canonico.",
    de: "Ehrlichkeit: Dieses Dokument wurde nicht von einem KI-Modell erstellt — es wird aus einem deterministischen Plan exportiert. Unbekannte Zeiten werden nicht aufgeschrieben; Kosten sind Schätzungen aus dem kanonischen Register.",
    fr: "Honnêteté : ce document n'a pas été produit par un modèle d'IA — il est exporté d'un plan déterministe. Les horaires inconnus ne sont pas écrits ; les coûts sont des estimations du registre canonique.",
    es: "Honestidad: este documento no fue producido por un modelo de IA — se exporta desde un plan determinista. Los horarios desconocidos no se escriben; los costes son estimaciones del registro canónico.",
  },
  issuedLabel: { sl: "Dokument izdan", en: "Document issued", it: "Documento emesso", de: "Dokument ausgestellt", fr: "Document émis", es: "Documento emitido" },
  pageOf: {
    sl: (p: number, t: number) => `Stran ${p} od ${t}`,
    en: (p: number, t: number) => `Page ${p} of ${t}`,
    it: (p: number, t: number) => `Pagina ${p} di ${t}`,
    de: (p: number, t: number) => `Seite ${p} von ${t}`,
    fr: (p: number, t: number) => `Page ${p} sur ${t}`,
    es: (p: number, t: number) => `Página ${p} de ${t}`,
  },
  source: { sl: "Vir: Discover Slovenia AI — deterministični načrtovalnik", en: "Source: Discover Slovenia AI — deterministic planner", it: "Fonte: Discover Slovenia AI — pianificatore deterministico", de: "Quelle: Discover Slovenia AI — deterministischer Planer", fr: "Source : Discover Slovenia AI — planificateur déterministe", es: "Fuente: Discover Slovenia AI — planificador determinista" },
  fallbackName: { sl: "potovanje", en: "trip", it: "viaggio", de: "reise", fr: "voyage", es: "viaje" },
} as const;

/** Slovenska dvojina/množina za postanke (1 postanek, 2 postanka, 3+ postankov). */
function stopsCount(n: number, lang: PdfLang): string {
  if (lang === "sl") {
    if (n === 1) return `${n} ${pick(lang, L.stopsOne)}`;
    if (n === 2) return `${n} ${pick(lang, L.stopsFew)}`;
    return `${n} ${pick(lang, L.stopsMany)}`;
  }
  const word = n === 1 ? L.stopsOne[lang] : L.stopsMany[lang];
  return `${n} ${word}`;
}

function eur(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

/** Veljavna ura HH:mm (00–23 : 00–59) — 25:99 in 9:5 se iskreno zavrneta. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------------------------------------------------------------------------
// Adapter 1: ItineraryPlan (zadnji načrt iz /nacrtuj — vir /potovanje)
// ---------------------------------------------------------------------------

export function fromItineraryPlan(plan: ItineraryPlan, dates: TripDates | null): TripPdfInput {
  return {
    name: plan.title || null,
    dates,
    days: plan.days.map((stops, i) => ({
      dayIndex: i + 1,
      dateIso: null,
      weekday: null,
      title: plan.dayTitles?.[i] ?? null,
      locations: stops.map((s) => ({
        // Iskrenost: time null → brez ure v PDF (nikoli izmišljene).
        time: s.time && TIME_RE.test(s.time) ? s.time : null,
        name: s.name,
      })),
    })),
    totalCost: typeof plan.totalCost === "number" ? plan.totalCost : null,
    totalBudget: null,
    coverageNote: plan.coverageNote || null,
    sourceNote: "plan",
  };
}

// ---------------------------------------------------------------------------
// Adapter 2: SharedPlan (/pot/[shareId] — baza ali lokalna kopija)
// ---------------------------------------------------------------------------

export function fromSharedPlan(
  plan: SharedPlan,
  dates: TripDates | null,
  source: "cloud" | "local"
): TripPdfInput {
  return {
    name: plan.name || null,
    dates,
    days: plan.days.map((d) => ({
      dayIndex: d.day,
      dateIso: null,
      weekday: null,
      title: d.title ?? null,
      locations: d.locations.map((loc) => ({
        time: loc.time && TIME_RE.test(loc.time) ? loc.time : null,
        name: loc.name,
      })),
    })),
    totalCost: null,
    totalBudget: typeof plan.totalBudget === "number" ? plan.totalBudget : null,
    coverageNote: null,
    sourceNote: source,
  };
}

// ---------------------------------------------------------------------------
// Builder: TripPdfInput → TripPdfDoc (čist, determinističen)
// ---------------------------------------------------------------------------

export function buildTripPdf(input: TripPdfInput, locale: string): TripPdfDoc {
  const lang = asPickLocale(locale) as PdfLang;

  // Dnevi s realnimi datumi (če so) — enaka logika kot izris strani.
  const calendar = input.dates ? eachTripDay(input.dates) : null;
  const byIndex = new Map<number, { iso: string; weekday: string }>();
  if (calendar) {
    for (const d of calendar) byIndex.set(d.dayIndex, { iso: d.iso, weekday: weekdayLong(d.iso, lang) });
  }

  const totalStops = input.days.reduce((n, d) => n + d.locations.length, 0);
  const metaLines: string[] = [];

  const dateRange = input.dates
    ? `${formatDateLong(input.dates.start, lang)} — ${formatDateLong(input.dates.end, lang)}`
    : pick(lang, L.datesNotSet);
  metaLines.push(`${pick(lang, L.datesLabel)}: ${dateRange}`);
  metaLines.push(`${pick(lang, L.daysLabel)}: ${input.days.length}`);
  metaLines.push(`${pick(lang, L.stopsLabel)}: ${stopsCount(totalStops, lang)}`);
  if (input.totalCost !== null) metaLines.push(`${pick(lang, L.costLabel)}: ${eur(input.totalCost)}`);
  if (input.totalBudget !== null) metaLines.push(`${pick(lang, L.budgetLabel)}: ${eur(input.totalBudget)}`);

  const daySections = input.days.map((d) => {
    const cal = byIndex.get(d.dayIndex);
    const dateLine = cal
      ? `${cal.weekday}, ${formatDateLong(cal.iso, lang)}`
      : null;
    return {
      label: `${pick(lang, L.dayWord)} ${d.dayIndex}`,
      dateLine,
      locations: d.locations,
    };
  });

  const filenameBase =
    pdfFilenameSlug(input.name) ?? pdfFilenameSlug(pick(lang, L.fallbackName))
    ?? pick(lang, L.fallbackName);

  return {
    filename: `${filenameBase}.pdf`,
    heading: pick(lang, L.heading),
    subtitle: input.name ?? pick(lang, L.planWord),
    metaLines,
    daySections,
    coverageHeading: input.coverageNote ? pick(lang, L.coverageHeading) : null,
    coverage: input.coverageNote,
    honesty: pick(lang, L.honesty),
    issuedLabel: pick(lang, L.issuedLabel),
    pageOfLabel: pick(lang, L.pageOf),
    sourceLine: pick(lang, L.source),
    lang,
  };
}

// ---------------------------------------------------------------------------
// Ime datoteke — determinističen slug iz imena pote (ASCII, brez diakritikov)
// ---------------------------------------------------------------------------

/** Unicode → ASCII slug ("Zimska Gorenjska čez Bohinj" → "zimska-gorenjska-cez-bohinj"). */
export function pdfFilenameSlug(name: string | null): string | null {
  if (!name) return null;
  const ascii = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60)
    .replace(/-+$/g, "");
  return ascii || null;
}
