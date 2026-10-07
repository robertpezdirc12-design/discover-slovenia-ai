/**
 * NEXT-STEP — DETERMINISTIČNI stanjski stroj proaktivnega pomočnika (issue #1/3).
 *
 * Glede na čisto stanje uporabnika (NextStepContext — zbrano IZKLJUČNO iz
 * obstoječih lokalnih shramb: dai:my-trip, dai:last-plan, dai:go-trip,
 * prijava + dai:shared-plans) predlaga en glavni + po možnosti en
 * sekundarni naslednji smiseln korak — pred potjo, pri načrtovanju,
 * pred/po rezervaciji in med potovanjem.
 *
 * Kanoni:
 * - 0 AI žetonov, 0 omrežja — SAMO pravila (isti vhod → isti izhod);
 * - ISKRENOST: `reason` se vedno navezuje na dejanski kontekst
 *   (nikoli izmišljenih stanj); pokvarjen/neznan vnos → null/0;
 * - SL/EN prek L vzorca ({ sl, en } + pick — fallback sl).
 */

import { pick, type PickDict } from "./i18n-pick";
import { slUnit } from "./sl-utils";

// ---------------------------------------------------------------------------
// Vhod / izhod (čisto stanje — testabilno)
// ---------------------------------------------------------------------------

/**
 * Čisto stanje uporabnika. Vsi vnosi so DEJANJA stanja lokalnih shramb:
 * - myTripCount: število zapisov v dai:my-trip (useMyTripList),
 * - hasCloudTrip: prijavljen IN z znamenjem shranjenih potovanj,
 * - hasPlan/planDays: dai:last-plan (uporabni načrt = ≥ 1 dan),
 * - reservationCount/confirmedCount: na trenutni poti (0, če neznano —
 *   rezervacije živijo strežniško; brez znanega shareId jih NE izmišljujemo),
 * - goModeActive: dai:go-trip obstaja in ni zaključen.
 */
export interface NextStepContext {
  myTripCount: number;
  hasCloudTrip: boolean;
  hasPlan: boolean;
  planDays: number;
  reservationCount: number;
  confirmedCount: number;
  goModeActive: boolean;
}

/** Ikona predloga — komponenta jo preslika v lucide-react ikono. */
export type NextStepIcon =
  | "compass"
  | "map"
  | "ticket"
  | "sun"
  | "route"
  | "party"
  | "share";

/** En predlog naslednjega koraka (lokaliziran ob klicu). */
export interface NextStepSuggestion {
  /** Stabilen identifikator stanja (npr. "go-resume", "build-plan"). */
  id: string;
  icon: NextStepIcon;
  title: string;
  body: string;
  ctaLabel: string;
  /** Notranja povezava (/destinacije, /nacrtuj, /trznica, /na-poti, /moja-potovanja). */
  ctaHref: string;
  /** ZAKAJ predlagam — prozoren razlog, navezan na dejanski kontekst. */
  reason: string;
  /** Višja = pomembnejša (7 = Go Mode aktiven … 1 = odpri potovanja). */
  priority: number;
}

/** Glavni predlog + po možnosti en sekundarni (nižja prioriteta). */
export interface NextStepOutcome {
  primary: NextStepSuggestion;
  secondary: NextStepSuggestion | null;
}

// ---------------------------------------------------------------------------
// Pravila (po prioriteti — prva številka specifikacije = višja prioriteta)
// ---------------------------------------------------------------------------

/** Razlog je lahko odvisen od konteksta (npr. število dni/destinacij). */
type ReasonFn = (ctx: NextStepContext) => string;

interface RuleDef {
  id: string;
  priority: number;
  icon: NextStepIcon;
  href: string;
  matches(ctx: NextStepContext): boolean;
  title: PickDict<string>;
  body: PickDict<string>;
  ctaLabel: PickDict<string>;
  reason: PickDict<ReasonFn>;
}

