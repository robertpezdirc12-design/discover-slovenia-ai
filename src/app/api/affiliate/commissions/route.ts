import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  commissionDraftFromInput,
  isAdminSession,
} from "@/lib/affiliate-server";

export const dynamic = "force-dynamic";

/**
 * /api/affiliate/commissions — provizijski dnevnik ZA SKRBNIKE.
 *
 *   GET   → zadnjih 200 vnosov (urejeno padajoče) + povzetek po statusih
 *   POST  → ročni vnos iz partnerjevega poročila (payoutDueAt se izračuna
 *           po vzorcu T+3 meseci/28.); commissionEur po advisory oceni
 *           registra, če poročilo ne poda zneska
 *   PATCH → sprememba statusa PENDING → CONFIRMED → PAID (terminalno)
 *
 * ISKRENOST (kanon trip-reservations): vnosi so IZKLJUČNO iz poročil
 * partnerjev (source MANUAL/CSV_IMPORT) — „potrjeno" pomeni potrjeno v
 * partnerjevem poročilu, ne naša predpostavka.
 *
 * Varovanje: DSA_ADMIN_EMAILS — brez nastavitve/prijave 403 (fail-closed).
 */

const STATUSES = ["PENDING", "CONFIRMED", "PAID"] as const;

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { error: "Dostop samo za skrbnike (DSA_ADMIN_EMAILS)." },
      { status: 403 },
    );
  }
  const entries = await db.commissionEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { error: "Dostop samo za skrbnike (DSA_ADMIN_EMAILS)." },
      { status: 403 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Neveljavno JSON telo zahteve." },
      { status: 400 },
    );
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const draft = commissionDraftFromInput({
    providerId: String(b.providerId ?? ""),
    bookingRef: String(b.bookingRef ?? ""),
    bookedFor: b.bookedFor ? String(b.bookedFor) : null,
    amountEur: Number(b.amountEur),
    commissionEur:
      b.commissionEur == null || b.commissionEur === ""
        ? null
        : Number(b.commissionEur),
    stayCompletedAt: b.stayCompletedAt ? String(b.stayCompletedAt) : null,
    note: b.note ? String(b.note) : null,
  });
  if (!draft.ok) {
    return NextResponse.json({ error: draft.error }, { status: 400 });
  }
  try {
    const entry = await db.commissionEntry.create({
      data: {
        ...draft.draft,
        source: String(b.source ?? "MANUAL") === "CSV_IMPORT" ? "CSV_IMPORT" : "MANUAL",
      },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (e) {
    // Edinstveni par (providerId, bookingRef) → P2002: podvojen vnos.
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        {
          error:
            "Vnos s to številko rezervacije pri tem partnerju že obstaja.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Vnosa ni bilo mogoče shraniti." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { error: "Dostop samo za skrbnike (DSA_ADMIN_EMAILS)." },
      { status: 403 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Neveljavno JSON telo zahteve." },
      { status: 400 },
    );
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const id = String(b.id ?? "");
  const status = String(b.status ?? "");
  if (!id) {
    return NextResponse.json(
      { error: "Manjka id vnosa." },
      { status: 400 },
    );
  }
  if (!(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: "Dovoljeni statusi: PENDING, CONFIRMED, PAID." },
      { status: 400 },
    );
  }
  try {
    const entry = await db.commissionEntry.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json({ entry });
  } catch {
    return NextResponse.json(
      { error: "Vnosa ni bilo mogoče posodobiti (obstaja?)." },
      { status: 404 },
    );
  }
}
