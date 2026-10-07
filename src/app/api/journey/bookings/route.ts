import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getTripForRead, getTripForWrite, getSessionUserId } from "@/lib/trip-auth";
import { validateConfirmationRecord } from "@/lib/journey/booking";
import {
  REAL_CHANNEL_FAIL_CLOSED_MESSAGE,
  buildDemoNote,
  buildPartnerNote,
  cancelDemoBooking,
  cancelPartnerBooking,
  confirmPartnerBooking,
  createDemoBooking,
  createPartnerBooking,
  modifyDemoBooking,
  modifyPartnerBooking,
  parseDemoNote,
  parsePartnerNote,
  realProviderStatus,
  reservationChannelOf,
  resolveDemoOffer,
  resolvePartnerOffer,
  validateBookingPatchBody,
  validateBookingRequestBody,
  validatePartnerPatchBody,
  validatePartnerRequestBody,
} from "@/lib/journey/booking-provider";

export const dynamic = "force-dynamic";

/**
 * /api/journey/bookings — REAL BOOKING VERIGA (issue #1 področje 2):
 * iskanje ponudbe → izbor → rezervacija → potrditev → My Trips →
 * status → sprememba/odpoved — s STROGO ločenimi kanali
 * (real | demo | partner).
 *
 *  POST   { shareId, stopSlug?, stopName?, dayIndex?, channel, … }
 *         → PARTNER veja (2.6.0, channel:"partner"): provider +
 *           destinationSlug razreši STREŽNIK iz registra/kanona;
 *           rezervacija se ustvari s statusom PENDING (potrditev
 *           izstavi partner na svoji strani — iskreno); dejanska
 *           rezervacija teče pri partnerju prek vodene povezave
 *           /api/affiliate/go (klik + morebitna provizija). V odzivu
 *           je goPath za iskreno povezavo „Upravljaj pri partnerju".
 *         → demo veja (privzeta): ponudbo razreši STREŽNIK iz
 *           kanonskega OWN_PRODUCTS (klient nikoli ne prinese cene),
 *           createDemoBooking skuje DSA-DEMO-XXXX, zapis se shrani
 *           prek obstoječega modela TripReservation (status CONFIRMED,
 *           note = demo JSON z channel:"demo") → 201 z IZRECNIMA
 *           demo oznakama (channel:"demo", demo:true).
 *
 *  PATCH  { reservationId, action, … } — kanal zapisa razreši STREŽNIK
 *         iz stolpca note (nikoli iz telesa zahteve):
 *         → partner zapis: confirm (številka + cena iz partnerjevega
 *           potrdila — kanonska atestacija), modify (indikativno —
 *           DEJANSKA sprememba pri partnerju), cancel (iskreno stanje);
 *         → demo zapis: cancel | modify (življenjski cikel simulatorja).
 *         Uporabniške atestacije ureja obstoječa S1 pot.
 *
 *  GET    ?shareId → UPORABNIKOVE rezervacije na tej poti z razkritim
 *                   kanalom (demo | user | real | partner | null).
 *         (brez parametra) → zbirnik po poteh za hub /moja-potovanja
 *                   (števci + kanali) + stanje realnega kanala.
 *
 * ISKRENOSTNI KANON (S1 faze 3 ostaja ZAPRT):
 *  · channel "real" (ali source "PROVIDER") → 503 fail-closed —
 *    direktni ponudniški API v peskovniku NI aktiven in NIKOLI ne
 *    obljublja (realne rezervacije potečejo pri partnerjih);
 *  · providerBookingId/confirmedPrice/confirmationUrl v POST telesu →
 *    400 (številko rezervacije partnerja prinese uporabnik ŠELE ob
 *    potrditvi prek PATCH confirm — atestacija, nikoli ponarejena);
 *  · vsak zapis nosi razkrit kanal; demo in partner sta povsod
 *    izrecno označena.
 *
 * Vrata: brez seje → 401; brez pravic na poti → 403/404 (trip-auth).
 * Rate limit: 20 zahtevkov/min na odjemalca (in-memory).
 */

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

/** Okno na odjemalca (peskovniški gateway nastavi x-forwarded-for). */
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function allowRequest(key: string, now: number): boolean {
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    if (rateBuckets.size > 5_000) {
      // Varnostna mreža proti nenehavemu pomnilniku.
      for (const [k, v] of rateBuckets) {
        if (now >= v.resetAt) rateBuckets.delete(k);
      }
    }
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT;
}

function rateLimited(request: Request): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return !allowRequest(ip, Date.now());
}

