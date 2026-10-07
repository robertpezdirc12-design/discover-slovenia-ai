/**
 * PARTNER BOOKING — testna vrata za PARTNER kanal rezervacijske verige
 * (2.6.0, issue #1 dokončanje po vzorcu MindTrip).
 * ============================================================================
 *  - kanal „partner" je tretji, zavestno dodani kanal (real | demo | partner);
 *  - iskanje ponudb IZKLJUČNO iz registra AFFILIATE_PROVIDERS (5 rezervacijskih
 *    partnerjev; gorivo osm-fuel NI rezervacijska kategorija);
 *  - življenjski cikel: PENDING (rezervacija se zgodi PRI partnerju) →
 *    CONFIRMED (uporabnikova atestacija s številko + ceno iz potrdila) →
 *    MODIFIED/CANCELLED (dejavna sprememba teče pri partnerju — tu le stanje);
 *  - note round-trip (buildPartnerNote → parsePartnerNote) je STROG
 *    fail-closed parser: CONFIRMED zahteva številko IN ceno (kanon);
 *  - reservationChannelOf razkrije „partner" PREJ kot source:"USER"
 *    (razkritje kanala je močnejše od izvora);
 *  - validacija POST/PATCH teles kot čisti funkciji (klient NE MORE prinesti
 *    številke rezervacije niti cene ob ustvarjanju — ti sta atestacija).
 *
 * 0 omrežja, 0 DB — samo čiste funkcije (hišni kanon testov).
 */

import { describe, expect, test } from "bun:test";

import {
  BOOKING_CHANNELS,
  CHANNEL_LABELS,
  MAX_PARTNER_PRICE,
  MAX_PARTNER_REF_LENGTH,
  RESERVATION_CHANNEL_LABELS,
  buildPartnerNote,
  cancelPartnerBooking,
  confirmPartnerBooking,
  createPartnerBooking,
  isBookingChannel,
  modifyPartnerBooking,
  parsePartnerNote,
  reservationChannelOf,
  resolvePartnerOffer,
  searchPartnerOffers,
  validatePartnerRequestBody,
  validatePartnerPatchBody,
  type PartnerBookingRecord,
} from "../src/lib/journey/booking-provider";
import {
  buildAttestationNote,
  canTransition,
  isTerminal,
  parseAttestationNote,
} from "../src/lib/journey/booking";
import { buildDemoNote, createDemoBooking, resolveDemoOffer } from "../src/lib/journey/booking-provider";
import { AFFILIATE_PROVIDERS, getProvider } from "../src/lib/affiliate-providers";

const NOW = new Date("2026-10-07T10:00:00Z");

/** Veljavna ponudba Booking.com za Bled (razrešena iz registra — ne izmišljena). */
const bledBookingOffer = () => resolvePartnerOffer("booking", "bled")!;

/** Sveža PENDING partner rezervacija (isti vnos → isti zapis). */
function pendingBooking(): PartnerBookingRecord {
  const r = createPartnerBooking(
    bledBookingOffer(),
    { date: "2026-07-01", people: 2, name: "Ana Novak" },
    NOW
  );
  if (!r.ok) throw new Error("setup: partner rezervacija mora uspeti");
  return r.booking;
}

/** Sveža CONFIRMED partner rezervacija (atestacija iz partnerjevega potrdila). */
function confirmedBooking(): PartnerBookingRecord {
  const r = confirmPartnerBooking(pendingBooking(), {
    providerBookingId: "BK-2026-114",
    confirmedPrice: 189.9,
  });
  if (!r.ok) throw new Error("setup: potrditev partner rezervacije mora uspeti");
  return r.booking;
}

/** Partner note z eno mutacijo JSON telesa (fail-closed testi parserja). */
function mutatedNote(
  b: PartnerBookingRecord,
  mutate: (o: Record<string, unknown>) => void
): string {
  const o = JSON.parse(buildPartnerNote(b)) as Record<string, unknown>;
  mutate(o);
  return JSON.stringify(o);
}

// ─── 1. Kanali (zavestna razširitev 2.6.0 na trije) ─────────────────────────

describe("partner-booking: kanali (real | demo | partner — trije, strogo ločeni)", () => {
  test("BOOKING_CHANNELS so natančno real, demo, partner (razširitev 2.6.0)", () => {
    // Zaklep je bil posodobljen iz ["real","demo"] — kanal se je ZAVESTNO
    // razširil (partner = realna rezervacija pri partnerju, provizijsko).
    expect([...BOOKING_CHANNELS]).toEqual(["real", "demo", "partner"]);
  });

  test("isBookingChannel sprejme partner; lažni kanali odpovejo", () => {
    expect(isBookingChannel("partner")).toBe(true);
    expect(isBookingChannel("real")).toBe(true);
    expect(isBookingChannel("demo")).toBe(true);
    expect(isBookingChannel("affiliate")).toBe(false);
    expect(isBookingChannel("PARTNER")).toBe(false);
    expect(isBookingChannel("")).toBe(false);
  });

  test("oznaki partner kanala za UI obstajata (SL kanon + EN prevod)", () => {
    expect(CHANNEL_LABELS.partner.sl.length).toBeGreaterThan(0);
    expect(CHANNEL_LABELS.partner.en.length).toBeGreaterThan(0);
    expect(RESERVATION_CHANNEL_LABELS.partner).toEqual({ sl: "Partner", en: "Partner" });
    // Vseh štirih kanalov rezervacij oznake so popolne (nikoli undefined).
    for (const ch of ["demo", "user", "real", "partner"] as const) {
      expect(RESERVATION_CHANNEL_LABELS[ch].sl.length).toBeGreaterThan(0);
      expect(RESERVATION_CHANNEL_LABELS[ch].en.length).toBeGreaterThan(0);
    }
  });
});

