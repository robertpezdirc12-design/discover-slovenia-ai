import { NextResponse } from "next/server";

import { parsePlannerIntent } from "@/lib/advisor/nlu";
import { rateLimited, tooManyRequests } from "@/lib/rate-limit";

/**
 * POST /api/plan-intent — SKRIPTNI NLU za /nacrtuj (2.24.0).
 *
 * Prosti opis potovanja („3 dni v gorah z družino, srednji proračun") →
 * parametri za DETERMINISTIČNI načrtovalnik. Kje bi bil AI model, tu je
 * SKRIPTA (src/lib/advisor/nlu.ts): razpoznavanje namena po besedah
 * (slovenski skloni vključeni), 0 AI žetonov, 0 omrežja, isti vhod →
 * isti izhod. Načrt gradi NEspremenjeni /api/itinerary (isti vhod → isti
 * načrt, cene samo iz registra — anti-halucinacijski kanon).
 *
 *  · javna pot → rate limit 5/min na odjemalca;
 *  · NIKOLI ne ugibamo: nerazumljen opis → 422 (UI pade na čipe in
 *    izbire — iskreno sporočilo);
 *  · 0 zasebnih podatkov: ne shranjujemo nič (brez DB, brez logov
 *    vsebine); prompt injekcija → 422 (kanon SYSTEM_DATA_GUARD).
 */

export const dynamic = "force-dynamic";

interface PlanIntentBody {
  text?: unknown;
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

  if (text.length < 4 || text.length > 400) {
    return NextResponse.json(
      {
        error:
          "Opis mora imeti 4–400 znakov. Krajši vnos? Uporabi čipe z interesi spodaj.",
      },
      { status: 400 }
    );
  }

  const intent = parsePlannerIntent(text);
  if (intent === null) {
    return NextResponse.json(
      {
        error:
          "Opisa ni bilo mogoče razumeti dovolj natančno — raje izberi interese in dneve spodaj (nikoli ne ugibamo).",
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    intent,
    engine: "script-nlu → deterministic-planner",
    hint: "Načrt bo sestavil deterministični motor (isti vhod → isti načrt).",
  });
}
