/**
 * BOOKING-PROVIDER — KANON KANALOV REZERVACIJ (issue #1 področje 2).
 * ============================================================================
 * Real booking veriga: iskanje ponudbe → izbor → rezervacija → potrditev →
 * My Trips → status → sprememba/odpoved — z VEDNO STROGO ločenima
 * kanaloma:
 *
 *   BookingChannel = "real" | "demo"
 *
 * ISKRENOSTNI KANON (izvirnik, faza 3 — 51-c):
 *  - REAL kanal je VEDNO fail-closed: v peskovniku ni poverilnic
 *    ponudnikov (0 poverilnic = 0 laži) — realProviderStatus() vrača
 *    vedno { configured: false, reason } in API odgovarja 503. Realni
 *    kanal nikoli ne obljublja; to je IZRECNO razkrito v UI;
 *  - DEMO kanal je strežniški, DETERMINISTIČEN simulator: „potrdi"
 *    takoj (status CONFIRMED) — to je njegov namen: prikaz celotnega
 *    flowa. Demo rezervacija je VEDNO izrecno razkrita (badge
 *    „Demo simulator", oranžna/vijolična jakost — NIKOLI zelena);
 *  - klient NE MORE ponarediti provider polj: providerBookingId (oblika
 *    DSA-DEMO-XXXX) kuje SAMO strežnik iz semena; vsak poskus, da bi
 *    klient prinesel providerBookingId/confirmedPrice v telesu zahtevka,
 *    se zavrne (validacija spodaj);
 *  - ponudbe DEMO iskanja so IZKLJUČNO obstoječi lastni izdelki
 *    (OWN_PRODUCTS iz trznica-data — imena izkušenj in cene
 *    costPerPerson iz kanonskega nabora destinacij; NIČ izmišljenega).
 *
 * Vse funkcije so ČISTE (brez DB, brez omrežja) — client-safe in
 * testabilne (tests/booking-provider.test.ts). Prehodi statusov tečejo
 * SKOZI kanonski ALLOWED_TRANSITIONS iz ./booking (kanon faze 3 —
 * obstoječih 53 testov ne razbijamo).
 * ============================================================================
 */

import {
  assertTransition,
  isConfirmationStatus,
  type ConfirmationStatus,
} from "./booking";
import { getDestination } from "../slovenia-data";
import { OWN_PRODUCTS, type OwnProduct } from "../trznica-data";

// ─── Kanala (STROGO ločena) ─────────────────────────────────────────────────

/** Kanal rezervacije — realni ponudnik ali demo simulator (nikoli mešano). */
export type BookingChannel = "real" | "demo";

export const BOOKING_CHANNELS = ["real", "demo"] as const;

/** Ali je niz veljaven kanal? */
export function isBookingChannel(s: string): s is BookingChannel {
  return (BOOKING_CHANNELS as readonly string[]).includes(s);
}

/** Oznaki kanalov za UI (SL kanon + EN prevod). */
export const CHANNEL_LABELS: Record<BookingChannel, { sl: string; en: string }> = {
  real: { sl: "Realni ponudnik", en: "Real provider" },
  demo: { sl: "Demo simulator", en: "Demo simulator" },
};

// ─── REAL kanal — izvirniški fail-closed kanon ──────────────────────────────

/** Stanje realnega ponudniškega kanala (v peskovniku VEDNO nekonfiguriran). */
export interface RealProviderStatus {
  channel: "real";
  /** Literal false — brez poverilnic realni kanal NIKOLI ne trdi, da dela. */
  configured: false;
  /** Iskren razlog, razkrit v UI. */
  reason: string;
}

/**
 * Stanje realnega ponudniškega kanala. V peskovniku ni poverilnic
 * ponudnikov (noben API ključ, noben žeton) → VEDNO fail-closed:
 * 0 poverilnic = 0 laži. Ko bo kanal nekdaj dejansko konfiguriran, se
 * ta funkcija spremeni — do takrat je „real" kanal izrecno NEMOGOČ.
 */
