import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getTripForRead, getTripForWrite } from "@/lib/trip-auth";
import {
  buildAttestationNote,
  noteTextOf,
  validateConfirmationRecord,
} from "@/lib/journey/booking";

/**
 * /api/trips/[shareId]/reservations — rezervacijske vrstice na poti
 * (mostovna rekonstrukcija Issue #4 §4 + S1 UTRDITEV 51-c).
 *
 *  GET    → seznam (javna pot ali sodelujoči)
 *  POST   → doda vrstico { dayIndex, stopSlug?, stopName, status?, note? }
 *           — status IDEA (privzeto) ALI CONFIRMED SAMO z atestacijo
 *             (source USER/IMPORTED + providerBookingId + confirmedPrice —
 *             izvirna import pot: klient nikoli ne prinese lažne potrditve)
 *  PATCH  → { id, status, providerBookingId?, confirmedPrice?, note? }
 *           — prehodi po življenjskem ciklu (TRIP_TRANSITIONS spodaj);
 *             CONFIRMED/MODIFIED zahtevata isto atestacijo kot POST
 *  DELETE → { id } odstrani vrstico
 *
 * S1 (iskrenost — kanon izvirnika, avdita §"JourneyBooking lifecycle"):
 *  · status CONFIRMED brez atestacije (številka rezervacije + cena iz
 *    potrdila ponudnika) → 400 — klient ne more ponarediti „potrjeno";
 *  · poskus source:"PROVIDER" → 503 fail-closed (provider kanal v peskovniku
 *    NE obstaja, brez žetona; nikoli ne lažemo, da obstaja);
 *  · CANCELLED je TERMINALEN (brez povratkov v IDEA);
 *  · atestacija se shrani kot kompakten JSON v stolpec `note` (shema se NE
 *    spreminja): { source, providerBookingId, confirmedPrice, userNote }.
 *
 * Mutacije: EDITOR+ (VIEWER only ne ureja rezervacij — fail-closed).
 */

interface RouteParams {
  params: Promise<{ shareId: string }>;
}

/**
 * Slovar stanj pote (mostovni nabor IDEA|CONFIRMED|MODIFIED|CANCELLED —
 * IDEA ≈ vstopni DRAFT življenjskega cikla, CANCELLED terminalen).
 * Prehodi so lokalna preslikava na kanonski cikel iz
 * src/lib/journey/booking.ts (ALLOWED_TRANSITIONS).
 */
const TRIP_STATUSES = ["IDEA", "CONFIRMED", "MODIFIED", "CANCELLED"] as const;
type TripStatus = (typeof TRIP_STATUSES)[number];

const TRIP_TRANSITIONS: Record<TripStatus, readonly TripStatus[]> = {
  IDEA: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["MODIFIED", "CANCELLED"],
  MODIFIED: ["MODIFIED", "CANCELLED"],
  CANCELLED: [], // terminal — brez povratkov
};

/** Izvori, ki jih lahko prinese UPORABNIK (import pot izvirnika). */
const USER_SOURCES = ["USER", "IMPORTED"] as const;

/** Provider kanal v peskovniku NE obstaja — vedno fail-closed (nikoli lažno). */
const PROVIDER_FAIL_CLOSED = {
  error: "Provider kanal ni aktiven (brez žetona).",
  status: "fail-closed",
} as const;

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

/**
 * S1 atestacija: preveri, da telo zahtevka nosi pošteno uporabniško
 * atestacijo (source USER/IMPORTED + številka rezervacije + cena) in jo
 * validiraj skozi kanonski validator. Vrne { ok, note } ali { ok:false, error }.
 */
