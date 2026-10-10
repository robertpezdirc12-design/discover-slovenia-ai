import { NextResponse } from "next/server";

import { rateLimited, tooManyRequests } from "@/lib/rate-limit";
import { detectPromptInjection, sanitizeUntrustedText } from "@/lib/system-data-guard";
import { parsePlannerIntent } from "@/lib/advisor/nlu";
import { findDestinationMentions } from "@/lib/start-anywhere/match";
import { fetchPageText, corpusOf } from "@/lib/start-anywhere/fetch";
import { deriveSuggestion } from "@/lib/start-anywhere/suggest";

/**
 * POST /api/start-anywhere — SKRIPTNI Start Anywhere za /nacrtuj (2.25.0, P2).
 *
 * Kje bi bil AI model (Mindtrip: video → LLM), je tu SKRIPTA:
 *   povezava (YouTube, članek, TikTok og:description …) → strežniško
 *   prebrano besedilo (SSRF-varovano, 256 KiB, 8 s) → ujemanje krajev
 *   z registrom 38 destinacij (slovenski skloni vključeni) + NLU namen
 *   (dnevi/sezona/proračun) → predlog izhodišča za DETERMINISTIČNEGA
 *   načrtovalnika. 0 AI žetonov, 0 AI modelov, isti vhod → isti izhod.
 *
 *  · vhod: { url } ALI { text } — ne oboje (iskren 400);
 *  · url: samo http/https, privzeta vrata, javni naslovi (zasebni razredi
 *    zavrnjeni — SSRF varovalka), največ 3 preusmeritve, text/html|xhtml|
 *    plain, ≤ 256 KiB, ≤ 8 s; ob napaki iskren 502 + nasvet, naj uporabnik
 *    prilepi besedilo;
 *  · text: 4–2000 znakov; poskus navodil za AI (SYSTEM_DATA_GUARD) → 422
 *    (enako kot /api/plan-intent — nikoli ne izvajamo, ne odmevamo);
 *  · 0 prepoznanih krajev → 422 (NIKOLI ne ugibamo — iskreno sporočilo);
 *  · javna pot → 5 zahtev/min na odjemalca (zunanji dostopi — vljudnost);
 *  · 0 zasebnih podatkov: ne shranjujemo ničesar (brez DB, brez logov
 *    vsebine); besedila virov gredo skozi SANITIZACIJO pred ujemanjem.
 */
export const dynamic = "force-dynamic";

interface StartAnywhereBody {
  url?: unknown;
  text?: unknown;
}

const URL_MAX = 300;
const TEXT_MIN = 4;
const TEXT_MAX = 2_000;

export async function POST(request: Request) {
  if (rateLimited(request, 5)) {
    return tooManyRequests();
  }

  let body: StartAnywhereBody;
  try {
    body = JSON.parse(await request.text()) as StartAnywhereBody;
  } catch {
    return NextResponse.json(
      { error: "Neveljaven JSON v telesu zahteve" },
      { status: 400 }
    );
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (url.length > 0 && text.length > 0) {
    return NextResponse.json(
      { error: "Podaj bodisi povezavo bodisi besedilo — ne oboje." },
      { status: 400 }
    );
  }

  // ── 1) NAČIN: POVEZAVA (strežniško branje, SSRF-varovano) ─────────────
  if (url.length > 0) {
    if (url.length > URL_MAX) {
      return NextResponse.json(
        { error: "Povezava je predolga (meja 300 znakov)." },
        { status: 400 }
      );
    }
    const fetched = await fetchPageText(url);
    if (!fetched.ok) {
      return NextResponse.json(
        {
          error: `Povezave ni bilo mogoče prebrati (${fetched.error.message}). Namesto nje prilepi besedilo — enako deluje.`,
        },
        { status: 502 }
      );
    }
    // korpus: naslov + opis + vidno besedilo, SANITIZIRANO (0 izvedbe,
    // 0 odmeva — ujemalec išče samo kraje).
    const corpus = sanitizeUntrustedText(corpusOf(fetched.page), {
      maxLen: 5_000,
    });
    const matches = findDestinationMentions(corpus);
    // NLU namen na istem korpusu; injekcija v vsebini vira → intent null
    // (iskrenost); zadetki krajev niso ogroženi (ujemanje ne izvaja nič).
    const intent = parsePlannerIntent(corpus);
    if (matches.length === 0) {
      return NextResponse.json(
        {
          error:
            "V viru nisem prepoznal nobenega kraja iz registra (38 destinacij). Ne ugibam — poskusi bolj jasen vir ali prilepi besedilo.",
        },
        { status: 422 }
      );
    }
    const suggestion = deriveSuggestion(matches, intent);
    return NextResponse.json({
      engine: "script-start-anywhere → deterministic-planner",
      source: {
        kind: "url" as const,
        host: fetched.host,
        title: fetched.page.title,
      },
      matches: matches.map((m) => ({
        slug: m.dest.slug,
        name: m.dest.name,
        type: m.dest.type,
        region: m.dest.region,
        evidence: m.evidence,
        needle: m.needle,
        kind: m.kind,
      })),
      intent,
      suggestion,
      hint: "Kraji so prepoznani s skripto (0 AI). Načrt sestavi deterministični motor: isti vhod vedno da isti načrt.",
    });
  }

  // ── 2) NAČIN: BESEDILO (uporabnikovo) ────────────────────────────────
  if (text.length === 0) {
    return NextResponse.json(
      { error: "Podaj povezavo (url) ali besedilo (text)." },
      { status: 400 }
    );
  }
  if (text.length < TEXT_MIN) {
    return NextResponse.json(
      { error: "Besedilo je prekratko (najmanj 4 znaki)." },
      { status: 400 }
    );
  }
  if (text.length > TEXT_MAX) {
    return NextResponse.json(
      { error: "Besedilo je predolgo (meja 2000 znakov) — skrajšaj ga." },
      { status: 400 }
    );
  }
  if (detectPromptInjection(text).hit) {
    // ISTI kanon kot /api/plan-intent: poskus navodil → iskrena zavrnitev.
    return NextResponse.json(
      {
        error:
          "Besedilo vsebuje znake poskusa navodil za AI. Ne izvajam jih — odstrani jih in poskusi znova, ali izberi interese spodaj.",
      },
      { status: 422 }
    );
  }

  const clean = sanitizeUntrustedText(text, { maxLen: TEXT_MAX });
  const matches = findDestinationMentions(clean);
  const intent = parsePlannerIntent(clean);
  if (matches.length === 0) {
    return NextResponse.json(
      {
        error:
          "V besedilu nisem prepoznal nobenega kraja iz registra (38 destinacij). Ne ugibam — dodaj imena krajev (npr. Bled, Ljubljana, Soča) ali izberi interese spodaj.",
      },
      { status: 422 }
    );
  }
  const suggestion = deriveSuggestion(matches, intent);
  return NextResponse.json({
    engine: "script-start-anywhere → deterministic-planner",
    source: { kind: "text" as const, chars: clean.length },
    matches: matches.map((m) => ({
      slug: m.dest.slug,
      name: m.dest.name,
      type: m.dest.type,
      region: m.dest.region,
      evidence: m.evidence,
      needle: m.needle,
      kind: m.kind,
    })),
    intent,
    suggestion,
    hint: "Kraji so prepoznani s skripto (0 AI). Načrt sestavi deterministični motor: isti vhod vedno da isti načrt.",
  });
}
