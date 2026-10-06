import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * /api/newsletter/subscribe — POST {email} → upsert NewsletterSubscriber.
 * Idempotentno: ponovna prijava istega naslova ne ustvari dvojnika
 * (upsert po unique email) in vrne already: true.
 */
const SubscribeSchema = z.object({
  email: z.string().trim().email().max(160),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Neveljaven JSON v telesu zahteve." },
      { status: 400 }
    );
  }

  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Vpisani e-poštni naslov ni veljaven." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();

  try {
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
      select: { id: true },
    });
    const record = existing
      ? existing
      : await db.newsletterSubscriber.create({
          data: { email },
          select: { id: true },
        });
    return NextResponse.json({
      ok: true,
      already: Boolean(existing),
      id: record.id,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Prijava trenutno ni mogoča — poskusi kasneje.",
        detail: err instanceof Error ? err.message.split("\n")[0] : undefined,
      },
      { status: 503 }
    );
  }
}
