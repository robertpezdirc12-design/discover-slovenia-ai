/**
 * RESERVATION-IMPORT — testi determinističnega parserja potrdil
 * (P0-E, issue #1 §10 „reservation import parse → review → confirm").
 *
 * Kanoni:
 *  - DETERMINIZEM: isti vhod → isti izhod (0 AI, 0 omrežja);
 *  - ISKRENOST: neprepoznano polje ostane null (parser NE ugiba);
 *  - ponudnik SAMO iz registra AFFILIATE_PROVIDERS;
 *  - številka rezervacije: veljavni znaki [A-Z0-9-], 4–24 znakov.
 *
 * Kanon: 0 omrežja, 0 db; imena v slovenščini.
 */

import { describe, expect, test } from "bun:test";

import {
  detectBookingRef,
  detectDates,
  detectGuests,
  detectPriceEur,
  detectProvider,
  detectTitleCandidate,
  parseReservationText,
} from "../src/lib/journey/reservation-import";

describe("reservation-import: ponudnik (register = enkraten vir resnice)", () => {
  test("Booking.com prepoznan (pika v domeni ne moti)", () => {
    const r = detectProvider("Rezervacija je potrjena prek Booking.com. Hvala!");
    expect(r?.providerId).toBe("booking");
    expect(r?.providerName).toBe("Booking.com");
  });

  test("GetYourGuide prepoznan", () => {
    const r = detectProvider("Your GetYourGuide booking is confirmed.");
    expect(r?.providerId).toBe("getyourguide");
  });

  test("KiwiTaxi prepoznan prek vzdevka", () => {
    const r = detectProvider("Transfer: KiwiTaxi potrditev vožnje.");
    expect(r?.providerId).toBe("kiwi");
  });

  test("Nepoznan ponudnik → null (brez ugibanj)", () => {
    expect(detectProvider("Airbnb potrditev rezervacije 123")).toBeNull();
    expect(detectProvider("")).toBeNull();
  });

  test("Gorivo (osm-fuel) NIKOLI ni rezervacijski ponudnik", () => {
    expect(detectProvider("Petrol gorivo bencinske črpalke")).toBeNull();
  });
});

describe("reservation-import: številka rezervacije", () => {
  test("eksplicitna oznaka SL", () => {
    expect(detectBookingRef("Potrditvena številka: ABC-1234", null)).toBe("ABC-1234");
    expect(detectBookingRef("Številka rezervacije: 4829104758", null)).toBe("4829104758");
  });

  test("eksplicitna oznaka EN/DE", () => {
    expect(detectBookingRef("Booking confirmation number: GYG-9X8Y7Z", null)).toBe("GYG-9X8Y7Z");
    expect(detectBookingRef("Buchungsnummer: R-2026-88", null)).toBe("R-2026-88");
  });

  test("Booking.com kanon: 10-mestna številka", () => {
    expect(detectBookingRef("Vaša rezervacija 4829104758 je potrjena.", "booking")).toBe(
      "4829104758"
    );
  });

  test("osmukljični žeton brez oznake", () => {
    expect(detectBookingRef("koda za prevzem: #A7B-99X", null)).toBe("A7B-99X");
  });

  test("smetje → null (fail-closed, brez ugibanj)", () => {
    expect(detectBookingRef("nobene številke tukaj ni", null)).toBeNull();
    expect(detectBookingRef("Številka: !!", null)).toBeNull();
  });

  test("normalizacija: velike črke, brez vodilnih vezajev", () => {
    expect(detectBookingRef("ref: abc-1234", null)).toBe("ABC-1234");
  });
});

describe("reservation-import: cena (EUR)", () => {
  test("slovenska oblika z decimalko (vejica)", () => {
    expect(detectPriceEur("Skupaj: 495,00 €")).toBe(495);
    expect(detectPriceEur("Cena: 49,50 €")).toBe(49.5);
  });

  test("EUR pred številko", () => {
    expect(detectPriceEur("Total EUR 120")).toBe(120);
  });

  test("vrstica s „total/skupaj“ ima prednost", () => {
    // Več zneskov — izbere tistega iz vrstice s skupaj.
    expect(
      detectPriceEur("Cena: 100 €\nPopust: 20 €\nSkupaj: 80,00 €")
    ).toBe(80);
  });

  test("brez EUR → null (valuta ni znana — ne ugibamo)", () => {
    expect(detectPriceEur("Total: 120 USD")).toBeNull();
    expect(detectPriceEur("brez cen")).toBeNull();
  });
});

