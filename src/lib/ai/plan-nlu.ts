import { llmChat, type LlmCompletionResult } from "@/lib/ai/client";
import { buildPlanNluSystemPrompt } from "@/lib/ai/prompts";
import { REGIONS, type Budget, type Season } from "@/lib/slovenia-data";
import {
  sanitizeUntrustedText,
  detectPromptInjection,
} from "@/lib/system-data-guard";

/**
 * PLAN NLU — prosti opis potovanja → parametri DETERMINISTIČNEGA
 * načrtovalnika (P1/AI, 2.24.0).
 *
 * Ključna arhitekturna odločitev (anti-halucinacijski kanon): LLM NE
 * načrtuje poti — samo RAZUME namen (interesi/dnevi/regija/sezona/budget)
 * in ga preslika v strogi JSON. Načrt še vedno gradi deterministični
 * engine (/api/itinerary): isti vhod → isti načrt, cene SAMO iz registra.
 *
 * Fail-closed: injekcija, izklopljen LLM, timeout, ne-JSON → null (UI pade
 * na ročne čipe — iskreno sporočilo, nikoli ugibanje). Posamezno
 * neveljavno polje se IZPUSTI (odpuščujoče brez ugibanja): npr. napačna
 * regija odpade, interesi ostanejo.
 */

const SEASONS: readonly string[] = ["spring", "summer", "autumn", "winter"];
const BUDGETS: readonly string[] = ["€", "€€", "€€€"];

export interface PlannerIntent {
  interests: string[];
  days?: number;
  /** Ključ regije iz REGIONS (npr. "gorenjska") ali undefined. */
  region?: string;
  season?: Season;
  budget?: Budget;
}

export interface PlanNluDeps {
  complete?: (messages: Parameters<typeof llmChat>[0]) => Promise<LlmCompletionResult>;
}

/** Izlušči prvi JSON objekt iz odgovora (model včasih doda besedilo). */
function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Surovi JSON → PlannerIntent. ODPUŠČUJOČA validacija polj po polj:
 * neveljavno neobvezno polje se izpusti, interesi so obvezni (brez njih
 * nismo razumeli namena → null).
 */
function coerceIntent(raw: unknown): PlannerIntent | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const r = raw as Record<string, unknown>;

  let interests: string[] = [];
  if (Array.isArray(r.interests)) {
    interests = Array.from(
      new Set(
        r.interests
          .filter((i): i is string => typeof i === "string")
          .map((i) => i.trim().toLowerCase().replace(/\s+/g, " "))
          .filter((i) => i.length >= 1 && i.length <= 40)
      )
    ).slice(0, 8);
  }
  if (interests.length === 0) return null;

  const out: PlannerIntent = { interests };

  const days =
    typeof r.days === "number"
      ? r.days
      : typeof r.days === "string"
        ? Number.parseInt(r.days, 10)
        : NaN;
  if (Number.isInteger(days)) {
    out.days = Math.min(5, Math.max(1, days));
  }

  if (typeof r.region === "string") {
    const key = r.region.trim().toLowerCase();
    if (key in REGIONS) out.region = key;
  }

  if (typeof r.season === "string" && SEASONS.includes(r.season)) {
    out.season = r.season as Season;
  }
  if (typeof r.budget === "string" && BUDGETS.includes(r.budget)) {
    out.budget = r.budget as Budget;
  }

  return out;
}

/**
 * Razume prosti opis → PlannerIntent | null (fail-closed, nikoli izjeme).
 */
export async function parsePlannerIntent(
  text: string,
  _locale?: string,
  deps?: PlanNluDeps
): Promise<PlannerIntent | null> {
  if (detectPromptInjection(text).hit) return null;

  const clean = sanitizeUntrustedText(text, { maxLen: 400 });
  if (clean.length < 4) return null;

  const complete = deps?.complete ?? llmChat;

  const result = await complete([
    { role: "system", content: buildPlanNluSystemPrompt(Object.keys(REGIONS)) },
    { role: "user", content: clean },
  ]);
  if (!result.ok) return null;

  return coerceIntent(extractJsonObject(result.text));
}
