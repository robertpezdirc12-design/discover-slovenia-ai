/**
 * TRŽNICA-DATA — iskrenost ponudniških polic (supply registra).
 *
 * Kanon izvirnika: NIKOLI ne predstavljamo affiliate povezave kot inventarja;
 * lastni izdelki (own) so izpeljani IZKLJUČNO iz kanonskega nabora destinacij
 * (ime = dejavnost, cena = costPerPerson destinacije).
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { OWN_PRODUCTS, SUPPLY_SHELVES } from "../src/lib/trznica-data";
import { DESTINATIONS } from "../src/lib/slovenia-data";

const GROUPS = ["local", "own", "commercial"] as const;
const AVAILABILITY = ["available", "coming", "empty"] as const;

describe("trznica-data: police (supply register)", () => {
  test("vsaj ena polica na skupino (local/own/commercial)", () => {
    for (const g of GROUPS) {
      const shelves = SUPPLY_SHELVES.filter((s) => s.group === g);
      expect(shelves.length).toBeGreaterThan(0);
    }
  });

  test("unikatni slug-i polic (poti /trznica/[polica])", () => {
    const slugs = new Set(SUPPLY_SHELVES.map((s) => s.slug));
    expect(slugs.size).toBe(SUPPLY_SHELVES.length);
  });

  test("dvojezične oznake (SL + EN) na vsaki polici", () => {
    for (const s of SUPPLY_SHELVES) {
      expect(s.label.sl.length).toBeGreaterThan(0);
      expect(s.label.en.length).toBeGreaterThan(0);
      expect(s.description.sl.length).toBeGreaterThan(0);
      expect(s.description.en.length).toBeGreaterThan(0);
    }
  });

  test("availability iz dovoljenega nabora (iskrenostni badge)", () => {
    for (const s of SUPPLY_SHELVES) expect(AVAILABILITY).toContain(s.availability);
  });
});

describe("trznica-data: lastni izdelki (own marketplace)", () => {
  test("vsaj 5 izdelkov (živa tržnica, ne samo napovedi)", () => {
    expect(OWN_PRODUCTS.length).toBeGreaterThanOrEqual(5);
  });

  test("unikatni id-ji izdelkov", () => {
    const ids = new Set(OWN_PRODUCTS.map((p) => p.id));
    expect(ids.size).toBe(OWN_PRODUCTS.length);
  });

  test("vsak izdelek se nanaša na DEJANSKO destinacijo nabora", () => {
    const bySlug = new Map(DESTINATIONS.map((d) => [d.slug, d]));
    for (const p of OWN_PRODUCTS) {
      const dest = bySlug.get(p.destinationSlug);
      expect(dest).toBeDefined();
    }
  });

  test("cena izdelka = costPerPerson destinacije (NIČ izmišljenih cen)", () => {
    const bySlug = new Map(DESTINATIONS.map((d) => [d.slug, d]));
    for (const p of OWN_PRODUCTS) {
      const dest = bySlug.get(p.destinationSlug);
      if (dest) expect(p.priceEstimate).toBe(dest.costPerPerson);
    }
  });

  test("slika izdelka obstaja na disku", () => {
    for (const p of OWN_PRODUCTS) {
      const path = join(process.cwd(), "public", p.image.replace(/^\//, ""));
      expect(existsSync(path)).toBe(true);
    }
  });

  test("kind izključno experience/ticket", () => {
    for (const p of OWN_PRODUCTS) {
      expect(["experience", "ticket"]).toContain(p.kind);
    }
  });
});
