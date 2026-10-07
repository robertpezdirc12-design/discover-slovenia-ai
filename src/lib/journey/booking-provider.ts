/**
 * BOOKING-PROVIDER — KANON KANALOV REZERVACIJ (issue #1 področje 2).
 * ============================================================================
 * Real booking veriga: iskanje ponudbe → izbor → rezervacija → potrditev →
 * My Trips → status → sprememba/odpoved — z VEDNO STROGO ločenimi
 * kanali:
 *
 *   BookingChannel = "real" | "demo" | "partner"
 *
 * ISKRENOSTNI KANON (izvirnik, faza 3 — 51-c; partner 2.6.0):
 *  - REAL kanal (direktni API ponudnika) je VEDNO fail-closed: v peskovniku
 *    ni poverilnic ponudnikov (0 poverilnic = 0 laži) — realProviderStatus()
 *    vrača vedno { configured: false, reason } in API odgovarja 503. Realni
 *    kanal nikoli ne obljublja; to je IZRECNO razkrito v UI;
 *  - PARTNER kanal (2.6.0 — vzorec MindTrip) je REALNA rezervacija PRI
 *    partnerju (Booking.com, GetYourGuide, Kiwi, Rentalcars, Omio) prek
 *    provizijskih povezav /api/affiliate/go (klik se šteje; piškotek
 *    dsa_aff 180 dni). Rezervacija se ZAKLJUČI pri partnerju — aplikacija
 *    sledi stanju: PENDING (čaka partnerjevo potrditev) → CONFIRMED
 *    (uporabnikova atestacija s številko iz partnerjevega potrdila) →
 *    MODIFIED/CANCELLED. Sprememba/odpoved DEJANSKO teče pri partnerju
 *    (iskrena povezava „Upravljaj pri partnerju") — tu le UTC stanje.
 *  - DEMO kanal je strežniški, DETERMINISTIČEN simulator: „potrdi"
 *    takoj (status CONFIRMED) — to je njegov namen: prikaz celotnega
 *    flowa. Demo rezervacija je VEDNO izrecno razkrita (badge
 *    „Demo simulator", oranžna/vijolična jakost — NIKOLI zelena);
 *  - klient NE MORE ponarediti provider polj: providerBookingId (oblika
 *    DSA-DEMO-XXXX) kuje SAMO strežnik iz semena; vsak poskus, da bi
 *    klient prinesel providerBookingId/confirmedPrice v telesu zahtevka,
 *    se zavrne (validacija spodaj); pri PARTNER kanalu sta številka
 *    rezervacije in cena DOVOLJENI SAMO ob atestaciji potrditve
 *    (PATCH confirm — prek kanonskega validateConfirmationRecord);
 *  - ponudbe DEMO iskanja so IZKLJUČNO obstoječi lastni izdelki
 *    (OWN_PRODUCTS iz trznica-data — imena izkušenj in cene
 *    costPerPerson iz kanonskega nabora destinacij; NIČ izmišljenega);
 *    ponudbe PARTNER iskanja so IZKLJUČNO vpisani partnerji registra
 *    AFFILIATE_PROVIDERS (brez izmišljenih cen — partner ceno določi sam).
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
  validateConfirmationRecord,
  type ConfirmationStatus,
} from "./booking";
import { getDestination } from "../slovenia-data";
import { OWN_PRODUCTS, type OwnProduct } from "../trznica-data";
import {
  AFFILIATE_CATEGORIES,
  AFFILIATE_PROVIDERS,
  getProvider,
  nearestAirportForRegion,
  type AffiliateCategory,
  type AffiliateProviderId,
} from "../affiliate-providers";

// ─── Kanali (STROGO ločeni) ─────────────────────────────────────────────────

/** Kanal rezervacije — realni ponudnik, partner (provizijsko) ali demo simulator (nikoli mešano). */
export type BookingChannel = "real" | "demo" | "partner";

export const BOOKING_CHANNELS = ["real", "demo", "partner"] as const;