type ReservationRow = {
  id: string;
  journeyId: string;
  createdBy: string;
  dayIndex: number;
  stopSlug: string | null;
  stopName: string;
  status: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Serializacija vrstice z IZRECNIM razkritjem kanala. */
function serializeReservation(r: ReservationRow) {
  const channel = reservationChannelOf(r.note);
  return {
    id: r.id,
    dayIndex: r.dayIndex,
    stopSlug: r.stopSlug,
    stopName: r.stopName,
    status: r.status,
    note: r.note,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    channel,
    demo: channel === "demo",
  };
}

// ── POST: demo rezervacija (iskanje → izbor → rezervacija → potrditev) ────

export async function POST(request: Request) {
  if (rateLimited(request)) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusite znova čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Za rezervacijo se prijavi — demo rezervacije so vezane na račun." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  const raw = (body ?? {}) as Record<string, unknown>;

  const shareId = typeof raw.shareId === "string" ? raw.shareId : "";
  if (!shareId) {
    return NextResponse.json({ error: "Manjka shareId poti." }, { status: 400 });
  }

  // Vrata poti: mutacija zahteva EDITOR+ (vlogo izračuna strežnik) —
  // enak vrstni red vrat kot S1 pot /api/trips/…/reservations.
  const guard = await getTripForWrite(shareId, "EDITOR");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  // ── FAIL-CLOSED: realni kanal v peskovniku NI aktiven (nikoli lažno). ──
  if (raw.channel === "real" || raw.source === "PROVIDER") {
    return NextResponse.json(
      {
        error: REAL_CHANNEL_FAIL_CLOSED_MESSAGE,
        status: "fail-closed",
        realProvider: realProviderStatus(),
      },
      { status: 503 }
    );
  }

  // ── PARTNER veja (2.6.0 — vzorec MindTrip): rezervacija PRI partnerju. ──
  // Strežnik razreši provider + destinacijo iz registra/kanona; zapis se
  // ustvari s statusom PENDING (potrditev izstavi partner na svoji strani).
  // Številka rezervacije in cena sta prepovedani v telesu — prispeta šele
  // kot uporabnikova atestacija prek PATCH confirm.
  if (raw.channel === "partner") {
    const pv = validatePartnerRequestBody(body);
    if (!pv.ok) {
      return NextResponse.json({ error: pv.error }, { status: 400 });
    }
    const input = pv.value;

    const offer = resolvePartnerOffer(input.provider, input.destinationSlug);
    if (!offer) {
      return NextResponse.json(
        {
          error:
            "Ta partner ali destinacija ne obstaja v registru ponudb (izberi ponudbo iz iskanja).",
        },
        { status: 404 }
      );
    }

    const created = createPartnerBooking(offer, {
      date: input.date,
      people: input.people,
      name: input.name,
    });
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }

    const stopSlug = input.stopSlug ?? (offer.destinationSlug || null);
    const stopName =
      input.stopName ??
      (offer.destinationName
        ? `${offer.categoryLabel.sl} — ${offer.providerName} (${offer.destinationName})`
        : `${offer.categoryLabel.sl} — ${offer.providerName}`);

    const row = await db.tripReservation.create({
      data: {
        journeyId: guard.ctx.journey.id,
        createdBy: userId,
        dayIndex: input.dayIndex,
        stopSlug: stopSlug ? stopSlug.slice(0, 80) : null,
        stopName: stopName.slice(0, 200),
        status: "PENDING",
        note: buildPartnerNote(created.booking),
      },
    });

    return NextResponse.json(
      {
        success: true,
        // IZRECNI partner razkritivi — rezervacija ŽIVI pri partnerju.
        channel: "partner" as const,
        partner: true as const,
        provider: created.booking.provider,
        providerName: created.booking.providerName,
        category: created.booking.category,
        status: "PENDING" as const,
        // Iskrena povezava za upravljanje pri partnerju.
        goPath: offer.goPath,
        reservation: serializeReservation(row),
        realProvider: realProviderStatus(),
      },
      { status: 201 }
    );
  }

  const v = validateBookingRequestBody(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }
  const input = v.value;

  // Ponudbo razreši STREŽNIK iz kanonskega nabora — klient ne prinese cene.
  const offer = resolveDemoOffer(input.offerId);
  if (!offer) {
    return NextResponse.json(
      { error: "Ta ponudba ne obstaja v demo simulatorju (izberi ponudbo iz iskanja)." },
      { status: 404 }
    );
  }

  // Simulator „potrdi" takoj — to je njegov namen (prikaz celotnega flowa).
  const created = createDemoBooking(offer, {
    date: input.date,
    people: input.people,
    name: input.name,
  });
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 400 });
  }

  // Kanonska dvojna preverba (booking.ts faza 3): demo zapis mora prestati
  // validator atestacij — CONFIRMED zahteva številko + ceno.
  const canon = validateConfirmationRecord({
    status: "CONFIRMED",
    source: "USER",
    providerBookingId: created.booking.providerBookingId,
    confirmedPrice: created.booking.price,
  });
  if (!canon.ok) {
    // Fail-closed: simulator ne piše zapisa, ki ne bi prestal kanona.
    return NextResponse.json(
      { error: `Demo zapis ni prestal kanonske validacije: ${canon.error}` },
      { status: 500 }
    );
  }

  const stopSlug = input.stopSlug ?? offer.destinationSlug;
  const stopName = input.stopName ?? `${offer.title.sl} (${offer.destinationName})`;

  const row = await db.tripReservation.create({
    data: {
      journeyId: guard.ctx.journey.id,
      createdBy: userId,
      dayIndex: input.dayIndex,
      stopSlug: stopSlug ? stopSlug.slice(0, 80) : null,
      stopName: stopName.slice(0, 200),
      status: "CONFIRMED",
      note: buildDemoNote(created.booking),
    },
  });

  return NextResponse.json(
    {
      success: true,
      // IZRECNI demo razkritivi — nikoli zeleno „provider potrjen".
      channel: "demo" as const,
      demo: true as const,
      providerBookingId: created.booking.providerBookingId,
      offerId: created.booking.offerId,
      price: created.booking.price,
      currency: created.booking.currency,
      reservation: serializeReservation(row),
      realProvider: realProviderStatus(),
    },
    { status: 201 }
  );
}

