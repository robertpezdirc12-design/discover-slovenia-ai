import { REGIONS, type Budget, type Season } from "@/lib/slovenia-data";
import {
  detectPromptInjection,
  sanitizeUntrustedText,
} from "@/lib/system-data-guard";
import { stripDiacritics } from "@/lib/advisor/context";

/**
 * PLAN NLU — SKRIPTA (2.24.0): prosti opis potovanja → parametri
 * DETERMINISTIČNEGA načrtovalnika (/api/itinerary).
 *
 * Kje bi bil AI model, tu je SKRIPTA: namen razpoznava POZNAVANJE BESED
 * (predponsko ujemanje po besedah — pokriva slovenske sklone: „gorah“
 * najde „gora“; „jezeru“ najde „jezero“), ne statistični model. Kanon:
 *  - 0 AI žetonov, 0 AI modelov, 0 omrežja — čista funkcija;
 *  - NIKOLI ne ugibamo: nerazumljen opis → null (UI pade na čipe);
 *  - odpuščujoča polja: neveljavna regija/sezona/budget se IZPUSTIJO,
 *    prepoznan del pa ostane („3 dni v gorah, regija Širedol“ → dnevi 3,
 *    interesi [gora], brez regije);
 *  - izhodni žetoni interesov so BAZNE OBLIKE iz besednjaka načrtovalnika
 *    (SYNONYMS v itinerary-engine.ts razširi sklone in EN besede);
 *  - isti vhod → isti izhod (determinizem).
 */

// ── izhod ───────────────────────────────────────────────────────────────

export interface PlannerIntent {
  /** Bazni žetoni interesov (družina, gora, jezero, morje, mesto, …). */
  interests: string[];
  /** 1–5 (meja motorja); undefined, če opis ne pove. */
  days?: number;
  /** Ključ regije iz REGIONS (npr. "gorenjska"); undefined, če ni jasno. */
  region?: string;
  season?: Season;
  budget?: Budget;
}

// ── normalizacija ───────────────────────────────────────────────────────

function wordsOf(normalized: string): string[] {
  return normalized.split(/[^a-z0-9]+/).filter(Boolean);
}

// ── interesi (predponsko ujemanje po besedah) ───────────────────────────

/**
 * Pravila interesov: interest = bazni žeton besednjaka načrtovalnika;
 * prefixes = koreni besed (≥ 3–4 znake), ki se pojavijo kot ZAČETEK besede
 * v opisu. Vrstni red pravil = prioriteta (prvo pravilo, ki se besedi
 * pripiše, zmaga — ena beseda ne more sprožiti dveh interesov).
 */
