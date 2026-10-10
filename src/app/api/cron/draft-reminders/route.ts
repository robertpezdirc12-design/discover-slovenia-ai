import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireCronSecret } from "@/lib/cron-auth";
import {
  DRAFT_NUDGE_AUDIT_ACTION,
  DRAFT_NUDGE_INTERVAL_DAYS,
  planDraftNudges,
} from "@/lib/draft-nudge";
import {
  draftReminderEmail,
  isEmailConfigured,
  publicOrigin,
  sendEmail,
} from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/cron/draft-reminders — DNEVNI opomnik za zamujene partnerjeve
 * osnutke (P0-I, issue #1 §21 „draft-reminders"; urnik: vsak dan 8:00 UTC
 * v vercel.json).
 *
 * Kanoni (§21):
 *  - CRON_SECRET: Bearer žeton OBVEZEN (requireCronSecret — fail-closed 401);
 *  - BREZ LAŽNE E-POŠTE: poštnega strežnika NI — nudge je zabeležen v
 *    AuditLog in viden v portalu /partner (amber opomba). Poročilo to
 *    odkrito pove; nikoli ne trdimo, da je bilo kaj poslano;
 *  - IDEMPOTENCA/DEDUP: največ en nudge na osnutek v
 *    DRAFT_NUDGE_INTERVAL_DAYS dneh (primerjava z AuditLog zgodovino);
 *  - AUDITABILITY: vsak nudge → AuditLog „partner.draft_nudge" (actorType
 *    „system", meta: starost osnutka v dnevih — 0 skrivnosti);
 *  - RETRY SAFETY: prekinjen zagon je varno ponovljiv (dedup po času).
 */
async function handle(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  // Nabor: VSI osnutki partnerjev (status draft, lastnik obstaja —
  // platformski/seed vnosi so uredniško pregledani in niso predmet opombe).
  const drafts = await db.product.findMany({
    where: { status: "draft", ownerId: { not: null } },
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
      ownerId: true,
    },
  });

  // Dedup zgodovina: zadnji nudge vsakega osnutka (po AuditLog).
  const since = new Date(Date.now() - DRAFT_NUDGE_INTERVAL_DAYS * 86_400_000);
  const past = await db.auditLog.findMany({
    where: {
      action: DRAFT_NUDGE_AUDIT_ACTION,
      entityType: "product",
      createdAt: { gte: since },
    },
    select: { entityId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const lastNudge = new Map<string, Date>();
  for (const entry of past) {
    if (!lastNudge.has(entry.entityId)) {
      lastNudge.set(entry.entityId, entry.createdAt);
    }
  }

  const report = planDraftNudges(drafts, lastNudge);

  // P3 (kanon 2.26.0) — E-POŠTA (Resend, env-vrata): nudge poleg AuditLog-a
  // pošlje tudi po e-pošti lastniku osnutka. ISKRENO: brez RESEND_API_KEY
  // nič ne pošljemo in poročilo to pove (nikoli ne trdimo, da je poslano);
  // e-poštni uspeh/se ne uspešnost se zabeleži v AuditLog meta.
  const emailEnabled = isEmailConfigured();
  const origin = publicOrigin(req);
  let emailsSent = 0;
  const emailActions: Array<{ ownerId: string; sent: boolean; reason?: string }> = [];

  if (report.actions.length > 0) {
    if (emailEnabled) {
      // Naslovi lastnikov (samo tisti z veljavnim e-poštnim naslovom).
      // ownerId je v shemi nullable — preskočimo osnutke brez lastnika
      // (iskreno: reason "owner_missing", nudge ostane zabeležen).
      const ownerIds = [
        ...new Set(
          report.actions
            .map((a) => a.ownerId)
            .filter((id): id is string => typeof id === "string")
        ),
      ];
      const owners = await db.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, email: true, name: true },
      });
      const ownerById = new Map(owners.map((o) => [o.id, o]));
      const productById = new Map(drafts.map((d) => [d.id, d]));

      for (const a of report.actions) {
        if (typeof a.ownerId !== "string") {
          emailActions.push({ ownerId: "unknown", sent: false, reason: "owner_missing" });
          continue;
        }
        const owner = ownerById.get(a.ownerId);
        const product = productById.get(a.productId);
        if (!owner || !product) {
          emailActions.push({ ownerId: a.ownerId, sent: false, reason: "owner_or_product_missing" });
          continue;
        }
        const res = await sendEmail({
          to: owner.email.toLowerCase(),
          ...draftReminderEmail({
            productName: product.name,
            daysOld: a.ageDays,
            partnerUrl: `${origin}/partner`,
          }),
        });
        if (res.sent) emailsSent += 1;
        emailActions.push({
          ownerId: a.ownerId,
          sent: res.sent,
          ...(res.sent ? {} : { reason: res.reason }),
        });
      }
    }

    await db.auditLog.createMany({
      data: report.actions.map((a, i) => ({
        actorType: "system",
        action: DRAFT_NUDGE_AUDIT_ACTION,
        entityType: "product",
        entityId: a.productId,
        meta: JSON.stringify({
          ageDays: a.ageDays,
          ownerId: a.ownerId,
          // P3: e-pošta (iskreno — sent:false kadar ni konfigurirana).
          emailSent: emailActions[i]?.sent ?? false,
          ...(emailActions[i] && !emailActions[i].sent
            ? { emailReason: emailActions[i].reason ?? "not_configured" }
            : {}),
        }),
      })),
    });
  }

  return NextResponse.json(
    {
      status: "ok",
      job: "draft-reminders",
      scanned: report.scanned,
      nudged: report.planned,
      actions: report.actions.map((a) => `${a.productId}: ${a.ageDays} dni`),
      email: {
        configured: emailEnabled,
        sent: emailsSent,
        delivery: emailEnabled
          ? "Resend (RESEND_API_KEY) + portal /partner + AuditLog"
          : "portal /partner + AuditLog (e-pošta ni konfigurirana — RESEND_API_KEY manjka)",
      },
      delivery:
        emailEnabled
          ? "Resend e-pošta + portal /partner + AuditLog"
          : "portal /partner + AuditLog (brez e-pošte — RESEND_API_KEY ni nastavljen)",
      note:
        report.planned === 0
          ? "nič za opombo — osnutki so sveži ali že opomnjeni (idempotenten zagon)"
          : "zabeleženi nudgei za zamujene osnutke (vidni v /partner)",
    },
    { status: 200 }
  );
}

export const GET = handle;
export const POST = handle;
