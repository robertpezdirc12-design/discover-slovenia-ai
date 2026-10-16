import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getTripForRead, getTripForWrite } from "@/lib/trip-auth";
import { rateLimited, tooManyRequests } from "@/lib/rate-limit";
import {
  JOURNAL_HISTORY_LIMIT,
  canModifyEntry,
  parseJournalInput,
  parseJournalPatch,
  serializeJournalEntry,
} from "@/lib/trip-journal";

/**
 * /api/trips/[shareId]/journal — skupnostni potni dnevnik (F12 iz
 * izvirnika 1.163.4, model TripDiaryEntry → mostovno TripJournalEntry;
 * glej src/lib/trip-journal.ts za kanon: tekstovni spomini BREZ slik,
 * natisnjena stran = "photobook").
 *
 *  GET    → zadnjih 200 vpisov (najnovejši prej) — javna pot ali sodelujoči
 *  POST   → { text, dayIndex?, placeName?, rating? } nov vpis (VIEWER+)
 *  PATCH  → { id, ...polja } urejanje LASTNEGA vpisa (avtor ALI lastnik —
 *           izvirnik: "ID pisca — edini lahko ureja izbriše")
 *  DELETE → { id } brisanje lastnega vpisa (avtor ALI lastnik)
 *
 * Varnost (isti vzorec kot klepet/ankete): vloga je STREŽNIŠKA
 * (getTripForWrite — fail-closed), `mine` značka je strežniška resnica,
 * uporabniški tekst gre skozi sanitizeUntrustedText (P0-I §23), 30/min
 * rate limit (P0 AUDIT M8 — pisanje v bazo).
 */

interface RouteParams {
  params: Promise<{ shareId: string }>;
}

const NOT_FOUND = { error: "Ta pot ne obstaja (ali ni javna)." } as const;
const ENTRY_NOT_FOUND = { error: "Vpis ne obstaja na tej poti." } as const;

export async function GET(_request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const ctx = await getTripForRead(shareId);
  if (!ctx) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }
  const rows = await db.tripJournalEntry.findMany({
    where: { journeyId: ctx.journey.id },
    orderBy: { createdAt: "desc" },
    take: JOURNAL_HISTORY_LIMIT,
  });
  return NextResponse.json({
    entries: rows.map((row) => serializeJournalEntry(row, ctx.userId)),
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  // P0 AUDIT M8: meja 30/min — pisanje v bazo (role-gated, a neomejeno v oknu).
  if (rateLimited(request, 30)) {
    return tooManyRequests();
  }
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "VIEWER");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { journey, userId } = guard.ctx;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  const parsed = parseJournalInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const me = await db.user.findUnique({
    where: { id: userId ?? "" },
    select: { name: true },
  });
  const authorName = me?.name?.trim() || "Popotnik";

  const entry = await db.tripJournalEntry.create({
    data: {
      journeyId: journey.id,
      authorId: userId,
      authorName,
      dayIndex: parsed.value.dayIndex,
      placeName: parsed.value.placeName,
      rating: parsed.value.rating,
      text: parsed.value.text,
    },
  });

  return NextResponse.json(
    { success: true, entry: serializeJournalEntry(entry, userId) },
    { status: 201 }
  );
}

export async function PATCH(request: Request, { params }: RouteParams) {
  if (rateLimited(request, 30)) {
    return tooManyRequests();
  }
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "VIEWER");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { journey, userId, role } = guard.ctx;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  const body = (typeof raw === "object" && raw !== null ? raw : {}) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  if (id === "") {
    return NextResponse.json({ error: "Manjka id vpisa." }, { status: 400 });
  }
  const parsed = parseJournalPatch(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await db.tripJournalEntry.findFirst({
    where: { id, journeyId: journey.id },
  });
  if (!existing) {
    return NextResponse.json(ENTRY_NOT_FOUND, { status: 404 });
  }
  // Izvirni kanon: ureja avtor ALI lastnik poti (strežniško — klient
  // ne more ponarediti avtorstva).
  if (!canModifyEntry(existing.authorId, userId, role === "OWNER")) {
    return NextResponse.json(
      { error: "Svoj vnos lahko ureja samo avtor (ali lastnik poti)." },
      { status: 403 }
    );
  }

  const updated = await db.tripJournalEntry.update({
    where: { id: existing.id },
    data: parsed.patch,
  });
  return NextResponse.json(
    { success: true, entry: serializeJournalEntry(updated, userId) }
  );
}

export async function DELETE(request: Request, { params }: RouteParams) {
  if (rateLimited(request, 30)) {
    return tooManyRequests();
  }
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "VIEWER");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { journey, userId, role } = guard.ctx;

  // id iz telesa ALI query parametra (isti duh kot ostale rute poti).
  let id = new URL(request.url).searchParams.get("id") ?? "";
  try {
    const raw: unknown = await request.json();
    if (typeof raw === "object" && raw !== null) {
      const bodyId = (raw as { id?: unknown }).id;
      if (typeof bodyId === "string" && bodyId !== "") id = bodyId;
    }
  } catch {
    // telo ni JSON — id iz queryja je veljavna pot
  }
  if (id === "") {
    return NextResponse.json({ error: "Manjka id vpisa." }, { status: 400 });
  }

  const existing = await db.tripJournalEntry.findFirst({
    where: { id, journeyId: journey.id },
  });
  if (!existing) {
    return NextResponse.json(ENTRY_NOT_FOUND, { status: 404 });
  }
  if (!canModifyEntry(existing.authorId, userId, role === "OWNER")) {
    return NextResponse.json(
      { error: "Svoj vnos lahko izbriše samo avtor (ali lastnik poti)." },
      { status: 403 }
    );
  }

  await db.tripJournalEntry.delete({ where: { id: existing.id } });
  return NextResponse.json({ success: true });
}
