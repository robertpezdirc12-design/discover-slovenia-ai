import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isAdminSession } from "@/lib/affiliate-server";
import { getSessionContext } from "@/lib/partner-session";

/**
 * /api/admin/leads — prijave partnerjev (P0-H §22).
 *
 *  GET  → prijave (interest "partner"), najprej nove; z statusom.
 *  POST → skrbniška odločitev { leadId, action }:
 *        · "approve"  → User.role "partner" (po e-pošti prijave) +
 *                       Lead.status "approved" — iskreno 404, če uporabnik
 *                       s tem e-poštnim naslovom še nima računa;
 *        · "reject"   → Lead.status "rejected";
 *        · "contacted"→ Lead.status "contacted" (vmesni korak).
 *
 * Vrata: isAdminSession (DSA_ADMIN_EMAILS) → 403 fail-closed.
 * AuditLog: partner.approved / partner.rejected / partner.contacted.
 */

export const dynamic = "force-dynamic";

const MAX_ROWS = 100;

const STATUS_ORDER: Record<string, number> = {
  new: 0,
  contacted: 1,
  approved: 2,
  rejected: 3,
};

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { error: "Dostop samo za skrbnike (DSA_ADMIN_EMAILS)." },
      { status: 403 }
    );
  }
  try {
    const leads = await db.lead.findMany({
      where: { interest: "partner" },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    });
    const sorted = [...leads].sort(
      (a, b) =>
        (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
        b.createdAt.getTime() - a.createdAt.getTime()
    );

    // Ali ima prijavljeni e-poštni naslov že uporabniški račun?
    const emails = [...new Set(sorted.map((l) => l.email))];
    const users = emails.length
      ? await db.user.findMany({
          where: { email: { in: emails } },
          select: { email: true, role: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.email, u]));

    return NextResponse.json({
      leads: sorted.map((l) => ({
        id: l.id,
        email: l.email,
        note: l.note,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
        account: userMap.get(l.email)
          ? { exists: true, role: userMap.get(l.email)!.role }
          : { exists: false, role: null },
      })),
    });
  } catch (err) {
    console.error("[api/admin/leads] GET napaka:", err);
    return NextResponse.json({ error: "Seznam prijav trenutno ni dosegljiv." }, { status: 500 });
  }
}

interface DecisionBody {
  leadId?: unknown;
  action?: unknown; // "approve" | "reject" | "contacted"
}

export async function POST(request: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { error: "Dostop samo za skrbnike (DSA_ADMIN_EMAILS)." },
      { status: 403 }
    );
  }

  let body: DecisionBody;
  try {
    body = (await request.json()) as DecisionBody;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  const action = body.action;
  if (!leadId || (action !== "approve" && action !== "reject" && action !== "contacted")) {
    return NextResponse.json({ error: "Manjka leadId ali dejanje." }, { status: 400 });
  }

  try {
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.interest !== "partner") {
      return NextResponse.json({ error: "Prijava ne obstaja." }, { status: 404 });
    }
    const nextStatus =
      action === "approve" ? "approved" : action === "reject" ? "rejected" : "contacted";

    if (action === "approve") {
      const user = await db.user.findUnique({ where: { email: lead.email } });
      if (!user) {
        return NextResponse.json(
          {
            error:
              "Uporabnik s to e-pošto še nima računa — naj se najprej registrira (prijava je shranjena).",
          },
          { status: 409 }
        );
      }
      await db.$transaction([
        db.user.update({ where: { id: user.id }, data: { role: "partner" } }),
        db.lead.update({ where: { id: lead.id }, data: { status: "approved" } }),
        db.auditLog.create({
          data: {
            actorType: "owner",
            actorId: (await getSessionContext())?.email ?? "admin",
            action: "partner.approved",
            entityType: "user",
            entityId: user.id,
            meta: JSON.stringify({ leadId: lead.id, email: lead.email }),
          },
        }),
      ]);
      return NextResponse.json({ ok: true, status: "approved", role: "partner" });
    }

    await db.$transaction([
      db.lead.update({ where: { id: lead.id }, data: { status: nextStatus } }),
      db.auditLog.create({
        data: {
          actorType: "owner",
          actorId: (await getSessionContext())?.email ?? "admin",
          action: `partner.${action === "reject" ? "rejected" : "contacted"}`,
          entityType: "lead",
          entityId: lead.id,
          meta: JSON.stringify({ status: nextStatus }),
        },
      }),
    ]);
    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (err) {
    console.error("[api/admin/leads] POST napaka:", err);
    return NextResponse.json({ error: "Odločitev ni uspela." }, { status: 500 });
  }
}
