import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  buildConsultationFallbackAnswer,
  CONSULTATION_DAILY_LIMIT,
  generateConsultationToken,
  utcDayStart,
  validateConsultationInput,
} from "@/lib/consultation-fallback";

/**
 * POST /api/consultation — javni obrazec "VPRAŠAJ LOKALCA" (P0-H §20).
 *
 * Brezplačna globja konzultacija: vprašanje (20–2000) + prosti dodatki.
 * Odgovor je DETERMINISTIČEN (registar destinacij + vodene povezave
 * partnerjev — 0 AI, 0 omrežja, issue §29) in se izroči OBROJ ustvarjanju
 * (answerSource "fallback"); skrbnik ga lahko kasneje ročno dopolni.
 *
 *  · Rate limit 10/min na odjemalca + 3 vprašanja/dan na e-pošto (UTC
 *    dan — kanon izvirnika, varuje stroške; iskerno razkrito v odgovoru);
 *  · odgovor: { token, url } — ZASEBNA povezava; e-pošte NE pošiljamo
 *    (peskovnik brez SMTP — iskreno: povezavo si shrani).
 */

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
/** Okna po minutah (ključ ip:minuta) z varnostno mrežo pomnilnika. */
const rateBuckets = new Map<string, number>();

function allowRequest(ip: string): boolean {
  const windowKey = `${ip}:${Math.floor(Date.now() / RATE_WINDOW_MS)}`;
  const count = rateBuckets.get(windowKey) ?? 0;
  if (count >= RATE_LIMIT) return false;
  rateBuckets.set(windowKey, count + 1);
  if (rateBuckets.size > 5_000) rateBuckets.clear();
  return true;
}

export const dynamic = "force-dynamic";

interface ConsultationBody {
  email?: unknown;
  question?: unknown;
  destinationName?: unknown;
  travelDates?: unknown;
  partyDescription?: unknown;
  budget?: unknown;
  interests?: unknown;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(ip)) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusi čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: ConsultationBody;
  try {
    body = (await request.json()) as ConsultationBody;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }

  const parsed = validateConsultationInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const input = parsed.value;

  try {
    // Dnevna omejitev na e-pošto (3/dan, UTC dan — iskreno razkrito).
    const todayCount = await db.consultation.count({
      where: { email: input.email, createdAt: { gte: utcDayStart() } },
    });
    if (todayCount >= CONSULTATION_DAILY_LIMIT) {
      return NextResponse.json(
        {
          error: `Dnevna omejitev je ${CONSULTATION_DAILY_LIMIT} vprašanja na e-pošto (po UTC). Poskusi jutri ali dopolni obstoječe vprašanje.`,
        },
        { status: 429 }
      );
    }

    const token = generateConsultationToken();
    const answer = buildConsultationFallbackAnswer(input);

    const created = await db.consultation.create({
      data: {
        accessToken: token,
        email: input.email,
        question: input.question,
        destinationName: input.destinationName,
        travelDates: input.travelDates,
        partyDescription: input.partyDescription,
        budget: input.budget,
        interests: JSON.stringify(input.interests),
        answer,
        answerSource: "fallback",
        status: "delivered", // deterministični odgovor je takoj na voljo
        deliveredAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        actorType: "customer",
        actorId: null,
        action: "consultation.created",
        entityType: "consultation",
        entityId: created.id,
        meta: JSON.stringify({
          answerSource: "fallback",
          hasDestination: Boolean(input.destinationName),
          interests: input.interests.length,
        }),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        token,
        url: `/konzultacija/${token}`,
        dailyRemaining: Math.max(0, CONSULTATION_DAILY_LIMIT - todayCount - 1),
        note: "Povezavo si shrani — e-pošte ne pošiljamo (iskrena omejitev peskovnika).",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/consultation] POST napaka:", err);
    return NextResponse.json({ error: "Pošiljanje vprašanja ni uspelo." }, { status: 500 });
  }
}