// ─── 2. searchPartnerOffers (iskanje IZKLJUČNO po registru partnerjev) ─────

describe("partner-booking: searchPartnerOffers (register je edini vir ponudb)", () => {
  test("bled → 5 ponudb, vsaka z vodeno povezavo /api/affiliate/go?provider=…&dest=bled", () => {
    const offers = searchPartnerOffers("bled");
    expect(offers.length).toBe(5);
    for (const o of offers) {
      expect(o.goPath).toBe(`/api/affiliate/go?provider=${o.providerId}&dest=bled`);
      expect(o.match).toBe("destination");
      expect(o.destinationSlug).toBe("bled");
      expect(o.destinationName).toBe("Bled"); // kanonsko ime, neprazno
    }
  });

  test("kategorije: natanko stays/experiences/flights/car/transfers (po registru); NI goriva", () => {
    const offers = searchPartnerOffers("bled");
    expect(offers.map((o) => o.category)).toEqual([
      "stays",
      "experiences",
      "flights",
      "car",
      "transfers",
    ]);
    // Gorivo (osm-fuel) NI rezervacijska kategorija — nikoli v iskanju.
    expect(offers.some((o) => o.category === "fuel")).toBe(false);
    expect(offers.some((o) => o.providerId === "osm-fuel")).toBe(false);
    // Vrsta red = vrsta (zmrznjenega) registra — abecedno po ID-jih.
    expect(offers.map((o) => o.providerId)).toEqual([
      "booking",
      "getyourguide",
      "kiwi",
      "rentalcars",
      "omio",
    ]);
  });

  test("flights ponudba (kiwi) nosi letališče regije (Bled/gorenjska → LJU)", () => {
    const flights = searchPartnerOffers("bled").find((o) => o.category === "flights");
    expect(flights).toBeDefined();
    expect(flights!.providerId).toBe("kiwi");
    expect(flights!.airport).toEqual({
      code: "LJU",
      name: "Letališče Jožeta Pučnika Ljubljana",
    });
    // Regija se spoštuje tudi drugje: Piran/primorska → TRS, Maribor/stajerska → GRZ.
    expect(searchPartnerOffers("piran").find((o) => o.category === "flights")!.airport!.code).toBe("TRS");
    expect(searchPartnerOffers("maribor").find((o) => o.category === "flights")!.airport!.code).toBe("GRZ");
    // Neflights kategorije letališča ne nosijo (ni izmišljenih letališč).
    for (const o of searchPartnerOffers("bled")) {
      if (o.category !== "flights") expect(o.airport).toBeNull();
    }
  });

  test("custom postanek (null/prazen/neznan) → match custom, goPath BREZ dest parametra", () => {
    for (const slug of [null, "", "   ", "atlantida"]) {
      const offers = searchPartnerOffers(slug);
      expect(offers.length).toBe(5);
      for (const o of offers) {
        expect(o.match).toBe("custom");
        expect(o.goPath).toBe(`/api/affiliate/go?provider=${o.providerId}`);
        expect(o.goPath.includes("dest=")).toBe(false);
        expect(o.destinationSlug).toBe("");
        expect(o.destinationName).toBe("");
        // Custom postanek nima znanega letališča — tudi flights ostane brez.
        if (o.category === "flights") expect(o.airport).toBeNull();
      }
    }
  });

  test("vrstni red je determinističen (isti klic → isti izpis)", () => {
    const a = searchPartnerOffers("bled");
    const b = searchPartnerOffers("bled");
    expect(a).toEqual(b);
    // Tudi imena/kategorije se ne spreminjajo med klici (registra ne mešamo).
    expect(a.map((o) => o.providerName)).toEqual(b.map((o) => o.providerName));
  });

  test("komisijski odstotki pozitivni (pogodbena ocena — razkritje, ne obljuba)", () => {
    for (const o of searchPartnerOffers("bled")) {
      expect(o.commissionPct).toBeGreaterThan(0);
      // Odstotek je 1:1 iz registra (brez izmišljenih števil).
      expect(o.commissionPct).toBe(getProvider(o.providerId)!.commissionPct);
    }
    // Konkretno stanje registra 2.5.0/2.6.0 (5 rezervacijskih partnerjev).
    expect(searchPartnerOffers("bled").map((o) => [o.providerId, o.commissionPct])).toEqual([
      ["booking", 6],
      ["getyourguide", 8],
      ["kiwi", 3],
      ["rentalcars", 6],
      ["omio", 4],
    ]);
  });
});

// ─── 3. resolvePartnerOffer (razrešitev izključno iz registra/kanona) ───────

describe("partner-booking: resolvePartnerOffer (server-side razrešitev ponudbe)", () => {
  test("veljaven provider + destinacija → ponudba (match destination)", () => {
    const o = resolvePartnerOffer("booking", "bled");
    expect(o).not.toBeNull();
    expect(o!.providerId).toBe("booking");
    expect(o!.providerName).toBe("Booking.com");
    expect(o!.category).toBe("stays");
    expect(o!.destinationSlug).toBe("bled");
    expect(o!.match).toBe("destination");
    expect(o!.goPath).toBe("/api/affiliate/go?provider=booking&dest=bled");
  });

  test("neznan provider → null; osm-fuel (gorivo) NI rezervacijski partner → null", () => {
    expect(resolvePartnerOffer("neznan", "bled")).toBeNull();
    expect(resolvePartnerOffer("", "bled")).toBeNull();
    // Gorivo je registrski vnos, a ne rezervacijska kategorija.
    expect(getProvider("osm-fuel")).not.toBeNull();
    expect(resolvePartnerOffer("osm-fuel", "bled")).toBeNull();
  });

  test("neveljaven dest slug → null (kanonski nabor je edini vir destinacij)", () => {
    expect(resolvePartnerOffer("booking", "ne-obstaja")).toBeNull();
    expect(resolvePartnerOffer("booking", "atlantida")).toBeNull();
  });

  test("prazen dest (null) → veljavna splošna ponudba (match custom, brez dest)", () => {
    const o = resolvePartnerOffer("omio", null);
    expect(o).not.toBeNull();
    expect(o!.match).toBe("custom");
    expect(o!.destinationSlug).toBe("");
    expect(o!.goPath).toBe("/api/affiliate/go?provider=omio");
    expect(o!.goPath.includes("dest=")).toBe(false);
  });
});

