import { NextResponse } from 'next/server';
import { syncApartments } from '@/lib/apartments-sync';

/**
 * API: ročno osveževanje apartmajev s spleta.
 *
 * POST /api/apartments/sync
 *   → 200 { ok:true, count, source, requests, failures, durationMs }
 *   → 503 { ok:false, error } (usklajevanje že poteka)
 *
 * Potek: Overpass (bogatejši vir) → Nominatim mreža (≤ 1 zahteva/s,
 * zato lahko traja nekaj minut). Odziv pride šele po koncu.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  try {
    const outcome = await syncApartments(fetch);
    return NextResponse.json({
      ok: true,
      count: outcome.persisted,
      source: outcome.source,
      requests: outcome.totalRequests,
      failures: outcome.failedRequests,
      durationMs: outcome.durationMs,
    });
  } catch (error) {
    console.error('POST /api/apartments/sync napaka:', error);
    return NextResponse.json(
      { ok: false, error: 'Usklajevanje ni uspelo. Poskusite znova kasneje.' },
      { status: 500 },
    );
  }
}