const RULES: readonly RuleDef[] = [
  // 1) goModeActive → nadaljuj pot (najpomembnejše — potovanje je živo)
  {
    id: "go-resume",
    priority: 7,
    icon: "route",
    href: "/na-poti",
    matches: (c) => c.goModeActive,
    title: { sl: "Nadaljuj svojo pot", en: "Continue your trip" },
    body: {
      sl: "Tvoje potovanje je v teku — odpri Go Mode in nadaljuj pri naslednjem postanku.",
      en: "Your trip is underway — open Go Mode and continue at your next stop.",
    },
    ctaLabel: { sl: "Odpri Na poti", en: "Open On the road" },
    reason: {
      sl: () =>
        "Go Mode je aktiven (potovanje ni zaključeno) — nadaljevanje poti je zdaj najpomembnejši korak.",
      en: () =>
        "Go Mode is active (the trip is not finished) — continuing your trip is the most important step right now.",
    },
  },
  // 2) načrt obstaja, nič rezervacij → rezerviraj vnaprej
  {
    id: "book-ahead",
    priority: 6,
    icon: "ticket",
    href: "/trznica",
    matches: (c) => c.hasPlan && c.planDays > 0 && c.reservationCount === 0,
    title: { sl: "Rezerviraj vnaprej", en: "Book ahead" },
    body: {
      sl: "Načrt imaš, rezervacij pa še ni — poglej izdelke in doživetja za svoje postanke.",
      en: "You have a plan but no reservations yet — browse products and experiences for your stops.",
    },
    ctaLabel: { sl: "Odpri tržnico", en: "Open the marketplace" },
    reason: {
      sl: (c) =>
        `Imaš shranjen ${c.planDays}-dnevni načrt, a še nič rezervacij — rezervacija vnaprej ti prihrani skrbi v zadnjem trenutku.`,
      en: (c) =>
        `You have a ${c.planDays}-day plan and no reservations yet — booking ahead spares you the last-minute scramble.`,
    },
  },
  // 3) potrjene rezervacije → pripravi se na pot
  {
    id: "prepare-go",
    priority: 5,
    icon: "sun",
    href: "/na-poti",
    matches: (c) => c.hasPlan && c.confirmedCount > 0,
    title: { sl: "Pripravi se na pot", en: "Get ready to go" },
    body: {
      sl: "Imaš že potrjene rezervacije — odpri Go Mode za dnevni potek in vreme na naslednjem postanku.",
      en: "You already have confirmed reservations — open Go Mode for the day flow and the weather at your next stop.",
    },
    ctaLabel: { sl: "Pojdi na pot", en: "Head out" },
    reason: {
      sl: (c) =>
        `Ker imaš ${c.confirmedCount} ${slUnit(
          c.confirmedCount,
          "potrjeno rezervacijo",
          "potrjeni rezervaciji",
          "potrjene rezervacije",
          "potrjenih rezervacij"
        )}, je čas za pripravo na odhod.`,
      en: (c) =>
        `You have ${c.confirmedCount} confirmed ${
          c.confirmedCount === 1 ? "reservation" : "reservations"
        } — time to get ready to go.`,
    },
  },
  // 4) ≥ 2 destinaciji v zbirki, brez načrta → zgradi načrt
  {
    id: "build-plan",
    priority: 4,
    icon: "map",
    href: "/nacrtuj",
    matches: (c) => c.myTripCount >= 2 && !c.hasPlan,
    title: { sl: "Zgradi načrt iz zbirke", en: "Build a plan from your collection" },
    body: {
      sl: "Iz dodanih destinacij sestavi dnevni načrt — deterministično, brez ugibanj.",
      en: "Turn your saved destinations into a day-by-day plan — deterministic, no guesswork.",
    },
    ctaLabel: { sl: "Odpri načrtovalnik", en: "Open the planner" },
    reason: {
      sl: (c) =>
        `Ker imaš ${c.myTripCount} ${slUnit(
          c.myTripCount,
          "dodano destinacijo",
          "dodani destinaciji",
          "dodane destinacije",
          "dodanih destinacij"
        )}, a še brez načrta — načrtovalnik jih sešteje v dneve.`,
      en: (c) =>
        `You have ${c.myTripCount} saved ${
          c.myTripCount === 1 ? "destination" : "destinations"
        } but no plan yet — the planner turns the collection into days.`,
    },
  },
  // 5) točno ena destinacija → dodaj še eno
  {
    id: "add-another",
    priority: 3,
    icon: "compass",
    href: "/destinacije",
    matches: (c) => c.myTripCount === 1,
    title: { sl: "Dodaj še eno", en: "Add one more" },
    body: {
      sl: "V Moji poti imaš eno destinacijo — z vsaj še eno se odpre pravi dnevni načrt.",
      en: "You have one destination in My trip — with at least one more, a real day plan opens up.",
    },
    ctaLabel: { sl: "Razišči destinacije", en: "Explore destinations" },
    reason: {
      sl: () =>
        "V Moji poti imaš točno en postanek — z dvema ali več destinacijami načrtovalnik sestavi dnevni red.",
      en: () =>
        "You have exactly one stop in My trip — with two or more destinations the planner can build a day schedule.",
    },
  },
  // 6) prazna zbirka, brez oblaka → razišči Slovenijo (prvi korak)
  {
    id: "explore-first",
    priority: 2,
    icon: "compass",
    href: "/destinacije",
    matches: (c) => c.myTripCount === 0 && !c.hasCloudTrip,
    title: { sl: "Razišči Slovenijo", en: "Explore Slovenia" },
    body: {
      sl: "Prvi korak: prebrskaj kanonske destinacije in dodaj prvo v Mojo pot.",
      en: "First step: browse the canonical destinations and add your first to My trip.",
    },
    ctaLabel: { sl: "Odpri destinacije", en: "Browse destinations" },
    reason: {
      sl: () =>
        "Zbirka je prazna in znanih shranjenih potovanj ni — raziskovanje je najbolj smiseln prvi korak.",
      en: () =>
        "Your collection is empty and there are no known saved trips — exploring is the most sensible first step.",
    },
  },
  // 7) prijavljen s potovanji, brez načrta → odpri svoje potovanje
  {
    id: "open-trips",
    priority: 1,
    icon: "share",
    href: "/moja-potovanja",
    matches: (c) => c.hasCloudTrip && !c.hasPlan,
    title: { sl: "Odpri svoje potovanje", en: "Open your trips" },
    body: {
      sl: "Prijavljen si in imaš shranjena potovanja — nadaljuj v vozlišču Moja potovanja.",
      en: "You are signed in with saved trips — continue in the My travels hub.",
    },
    ctaLabel: { sl: "Odpri Moja potovanja", en: "Open My travels" },
    reason: {
      sl: () =>
        "Ker imaš shranjena potovanja, lokalna zbirka pa je še brez načrta — tvoje potovanje čaka v vozlišču.",
      en: () =>
        "You have saved trips while the local collection has no plan yet — your journey awaits in the hub.",
    },
  },
] as const;

