import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/trip-auth";
import {
  isPersonalizationOff,
  preferenceKeyIsValid,
  validatePreferenceValue,
  type PreferenceKey,
} from "@/lib/user-preferences";
import {
  PERSONAL_AUDIT_ACTIONS,
  writePersonalAudit,
} from "@/lib/user-preferences-server";

/**
 * /api/preferences — P1-A §1 (issue #3): uporabniške potovalne preference.
 * ============================================================================
 * GET    → lastnikov seznam (401 za goste) + stanje personalizacije.
 * PUT    → upsert enega ključa {key, value} — vedno source USER_STATED,
 *          vrednost validirana strežniško proti fiksni množici.
 * DELETE → ?key=… (idempotentno briše zapis).
 *
 * IDOR: dostop IZKLJUČNO prek session userId — where pogoji vedno nosijo
 * userId; ključ zapisa je par (userId, key), zato tuji zapisi niso
 * dosegljivi niti po ugibanju. Revizija: AuditLog (append-only) na vsaki
 * spremembi. Rate limit: 30/min (pomnilniška mreža z varovalko 5000).
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
    { error: "Za upravljanje profila se prijavi." },
    { status: 401 }
  );
}

// ── GET: lastnikov seznam preferenc ────────────────────────────────────────

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return guest();

  try {
    const rows = await db.userPreference.findMany({ where: { userId } });
    return NextResponse.json({
      preferences: rows
        .map((r) => ({
          key: r.key,
          value: r.value,
          source: r.source,
          updatedAt: r.updatedAt.toISOString(),
        }))
        .sort((a, b) => a.key.localeCompare(b.key)),
      personalization: isPersonalizationOff(rows) ? "off" : "on",
    });
  } catch (err) {
    console.error("[api/preferences] GET napaka:", err);
    return NextResponse.json(
      { error: "Branje preferenc ni uspelo." },
      { status: 500 }
    );
  }
}

// ── PUT: upsert ene preference ─────────────────────────────────────────────

export async function PUT(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return guest();
  if (rateLimited(request)) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusi znova čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: { key?: unknown; value?: unknown };
  try {
    body = (await request.json()) as { key?: unknown; value?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Neveljaven zahtevek (JSON)." },
      { status: 400 }
    );
  }

  if (!preferenceKeyIsValid(body.key)) {
    return NextResponse.json(
      { error: "Neveljaven ključ preference." },
      { status: 400 }
    );
  }
  const key = body.key as PreferenceKey;
  const validated = validatePreferenceValue(key, body.value);
  if (!validated.ok) {
    return NextResponse.json(
      {
        error: validated.error,
        ...(validated.allowed ? { allowed: validated.allowed } : {}),
      },
      { status: 400 }
    );
  }

  try {
    const saved = await db.userPreference.upsert({
      where: { userId_key: { userId, key } },
      update: { value: validated.canonical, source: "USER_STATED" },
      create: {
        userId,
        key,
        value: validated.canonical,
        source: "USER_STATED",
      },
    });

    await writePersonalAudit({
      userId,
      action: PERSONAL_AUDIT_ACTIONS.preferenceUpdated,
      entityId: saved.id,
      meta: { key, source: "USER_STATED" },
    });

    return NextResponse.json({ ok: true, key, value: validated.canonical });
  } catch (err) {
    console.error("[api/preferences] PUT napaka:", err);
    return NextResponse.json(
      { error: "Shranjevanje preference ni uspelo." },
      { status: 500 }
    );
  }
}

// ── DELETE: idempotenten izbris ene preference ─────────────────────────────

export async function DELETE(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return guest();

  const key = new URL(request.url).searchParams.get("key");
  if (!preferenceKeyIsValid(key)) {
    return NextResponse.json(
      { error: "Neveljaven ključ preference." },
      { status: 400 }
    );
  }

  try {
    const deleted = await db.userPreference.deleteMany({
      where: { userId, key },
    });
    if (deleted.count > 0) {
      await writePersonalAudit({
        userId,
        action: PERSONAL_AUDIT_ACTIONS.preferenceDeleted,
        entityId: `${userId}:${key}`,
        meta: { key },
      });
    }
    return NextResponse.json({ ok: true, deleted: deleted.count > 0 });
  } catch (err) {
    console.error("[api/preferences] DELETE napaka:", err);
    return NextResponse.json(
      { error: "Brisanje preference ni uspelo." },
      { status: 500 }
    );
  }
}
