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
  // Serverless (Vercel): dolgotrajnega usklajevanja ni mogoče zagnati —
  // strežnik uporablja vgrajen snapshot (data/ajpes-apartments.json).
  if (process.env.VERCEL) {
    return NextResponse.json({
      ok: true,
      started: false,
      progress: getSyncProgress(),
      note: 'Na strežniški platformi se uporablja vgrajen uradni snapshot; usklajevanje poteka le na lokalnem strežniku.',
    });
  }
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
