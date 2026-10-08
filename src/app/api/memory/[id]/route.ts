import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/trip-auth";
import { validateMemoryInput } from "@/lib/user-preferences";
import {
  PERSONAL_AUDIT_ACTIONS,
  writePersonalAudit,
} from "@/lib/user-preferences-server";

/**
 * /api/memory/[id] — P1-A §2 (issue #3): urejanje/brisanje ENEGA zapisa.
 * ============================================================================
 * PATCH  → {kind?, value?} (vsaj eno) — lastnik svojih zapisov.
 * DELETE → mehko brisanje (active=false; fizično po 90 dneh).
 *
 * IDOR KANON: poizvedba je VEDNO sestavljena { id, userId } — tuji zapis
 * se ne razkrije (404, ne 403 — enak kanon kot getTripForWrite). Urejanje
 * je upravaljalno dejanje (pravica popravljanja) in deluje tudi pri
 * izklopljeni personalizaciji; novo ZBIRANJE je blokirano v POST /api/memory.
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
    { error: "Za upravljanje spomina se prijavi." },
    { status: 401 }
  );
}

function badId(id: string): boolean {
  return id.length === 0 || id.length > 64;
}

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
  if (badId(id)) {
    return NextResponse.json({ error: "Neveljaven id zapisa." }, { status: 400 });
  }

  let body: { kind?: unknown; value?: unknown };
  try {
    body = (await request.json()) as { kind?: unknown; value?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Neveljaven zahtevek (JSON)." },
      { status: 400 }
    );
  }
  if (body.kind === undefined && body.value === undefined) {
    return NextResponse.json(
      { error: "Podaj vsaj kind ali value." },
      { status: 400 }
    );
  }

  // Poisci lastnikov zapis (sestavljeni where — IDOR varen, 404 za tuje).
  const existing = await db.memoryItem.findUnique({
    where: { id },
  });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json(
      { error: "Ta zapis ne obstaja." },
      { status: 404 }
    );
  }

  // Validiraj novo stanje (kind in/ali value) nad ZDRUŽENIM vhodom.
  const validated = validateMemoryInput({
    kind: body.kind === undefined ? existing.kind : body.kind,
    value: body.value === undefined ? existing.value : body.value,
  });
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error, injection: validated.injection },
      { status: 400 }
    );
  }

  try {
    const updated = await db.memoryItem.update({
      where: { id: existing.id },
      data: { kind: validated.kind, value: validated.value },
    });

    await writePersonalAudit({
      userId,
      action: PERSONAL_AUDIT_ACTIONS.memoryUpdated,
      entityId: updated.id,
      meta: { kind: updated.kind },
    });

    return NextResponse.json({
      ok: true,
      memory: {
        id: updated.id,
        kind: updated.kind,
        value: updated.value,
        source: updated.source,
        confidence: updated.confidence,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[api/memory/[id]] PATCH napaka:", err);
    return NextResponse.json(
      { error: "Posodabljanje zapisa ni uspelo." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return guest();

  const { id } = await params;
  if (badId(id)) {
    return NextResponse.json({ error: "Neveljaven id zapisa." }, { status: 400 });
  }

  try {
    // Sestavljena poizvedba { id, userId } — tuji zapis ni dosegljiv (404).
    const result = await db.memoryItem.updateMany({
      where: { id, userId, active: true },
      data: { active: false },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: "Ta zapis ne obstaja." },
        { status: 404 }
      );
    }

    await writePersonalAudit({
      userId,
      action: PERSONAL_AUDIT_ACTIONS.memoryDeleted,
      entityId: id,
      meta: {},
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/memory/[id]] DELETE napaka:", err);
    return NextResponse.json(
      { error: "Brisanje zapisa ni uspelo." },
      { status: 500 }
    );
  }
}
