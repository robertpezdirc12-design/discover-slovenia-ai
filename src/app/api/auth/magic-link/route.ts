import { NextRequest, NextResponse } from 'next/server';
import {
  LOGIN_TOKEN_TTL_MS,
  authBaseUrl,
  generateLoginToken,
  hashLoginToken,
  normalizeEmail,
} from '@/lib/auth-token';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { sendMagicLinkEmail } from '@/lib/email';
import { clientKey, magicLinkEmailLimiter, magicLinkLimiter } from '@/lib/rate-limit';
import { isSameOriginRequest } from '@/lib/request-origin';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

function tooManyRequests(retryAfterSeconds: number, error: string) {
  return NextResponse.json(
    { ok: false, error },
    { status: 429, headers: { ...NO_STORE, 'Retry-After': String(retryAfterSeconds) } },
  );
}

/**
 * POST /api/auth/magic-link — pošlje enkratno prijavno povezavo.
 *
 * Odgovor je enak za obstoječi in neobstoječi naslov, da ne razkrivamo
 * uporabnikov. V razvoju brez e-poštnega ponudnika se povezava vrne kot
 * `devLink`; v produkciji manjkajoča konfiguracija vrne 503.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, error: 'Prijava je dovoljena samo z iste domene.' },
      { status: 403, headers: NO_STORE },
    );
  }

  const ipLimit = magicLinkLimiter(clientKey(request));
  if (!ipLimit.ok) {
    return tooManyRequests(
      ipLimit.retryAfterSeconds,
      'Preveč zahtev za prijavo — poskusi znova čez minuto.',
    );
  }

  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json(
      { ok: false, error: 'Vnesi veljaven e-poštni naslov.' },
      { status: 400, headers: NO_STORE },
    );
  }

  const emailLimit = magicLinkEmailLimiter(email);
  if (!emailLimit.ok) {
    return tooManyRequests(
      emailLimit.retryAfterSeconds,
      'Preveč zahtev za ta naslov — poskusi znova kasneje.',
    );
  }

  const token = generateLoginToken();
  const tokenHash = hashLoginToken(token);
  const now = new Date();

  try {
    // Stare potekle/uporabljene povezave za isti naslov počistimo sproti.
    await withDbTimeout(
      db.loginToken.deleteMany({
        where: {
          email,
          OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }],
        },
      }),
      3_000,
    );
    await withDbTimeout(
      db.loginToken.create({
        data: {
          email,
          tokenHash,
          expiresAt: new Date(now.getTime() + LOGIN_TOKEN_TTL_MS),
        },
      }),
      3_000,
    );

    const url = new URL('/prijava/potrdi', authBaseUrl());
    url.searchParams.set('token', token);

    const sent = await sendMagicLinkEmail({ to: email, url: url.toString() });
    if (!sent.ok) {
      await withDbTimeout(db.loginToken.deleteMany({ where: { tokenHash } }), 2_000).catch(
        () => {
          /* osirotel žeton naj počisti cron */
        },
      );
      return NextResponse.json(
        {
          ok: false,
          error:
            sent.reason === 'not-configured'
              ? 'Prijava po e-pošti še ni nastavljena. Poskusi kasneje.'
              : 'Povezave trenutno ni mogoče poslati. Poskusi znova.',
        },
        { status: 503, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          'Če je naslov veljaven, smo poslali povezavo. Preveri e-pošto in vsiljeno pošto.',
        ...(sent.devLink ? { devLink: sent.devLink } : {}),
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error('auth: prijavne povezave ni bilo mogoče ustvariti', err);
    return NextResponse.json(
      { ok: false, error: 'Prijava trenutno ni mogoča. Poskusi znova.' },
      { status: 503, headers: NO_STORE },
    );
  }
}
