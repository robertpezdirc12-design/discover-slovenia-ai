import { NextResponse } from "next/server";

import { isLlmConfigured } from "@/lib/ai/client";
import { parsePlannerIntent } from "@/lib/ai/plan-nlu";
import { rateLimited, tooManyRequests } from "@/lib/rate-limit";

/**
 * POST /api/ai/plan-intent — NLU za /nacrtuj (P1/AI, 2.24.0).
 *
 * Prosti opis potovanja ("3 dni v gorah z otroki, srednji budget") →
 * parametri za DETERMINISTIČNI načrtovalnik. LLM samo RAZUME namen;
 * načrt gradi nespremenjeni /api/itinerary (isti vhod → isti načrt,
 * cene samo iz registra — anti-halucinacijski kanon).
 *
 *  · javna pot → rate limit 5/min na odjemalca;
 *  · fail-closed: LLM izklopljen → 503 z iskrenim sporočilom (UI pade
 *    na ročne čipe); nerazumljiv opis → 422 (nikoli ne ugibamo);
 *  · 0 zasebnih podatkov: ne shranjujemo nič (brez DB, brez logov
 *    vsebine).
 */

export const dynamic = "force-dynamic";

interface PlanIntentBody {
  text?: unknown;
  locale?: unknown;
}

export async function POST(request: Request) {
  if (rateLimited(request, 5)) {
    return tooManyRequests();
  }

  let body: PlanIntentBody;
  try {
    body = JSON.parse(await request.text()) as PlanIntentBody;
  } catch {
    return NextResponse.json(
      { error: "Neveljaven JSON v telesu zahteve" },
      { status: 400 }
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const locale = typeof body.locale === "string" ? body.locale : "sl";

  if (text.length < 4 || text.length > 400) {
    return NextResponse.json(
      {
        error:
          "Opis mora imeti 4–400 znakov. Krajši vnos? Uporabi čipe z interesi spodaj.",
      },
      { status: 400 }
    );
  }

  // Iskrenost: brez konfiguriranega LLM-ja NE delujemo "kot da".
  if (!isLlmConfigured()) {
    return NextResponse.json(
      {
        error:
          "Prosti opis trenutno ni na voljo — sestavi načrt s čipi in izbirami spodaj (enako dober rezultat).",
        llmAvailable: false,
      },
      { status: 503 }
    );
  }

  const intent = await parsePlannerIntent(text, locale);
  if (intent === null) {
    return NextResponse.json(
      {
        error:
          "Opisa ni bilo mogoče razumeti dovolj natančno — raje izberi interese in dni spodaj (nikoli ne ugibamo).",
        llmAvailable: true,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    intent,
    engine: "llm-nlu → deterministic-planner",
    hint: "Načrt bo sestavil deterministični motor (isti vhod → isti načrt).",
  });
}
