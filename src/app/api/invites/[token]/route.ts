import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/trip-auth";

/**
 * PATCH /api/invites/[token] — SPREJEM vabila (?invite={token}).
 *
 * Prijavljeni uporabnik klikne »Sprejmi vabilo« → dobi vlogo iz vabila
 * (ustvari se TripCollaborator; vloga se NATO vedno izračunava strežniško).
 * Neprijavljeni → 401 (trak vabila jih pošlje na prijavo). Umaknjeno
 * vabilo → 403. Neobstoječe → 404 (žeton ne razkrije obstoja pote).
 */

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function PATCH(_request: Request, { params }: RouteParams) {
  const { token } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Za sprejem vabila se prijavi z računom popotnika." },
      { status: 401 }
    );
  }

  const invite = await db.tripInvite.findUnique({
    where: { token },
    include: { journey: { include: { owner: { select: { name: true } } } } },
  });
  if (!invite) {
    return NextResponse.json(
      { error: "To vabilo ne obstaja (ali je pot umaknjena)." },
      { status: 404 }
    );
  }
  if (invite.status === "REVOKED") {
    return NextResponse.json(
      { error: "Vabilo je bilo umaknjeno — lastnik te poti te ni več povabil." },
      { status: 403 }
    );
  }

  const me = await db.user.findUnique({ where: { id: userId }, select: { name: true } });

  // Že sprejel (ali lastnik) → iskren alreadyActive, brez dvojne vrstice.
  if (invite.journey.ownerId === userId) {
    return NextResponse.json({
      success: true,
      role: "OWNER",
      alreadyActive: true,
      note: "Ta pot je tvoja (si lastnik) — vabilo ni potrebno.",
    });
  }
  const existing = await db.tripCollaborator.findUnique({
    where: { journeyId_userId: { journeyId: invite.journeyId, userId } },
  });
  if (existing) {
    return NextResponse.json({
      success: true,
      role: existing.role,
      alreadyActive: true,
      note: "Vabilo si že sprejel — vloga na poti je aktivna.",
    });
  }
  if (invite.status === "ACCEPTED") {
    // Vabilo je sprejel nekdo drug; ta uporabnik še nima vloge — žeton je
    // porabljen (kanon: en klik na povezavo ni sprejem, a je žeton enkraten).
    return NextResponse.json(
      { error: "To vabilo je že sprejel drug uporabnik." },
      { status: 409 }
    );
  }

  await db.$transaction([
    db.tripCollaborator.create({
      data: {
        journeyId: invite.journeyId,
        userId,
        role: invite.role,
        invitedBy: invite.journey.owner.name,
      },
    }),
    db.tripInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } }),
  ]);

  return NextResponse.json({
    success: true,
    role: invite.role,
    shareId: invite.journey.shareId,
  });
}