describe("reservation-import: datumi (lokalni, DST-varno)", () => {
  test("ISO in dd.mm.yyyy", () => {
    expect(detectDates("2026-10-17")).toEqual(["2026-10-17"]);
    expect(detectDates("17.10.2026")).toEqual(["2026-10-17"]);
    expect(detectDates("Obdobje: 17. 10. 2026 do 20. 10. 2026")).toEqual([
      "2026-10-17",
      "2026-10-20",
    ]);
  });

  test("slovenski mesec v rodilniku", () => {
    expect(detectDates("Prihod: 17. oktobra 2026")).toEqual(["2026-10-17"]);
  });

  test("angleški mesec", () => {
    expect(detectDates("Check-in: October 17 2026")).toEqual(["2026-10-17"]);
  });

  test("neveljavni koledarski datumi odpadejo", () => {
    expect(detectDates("31.02.2026")).toEqual([]); // 31. februar ne obstaja
    expect(detectDates("2026-13-01")).toEqual([]); // mesec 13
  });

  test("razvrščeni po času (zgodnji prvi)", () => {
    const dates = detectDates("20.10.2026 in 17.10.2026");
    expect(dates).toEqual(["2026-10-17", "2026-10-20"]);
  });
});

describe("reservation-import: gostje in predlog imena", () => {
  test("gostje SL/EN", () => {
    expect(detectGuests("2 osebi")).toBe(2);
    expect(detectGuests("4 guests")).toBe(4);
    expect(detectGuests("3 Erwachsene")).toBe(3);
    expect(detectGuests("za 2 odraslima")).toBe(2);
  });

  test("gostje brez številke → null", () => {
    expect(detectGuests("dve osebi")).toBeNull();
    expect(detectGuests("0 gostov")).toBeNull(); // 0 ni veljavno
  });

  test("predlog imena: prva smiselna vrstica (ne pozdrav/glava)", () => {
    const title = detectTitleCandidate(
      "Pozdravljeni,\nPrenočišče Vila Bled\nPotrditev rezervacije 123\nLep pozdrav"
    );
    expect(title).toBe("Prenočišče Vila Bled");
  });

  test("predlog imena: samo pozdravi → null", () => {
    expect(detectTitleCandidate("Pozdravljeni,\nHvala!")).toBeNull();
  });
});

describe("reservation-import: sestavni klic (parseReservationText)", () => {
  const BOOKING_TEXT = `Booking.com — potrditev rezervacije
Številka rezervacije: 4829104758
Prenočišče Vila Bled, 2 osebi
Prihod: 17.10.2026, odhod: 20.10.2026
Skupaj: 495,00 €`;

  test("celoten potek: ponudnik + ref + cena + datumi + gostje + naslov", () => {
    const p = parseReservationText(BOOKING_TEXT);
    expect(p.providerId).toBe("booking");
    expect(p.bookingRef).toBe("4829104758");
    expect(p.priceEur).toBe(495);
    expect(p.dateStartIso).toBe("2026-10-17");
    expect(p.dateEndIso).toBe("2026-10-20");
    expect(p.guests).toBe(2);
    expect(p.titleCandidate).toBe("Prenočišče Vila Bled, 2 osebi");
  });

  test("opombe so iskrene (kaj je bilo najdeno)", () => {
    const p = parseReservationText(BOOKING_TEXT);
    expect(p.notes.some((n) => n.includes("Booking.com"))).toBe(true);
    expect(p.notes.some((n) => n.includes("4829104758"))).toBe(true);
  });

  test("prazno/smeste besedilo: VSA polja null + iskrene opombe", () => {
    const p = parseReservationText("Nič uporabnega tukaj.");
    expect(p.providerId).toBeNull();
    expect(p.bookingRef).toBeNull();
    expect(p.priceEur).toBeNull();
    expect(p.dateStartIso).toBeNull();
    expect(p.guests).toBeNull();
    expect(p.notes.some((n) => n.includes("ročno"))).toBe(true);
  });

  test("DETERMINIZEM: isti vhod → isti izhod", () => {
    const a = parseReservationText(BOOKING_TEXT);
    const b = parseReservationText(BOOKING_TEXT);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("sanity: zelo dolg vhod se poreže na 20.000 znakov (brez sesutja)", () => {
    const p = parseReservationText("x".repeat(50_000) + "\nŠtevilka: ABC-999");
    expect(p.bookingRef).toBe("ABC-999");
  });
});
