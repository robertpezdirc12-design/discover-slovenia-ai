import { NextRequest, NextResponse } from 'next/server';
import {
  authBaseUrl,
  displayNameFromEmail,
  hashLoginToken,
} from '@/lib/auth-token';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { isSameOriginRequest } from '@/lib/request-origin';
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  generateSessionToken,
  hashSessionToken,
  sessionCookieOptions,
} from '@/lib/session-token';

export const dynamic = 'force-dynamic';

function redirectTo(path: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, authBaseUrl()), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

function invalidLink(): NextResponse {
  return redirectTo('/prijava?napaka=neveljavna');
}

/**
 * POST /api/auth/verify — zamenja enkratno povezavo za sejo.
 *
 * Povezava v e-pošti vodi na potrditveno stran, ki nato pošlje ta obrazec.
 * Tako poštni predpomnilniki in varnostni skenerji, ki samo odprejo GET
 * povezavo, ne porabijo žetona. Žeton označimo kot uporabljenega in v isti
 * transakciji ustvarimo ali poiščemo uporabnika ter novo sejo.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, error: 'Potrditev prijave je dovoljena samo z iste domene.' },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const form = await request.formData().catch(() => null);
  const rawToken = form?.get('token');
  const token = typeof rawToken === 'string' ? rawToken : '';
  if (token.length < 20 || token.length > 200 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return invalidLink();
  }

  const now = new Date();
  const tokenHash = hashLoginToken(token);

  try {
    const loginToken = await withDbTimeout(
      db.loginToken.findUnique({ where: { tokenHash } }),
      3_000,
    );

    if (
      !loginToken ||
      loginToken.usedAt !== null ||
      loginToken.expiresAt.getTime() <= now.getTime()
    ) {
      if (loginToken) {
        void db.loginToken.deleteMany({ where: { id: loginToken.id } }).catch(() => {
          /* počisti cron */
        });
      }
      return invalidLink();
    }

    const result = await withDbTimeout(
      db.$transaction(async (tx) => {
        // `updateMany` s pogojem je atomski prevzem: samo ena sočasna
        // zahteva lahko žeton označi kot uporabljenega.
        const claimed = await tx.loginToken.updateMany({
          where: {
            id: loginToken.id,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });
        if (claimed.count !== 1) return null;

        const user = await tx.user.upsert({
          where: { email: loginToken.email },
          update: {},
          create: {
            email: loginToken.email,
            name: displayNameFromEmail(loginToken.email),
          },
        });

        const sessionToken = generateSessionToken();
        await tx.session.create({
          data: {
            tokenHash: hashSessionToken(sessionToken),
            userId: user.id,
            expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
          },
        });

        // Ob uspešni prijavi razveljavimo morebitne druge povezave za isti
        // naslov; uporabnik jih ne potrebuje več.
        await tx.loginToken.deleteMany({ where: { email: loginToken.email } });

        return { sessionToken };
      }),
      6_000,
    );

    if (!result) return invalidLink();

    const response = redirectTo('/');
    response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
    return response;
  } catch (err) {
    console.error('auth: preverjanje prijavne povezave ni uspelo', err);
    return redirectTo('/prijava?napaka=streznik');
  }
}
