import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isAdminSession } from "@/lib/affiliate-server";
import { getSessionContext } from "@/lib/partner-session";

/**
 * /api/admin/consultations — skrbniški pregled konzultacij (P0-H §20).
 *
 *  GET  → zadnjih 50 konzultacij (brez žetonov povezav v odgovoru
 *         odjemalcu — žeton ostane med skrbnikom in vpraševalcem).
 *  POST → ročna dopolnitev/odgovor { consultationId, answer }:
 *         answerSource → "manual", status "delivered" (iskreno razkrita
 *         razlika od samodejnega determinističnega odgovora).
 *
 * Vrata: isAdminSession (DSA_ADMIN_EMAILS) → 403 fail-closed.
 * AuditLog: consultation.answered (actorType "owner").
 */

export const dynamic = "force-dynamic";

const MAX_ROWS = 50;

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { error: "Dostop samo za skrbnike (DSA_ADMIN_EMAILS)." },
      { status: 403 }
    );
  }
  try {
    const rows = await db.consultation.findMany({
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    });
    return NextResponse.json({
      consultations: rows.map((c) => ({
        id: c.id,
        email: c.email,
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
      })),
    });
  } catch (err) {
    console.error("[api/admin/consultations] GET napaka:", err);
    return NextResponse.json({ error: "Seznam trenutno ni dosegljiv." }, { status: 500 });
  }
}

interface AnswerBody {
  consultationId?: unknown;
  answer?: unknown;
}

export async function POST(request: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { error: "Dostop samo za skrbnike (DSA_ADMIN_EMAILS)." },
      { status: 403 }
    );
  }
  let body: AnswerBody;
  try {
    body = (await request.json()) as AnswerBody;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  const consultationId =
    typeof body.consultationId === "string" ? body.consultationId : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  if (!consultationId || answer.length < 20 || answer.length > 8000) {
    return NextResponse.json(
      { error: "Manjka id ali odgovor (med 20 in 8000 znakov)." },
      { status: 400 }
    );
  }

  try {
    const existing = await db.consultation.findUnique({ where: { id: consultationId } });
    if (!existing) {
      return NextResponse.json({ error: "Konzultacija ne obstaja." }, { status: 404 });
    }
    await db.$transaction([
      db.consultation.update({
        where: { id: consultationId },
        data: {
          answer,
          answerSource: "manual",
          status: "delivered",
          deliveredAt: new Date(),
        },
      }),
      db.auditLog.create({
        data: {
          actorType: "owner",
          actorId: (await getSessionContext())?.email ?? "admin",
          action: "consultation.answered",
          entityType: "consultation",
          entityId: consultationId,
          meta: JSON.stringify({ answerSource: "manual", previousSource: existing.answerSource }),
        },
      }),
    ]);
    return NextResponse.json({ ok: true, answerSource: "manual" });
  } catch (err) {
    console.error("[api/admin/consultations] POST napaka:", err);
    return NextResponse.json({ error: "Shranjevanje odgovora ni uspelo." }, { status: 500 });
  }
}