const INTEREST_RULES: ReadonlyArray<{
  interest: string;
  prefixes: readonly string[];
}> = [
  {
    interest: "druzina",
    prefixes: ["druzin", "otrok", "otroc", "famil", "kids", "kinder"],
  },
  {
    interest: "gora",
    prefixes: [
      "gora", "gore", "gori", "goro", "hrib", "planin", "triglav",
      "alpa", "alpe", "alps", "mountain", "montagn", "berg",
    ],
  },
  {
    interest: "pohodnistvo",
    prefixes: ["pohod", "sprehod", "hik", "trek", "wandern", "walking"],
  },
  {
    interest: "jezero",
    prefixes: ["jezer", "lake", "lago"],
  },
  {
    interest: "morje",
    prefixes: [
      "morj", "mors", "obal", "jadran", "adriat", "beach", "coast",
      "strand", "spiagg", "playa",
    ],
  },
  {
    interest: "mesto",
    prefixes: ["mest", "city", "stadt", "citta", "ciudad", "ville"],
  },
  {
    interest: "kulinarika",
    prefixes: [
      "kulinar", "gastro", "hran", "jesti", "food", "essen", "cucin",
      "comid", "restavrac", "vecerj", "kosil",
    ],
  },
  {
    interest: "vino",
    prefixes: ["vina", "vino", "vini", "vinc", "viney", "vinsk", "vinograd", "degustac", "wine", "wein"],
  },
  {
    interest: "kultura",
    prefixes: [
      "kultur", "zgodovin", "muzej", "cerkv", "samostan", "grad",
      "culture", "histor", "museum", "castle",
    ],
  },
  {
    interest: "zdravje",
    prefixes: ["term", "toplic", "zdrav", "sprostit", "wellness", "spa"],
  },
  {
    interest: "smucanje",
    prefixes: ["smuc", "skiin", "skifahr", "schnee"],
  },
  {
    interest: "kolo",
    prefixes: ["koles", "bicikl", "cycl", "fahrrad", "bici"],
  },
  {
    interest: "narava",
    prefixes: ["narav", "nature", "natur", "natura"],
  },
  {
    interest: "avantura",
    prefixes: [
      "avantur", "adrenalin", "kajak", "raft", "canyon", "zip", "plezan",
      "paraglid", "adventur",
    ],
  },
  {
    interest: "jame",
    prefixes: ["jama", "jame", "cave", "hohl"],
  },
  {
    interest: "soteska",
    prefixes: ["sotesk", "gorge"],
  },
  {
    interest: "plavanje",
    prefixes: ["plav", "kopan", "swim", "baden"],
  },
];

/** Sama beseda (ne predpona) — varno za kratke dvoumne korene. */
const INTEREST_EXACT_WORDS = new Set(["ski", "skis", "sea", "bike", "hike"]);

/**
 * Namigi destinacij: pogosta imenovana kraja → regija + tematski interesi
 * (iskreno: samo usklajeni s filtrom REGIONS/načrtovalnika; če ime ni v
 * registru, hint ne obstaja — nikoli ne ugibamo). matches so podnizi
 * normaliziranega besedila po OBKAH BESED (koreni, ki pokrijejo slovenske
 * sklone: „mursk“ pokrije Mursko/Murski/Murskih …).
 */
const DEST_HINTS: ReadonlyArray<{
  matches: readonly string[];
  region: keyof typeof REGIONS;
  interests: readonly string[];
}> = [
  { matches: ["bled"], region: "gorenjska", interests: ["jezero"] },
  { matches: ["bohinj"], region: "gorenjska", interests: ["jezero", "gora"] },
  { matches: ["vintgar"], region: "gorenjska", interests: ["soteska"] },
  { matches: ["triglav"], region: "gorenjska", interests: ["gora"] },
  { matches: ["ljubljan"], region: "osrednja", interests: ["mesto"] },
  { matches: ["piran"], region: "primorska", interests: ["morje"] },
  { matches: ["portoro"], region: "primorska", interests: ["morje"] },
  { matches: ["koper"], region: "primorska", interests: ["mesto", "morje"] },
  { matches: ["izola"], region: "primorska", interests: ["morje"] },
  { matches: ["postojn"], region: "kras", interests: ["jame"] },
  { matches: ["lipic"], region: "kras", interests: ["kultura"] },
  { matches: ["soca", "soci"], region: "posocje", interests: ["avantura"] },
  { matches: ["bovec"], region: "posocje", interests: ["avantura"] },
  { matches: ["kobarid"], region: "posocje", interests: ["kultura"] },
  { matches: ["nova goric", "novi goric"], region: "posocje", interests: [] },
  { matches: ["maribor"], region: "stajerska", interests: ["mesto"] },
  { matches: ["ptuj"], region: "stajerska", interests: ["mesto", "kultura"] },
  { matches: ["celje"], region: "stajerska", interests: ["kultura"] },
  { matches: ["rogasc"], region: "stajerska", interests: ["zdravje"] },
  { matches: ["slovenj"], region: "koroska", interests: ["gora"] },
  { matches: ["dravograd"], region: "koroska", interests: [] },
  { matches: ["mursk"], region: "prekmurje", interests: [] },
  { matches: ["lendav"], region: "prekmurje", interests: [] },
  { matches: ["novo mest"], region: "dolenjska", interests: [] },
  { matches: ["otoc"], region: "dolenjska", interests: [] },
  { matches: ["crnomelj"], region: "bela-krajina", interests: [] },
  { matches: ["plitvic", "plitvis"], region: "lika", interests: ["jezero"] },
  { matches: ["zagreb"], region: "kontinentalna-hrvaska", interests: ["mesto"] },
  { matches: ["rijek"], region: "kvartner", interests: ["mesto", "morje"] },
  { matches: ["pula"], region: "istra", interests: ["morje"] },
  { matches: ["zadar"], region: "dalmacija", interests: ["morje"] },
  { matches: ["split"], region: "dalmacija", interests: ["mesto", "morje"] },
  { matches: ["hvar"], region: "dalmacija", interests: ["morje"] },
  { matches: ["dubrovn"], region: "dalmacija", interests: ["mesto", "morje"] },
  { matches: ["kotor"], region: "boka-kotorska", interests: [] },
  { matches: ["budv"], region: "crnogorsko-primorje", interests: ["morje"] },
  { matches: ["durmitor"], region: "severna-crna-gora", interests: ["gora"] },
];