/** Ali je niz veljaven kanal? */
export function isBookingChannel(s: string): s is BookingChannel {
  return (BOOKING_CHANNELS as readonly string[]).includes(s);
}

/** Oznake kanalov za UI (SL kanon + EN prevod). */
export const CHANNEL_LABELS: Record<BookingChannel, { sl: string; en: string }> = {
  real: { sl: "Realni ponudnik", en: "Real provider" },
  demo: { sl: "Demo simulator", en: "Demo simulator" },
  partner: { sl: "Partner (provizijsko)", en: "Partner (affiliate)" },
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
      "Direktni ponudniški kanal (API) ni aktiven: v tem okolju ni konfiguriranih poverilnic ponudnikov (0 poverilnic = 0 laži). Realne rezervacije potekajo pri partnerjih (provizijske povezave, izrecno razkrite) in prek demo simulatorja.",
  };
}

/** Sporočilo 503 za poskus realnega kanala (API fail-closed). */
export const REAL_CHANNEL_FAIL_CLOSED_MESSAGE =
  "Direktni ponudniški kanal (API) ni aktiviran — brez poverilnic nikoli ne lažemo. Realne rezervacije potečejo pri partnerjih (provizijske povezave, izrecno označene); za prikaz toka je na voljo demo simulator.";

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

// ─── PARTNER kanal — iskanje ponudb (2.6.0, vzorec MindTrip) ────────────────

/** Kako je partnerska ponudba povezana na iskani postanek (iskrenost). */
export type PartnerOfferMatch = "destination" | "custom";

/**
 * Ponudba partnerja — REALNA rezervacija pri partnerju (vpis registra
 * AFFILIATE_PROVIDERS). Cene NI — ceno določi partner na svoji strani
 * (nikoli ne izmišljujemo). Povezava je VODENA (prek /api/affiliate/go):
 * klik se šteje, provizija poteče, če je lastnik aktiviral žeton.
 */
export interface PartnerOffer {
  providerId: AffiliateProviderId;
  providerName: string;
  category: AffiliateCategory;
  /** Oznaka kategorije {sl,en} iz registra. */
  categoryLabel: { sl: string; en: string };
  /** Kanonski slug destinacije ("" za custom postanek). */
  destinationSlug: string;
  /** Iskalno ime destinacije ("" za custom postanek). */
  destinationName: string;
  /** Vodena povezava — /api/affiliate/go (klik + morebitna provizija). */
  goPath: string;
  /** Ocena provizije v % (pogodbena — razkritje, ne obljuba). */
  commissionPct: number;
  /** Letališče regije (samo za kategorijo flights). */
  airport: { code: string; name: string } | null;
  match: PartnerOfferMatch;
}

/** Kanonski vrstni red kategorij v partnerskem iskanju. */
const PARTNER_SEARCH_CATEGORIES: readonly AffiliateCategory[] = [
  "stays",
  "experiences",
  "car",
  "transfers",
  "flights",
];

/** Vodena povezava do partnerja (dest je kanonski slug, če je znan). */
function partnerGoPath(providerId: AffiliateProviderId, destSlug: string): string {
  const params = new URLSearchParams({ provider: providerId });
  if (destSlug) params.set("dest", destSlug);
  return `/api/affiliate/go?${params.toString()}`;
}

/** Skupni gradnik ponudbe iz registrskega vpisa (+ destinacija). */
function toPartnerOffer(
  provider: (typeof AFFILIATE_PROVIDERS)[number],
  destSlug: string
): PartnerOffer {
  const dest = destSlug ? getDestination(destSlug) : undefined;
  const airport =
    provider.category === "flights" && dest
      ? nearestAirportForRegion(dest.region)
      : null;
  return {
    providerId: provider.id,
    providerName: provider.name,
    category: provider.category,
    categoryLabel: AFFILIATE_CATEGORIES[provider.category],
    destinationSlug: dest?.slug ?? "",
    destinationName: dest?.name ?? "",
    goPath: partnerGoPath(provider.id, dest?.slug ?? ""),
    commissionPct: provider.commissionPct,
    airport: airport ? { code: airport.code, name: airport.nameSl } : null,
    match: dest ? "destination" : "custom",
  };
}