/**
 * Izhodilni predlog (prioriteta 0): nobeno pravilo ne ustreza (redko —
 * npr. oblak + načrt + samo nepotrjene rezervacije). Iskrena
 * prozornost: pomočnik pove, da stanje ne kaže enoličnega koraka,
 * in ponudi vedno smiselno raziskovanje.
 */
const FALLBACK_RULE: RuleDef = {
  id: "explore-any",
  priority: 0,
  icon: "compass",
  href: "/destinacije",
  matches: () => true,
  title: { sl: "Razišči Slovenijo", en: "Explore Slovenia" },
  body: {
    sl: "Prebrskaj kanonske destinacije in dodaj prvo v Mojo pot.",
    en: "Browse the canonical destinations and add your first to My trip.",
  },
  ctaLabel: { sl: "Odpri destinacije", en: "Browse destinations" },
  reason: {
    sl: () =>
      "Iz trenutnega stanja ne morem enolično izpeljati naslednjega koraka — raziskovanje destinacij je vedno smiselno.",
    en: () =>
      "Your current state doesn't point to a single clear next step — exploring destinations is always worthwhile.",
  },
};

// ---------------------------------------------------------------------------
// Validacija konteksta (iskrenost: pokvarjeno stanje → null, ne izmišljeno)
// ---------------------------------------------------------------------------

/** Ali je vnos veljaven NextStepContext (vsa polja pravih tipov, ≥ 0)? */
export function isNextStepContext(value: unknown): value is NextStepContext {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  const count = (v: unknown): boolean =>
    typeof v === "number" && Number.isFinite(v) && (v as number) >= 0;
  return (
    count(c.myTripCount) &&
    count(c.planDays) &&
    count(c.reservationCount) &&
    count(c.confirmedCount) &&
    typeof c.hasCloudTrip === "boolean" &&
    typeof c.hasPlan === "boolean" &&
    typeof c.goModeActive === "boolean"
  );
}

// ---------------------------------------------------------------------------
// Jedro: pravila → predlogi
// ---------------------------------------------------------------------------

function suggestionFor(
  rule: RuleDef,
  ctx: NextStepContext,
  locale: string
): NextStepSuggestion {
  return {
    id: rule.id,
    icon: rule.icon,
    title: pick(locale, rule.title),
    body: pick(locale, rule.body),
    ctaLabel: pick(locale, rule.ctaLabel),
    ctaHref: rule.href,
    reason: pick(locale, rule.reason)(ctx),
    priority: rule.priority,
  };
}

/**
 * Glavni + sekundarni predlog za dano stanje.
 * VEDNO najvišja prioriteta ki ustreza; sekundarni = naslednja ujemajoča
 * (nižja prioriteta), če obstaja. Null SAMO ob manjkajočem/pokvarjenem
 * kontekstu (redko) — za vsak veljaven kontekst vedno najde izhod.
 */
export function nextStepsFor(
  ctx: NextStepContext | null | undefined,
  locale: string = "sl"
): NextStepOutcome | null {
  if (!isNextStepContext(ctx)) return null;

  const matched = RULES.filter((r) => r.matches(ctx));
  if (matched.length === 0) {
    return { primary: suggestionFor(FALLBACK_RULE, ctx, locale), secondary: null };
  }

  const [first, second] = matched;
  return {
    primary: suggestionFor(first, ctx, locale),
    secondary: second ? suggestionFor(second, ctx, locale) : null,
  };
}

/**
 * Samo glavni predlog (priročno za enostavne prikaze).
 * Locales: "en" → angleški vnosi, vsi ostali (sl/it/de/fr/es …) → slovenski
 * (pick fallback kanon — slovenščina je vedno resnica).
 */
export function nextStepFor(
  ctx: NextStepContext | null | undefined,
  locale: string = "sl"
): NextStepSuggestion | null {
  return nextStepsFor(ctx, locale)?.primary ?? null;
}