/** Regije: predpone besed, ki EKSPRESNO poimenujejo regijo. */
const REGION_PREFIXES: ReadonlyArray<{
  region: keyof typeof REGIONS;
  prefixes: readonly string[];
}> = [
  { region: "gorenjska", prefixes: ["gorenjsk"] },
  { region: "osrednja", prefixes: ["osrednj"] },
  { region: "kras", prefixes: ["kras", "karst"] },
  { region: "primorska", prefixes: ["primorsk", "littoral", "litoral"] },
  { region: "posocje", prefixes: ["posocj", "sosk", "soci"] },
  { region: "stajerska", prefixes: ["stajersk", "styria", "steiermark"] },
  { region: "koroska", prefixes: ["korosk", "carinthia", "karn"] },
  { region: "prekmurje", prefixes: ["prekmurj"] },
  { region: "dolenjska", prefixes: ["dolenjsk"] },
  { region: "bela-krajina", prefixes: [] }, // dve besedi — spodaj po nizu
  { region: "kontinentalna-hrvaska", prefixes: [] }, // spodaj po nizu
  { region: "lika", prefixes: ["lika"] },
  { region: "kvartner", prefixes: ["kvarner", "kvarn", "quarnar"] },
  { region: "istra", prefixes: ["istr", "istria", "istrie"] },
  { region: "dalmacija", prefixes: ["dalmac"] },
  { region: "boka-kotorska", prefixes: ["boka"] },
  { region: "crnogorsko-primorje", prefixes: ["crnogorsk", "montenegr"] },
  { region: "severna-crna-gora", prefixes: ["severna crna"] },
];

/** Večbesedne regije (ujemajo se kot podniz normaliziranega opisa, z
 * oblikami za slovenske sklone: „Bela krajina“ / „Beli krajini“ …). */
const REGION_SUBSTRINGS: ReadonlyArray<{ needle: string; region: string }> = [
  { needle: "bela krajin", region: "bela-krajina" },
  { needle: "beli krajin", region: "bela-krajina" },
  { needle: "belo krajin", region: "bela-krajina" },
  { needle: "celinsko hrva", region: "kontinentalna-hrvaska" },
  { needle: "celinski hrva", region: "kontinentalna-hrvaska" },
  { needle: "celinska hrva", region: "kontinentalna-hrvaska" },
  { needle: "continental croatia", region: "kontinentalna-hrvaska" },
  { needle: "severna crna gor", region: "severna-crna-gora" },
  { needle: "severni crni gor", region: "severna-crna-gora" },
];