/**
 * Poišči partnerjeve ponudbe za postanek (REALNI kanal, vzorec MindTrip):
 *  - poznan slug destinacije → do 5 ponudb (nastanitev, doživetje,
 *    rent-a-car, prevoz + leti z letališča regije), vsaka z vodeno
 *    povezavo /api/affiliate/go?provider=…&dest=… (klik se šteje);
 *  - custom postanek → enake ponudbe brez dest parametra (partnerjeva
 *    splošna iskanja — iskreno match:"custom").
 * Gorivo NI rezervacijska kategorija (odprti podatki, 0 %) — nikoli
 * ni del partnerskega iskanja.
 */
export function searchPartnerOffers(
  stopSlug: string | null | undefined
): PartnerOffer[] {
  const slug =
    typeof stopSlug === "string" ? stopSlug.trim().toLowerCase() : "";
  const out: PartnerOffer[] = [];
  for (const provider of AFFILIATE_PROVIDERS) {
    if (!PARTNER_SEARCH_CATEGORIES.includes(provider.category)) continue;
    out.push(toPartnerOffer(provider, slug));
  }
  return out;
}

/**
 * Razreši ENO partner ponudbo (strežniška razrešitev za POST): provider
 * in destinacijo potrdita REGISTER oz. KANONSKI nabor — klient nikoli
 * ne prinese imena partnerja, povezave ali kategorije.
 */
export function resolvePartnerOffer(
  providerId: string,
  destinationSlug: string | null | undefined
): PartnerOffer | null {
  const provider = getProvider(providerId);
  if (!provider) return null;
  if (!PARTNER_SEARCH_CATEGORIES.includes(provider.category)) return null;
  const slug =
    typeof destinationSlug === "string"
      ? destinationSlug.trim().toLowerCase()
      : "";
  if (slug && !getDestination(slug)) return null;
  return toPartnerOffer(provider, slug);
}

// ─── PARTNER kanal — življenjski cikel (PENDING → CONFIRMED → …) ───────────

/** Zapis partner rezervacije (živi v stolpcu `note` kot JSON). */
export interface PartnerBookingRecord {
  /** Registrski ID partnerja (AFFILIATE_PROVIDERS). */
  provider: AffiliateProviderId;
  providerName: string;
  category: AffiliateCategory;
  /** Kanonski slug destinacije ("" za custom postanek). */
  destinationSlug: string;
  /** Iskalno ime destinacije (iz kanona; "" za custom). */
  destinationName: string;
  date: string;
  people: number;
  name: string | null;
  /** Življenjski cikel: PENDING → CONFIRMED → MODIFIED / CANCELLED. */
  status: ConfirmationStatus;
  channel: "partner";
  /** IZRECNI razkritji kanala (nikoli brez oznake). */
  partner: true;
  /** Številka rezervacije partnerja (ob uporabnikovi atestaciji; sicer null). */
  providerBookingId: string | null;
  /** Uporabnikova atestacija cene iz partnerjevega potrdila (EUR; sicer null). */
  confirmedPrice: number | null;
  createdAt: string;
}

export type PartnerBookingResult =
  | { ok: true; booking: PartnerBookingRecord }
  | { ok: false; error: string };

/**
 * Ustvari partner rezervacijo — status PENDING (iskreno: potrditev
 * izstavi partner NA SVOJI STRANI; aplikacija stanja NE pozna, dokler
 * ga uporabnik ne atestira s partnerjevim potrdilom — vzorec MindTrip
 * „pending"). Dejanska rezervacija se zgodi pri partnerju (vodena
 * povezava); ta zapis je sledenje v Moja potovanja.
 */
