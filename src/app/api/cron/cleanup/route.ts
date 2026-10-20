import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { SHARED_TRIP_TTL_MS } from '@/lib/share-trip';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const DAY_MS = 24 * 60 * 60 * 1_000;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * GET /api/cron/cleanup — dnevno čiščenje, ki ga nastavi Vercel Cron.
 *
 * 1. Odstrani deljene poti, starejše od 90 dni (TTL).
 * 2. Odstrani potekle seje.
 * 3. Odstrani demo uporabnike brez aktivne seje, ki niso bili aktivni vsaj
 *    60 dni. Brez tega bi po poteku seje ostali nedosegljivi profili.
 *
 * Ruta je zaklenjena s CRON_SECRET; brez njega vrne 503, da čiščenja ne
 * more sprožiti vsak obiskovalec.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'Čiščenje ni nastavljeno (CRON_SECRET manjka).' },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'Neavtorizirano.' },
      { status: 401, headers: NO_STORE },
    );
  }

  const now = Date.now();
  const expiredTripCutoff = new Date(now - SHARED_TRIP_TTL_MS);
  const sessionCutoff = new Date(now - 30 * DAY_MS);
  const userCutoff = new Date(now - 60 * DAY_MS);

  try {
    const [trips, sessions, users] = await Promise.all([
      withDbTimeout(
        db.sharedTrip.deleteMany({ where: { createdAt: { lt: expiredTripCutoff } } }),
        4_000,
      ),
      withDbTimeout(
        db.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
        4_000,
      ),
      withDbTimeout(
        db.user.deleteMany({
          where: {
            updatedAt: { lt: userCutoff },
            // `every` velja tudi za uporabnika brez sej; vsaka še veljavna
            // seja ga obvaruje pred brisanjem.
            sessions: { every: { expiresAt: { lt: sessionCutoff } } },
          },
        }),
        4_000,
      ),
    ]);

    return NextResponse.json(
      {
        ok: true,
        deletedSharedTrips: trips.count,
        deletedSessions: sessions.count,
        deletedUsers: users.count,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error('cron: čiščenje ni uspelo', err);
    return NextResponse.json(
      { ok: false, error: 'Čiščenje trenutno ni uspelo.' },
      { status: 503, headers: NO_STORE },
    );
  }
}
