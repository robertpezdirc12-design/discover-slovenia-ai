import { NextResponse } from "next/server";

import {
  applyEditCommand,
  formatPlanDiff,
  parseEditCommand,
} from "@/lib/plan-edit-engine";
import { normalizePlanInput } from "@/lib/trip-auth";

/**
 * /api/plan-edit — P1-B §6 (issue #3): POGOVORNO UREJANJE NAČRTA.
 * ============================================================================
 * POST { plan, command } → { ok, plan, diff, diffText, summary }
 *
 * BREZSTANJSKA deterministična transformacija KANONSKEGA modela SharedPlan:
 *  - plan (oblika SharedPlan/deljena pot) + slovenski ukaz prideta od
 *    klienta, rezultat se VRNE klientu — NIČ se ne shranjuje v bazo
 *    (shranjevanje ostane na obstoječih poteh: načrtovalnik → lokalno /
 *    /api/trips → oblak — brez vzporednega stanja);
 *  - ukaz je SYSTEM_DATA_GUARD sanitiziran (max 200);
 *  - razveljavitev (undo) hrani KLIENT (prejšnje stanje) — motor je
 *    brezstanjski in idempotenten;
 *  - dostop JE TUDI brez prijave (načrtovalnik je gostujoča površina —
 *    plan se ne shranjuje strežniško; v bazo gre le prek obstoječih
 *    avtentikiranih poti).
 *
 * Rate limit: 30/min (pomnilniška mreža z varovalko 5000).
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

export async function POST(request: Request) {
  if (rateLimited(request)) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusi znova čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: { plan?: unknown; command?: unknown };
  try {
    body = (await request.json()) as { plan?: unknown; command?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Neveljaven zahtevek (JSON)." },
      { status: 400 }
    );
  }

  if (typeof body.command !== "string" || body.command.trim().length === 0) {
    return NextResponse.json(
      { error: "Manjka ukaz (npr. „dodaj Bled na dan 2“)." },
      { status: 400 }
    );
  }

  const parsed = parseEditCommand(body.command);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, ok: false },
      { status: 400 }
    );
  }

  const planInput = normalizePlanInput(body.plan);
  if (!planInput) {
    return NextResponse.json(
      { error: "Neveljaven načrt (pričakujem obliko deljene poti z vsaj enim dnem)." },
      { status: 400 }
    );
  }

  const applied = applyEditCommand(
    JSON.parse(planInput.data) as Parameters<typeof applyEditCommand>[0],
    parsed.command
  );
  if (!applied.ok) {
    return NextResponse.json({ error: applied.error, ok: false }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    plan: applied.plan,
    diff: applied.diff,
    diffText: formatPlanDiff(applied.diff),
    summary: applied.summary,
    note: "Sprememba še NI shranjena — shrani jo v načrtovalniku (lokalno) ali na poti v oblaku. Razveljavitev ponudi plošča urejanja.",
  });
}

export async function GET() {
  return NextResponse.json(
    { error: "Uporabi POST z { plan, command }." },
    { status: 405 }
  );
}