export function createPartnerBooking(
  offer: PartnerOffer,
  input: { date: string; people: number; name?: string | null },
  now: Date = new Date()
): PartnerBookingResult {
  const v = validateDemoBookingFields(input.date, input.people, input.name);
  if (!v.ok) return v;
  const people = input.people as number;
  const name =
    typeof input.name === "string" && input.name.trim() ? input.name.trim() : null;
  return {
    ok: true,
    booking: {
      provider: offer.providerId,
      providerName: offer.providerName,
      category: offer.category,
      destinationSlug: offer.destinationSlug,
      destinationName: offer.destinationName,
      date: input.date as string,
      people,
      name,
      status: "PENDING",
      channel: "partner",
      partner: true,
      providerBookingId: null,
      confirmedPrice: null,
      createdAt: now.toISOString(),
    },
  };
}

/**
 * Potrdi partner rezervacijo z ATESTACIJO iz partnerjevega potrdila
 * (PENDING → CONFIRMED): številka rezervacije + cena iz potrdila sta
 * OBVEZNI — prek kanonskega validateConfirmationRecord (ISTI kanon kot
 * uporabniška atestacija 51-c: klient NE MORE ponarediti „potrjeno").
 */
export function confirmPartnerBooking(
  booking: PartnerBookingRecord,
  attestation: { providerBookingId: string; confirmedPrice: number }
): PartnerBookingResult {
  if (booking.status !== "PENDING") {
    return {
      ok: false,
      error: `Potrditev je mogoča samo iz statusa PENDING (sedaj: ${booking.status}).`,
    };
  }
  const canon = validateConfirmationRecord({
    status: "CONFIRMED",
    source: "USER",
    providerBookingId: attestation.providerBookingId,
    confirmedPrice: attestation.confirmedPrice,
  });
  if (!canon.ok) return { ok: false, error: canon.error };
  const t = assertTransition(booking.status, "CONFIRMED");
  if (!t.ok) return t;
  return {
    ok: true,
    booking: {
      ...booking,
      status: "CONFIRMED",
      providerBookingId: attestation.providerBookingId.trim(),
      confirmedPrice: attestation.confirmedPrice,
    },
  };
}

export type PartnerBookingChange = {
  date?: string;
  people?: number;
  name?: string | null;
};

/**
 * Spremeni partner rezervacijo — DEJANSKA sprememba teče PRI PARTNERJU
 * (UI ponuja iskreno povezavo „Upravljaj pri partnerju"); tu vodimo
 * samo stanje:
 *  - PENDING → polja se posodobijo, status OSTANE PENDING (sprememba
 *    lahko prestavi partnerjevo potrditev — iskreno);
 *  - CONFIRMED/MODIFIED → prehod v MODIFIED (kanon ALLOWED_TRANSITIONS).
 */
export function modifyPartnerBooking(
  booking: PartnerBookingRecord,
  change: PartnerBookingChange
): PartnerBookingResult {
  if (
    booking.status === "CANCELLED" ||
    booking.status === "REFUNDED" ||
    booking.status === "EXPIRED"
  ) {
    return {
      ok: false,
      error: `Rezervacija je v terminalnem statusu (${booking.status}) — sprememba ni mogoča.`,
    };
  }
  const date = change.date ?? booking.date;
  const people = change.people ?? booking.people;
  const name = change.name !== undefined ? change.name : booking.name;
  const v = validateDemoBookingFields(date, people, name);
  if (!v.ok) return v;

  let status = booking.status;
  if (booking.status === "CONFIRMED" || booking.status === "MODIFIED") {
    const t = assertTransition(booking.status, "MODIFIED");
    if (!t.ok) return t;
    status = "MODIFIED";
  }
  return {
    ok: true,
    booking: {
      ...booking,
      date: date as string,
      people: people as number,
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      status,
    },
  };
}

/**
 * Prekliči partner rezervacijo — DEJANSKI preklic teče PRI PARTNERJU
 * (UI ponuja povezavo); tu le pošteno stanje. PENDING/CONFIRMED/
 * MODIFIED → CANCELLED (terminalen — brez povratkov, kanon faze 3).
 */
