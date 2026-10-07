/**
 * BOOKING-PROVIDER — kanon kanalov rezervacij (issue #1 področje 2):
 *  - STROGA ločitev kanalov real | demo (real VEDNO fail-closed),
 *  - deterministični demo simulator ( isto seme → isti DSA-DEMO-XXXX ),
 *  - iskanje ponudb IZKLJUČNO iz obstoječih lastnih izdelkov (OWN_PRODUCTS),
 *  - prehodi modify/cancel SKOZI kanonski ALLOWED_TRANSITIONS (booking.ts),
 *  - demo zapis v `note` je združljiv s S1 atestacijami
 *    (parseAttestationNote preživi roundtrip),
 *  - validacijska logika APIja kot čiste funkcije (brez strežnika).
 *
 * 0 omrežja, 0 DB — samo čiste funkcije (hišni kanon testov).
 */

import { describe, expect, test } from "bun:test";

import {
  BOOKING_CHANNELS,
  CHANNEL_LABELS,
  DEMO_BOOKING_ID_RE,
  REAL_CHANNEL_FAIL_CLOSED_MESSAGE,
  buildDemoNote,
  cancelDemoBooking,
  createDemoBooking,
  demoBookingId,
  isBookingChannel,
  isValidBookingDate,
  modifyDemoBooking,
  parseDemoNote,
  realProviderStatus,
  reservationChannelOf,
  resolveDemoOffer,
  searchDemoOffers,
  validateBookingPatchBody,
  validateBookingRequestBody,
  validateDemoBookingFields,
} from "../src/lib/journey/booking-provider";
import {
  buildAttestationNote,
  canTransition,
  isTerminal,
  parseAttestationNote,
  validateConfirmationRecord,
} from "../src/lib/journey/booking";
import { OWN_PRODUCTS } from "../src/lib/trznica-data";

const OWN_IDS = new Set(OWN_PRODUCTS.map((p) => p.id));

/** Uporaben pletna offer (Bled) za teste simulatorja. */
const pletnaOffer = resolveDemoOffer("izk-bled-pletna")!;

const NOW = new Date("2026-10-07T10:00:00Z");

// ─── Kanala (real | demo) — stroga ločitev ──────────────────────────────────

describe("booking-provider: kanala (real | demo — strogo ločena)", () => {
  test("natančno dva kanala: real in demo", () => {
    expect([...BOOKING_CHANNELS]).toEqual(["real", "demo"]);
    expect(isBookingChannel("real")).toBe(true);
    expect(isBookingChannel("demo")).toBe(true);
    expect(isBookingChannel("simulator")).toBe(false);
    expect(isBookingChannel("")).toBe(false);
  });

  test("oznaki kanalov za UI (SL kanon + EN prevod)", () => {
    expect(CHANNEL_LABELS.real.sl).toBe("Realni ponudnik");
    expect(CHANNEL_LABELS.real.en).toBe("Real provider");
    expect(CHANNEL_LABELS.demo.sl).toBe("Demo simulator");
    expect(CHANNEL_LABELS.demo.en).toBe("Demo simulator");
  });

  test("realProviderStatus: VEDNO fail-closed (0 poverilnic = 0 laži)", () => {
    const s = realProviderStatus();
    expect(s.channel).toBe("real");
    expect(s.configured).toBe(false);
    expect(s.reason.length).toBeGreaterThan(20);
    // Iskrno sporočilo 503 za poskus realnega kanala je izrecno.
    expect(REAL_CHANNEL_FAIL_CLOSED_MESSAGE).toContain("nikoli ne lažemo");
  });
});

// ─── Determinizem simulatorja ────────────────────────────────────────────────

