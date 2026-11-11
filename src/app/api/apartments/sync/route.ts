import { NextResponse } from 'next/server';
import { getSyncProgress, startAjpesSyncInBackground } from '@/lib/apartments-sync';

/**
 * API: usklajevanje uradnega registra ponudnikov prenočitev (AJPES PRS).
 *
 * POST /api/apartments/sync
 *   → 200 { ok:true, started, progress } — potek gre V OZADJU (geokodiranje
 *     uradnih naslovov ≤ 1 zahteva/s, lahko traja do eno uro), odgovor je takoj.
 *
 * GET /api/apartments/sync
 *   → 200 { ok:true, progress } — trenutni napredek (faza, done/total, napake).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const progress = startAjpesSyncInBackground();
    return NextResponse.json({
      ok: true,
      started: progress.running,
      progress,
    });
  } catch (error) {
    console.error('POST /api/apartments/sync napaka:', error);
    return NextResponse.json(
      { ok: false, error: 'Usklajevanja ni bilo mogoče začeti.' },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, progress: getSyncProgress() });
  } catch (error) {
    console.error('GET /api/apartments/sync napaka:', error);
    return NextResponse.json({ ok: false, error: 'Stanja ni bilo mogoče prebrati.' }, { status: 500 });
  }
}