// ── PATCH: sprememba / preklic DEMO rezervacije ────────────────────────────

export async function PATCH(request: Request) {
  if (rateLimited(request)) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusite znova čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Za spremembo rezervacije se prijavi." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  const raw = (body ?? {}) as Record<string, unknown>;

  // ── FAIL-CLOSED: realni/provider kanal NI aktiven (nikoli lažno). ──────
  if (raw.channel === "real" || raw.source === "PROVIDER") {
    return NextResponse.json(
      {
        error: REAL_CHANNEL_FAIL_CLOSED_MESSAGE,
        status: "fail-closed",
        realProvider: realProviderStatus(),
      },
      { status: 503 }
    );
  }

  const existing = await db.tripReservation.findUnique({
    where: { id: typeof raw.reservationId === "string" ? raw.reservationId : "" },
  });
  if (!existing) {
    return NextResponse.json({ error: "Rezervacija ne obstaja." }, { status: 404 });
  }

  // Lastništvo: svojo rezervacijo spreminja SAMO njen lastnik (strežniško).
  if (existing.createdBy !== userId) {
    return NextResponse.json(
      { error: "To ni tvoja rezervacija — spreminjaš lahko samo svoje rezervacije." },
      { status: 403 }
    );
  }

  // ── PARTNER zapis: kanal razreši STREŽNIK iz stolpca note. ─────────────
  // confirm (atestacija s partnerjevim potrdilom) | modify (indikativno —
  // DEJANSKA sprememba teče pri partnerju) | cancel (iskreno stanje).
  const partnerRecord = parsePartnerNote(existing.note);
  if (partnerRecord) {
    const pv = validatePartnerPatchBody(body);
    if (!pv.ok) {
      return NextResponse.json({ error: pv.error }, { status: 400 });
    }
    const patch = pv.value;
    // Vir resnice o statusu je VRSTICA (ne note) — uskladi zapis z vrstico.
    const current = {
      ...partnerRecord,
      status: existing.status as typeof partnerRecord.status,
    };

    const result =
      patch.action === "cancel"
        ? cancelPartnerBooking(current)
        : patch.action === "confirm"
          ? confirmPartnerBooking(current, {
              providerBookingId: patch.providerBookingId ?? "",
              confirmedPrice: patch.confirmedPrice ?? 0,
            })
          : modifyPartnerBooking(current, {
              ...(patch.date !== undefined ? { date: patch.date } : {}),
              ...(patch.people !== undefined ? { people: patch.people } : {}),
              ...(patch.name !== undefined ? { name: patch.name } : {}),
            });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updated = await db.tripReservation.update({
      where: { id: existing.id },
      data: {
        status: result.booking.status,
        note: buildPartnerNote(result.booking),
      },
    });

    return NextResponse.json({
      success: true,
      channel: "partner" as const,
      partner: true as const,
      provider: result.booking.provider,
      providerName: result.booking.providerName,
      status: result.booking.status,
      reservation: serializeReservation(updated),
    });
  }

  // ── DEMO zapis (življenjski cikel simulatorja). ─────────────────────────
  const v = validateBookingPatchBody(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }
  const patch = v.value;

  // Samo DEMO rezervacije tečejo tukaj — uporabniške atestacije ureja
  // obstoječa S1 pot (/api/trips/[shareId]/reservations).
  const demoRecord = parseDemoNote(existing.note);
  if (!demoRecord) {
    return NextResponse.json(
      {
        error:
          "Ta rezervacija ni demo rezervacija — uporabniške atestacije spreminjaš v zavihku Rezervacije (potrdilo ponudnika).",
      },
      { status: 400 }
    );
  }

  // Vir resnice o statusu je VRSTICA (ne note) — uskladi zapis z vrstico.
  const current = { ...demoRecord, status: existing.status as typeof demoRecord.status };

  const result =
    patch.action === "cancel"
      ? cancelDemoBooking(current)
      : modifyDemoBooking(current, {
          ...(patch.date !== undefined ? { date: patch.date } : {}),
          ...(patch.people !== undefined ? { people: patch.people } : {}),
          ...(patch.name !== undefined ? { name: patch.name } : {}),
        });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const updated = await db.tripReservation.update({
    where: { id: existing.id },
    data: {
      status: result.booking.status,
      note: buildDemoNote(result.booking),
    },
  });

  return NextResponse.json({
    success: true,
    channel: "demo" as const,
    demo: true as const,
    providerBookingId: result.booking.providerBookingId,
    reservation: serializeReservation(updated),
  });
}

