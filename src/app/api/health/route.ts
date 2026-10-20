import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';

export const dynamic = 'force-dynamic';

const DB_TIMEOUT_MS = 2_500;
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * GET /api/health — preveri, ali je baza dosegljiva.
 * 200 { ok:true, db:"up", latencyMs } | 503 { ok:false, db:"down"|"not-configured" }
 */
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, db: 'not-configured' },
      { status: 503, headers: NO_STORE },
    );
  }

  const startedAt = Date.now();
  try {
    await withDbTimeout(db.$queryRaw`SELECT 1`, DB_TIMEOUT_MS);
    return NextResponse.json(
      { ok: true, db: 'up', latencyMs: Date.now() - startedAt },
      { headers: NO_STORE },
    );
  } catch {
    return NextResponse.json(
      { ok: false, db: 'down' },
      { status: 503, headers: NO_STORE },
    );
  }
}