// ── dnevi ───────────────────────────────────────────────────────────────

const DAY_UNITS =
  "dni|dnevi|dnevih|dan|days?|tage?|tag|giorni|dias?|jours?";
const WORD_NUMBERS: Readonly<Record<string, number>> = {
  ena: 1, one: 1, "eine": 1, einem: 1,
  dva: 2, dve: 2, two: 2, zwei: 2, due: 2, dos: 2,
  tri: 3, three: 3, drei: 3, tre: 3, tres: 3,
  stiri: 4, four: 4, vier: 4, quattro: 4, cuatro: 4,
  pet: 5, five: 5, funf: 5, cinque: 5, cinco: 5,
};

/** Dnevi iz opisa: „3 dni“, „tridnevno“, „5 days“, „vikend“, „teden“. */
function detectDays(nb: string): number | undefined {
  // številka + enota dneva: „3 dni“, „2 dni“, „5 days“
  const digit = new RegExp(`\\b(\\d{1,2})\\s*(?:${DAY_UNITS})\\b`).exec(nb);
  if (digit) return clampDays(Number.parseInt(digit[1], 10));
  // števnik z besedo + enota: „tri dni“, „five days“
  for (const [w, n] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${w}\\s*(?:${DAY_UNITS})\\b`).test(nb)) return n;
  }
  // pridevniška oblika: „tridnevno potovanje“, „3-dnevni izlet“
  for (const [w, n] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${w}dnev`).test(nb)) return n;
  }
  if (/\b\d ?dnev/.test(nb)) {
    const d = /(\d)\s?dnev/.exec(nb);
    if (d) return clampDays(Number.parseInt(d[1], 10));
  }
  if (/\bvikend|weekend\b/.test(nb)) return 2;
  if (/\bteden|week|woche|settiman\b/.test(nb)) return 5;
  return undefined;
}

function clampDays(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(5, Math.max(1, Math.round(n))); // meja motorja: 1–5
}

// ── sezona ──────────────────────────────────────────────────────────────

const SEASON_RULES: ReadonlyArray<{ season: Season; needles: readonly string[] }> = [
  { season: "spring", needles: ["pomlad", "spring", "primaver"] },
  { season: "summer", needles: ["polet", "summer", "estate ", "sommer", "ete "] },
  { season: "autumn", needles: ["jesen", "autumn", "autunno", "herbst"] },
  { season: "winter", needles: ["zim", "winter", "inverno", "hiver"] },
];

function detectSeason(nb: string): Season | undefined {
  for (const rule of SEASON_RULES) {
    if (rule.needles.some((n) => nb.includes(n))) return rule.season;
  }
  return undefined;
}

// ── proračun ────────────────────────────────────────────────────────────

function detectBudget(nb: string, raw: string): Budget | undefined {
  // Zapis z €: „€“ = varčno, „€€“ = srednje, „€€€“ = visoko.
  const euros = (raw.match(/€/g) ?? []).length;
  if (euros === 1) return "€";
  if (euros === 2) return "€€";
  if (euros >= 3) return "€€€";
  if (/varc|poceni|cheap|low.?cost|nizk/.test(nb)) return "€";
  if (/srednj|moderat|medium|mittel|medio|\bmid\b/.test(nb)) return "€€";
  if (/luksuz|luxur|premium|drag|expensive|gehoben|high.?end/.test(nb)) return "€€€";
  return undefined;
}

// ── regija ──────────────────────────────────────────────────────────────

/**
 * Regija: eksplicitna poimenovanja > namigi imen krajev. Vrača tudi
 * besede, ki so bile porabljene za razpoznavo (izključijo se iz
 * ujemanja interesov — „gorenjskem“ NE sme sprožiti „gora“).
 */
