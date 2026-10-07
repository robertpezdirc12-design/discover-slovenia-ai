import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getTripForRead, getTripForWrite } from "@/lib/trip-auth";

/**
 * /api/trips/[shareId]/reservations — rezervacijske vrstice na poti
 * (mostovna rekonstrukcija Issue #4 §4: postanek-dan osnova).
 *
 *  GET    → seznam (javna pot ali sodelujoči)
 *  POST   → doda vrstico { dayIndex, stopSlug?, stopName, status?, note? }
 *  PATCH  → { id, status } → IDEA | CONFIRMED | CANCELLED
 *  DELETE → { id } odstrani vrstico
 *
 * Mutacije: EDITOR+ (VIEWER only ne ureja rezervacij — fail-closed).
 * Izvor je vedno razkrit (IDEA ≠ CONFIRMED — uporabniški vnos nikoli
 * ni „potrjeno pri ponudniku").
 */

interface RouteParams {
  params: Promise<{ shareId: string }>;
}

const STATUSES = ["IDEA", "CONFIRMED", "CANCELLED"] as const;

function serialize(r: {
  id: string;
  dayIndex: number;
  stopSlug: string | null;
  stopName: string;
  status: string;
  note: string | null;
  createdAt: Date;
  createdBy: string;
}) {
  return {
    id: r.id,
    dayIndex: r.dayIndex,
    stopSlug: r.stopSlug,
    stopName: r.stopName,
    status: r.status,
    note: r.note,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const ctx = await getTripForRead(shareId);
  if (!ctx) {
    return NextResponse.json({ error: "Ta pot ne obstaja (ali ni javna)." }, { status: 404 });
  }
  const reservations = await db.tripReservation.findMany({
    where: { journeyId: ctx.journey.id },
    orderBy: [{ dayIndex: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ reservations: reservations.map(serialize) });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "EDITOR");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: {
    dayIndex?: unknown;
    stopSlug?: unknown;
    stopName?: unknown;
    status?: unknown;
    note?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }

  if (
    typeof body.dayIndex !== "number" ||
    !Number.isInteger(body.dayIndex) ||
    body.dayIndex < 1 ||
    body.dayIndex > 30
  ) {
    return NextResponse.json(
      { error: "dayIndex mora biti celo število med 1 in 30." },
      { status: 400 }
    );
  }
  if (typeof body.stopName !== "string" || body.stopName.trim().length < 2) {
    return NextResponse.json(
      { error: "Ime postanka je obvezno (vsaj 2 znaka)." },
      { status: 400 }
    );
  }
  const status =
    body.status === "CONFIRMED" ? "CONFIRMED" : "IDEA";
  if (body.status !== undefined && !STATUSES.includes(body.status as (typeof STATUSES)[number])) {
    return NextResponse.json(
      { error: "status mora biti IDEA, CONFIRMED ali CANCELLED." },
      { status: 400 }
    );
  }

  const created = await db.tripReservation.create({
    data: {
      journeyId: guard.ctx.journey.id,
      createdBy: guard.ctx.userId ?? "",
      dayIndex: body.dayIndex,
      stopSlug: typeof body.stopSlug === "string" && body.stopSlug ? body.stopSlug.slice(0, 80) : null,
      stopName: body.stopName.trim().slice(0, 200),
      status,
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null,
    },
  });

  return NextResponse.json(
    { success: true, reservation: serialize(created) },
    { status: 201 }
  );
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "EDITOR");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: { id?: unknown; status?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Manjka id rezervacije." }, { status: 400 });
  }
  if (
    typeof body.status !== "string" ||
    !STATUSES.includes(body.status as (typeof STATUSES)[number])
  ) {
    return NextResponse.json(
      { error: "status mora biti IDEA, CONFIRMED ali CANCELLED." },
      { status: 400 }
    );
  }

  const existing = await db.tripReservation.findFirst({
    where: { id: body.id, journeyId: guard.ctx.journey.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Rezervacija ne obstaja." }, { status: 404 });
  }

  const updated = await db.tripReservation.update({
    where: { id: existing.id },
    data: { status: body.status },
  });

  return NextResponse.json({ success: true, reservation: serialize(updated) });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "EDITOR");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: { id?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Manjka id rezervacije." }, { status: 400 });
  }

  const existing = await db.tripReservation.findFirst({
    where: { id: body.id, journeyId: guard.ctx.journey.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Rezervacija ne obstaja." }, { status: 404 });
  }

  await db.tripReservation.delete({ where: { id: existing.id } });
  return NextResponse.json({ success: true });
}
