import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { clientKey, reservationLimiter } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';

/**
 * Rezervacija prenočišča — zapis v bazo (PostgreSQL/Prisma), vezan na sejo.
 *
 * Poštenost: »Rezerviraj« SHRANI objekt v »Mojo pot« (+ ta zapis v bazi,
 * idempotentno prek [userId, stayId]). Pravo plačilo poteka pri objektu ali
 * na uradni strani (povezava je vidna v podrobnostih) — to UI izrecno piše.
 *
 * POST /api/reservations  { stayId, name, city, lat, lng, priceFrom? }
 *   → 200 { ok:true, reservation }  (novo ali že obstoječe — idempotentno)
 *   → 400 { ok:false, error }       (neveljaven vnos)
 *   → 401 { ok:false, error }       (ni prijave)
 *   → 429 { ok:false, error }       (preveč zahtev)
 *   → 503 { ok:false, error }       (baza nedosegljiva)
 *
 * Javnega GET seznama NI: rezervacije so zasebne, seznam bi razkril vsebino.
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

const reservationSchema = z.object({
  stayId: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  city: z.string().min(1).max(120),
  lat: z.number().min(-85).max(85),
  lng: z.number().min(-180).max(180),
  priceFrom: z.number().int().min(0).max(5000).nullable().optional(),
});

export async function POST(request: Request) {
  // Omejitev pred branjem seje: nepreverjeni promet ne sme obremenjevati baze.
  const limit = reservationLimiter(clientKey(request));
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: 'Preveč rezervacij v kratkem času — poskusi znova čez minuto.' },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'Za shranjevanje v profil se prijavi.' },
      { status: 401, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Telo zahteve ni veljaven JSON.' },
      { status: 400, headers: NO_STORE },
    );
  }
  const parsed = reservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Neveljavni podatki rezervacije (stayId, name, city, lat, lng, priceFrom).' },
      { status: 400, headers: NO_STORE },
    );
  }
  const d = parsed.data;
  try {
    // Native upsert je atomski: dve hkratni zahtevi isti objekt shranita enkrat.
    const reservation = await withDbTimeout(
      db.stayReservation.upsert({
        where: { userId_stayId: { userId: session.userId, stayId: d.stayId } },
        create: {
          userId: session.userId,
          stayId: d.stayId,
          name: d.name,
          city: d.city,
          lat: d.lat,
          lng: d.lng,
          priceFrom: d.priceFrom ?? null,
        },
        update: {
          name: d.name,
          city: d.city,
          lat: d.lat,
          lng: d.lng,
          priceFrom: d.priceFrom ?? null,
        },
      }),
    );
    return NextResponse.json({ ok: true, reservation }, { headers: NO_STORE });
  } catch (err) {
    console.error('reservations: shranjevanje ni uspelo', err);
    return NextResponse.json(
      { ok: false, error: 'Rezervacije trenutno ni mogoče shraniti. Poskusi znova.' },
      { status: 503, headers: NO_STORE },
    );
  }
}
