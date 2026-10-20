import { describe, expect, test } from 'bun:test';
import { createRateLimiter } from '../src/lib/rate-limit';

describe('createRateLimiter — omejevanje zahtev', () => {
  test('dovoli do limita, nato zavrne z retryAfter', () => {
    const check = createRateLimiter({ limit: 3, windowMs: 60_000 });
    const now = 1_000_000;
    expect(check('ip', now).ok).toBe(true);
    expect(check('ip', now + 1).ok).toBe(true);
    expect(check('ip', now + 2).ok).toBe(true);
    const blocked = check('ip', now + 3);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  test('okno se resetira po preteku', () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1_000 });
    expect(check('ip', 0).ok).toBe(true);
    expect(check('ip', 1).ok).toBe(false);
    expect(check('ip', 1_001).ok).toBe(true);
  });

  test('ključi so neodvisni', () => {
    const check = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(check('a', 0).ok).toBe(true);
    expect(check('b', 0).ok).toBe(true);
    expect(check('a', 1).ok).toBe(false);
  });
});
