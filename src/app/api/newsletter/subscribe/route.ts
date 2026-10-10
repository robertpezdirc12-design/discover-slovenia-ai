import { NextResponse } from "next/server";

import { newsletterWelcomeEmail, sendEmail } from "@/lib/email";
import { z } from "zod";

import { db } from "@/lib/db";
import { rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * /api/newsletter/subscribe — POST {email} → upsert NewsletterSubscriber.
 * Idempotentno: ponovna prijava istega naslova ne ustvari dvojnika
 * (upsert po unique email) in vrne already: true.
 * Rate limit: 5/min (P0 AUDIT M2 — javna pisanja v bazo so bila neomejena).
 */
const SubscribeSchema = z.object({
  email: z.string().trim().email().max(160),
});

export async function POST(request: Request) {
  if (rateLimited(request, 5)) {
    return NextResponse.json(
      { ok: false, error: "Preveč zahtevkov — poskusi znova čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

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
    // P3 (kanon 2.26.0) — pozdravni e-pošti SAMO novim naročnikom (obstoječi
    // ne dobijo ponovnega pozdrava — brez neželene pošte). Neuspeh pošiljanja
    // NE pomeni neuspešne prijave (prijava živi v bazi) — iskreno poročamo.
    let welcomeSent = false;
    if (!existing) {
      const res = await sendEmail({ to: email, ...newsletterWelcomeEmail() });
      welcomeSent = res.sent;
    }
    return NextResponse.json({
      ok: true,
      already: Boolean(existing),
      id: record.id,
      welcomeSent,
    });
  } catch {
    // P0 AUDIT L1: podrobnost napake NE gre k odjemalcu — dnevnik na strežniku.
    console.error("[api/newsletter] prijava ni uspela");
    return NextResponse.json(
      {
        ok: false,
        error: "Prijava trenutno ni mogoča — poskusi kasneje.",
      },
      { status: 503 }
    );
  }
}
