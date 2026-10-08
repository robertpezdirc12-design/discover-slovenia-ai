import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/trip-auth";
import {
  NOTIFICATION_LIST_MAX,
  WATCH_AUDIT_ACTIONS,
  sortNotificationsForList,
} from "@/lib/watch-engine";
import { writeWatchAudit } from "@/lib/watch-server";

/**
 * /api/notifications — P1-C §10 (issue #3): notifikacijski center (in-app).
 * ============================================================================
 * GET    → lastnikova obvestila (bounded NOTIFICATION_LIST_MAX; ?unreadOnly=1
 *          izbere samo neprebrana) + unreadCount (za zvonček).
 * PATCH  → {id} označi ENO prebrano | {all: true} označi VSE prebrano.
 * DELETE → ?read=1 počisti PREBRANA | brez parametra počisti VSE svoje.
 *
 * IDOR (§11): vse poizvedbe nosijo userId (seja) — tuja obvestila so
 * nedosegljiva. DedupeKey je unique na uporabnika (cron idempotenca);
 * PWA push NI implementiran (iskrena odločitev — plast je in-app inbox).
 * Rate limit: 60/min na mutacije.
 */

const RATE_LIMIT = 60;
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
    { error: "Za obvestila se prijavi." },
    { status: 401 }
  );
}

// ── GET: seznam obvestil + števec neprebranih (?summary=1 → samo števec) ───

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return guest();

  const params = new URL(request.url).searchParams;
  const summaryOnly = params.get("summary") === "1";
  const unreadOnly = params.get("unreadOnly") === "1";

  try {
    if (summaryOnly) {
      // Lahka veja za zvonček v glavi (samo števec, brez vrstic).
      const unreadCount = await db.notification.count({
        where: { userId, readAt: null },
      });
      return NextResponse.json({ unreadCount });
    }

    const [rows, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: NOTIFICATION_LIST_MAX, // bounded retrieval
      }),
      db.notification.count({ where: { userId, readAt: null } }),
    ]);

    return NextResponse.json({
      notifications: sortNotificationsForList(rows).map((n) => ({
        id: n.id,
        source: n.source,
        severity: n.severity,
        title: n.title,
        body: n.body,
        data: n.data,
        readAt: n.readAt?.toISOString() ?? null,
        dedupeKey: n.dedupeKey,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
      max: NOTIFICATION_LIST_MAX,
    });
  } catch (err) {
    console.error("[api/notifications] GET napaka:", err);
    return NextResponse.json(
      { error: "Branje obvestil ni uspelo." },
      { status: 500 }
    );
  }
}

// ── PATCH: označi prebrano (eno ali vse) ────────────────────────────────────

export async function PATCH(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return guest();
  if (rateLimited(request)) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusi znova čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: { id?: unknown; all?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Neveljaven zahtevek (JSON)." },
      { status: 400 }
    );
  }

  try {
    if (body.all === true) {
      const updated = await db.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });
      if (updated.count > 0) {
        await writeWatchAudit({
          actorType: "customer",
          actorId: userId,
          action: WATCH_AUDIT_ACTIONS.notificationReadAll,
          entityType: "notification",
          entityId: `user:${userId}`,
          meta: { count: updated.count },
        });
      }
      return NextResponse.json({ ok: true, markedRead: updated.count });
    }

    if (typeof body.id !== "string" || body.id.length === 0) {
      return NextResponse.json(
        { error: "Pričakovan id obvestila ali all: true." },
        { status: 400 }
      );
    }

    // IDOR: {id, userId} — tuje obvestilo je 404 (ne razkrijemo obstoja).
    const existing = await db.notification.findFirst({
      where: { id: body.id, userId },
      select: { id: true, readAt: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "To obvestilo ne obstaja." },
        { status: 404 }
      );
    }
    if (existing.readAt !== null) {
      return NextResponse.json({ ok: true, markedRead: 0 }); // idempotentno
    }

    const updated = await db.notification.updateMany({
      where: { id: body.id, userId, readAt: null },
      data: { readAt: new Date() },
    });

    await writeWatchAudit({
      actorType: "customer",
      actorId: userId,
      action: WATCH_AUDIT_ACTIONS.notificationRead,
      entityType: "notification",
      entityId: body.id,
      meta: {},
    });

    return NextResponse.json({ ok: true, markedRead: updated.count });
  } catch (err) {
    console.error("[api/notifications] PATCH napaka:", err);
    return NextResponse.json(
      { error: "Označevanje prebranega ni uspelo." },
      { status: 500 }
    );
  }
}

// ── DELETE: počisti (prebrana ali vse — lastnikove) ─────────────────────────

export async function DELETE(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return guest();
  if (rateLimited(request)) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusi znova čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const readOnly = new URL(request.url).searchParams.get("read") === "1";

  try {
    const deleted = await db.notification.deleteMany({
      where: {
        userId,
        ...(readOnly ? { readAt: { not: null } } : {}),
      },
    });

    if (deleted.count > 0) {
      await writeWatchAudit({
        actorType: "customer",
        actorId: userId,
        action: WATCH_AUDIT_ACTIONS.notificationCleared,
        entityType: "notification",
        entityId: `user:${userId}`,
        meta: { count: deleted.count, scope: readOnly ? "read" : "all" },
      });
    }

    return NextResponse.json({ ok: true, deleted: deleted.count });
  } catch (err) {
    console.error("[api/notifications] DELETE napaka:", err);
    return NextResponse.json(
      { error: "Čiščenje obvestil ni uspelo." },
      { status: 500 }
    );
  }
}