export function cancelPartnerBooking(
  booking: PartnerBookingRecord
): PartnerBookingResult {
  const t = assertTransition(booking.status, "CANCELLED");
  if (!t.ok) return t;
  return { ok: true, booking: { ...booking, status: "CANCELLED" } };
}

// ─── Partner zapis v stolpcu `note` (S1-združljiv) ──────────────────────────

/**
 * Zgradi JSON partner zapisa za stolpec `note`. Oblika je ZDRUŽLJIVA z
 * atestacijskim JSON (source/providerBookingId/confirmedPrice) PLUS
 * izrecna partner razkritja (channel:"partner", partner:true, provider,
 * category …) — obstoječi parseAttestationNote jo brez težav razčleni
 * (dodatna polja ignorira).
 */
export function buildPartnerNote(booking: PartnerBookingRecord): string {
  return JSON.stringify({
    source: "USER" as const,
    channel: "partner" as const,
    partner: true as const,
    provider: booking.provider,
    providerName: booking.providerName,
    category: booking.category,
    destinationSlug: booking.destinationSlug,
    destinationName: booking.destinationName,
    date: booking.date,
    people: booking.people,
    name: booking.name ?? "",
    status: booking.status,
    providerBookingId: booking.providerBookingId ?? "",
    ...(booking.confirmedPrice != null ? { confirmedPrice: booking.confirmedPrice } : {}),
    createdAt: booking.createdAt,
  });
}

/**
 * Strogi parser partner zapisa iz stolpca `note` (fail-closed): zahteva
 * IZRECNI partner razkritji (channel:"partner" + partner:true) in vsa
 * ključna polja; karkoli manjka → null (klicar naj zapis obravnava kot
 * navadno atestacijo/legacy opombo — nikoli ne ugiba, da je partner).
 * Kanon invarianta: status CONFIRMED ZAHTEVA številko IN ceno.
 */
export function parsePartnerNote(
  note: string | null | undefined
): PartnerBookingRecord | null {
  if (typeof note !== "string" || note.length === 0 || !note.startsWith("{")) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(note);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const o = parsed as Record<string, unknown>;

  // Izrecni partner razkritvi sta obvezni (iskrenost: brez oznak ni partner).
  if (o.channel !== "partner" || o.partner !== true) return null;
  if (typeof o.provider !== "string") return null;
  const provider = getProvider(o.provider);
  if (!provider) return null;
  if (o.providerName !== provider.name) return null;
  if (o.category !== provider.category) return null;
  if (typeof o.destinationSlug !== "string") return null;
  if (typeof o.destinationName !== "string") return null;
  if (!isValidBookingDate(o.date)) return null;
  if (
    typeof o.people !== "number" ||
    !Number.isInteger(o.people) ||
    o.people < BOOKING_PEOPLE_MIN ||
    o.people > BOOKING_PEOPLE_MAX
  ) {
    return null;
  }
  const status = o.status;
  if (typeof status !== "string" || !isConfirmationStatus(status)) return null;
  if (typeof o.providerBookingId !== "string") return null;
  if (o.providerBookingId.length > MAX_PARTNER_REF_LENGTH) return null;
  if (o.confirmedPrice !== undefined) {
    if (
      typeof o.confirmedPrice !== "number" ||
      !Number.isFinite(o.confirmedPrice) ||
      o.confirmedPrice <= 0 ||
      o.confirmedPrice > MAX_PARTNER_PRICE
    ) {
      return null;
    }
  }
  if (typeof o.createdAt !== "string" || o.createdAt.length === 0) return null;

  // Kanon invarianta: CONFIRMED brez številke/cene NI partner zapis.
  if (status === "CONFIRMED" && (o.providerBookingId === "" || o.confirmedPrice === undefined)) {
    return null;
  }

  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : null;
  const price =
    typeof o.confirmedPrice === "number" && o.confirmedPrice > 0
      ? o.confirmedPrice
      : null;
  const ref = o.providerBookingId.length > 0 ? o.providerBookingId : null;

  return {
    provider: provider.id,
    providerName: provider.name,
    category: provider.category,
    destinationSlug: o.destinationSlug,
    destinationName: o.destinationName,
    date: o.date,
    people: o.people,
    name,
    status: status as ConfirmationStatus,
    channel: "partner",
    partner: true,
    providerBookingId: ref,
    confirmedPrice: price,
    createdAt: o.createdAt,
  };
}

