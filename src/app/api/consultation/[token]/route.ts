import { NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * GET /api/consultation/[token] — ZASEBNA stran odgovora (P0-H §20).
 *
 * Lastnik povezave = poznalec žetona (isti kanon kot /pot/[shareId]).
 * E-pošte NE vračamo (vsak s povezavo ne sme videti naslova pošiljatelja).
 * Neznan žeton → 404 brez razkritja obstoja.
 */

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Neveljavna povezava." }, { status: 404 });
  }

  try {
    const c = await db.consultation.findUnique({ where: { accessToken: token } });
    if (!c) {
      return NextResponse.json({ error: "Ta povezava ne obstaja." }, { status: 404 });
    }

    return NextResponse.json({
      consultation: {
        question: c.question,
        destinationName: c.destinationName,
        travelDates: c.travelDates,
        partyDescription: c.partyDescription,
        budget: c.budget,
        interests: c.interests ? (JSON.parse(c.interests) as string[]) : [],
        answer: c.answer,
        answerSource: c.answerSource,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        deliveredAt: c.deliveredAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    console.error("[api/consultation/token] GET napaka:", err);
    return NextResponse.json({ error: "Stran trenutno ni dosegljiva." }, { status: 500 });
  }
}
