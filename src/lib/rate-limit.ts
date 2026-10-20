/**
 * Majhen rate limiter v pomnilniku (brez zunanje infrastrukture).
 *
 * Na Vercelu je pomnilnik na instanco, zato je to omejitev "best effort":
 * dovolj za zaščito pred osnovno zlorabo (npr. masovno deljenje poti ali
 * klici dragih proxyjev), ne pa globalna kvota. Za globalno kvoto uporabi
 * Upstash Redis ali podobno.
 */
export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  maxEntries?: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const maxEntries = options.maxEntries ?? 5_000;

  return function check(key: string, now: number = Date.now()): RateLimitResult {
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (hits.size >= maxEntries) {
        for (const [k, v] of hits) {
          if (v.resetAt <= now) hits.delete(k);
        }
        // če je še vedno poln, sprosti najstarejšo tretjino (groba zaščita pomnilnika)
        if (hits.size >= maxEntries) {
          let toDrop = Math.ceil(maxEntries / 3);
          for (const k of hits.keys()) {
            hits.delete(k);
            if (--toDrop <= 0) break;
          }
        }
      }
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return { ok: true, retryAfterSeconds: 0 };
    }
    if (entry.count >= options.limit) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      };
    }
    entry.count += 1;
    return { ok: true, retryAfterSeconds: 0 };
  };
}

/** IP iz zaupanja vrednih glav (Vercel nastavi x-forwarded-for). */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim() || 'unknown';
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export const sessionLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
export const profileLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
export const shareTripLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
export const reservationLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
export const photoLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
export const searchLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
export const osrmLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
