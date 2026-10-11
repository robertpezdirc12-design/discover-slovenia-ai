/**
 * TRIP-DATES-PANEL — potrditev shranjevanja datumov (QA U2, 2026-10-11).
 *
 * Zaklene kanone čiste funkcije tripDatesRangeLabel:
 *  - KATERI datumi so shranjeni: obseg mora biti viden v potrditvi
 *    („Datumi shranjeni: 12.–14. okt 2026") — prej splošen ✓;
 *  - lokalizirano za vseh 6 jezikov (kompakten zapis istega meseca,
 *    polne kratke oblike prek mesecev/let, enodnevna pota → en datum);
 *  - DST-varno (lokalne komponente YYYY-MM-DD — kanon trip-dates.ts);
 *  - ISKRENOST: neveljaven podatek → surov zapis, nikoli izmišljenega.
 */

import { describe, expect, test } from "bun:test";

import { tripDatesRangeLabel } from "../src/components/trips/trip-dates-panel";

describe("tripDatesRangeLabel: kompakten obseg (isti mesec in leto)", () => {
  test("sl: 12.–14. okt 2026 (QA primer)", () => {
    expect(tripDatesRangeLabel("2026-10-12", "2026-10-14", "sl")).toBe("12.–14. okt 2026");
  });

  test("en: Oct 12–14, 2026", () => {
    expect(tripDatesRangeLabel("2026-10-12", "2026-10-14", "en")).toBe("Oct 12–14, 2026");
  });

  test("it: 12–14 ott 2026", () => {
    expect(tripDatesRangeLabel("2026-10-12", "2026-10-14", "it")).toBe("12–14 ott 2026");
  });

  test("de: 12.–14. Okt 2026", () => {
    expect(tripDatesRangeLabel("2026-10-12", "2026-10-14", "de")).toBe("12.–14. Okt 2026");
  });

  test("fr: 12–14 oct. 2026", () => {
    expect(tripDatesRangeLabel("2026-10-12", "2026-10-14", "fr")).toBe("12–14 oct. 2026");
  });

  test("es: 12–14 oct 2026", () => {
    expect(tripDatesRangeLabel("2026-10-12", "2026-10-14", "es")).toBe("12–14 oct 2026");
  });
});

describe("tripDatesRangeLabel: polne oblike (prek mesecev/let) + robni primeri", () => {
  test("prek meseca istega leta → oba kratka datuma (sl)", () => {
    expect(tripDatesRangeLabel("2026-09-28", "2026-10-02", "sl")).toBe(
      "28. sep 2026 – 2. okt 2026"
    );
  });

  test("prek leta (dec → jan, DST-neodvisno) → oba kratka datuma (en)", () => {
    expect(tripDatesRangeLabel("2026-12-30", "2027-01-02", "en")).toBe(
      "Dec 30, 2026 – Jan 2, 2027"
    );
  });

  test("enodnevna pota (start == end) → en sam datum", () => {
    expect(tripDatesRangeLabel("2026-10-12", "2026-10-12", "sl")).toBe("12. okt 2026");
    expect(tripDatesRangeLabel("2026-10-12", "2026-10-12", "en")).toBe("Oct 12, 2026");
  });

  test("neveljavni datumi → iskreno surov zapis (nikoli izmišljenega)", () => {
    expect(tripDatesRangeLabel("2026-13-40", "2026-10-14", "sl")).toBe("2026-13-40 – 2026-10-14");
    expect(tripDatesRangeLabel("", "2026-10-14", "en")).toBe(" – 2026-10-14");
    expect(tripDatesRangeLabel("ni-datum", "tudi-ne", "de")).toBe("ni-datum – tudi-ne");
  });

  test("determinizem: isti vhod → isti izhod (5×)", () => {
    for (let i = 0; i < 5; i++) {
      expect(tripDatesRangeLabel("2026-10-12", "2026-10-14", "fr")).toBe("12–14 oct. 2026");
    }
  });
});
