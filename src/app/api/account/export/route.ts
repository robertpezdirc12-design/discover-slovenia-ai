import { NextRequest, NextResponse } from 'next/server';
import { buildAccountExport } from '@/lib/account-export';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { accountExportLimiter, clientKey } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * GET /api/account/export — prenos lastnih strežniških podatkov v JSON.
 * Sejni žetoni in njihovi hashi niso del izvoza.
 */
export async function GET(request: NextRequest) {
  const limit = accountExportLimiter(clientKey(request));
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: 'Preveč zahtev profila — poskusi znova čez minuto.' },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'Prijava je potrebna.' },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    const [user, profile, reservations] = await Promise.all([
      withDbTimeout(
        db.user.findUnique({
          where: { id: session.userId },
          select: { id: true, email: true, name: true, createdAt: true },
        }),
        3_000,
      ),
      withDbTimeout(
        db.userProfile.findUnique({
          where: { userId: session.userId },
          select: { guideData: true, updatedAt: true },
        }),
        3_000,
      ),
      withDbTimeout(
        db.stayReservation.findMany({
          where: { userId: session.userId },
          orderBy: { createdAt: 'asc' },
          select: {
            stayId: true,
            name: true,
            city: true,
            lat: true,
            lng: true,
            priceFrom: true,
            createdAt: true,
          },
        }),
        3_000,
      ),
    ]);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Prijava je potrebna.' },
        { status: 401, headers: NO_STORE },
      );
    }

    const payload = buildAccountExport({
      user,
      profile,
      reservations,
      exportedAt: new Date(),
    });

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        ...NO_STORE,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="discover-slovenia-podatki.json"',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('account: izvoz ni uspel', err);
    return NextResponse.json(
      { ok: false, error: 'Podatkov trenutno ni mogoče izvoziti. Poskusi znova.' },
      { status: 503, headers: NO_STORE },
    );
  }
}
