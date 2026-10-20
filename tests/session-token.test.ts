import { describe, expect, test } from 'bun:test';
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  generateSessionToken,
  hashSessionToken,
  sessionCookieOptions,
} from '../src/lib/session-token';

describe('session-token — varna seja', () => {
  test('žeton je naključen, URL-varen in dovolj dolg', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('v bazi je hash, ne surov žeton', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
    expect(hash).not.toBe(token);
    expect(hashSessionToken(token)).toBe(hash);
  });

  test('piškotek je httpOnly, SameSite=Lax, 30 dni', () => {
    const opts = sessionCookieOptions();
    expect(SESSION_COOKIE).toBe('dsa_session');
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBe(Math.floor(SESSION_TTL_MS / 1_000));
  });
});
