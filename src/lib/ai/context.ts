import {
  DESTINATIONS,
  REGIONS,
  getDestination,
  type Destination,
} from "@/lib/slovenia-data";
import {
  loadStoContent,
  searchStoContent,
  type StoContentEntry,
} from "@/lib/supply/providers/sto/content";
import { weatherLabel } from "@/lib/weather";
import {
  sanitizeUntrustedText,
  detectPromptInjection,
} from "@/lib/system-data-guard";
import type { SharedPlan } from "@/lib/shared-plan";

/**
 * AI CONTEXT — graditelj KANONSKEGA konteksta za utemeljene LLM odgovore
 * (P1/AI, 2.24.0). Anti-halucinacijski kanon v praksi: model dobi SAMO
 * preverjene podatke (38 destinacij registra + STO slovenia.info + trenutno
 * vreme Open-Meteo + pot uporabnika) in pravilo, da odgovarja izključno iz
 * njih. Vsa NEZAUPANA vsebina (vprašanje, imena postankov, STO opisi,
 * rezervacije) gre prek SYSTEM_DATA_GUARD sanitizacije.
 *
 * Vse zunanje odvisnosti so injicirane (deps) → čisti deterministični testi
 * brez omrežja. Privzete implementacije so fail-quiet (napaka vir = blok
 * izpade, odgovor pade na preostale podatke).
 */

export interface ReservationRow {
  dayIndex: number;
  stopName: string;
  status: string;
  note?: string | null;
}

export interface CanonicalContext {
  /** Utemeljeni podatkovni bloki (slovensko, kompaktno). */
  blocks: string[];
  /** Imena virov za vrstico "Viri: …" (provenance v odgovoru). */
  sources: string[];
}

export interface AdvisorContextDeps {
  loadSto?: () => Promise<{
    status: "ok" | "missing" | "invalid";
    dataset?: { entries: StoContentEntry[] };
  }>;
  fetchCurrentWeather?: (
    lat: number,
    lng: number
  ) => Promise<{ temperatureC: number; weatherCode: number } | null>;
}

/** Default: STO vsebina iz data/sto-content.json (fail-quiet). */
async function defaultLoadSto(): Promise<
  Awaited<ReturnType<typeof loadStoContent>>
> {
  return loadStoContent();
}