export function realProviderStatus(): RealProviderStatus {
  return {
    channel: "real",
    configured: false,
    reason:
      "Realni ponudniški kanal ni aktiven: v tem okolju ni konfiguriranih poverilnic ponudnikov (0 poverilnic = 0 laži). Rezervacije potekajo izključno prek demo simulatorja, ki je izrecno razkrit.",
  };
}

/** Sporočilo 503 za poskus realnega kanala (API fail-closed). */
export const REAL_CHANNEL_FAIL_CLOSED_MESSAGE =
  "Realni ponudniški kanal ni aktiviran — brez poverilnic nikoli ne lažemo. Na voljo je samo demo simulator (izrecno označen).";

// ─── DEMO simulator — iskanje ponudb ────────────────────────────────────────

/** Kako je ponudba povezana na iskani postanek (iskrenost razkritja). */
export type DemoOfferMatch = "exact" | "region" | "suggested";

/** Ponudba demo simulatorja — vedno OBSTOJEČI lastni izdelek. */
export interface DemoOffer {
  /** ID obstoječega lastnega izdelka (OWN_PRODUCTS). */
  offerId: string;
  title: { sl: string; en: string };
  kind: OwnProduct["kind"];
  destinationSlug: string;
  /** Kanonsko ime destinacije (razkritje povezave). */
  destinationName: string;
  /** Cena na osebo (EUR) — costPerPerson destinacije v kanonskem naboru. */
  pricePerPerson: number;
  /** Skupna cena za izbrano število ljudi (deterministična). */
  totalPrice: number;
  currency: "EUR";
  match: DemoOfferMatch;
}

export const DEMO_OFFERS_MIN = 2;
export const DEMO_OFFERS_MAX = 4;

/** Privzeto število ljudi za prikaz skupne cene v iskanju. */
export const DEMO_PEOPLE_DEFAULT = 2;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampPeople(people: number | null | undefined): number {
  if (typeof people !== "number" || !Number.isFinite(people)) return DEMO_PEOPLE_DEFAULT;
  if (!Number.isInteger(people)) return DEMO_PEOPLE_DEFAULT;
  return Math.min(Math.max(people, BOOKING_PEOPLE_MIN), BOOKING_PEOPLE_MAX);
}

function toOffer(p: OwnProduct, match: DemoOfferMatch, people: number): DemoOffer {
  const dest = getDestination(p.destinationSlug);
  return {
    offerId: p.id,
    title: { sl: p.name.sl, en: p.name.en },
    kind: p.kind,
    destinationSlug: p.destinationSlug,
    destinationName: dest?.name ?? p.destinationSlug,
    pricePerPerson: p.priceEstimate,
    totalPrice: round2(p.priceEstimate * people),
    currency: "EUR",
    match,
  };
}

/**
 * Poišči demo ponudbe za postanek/destinacijo (2–4 ponudbe):
 *  1. „exact"  — izdelki, ki nosijo RAVNO ta slug destinacije;
 *  2. „region" — izdelki destinacij ISTE regije (kanonski nabor 38);
 *  3. „suggested" — če je nabor pretanko, dopolnimo z izdelki v
 *     kanonskem vrstnem redu (vsaka ponudba nosi ime SVOJE destinacije,
 *     zato dopolnilo ostaja iskreno označeno).
 *
 * Vse ponudbe so OBSTOJEČI lastni izdelki (OWN_PRODUCTS) — simulator
 * NE izmišljuje novih izkušenj niti cen. people (1–12, privzeto 2) le
 * zasuli skupno ceno v ponudbi (deterministično).
 */