// ─── 4. createPartnerBooking (PENDING — iskreno čakanje na partnerja) ───────

describe("partner-booking: createPartnerBooking (status PENDING ob ustvarjanju)", () => {
  test("veljaven vnos → PENDING, kanal partner, BREZ številke in cene", () => {
    const r = createPartnerBooking(
      bledBookingOffer(),
      { date: "2026-07-01", people: 2, name: " Ana Novak " },
      NOW
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const b = r.booking;
    expect(b.status).toBe("PENDING");
    expect(b.channel).toBe("partner");
    expect(b.partner).toBe(true); // izrecno razkritje kanala
    expect(b.providerBookingId).toBeNull(); // številko izstavi partner
    expect(b.confirmedPrice).toBeNull(); // ceno določi partner na svoji strani
    expect(b.provider).toBe("booking");
    expect(b.providerName).toBe("Booking.com");
    expect(b.category).toBe("stays");
    expect(b.destinationSlug).toBe("bled");
    expect(b.destinationName).toBe("Bled");
    expect(b.name).toBe("Ana Novak"); // obrezan in obremenjen
    expect(b.people).toBe(2);
  });

  test("neveljaven datum/ljudje/ime → ok:false s slovenskim sporočilom", () => {
    const bad = (input: { date: unknown; people: unknown; name?: unknown }) =>
      createPartnerBooking(
        bledBookingOffer(),
        input as { date: string; people: number; name?: string | null }
      );
    const cases = [
      bad({ date: "2026-02-30", people: 2 }), // februar nima 30
      bad({ date: "01.07.2026", people: 2 }), // ni ISO
      bad({ date: "2026-07-01", people: 0 }),
      bad({ date: "2026-07-01", people: 13 }),
      bad({ date: "2026-07-01", people: 2.5 }),
      bad({ date: "2026-07-01", people: "2" }),
      bad({ date: "2026-07-01", people: 2, name: "x".repeat(121) }),
      bad({ date: "2026-07-01", people: 2, name: 42 as unknown as string }),
    ];
    for (const c of cases) {
      expect(c.ok).toBe(false);
      if (c.ok) return;
      expect(c.error.length).toBeGreaterThan(5); // slovensko sporočilo, ne null
    }
  });

  test("datum ostane ISO YYYY-MM-DD; createdAt iz injiciranega `now`", () => {
    const r = createPartnerBooking(
      bledBookingOffer(),
      { date: "2028-02-29", people: 1 },
      NOW
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.booking.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.booking.date).toBe("2028-02-29");
    expect(r.booking.createdAt).toBe(NOW.toISOString());
    // Ime ni obvezno — null je iskreno shranjen (ne prazni niz).
    expect(r.booking.name).toBeNull();
  });
});

// ─── 5. confirmPartnerBooking (atestacija iz partnerjevega potrdila) ────────

describe("partner-booking: confirmPartnerBooking (PENDING → CONFIRMED prek atestacije)", () => {
  test("PENDING + veljavna atestacija → CONFIRMED z zapisano številko in ceno", () => {
    const r = confirmPartnerBooking(pendingBooking(), {
      providerBookingId: "  BK-2026-114  ",
      confirmedPrice: 189.9,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.booking.status).toBe("CONFIRMED");
    expect(r.booking.providerBookingId).toBe("BK-2026-114"); // obrezan
    expect(r.booking.confirmedPrice).toBe(189.9);
    // Kanon prehoda: PENDING → CONFIRMED je dovoljen (booking.ts).
    expect(canTransition("PENDING", "CONFIRMED")).toBe(true);
    // Ostala polja ostanejo stabilna (ista rezervacija).
    expect(r.booking.provider).toBe("booking");
    expect(r.booking.destinationSlug).toBe("bled");
    expect(r.booking.date).toBe("2026-07-01");
  });

  test("PENDING + PRAZNA številka → ok:false (kanon: CONFIRMED zahteva številko)", () => {
    const empty = confirmPartnerBooking(pendingBooking(), {
      providerBookingId: "",
      confirmedPrice: 100,
    });
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.error.length).toBeGreaterThan(5);
    // Samo presledki so ravno tako prazni (po obrezovanju).
    const spaces = confirmPartnerBooking(pendingBooking(), {
      providerBookingId: "   ",
      confirmedPrice: 100,
    });
    expect(spaces.ok).toBe(false);
  });

  test("cena ≤ 0 → ok:false (cena mora biti pozitivna)", () => {
    for (const price of [0, -1, -0.01]) {
      const r = confirmPartnerBooking(pendingBooking(), {
        providerBookingId: "BK-2026-114",
        confirmedPrice: price,
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.length).toBeGreaterThan(5);
    }
  });

  test("že CONFIRMED → ok:false (potrditev je mogoča SAMO iz PENDING)", () => {
    const again = confirmPartnerBooking(confirmedBooking(), {
      providerBookingId: "BK-DRUGA-555",
      confirmedPrice: 99,
    });
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error).toContain("PENDING");
  });

  test("kontrolni znaki v številki → ok:false (kanon validateConfirmationRecord)", () => {
    for (const ref of ["BK\t2026", "BK\n1", "BK\r2", "BK\u0000", "BK\u007f"]) {
      const r = confirmPartnerBooking(pendingBooking(), {
        providerBookingId: ref,
        confirmedPrice: 10,
      });
      expect(r.ok).toBe(false);
    }
  });

  test("predolga številka (> 200) → ok:false; točno 200 znakov še gre (meja)", () => {
    expect(MAX_PARTNER_REF_LENGTH).toBe(200);
    const at = confirmPartnerBooking(pendingBooking(), {
      providerBookingId: "B".repeat(200),
      confirmedPrice: 10,
    });
    expect(at.ok).toBe(true);
    const over = confirmPartnerBooking(pendingBooking(), {
      providerBookingId: "B".repeat(201),
      confirmedPrice: 10,
    });
    expect(over.ok).toBe(false);
  });

  test("cena > 1.000.000 → ok:false (sanity meja MAX_PARTNER_PRICE)", () => {
    expect(MAX_PARTNER_PRICE).toBe(1_000_000);
    const at = confirmPartnerBooking(pendingBooking(), {
      providerBookingId: "BK-2026-114",
      confirmedPrice: 1_000_000,
    });
    expect(at.ok).toBe(true);
    const over = confirmPartnerBooking(pendingBooking(), {
      providerBookingId: "BK-2026-114",
      confirmedPrice: 1_000_001,
    });
    expect(over.ok).toBe(false);
  });
});

// ─── 6. modifyPartnerBooking (dejavnost teče pri partnerju — tu le stanje) ──

describe("partner-booking: modifyPartnerBooking (PENDING ostane PENDING)", () => {
  test("PENDING → polja se posodobijo, status OSTANE PENDING (ključna invarianta)", () => {
    const r = modifyPartnerBooking(pendingBooking(), {
      date: "2026-07-05",
      people: 4,
      name: "Bine Novak",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.booking.status).toBe("PENDING"); // NI CONFIRMED/MODIFIED!
    expect(r.booking.date).toBe("2026-07-05");
    expect(r.booking.people).toBe(4);
    expect(r.booking.name).toBe("Bine Novak");
    // Atestacije še ni — številka/cena ostaneta null.
    expect(r.booking.providerBookingId).toBeNull();
    expect(r.booking.confirmedPrice).toBeNull();
  });

  test("CONFIRMED → MODIFIED (kanon ALLOWED_TRANSITIONS)", () => {
    expect(canTransition("CONFIRMED", "MODIFIED")).toBe(true);
    const r = modifyPartnerBooking(confirmedBooking(), { people: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.booking.status).toBe("MODIFIED");
    expect(r.booking.people).toBe(3);
    // Atestacija ostane prilepljena na zapis (sprememba je ne briše).
    expect(r.booking.providerBookingId).toBe("BK-2026-114");
    expect(r.booking.confirmedPrice).toBe(189.9);
  });

  test("MODIFIED → MODIFIED (samo-veriga zaporednih sprememb)", () => {
    const first = modifyPartnerBooking(confirmedBooking(), { people: 4 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = modifyPartnerBooking(first.booking, { date: "2026-07-20" });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.booking.status).toBe("MODIFIED");
    expect(second.booking.date).toBe("2026-07-20");
    expect(second.booking.people).toBe(4); // prva sprememba se ohrani
  });

  test("CANCELLED (terminalen) → ok:false brez povratkov", () => {
    const cancelled = cancelPartnerBooking(pendingBooking());
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    const r = modifyPartnerBooking(cancelled.booking, { people: 2 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("terminalnem");
  });

  test("neveljavna polja spremembe → ok:false (datum/ljudje/ime)", () => {
    expect(modifyPartnerBooking(pendingBooking(), { date: "2027-02-29" }).ok).toBe(false);
    expect(modifyPartnerBooking(pendingBooking(), { people: 0 }).ok).toBe(false);
    expect(modifyPartnerBooking(pendingBooking(), { people: 13 }).ok).toBe(false);
    expect(modifyPartnerBooking(pendingBooking(), { people: 2.5 }).ok).toBe(false);
    expect(
      modifyPartnerBooking(pendingBooking(), { name: "x".repeat(121) }).ok
    ).toBe(false);
  });
});

// ─── 7. cancelPartnerBooking (preklic pri partnerju, tu pošteno stanje) ─────

describe("partner-booking: cancelPartnerBooking (→ CANCELLED terminalen)", () => {
  test("PENDING, CONFIRMED in MODIFIED → CANCELLED", () => {
    const fromPending = cancelPartnerBooking(pendingBooking());
    expect(fromPending.ok).toBe(true);
    if (fromPending.ok) expect(fromPending.booking.status).toBe("CANCELLED");

    const fromConfirmed = cancelPartnerBooking(confirmedBooking());
    expect(fromConfirmed.ok).toBe(true);
    if (fromConfirmed.ok) expect(fromConfirmed.booking.status).toBe("CANCELLED");

    const modified = modifyPartnerBooking(confirmedBooking(), { people: 5 });
    expect(modified.ok).toBe(true);
    if (!modified.ok) return;
    const fromModified = cancelPartnerBooking(modified.booking);
    expect(fromModified.ok).toBe(true);
    if (fromModified.ok) expect(fromModified.booking.status).toBe("CANCELLED");

    // Vsi prehodi so znotraj kanonske matrike.
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("MODIFIED", "CANCELLED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
  });

  test("CANCELLED → ok:false (terminalen — brez povratkov)", () => {
    const cancelled = cancelPartnerBooking(pendingBooking());
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    const again = cancelPartnerBooking(cancelled.booking);
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error).toContain("ni dovoljen");
  });
});

// ─── 8. buildPartnerNote + parsePartnerNote (round-trip + fail-closed) ─────

describe("partner-booking: note round-trip (build → parse → enak zapis)", () => {
  test("PENDING round-trip: vsa polja enaka (številka/cena kot null)", () => {
    const b = pendingBooking();
    const again = parsePartnerNote(buildPartnerNote(b));
    expect(again).not.toBeNull();
    expect(again).toEqual(b); // cel zapis 1:1
  });

  test("CONFIRMED round-trip: vsa polja enaka (številka + cena atestacije)", () => {
    const b = confirmedBooking();
    const again = parsePartnerNote(buildPartnerNote(b));
    expect(again).not.toBeNull();
    expect(again).toEqual(b);
    expect(again!.status).toBe("CONFIRMED");
    expect(again!.providerBookingId).toBe("BK-2026-114");
    expect(again!.confirmedPrice).toBe(189.9);
    // Tudi po spremembi/preklicu round-trip ostane zvest (MODIFIED/CANCELLED).
    const m = modifyPartnerBooking(b, { people: 6 });
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(parsePartnerNote(buildPartnerNote(m.booking))).toEqual(m.booking);
    const c = cancelPartnerBooking(m.booking);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(parsePartnerNote(buildPartnerNote(c.booking))).toEqual(c.booking);
  });

  test("S1 združljivost: CONFIRMED partner note preživi parseAttestationNote", () => {
    // Partner zapis živi v istem stolpcu `note` kot atestacije (51-c) —
    // potrjen zapis je VELJAVNA uporabniška atestacija (source USER).
    const att = parseAttestationNote(buildPartnerNote(confirmedBooking()));
    expect(att).not.toBeNull();
    expect(att!.source).toBe("USER");
    expect(att!.providerBookingId).toBe("BK-2026-114");
    expect(att!.confirmedPrice).toBe(189.9);
    // PENDING (brez številke) atestacija NI — iskreno nič ponarejanja.
    expect(parseAttestationNote(buildPartnerNote(pendingBooking()))).toBeNull();
  });

  test("parser fail-closed: brez IZRECNIH partner razkritij ni partner zapisa", () => {
    // channel:"partner" brez partner:true → null.
    expect(
      parsePartnerNote(mutatedNote(pendingBooking(), (o) => { delete o.partner; }))
    ).toBeNull();
    // partner:true sam (brez channel) → null.
    expect(
      parsePartnerNote(mutatedNote(pendingBooking(), (o) => { delete o.channel; }))
    ).toBeNull();
    // Napačen kanal (demo) tudi s partner:true → null (kanala se NE mešata).
    expect(
      parsePartnerNote(mutatedNote(pendingBooking(), (o) => { o.channel = "demo"; }))
    ).toBeNull();
  });

  test("parser fail-closed: provider, providerName in category morajo soglašati z registrom", () => {
    // Neznan provider → null (samo vpisani partnerji).
    expect(
      parsePartnerNote(mutatedNote(pendingBooking(), (o) => { o.provider = "neznan"; }))
    ).toBeNull();
    // providerName, ki se ne ujema z registrom → null (ni laži o imenu!).
    expect(
      parsePartnerNote(mutatedNote(pendingBooking(), (o) => { o.providerName = "Lažni Booking"; }))
    ).toBeNull();
    // category, ki se ne ujema z registrom → null.
    expect(
      parsePartnerNote(mutatedNote(pendingBooking(), (o) => { o.category = "flights"; }))
    ).toBeNull();
  });

  test("parser fail-closed: pokvarjen JSON, ne-JSON in prazen vnos → null", () => {
    expect(parsePartnerNote('{"channel":"partner"')).toBeNull(); // pokvarjen JSON
    expect(parsePartnerNote("običajna opomba")).toBeNull(); // ne-JSON
    expect(parsePartnerNote("")).toBeNull();
    expect(parsePartnerNote(null)).toBeNull();
    expect(parsePartnerNote(undefined)).toBeNull();
    // Tabela ni partner zapis (čeprav veljaven JSON).
    expect(parsePartnerNote(JSON.stringify([{ channel: "partner" }]))).toBeNull();
  });

  test("KANON invarianta: CONFIRMED brez številke ALI brez cene → null", () => {
    // Brez številke (prazna) → null.
    expect(
      parsePartnerNote(
        mutatedNote(pendingBooking(), (o) => {
          o.status = "CONFIRMED";
          o.confirmedPrice = 100;
        })
      )
    ).toBeNull();
    // Brez cene (samo številka) → null.
    expect(
      parsePartnerNote(
        mutatedNote(pendingBooking(), (o) => {
          o.status = "CONFIRMED";
          o.providerBookingId = "BK-2026-114";
        })
      )
    ).toBeNull();
    // Kontrast: PENDING brez obeh je VELJAVEN (čakanje na partnerja).
    expect(
      parsePartnerNote(
        mutatedNote(pendingBooking(), (o) => {
          o.status = "PENDING";
        })
      )
    ).not.toBeNull();
  });

  test("parser fail-closed: slaba cena, ljudje izven 1–12, neznan status/datum → null", () => {
    const b = pendingBooking();
    // Cena ≤ 0 ali nad mejo → null.
    expect(parsePartnerNote(mutatedNote(b, (o) => { o.confirmedPrice = 0; }))).toBeNull();
    expect(parsePartnerNote(mutatedNote(b, (o) => { o.confirmedPrice = -5; }))).toBeNull();
    expect(
      parsePartnerNote(mutatedNote(b, (o) => { o.confirmedPrice = MAX_PARTNER_PRICE + 1; }))
    ).toBeNull();
    // Ljudje izven meja → null.
    expect(parsePartnerNote(mutatedNote(b, (o) => { o.people = 0; }))).toBeNull();
    expect(parsePartnerNote(mutatedNote(b, (o) => { o.people = 13; }))).toBeNull();
    expect(parsePartnerNote(mutatedNote(b, (o) => { o.people = 2.5; }))).toBeNull();
    expect(parsePartnerNote(mutatedNote(b, (o) => { o.people = "2"; }))).toBeNull();
    // Neznan status → null (kanonski nabor 14).
    expect(parsePartnerNote(mutatedNote(b, (o) => { o.status = "KVAZAR"; }))).toBeNull();
    // Koledarsko napačen datum → null (iskrenost, ne ugibanje).
    expect(parsePartnerNote(mutatedNote(b, (o) => { o.date = "2026-02-30"; }))).toBeNull();
    // Manjkajoč createdAt → null.
    expect(parsePartnerNote(mutatedNote(b, (o) => { delete o.createdAt; }))).toBeNull();
  });
});

// ─── 9. validatePartnerRequestBody (POST vrata — iskrenost telesa) ─────────

describe("partner-booking: validatePartnerRequestBody (POST vrata)", () => {
  const okBody = {
    channel: "partner",
    provider: "booking",
    date: "2026-07-01",
    people: 2,
    destinationSlug: "bled",
  };

  test("channel mora biti izrecno partner (manjka/demo/real → fail)", () => {
    expect(validatePartnerRequestBody({ ...okBody, channel: undefined }).ok).toBe(false);
    expect(validatePartnerRequestBody({ ...okBody, channel: null }).ok).toBe(false);
    expect(validatePartnerRequestBody({ ...okBody, channel: "demo" }).ok).toBe(false);
    expect(validatePartnerRequestBody({ ...okBody, channel: "real" }).ok).toBe(false);
    expect(validatePartnerRequestBody(null).ok).toBe(false);
    expect(validatePartnerRequestBody("napaka").ok).toBe(false);
  });

  test("telo NE SME nositi provider polj (številka/cena sta atestacija, ne vnos)", () => {
    expect(
      validatePartnerRequestBody({ ...okBody, providerBookingId: "BK-HAX" }).ok
    ).toBe(false);
    expect(validatePartnerRequestBody({ ...okBody, confirmedPrice: 1 }).ok).toBe(false);
    expect(validatePartnerRequestBody({ ...okBody, bookingRef: "X-1" }).ok).toBe(false);
    expect(validatePartnerRequestBody({ ...okBody, price: 99 }).ok).toBe(false);
    expect(validatePartnerRequestBody({ ...okBody, price: 0 }).ok).toBe(false);
  });

  test("neznan provider ali gorivo → fail (register je edini vir partnerjev)", () => {
    expect(validatePartnerRequestBody({ ...okBody, provider: "neznan" }).ok).toBe(false);
    expect(validatePartnerRequestBody({ ...okBody, provider: "" }).ok).toBe(false);
    // osm-fuel je v registru, a NI rezervacijska kategorija.
    expect(validatePartnerRequestBody({ ...okBody, provider: "osm-fuel" }).ok).toBe(false);
  });

  test("veljaven vnos → ok z normaliziranimi vrednostmi", () => {
    const v = validatePartnerRequestBody({
      channel: "partner",
      provider: "booking",
      date: "2026-07-01",
      people: 2,
      destinationSlug: "bled",
      stopName: "  Bled — Blejski otok  ",
      name: " Ana Novak ",
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.provider).toBe("booking");
    expect(v.value.destinationSlug).toBe("bled");
    expect(v.value.dayIndex).toBe(1); // privzet
    expect(v.value.stopSlug).toBeNull();
    expect(v.value.stopName).toBe("Bled — Blejski otok"); // obrezan
    expect(v.value.name).toBe("Ana Novak");
    expect(v.value.date).toBe("2026-07-01");
    expect(v.value.people).toBe(2);
    // Custom postanek (brez destinationSlug) je veljaven — splošna ponudba.
    const custom = validatePartnerRequestBody({
      channel: "partner",
      provider: "omio",
      date: "2026-07-01",
      people: 2,
      stopName: "Zasebni spomin",
    });
    expect(custom.ok).toBe(true);
    if (!custom.ok) return;
    expect(custom.value.destinationSlug).toBeNull();
  });

  test("destinationSlug izven kanonskega nabora → fail", () => {
    expect(
      validatePartnerRequestBody({ ...okBody, destinationSlug: "ne-obstaja" }).ok
    ).toBe(false);
    expect(
      validatePartnerRequestBody({ ...okBody, destinationSlug: "atlantida" }).ok
    ).toBe(false);
  });

  test("dayIndex meje (0/31 → fail; 1/30 → ok); stopName clamp na 200", () => {
    expect(validatePartnerRequestBody({ ...okBody, dayIndex: 0 }).ok).toBe(false);
    expect(validatePartnerRequestBody({ ...okBody, dayIndex: 31 }).ok).toBe(false);
    expect(validatePartnerRequestBody({ ...okBody, dayIndex: 1.5 }).ok).toBe(false);
    expect(validatePartnerRequestBody({ ...okBody, dayIndex: 1 }).ok).toBe(true);
    expect(validatePartnerRequestBody({ ...okBody, dayIndex: 30 }).ok).toBe(true);
    // stopName se obreže na BOOKING_STOP_NAME_MAX (200).
    const v = validatePartnerRequestBody({
      ...okBody,
      stopName: "N".repeat(250),
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.stopName!.length).toBe(200);
    // Polja datum/ljudje/ime grejo skozi isti kanon kot demo veja.
    expect(validatePartnerRequestBody({ ...okBody, date: "2026-02-30" }).ok).toBe(false);
    expect(validatePartnerRequestBody({ ...okBody, people: 13 }).ok).toBe(false);
    expect(validatePartnerRequestBody({ ...okBody, name: "x".repeat(121) }).ok).toBe(false);
  });
});

// ─── 10. validatePartnerPatchBody (PATCH vrata: confirm | cancel | modify) ──

describe("partner-booking: validatePartnerPatchBody (PATCH vrata)", () => {
  test("confirm brez številke → fail; cena 0/negativna/prevelika/ni-število → fail", () => {
    expect(
      validatePartnerPatchBody({ reservationId: "r1", action: "confirm", confirmedPrice: 100 })
        .ok
    ).toBe(false); // brez številke
    expect(
      validatePartnerPatchBody({ reservationId: "r1", action: "confirm", providerBookingId: "  " })
        .ok
    ).toBe(false); // samo presledki
    for (const price of [0, -1, 1_000_001, Number.NaN, "12", null]) {
      expect(
        validatePartnerPatchBody({
          reservationId: "r1",
          action: "confirm",
          providerBookingId: "BK-1",
          confirmedPrice: price,
        } as unknown as Record<string, unknown>).ok
      ).toBe(false);
    }
    // Predolga številka → fail (meja MAX_PARTNER_REF_LENGTH).
    expect(
      validatePartnerPatchBody({
        reservationId: "r1",
        action: "confirm",
        providerBookingId: "B".repeat(201),
        confirmedPrice: 10,
      }).ok
    ).toBe(false);
  });

  test("confirm veljaven → ok (obrezana številka + cena nespremenjena)", () => {
    const v = validatePartnerPatchBody({
      reservationId: "r1",
      action: "confirm",
      providerBookingId: "  BK-2026-114  ",
      confirmedPrice: 189.9,
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.action).toBe("confirm");
    expect(v.value.providerBookingId).toBe("BK-2026-114");
    expect(v.value.confirmedPrice).toBe(189.9);
  });

  test("modify ne spreminja atestacije (providerBookingId/confirmedPrice → fail)", () => {
    expect(
      validatePartnerPatchBody({ reservationId: "r1", action: "modify", providerBookingId: "BK-1" })
        .ok
    ).toBe(false);
    expect(
      validatePartnerPatchBody({ reservationId: "r1", action: "modify", confirmedPrice: 10 }).ok
    ).toBe(false);
    // Veljavna sprememba: datum + ljudje (posamično in skupaj).
    const v = validatePartnerPatchBody({
      reservationId: "r1",
      action: "modify",
      date: "2026-07-05",
      people: 3,
      name: null,
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.date).toBe("2026-07-05");
    expect(v.value.people).toBe(3);
    expect(v.value.name).toBeNull();
    // Neveljavna polja spremembe → fail.
    expect(
      validatePartnerPatchBody({ reservationId: "r1", action: "modify", date: "2026-02-30" }).ok
    ).toBe(false);
    expect(
      validatePartnerPatchBody({ reservationId: "r1", action: "modify", people: 2.5 }).ok
    ).toBe(false);
    expect(
      validatePartnerPatchBody({ reservationId: "r1", action: "modify", people: 13 }).ok
    ).toBe(false);
  });

  test("neznano dejanje → fail; brez reservationId → fail; cancel je ok", () => {
    expect(validatePartnerPatchBody({ reservationId: "r1", action: "rebook" }).ok).toBe(false);
    expect(validatePartnerPatchBody({ reservationId: "r1", action: "" }).ok).toBe(false);
    expect(validatePartnerPatchBody({ action: "cancel" }).ok).toBe(false);
    expect(validatePartnerPatchBody(null).ok).toBe(false);
    const v = validatePartnerPatchBody({ reservationId: "r1", action: "cancel" });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.reservationId).toBe("r1");
    expect(v.value.action).toBe("cancel");
  });
});

// ─── 11. reservationChannelOf (razkritje kanala obstoječe rezervacije) ──────

describe("partner-booking: reservationChannelOf (kanal partner razkrit PREJ kot izvor)", () => {
  test("partner note (source USER!) → kanal partner — razkritje kanala je močnejše od izvora", () => {
    // KLJUČNO: partner zapis nosi source:"USER" (S1 združljivost), a je
    // kanal IZRECNO partner — partner razkritje zmaga nad izvorom.
    const note = buildPartnerNote(pendingBooking());
    expect(JSON.parse(note).source).toBe("USER"); // predpostavka izvora
    expect(reservationChannelOf(note)).toBe("partner");
  });

  test("CONFIRMED partner note → partner; demo ostane demo; navadna atestacija → user", () => {
    expect(reservationChannelOf(buildPartnerNote(confirmedBooking()))).toBe("partner");
    // Demo zapis NIKOLI ni partner (kanala se ne mešata).
    const demo = createDemoBooking(
      resolveDemoOffer("izk-bled-pletna")!,
      { date: "2026-07-12", people: 2, name: "Ana" },
      NOW
    );
    expect(demo.ok).toBe(true);
    if (!demo.ok) return;
    expect(reservationChannelOf(buildDemoNote(demo.booking))).toBe("demo");
    // Navadna uporabniška atestacija brez kanala → user.
    expect(
      reservationChannelOf(
        buildAttestationNote({
          source: "USER",
          providerBookingId: "HOTEL-BLED-114",
          confirmedPrice: 90,
        })
      )
    ).toBe("user");
    // PROVIDER izvor ostane real (v peskovniku ne nastopi — fail-closed).
    expect(
      reservationChannelOf(
        JSON.stringify({ source: "PROVIDER", providerBookingId: "X-1", confirmedPrice: 10 })
      )
    ).toBe("real");
  });

  test("null/prazno/neznan JSON → null (iskreno brez kanala)", () => {
    expect(reservationChannelOf(null)).toBeNull();
    expect(reservationChannelOf("")).toBeNull();
    expect(reservationChannelOf("legacy opomba")).toBeNull();
    expect(reservationChannelOf('{"channel":"partner"')).toBeNull(); // pokvarjen JSON
    expect(reservationChannelOf(JSON.stringify({ hello: 1 }))).toBeNull();
  });
});

// ─── 12. E2E iskrenostna invarianta čez cel partner življenjski cikel ───────

describe("partner-booking: E2E iskrenost — cel življenjski cikel partner rezervacije", () => {
  /** Cel cikel izpeljan iz iskanja (isti koraki kot uporabniška pot). */
  function runPartnerLifecycle() {
    // 1. ISKANJE: ponudbe za postanek Bled iz registra partnerjev.
    const offers = searchPartnerOffers("bled");
    const chosen = offers.find((o) => o.providerId === "booking")!;
    // 2. USTVARJANJE: rezervacija pri partnerju → PENDING (sledenje).
    const created = createPartnerBooking(
      chosen,
      { date: "2026-07-01", people: 2, name: "Ana Novak" },
      NOW
    );
    if (!created.ok) throw new Error("setup: create");
    const pendingNote = buildPartnerNote(created.booking);
    const pendingParsed = parsePartnerNote(pendingNote);
    // 3. POTRDITEV: uporabnik atestira partnerjevo potrdilo.
    const confirmed = confirmPartnerBooking(created.booking, {
      providerBookingId: "BK-2026-114",
      confirmedPrice: 189.9,
    });
    if (!confirmed.ok) throw new Error("setup: confirm");
    const confirmedNote = buildPartnerNote(confirmed.booking);
    const confirmedParsed = parsePartnerNote(confirmedNote);
    // 4. SPREMEMBA: dejavno pri partnerju — tu status MODIFIED.
    const modified = modifyPartnerBooking(confirmed.booking, { people: 4 });
    if (!modified.ok) throw new Error("setup: modify");
    const modifiedNote = buildPartnerNote(modified.booking);
    const modifiedParsed = parsePartnerNote(modifiedNote);
    // 5. PREKLIC: dejavno pri partnerju — tu status CANCELLED (terminalen).
    const cancelled = cancelPartnerBooking(modified.booking);
    if (!cancelled.ok) throw new Error("setup: cancel");
    const cancelledNote = buildPartnerNote(cancelled.booking);
    const cancelledParsed = parsePartnerNote(cancelledNote);
    return {
      offers,
      pending: created.booking,
      pendingNote,
      pendingParsed,
      confirmed: confirmed.booking,
      confirmedNote,
      confirmedParsed,
      modified: modified.booking,
      modifiedNote,
      modifiedParsed,
      cancelled: cancelled.booking,
      cancelledNote,
      cancelledParsed,
    };
  }

  test("search → create(PENDING) → confirm(CONFIRMED) → modify(MODIFIED) → cancel(CANCELLED)", () => {
    const l = runPartnerLifecycle();
    // Faze iskrenosti: vsak korak nosi pravi status.
    expect(l.pending.status).toBe("PENDING");
    expect(l.confirmed.status).toBe("CONFIRMED");
    expect(l.modified.status).toBe("MODIFIED");
    expect(l.cancelled.status).toBe("CANCELLED");
    expect(isTerminal(l.cancelled.status)).toBe(true);
    // Atestacija je zapisana točno enkrat (ob potrditvi) in ostane pri rezervaciji.
    expect(l.pending.providerBookingId).toBeNull();
    expect(l.confirmed.providerBookingId).toBe("BK-2026-114");
    expect(l.confirmed.confirmedPrice).toBe(189.9);
    expect(l.modified.providerBookingId).toBe("BK-2026-114");
  });

  test("vsak build/parse round-trip je zvest zapisu (PENDING/CONFIRMED/MODIFIED/CANCELLED)", () => {
    const l = runPartnerLifecycle();
    expect(l.pendingParsed).toEqual(l.pending);
    expect(l.confirmedParsed).toEqual(l.confirmed);
    expect(l.modifiedParsed).toEqual(l.modified);
    expect(l.cancelledParsed).toEqual(l.cancelled);
  });

  test("kanal partner povsod (reservationChannelOf na vsaki noti) — nikoli demo/user", () => {
    const l = runPartnerLifecycle();
    expect(reservationChannelOf(l.pendingNote)).toBe("partner");
    expect(reservationChannelOf(l.confirmedNote)).toBe("partner");
    expect(reservationChannelOf(l.modifiedNote)).toBe("partner");
    expect(reservationChannelOf(l.cancelledNote)).toBe("partner");
    // Izrecni razkritvi v samih zapisih ostanejo nespremenjene.
    for (const b of [l.pending, l.confirmed, l.modified, l.cancelled]) {
      expect(b.channel).toBe("partner");
      expect(b.partner).toBe(true);
    }
  });

  test("determinizem: cel cikel dvakrat → identični artefakti (isti `now`)", () => {
    const a = runPartnerLifecycle();
    const b = runPartnerLifecycle();
    expect(a.pending).toEqual(b.pending);
    expect(a.confirmed).toEqual(b.confirmed);
    expect(a.modified).toEqual(b.modified);
    expect(a.cancelled).toEqual(b.cancelled);
    expect(a.pendingNote).toBe(b.pendingNote);
    expect(a.confirmedNote).toBe(b.confirmedNote);
    expect(a.cancelledNote).toBe(b.cancelledNote);
  });
});

// ─── 13. Iskrenostni kontrast: partner NI demo in NI real ───────────────────

describe("partner-booking: iskrenostni kontrast (partner ≠ demo ≠ real)", () => {
  test("partner ponudbe nikoli ne nosijo cene — ceno določi partner sam", () => {
    // DEMO ponudba ima ceno iz kanona; PARTNER ponudba je BREZ cene
    // (iskrenost: aplikacija cene pri partnerju NE pozna).
    for (const o of searchPartnerOffers("bled")) {
      expect("pricePerPerson" in o).toBe(false);
      expect("totalPrice" in o).toBe(false);
    }
    // Register 2.5.0/2.6.0: 5 provizijskih + 1 gorivo (izven iskanja).
    expect(AFFILIATE_PROVIDERS.length).toBe(6);
    expect(AFFILIATE_PROVIDERS.filter((p) => p.category === "fuel").length).toBe(1);
  });
});
