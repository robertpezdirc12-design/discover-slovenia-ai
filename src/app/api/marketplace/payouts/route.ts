import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdminSession } from "@/lib/affiliate-server";
import {
  assertPayoutTransition,
  derivePayoutStatus,
  isPayoutStatus,
  payoutDueDate,
  type PayoutStatus,
} from "@/lib/marketplace-types";

export const dynamic = "force-dynamic";

/**
 * /api/marketplace/payouts — SKRBNIŠKI pregled izplačil lastne tržnice
 * (P0-E, issue #1 §11 „owner visibility").
 *
 * Varovanje: DSA_ADMIN_EMAILS (isti kanon kot /api/affiliate/*) — brez
 * nastavitve ali brez prijave → 403 fail-closed.
 *
 *  GET   → naročila z življenjskim ciklom izplačila:
 *          - payoutStatus STORJEN + effectivePayout (izpeljava: plačano +
 *            potekla zadrževalna doba → „due" — determinizem, ne ročno);
 *          - zahtevki kupca po preklicu (vidni lastniku — obravnava pri
 *            plačilnem ponudniku, NE samodejni povratek);
 *          - seštevki po statusih + revizijska sled (AuditLog).
 *  PATCH  { orderId, action: "start_processing" | "mark_paid" } —
 *          prehodi SAMO po dovoljenih tranzicijah (due → processing →
 *          paid); vsak prehod zapiše AuditLog (append-only).
 */

const MAX_ORDERS = 200;
const MAX_AUDIT = 50;

interface PayoutOrderRow {
  id: string;
  status: string;
  demo: boolean;
  totalCents: number;
  paidAt: string | null;
  storedPayout: PayoutStatus;
  effectivePayout: PayoutStatus;
  payoutDueAt: string | null;
  cancellationRequestedAt: string | null;
  payoutUpdatedAt: string | null;
  createdAt: string;
  items: { name: string; qty: number; priceCents: number }[];
}

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { error: "Dostop samo za skrbnike (DSA_ADMIN_EMAILS)." },
      { status: 403 }
    );
  }

  const now = new Date();
  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: MAX_ORDERS,
    include: { items: true },
  });

  const rows: PayoutOrderRow[] = orders.map((o) => {
    const storedPayout: PayoutStatus = isPayoutStatus(o.payoutStatus)
      ? o.payoutStatus
      : "not_due";
    const effective = derivePayoutStatus({
      orderStatus: o.status,
      paidAt: o.paidAt,
      currentPayout: storedPayout,
      now,
    });
    const due = o.paidAt ? payoutDueDate(o.paidAt) : null;
    return {
      id: o.id,
      status: o.status,
      demo: o.demo,
      totalCents: o.totalCents,
      paidAt: o.paidAt ? o.paidAt.toISOString() : null,
      storedPayout,
      effectivePayout: effective,
      payoutDueAt: due ? due.toISOString() : null,
      cancellationRequestedAt: o.cancellationRequestedAt
        ? o.cancellationRequestedAt.toISOString()
        : null,
      payoutUpdatedAt: o.payoutUpdatedAt ? o.payoutUpdatedAt.toISOString() : null,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => ({
        name: i.nameSnapshot,
        qty: i.qty,
        priceCents: i.priceCentsSnapshot,
      })),
    };
  });

  // Seštevki (iz efektivnega stanja — kar lastnik dejansko vidi).
  const totals: Record<PayoutStatus, { count: number; cents: number }> = {
    not_due: { count: 0, cents: 0 },
    due: { count: 0, cents: 0 },
    processing: { count: 0, cents: 0 },
    paid: { count: 0, cents: 0 },
  };
  let cancellationRequests = 0;
  for (const r of rows) {
    if (r.status === "paid") {
      totals[r.effectivePayout].count += 1;
      totals[r.effectivePayout].cents += r.totalCents;
    }
    if (r.cancellationRequestedAt) cancellationRequests += 1;
  }

  const audit = await db.auditLog.findMany({
    where: { entityType: "order" },
    orderBy: { createdAt: "desc" },
    take: MAX_AUDIT,
  });

  return NextResponse.json({
    orders: rows,
    totals,
    cancellationRequests,
    audit: audit.map((a) => ({
      id: a.id,
      actorType: a.actorType,
      actorId: a.actorId,
      action: a.action,
      entityId: a.entityId,
      meta: a.meta,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(request: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { error: "Dostop samo za skrbnike (DSA_ADMIN_EMAILS)." },
      { status: 403 }
    );
  }

  let body: { orderId?: unknown; action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!orderId || !action) {
    return NextResponse.json({ error: "Manjkata orderId in action." }, { status: 400 });
  }
  if (action !== "start_processing" && action !== "mark_paid") {
    return NextResponse.json(
      { error: 'action mora biti "start_processing" ali "mark_paid".' },
      { status: 400 }
    );
  }

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.json({ error: "Naročilo ne obstaja." }, { status: 404 });
  }
  if (order.status !== "paid") {
    return NextResponse.json(
      { error: "Izplačilo se tiče SAMO plačanih naročil." },
      { status: 409 }
    );
  }

  // Trenutno stanje = IZPELJAVA (determinizem) nad shranjenim statusom.
  const current = derivePayoutStatus({
    orderStatus: order.status,
    paidAt: order.paidAt,
    currentPayout: isPayoutStatus(order.payoutStatus) ? order.payoutStatus : "not_due",
  });
  const target: PayoutStatus = action === "start_processing" ? "processing" : "paid";

  const transition = assertPayoutTransition(current, target);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 409 });
  }

  const changedAt = new Date();
  const updated = await db.order.update({
    where: { id: order.id },
    data: { payoutStatus: target, payoutUpdatedAt: changedAt },
  });

  // Revizijska sled (append-only) — vsak prehod izplačila je zabeležen.
  let adminEmail: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    adminEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  } catch {
    adminEmail = null;
  }
  try {
    await db.auditLog.create({
      data: {
        actorType: "owner",
        actorId: adminEmail,
        action: `payout.${target}`,
        entityType: "order",
        entityId: order.id,
        meta: JSON.stringify({ from: current, to: target }),
      },
    });
  } catch (err) {
    console.error("[api/marketplace/payouts] auditLog ni uspel:", err);
  }

  return NextResponse.json({
    success: true,
    orderId: updated.id,
    payoutStatus: updated.payoutStatus,
    payoutUpdatedAt: changedAt.toISOString(),
  });
}
