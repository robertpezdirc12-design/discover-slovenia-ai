import { createHash, randomBytes } from 'node:crypto';

/**
 * Sejni žeton je naključen in se hrani SAMO v piškotku; v bazi je SHA-256
 * hash. Tako uhajanje baze ne razkrije veljavnih sej.
 */
export const SESSION_COOKIE = 'dsa_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1_000),
  };
}