function validateUserAttestation(body: {
  source?: unknown;
  providerBookingId?: unknown;
  confirmedPrice?: unknown;
  confirmationUrl?: unknown;
}): { ok: true; note: string } | { ok: false; error: string } {
  if (body.source !== "USER" && body.source !== "IMPORTED") {
    return {
      ok: false,
      error:
        'Potrjevanje rezervacije zahteva izvor source: "USER" — tvoj vnos iz potrdila ponudnika.',
    };
  }
  const source = body.source === "IMPORTED" ? "IMPORTED" : "USER";
  if (body.confirmationUrl != null) {
    return {
      ok: false,
      error: "Polje confirmationUrl lahko nosi samo provider kanal (ni aktiven).",
    };
  }
  if (typeof body.providerBookingId !== "string" || body.providerBookingId.trim().length === 0) {
    return {
      ok: false,
      error:
        "Potrjena rezervacija zahteva številko rezervacije (providerBookingId) iz potrdila ponudnika.",
    };
  }
  if (typeof body.confirmedPrice !== "number") {
    return {
      ok: false,
      error: "Potrjena rezervacija zahteva ceno (confirmedPrice, število > 0) iz potrdila ponudnika.",
    };
  }
  const v = validateConfirmationRecord({
    status: "CONFIRMED", // atestacijska oblika (tudi za MODIFIED — nova različica potrdila)
    source,
    providerBookingId: body.providerBookingId,
    confirmedPrice: body.confirmedPrice,
  });
  if (!v.ok) return { ok: false, error: v.error };
  return {
    ok: true,
    note: buildAttestationNote({
      source,
      providerBookingId: body.providerBookingId.trim(),
      confirmedPrice: body.confirmedPrice,
    }),
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
    source?: unknown;
    providerBookingId?: unknown;
    confirmedPrice?: unknown;
    confirmationUrl?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }

  // S1: provider kanal v peskovniku NE obstaja — fail-closed 503, nikoli lažno.
  if (body.source === "PROVIDER") {
    return NextResponse.json(PROVIDER_FAIL_CLOSED, { status: 503 });
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

  // Status: SAMO IDEA (privzeto) ali CONFIRMED z atestacijo (import pot).
  if (
    body.status !== undefined &&
    body.status !== null &&
    body.status !== "IDEA" &&
    body.status !== "CONFIRMED"
  ) {
    return NextResponse.json(
      {
        error:
          "status mora biti IDEA ali CONFIRMED (z atestacijo); preklic in sprememba sta možni kasneje prek PATCH.",
      },
      { status: 400 }
    );
  }
  const status: TripStatus = body.status === "CONFIRMED" ? "CONFIRMED" : "IDEA";

  // Izvor (če je naveden) sme biti samo uporabniški — provider je že 503.
  if (
    body.source !== undefined &&
    body.source !== null &&
    !(USER_SOURCES as readonly string[]).includes(body.source as string)
  ) {
    return NextResponse.json(
      { error: 'izvor (source) mora biti "USER" ali "IMPORTED".' },
      { status: 400 }
    );
  }

  const hasProviderFields =
    body.providerBookingId != null || body.confirmedPrice != null || body.confirmationUrl != null;

  let note: string | null;
  if (status === "CONFIRMED") {
    // S1: „CONFIRMED" brez atestacije → 400 (številka rezervacije + cena).
    const attestation = validateUserAttestation(body);
    if (!attestation.ok) {
      return NextResponse.json({ error: attestation.error }, { status: 400 });
    }
    const userNote =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 500)
        : "";
    note = userNote
      ? buildAttestationNote({
          source: body.source === "IMPORTED" ? "IMPORTED" : "USER",
          providerBookingId: (body.providerBookingId as string).trim(),
          confirmedPrice: body.confirmedPrice as number,
          userNote,
        })
      : attestation.note;
  } else {
    if (hasProviderFields) {
      return NextResponse.json(
        {
          error:
            "Atestacija (providerBookingId / confirmedPrice / confirmationUrl) sme spremljati samo status CONFIRMED.",
        },
        { status: 400 }
      );
    }
    note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 500)
        : null;
  }

  const created = await db.tripReservation.create({
    data: {
      journeyId: guard.ctx.journey.id,
      createdBy: guard.ctx.userId ?? "",
      dayIndex: body.dayIndex,
      stopSlug: typeof body.stopSlug === "string" && body.stopSlug ? body.stopSlug.slice(0, 80) : null,
      stopName: body.stopName.trim().slice(0, 200),
      status,
      note,
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

  let body: {
    id?: unknown;
    status?: unknown;
    note?: unknown;
    source?: unknown;
    providerBookingId?: unknown;
    confirmedPrice?: unknown;
    confirmationUrl?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }

  // S1: poskus provider kanala → fail-closed 503 (brez žetona, nikoli lažno).
  if (body.source === "PROVIDER") {
    return NextResponse.json(PROVIDER_FAIL_CLOSED, { status: 503 });
  }

  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Manjka id rezervacije." }, { status: 400 });
  }
  if (
    typeof body.status !== "string" ||
    !(TRIP_STATUSES as readonly string[]).includes(body.status)
  ) {
    return NextResponse.json(
      { error: "status mora biti IDEA, CONFIRMED, MODIFIED ali CANCELLED." },
      { status: 400 }
    );
  }

  // Izvor (če je naveden) sme biti samo uporabniški — provider je že 503.
  if (
    body.source !== undefined &&
    body.source !== null &&
    !(USER_SOURCES as readonly string[]).includes(body.source as string)
  ) {
    return NextResponse.json(
      { error: 'izvor (source) mora biti "USER" ali "IMPORTED".' },
      { status: 400 }
    );
  }

  const existing = await db.tripReservation.findFirst({
    where: { id: body.id, journeyId: guard.ctx.journey.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Rezervacija ne obstaja." }, { status: 404 });
  }

  // Fail-closed: neznan obstoječi status (zunaj mostovnega nabora) se ne
  // pretvarja — izrecna napaka namesto tihega ugibanja.
  if (!(TRIP_STATUSES as readonly string[]).includes(existing.status)) {
    return NextResponse.json(
      { error: `Neznano stanje obstoječe rezervacije: "${existing.status}".` },
      { status: 400 }
    );
  }

  const from = existing.status as TripStatus;
  const next = body.status as TripStatus;

  if (!TRIP_TRANSITIONS[from].includes(next)) {
    const reason =
      from === "CANCELLED" ? " Preklicana rezervacija je dokončna (terminalno stanje)." : "";
    return NextResponse.json(
      { error: `Prehod ${from} → ${next} ni dovoljen.${reason}` },
      { status: 400 }
    );
  }

  const hasProviderFields =
    body.providerBookingId != null || body.confirmedPrice != null || body.confirmationUrl != null;

  let note = existing.note;
  if (next === "CONFIRMED" || next === "MODIFIED") {
    // Potrjevanje/sprememba zahtevata isto atestacijo kot POST (S1).
    const attestation = validateUserAttestation(body);
    if (!attestation.ok) {
      return NextResponse.json({ error: attestation.error }, { status: 400 });
    }
    // Uporabniška opomba: nova (iz telesa) ali ohranjena iz obstoječega
    // zapisa (JSON userNote / legacy golo besedilo) — izvorna opomba ne sme
    // biti izgubljena.
    const userNote =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 500)
        : (noteTextOf(existing.note) ?? "");
    note = userNote
      ? buildAttestationNote({
          source: body.source === "IMPORTED" ? "IMPORTED" : "USER",
          providerBookingId: (body.providerBookingId as string).trim(),
          confirmedPrice: body.confirmedPrice as number,
          userNote,
        })
      : attestation.note;
  } else if (hasProviderFields) {
    // Preklic ne spreminja atestacije — polja ponudnika so odveč.
    return NextResponse.json(
      {
        error:
          "Atestacija (providerBookingId / confirmedPrice / confirmationUrl) sme spremljati samo status CONFIRMED ali MODIFIED.",
      },
      { status: 400 }
    );
  }

  const updated = await db.tripReservation.update({
    where: { id: existing.id },
    data: { status: next, note },
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