import { NextRequest, NextResponse } from 'next/server';
import { clientKey, sessionLimiter } from '@/lib/rate-limit';
import { isSameOriginRequest } from '@/lib/request-origin';
import { revokeSessionToken } from '@/lib/session';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-token';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * DELETE /api/session — odjava iz trenutnega brskalnika.
 *
 * Prekliče samo sejo v tem brskalniku; profil ostane shranjen in ga je z
 * e-poštno prijavo mogoče obnoviti. Izbris profila je ločen na
 * DELETE /api/account.
 */
export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, error: 'Odjava je dovoljena samo z iste domene.' },
      { status: 403, headers: NO_STORE },
    );
  }

  const limit = sessionLimiter(clientKey(request));
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: 'Preveč zahtev — poskusi znova čez minuto.' },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  try {
    if (token) await revokeSessionToken(token);
  } catch (err) {
    console.error('session: odjava ni uspela', err);
    return NextResponse.json(
      { ok: false, error: 'Odjava trenutno ni mogoča. Poskusi znova.' },
      { status: 503, headers: NO_STORE },
    );
  }

  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