/** Default: trenutno vreme z Open-Meteo (javni API, brez ključa, fail-quiet). */
async function defaultFetchCurrentWeather(
  lat: number,
  lng: number
): Promise<{ temperatureC: number; weatherCode: number } | null> {
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${lat}&longitude=${lng}` +
      "&current=temperature_2m,weather_code";
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    if (
      typeof data?.current?.temperature_2m !== "number" ||
      typeof data?.current?.weather_code !== "number"
    ) {
      return null;
    }
    return {
      temperatureC: data.current.temperature_2m,
      weatherCode: data.current.weather_code,
    };
  } catch {
    return null;
  }
}

// ── orodja ─────────────────────────────────────────────────────────────

function stripDiacritics(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/č|ć/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z");
}

const STOPWORDS = new Set([
  "in",
  "ali",
  "je",
  "so",
  "na",
  "v",
  "po",
  "za",
  "iz",
  "do",
  "kje",
  "kaj",
  "kako",
  "kdo",
  "koliko",
  "kdaj",
  "zakaj",
  "mi",
  "me",
  "jaz",
  "moja",
  "moje",
  "naša",
  "najin",
  "pri",
  "od",
  "k",
  "z",
  "s",
  "the",
  "and",
  "for",
  "with",
  "how",
  "what",
  "where",
  "when",
  "why",
  "a",
  "an",
  "of",
  "to",
  "is",
  "are",
  "can",
  "you",
  "me",
  "my",
  "our",
]);

function tokenize(question: string): string[] {
  return stripDiacritics(question)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Ujemanje žetona na besedilu PO BESEDAH — ista logika kot STO iskanje
 * (content.ts matchToken): natančna beseda > predponska beseda (krajša
 * stran ≥ 4 znaki — pokriva slovenske sklene: „bledu“ najde „Bled“) >
 * podniz. Vrača 0–3 (moč ujemanja).
 */
function matchKind(token: string, text: string): 0 | 1 | 2 | 3 {
  if (text.length === 0) return 0;
  if (text === token) return 3;
  const words = text.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.includes(token)) return 3;
  for (const w of words) {
    const shorter = Math.min(w.length, token.length);
    if (shorter >= 4 && (w.startsWith(token) || token.startsWith(w))) {
      return 2;
    }
  }
  if (text.includes(token)) return 1;
  return 0;
}

/** Kratek, sanity-varen prikaz destinacije za kontekst. */
function destinationLine(d: Destination): string {
  const regionLabel = REGIONS[d.region]?.sl ?? d.region;
  const desc = d.description.replace(/\s+/g, " ").trim().slice(0, 160);
  const seasons = d.bestSeason.join("/") || "vse leto";
  return `- ${d.name} (regija ${regionLabel}, vrsta ${d.type}): ${desc}… Primerne sezone: ${seasons}. ocena ${d.rating}/5.`;
}

/** Ocenjevanje relevantnosti destinacij za vprašanje (deterministično). */
function rankDestinations(
  question: string,
  planStopSlugs: Set<string>
): Destination[] {
  const tokens = tokenize(question);
  const scored = DESTINATIONS.map((d) => {
    const name = stripDiacritics(d.name);
    const region = stripDiacritics(REGIONS[d.region]?.sl ?? d.region);
    const regionEn = stripDiacritics(REGIONS[d.region]?.en ?? "");
    const bag = stripDiacritics(
      [d.tagline, ...d.highlights, ...d.activities, ...d.bestFor, d.type].join(
        " "
      )
    );
    let score = 0;
    for (const t of tokens) {
      const nm = matchKind(t, name);
      if (nm === 3) score += 6;
      else if (nm === 2) score += 5;
      else if (nm === 1) score += 3;

      const rg = Math.max(matchKind(t, region), matchKind(t, regionEn));
      if (rg === 3) score += 3;
      else if (rg === 2) score += 2;
      else if (rg === 1) score += 1;

      const bg = matchKind(t, bag);
      if (bg >= 2) score += 2;
      else if (bg === 1) score += 1;
    }
    if (planStopSlugs.has(d.slug)) score += 4; // postanek poti = relevantno
    return { d, score };
  });
  return scored
    .filter((s) => s.score > 0 || planStopSlugs.has(s.d.slug))
    .sort((a, b) => b.score - a.score || a.d.name.localeCompare(b.d.name))
    .slice(0, 6)
    .map((s) => s.d);
}

const WEATHER_KEYWORDS = [
  "vreme",
  "weather",
  "dez",
  "dosh",
  "sneg",
  "snow",
  "rain",
  "toplo",
  "hladno",
  "sonce",
  "temperature",
  "temperatura",
];

function wantsWeather(question: string): boolean {
  const q = stripDiacritics(question);
  return WEATHER_KEYWORDS.some((k) => q.includes(k));
}

/** Postanki poti, obogateni s kanonskimi destinacijami (koordinate). */
interface PlanStopInfo {
  day: number;
  name: string;
  slug?: string;
}

function planStops(plan: SharedPlan | null): PlanStopInfo[] {
  if (!plan) return [];
  const out: PlanStopInfo[] = [];
  for (const day of plan.days ?? []) {
    for (const loc of day.locations ?? []) {
      out.push({ day: day.day, name: loc.name, slug: loc.destSlug });
    }
  }
  return out;
}

/**
 * Zgradi kanonski kontekst za @AI svetovalca. Vrača bloke + vire — klicatelj
 * (advisor.ts) jih vstavi v sistemski poziv.
 */
export async function buildAdvisorContext(
  question: string,
  plan: SharedPlan | null,
  opts?: { reservations?: ReservationRow[]; deps?: AdvisorContextDeps }
): Promise<CanonicalContext> {
  const deps = opts?.deps ?? {};
  const loadSto = deps.loadSto ?? defaultLoadSto;
  const fetchCurrentWeather =
    deps.fetchCurrentWeather ?? defaultFetchCurrentWeather;

  const blocks: string[] = [];
  const sources: string[] = [];
  const stops = planStops(plan);
  const stopSlugs = new Set(
    stops.map((s) => s.slug).filter((s): s is string => typeof s === "string")
  );

  // 1) Pot uporabnika (imena postankov so nezaupana → sanitizirana).
  if (plan && stops.length > 0) {
    const lines = stops.map(
      (s) =>
        `  Dan ${s.day}: ${sanitizeUntrustedText(s.name, { maxLen: 80 })}`
    );
    blocks.push(`POT UPORABNIKA (skupinsko potovanje "${sanitizeUntrustedText(plan.name, { maxLen: 80 })}"):\n${lines.join("\n")}`);
  }

  // 2) Rezervacije (nezaupane opombe → sanitizirane, kompaktno).
  const reservations = opts?.reservations ?? [];
  if (reservations.length > 0) {
    const rlines = reservations.slice(0, 10).map((r) => {
      const note = r.note
        ? ` — ${sanitizeUntrustedText(String(r.note), { maxLen: 60 })}`
        : "";
      return `  Dan ${r.dayIndex + 1}: ${sanitizeUntrustedText(r.stopName, { maxLen: 60 })} [${r.status}]${note}`;
    });
    blocks.push(`REZERVACIJE TE POTE:\n${rlines.join("\n")}`);
  }

  // 3) Relevantne kanonske destinacije (register — zaupan vir).
  const ranked = rankDestinations(question, stopSlugs);
  if (ranked.length > 0) {
    blocks.push(
      `REGISTR DESTINACIJ (kanonski podatki Discover Slovenia AI):\n${ranked
        .map(destinationLine)
        .join("\n")}`
    );
    sources.push(`kanon destinacij (${ranked.map((d) => d.name).join(", ")})`);
  }

  // 4) STO vsebina (slovenia.info — uradni vir, opisi sanitizirani).
  //    Poizvedba je AND-po-besedah: če celoten niz ne zadane, poskusimo
  //    posamezne žetone (najdaljši prvi) — "zanimivo bledu" → "bledu".
  try {
    const loaded = await loadSto();
    if (loaded.status === "ok" && loaded.dataset) {
      const tokens = tokenize(question);
      const search = (q: string) =>
        q.length > 0
          ? searchStoContent(q, loaded.dataset!.entries, {
              language: "sl",
              limit: 3,
            })
          : [];
      const full = search(tokens.slice(0, 6).join(" "));
      let hits = full;
      if (hits.length === 0) {
        const byLen = [...tokens].sort((a, b) => b.length - a.length);
        for (const t of byLen) {
          hits = search(t);
          if (hits.length > 0) break;
        }
      }
      if (hits.length === 0 && tokens.length > 0) {
        hits = searchStoContent(tokens.slice(0, 6).join(" "), loaded.dataset.entries, {
          language: "en",
          limit: 3,
        });
      }
      if (hits.length > 0) {
        const slines = hits.map(
          (h) =>
            `- ${sanitizeUntrustedText(h.entry.title, { maxLen: 80 })} (${h.entry.url}): ${sanitizeUntrustedText(h.entry.description, { maxLen: 180 })}`
        );
        blocks.push(`URADNA VSEBINA STO (slovenia.info):\n${slines.join("\n")}`);
        sources.push("slovenia.info (STO)");
      }
    }
  } catch {
    // STO nedosegljiv → blok izpade (iskrenost: brez tega vira).
  }

  // 5) Trenutno vreme za postanke (samo če uporabnik vpraša — Open-Meteo).
  if (wantsWeather(question)) {
    const withCoords = stops
      .map((s) => (s.slug ? getDestination(s.slug) : null))
      .filter((d): d is Destination => d !== null)
      .slice(0, 2);
    const wlines: string[] = [];
    for (const d of withCoords) {
      const w = await fetchCurrentWeather(d.coords.lat, d.coords.lng);
      if (w) {
        wlines.push(
          `- ${d.name}: ${Math.round(w.temperatureC)} °C, ${weatherLabel(w.weatherCode, "sl")} (trenutno, vir Open-Meteo)`
        );
      }
    }
    if (wlines.length > 0) {
      blocks.push(`TRENUTNO VREME (Open-Meteo, ocena — ni zagotovilo):\n${wlines.join("\n")}`);
      sources.push("Open-Meteo");
    }
  }

  return { blocks, sources };
}

/** Ali vprašanje vsebuje poskus prompt injecije? (skrajšanje za advisor.) */
export function questionIsInjection(question: string): boolean {
  return detectPromptInjection(question).hit;
}