describe("booking-provider: determinizem DSA-DEMO-XXXX", () => {
  test("oblika številke: DSA-DEMO- + 4 znaki brez zamenljivih", () => {
    expect(demoBookingId("izk-bled-pletna|2026-07-12|2|Ana")).toMatch(
      DEMO_BOOKING_ID_RE
    );
    // Pripona (4 znaki) brez zamenljivih znakov (0/O, 1/I) v 200 semenskih.
    for (let i = 0; i < 200; i++) {
      const suffix = demoBookingId(`seed-${i}`).slice(-4);
      expect(suffix).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    }
  });

  test("isto seme → VEDNO isti ID (testabilen determinizem)", () => {
    const a = demoBookingId("izk-bled-pletna|2026-07-12|2|Ana");
    const b = demoBookingId("izk-bled-pletna|2026-07-12|2|Ana");
    expect(a).toBe(b);
  });

  test("različna semena → (skoraj sigurno) različna ID-ji", () => {
    const a = demoBookingId("izk-bled-pletna|2026-07-12|2|Ana");
    const b = demoBookingId("izk-bled-pletna|2026-07-13|2|Ana");
    const c = demoBookingId("izk-soca-rafting|2026-07-12|4|Bine");
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

// ─── Iskanje ponudb (samo OBSTOJEČI lastni izdelki) ─────────────────────────

describe("booking-provider: searchDemoOffers (obstoječi izdelki, iskrena povezanost)", () => {
  test("bled: natančen zadetek PRVI, vse ponudbe iz OWN_PRODUCTS, 2–4 ponudbe", () => {
    const offers = searchDemoOffers("bled");
    expect(offers.length).toBeGreaterThanOrEqual(2);
    expect(offers.length).toBeLessThanOrEqual(4);
    expect(offers[0].offerId).toBe("izk-bled-pletna");
    expect(offers[0].match).toBe("exact");
    for (const o of offers) {
      expect(OWN_IDS.has(o.offerId)).toBe(true);
      expect(o.currency).toBe("EUR");
      expect(o.pricePerPerson).toBeGreaterThan(0);
    }
  });

  test("gorenjska regija dopolni nabor (bled → bohinj/triglav/soca/kobarid), cap 4", () => {
    const offers = searchDemoOffers("bled");
    expect(offers.length).toBe(4);
    // Vse dopolnilne so „region" in iz gorenjske regije nabora.
    for (const o of offers.slice(1)) {
      expect(o.match).toBe("region");
      expect(["bohinj", "triglav", "reka-soca", "kobarid"]).toContain(o.destinationSlug);
    }
  });

  test("ljubljana (sama v regiji): ≥ 2 ponudbi — natančna + iskreno predlagana", () => {
    const offers = searchDemoOffers("ljubljana");
    expect(offers.length).toBeGreaterThanOrEqual(2);
    expect(offers[0].offerId).toBe("izk-ljubljana-kulinarika");
    expect(offers[0].match).toBe("exact");
    // Dopolnilo je POŠTENO označeno kot predlog (ni vezan na ta postanek).
    expect(offers[offers.length - 1].match).toBe("suggested");
  });

  test("neznan slug / brez sluga: iskreni predlogi iz kanonskega vrstnega reda", () => {
    for (const slug of ["", null, "atlantida"]) {
      const offers = searchDemoOffers(slug);
      expect(offers.length).toBeGreaterThanOrEqual(2);
      expect(offers.length).toBeLessThanOrEqual(4);
      for (const o of offers) {
        expect(o.match).toBe("suggested");
        expect(OWN_IDS.has(o.offerId)).toBe(true);
      }
    }
  });

  test("people zasuli skupno ceno (deterministično)", () => {
    const offers = searchDemoOffers("bled", 3);
    expect(offers[0].totalPrice).toBe(offers[0].pricePerPerson * 3);
    // Izven mehurčka se število ljudi umeščeno zasuže (1–12).
    const huge = searchDemoOffers("bled", 99);
    expect(huge[0].totalPrice).toBe(huge[0].pricePerPerson * 12);
  });

  test("resolveDemoOffer: razreši po ID-ju iz kanonskega nabora (404 sicer)", () => {
    const o = resolveDemoOffer("vstop-postojna-vlakec");
    expect(o).not.toBeNull();
    expect(o!.offerId).toBe("vstop-postojna-vlakec");
    expect(o!.pricePerPerson).toBe(30);
    expect(resolveDemoOffer("ne-obstaja")).toBeNull();
  });
});

// ─── Ustvarjanje demo rezervacije ────────────────────────────────────────────

describe("booking-provider: createDemoBooking (simulator potrdi takoj)", () => {
  test("status CONFIRMED + channel demo + demo true + cena = na osebo × ljudje", () => {
    const r = createDemoBooking(pletnaOffer, { date: "2026-07-12", people: 3, name: " Ana Novak " }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.booking.status).toBe("CONFIRMED");
    expect(r.booking.channel).toBe("demo");
    expect(r.booking.demo).toBe(true);
    expect(r.booking.currency).toBe("EUR");
    expect(r.booking.price).toBe(pletnaOffer.pricePerPerson * 3);
    expect(r.booking.providerBookingId).toMatch(DEMO_BOOKING_ID_RE);
    expect(r.booking.name).toBe("Ana Novak"); // obrezan in obremenjen
  });

  test("determinizem: enak vnos → enaka številka (neodvisno od `now`)", () => {
    const a = createDemoBooking(pletnaOffer, { date: "2026-07-12", people: 2 }, NOW);
    const b = createDemoBooking(pletnaOffer, { date: "2026-07-12", people: 2 }, new Date("2027-01-01T00:00:00Z"));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.booking.providerBookingId).toBe(b.booking.providerBookingId);
    expect(a.booking.createdAt).not.toBe(b.booking.createdAt); // `now` je ločen
  });

  test("neveljaven vnos → iskrena zavrnitev (brez zapisa)", () => {
    expect(createDemoBooking(pletnaOffer, { date: "2026-02-30", people: 2 }).ok).toBe(false);
    expect(createDemoBooking(pletnaOffer, { date: "2026-07-12", people: 0 }).ok).toBe(false);
    expect(createDemoBooking(pletnaOffer, { date: "2026-07-12", people: 13 }).ok).toBe(false);
    expect(createDemoBooking(pletnaOffer, { date: "12.07.2026", people: 2 }).ok).toBe(false);
  });
});

// ─── Sprememba / preklic — SKOZI kanonski ALLOWED_TRANSITIONS ────────────────

describe("booking-provider: modify/cancel (kanon ALLOWED_TRANSITIONS iz booking.ts)", () => {
  const confirmed = () => {
    const r = createDemoBooking(pletnaOffer, { date: "2026-07-12", people: 2, name: "Ana" }, NOW);
    if (!r.ok) throw new Error("setup");
    return r.booking;
  };

  test("CONFIRMED → MODIFIED dovoljen (kanon); cena se preračuna iz ljudi", () => {
    expect(canTransition("CONFIRMED", "MODIFIED")).toBe(true); // kanon faze 3
    const m = modifyDemoBooking(confirmed(), { people: 5 });
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.booking.status).toBe("MODIFIED");
    expect(m.booking.people).toBe(5);
    expect(m.booking.price).toBe(m.booking.pricePerPerson * 5);
    // Številka rezervacije ostane STABILNA (isto rezervacijo spreminjamo).
    expect(m.booking.providerBookingId).toBe(confirmed().providerBookingId);
  });

  test("MODIFIED → MODIFIED (samo-veriga) dovoljen — zaporedne spremembe", () => {
    const first = modifyDemoBooking(confirmed(), { people: 4 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = modifyDemoBooking(first.booking, { date: "2026-07-20" });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.booking.status).toBe("MODIFIED");
    expect(second.booking.date).toBe("2026-07-20");
  });

  test("CONFIRMED → CANCELLED dovoljen; CANCELLED je TERMINALEN (kanon)", () => {
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    const c = cancelDemoBooking(confirmed());
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.booking.status).toBe("CANCELLED");
    // Po preklicu: NIČ več ne gre (niti preklic niti sprememba).
    expect(cancelDemoBooking(c.booking).ok).toBe(false);
    expect(modifyDemoBooking(c.booking, { people: 2 }).ok).toBe(false);
  });

  test("sprememba z neveljavnim poljem → zavrnitev (datum/Ime)", () => {
    expect(modifyDemoBooking(confirmed(), { date: "2027-02-29" }).ok).toBe(false);
    expect(
      modifyDemoBooking(confirmed(), { name: "x".repeat(121) }).ok
    ).toBe(false);
  });
});

// ─── Demo zapis v `note` — združljivost s S1 atestacijami ───────────────────

describe("booking-provider: demo note roundtrip (S1 parseAttestationNote preživi)", () => {
  const record = () => {
    const r = createDemoBooking(pletnaOffer, { date: "2026-07-12", people: 2, name: "Ana" }, NOW);
    if (!r.ok) throw new Error("setup");
    return r.booking;
  };

  test("parseAttestationNote razčleni demo zapis (source USER + id + cena)", () => {
    const note = buildDemoNote(record());
    const att = parseAttestationNote(note);
    expect(att).not.toBeNull();
    expect(att!.source).toBe("USER");
    expect(att!.providerBookingId).toBe(record().providerBookingId);
    expect(att!.confirmedPrice).toBe(record().price);
  });

  test("parseDemoNote roundtrip: enak zapis (vsa polja, status vključno)", () => {
    const b = record();
    const again = parseDemoNote(buildDemoNote(b));
    expect(again).not.toBeNull();
    expect(again!.offerId).toBe(b.offerId);
    expect(again!.offerTitle).toBe(b.offerTitle);
    expect(again!.destinationSlug).toBe(b.destinationSlug);
    expect(again!.date).toBe(b.date);
    expect(again!.people).toBe(b.people);
    expect(again!.name).toBe(b.name);
    expect(again!.status).toBe(b.status);
    expect(again!.channel).toBe("demo");
    expect(again!.demo).toBe(true);
    expect(again!.providerBookingId).toBe(b.providerBookingId);
    expect(again!.price).toBe(b.price);
    expect(again!.pricePerPerson).toBe(b.pricePerPerson);
    expect(again!.currency).toBe("EUR");
  });

  test("parseDemoNote je fail-closed: brez demo markerjev NI demo", () => {
    expect(parseDemoNote(null)).toBeNull();
    expect(parseDemoNote("")).toBeNull();
    expect(parseDemoNote("običajna opomba")).toBeNull();
    // Atestacija brez demo markerjev NI demo zapis.
    const attNote = buildAttestationNote({
      source: "USER",
      providerBookingId: "BLED-2026-114",
      confirmedPrice: 49.5,
    });
    expect(parseDemoNote(attNote)).toBeNull();
    // Pokvarjen JSON → null.
    expect(parseDemoNote('{"channel":"demo"')).toBeNull();
  });

  test("reservationChannelOf razkrije kanal (demo/user/real/null)", () => {
    expect(reservationChannelOf(buildDemoNote(record()))).toBe("demo");
    // Tudi samo predpona DSA-DEMO- razkrije demo (varnostna mreža).
    expect(
      reservationChannelOf(
        JSON.stringify({ source: "USER", providerBookingId: "DSA-DEMO-ABCD", confirmedPrice: 10 })
      )
    ).toBe("demo");
    expect(
      reservationChannelOf(
        buildAttestationNote({ source: "USER", providerBookingId: "BLED-2026-114", confirmedPrice: 49.5 })
      )
    ).toBe("user");
    expect(
      reservationChannelOf(
        JSON.stringify({ source: "PROVIDER", providerBookingId: "X-1", confirmedPrice: 10 })
      )
    ).toBe("real");
    expect(reservationChannelOf("legacy opomba")).toBeNull();
    expect(reservationChannelOf(null)).toBeNull();
  });

  test("demo zapis prestane kanonski validator atestacij (booking.ts)", () => {
    const b = record();
    const v = validateConfirmationRecord({
      status: "CONFIRMED",
      source: "USER",
      providerBookingId: b.providerBookingId,
      confirmedPrice: b.price,
    });
    expect(v.ok).toBe(true);
  });
});

// ─── Validacija API teles (čiste funkcije — brez strežnika) ─────────────────

describe("booking-provider: validacija (datum ISO, ljudje 1–12, imena cap)", () => {
  test("isValidBookingDate: koledarsko pravi ISO datumi", () => {
    expect(isValidBookingDate("2026-07-12")).toBe(true);
    expect(isValidBookingDate("2028-02-29")).toBe(true); // prestopno leto
    expect(isValidBookingDate("2026-02-30")).toBe(false); // februar nima 30
    expect(isValidBookingDate("2027-02-29")).toBe(false); // ni prestopno
    expect(isValidBookingDate("2026-13-01")).toBe(false);
    expect(isValidBookingDate("2026-07-32")).toBe(false);
    expect(isValidBookingDate("12.07.2026")).toBe(false);
    expect(isValidBookingDate("2026-7-12")).toBe(false); // ni nič-polnjena
    expect(isValidBookingDate("")).toBe(false);
    expect(isValidBookingDate(20260712)).toBe(false);
    expect(isValidBookingDate(null)).toBe(false);
  });

  test("validateDemoBookingFields: ljudje 1–12 celoštevilsko, ime ≤ 120", () => {
    expect(validateDemoBookingFields("2026-07-12", 1, null).ok).toBe(true);
    expect(validateDemoBookingFields("2026-07-12", 12, "Ana").ok).toBe(true);
    expect(validateDemoBookingFields("2026-07-12", 0, null).ok).toBe(false);
    expect(validateDemoBookingFields("2026-07-12", 13, null).ok).toBe(false);
    expect(validateDemoBookingFields("2026-07-12", 2.5, null).ok).toBe(false);
    expect(validateDemoBookingFields("2026-07-12", "2", null).ok).toBe(false);
    expect(validateDemoBookingFields("2026-07-12", 2, "x".repeat(121)).ok).toBe(false);
    expect(validateDemoBookingFields("2026-07-12", 2, 42 as unknown as string).ok).toBe(false);
  });

  test("validateBookingRequestBody: privzetti + zavrnitve (provider polja, kanal, meje)", () => {
    const ok = validateBookingRequestBody({
      shareId: "q09ynm5ctj",
      offerId: "izk-bled-pletna",
      date: "2026-07-12",
      people: 2,
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.value.dayIndex).toBe(1); // privzet
    expect(ok.value.name).toBeNull();
    expect(ok.value.offerId).toBe("izk-bled-pletna");

    // dayIndex + stopName + name se normalizirajo.
    const ok2 = validateBookingRequestBody({
      offerId: "izk-bled-pletna",
      date: "2026-07-12",
      people: 4,
      dayIndex: 3,
      stopName: "  Bled — Blejski otok  ",
      name: " Ana ",
    });
    expect(ok2.ok).toBe(true);
    if (!ok2.ok) return;
    expect(ok2.value.dayIndex).toBe(3);
    expect(ok2.value.stopName).toBe("Bled — Blejski otok");
    expect(ok2.value.name).toBe("Ana");

    // Klient NE MORE ponarediti provider polj (strežnik kuje ID).
    expect(
      validateBookingRequestBody({
        offerId: "izk-bled-pletna",
        date: "2026-07-12",
        people: 2,
        providerBookingId: "DSA-DEMO-HAXX",
      }).ok
    ).toBe(false);
    expect(
      validateBookingRequestBody({
        offerId: "izk-bled-pletna",
        date: "2026-07-12",
        people: 2,
        confirmedPrice: 1,
      }).ok
    ).toBe(false);
    // Neznan kanal → zavrnitev („real" odpove že z 503 v ruti).
    expect(
      validateBookingRequestBody({
        offerId: "izk-bled-pletna",
        date: "2026-07-12",
        people: 2,
        channel: "real",
      }).ok
    ).toBe(false);
    expect(
      validateBookingRequestBody({
        offerId: "izk-bled-pletna",
        date: "2026-07-12",
        people: 2,
        channel: "demo",
      }).ok
    ).toBe(true);
    // Manjkajoča ponudba / slab dan / ljudje zunaj meja.
    expect(validateBookingRequestBody({ date: "2026-07-12", people: 2 }).ok).toBe(false);
    expect(
      validateBookingRequestBody({ offerId: "x", date: "2026-02-30", people: 2 }).ok
    ).toBe(false);
    expect(
      validateBookingRequestBody({ offerId: "x", date: "2026-07-12", people: 13 }).ok
    ).toBe(false);
    expect(validateBookingRequestBody(null).ok).toBe(false);
    expect(validateBookingRequestBody("napaka").ok).toBe(false);
  });

  test("validateBookingPatchBody: cancel/modify oblike in zavrnitve", () => {
    expect(
      validateBookingPatchBody({ reservationId: "r1", action: "cancel" }).ok
    ).toBe(true);
    const m = validateBookingPatchBody({
      reservationId: "r1",
      action: "modify",
      date: "2026-07-20",
      people: 3,
      name: null,
    });
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.value.date).toBe("2026-07-20");
    expect(m.value.people).toBe(3);

    expect(validateBookingPatchBody({ reservationId: "r1", action: "rebook" }).ok).toBe(false);
    expect(validateBookingPatchBody({ action: "cancel" }).ok).toBe(false);
    expect(
      validateBookingPatchBody({ reservationId: "r1", action: "modify", people: 2.5 }).ok
    ).toBe(false);
    expect(
      validateBookingPatchBody({ reservationId: "r1", action: "modify", date: "2026-02-30" }).ok
    ).toBe(false);
    // Provider polja klienta ZAVRNEMO tudi na PATCH.
    expect(
      validateBookingPatchBody({
        reservationId: "r1",
        action: "cancel",
        providerBookingId: "DSA-DEMO-HAXX",
      }).ok
    ).toBe(false);
  });
});
