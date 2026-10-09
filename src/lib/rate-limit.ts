/**
 * RATE-LIMIT — skupni pomnilniški omejevalnik za API rute (P0 AUDIT M1/M2/M3/M8).
 * ============================================================================
 * Mehanično enak vzorec, kot je že živel posamično po rutah (plan-edit,
 * consultation, watch …): okno 60 s na odjemalca (XFF prva vrednost —
 * Vercel/Caddy jo postavljata), varnostna mreža 5.000 vedric, 429 +
 * Retry-After: 60.
 *
 * Iskrena meja (kot povsod): pomnilniška mreža je NA PRIMER (per instanca
 * serverless, reset ob mrzlem zagonu) — na Hobby skali zadostuje; nadgradnja
 * v skupno shrambo (Upstash/DB) je dokumentirana v docs/PRODUCT-AUDIT.md.
 */

const DEFAULT_LIMIT = 30;
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 5_000;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function allowRequest(
  key: string,
  limit = DEFAULT_LIMIT,
  now = Date.now()
): boolean {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    if (buckets.size > MAX_BUCKETS) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** Odjemalec iz zahteve (XFF prva vrednost, zamenjava za »local«). */
export function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  );
}

/** Ali je zahtevek nad mejo? (true = zavrniti s 429) */
export function rateLimited(request: Request, limit = DEFAULT_LIMIT): boolean {
  return !allowRequest(clientKey(request), limit);
}

/** Standardni 429 odziv (enako telo/glave kot povsod drugje). */
export function tooManyRequests(message = "Preveč zahtevkov — poskusi znova čez minuto."): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: { "Retry-After": "60", "Content-Type": "application/json" },
  });
}
