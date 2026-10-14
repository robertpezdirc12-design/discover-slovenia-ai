import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { isAdminSession } from "@/lib/affiliate-server";
import { getSessionContext } from "@/lib/partner-session";
import type { ProviderStatus } from "@/lib/provider-model";
import {
  isProviderAction,
  isProviderReportAction,
  isProviderStatus,
  providerAuditAction,
  providerStatusAfter,
} from "@/lib/provider-moderation";

export const dynamic = "force-dynamic";

/**
 * /api/admin/providers — moderacija ponudniških profilov (#35 faza 4b).
 *
 *  GET  ?status=draft|published|suspended (privzeto draft)
 *       → vrsta profilov + odprte prijave napak (števec); counts po statusih.
 *  POST → skrbniška odločitev:
 *        · { providerId, action: publish|unpublish|suspend|verify, reason? }
 *          — verify: verification → "verified" + verifiedAt (dokaz §6c.1–2);
 *          · { reportId, action: resolve|dismiss }
 *          — prijava napake: open → resolved|dismissed (spor, ne resnica).
 *
 * Vrata: isAdminSession (DSA_ADMIN_EMAILS) → 403 fail-closed (vzorec
 * /api/admin/listings). AuditLog na vsaki odločitvi (actorType "owner").
 * Podrobnost napake baze NE gre k odjemalcu (P0 AUDIT L1).
 */

const MAX_ROWS = 100;

function parseStatus(value: string | null): ProviderStatus {
  if (value === "published" || value === "suspended" || value === "draft") return value;
  return "draft";
}

export async function GET(request: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { error: "Dostop samo za skrbnike (DSA_ADMIN_EMAILS)." },
      { status: 403 }
    );
  }
  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get("status"));

  try {
    const providers = await db.provider.findMany({
      where: { status },
      orderBy: { createdAt: "asc" },
      take: MAX_ROWS,
    });

    const ids = providers.map((p) => p.id);
    const openReports = ids.length
      ? await db.providerReport.findMany({
          where: { providerId: { in: ids }, status: "open" },
          orderBy: { createdAt: "asc" },
          take: MAX_ROWS,
        })
      : [];

    const openByProvider = new Map<string, number>();
    for (const r of openReports) {
      openByProvider.set(r.providerId, (openByProvider.get(r.providerId) ?? 0) + 1);
    }

    const counts = await db.provider.groupBy({ by: ["status"], _count: { _all: true } });
    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[c.status] = c._count._all;

    return NextResponse.json({
      status,
      counts: countMap,
      openReportsTotal: openReports.length,
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        countryCode: p.countryCode,
        region: p.region,
        place: p.place,
        lat: p.lat,
        lng: p.lng,
        category: p.category,
        subcategory: p.subcategory,
        description: p.description,
        languages: p.languages,
        officialUrl: p.officialUrl,
        priceFrom: p.priceFrom,
        currency: p.currency,
        bookingMode: p.bookingMode,
        verification: p.verification,
        verifiedAt: p.verifiedAt?.toISOString() ?? null,
        sourceName: p.sourceName,
        dedupKey: p.dedupKey,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        openReports: openByProvider.get(p.id) ?? 0,
      })),
      reports: openReports.map((r) => ({
        id: r.id,
        providerId: r.providerId,
        reason: r.reason,
        message: r.message,
        email: r.email,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[api/admin/providers] GET napaka:", err);
    return NextResponse.json({ error: "Vrsta trenutno ni dosegljiva." }, { status: 500 });
  }
}

interface DecisionBody {
  providerId?: unknown;
  reportId?: unknown;
  action?: unknown;
  reason?: unknown;
}

/** E-pošta skrbnika iz seje (za AuditLog) — vzorec /api/admin/listings. */
async function getAdminEmail(): Promise<string | null> {
  const ctx = await getSessionContext();
  return ctx?.email ?? null;
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

  const action = body.action;
  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 500)
      : null;
  const providerId = typeof body.providerId === "string" ? body.providerId : "";
  const reportId = typeof body.reportId === "string" ? body.reportId : "";

  // ── Dejanje na profilu ponudnika ────────────────────────────────────────
  if (isProviderAction(action)) {
    if (!providerId) {
      return NextResponse.json({ error: "Manjka providerId." }, { status: 400 });
    }
    try {
      const provider = await db.provider.findUnique({ where: { id: providerId } });
      if (!provider) {
        return NextResponse.json({ error: "Profil ne obstaja." }, { status: 404 });
      }
      if (!isProviderStatus(provider.status)) {
        // Varovalka: tuj status v bazi nikoli ne gre skozi prehode.
        return NextResponse.json({ error: "Profil ima neznan status." }, { status: 409 });
      }
      const from: ProviderStatus = provider.status;
      const to = providerStatusAfter(from, action);
      if (to === null) {
        return NextResponse.json(
          { error: `Prehod ${from} + ${action} ni dovoljen.` },
          { status: 409 }
        );
      }

      const adminEmail = (await getAdminEmail()) ?? "admin";
      await db.$transaction(async (tx) => {
        const data: Prisma.ProviderUpdateInput = { updatedAt: new Date() };
        if (action === "verify") {
          data.verification = "verified";
          data.verifiedAt = new Date(); // 12-mesečni potek računa verificationState
        } else {
          data.status = to;
        }
        await tx.provider.update({ where: { id: provider.id }, data });
        await tx.auditLog.create({
          data: {
            actorType: "owner",
            actorId: adminEmail,
            action: providerAuditAction(from, action),
            entityType: "provider",
            entityId: provider.id,
            meta: JSON.stringify({
              from,
              to: action === "verify" ? from : to,
              verification: action === "verify" ? "verified" : provider.verification,
              reason,
            }),
          },
        });
      });

      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (err) {
      console.error("[api/admin/providers] POST provider napaka:", err);
      return NextResponse.json({ error: "Dejanje ni uspelo — poskusi pozneje." }, { status: 500 });
    }
  }

  // ── Dejanje na prijavi napake (§6c.4) ───────────────────────────────────
  if (isProviderReportAction(action)) {
    if (!reportId) {
      return NextResponse.json({ error: "Manjka reportId." }, { status: 400 });
    }
    try {
      const report = await db.providerReport.findUnique({ where: { id: reportId } });
      if (!report) {
        return NextResponse.json({ error: "Prijava ne obstaja." }, { status: 404 });
      }
      if (report.status !== "open") {
        return NextResponse.json(
          { error: `Prijava je že obdelana (${report.status}).` },
          { status: 409 }
        );
      }

      const adminEmail = (await getAdminEmail()) ?? "admin";
      await db.$transaction(async (tx) => {
        await tx.providerReport.update({
          where: { id: report.id },
          data: { status: action === "resolve" ? "resolved" : "dismissed" },
        });
        await tx.auditLog.create({
          data: {
            actorType: "owner",
            actorId: adminEmail,
            action: `provider_report.${action}`,
            entityType: "provider_report",
            entityId: report.id,
            meta: JSON.stringify({ providerId: report.providerId, reason }),
          },
        });
      });

      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (err) {
      console.error("[api/admin/providers] POST report napaka:", err);
      return NextResponse.json({ error: "Dejanje ni uspelo — poskusi pozneje." }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Manjka veljavno dejanje (publish|unpublish|suspend|verify ali resolve|dismiss)." },
    { status: 400 }
  );
}
