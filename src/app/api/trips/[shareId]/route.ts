import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  getTripForRead,
  getTripForWrite,
  parseJourneyPlan,
} from "@/lib/trip-auth";

/**
 * /api/trips/[shareId] — agregat poti (kanon izvirnikovega /api/trip/:id).
 *
 *  GET   → javna pot (vsi) ali sodelujoči; vrača vlogo, ime, verzijo,
 *          razčlenjen načrt in (za lastnika) seznam sodelujočih.
 *  PATCH → preimenovanje s compare-and-swap (baseVersion ne ujema → 409,
 *          iskreno „sočasno urejanje") + preklop isPublic (samo OWNER).
 */

interface RouteParams {
  params: Promise<{ shareId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const ctx = await getTripForRead(shareId);
  if (!ctx) {
    return NextResponse.json(
      { error: "Ta pot ne obstaja (ali ni javna)." },
      { status: 404 }
    );
  }

  const plan = parseJourneyPlan(ctx.journey.data);
  const base = {
    success: true,
    shareId: ctx.journey.shareId,
    role: ctx.role,
    isPublic: ctx.journey.isPublic,
    ownerName: ctx.journey.ownerName,
    name: ctx.journey.title,
    version: {
      renameVersion: ctx.journey.renameVersion,
      updatedAt: ctx.journey.updatedAt.toISOString(),
    },
    createdAt: ctx.journey.createdAt.toISOString(),
    plan: { ...plan, shareId: ctx.journey.shareId, name: ctx.journey.title },
  };

  if (ctx.role !== "OWNER") {
    return NextResponse.json(base);
  }

  // Seznam sodelujočih — SAMO lastnik (vloge drugih niso javne).
  const [collaborators, invites] = await Promise.all([
    db.tripCollaborator.findMany({
      where: { journeyId: ctx.journey.id },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { email: true, name: true } } },
    }),
    db.tripInvite.findMany({
      where: { journeyId: ctx.journey.id, status: { in: ["PENDING", "REVOKED"] } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const rows = [
    ...collaborators.map((c) => ({
      id: c.id,
      role: c.role,
      status: "ACTIVE",
      kind: "collaborator" as const,
      userId: c.userId,
      inviteEmail: null,
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
      userId: null,
      inviteEmail: null,
      invitedBy: ctx.journey.ownerName,
      createdAt: i.createdAt.toISOString(),
      acceptedAt: null,
      accountEmail: null,
      accountName: null,
    })),
  ];

  return NextResponse.json({ ...base, collaborators: rows });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { shareId } = await params;

  let body: {
    name?: unknown;
    baseVersion?: unknown;
    isPublic?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }

  const wantsRename = typeof body.name === "string";
  const wantsPublic = typeof body.isPublic === "boolean";

  if (!wantsRename && !wantsPublic) {
    return NextResponse.json(
      { error: "Nič za posodobiti (podaj name in/ali isPublic)." },
      { status: 400 }
    );
  }

  // Preklop javne povezave — SAMO lastnik; preverimo najstrožjo zahtevo,
  // da kombiniran PATCH ne pusti polovicnega uspeha (fail-closed).
  const minRole = wantsPublic ? "OWNER" : "EDITOR";
  const guard = await getTripForWrite(shareId, minRole);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const ctx = guard.ctx;

  if (wantsPublic) {
    await db.travelJourney.update({
      where: { id: ctx.journey.id },
      data: { isPublic: body.isPublic as boolean },
    });
  }

  if (wantsRename) {
    const name = (body.name as string).trim().slice(0, 120);
    if (name.length < 2) {
      return NextResponse.json(
        { error: "Ime poti mora imeti vsaj 2 znaka." },
        { status: 400 }
      );
    }
    const baseVersion = typeof body.baseVersion === "number" ? body.baseVersion : null;
    if (baseVersion === null) {
      return NextResponse.json(
        { error: "Preimenovanje zahteva baseVersion (zaklep sočasnega urejanja)." },
        { status: 400 }
      );
    }
    if (baseVersion !== ctx.journey.renameVersion) {
      return NextResponse.json(
        {
          error:
            "Pot je med tem preimenoval nekdo drug (sočasno urejanje) — osveži in poskusi znova.",
          conflict: true,
        },
        { status: 409 }
      );
    }
    await db.travelJourney.update({
      where: { id: ctx.journey.id },
      data: { title: name, renameVersion: { increment: 1 } },
    });
  }

  const updated = await db.travelJourney.findUnique({
    where: { id: ctx.journey.id },
    select: { title: true, isPublic: true, renameVersion: true },
  });

  return NextResponse.json({
    success: true,
    name: updated?.title ?? null,
    isPublic: updated?.isPublic ?? null,
    renameVersion: updated?.renameVersion ?? null,
  });
}

/** DELETE ni del mostovnega obsega — izrecno (iskrena 405). */
export async function DELETE() {
  return NextResponse.json({ error: "Brisanje poti ni podprto." }, { status: 405 });
}

export const dynamic = "force-dynamic";