export function searchDemoOffers(
  stopSlug: string | null | undefined,
  people?: number | null
): DemoOffer[] {
  const p = clampPeople(people);
  const slug = typeof stopSlug === "string" ? stopSlug.trim().toLowerCase() : "";
  const dest = slug ? getDestination(slug) : undefined;

  const out: DemoOffer[] = [];
  const seen = new Set<string>();

  // 1. natančen zadetek slug-a destinacije
  if (dest) {
    for (const prod of OWN_PRODUCTS) {
      if (prod.destinationSlug === dest.slug && !seen.has(prod.id)) {
        out.push(toOffer(prod, "exact", p));
        seen.add(prod.id);
      }
    }
  }

  // 2. ista regija (kanonski nabor)
  if (dest) {
    for (const prod of OWN_PRODUCTS) {
      if (seen.has(prod.id)) continue;
      const prodDest = getDestination(prod.destinationSlug);
      if (prodDest && prodDest.region === dest.region) {
        out.push(toOffer(prod, "region", p));
        seen.add(prod.id);
      }
    }
  }

  // 3. iskreno dopolnilo v kanonskem vrstnem redu (lastna imena destinacij)
  for (const prod of OWN_PRODUCTS) {
    if (out.length >= DEMO_OFFERS_MIN) break;
    if (!seen.has(prod.id)) {
      out.push(toOffer(prod, "suggested", p));
      seen.add(prod.id);
    }
  }

  return out.slice(0, DEMO_OFFERS_MAX);
}

/**
 * Poišči demo ponudbo po ID-ju (strežniška razrešitev izključno iz
 * kanonskega OWN_PRODUCTS — klient nikoli ne prinese cene).
 */
export function resolveDemoOffer(offerId: string): DemoOffer | null {
  const prod = OWN_PRODUCTS.find((p) => p.id === offerId);
  if (!prod) return null;
  return toOffer(prod, "exact", DEMO_PEOPLE_DEFAULT);
}

// ─── Deterministični ID demo rezervacije (DSA-DEMO-XXXX) ────────────────────

/** Abeceda ID-jev — 32 znakov brez zamenljivih (brez 0/O, 1/I). */
const DEMO_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Predpona demo številke rezervacije (kanon simulatorja). */
export const DEMO_BOOKING_ID_PREFIX = "DSA-DEMO-";

/** Oblika DSA-DEMO-XXXX (4 znaki iz abecede brez zamenljivih). */
export const DEMO_BOOKING_ID_RE = /^DSA-DEMO-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

/** Deterministični 32-bitni hash semena (djb2, unsigned). */
function hashSeed(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 33) + seed.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/**
 * Številka demo rezervacije, deterministična iz semena:
 * isto seme → VEDNO isti ID (testabilno). Kuje jo SAMO strežnik.
 */
export function demoBookingId(seed: string): string {
  const h = hashSeed(seed);
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += DEMO_ID_ALPHABET[(h >>> (i * 5)) & 31];
  }
  return `${DEMO_BOOKING_ID_PREFIX}${id}`;
}

/**
 * Seme iz katerega simulator skuje številko rezervacije — celotni vnos
 * (ponudba + datum + ljudje + ime). Determinizem: enak vnos → enak ID.
 */
export function demoBookingSeed(
  offerId: string,
  input: { date: string; people: number; name?: string | null }
): string {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  return `${offerId}|${input.date}|${input.people}|${name}`;
}

// ─── Validacija (čista, brez strežnika — testirana v tests/) ────────────────

export const BOOKING_PEOPLE_MIN = 1;
export const BOOKING_PEOPLE_MAX = 12;
export const BOOKING_NAME_MAX = 120;
export const BOOKING_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const BOOKING_DAY_INDEX_MIN = 1;
export const BOOKING_DAY_INDEX_MAX = 30;
export const BOOKING_STOP_SLUG_MAX = 80;
export const BOOKING_STOP_NAME_MAX = 200;

export type Validation = { ok: true } | { ok: false; error: string };

/**
 * Veljaven ISO datum (YYYY-MM-DD) s pravim koledarskim dnem
 * (2026-02-30 in 2027-02-29 sta NEVELJAVNA — iskrenost, ne ugibamo).
 */
