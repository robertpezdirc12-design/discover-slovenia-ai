import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionContext } from "@/lib/partner-session";

/**
 * POST /api/partner/apply — prijava partnerja (P0-H §22).
 *
 * Prijavljeni uporabnik (katerikoli račun) pošlje prijavo → Lead z
 * interest "partner" + status "new". Odločitev (approve → User.role
 * "partner") je IZKLJUČNO skrbniška (DSA_ADMIN_EMAILS) prek /admin.
 *
 *  · brez seje → 401 (najprej se prijavi);
 *  · odprta prijava z istim e-poštnim naslovom že obstaja → 409 (iskreno);
 *  · Rate limit 5/min na odjemalca (in-memory).
 */

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function allowRequest(key: string, now: number): boolean {
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    if (rateBuckets.size > 5_000) {
      for (const [k, v] of rateBuckets) {
        if (now >= v.resetAt) rateBuckets.delete(k);
      }
    }
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT;
}

export const dynamic = "force-dynamic";

interface ApplyBody {
  note?: unknown;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(ip, Date.now())) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusi čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json(
      { error: "Najprej se prijavi (ali ustvari račun) — prijava partnerja je za registrirane." },
      { status: 401 }
    );
  }

  let body: ApplyBody;
  try {
    body = (await request.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 500)
      : null;

  try {
    const open = await db.lead.findFirst({
      where: { email: ctx.email, interest: "partner", status: { in: ["new", "contacted"] } },
      select: { id: true },
    });
    if (open) {
      return NextResponse.json(
        { error: "Prijava s tem e-poštnim naslovom že čaka na pregled." },
        { status: 409 }
      );
    }

    const lead = await db.lead.create({
      data: {
        email: ctx.email,
        interest: "partner",
        note,
        status: "new",
      },
    });

    await db.auditLog.create({
      data: {
        actorType: "customer",
        actorId: ctx.userId,
        action: "partner.applied",
        entityType: "lead",
        entityId: lead.id,
        meta: JSON.stringify({ interest: "partner" }),
      },
    });

    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      message:
        "Prijava zabeležena. Skrbnik jo pregleda; po odobritvi dobi tvoj račun vlogo partnerja.",
    });
  } catch (err) {
    console.error("[api/partner/apply] napaka:", err);
    return NextResponse.json({ error: "Prijava trenutno ni mogoča." }, { status: 500 });
  }
}
