import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DbTimeoutError, withDbTimeout } from '@/lib/db-timeout';
import { accountDeleteLimiter, clientKey } from '@/lib/rate-limit';
import { isSameOriginRequest } from '@/lib/request-origin';
import { getSession } from '@/lib/session';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-token';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, error: 'Preveč zahtev profila — poskusi znova čez minuto.' },
    { status: 429, headers: { ...NO_STORE, 'Retry-After': String(retryAfterSeconds) } },
  );
}

function deletedResponse() {
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  res.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}

/**
 * DELETE /api/account — trajno izbriše uporabnika in vse povezane podatke.
 *
 * Kaskadno se odstranijo seje, profil in rezervacije. Lokalni vodič v
 * brskalniku ostane; uporabnik ga lahko počisti z »Začni znova« ali v
 * nastavitvah brskalnika.
 */
export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, error: 'Izbris je dovoljen samo z iste domene.' },
      { status: 403, headers: NO_STORE },
    );
  }

  const limit = accountDeleteLimiter(clientKey(request));
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSeconds);

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'Prijava je potrebna.' },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    // deleteMany ne vrže P2025, če je uporabnik medtem že izbrisan; kaskada
    // na ravni baze poskrbi za seje, profil in rezervacije.
    await withDbTimeout(db.user.deleteMany({ where: { id: session.userId } }), 4_000);
  } catch (err) {
    // Promise.race ne prekine dejanske poizvedbe. Ob timeoutu preverimo, ali
    // je brisanje vseeno uspelo, da ne javimo napake ob že izbrisanem profilu.
    if (err instanceof DbTimeoutError) {
      try {
        const stillThere = await withDbTimeout(
          db.user.findUnique({ where: { id: session.userId }, select: { id: true } }),
          2_000,
        );
        if (!stillThere) return deletedResponse();
      } catch {
        /* če tudi preverjanje ne uspe, vrni 503 */
      }
    }
    console.error('account: izbris ni uspel', err);
    return NextResponse.json(
      { ok: false, error: 'Profila trenutno ni mogoče izbrisati. Poskusi znova.' },
      { status: 503, headers: NO_STORE },
    );
  }

  return deletedResponse();
}
