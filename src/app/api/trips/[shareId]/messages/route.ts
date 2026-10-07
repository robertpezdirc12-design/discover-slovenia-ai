import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getTripForRead, getTripForWrite, parseJourneyPlan } from "@/lib/trip-auth";
import {
  AI_ADVISOR_NAME,
  answerAiQuestion,
  isAiMention,
} from "@/lib/trip-chat-engine";

/**
 * /api/trips/[shareId]/messages — skupinski klepet na poti z @AI svetovalcem
 * (mostovna rekonstrukcija W2 / Issue #15 / 1.131.0).
 *
 *  GET  → zgodovina (kronološko, zadnjih 200) — javna pot ali sodelujoči
 *  POST → { body } objavi sporočilo (sodelujoči: VIEWER+); značka AI je
 *         STREŽNIŠKA — klient NIKOLI ne pošlje isAiBot (polje se ignorira);
 *         če telo vsebuje omembo @AI, strežnik DETERMINISTIČNO odgovori
 *         (src/lib/trip-chat-engine.ts — 0 AI žetonov, 0 zunanjih klicev).
 *
 * Iskrenost: uporabnikovo sporočilo ostane objavljeno tudi, če AI odpove;
 * napake se izpišejo (brez tihih padcev).
 */

interface RouteParams {
  params: Promise<{ shareId: string }>;
}

const BODY_MIN = 2;
const BODY_MAX = 500;
const HISTORY_LIMIT = 200;

export async function GET(_request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const ctx = await getTripForRead(shareId);
  if (!ctx) {
    return NextResponse.json({ error: "Ta pot ne obstaja (ali ni javna)." }, { status: 404 });
  }
  const rows = await db.tripMessage.findMany({
    where: { journeyId: ctx.journey.id },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
  });
  return NextResponse.json({
    messages: rows.map((m) => ({
      id: m.id,
      authorId: m.authorId,
      authorName: m.authorName,
      isAI: m.isAiBot,
      text: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "VIEWER");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { journey, userId } = guard.ctx;

  let body: { body?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text.length < BODY_MIN || text.length > BODY_MAX) {
    return NextResponse.json(
      { error: `Sporočilo mora imeti med ${BODY_MIN} in ${BODY_MAX} znakov.` },
      { status: 400 }
    );
  }

  const me = await db.user.findUnique({
    where: { id: userId ?? "" },
    select: { name: true },
  });
  const authorName = me?.name?.trim() || "Popotnik";

  // 1. Uporabnikovo sporočilo se VEDNO objavi (tudi če AI kasneje odpove).
  const message = await db.tripMessage.create({
    data: {
      journeyId: journey.id,
      authorId: userId,
      authorName,
      isAiBot: false, // izrecno: klient ne more ponarediti značke AI
      body: text,
    },
  });

  const serialized = {
    id: message.id,
    authorId: message.authorId,
    authorName: message.authorName,
    isAI: message.isAiBot,
    text: message.body,
    createdAt: message.createdAt.toISOString(),
  };

  // 2. Omemba @AI → strežniški deterministični odgovor (0 žetonov).
  if (!isAiMention(text)) {
    return NextResponse.json({ success: true, message: serialized }, { status: 201 });
  }

  try {
    const plan = parseJourneyPlan(journey.data);
    const answer = answerAiQuestion(text, plan);
    const aiMessage = await db.tripMessage.create({
      data: {
        journeyId: journey.id,
        authorId: null,
        authorName: AI_ADVISOR_NAME,
        isAiBot: true,
        body: answer,
      },
    });
    return NextResponse.json(
      {
        success: true,
        message: serialized,
        aiMessage: {
          id: aiMessage.id,
          authorId: null,
          authorName: aiMessage.authorName,
          isAI: aiMessage.isAiBot,
          text: aiMessage.body,
          createdAt: aiMessage.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (e) {
    // AI odpove — sporočilo uporabnika OSTANE objavljeno (iskrenost).
    return NextResponse.json(
      {
        success: true,
        message: serialized,
        aiError: e instanceof Error ? e.message : "AI svetovalec trenutno ne more odgovoriti.",
      },
      { status: 201 }
    );
  }
}
