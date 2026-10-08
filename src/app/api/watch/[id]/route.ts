import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/trip-auth";
import {
  WATCH_AUDIT_ACTIONS,
  WATCH_STATES,
  validateWatchCondition,
  type WatchKind,
} from "@/lib/watch-engine";
import { writeWatchAudit } from "@/lib/watch-server";

/**
 * /api/watch/[id] — P1-C §4: urejanje/brisanje ENEGA spremljanja.
 * ============================================================================
 * PATCH   → {state: "active"|"paused"} in/ali {condition: {...}} (pragi).
 * DELETE  → fizični izbris (ni arhiva — dnevnik dejanja ostane v AuditLog).
 *
 * IDOR (§11): POIZVEDBE VEDNO nosijo {id, userId} — tuji zapis je 404
 * (ne 403; obstoj tujega spremljanja se ne razkrije). Vračilo 404 tudi ob
 * ponovnem brisanju (idempotentno za lastnika).
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
    { error: "Za urejanje spremljanj se prijavi." },
    { status: 401 }
  );
}

// ── PATCH: pavza/nadaljevanje + pragi ───────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return guest();
  if (rateLimited(request)) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusi znova čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { id } = await params;

  let body: { state?: unknown; condition?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Neveljaven zahtevek (JSON)." },
      { status: 400 }
    );
  }

  try {
    // IDOR: sestavljena poizvedba {id, userId} — tuji zapis ne obstaja (404).
    const existing = await db.watchItem.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "To spremljanje ne obstaja." },
        { status: 404 }
      );
    }

    const data: { state?: string; condition?: string } = {};

    if (body.state !== undefined) {
      if (
        typeof body.state !== "string" ||
        !(WATCH_STATES as readonly string[]).includes(body.state)
      ) {
        return NextResponse.json(
          { error: "Neveljavno stanje.", allowed: WATCH_STATES },
          { status: 400 }
        );
      }
      data.state = body.state;
    }

    if (body.condition !== undefined) {
      // Pragi preverimo PROTI VRSTI obstoječega zapisa (vrsta se ne spreminja).
      const validated = validateWatchCondition(
        existing.kind as WatchKind,
        body.condition
      );
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
      data.condition = JSON.stringify(validated.condition);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nič za spremeniti (pričakovan state ali condition)." },
        { status: 400 }
      );
    }

    const updated = await db.watchItem.updateMany({
      where: { id, userId },
      data,
    });

    await writeWatchAudit({
      actorType: "customer",
      actorId: userId,
      action:
        data.state === "paused"
          ? WATCH_AUDIT_ACTIONS.watchPaused
          : data.state === "active"
            ? WATCH_AUDIT_ACTIONS.watchResumed
            : WATCH_AUDIT_ACTIONS.watchUpdated,
      entityType: "watch",
      entityId: id,
      meta: { ...data },
    });

    return NextResponse.json({ ok: true, updated: updated.count });
  } catch (err) {
    console.error("[api/watch/[id]] PATCH napaka:", err);
    return NextResponse.json(
      { error: "Posodabljanje spremljanja ni uspelo." },
      { status: 500 }
    );
  }
}

// ── DELETE: fizični izbris (idempotenten) ───────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return guest();

  const { id } = await params;

  try {
    // IDOR: {id, userId} — tuji zapis 404; ponovni izbris lastnika idempotenten.
    const existing = await db.watchItem.findFirst({
      where: { id, userId },
      select: { id: true, kind: true, targetId: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "To spremljanje ne obstaja." },
        { status: 404 }
      );
    }

    const deleted = await db.watchItem.deleteMany({
      where: { id, userId },
    });

    if (deleted.count > 0) {
      await writeWatchAudit({
        actorType: "customer",
        actorId: userId,
        action: WATCH_AUDIT_ACTIONS.watchDeleted,
        entityType: "watch",
        entityId: id,
        meta: {
          kind: existing.kind,
          targetId: existing.targetId,
          condition: "izbrisano (fizično)",
        },
      });
    }

    return NextResponse.json({ ok: true, deleted: deleted.count > 0 });
  } catch (err) {
    console.error("[api/watch/[id]] DELETE napaka:", err);
    return NextResponse.json(
      { error: "Brisanje spremljanja ni uspelo." },
      { status: 500 }
    );
  }
}