export function isValidBookingDate(date: unknown): date is string {
  if (typeof date !== "string" || !BOOKING_DATE_RE.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  if (y < 2020 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

/** Validiraj polja demo rezervacije (datum, ljudje, ime). */
export function validateDemoBookingFields(
  date: unknown,
  people: unknown,
  name: unknown
): Validation {
  if (!isValidBookingDate(date)) {
    return { ok: false, error: "Datum rezervacije mora biti veljaven ISO datum (YYYY-MM-DD)." };
  }
  if (
    typeof people !== "number" ||
    !Number.isInteger(people) ||
    people < BOOKING_PEOPLE_MIN ||
    people > BOOKING_PEOPLE_MAX
  ) {
    return {
      ok: false,
      error: `Število ljudi mora biti celo število med ${BOOKING_PEOPLE_MIN} in ${BOOKING_PEOPLE_MAX}.`,
    };
  }
  if (name != null) {
    if (typeof name !== "string") {
      return { ok: false, error: "Ime na rezervaciji mora biti besedilo." };
    }
    if (name.trim().length > BOOKING_NAME_MAX) {
      return { ok: false, error: `Ime na rezervaciji je predolgo (največ ${BOOKING_NAME_MAX} znakov).` };
    }
  }
  return { ok: true };
}

/** Normalizirana oblika telesa POST /api/journey/bookings. */
export interface BookingRequestBody {
  dayIndex: number;
  stopSlug: string | null;
  stopName: string | null;
  offerId: string;
  date: string;
  people: number;
  name: string | null;
}

/** Rezultat validacije telesa POST (diskriminirana unija po `ok`). */
export type BookingRequestValidation =
  | { ok: true; value: BookingRequestBody }
  | { ok: false; error: string };

/**
 * Validacija telesa POST — izločena v čisto funkcijo (testirljivo brez
 * strežnika). ISKRENOST: telo NE SME nositi provider polj
 * (providerBookingId / confirmedPrice / confirmationUrl) — številko
 * rezervacije in ceno kuje SAMO strežniški simulator.
 * Kanal (če je naveden) sme biti samo "demo" — "real" pred tem odpove
 * z 503 fail-closed (glej REAL_CHANNEL_FAIL_CLOSED_MESSAGE).
 */
export function validateBookingRequestBody(body: unknown): BookingRequestValidation {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Neveljavno telo zahteve (pričakovan objekt)." };
  }
  const b = body as Record<string, unknown>;

  // Kanal: samo demo (real → 503 že prej v ruti; tu fail-closed na 400).
  if (b.channel !== undefined && b.channel !== null && b.channel !== "demo") {
    return {
      ok: false,
      error: `Neznan kanal rezervacije: "${String(b.channel)}" — dovoljen je samo demo simulator.`,
    };
  }

  // Provider polja klienta ZAVRNEMO — kuje jih samo strežnik.
  if (b.providerBookingId != null || b.confirmedPrice != null || b.confirmationUrl != null) {
    return {
      ok: false,
      error:
        "Telo zahteve ne sme nositi polj ponudnika (providerBookingId / confirmedPrice / confirmationUrl) — številko rezervacije izstavljeno izključno strežniški simulator.",
    };
  }

  if (typeof b.offerId !== "string" || b.offerId.trim().length === 0) {
    return { ok: false, error: "Manjka izbrana ponudba (offerId)." };
  }

  const fields = validateDemoBookingFields(b.date, b.people, b.name);
  if (!fields.ok) return fields;

  let dayIndex = 1;
  if (b.dayIndex !== undefined && b.dayIndex !== null) {
    if (
      typeof b.dayIndex !== "number" ||
      !Number.isInteger(b.dayIndex) ||
      b.dayIndex < BOOKING_DAY_INDEX_MIN ||
      b.dayIndex > BOOKING_DAY_INDEX_MAX
    ) {
      return {
        ok: false,
        error: `Dan poti (dayIndex) mora biti celo število med ${BOOKING_DAY_INDEX_MIN} in ${BOOKING_DAY_INDEX_MAX}.`,
      };
    }
    dayIndex = b.dayIndex;
  }

  let stopSlug: string | null = null;
  if (b.stopSlug !== undefined && b.stopSlug !== null) {
    if (typeof b.stopSlug !== "string" || b.stopSlug.length > BOOKING_STOP_SLUG_MAX) {
      return { ok: false, error: "Neveljaven slug postanka." };
    }
    stopSlug = b.stopSlug;
  }

  let stopName: string | null = null;
  if (b.stopName !== undefined && b.stopName !== null && b.stopName !== "") {
    if (typeof b.stopName !== "string" || b.stopName.trim().length < 2) {
      return { ok: false, error: "Ime postanka mora imeti vsaj 2 znaka." };
    }
    stopName = b.stopName.trim().slice(0, BOOKING_STOP_NAME_MAX);
  }

  const name = typeof b.name === "string" && b.name.trim() ? b.name.trim() : null;

  return {
    ok: true,
    value: {
      dayIndex,
      stopSlug,
      stopName,
      offerId: b.offerId.trim(),
      date: b.date as string,
      people: b.people as number,
      name,
    },
  };
}

/** Normalizirana oblika telesa PATCH /api/journey/bookings. */
export interface BookingPatchBody {
  reservationId: string;
  action: "cancel" | "modify";
  date?: string;
  people?: number;
  name?: string | null;
}

/** Rezultat validacije telesa PATCH (diskriminirana unija po `ok`). */
export type BookingPatchValidation =
  | { ok: true; value: BookingPatchBody }
  | { ok: false; error: string };

/** Validacija telesa PATCH (cancel | modify z morebitnimi spremembami). */
export function validateBookingPatchBody(body: unknown): BookingPatchValidation {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Neveljavno telo zahteve (pričakovan objekt)." };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.reservationId !== "string" || b.reservationId.length === 0) {
    return { ok: false, error: "Manjka id rezervacije." };
  }
  if (b.action !== "cancel" && b.action !== "modify") {
    return { ok: false, error: 'Dejanje mora biti "cancel" ali "modify".' };
  }

  // Provider polja klienta ZAVRNEMO (enak kanon kot POST).
  if (b.providerBookingId != null || b.confirmedPrice != null || b.confirmationUrl != null) {
    return {
      ok: false,
      error:
        "Telo zahteve ne sme nositi polj ponudnika — spremembe tečejo izključno prek strežniškega simulatorja.",
    };
  }

  const out: BookingPatchBody = {
    reservationId: b.reservationId,
    action: b.action,
  };

  if (b.action === "modify") {
    // Posamezna polja so neobvezna — kar je navedeno, mora biti veljavno.
    if (b.date !== undefined && b.date !== null && !isValidBookingDate(b.date)) {
      return { ok: false, error: "Datum rezervacije mora biti veljaven ISO datum (YYYY-MM-DD)." };
    }
    if (b.date != null) out.date = b.date;
    if (b.people !== undefined && b.people !== null) {
      if (
        typeof b.people !== "number" ||
        !Number.isInteger(b.people) ||
        b.people < BOOKING_PEOPLE_MIN ||
        b.people > BOOKING_PEOPLE_MAX
      ) {
        return {
          ok: false,
          error: `Število ljudi mora biti celo število med ${BOOKING_PEOPLE_MIN} in ${BOOKING_PEOPLE_MAX}.`,
        };
      }
      out.people = b.people;
    }
    if (b.name !== undefined) {
      if (b.name !== null && typeof b.name !== "string") {
        return { ok: false, error: "Ime na rezervaciji mora biti besedilo." };
      }
      if (typeof b.name === "string" && b.name.trim().length > BOOKING_NAME_MAX) {
        return { ok: false, error: `Ime na rezervaciji je predolgo (največ ${BOOKING_NAME_MAX} znakov).` };
      }
      out.name = b.name;
    }
  }

  return { ok: true, value: out };
}

// ─── DEMO simulator — ustvarjanje / sprememba / preklic ─────────────────────

/** Zapis demo rezervacije (živi v stolpcu note kot JSON). */
export interface DemoBookingRecord {
  offerId: string;
  /** Snapshot imena izkušnje ob rezervaciji (SL kanon). */
  offerTitle: string;
  destinationSlug: string;
  date: string;
  people: number;
  name: string | null;
  /** Življenjski cikel (kanon booking.ts): CONFIRMED → MODIFIED → CANCELLED. */
  status: ConfirmationStatus;
  channel: "demo";
  demo: true;
  /** Številka, ki jo je izstavil SIMULATOR (DSA-DEMO-XXXX). */
  providerBookingId: string;
  pricePerPerson: number;
  /** Skupna cena (pricePerPerson × people). */
  price: number;
  currency: "EUR";
  createdAt: string;
}

export type DemoBookingResult =
  | { ok: true; booking: DemoBookingRecord }
  | { ok: false; error: string };

/**
 * Ustvari demo rezervacijo — simulator „potrdi" TAKOJ (status CONFIRMED):
 * to je njegov namen (prikaz celotnega flowa). Determinizem: enak vnos →
 * enaka številka DSA-DEMO-XXXX. `now` je injicljiv za testljivost.
 */
export function createDemoBooking(
  offer: DemoOffer,
  input: { date: string; people: number; name?: string | null },
  now: Date = new Date()
): DemoBookingResult {
  const v = validateDemoBookingFields(input.date, input.people, input.name);
  if (!v.ok) return v;

  const people = input.people;
  const name = typeof input.name === "string" && input.name.trim() ? input.name.trim() : null;
  const seed = demoBookingSeed(offer.offerId, { date: input.date, people, name });

  return {
    ok: true,
    booking: {
      offerId: offer.offerId,
      offerTitle: offer.title.sl,
      destinationSlug: offer.destinationSlug,
      date: input.date,
      people,
      name,
      status: "CONFIRMED",
      channel: "demo",
      demo: true,
      providerBookingId: demoBookingId(seed),
      pricePerPerson: offer.pricePerPerson,
      price: round2(offer.pricePerPerson * people),
      currency: "EUR",
      createdAt: now.toISOString(),
    },
  };
}

export type DemoBookingChange = {
  date?: string;
  people?: number;
  name?: string | null;
};

/**
 * Spremeni demo rezervacijo — prehod SKOZI kanonski ALLOWED_TRANSITIONS
 * (CONFIRMED → MODIFIED; MODIFIED → MODIFIED samo-veriga). Številka
 * rezervacije ostane STABILNA (istno rezervacijo spreminjamo), cena se
 * preračuna iz kanonske cene ponudbe.
 */
export function modifyDemoBooking(
  booking: DemoBookingRecord,
  change: DemoBookingChange
): DemoBookingResult {
  const t = assertTransition(booking.status, "MODIFIED");
  if (!t.ok) return t;

  const date = change.date ?? booking.date;
  const people = change.people ?? booking.people;
  const name = change.name !== undefined ? change.name : booking.name;
  const v = validateDemoBookingFields(date, people, name);
  if (!v.ok) return v;

  const peopleNum = people as number;
  return {
    ok: true,
    booking: {
      ...booking,
      date: date as string,
      people: peopleNum,
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      status: "MODIFIED",
      price: round2(booking.pricePerPerson * peopleNum),
    },
  };
}

/**
 * Prekliči demo rezervacijo — prehod SKOZI kanonski ALLOWED_TRANSITIONS
 * (CONFIRMED → CANCELLED, MODIFIED → CANCELLED; CANCELLED je TERMINALEN —
 * brez povratkov, kanon faze 3).
 */
export function cancelDemoBooking(booking: DemoBookingRecord): DemoBookingResult {
  const t = assertTransition(booking.status, "CANCELLED");
  if (!t.ok) return t;
  return { ok: true, booking: { ...booking, status: "CANCELLED" } };
}

// ─── Demo zapis v stolpcu `note` (združljiv s S1 atestacijami) ─────────────

/**
 * Zgradi JSON demo zapisa za stolpec `note` TripReservation. Oblika je
 * ZDRUŽLJIVA z atestacijskim JSON iz booking.ts (source/providerBookingId/
 * confirmedPrice) PLUS izrecna demo razkritja (channel:"demo", demo:true,
 * offerId, date, people, status …) — obstoječi parseAttestationNote jo
 * brez težav razčleni (dodatna polja ignorira).
 */
export function buildDemoNote(booking: DemoBookingRecord): string {
  return JSON.stringify({
    source: "USER" as const,
    providerBookingId: booking.providerBookingId,
    confirmedPrice: booking.price,
    channel: "demo" as const,
    demo: true as const,
    offerId: booking.offerId,
    offerTitle: booking.offerTitle,
    destinationSlug: booking.destinationSlug,
    date: booking.date,
    people: booking.people,
    name: booking.name ?? "",
    status: booking.status,
    pricePerPerson: booking.pricePerPerson,
    price: booking.price,
    currency: booking.currency,
    createdAt: booking.createdAt,
  });
}

/**
 * Strogi parser demo zapisa iz stolpca `note` (fail-closed): zahteva
 * vsa ključna polja demo zapisa; karkoli manjka → null (klicar naj
 * zapis obravnava kot navadno atestacijo/legacy opombo — nikoli ne
 * ugiba, da je demo).
 */
export function parseDemoNote(note: string | null | undefined): DemoBookingRecord | null {
  if (typeof note !== "string" || note.length === 0 || !note.startsWith("{")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(note);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;

  // Izrecni demo razkritji sta obvezni (iskrenost: brez oznak ni demo).
  if (o.channel !== "demo" || o.demo !== true) return null;
  if (typeof o.providerBookingId !== "string" || !DEMO_BOOKING_ID_RE.test(o.providerBookingId)) {
    return null;
  }
  if (typeof o.offerId !== "string" || o.offerId.length === 0) return null;
  if (typeof o.offerTitle !== "string" || o.offerTitle.length === 0) return null;
  if (typeof o.destinationSlug !== "string" || o.destinationSlug.length === 0) return null;
  if (!isValidBookingDate(o.date)) return null;
  if (
    typeof o.people !== "number" ||
    !Number.isInteger(o.people) ||
    o.people < BOOKING_PEOPLE_MIN ||
    o.people > BOOKING_PEOPLE_MAX
  ) {
    return null;
  }
  if (typeof o.pricePerPerson !== "number" || !Number.isFinite(o.pricePerPerson) || o.pricePerPerson <= 0) {
    return null;
  }
  if (typeof o.price !== "number" || !Number.isFinite(o.price) || o.price <= 0) return null;
  if (o.currency !== "EUR") return null;
  if (typeof o.createdAt !== "string" || o.createdAt.length === 0) return null;
  // Status: kanonski nabor 14 (fail-closed na neznanega).
  const status = o.status;
  if (typeof status !== "string" || !isConfirmationStatus(status)) return null;

  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : null;

  return {
    offerId: o.offerId,
    offerTitle: o.offerTitle,
    destinationSlug: o.destinationSlug,
    date: o.date,
    people: o.people,
    name,
    status: status as ConfirmationStatus,
    channel: "demo",
    demo: true,
    providerBookingId: o.providerBookingId,
    pricePerPerson: o.pricePerPerson,
    price: o.price,
    currency: "EUR",
    createdAt: o.createdAt,
  };
}

// ─── Kanal obstoječe rezervacije (razkritje v UI/GET) ──────────────────────

/** Kanal obstoječe rezervacije (demo simulator / uporabniška atestacija / realni provider). */
export type ReservationChannel = "demo" | "user" | "real";

/** Oznake kanalov rezervacij za UI. */
export const RESERVATION_CHANNEL_LABELS: Record<ReservationChannel, { sl: string; en: string }> = {
  demo: { sl: "Demo", en: "Demo" },
  user: { sl: "Uporabniška", en: "User" },
  real: { sl: "Realna", en: "Real" },
};

/**
 * Kanal obstoječe rezervacije iz zapisa `note`:
 *  - demo marker (channel:"demo" / demo:true / predpona DSA-DEMO-) → "demo";
 *  - atestacija source USER/IMPORTED → "user";
 *  - source PROVIDER → "real" (v peskovniku ne nastopi — fail-closed);
 *  - brez JSON atestacije → null (legacy opomba — iskreno brez kanala).
 */
export function reservationChannelOf(note: string | null | undefined): ReservationChannel | null {
  if (typeof note !== "string" || note.length === 0 || !note.startsWith("{")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(note);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;

  const id = typeof o.providerBookingId === "string" ? o.providerBookingId : "";
  if (o.channel === "demo" || o.demo === true || id.startsWith(DEMO_BOOKING_ID_PREFIX)) {
    return "demo";
  }
  if (o.source === "PROVIDER") return "real";
  if (o.source === "USER" || o.source === "IMPORTED") return "user";
  return null;
}