function detectRegion(
  nb: string,
  words: string[]
): { region: string | undefined; consumed: Set<string> } {
  const consumed = new Set<string>();
  for (const rule of REGION_PREFIXES) {
    for (const p of rule.prefixes) {
      if (p.includes(" ")) continue; // večbesedne spodaj
      const w = words.find((x) => x.startsWith(p));
      if (w) {
        consumed.add(w);
        return { region: rule.region as string, consumed };
      }
    }
  }
  for (const rule of REGION_SUBSTRINGS) {
    if (nb.includes(rule.needle)) {
      return { region: rule.region, consumed };
    }
  }
  // Namigi imen krajev (izključno usklajeni s REGIONS; več oblik za sklone).
  for (const hint of DEST_HINTS) {
    if (hint.matches.some((m) => nb.includes(m))) {
      return { region: hint.region as string, consumed };
    }
  }
  return { region: undefined, consumed };
}

// ── interesi ────────────────────────────────────────────────────────────

/**
 * Interesi iz besed opisa (predponsko ujemanje po besedah, prioriteta po
 * vrstnem redu pravil). Besede, porabljene za regijo, se izpustijo.
 */
function detectInterests(words: string[], consumed: Set<string>): string[] {
  const out: string[] = [];
  for (const w of words) {
    if (consumed.has(w)) continue;
    let matched: string | null = null;
    if (INTEREST_EXACT_WORDS.has(w)) {
      // Kratek dvoumen koren: preslikava točno-določenih besed.
      matched = exactWordInterest(w);
    } else {
      for (const rule of INTEREST_RULES) {
        if (rule.prefixes.some((p) => w.startsWith(p))) {
          matched = rule.interest;
          break;
        }
      }
    }
    if (matched && !out.includes(matched)) out.push(matched);
  }
  return out;
}

/** Točno-določene kratke besede (nedvoumne oblike). */
function exactWordInterest(w: string): string | null {
  switch (w) {
    case "ski":
    case "skis":
      return "smucanje";
    case "sea":
      return "morje";
    case "bike":
      return "kolo";
    case "hike":
      return "pohodnistvo";
    default:
      return null;
  }
}

// ── glavni vstop ────────────────────────────────────────────────────────

/**
 * Razume prosti opis potovanja → PlannerIntent | null.
 * NULL pomeni „nisem razumel dovolj“ (brez interesov oz. poskus injekcije)
 * — klicatelj (API pot) odgovori 422 in NIKOLI ne ugiba.
 * Čista sinhrona funkcija: 0 omrežja, 0 stanja, 0 AI.
 */
export function parsePlannerIntent(text: string): PlannerIntent | null {
  // Prompt injekcija → NE razčlenjujemo (iskrenost + varnost).
  if (detectPromptInjection(text).hit) return null;

  const clean = sanitizeUntrustedText(text, { maxLen: 400 });
  if (clean.length < 4) return null;

  const nb = stripDiacritics(clean);
  const words = wordsOf(nb);

  const { region, consumed } = detectRegion(nb, words);
  const interests = detectInterests(words, consumed);

  // Namigi krajev lahko dodajo tematske interese (iskreno: usklajeno z
  // registrom — „na Bledu“ pomeni jezersko temo Bleda).
  if (region !== undefined) {
    for (const hint of DEST_HINTS) {
      if (hint.region === region && hint.matches.some((m) => nb.includes(m))) {
        for (const i of hint.interests) {
          if (!interests.includes(i)) interests.push(i);
        }
      }
    }
  }

  // Brez interesov nismo razumeli namena — raje iskreno null kot ugibanje.
  if (interests.length === 0) return null;

  const out: PlannerIntent = { interests: interests.slice(0, 8) };

  const days = detectDays(nb);
  if (days !== undefined) out.days = days;

  if (region !== undefined && region in REGIONS) out.region = region;

  const season = detectSeason(nb);
  if (season !== undefined) out.season = season;

  const budget = detectBudget(nb, clean);
  if (budget !== undefined) out.budget = budget;

  return out;
}
