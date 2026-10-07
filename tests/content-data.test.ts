/**
 * CONTENT-DATA — integriteta uredniških vsebin (dogodki, vodniki, blog).
 *
 * Vsi zapisi prihajajo iz produkcjskega posnetka (rss.xml + HTML mirror) —
 * te napake bi pokvarile javne strani /dogodki, /vodici, /dozivetja.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  EVENTS,
  EVENT_CATEGORIES,
  EVENT_PRICE_LABEL,
  GUIDES,
  GUIDE_GROUPS,
  GUIDE_THEMES,
  BLOG_ARTICLES,
  BLOG_CATEGORIES,
  getGuide,
  getGuideTheme,
  type EventCategory,
  type EventPrice,
} from "../src/lib/content-data";
import { DESTINATIONS } from "../src/lib/slovenia-data";

const EVENT_CATS = Object.keys(EVENT_CATEGORIES) as EventCategory[];
const PRICES = Object.keys(EVENT_PRICE_LABEL) as EventPrice[];

describe("content-data: dogodki (/dogodki)", () => {
  test("vsaj 12 dogodkov (jedro koledarja)", () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(12);
  });

  test("unikatni id-ji (dodajanje v mojo pot: kind event)", () => {
    const ids = new Set(EVENTS.map((e) => e.id));
    expect(ids.size).toBe(EVENTS.length);
  });

  test("kategorija in cena iz dovoljenih naborov", () => {
    for (const e of EVENTS) {
      expect(EVENT_CATS).toContain(e.category);
      expect(PRICES).toContain(e.price);
    }
  });

  test("datum začetka je ISO datum (koledar prihodnje sezone 2026/27)", () => {
    for (const e of EVENTS) {
      expect(e.dateStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Sezonski koledar: dogodki od oktobra 2026 naprej (zimski festivali 2027)
      expect(e.dateStart >= "2026-10-01").toBe(true);
    }
  });

  test("destSlug (če je) obstaja v naboru destinacij", () => {
    const slugs = new Set(DESTINATIONS.map((d) => d.slug));
    for (const e of EVENTS) {
      if (e.destSlug) expect(slugs.has(e.destSlug)).toBe(true);
    }
  });

  test("slike dogodkov obstajajo na disku", () => {
    for (const e of EVENTS) {
      const p = join(process.cwd(), "public", e.image.replace(/^\//, ""));
      expect(existsSync(p)).toBe(true);
    }
  });

  test("mesec se ujema z datumom (monthIndex 1–12)", () => {
    for (const e of EVENTS) {
      expect(e.monthIndex).toBeGreaterThanOrEqual(1);
      expect(e.monthIndex).toBeLessThanOrEqual(12);
      expect(e.monthIndex).toBe(new Date(e.dateStart).getMonth() + 1);
    }
  });
});

describe("content-data: vodniki (/vodici + [slug])", () => {
  test("vsaj 6 vodnikov v treh skupinah", () => {
    expect(GUIDES.length).toBeGreaterThanOrEqual(6);
    expect(Object.keys(GUIDE_GROUPS).length).toBe(3);
  });

  test("unikatni slug-i (poti /vodici/[slug])", () => {
    const slugs = new Set(GUIDES.map((g) => g.slug));
    expect(slugs.size).toBe(GUIDES.length);
  });

  test("skupina iz dovoljenega nabora (zimski/domaci/jadranski)", () => {
    const groups = Object.keys(GUIDE_GROUPS);
    for (const g of GUIDES) expect(groups).toContain(g.group);
  });

  test("destSlugs: veljavni sluzi nabora 38 — praznina je IZKRENO dovoljena (praktični vodniki)", () => {
    const slugs = new Set(DESTINATIONS.map((d) => d.slug));
    for (const g of GUIDES) {
      expect(Array.isArray(g.destSlugs)).toBe(true);
      for (const s of g.destSlugs) expect(slugs.has(s)).toBe(true);
    }
    // večina vodnikov ima povezave na destinacije
    const withDests = GUIDES.filter((g) => g.destSlugs.length > 0).length;
    expect(withDests).toBeGreaterThanOrEqual(GUIDES.length / 2);
  });

  test("dnevi/km so pozitivni in realni", () => {
    for (const g of GUIDES) {
      expect(g.days).toBeGreaterThan(0);
      expect(g.days).toBeLessThanOrEqual(14);
      expect(g.km).toBeGreaterThan(0);
      expect(g.km).toBeLessThan(3000);
    }
  });

  test("getGuide najde po slug-u, neveljaven → undefined", () => {
    const first = GUIDES[0];
    expect(getGuide(first.slug)?.title).toBe(first.title);
    expect(getGuide("ne-obstaja")).toBeUndefined();
  });

  test("pubDate je veljaven ISO datum", () => {
    for (const g of GUIDES) {
      expect(g.pubDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("content-data: teme vodnikov + blog", () => {
  test("GUIDE_THEMES: vsaj 4 teme z dvojezičnimi oznakami", () => {
    expect(GUIDE_THEMES.length).toBeGreaterThanOrEqual(4);
    for (const t of GUIDE_THEMES) {
      expect(t.label.sl.length).toBeGreaterThan(0);
      expect(t.label.en.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  test("getGuideTheme najde veljavno temo", () => {
    const first = GUIDE_THEMES[0];
    expect(getGuideTheme(first.id)?.id).toBe(first.id);
    expect(getGuideTheme("ne-obstaja")).toBeUndefined();
  });

  test("BLOG_ARTICLES: unikatni id-ji + kategorija iz nabora", () => {
    const ids = new Set(BLOG_ARTICLES.map((b) => b.id));
    expect(ids.size).toBe(BLOG_ARTICLES.length);
    const cats = new Set(Object.keys(BLOG_CATEGORIES));
    for (const b of BLOG_ARTICLES) expect(cats.has(b.category)).toBe(true);
  });
});
