import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireCronSecret } from "@/lib/cron-auth";
import {
  PAYOUT_RECALC_AUDIT_ACTION,
  planPayoutRecalc,
} from "@/lib/marketplace-recalc";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/cron/recalculate-status — DNEVNO usklajevanje shranjenih statusov
 * izplačil (P0-I, issue #1 §21 „recalculate-status"; urnik: vsak dan 6:30
 * UTC v vercel.json).
 *
 * Kanoni (§21 — vsi izpolnjeni):
 *  - CRON_SECRET: Bearer žeton OBVEZEN (requireCronSecret — fail-closed 401);
 *  - IDEMPOTENCA: job premika SAMO not_due → due (izpeljava zadrževalne
 *    dobe); ponovni zagon nad že usklajenimi naročili naredi NIČ;
 *  - AUDITABILITY: vsaka sprememba dobi AuditLog „payout.due_materialized"
 *    (actorType "system" — zagon je strojni, ne človeški);
 *  - RETRY SAFETY: prehod je pogojen na trenutno shranjeno stanje — prekinjen
 *    zagon je varno ponovljiv;
 *  - LEPLJIVOST: ročni statusi processing/paid se NIKOLI ne premaknejo
 *    (plan jih sploh ne predlaga — marketplace-recalc.ts).
 *
 * Poročilo je varno za dnevnik: samo števci + ID-ji (0 skrivnosti).
 */
async function handle(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  // Nabor: plačana naročila (samo pri njih izpeljava sploh pride do due).
  // Statusi pending/cancelled/expired ostanejo not_due brez pisanja.
  const orders = await db.order.findMany({
    where: { status: "paid" },
    select: { id: true, status: true, paidAt: true, payoutStatus: true },
  });

  const report = planPayoutRecalc(orders);

  if (report.actions.length > 0) {
    // Vse materializacije + dnevniški zapisi v ENI transakciji: ali se
    // zapišeta sprememba IN sled skupaj, ali nič (konsistentna revizija).
    await db.$transaction([
      ...report.actions.map((a) =>
        db.order.update({
          where: { id: a.orderId },
          data: { payoutStatus: a.to },
        })
      ),
      ...report.actions.map((a) =>
        db.auditLog.create({
          data: {
            actorType: "system",
            action: PAYOUT_RECALC_AUDIT_ACTION,
            entityType: "payout",
            entityId: a.orderId,
            meta: JSON.stringify({ from: a.from, to: a.to }),
          },
        })
      ),
    ]);
  }

  return NextResponse.json(
    {
      status: "ok",
      job: "recalculate-status",
      scanned: report.scanned,
      changed: report.planned,
      actions: report.actions.map((a) => `${a.orderId}: ${a.from} → ${a.to}`),
      note:
        report.planned === 0
          ? "nič za pisanje — shranjeni statusi so že usklajeni (idempotenten zagon)"
          : "materializirana izpeljava zadrževalne dobe (not_due → due)",
    },
    { status: 200 }
  );
}

export const GET = handle;
export const POST = handle;