// ─── PARTNER kanal — validacija teles (POST/PATCH, čisti funkciji) ──────────

/** Največja dolžina številke rezervacije partnerja (kanon MAX_BOOKING_ID_LENGTH). */
export const MAX_PARTNER_REF_LENGTH = 200;

/** Zgornja meja atestirane cene (kanon MAX_CONFIRMED_PRICE). */
export const MAX_PARTNER_PRICE = 1_000_000;

/** Normalizirana oblika telesa POST partner veje. */
export interface PartnerRequestBody {
  dayIndex: number;
  stopSlug: string | null;
  stopName: string | null;
  provider: AffiliateProviderId;
  /** Kanonski slug destinacije ponudbe (null za custom postanek). */
  destinationSlug: string | null;
  date: string;
  people: number;
  name: string | null;
}

export type PartnerRequestValidation =
  | { ok: true; value: PartnerRequestBody }
  | { ok: false; error: string };

/**
 * Validacija telesa POST partner veje. ISKRENOST:
 *  - provider in destinationSlug razreši SAMO register/kanon (klient ne
 *    prinese imena partnerja niti povezave);
 *  - telo NE SME nositi številke rezervacije niti cene — ti sta
 *    uporabnikova atestacija ob PATCH confirm (nikoli ob ustvarjanju).
 */
export function validatePartnerRequestBody(body: unknown): PartnerRequestValidation {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Neveljavno telo zahteve (pričakovan objekt)." };
  }
  const b = body as Record<string, unknown>;

  if (b.channel !== "partner") {
    return { ok: false, error: 'Partner veja zahteva channel:"partner".' };
  }
  if (
    b.providerBookingId != null ||
    b.confirmedPrice != null ||
    b.confirmationUrl != null ||
    b.bookingRef != null ||
    b.price != null
  ) {
    return {
      ok: false,
      error:
        "Partner telo ne sme nositi številke rezervacije niti cene — ti sta uporabnikova atestacija ob potrditvi (PATCH confirm).",
    };
  }
  if (typeof b.provider !== "string" || !getProvider(b.provider)) {
    return { ok: false, error: "Neznan rezervacijski partner." };
  }
  const provider = getProvider(b.provider)!;
  if (!PARTNER_SEARCH_CATEGORIES.includes(provider.category)) {
    return { ok: false, error: "Ta partner ni rezervacijska kategorija." };
  }

  const fields = validateDemoBookingFields(b.date, b.people, b.name);
  if (!fields.ok) return fields;

  let destinationSlug: string | null = null;
  if (
    b.destinationSlug !== undefined &&
    b.destinationSlug !== null &&
    b.destinationSlug !== ""
  ) {
    if (typeof b.destinationSlug !== "string") {
      return {
        ok: false,
        error: "Neznana destinacija ponudbe (destinationSlug mora biti iz kanonskega nabora).",
      };
    }
    // Normaliziraj NAJPREJ (trim + lowercase) — nato kanonska preverba.
    const normalized = b.destinationSlug.trim().toLowerCase();
    if (!normalized || !getDestination(normalized)) {
      return {
        ok: false,
        error: "Neznana destinacija ponudbe (destinationSlug mora biti iz kanonskega nabora).",
      };
    }
    destinationSlug = normalized;
  }

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
      provider: provider.id,
      destinationSlug,
      date: b.date as string,
      people: b.people as number,
      name,
    },
  };
}

