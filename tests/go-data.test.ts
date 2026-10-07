/**
 * GO-DATA — integriteta partnerjev (/go hub, 10 podstrani).
 *
 * Kanon iskrenosti izvirnika: NIKOLI ne predstavljamo affiliate povezave
 * kot inventarja. content/link badge-a morata biti iskrena ("coming" v
 * peskovniku, kjer zunanja povezava še ni konfigurirana).
 */

import { describe, expect, test } from "bun:test";

import {
  GO_PARTNERS,
  SUPPLY_STATUS_LABELS,
  getGoRoute,
  type SupplyStatus,
} from "../src/lib/go-data";

const STATUSES = Object.keys(SUPPLY_STATUS_LABELS) as SupplyStatus[];
const EXPECTED_SLUGS = [
  "hotels",
  "flights",
  "cars",
  "transfers",
  "transport",
  "activities",
  "viator",
  "tickets",
  "insurance",
  "esim",
];

describe("go-data: hub 10 partnerjev (kanon izvirnika)", () => {
  test("natanko 10 podstrani s pričakovanimi slug-i", () => {
    expect(GO_PARTNERS.length).toBe(10);
    const slugs = GO_PARTNERS.map((p) => p.slug);
    for (const s of EXPECTED_SLUGS) expect(slugs).toContain(s);
  });

  test("unikatni slug-i (dinamična pot /go/[partner])", () => {
    const slugs = new Set(GO_PARTNERS.map((p) => p.slug));
    expect(slugs.size).toBe(GO_PARTNERS.length);
  });

  test("dvojezične naslove in uvode (SL + EN)", () => {
    for (const p of GO_PARTNERS) {
      expect(p.title.sl.length).toBeGreaterThan(0);
      expect(p.title.en.length).toBeGreaterThan(0);
      expect(p.lead.sl.length).toBeGreaterThan(10);
      expect(p.lead.en.length).toBeGreaterThan(10);
      expect(p.coverage.sl.length).toBeGreaterThan(5);
    }
  });

  test("content/link badge iz dovoljenega nabora (available|coming)", () => {
    for (const p of GO_PARTNERS) {
      expect(["available", "coming"]).toContain(p.content);
      expect(["available", "coming"]).toContain(p.link);
    }
  });

  test("ISKRENOST: zunanja povezava je coming DOKLER ni konfigurirana", () => {
    // V peskovniku NI affiliate žetonov → noben partner ne sme obljubljati
    // žive zunanje povezave (badge "available" bi bila neresnična obljuba).
    for (const p of GO_PARTNERS) {
      expect(p.link).toBe("coming");
    }
  });
});

describe("go-data: ponudniki na podstraneh", () => {
  test("vsak partner ima vsaj enega ponudnika z registrom", () => {
    for (const p of GO_PARTNERS) {
      expect(p.providers.length).toBeGreaterThan(0);
    }
  });

  test("status ponudnika iz dovoljenega nabora (5 statusov)", () => {
    expect(STATUSES.length).toBe(5);
    for (const p of GO_PARTNERS) {
      for (const prov of p.providers) {
        expect(STATUSES).toContain(prov.status);
      }
    }
  });

  test("ponudniki imajo iskrene opombe o dostopu (SL + EN)", () => {
    for (const p of GO_PARTNERS) {
      for (const prov of p.providers) {
        expect(prov.accessNote.sl.length).toBeGreaterThan(5);
        expect(prov.accessNote.en.length).toBeGreaterThan(5);
        expect(prov.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("go-data: dostopne funkcije", () => {
  test("getGoRoute najde podstran, neveljavna → undefined", () => {
    expect(getGoRoute("hotels")?.slug).toBe("hotels");
    expect(getGoRoute("ne-obstaja")).toBeUndefined();
  });
});
