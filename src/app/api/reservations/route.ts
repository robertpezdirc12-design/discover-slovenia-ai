import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

/**
 * Rezervacija prenočišča — zapis v bazo (SQLite/Prisma).
 *
 * Poštenost: »Rezerviraj« SHRANI objekt v »Mojo pot« (+ ta zapis v bazi,
 * idempotentno prek stayId unique). Pravo plačilo poteka pri objektu ali
 * na uradni strani (povezava je vidna v podrobnostih) — to UI izrecno piše.
 *
 * POST /api/reservations  { stayId, name, city, lat, lng, priceFrom? }
 *   → 200 { ok:true, already:true, reservation } (že obstaja — brez podvajanja)
 *   → 200 { ok:true, reservation }              (novo shranjeno)
 *   → 400 { ok:false, error }                   (neveljaven vnos)
 *   → 500 { ok:false, error }                   (baza nedosegljiva)
 *
 * GET /api/reservations → 200 { ok:true, reservations:[…najnovejših 50] }
 */

export const dynamic = 'force-dynamic';

const reservationSchema = z.object({
  stayId: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  city: z.string().min(1).max(120),
  lat: z.number().min(-85).max(85),
  lng: z.number().min(-180).max(180),
  priceFrom: z.number().int().min(0).max(5000).nullable().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Telo zahteve ni veljaven JSON.' }, { status: 400 });
  }
  const parsed = reservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Neveljavni podatki rezervacije (stayId, name, city, lat, lng, priceFrom).' },
      { status: 400 },
    );
  }
  const d = parsed.data;
  try {
    const existing = await db.stayReservation.findUnique({ where: { stayId: d.stayId } });
    if (existing) {
      return NextResponse.json({ ok: true, already: true, reservation: existing });
    }
    const reservation = await db.stayReservation.create({
      data: {
        stayId: d.stayId,
        name: d.name,
        city: d.city,
        lat: d.lat,
        lng: d.lng,
        priceFrom: d.priceFrom ?? null,
      },
    });
    return NextResponse.json({ ok: true, reservation });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'neznan odziv baze';
    return NextResponse.json(
      { ok: false, error: `Rezervacije trenutno ni mogoče shraniti (${message}).` },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const reservations = await db.stayReservation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ ok: true, reservations });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'neznan odziv baze';
    return NextResponse.json(
      { ok: false, error: `Rezervacij trenutno ni mogoče prebrati (${message}).` },
      { status: 500 },
    );
  }
}