/** Normalizirana oblika telesa PATCH partner veje. */
export interface PartnerPatchBody {
  reservationId: string;
  action: "confirm" | "cancel" | "modify";
  /** Številka iz partnerjevega potrdila (samo action:"confirm"). */
  providerBookingId?: string;
  /** Cena iz partnerjevega potrdila EUR (samo action:"confirm"). */
  confirmedPrice?: number;
  date?: string;
  people?: number;
  name?: string | null;
}

export type PartnerPatchValidation =
  | { ok: true; value: PartnerPatchBody }
  | { ok: false; error: string };

/** Validacija telesa PATCH partner veje (confirm | cancel | modify). */
export function validatePartnerPatchBody(body: unknown): PartnerPatchValidation {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Neveljavno telo zahteve (pričakovan objekt)." };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.reservationId !== "string" || b.reservationId.length === 0) {
    return { ok: false, error: "Manjka id rezervacije." };
  }
  if (b.action !== "confirm" && b.action !== "cancel" && b.action !== "modify") {
    return {
      ok: false,
      error: 'Dejanje partner rezervacije mora biti "confirm", "cancel" ali "modify".',
    };
  }

  const out: PartnerPatchBody = {
    reservationId: b.reservationId,
    action: b.action,
  };

  if (b.action === "confirm") {
    if (typeof b.providerBookingId !== "string" || !b.providerBookingId.trim()) {
      return {
        ok: false,
        error: "Za potrditev vnesi številko rezervacije iz partnerjevega potrdila.",
      };
    }
    if (b.providerBookingId.trim().length > MAX_PARTNER_REF_LENGTH) {
      return {
        ok: false,
        error: `Številka rezervacije je predolga (največ ${MAX_PARTNER_REF_LENGTH} znakov).`,
      };
    }
    if (
      typeof b.confirmedPrice !== "number" ||
      !Number.isFinite(b.confirmedPrice) ||
      b.confirmedPrice <= 0 ||
      b.confirmedPrice > MAX_PARTNER_PRICE
    ) {
      return {
        ok: false,
        error: "Cena iz partnerjevega potrdila mora biti pozitivno število (EUR).",
      };
    }
    out.providerBookingId = b.providerBookingId.trim();
    out.confirmedPrice = b.confirmedPrice;
    return { ok: true, value: out };
  }

  if (b.action === "modify") {
    if (b.providerBookingId != null || b.confirmedPrice != null) {
      return {
        ok: false,
        error: "Sprememba ne spreminja atestacije — številko/ceno partnerja se potrdi enkrat (confirm).",
      };
    }
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
        return {
          ok: false,
          error: `Ime na rezervaciji je predolgo (največ ${BOOKING_NAME_MAX} znakov).`,
        };
      }
      out.name = b.name;
    }
  }

  return { ok: true, value: out };
}

// ─── Kanal obstoječe rezervacije (razkritje v UI/GET) ──────────────────────

/** Kanal obstoječe rezervacije (demo simulator / uporabniška atestacija / realni provider / partner). */
export type ReservationChannel = "demo" | "user" | "real" | "partner";

/** Oznake kanalov rezervacij za UI. */
export const RESERVATION_CHANNEL_LABELS: Record<ReservationChannel, { sl: string; en: string }> = {
  demo: { sl: "Demo", en: "Demo" },
  user: { sl: "Uporabniška", en: "User" },
  real: { sl: "Realna", en: "Real" },
  partner: { sl: "Partner", en: "Partner" },
};

/**
 * Kanal obstoječe rezervacije iz zapisa `note`:
 *  - demo marker (channel:"demo" / demo:true / predpona DSA-DEMO-) → "demo";
 *  - partner marker (channel:"partner" / partner:true) → "partner"
 *    (PREJ od izvora — partner zapis nosi source:"USER", a je kanal
 *    izrecno partner; razkritje kanala je VEDNO močnejše od izvora);
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
  if (o.channel === "partner" || o.partner === true) {
    return "partner";
  }
  if (o.source === "PROVIDER") return "real";
  if (o.source === "USER" || o.source === "IMPORTED") return "user";
  return null;
}
