import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { normalizeDisplayName } from '@/lib/display-name';
import { clientKey, sessionLimiter } from '@/lib/rate-limit';
import { createUserSession, getSession, revokeSessionToken } from '@/lib/session';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-token';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * Prepreči login/logout CSRF iz tuje domene. Brskalniki ob pošiljanju
 * pošljejo `Sec-Fetch-Site`; če ga ni (npr. curl/uptime), zahteve ne
 * blokiramo, ker ne moremo ugotoviti izvora.
 */
function isSameOriginRequest(request: NextRequest): boolean {
  const site = request.headers.get('sec-fetch-site');
  return !site || site === 'same-origin' || site === 'none';
}

/**
 * POST /api/session — ustvari demo profil + strežniško sejo.
 * Ni gesla: to ni produkcijska avtentikacija, le stabilna seja za
 * per-user rezervacije in priporočila. Pred javnim zagonom jo zamenjaj
 * z OAuth/magic link.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, error: 'Prijava je dovoljena samo z iste domene.' },
      { status: 403, headers: NO_STORE },
    );
  }

  const limit = sessionLimiter(clientKey(request));
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: 'Preveč prijav v kratkem času — poskusi znova čez minuto.' },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = normalizeDisplayName(body.name);

  try {
    const current = await getSession();
    if (current) {
      const user = await withDbTimeout(
        db.user.update({ where: { id: current.userId }, data: { name } }),
        4_000,
      );
      return NextResponse.json(
        { ok: true, user: { id: user.id, name: user.name } },
        { headers: NO_STORE },
      );
    }

    const { token, user } = await createUserSession(name);
    const res = NextResponse.json({ ok: true, user }, { headers: NO_STORE });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error('session: prijava ni uspela', err);
    return NextResponse.json(
      { ok: false, error: 'Prijava trenutno ni mogoča. Poskusi znova.' },
      { status: 503, headers: NO_STORE },
    );
  }
}

/** DELETE /api/session — prekliče sejo in počisti piškotek. */
export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, error: 'Odjava je dovoljena samo z iste domene.' },
      { status: 403, headers: NO_STORE },
    );
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionToken(token);

  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  res.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
