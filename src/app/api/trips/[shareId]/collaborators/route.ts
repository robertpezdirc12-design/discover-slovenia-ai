import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getTripForWrite, issueTripInvite } from "@/lib/trip-auth";
import { rateLimited, tooManyRequests } from "@/lib/rate-limit";
import {
  isValidEmail,
  publicOrigin,
  sendEmail,
  tripInviteEmail,
} from "@/lib/email";

/**
 * /api/trips/[shareId]/collaborators — upravljanje sodelujočih (48-a,
 * rekonstrukcija TripCollab §13): vabila (?invite=), sprememba vloge,
 * odvzem dostopa. VSA dejanja SAMO lastnik (fail-closed).
 *
 *  GET    → seznam (ACTIVE sodelujoči + PENDING/REVOKED vabila)
 *  POST   → izda vabilo { role: "EDITOR" | "VIEWER", email? } → { inviteUrl,
 *           emailSent, emailHint } — P3 (2.26.0): neobvezno pošlje vabilo
 *           po e-pošti, če je RESEND_API_KEY nastavljen; iskreno poroča.
 *           Rate limit 10/min (pošiljanje = strošek).
 *  PATCH  → { id, role? } spremeni vlogo (sodelujočega ali vabila);
 *           { id, status: "PENDING" } oživi umaknjeno vabilo („Povabi znova")
 *  DELETE → { id } odvzame dostop (briše sodelujočega + umakne vabilo)
 *           ali umakne čakajoče vabilo (REVOKED)
 */

interface RouteParams {
  params: Promise<{ shareId: string }>;
}

const ROLES = ["EDITOR", "VIEWER"] as const;
type InviteRole = (typeof ROLES)[number];

export async function GET(_request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "OWNER");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { journey } = guard.ctx;

  const [collaborators, invites] = await Promise.all([
    db.tripCollaborator.findMany({
      where: { journeyId: journey.id },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { email: true, name: true } } },
    }),
    db.tripInvite.findMany({
      where: { journeyId: journey.id, status: { in: ["PENDING", "REVOKED"] } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const rows = [
    ...collaborators.map((c) => ({
      id: c.id,
      role: c.role,
      status: "ACTIVE",
      kind: "collaborator" as const,
      invitedBy: c.invitedBy,
      createdAt: c.createdAt.toISOString(),
      acceptedAt: c.createdAt.toISOString(),
      accountEmail: c.user.email,
      accountName: c.user.name,
    })),
    ...invites.map((i) => ({
      id: i.id,
      role: i.role,
      status: i.status,
      kind: "invite" as const,
      invitedBy: journey.ownerName,
      createdAt: i.createdAt.toISOString(),
      acceptedAt: null,
      accountEmail: null,
      accountName: null,
    })),
  ];

  return NextResponse.json({ success: true, collaborators: rows });
}

export async function POST(request: Request, { params }: RouteParams) {
  // P0 AUDIT M8 + P3: izdaja vabila (in morebitno pošiljanje) je omejena.
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

  // P3: neobvezna e-pošta — veljavnost preverjena (nikoli ne pošiljamo na poljuben niz).
  const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
  if (rawEmail.length > 0 && !isValidEmail(rawEmail)) {
    return NextResponse.json(
      { error: "Vpisana e-pošta ni veljaven naslov." },
      { status: 400 }
    );
  }

  try {
    const token = await issueTripInvite(guard.ctx.journey.id, role as InviteRole);
    const inviteUrl = `/pot/${shareId}?invite=${token}`;

    // P3 e-pošta: pošlji SAMO če je naslov podan in pošiljanje konfigurirano;
    // brez konfiguracije iskreno predlagamo ročno deljenje (nikoli lažni uspeh).
    let emailSent = false;
    let emailError: string | null = null;
    if (rawEmail.length > 0) {
      const origin = publicOrigin(request);
      const tpl = tripInviteEmail({
        tripTitle: guard.ctx.journey.title,
        inviteUrl: `${origin}${inviteUrl}`,
        role: role as InviteRole,
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

export async function PATCH(request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "OWNER");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { journey } = guard.ctx;

  let body: { id?: unknown; role?: unknown; status?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  if (typeof body.id !== "string" || body.id.length === 0) {
    return NextResponse.json({ error: "Manjka id vrstice." }, { status: 400 });
  }

  // „Povabi znova": umaknjeno vabilo → spet PENDING (isti žeton).
  if (body.status === "PENDING" && body.role === undefined) {
    const invite = await db.tripInvite.findFirst({
      where: { id: body.id, journeyId: journey.id },
    });
    if (!invite) {
      return NextResponse.json({ error: "Vabilo ne obstaja." }, { status: 404 });
    }
    await db.tripInvite.update({
      where: { id: invite.id },
      data: { status: "PENDING" },
    });
    return NextResponse.json({ success: true });
  }

  const role = body.role === "VIEWER" ? "VIEWER" : body.role === "EDITOR" ? "EDITOR" : null;
  if (!role) {
    return NextResponse.json(
      { error: "Vloga mora biti EDITOR ali VIEWER." },
      { status: 400 }
    );
  }

  const collab = await db.tripCollaborator.findFirst({
    where: { id: body.id, journeyId: journey.id },
  });
  if (collab) {
    await db.tripCollaborator.update({ where: { id: collab.id }, data: { role } });
    return NextResponse.json({ success: true });
  }

  const invite = await db.tripInvite.findFirst({
    where: { id: body.id, journeyId: journey.id },
  });
  if (invite) {
    await db.tripInvite.update({ where: { id: invite.id }, data: { role } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Vrstica ne obstaja." }, { status: 404 });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "OWNER");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { journey } = guard.ctx;

  let body: { id?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  if (typeof body.id !== "string" || body.id.length === 0) {
    return NextResponse.json({ error: "Manjka id vrstice." }, { status: 400 });
  }

  // 1) Sodelujoči → izbriši vrstico (vloga se izračuna iz nje → dostop
  //    odvzet takoj; fail-closed). Žetoni vabila ostanejo nespremenjeni.
  const collab = await db.tripCollaborator.findFirst({
    where: { id: body.id, journeyId: journey.id },
  });
  if (collab) {
    await db.tripCollaborator.delete({ where: { id: collab.id } });
    return NextResponse.json({ success: true, revoked: "collaborator" });
  }

  // 2) Vabilo → REVOKED.
  const invite = await db.tripInvite.findFirst({
    where: { id: body.id, journeyId: journey.id, status: "PENDING" },
  });
  if (invite) {
    await db.tripInvite.update({
      where: { id: invite.id },
      data: { status: "REVOKED" },
    });
    return NextResponse.json({ success: true, revoked: "invite" });
  }

  return NextResponse.json({ error: "Vrstica ne obstaja." }, { status: 404 });
}
