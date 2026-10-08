import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId, getTripContext } from "@/lib/trip-auth";
import {
  WATCH_AUDIT_ACTIONS,
  WATCH_KIND_LABELS,
  WATCH_MAX_PER_USER,
  sortWatchesForList,
  validateWatchInput,
} from "@/lib/watch-engine";
import { writeWatchAudit } from "@/lib/watch-server";

/**
 * /api/watch — P1-C §4 (issue #3): uporabnikova spremljanja (watch).
 * ============================================================================
 * GET  → lastnikov seznam (401 za goste) z oznakami vrst (deterministično
 *        urejeno: updatedAt DESC, id DESC).
 * POST → ustvari spremljanje {kind, targetKind, targetId, condition?}.
 *
 * Pravila:
 *  - vrsta je iz FIKSNE množice; znane ZAVRŽENE vrste (availability, flight)
 *    → 400 z iskrenim razlogom (vir ne potrjuje — ne lažemo);
 *  - cilj mora OBSTOJATI strežniško: izdelek (slug tržnice) oz. pote
 *    (shareId) z vlogo ≥ VIEWER (zasebnost §11 — tujih pote ne spremljaš);
 *  - ime cilja zapiše STREŽNIK (snapshot) — klient ne more podtakniti imena;
 *  - zgornja meja WATCH_MAX_PER_USER spremljanj na uporabnika (bounded);
 *  - podvojen (isti kind+target) → 409 z obstoječim zapisom (idempotentno);
 *  - IDOR: dostop IZKLJUČNO prek session userId; where pogoji vedno nosijo
 *    userId. Revizija: AuditLog (append-only). Rate limit: 30/min.
 */

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function allowRequest(key: string, now: number): boolean {
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    if (rateBuckets.size > 5_000) rateBuckets.clear();
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT;
}

function rateLimited(request: Request): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return !allowRequest(ip, Date.now());
}

function guest(): NextResponse {
  return NextResponse.json(
    { error: "Za spremljanje se prijavi." },
    { status: 401 }
  );
}

// ── GET: lastnikov seznam spremljanj ────────────────────────────────────────

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return guest();

  try {
    const rows = await db.watchItem.findMany({ where: { userId } });
    return NextResponse.json({
      watches: sortWatchesForList(rows).map((r) => ({
        id: r.id,
        kind: r.kind,
        kindLabel:
          WATCH_KIND_LABELS[r.kind as keyof typeof WATCH_KIND_LABELS] ??
          { sl: r.kind, en: r.kind },
        targetKind: r.targetKind,
        targetId: r.targetId,
        targetName: r.targetName,
        condition: r.condition,
        state: r.state,
        lastObservation: r.lastObservation,
        lastCheckedAt: r.lastCheckedAt?.toISOString() ?? null,
        lastTriggeredAt: r.lastTriggeredAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      max: WATCH_MAX_PER_USER,
    });
  } catch (err) {
    console.error("[api/watch] GET napaka:", err);
    return NextResponse.json(
      { error: "Branje spremljanj ni uspelo." },
      { status: 500 }
    );
  }
}

// ── POST: ustvari spremljanje ───────────────────────────────────────────────

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return guest();
  if (rateLimited(request)) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusi znova čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: {
    kind?: unknown;
    targetKind?: unknown;
    targetId?: unknown;
    condition?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Neveljaven zahtevek (JSON)." },
      { status: 400 }
    );
  }

  const validated = validateWatchInput({
    kind: body.kind,
    targetKind: body.targetKind,
    targetId: body.targetId,
    condition: body.condition,
  });
  if (!validated.ok) {
    return NextResponse.json(
      {
        error: validated.error,
        ...(validated.allowed ? { allowed: validated.allowed } : {}),
      },
      { status: 400 }
    );
  }
  const { kind, targetKind, condition } = validated;
  const targetId = (body.targetId as string).trim().slice(0, 120);

  try {
    // Cilj mora obstajati STREŽNIŠKO (ime cilja zapiše strežnik).
    let targetName: string;
    if (targetKind === "product") {
      const product = await db.product.findUnique({
        where: { slug: targetId },
        select: { name: true, active: true, status: true },
      });
      if (!product || !product.active || product.status !== "published") {
        return NextResponse.json(
          { error: "Ta izdelek trenutno ni na voljo v tržnici." },
          { status: 400 }
        );
      }
      targetName = product.name;
    } else {
      // journey: pot + vloga ≥ VIEWER (zasebnost §11).
      const ctx = await getTripContext(targetId);
      if (!ctx || ctx.role === "NONE") {
        return NextResponse.json(
          { error: "Ta pot ne obstaja ali ni dostopna tvojemu računu." },
          { status: 400 }
        );
      }
      targetName = ctx.journey.title;
    }

    // Zgornja meja na uporabnika (bounded — brez neomejenosti).
    const count = await db.watchItem.count({ where: { userId } });
    if (count >= WATCH_MAX_PER_USER) {
      return NextResponse.json(
        {
          error: `Doseženih je največ ${WATCH_MAX_PER_USER} spremljanj — katero od obstoječih najprej odstrani.`,
        },
        { status: 400 }
      );
    }

    // Podvojenost → 409 z obstoječim zapisom (idempotentno vozlišče).
    const existing = await db.watchItem.findUnique({
      where: {
        userId_kind_targetKind_targetId: {
          userId,
          kind,
          targetKind,
          targetId,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "To že spremljaš (ista vrsta in isti cilj).",
          existing: { id: existing.id, state: existing.state },
        },
        { status: 409 }
      );
    }

    const created = await db.watchItem.create({
      data: { userId, kind, targetKind, targetId, targetName, condition },
    });

    await writeWatchAudit({
      actorType: "customer",
      actorId: userId,
      action: WATCH_AUDIT_ACTIONS.watchCreated,
      entityType: "watch",
      entityId: created.id,
      meta: { kind, targetKind, targetId },
    });

    return NextResponse.json(
      {
        ok: true,
        watch: {
          id: created.id,
          kind: created.kind,
          targetKind: created.targetKind,
          targetId: created.targetId,
          targetName: created.targetName,
          condition: created.condition,
          state: created.state,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/watch] POST napaka:", err);
    return NextResponse.json(
      { error: "Ustvarjanje spremljanja ni uspelo." },
      { status: 500 }
    );
  }
}