// ── GET: rezervacije uporabnika z razkritim kanalom ────────────────────────

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Za seznanjanje rezervacij se prijavi." },
      { status: 401 }
    );
  }

  const shareId = new URL(request.url).searchParams.get("shareId");

  if (shareId) {
    // Rezervacije UPORABNIKA na eni poti (kanal je razkrit v vsaki vrstici).
    const ctx = await getTripForRead(shareId);
    if (!ctx) {
      return NextResponse.json({ error: "Ta pot ne obstaja (ali ni javna)." }, { status: 404 });
    }
    const rows = await db.tripReservation.findMany({
      where: { journeyId: ctx.journey.id, createdBy: userId },
      orderBy: [{ dayIndex: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({
      shareId,
      reservations: rows.map(serializeReservation),
      realProvider: realProviderStatus(),
    });
  }

  // Zbirnik po poteh (hub /moja-potovanja): MOJE rezervacije, zbrane po
  // poteh, s števci statusov in razčlenitvijo kanalov.
  const rows = await db.tripReservation.findMany({
    where: { createdBy: userId },
    include: { journey: { select: { shareId: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });

  interface TripSummary {
    shareId: string;
    title: string;
    total: number;
    confirmed: number;
    modified: number;
    cancelled: number;
    idea: number;
    /** Partner rezervacije, ki čakajo na partnerjevo potrditev. */
    pending: number;
    demo: number;
    user: number;
    real: number;
    partner: number;
    unknownChannel: number;
    latestAt: string;
  }
  const byTrip = new Map<string, TripSummary>();
  for (const r of rows) {
    let s = byTrip.get(r.journey.shareId);
    if (!s) {
      s = {
        shareId: r.journey.shareId,
        title: r.journey.title,
        total: 0,
        confirmed: 0,
        modified: 0,
        cancelled: 0,
        idea: 0,
        pending: 0,
        demo: 0,
        user: 0,
        real: 0,
        partner: 0,
        unknownChannel: 0,
        latestAt: r.createdAt.toISOString(),
      };
      byTrip.set(r.journey.shareId, s);
    }
    s.total += 1;
    if (r.status === "CONFIRMED") s.confirmed += 1;
    else if (r.status === "MODIFIED") s.modified += 1;
    else if (r.status === "CANCELLED") s.cancelled += 1;
    else if (r.status === "IDEA") s.idea += 1;
    else if (r.status === "PENDING") s.pending += 1;
    const channel = reservationChannelOf(r.note);
    if (channel === "demo") s.demo += 1;
    else if (channel === "user") s.user += 1;
    else if (channel === "real") s.real += 1;
    else if (channel === "partner") s.partner += 1;
    else s.unknownChannel += 1;
    if (r.createdAt.toISOString() > s.latestAt) s.latestAt = r.createdAt.toISOString();
  }

  return NextResponse.json({
    trips: [...byTrip.values()],
    realProvider: realProviderStatus(),
  });
}
