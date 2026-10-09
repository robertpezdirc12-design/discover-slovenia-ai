import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { rateLimited, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * /api/contact — POST {name, email, message} → shrani ContactMessage.
 * Validacija (zod): ime 2–80 znakov, e-pošta, sporočilo 10–4000 znakov.
 * Hramba: največ 12 mesecev (politika zasebnosti).
 * Rate limit: 5/min (P0 AUDIT M2 — javna pisanja v bazo so bila neomejena).
 */
const ContactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  message: z.string().trim().min(10).max(4000),
});

export async function POST(request: Request) {
  if (rateLimited(request, 5)) {
    return tooManyRequests();
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

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Preveri obvezna polja: ime, e-pošta in sporočilo (vsaj 10 znakov).",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const { name, email, message } = parsed.data;

  try {
    const saved = await db.contactMessage.create({
      data: { name, email, message },
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, id: saved.id }, { status: 201 });
  } catch {
    // P0 AUDIT L1: podrobnost napake NE gre k odjemalcu (razkritje notranjosti) —
    // dnevnik na strežniku, odjemalcu iskreno splošno sporočilo.
    console.error("[api/contact] shranjevanje ni uspelo");
    return NextResponse.json(
      {
        ok: false,
        error: "Shranjevanje sporočila trenutno ni mogoče — poskusi kasneje.",
      },
      { status: 503 }
    );
  }
}
