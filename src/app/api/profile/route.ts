import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { sanitizeGuideState } from '@/lib/guide-store';
import { clientKey, profileLimiter } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, error: 'Preveč zahtev profila — poskusi znova čez minuto.' },
    { status: 429, headers: { ...NO_STORE, 'Retry-After': String(retryAfterSeconds) } },
  );
}

/**
 * GET /api/profile — vrne shranjeni GuideState za prijavljenega uporabnika.
 * PUT /api/profile — sanitizira in shrani GuideState (localStorage → strežnik).
 *
 * Profil je vezan na sejo; brez seje → 401. Omejitev je pred branjem seje,
 * da nepreverjeni promet ne obremenjuje baze s poizvedbo seje.
 */
export async function GET(request: NextRequest) {
  const limit = profileLimiter(clientKey(request));
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSeconds);

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'Prijava je potrebna.' },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    const profile = await withDbTimeout(
      db.userProfile.findUnique({ where: { userId: session.userId } }),
      3_000,
    );
    return NextResponse.json(
      {
        ok: true,
        profile: {
          state: sanitizeGuideState(profile?.guideData ?? null),
          updatedAt: profile?.updatedAt.toISOString() ?? null,
        },
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error('profile: branje ni uspelo', err);
    return NextResponse.json(
      { ok: false, error: 'Profila trenutno ni mogoče prebrati.' },
      { status: 503, headers: NO_STORE },
    );
  }
}

export async function PUT(request: NextRequest) {
  const limit = profileLimiter(clientKey(request));
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSeconds);

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'Prijava je potrebna.' },
      { status: 401, headers: NO_STORE },
    );
  }

  const body = (await request.json().catch(() => null)) as { state?: unknown } | null;
  const state = sanitizeGuideState(body?.state);
  if (!state) {
    return NextResponse.json(
      { ok: false, error: 'Neveljavno stanje vodiča.' },
      { status: 400, headers: NO_STORE },
    );
  }

  const guideData = state as unknown as Prisma.InputJsonValue;
  try {
    const profile = await withDbTimeout(
      db.userProfile.upsert({
        where: { userId: session.userId },
        create: { userId: session.userId, guideData },
        update: { guideData },
      }),
      4_000,
    );
    return NextResponse.json(
      {
        ok: true,
        updatedAt: profile.updatedAt.toISOString(),
        state,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error('profile: shranjevanje ni uspelo', err);
    return NextResponse.json(
      { ok: false, error: 'Profila trenutno ni mogoče shraniti.' },
      { status: 503, headers: NO_STORE },
    );
  }
}
