import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/trip-auth";
import {
  MEMORY_KINDS,
  memoryConfidenceForSource,
  validateMemoryInput,
  isPersonalizationOff,
  sortMemoriesForList,
  MEMORY_LIST_LIMIT,
} from "@/lib/user-preferences";
import {
  PERSONAL_AUDIT_ACTIONS,
  purgeExpiredMemories,
  writePersonalAudit,
} from "@/lib/user-preferences-server";

/**
 * /api/memory — P1-A §2 (issue #3): dolgoročni spomin „Kaj si zapomnim
 * o tebi".
 * ============================================================================
 * GET    → lastnikov bounded seznam (401 gosti) + lenko retention čiščenje.
 * POST   → nov zapis {kind, value} — ZAVRNJENO, kadar je personalizacija
 *          izklopljena (ne zbiramo ničesar novega); poskus navodil za AI
 *          (injection) se odkrito zavrne, vsebina se NE shranjuje.
 * DELETE → ?confirm=forget-all — pozabi VSE (mehko; fizično po 90 dneh).
 *          Deluje TUDI pri izklopljeni personalizaciji (pravica izbrisa).
 *
 * IDOR: where pogoji vedno nosijo userId. Upravaljalna pot: lastnik vidi
 * svoje zapise tudi pri izklopu (da jih lahko izbriše); AGENTSKA pot
 * (getPersonalContext) pri izklopu spomina sploh ne bere — fail-closed.
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

// ── GET: bounded seznam + lenko retention čiščenje ─────────────────────────

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return guest();

  try {
    // Lenko zadrževalno čiščenje (mehko izbrisani > 90 dni → fizično izbris).
    const purged = await purgeExpiredMemories(userId, new Date());
    if (purged > 0) {
      await writePersonalAudit({
        userId,
        action: PERSONAL_AUDIT_ACTIONS.memoryPurged,
        entityId: `${userId}:retention`,
        meta: { purged },
      });
    }

    const [rows, prefRows] = await Promise.all([
      db.memoryItem.findMany({ where: { userId, active: true } }),
      db.userPreference.findMany({ where: { userId } }),
    ]);
    const off = isPersonalizationOff(prefRows);

    return NextResponse.json({
      personalization: off ? "off" : "on",
      memories: sortMemoriesForList(rows)
        .slice(0, MEMORY_LIST_LIMIT)
        .map((r) => ({
          id: r.id,
          kind: r.kind,
          value: r.value,
          source: r.source,
          confidence: r.confidence,
          updatedAt: r.updatedAt.toISOString(),
        })),
      kinds: MEMORY_KINDS,
      note: off
        ? "Personalizacija je izklopljena — zapisi se ne uporabljajo pri načrtovanju. Videti jih moraš, da jih lahko izbrišeš."
        : "Zapisi se uporabljajo samo zate (nikoli v skupinskih klepetih).",
    });
  } catch (err) {
    console.error("[api/memory] GET napaka:", err);
    return NextResponse.json(
      { error: "Branje spomina ni uspelo." },
      { status: 500 }
    );
  }
}

// ── POST: nov zapis spomina (blokiran pri izklopu) ─────────────────────────

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return guest();
  if (rateLimited(request)) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusi znova čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
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

  // Vrata zbiranja: izklopljena personalizacija → NOVE zapise NE sprejemamo.
  const prefRows = await db.userPreference.findMany({ where: { userId } });
  if (isPersonalizationOff(prefRows)) {
    return NextResponse.json(
      {
        error:
          "Personalizacija je izklopljena — nove zapise ne zbiramo. Vklopi jo zgoraj, če želiš dodati zapis.",
      },
      { status: 403 }
    );
  }

  const validated = validateMemoryInput(body);
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error, injection: validated.injection },
      { status: 400 }
    );
  }

  try {
    const created = await db.memoryItem.create({
      data: {
        userId,
        kind: validated.kind,
        value: validated.value,
        source: "USER",
        confidence: memoryConfidenceForSource("USER"),
        active: true,
      },
    });

    await writePersonalAudit({
      userId,
      action: PERSONAL_AUDIT_ACTIONS.memoryCreated,
      entityId: created.id,
      meta: { kind: created.kind, source: "USER" },
    });

    return NextResponse.json(
      {
        ok: true,
        memory: {
          id: created.id,
          kind: created.kind,
          value: created.value,
          source: created.source,
          confidence: created.confidence,
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/memory] POST napaka:", err);
    return NextResponse.json(
      { error: "Shranjevanje zapisa ni uspelo." },
      { status: 500 }
    );
  }
}

// ── DELETE: pozabi vse (mehko) — deluje tudi pri izklopu ──────────────────

export async function DELETE(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return guest();

  const confirm = new URL(request.url).searchParams.get("confirm");
  if (confirm !== "forget-all") {
    return NextResponse.json(
      {
        error:
          "Za pozabo vseh zapisov uporabi ?confirm=forget-all (zaščita pred nenamernim brisanjem).",
      },
      { status: 400 }
    );
  }

  try {
    const result = await db.memoryItem.updateMany({
      where: { userId, active: true },
      data: { active: false },
    });

    await writePersonalAudit({
      userId,
      action: PERSONAL_AUDIT_ACTIONS.memoryForgetAll,
      entityId: `${userId}:forget-all`,
      meta: { forgotten: result.count },
    });

    return NextResponse.json({
      ok: true,
      forgotten: result.count,
      note: `Pozabljenih ${result.count} zapisov. Fizično se pobrišejo po 90 dneh (zadrževalna doba).`,
    });
  } catch (err) {
    console.error("[api/memory] DELETE napaka:", err);
    return NextResponse.json(
      { error: "Pozaba vseh zapisov ni uspela." },
      { status: 500 }
    );
  }
}
