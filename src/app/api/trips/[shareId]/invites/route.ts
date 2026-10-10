import { NextResponse } from "next/server";

import { getTripForWrite, issueTripInvite } from "@/lib/trip-auth";
import { rateLimited, tooManyRequests } from "@/lib/rate-limit";
import {
  isValidEmail,
  publicOrigin,
  sendEmail,
  tripInviteEmail,
} from "@/lib/email";

/**
 * POST /api/trips/[shareId]/invites — izdaja vabila (enaka logika kot
 * POST .../collaborators; mostovni vzorec izvirnika, kjer je bila izdaja
 * na collaborators končni točki). SAMO lastnik.
 *
 * P3 (kanon 2.26.0) — E-POŠTA (neobvezno): telo { role, email? }. Če je
 * e-pošta podana IN je RESEND_API_KEY nastavljen, pošljemo vabilo po
 * e-pošti in iskreno poročamo (emailSent). Brez konfiguracije NE trdimo,
 * da je kaj poslano — emailHint ostane pošten (ročno deljenje).
 * Rate limit 10/min (P0 AUDIT M8 — pošiljanje = strošek, ne sme biti
 * neomejeno).
 */

interface RouteParams {
  params: Promise<{ shareId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  if (rateLimited(request, 10)) {
    return tooManyRequests();
  }
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "OWNER");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: { role?: unknown; email?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }

  const role = body.role === "VIEWER" ? "VIEWER" : body.role === "EDITOR" ? "EDITOR" : null;
  if (!role) {
    return NextResponse.json(
      { error: "Vloga mora biti EDITOR ali VIEWER." },
      { status: 400 }
    );
  }

  // Neobvezna e-pošta (P3): če je podana, mora biti veljavna — sicer 400
  // (nikoli ne pošiljamo na poljuben niz).
  const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
  if (rawEmail.length > 0 && !isValidEmail(rawEmail)) {
    return NextResponse.json(
      { error: "Vpisana e-pošta ni veljaven naslov." },
      { status: 400 }
    );
  }

  try {
    const token = await issueTripInvite(guard.ctx.journey.id, role as "EDITOR" | "VIEWER");
    const inviteUrl = `/pot/${shareId}?invite=${token}`;

    // P3 e-pošta: pošlji SAMO če je naslov podan in pošiljanje konfigurirano.
    let emailSent = false;
    let emailError: string | null = null;
    if (rawEmail.length > 0) {
      const origin = publicOrigin(request);
      const tpl = tripInviteEmail({
        tripTitle: guard.ctx.journey.title,
        inviteUrl: `${origin}${inviteUrl}`,
        role: role as "EDITOR" | "VIEWER",
        inviterName: guard.ctx.journey.ownerName || "Lastnik poti",
      });
      const res = await sendEmail({ to: rawEmail.toLowerCase(), ...tpl });
      emailSent = res.sent;
      if (!res.sent && res.reason !== "not_configured") {
        emailError = res.reason;
      }
    }

    return NextResponse.json(
      {
        success: true,
        inviteUrl,
        emailSent,
        emailHint: emailSent
          ? `Vabilo je poslano na ${rawEmail}.`
          : rawEmail.length > 0
            ? emailError
              ? `Vabilo ni bilo mogoče poslati (${emailError}) — povezavo kopiraj in deli ročno.`
              : "E-pošta ni konfigurirana (RESEND_API_KEY) — povezavo kopiraj in deli ročno."
            : "Vabilo po e-pošti ni bilo zahtevano — povezavo deli ročno.",
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Vabila ni bilo mogoče izstaviti." },
      { status: 500 }
    );
  }
}
