import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { rateLimited, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * /api/providers/report — javna prijava napake na profilu ponudnika
 * (#35 §6c.4 „report" gumb; faza 4a: API plast, UI žica sledi v 4b).
 *
 * KANONI:
 *  · VSAKA prijava je SPOR — ne resnica: vnos se SHRANI in pokaže
 *    skrbniku (moderacija), profil se NE spremeni samodejno.
 *  · Brez osebnih podatkov razen neobveznega e-poštnega kontakta
 *    prijavitelja (GDPR R6 — izrecno neobvezno polje).
 *  · Rate limit 10/min na odjemalca (javno pisanje v bazo — vzorec
 *    P0 AUDIT M2, kot /api/contact 5/min; prijava je lažja od stika).
 *  · Podrobnost napake baze NE gre k odjemalcu (P0 AUDIT L1).
 *
 * Pred pisanjem: provider MORA obstajati (404 sicer) — prijava brez
 * profila ni shranjena (preprečuje smeti; GC ni potreben).
 */

const ReportSchema = z.object({
  providerId: z.string().trim().min(1).max(64),
  reason: z.enum(["napaka", "zaprt", "dupliciran", "drugo"]),
  message: z.string().trim().min(5).max(1000),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  if (rateLimited(request, 10)) {
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

  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Preveri polja: providerId, reason (napaka|zaprt|dupliciran|drugo) in opis (vsaj 5 znakov).",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const { providerId, reason, message, email } = parsed.data;

  try {
    const provider = await db.provider.findUnique({
      where: { id: providerId },
      select: { id: true },
    });
    if (!provider) {
      return NextResponse.json(
        { ok: false, error: "Ponudnik s tem ID ne obstaja." },
        { status: 404 }
      );
    }

    const saved = await db.providerReport.create({
      data: {
        providerId,
        reason,
        message,
        email: email && email.length > 0 ? email : null,
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, id: saved.id }, { status: 201 });
  } catch {
    // P0 AUDIT L1: podrobnost napake NE gre k odjemalcu.
    return NextResponse.json(
      { ok: false, error: "Prijava trenutno ni mogoča — poskusi pozneje." },
      { status: 500 }
    );
  }
}
