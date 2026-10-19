import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sanitizeGuideState } from '@/lib/guide-store';
import {
  generateTripCode,
  isShareable,
  sharedTripPayload,
} from '@/lib/share-trip';

/**
 * POST /api/pot/share — ustvari deljeno pot (/pot/[koda]).
 *
 * Vhod: { state: GuideState } (iz localStorage; strežnik ga SAM sanitizira —
 * klientu se ne sme zaupati). Izhod: { ok, id, url }.
 * Neveljavno/prazno stanje → 400 (nič ne nastane; UI pokaže razlago).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Neveljavna zahteva — pričakovan JSON.' },
      { status: 400 },
    );
  }

  const raw = (body as { state?: unknown } | null)?.state;
  const state = sanitizeGuideState(raw);
  if (!isShareable(state)) {
    return NextResponse.json(
      { ok: false, error: 'Pot je še prazna — najprej izberi vsaj regijo ali interese.' },
      { status: 400 },
    );
  }

  // Koda je unikatna (primarni ključ) — trk praktično nemogoč; pri trku
  // poskusimo do 3× z novo kodo.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateTripCode();
    try {
      await db.sharedTrip.create({
        data: { id: code, data: sharedTripPayload(state) },
      });
      const origin = new URL(request.url).origin;
      return NextResponse.json({ ok: true, id: code, url: `${origin}/pot/${code}` });
    } catch (err) {
      lastError = err;
    }
  }
  console.error('pot/share: ustvarjanje ni uspelo', lastError);
  return NextResponse.json(
    { ok: false, error: 'Deljenje trenutno ni na voljo — poskusi znova.' },
    { status: 500 },
  );
}
