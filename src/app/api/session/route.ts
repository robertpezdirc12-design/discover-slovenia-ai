import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { normalizeDisplayName } from '@/lib/display-name';
import { clientKey, sessionLimiter } from '@/lib/rate-limit';
import { isSameOriginRequest } from '@/lib/request-origin';
import { createUserSession, getSession } from '@/lib/session';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-token';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

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

/**
 * DELETE /api/session je namerno odstranjen. Brez gesla ali e-pošte gole
 * odjave ni mogoče varno obnoviti: profil bi ostal v bazi, uporabnik pa
 * izgubil dostop. UI zato ponuja izvoz in trajni izbris profila.
 */
