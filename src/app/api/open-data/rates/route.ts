import { NextResponse } from 'next/server';
import { fetchRatesChain } from '@/lib/open-data-upstream';
import { isValidRates } from '@/lib/open-data-server';

/**
 * Referenčni EUR tečaji — strežniški posrednik (odprti podatki, brez ključev).
 *
 * Vir: open.er-api.com → rezerva @fawazahmed0/currency-api (jsDelivr).
 * Pokriva balkanske valute (RSD/MKD/ALL/BAM), ki jih ECB frankfurter NIMA.
 * Predpomnilnik 6 h (tečaji se osvežujejo dnevno). Rezerva: bun storitev 3033.
 *
 * GET /api/open-data/rates
 *   → 200 { ok:true, base:'EUR', rates:{ RSD, MKD, ALL, BAM, … } }
 *   → 502 { ok:false, error }
 */

export const dynamic = 'force-dynamic';

const SERVICE_URL = 'http://127.0.0.1:3033/rates';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SERVICE_TIMEOUT_MS = 15_000;

let cached: { value: Record<string, number>; expiresAt: number } | null = null;
let inFlight: Promise<Record<string, number>> | null = null;

async function viaService(): Promise<Record<string, number>> {
  const res = await fetch(SERVICE_URL, { signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS), headers: { accept: 'application/json' } });
  const j = (await res.json()) as { ok?: boolean; rates?: unknown };
  if (!j.ok || !isValidRates(j.rates)) throw new Error('open-data-service: brez veljavnih tečajev');
  return j.rates;
}

export async function GET() {
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ok: true, base: 'EUR', rates: cached.value });
  }
  const pending = inFlight;
  if (pending) return NextResponse.json({ ok: true, base: 'EUR', rates: await pending });

  const task = (async () => {
    try {
      return await fetchRatesChain();
    } catch (directError) {
      try {
        return await viaService();
      } catch {
        throw directError;
      }
    }
  })();
  inFlight = task;
  try {
    const rates = await task;
    cached = { value: rates, expiresAt: Date.now() + CACHE_TTL_MS };
    return NextResponse.json({ ok: true, base: 'EUR', rates });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'neznan odziv vira';
    return NextResponse.json(
      { ok: false, error: `Tečaji trenutno niso na voljo (${message}).` },
      { status: 502 },
    );
  } finally {
    inFlight = null;
  }
}
