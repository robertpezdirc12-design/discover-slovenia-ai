/**
 * BALKAN-F2 (#41, 2.56.0) — dogodki po državah + lokali + doživetja.
 *
 * Kanon iskrenosti #38: potrjeni dogodki imajo ISO datum iz primarnega
 * vira; nepotrjeni imajo PRAZEN dateStart + dateUnconfirmed + pošten
 * napis. Vsak nov zapis nosi provenance (source + verifiedAt). Lokali
 * v novih državah so uredniška kuracija brez izmišljenih podrobnosti.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { EVENTS, EXPERIENCE_TYPES, eventCountry } from "../src/lib/content-data";
import { LOKALI } from "../src/lib/lokali-data";
import { DESTINATIONS } from "../src/lib/slovenia-data";

const NEW_COUNTRIES = ["BA", "RS", "MK", "XK", "BG", "GR"] as const;
const BALKAN_F2_EVENT_IDS = [
  "bemus-beograd-2026",
  "tiff-solun-2026",
  "sarajevo-winter-2027",
  "sofija-film-fest-2027",
  "exit-novi-sad-2027",
  "ohridsko-leto-2027",
  "sarajevo-film-fest-2027",
  "dokufest-prizren-2027",
];

const slugs = new Set(DESTINATIONS.map((d) => d.slug));
/** Vse neslovenske destinacije (HR/ME/AL + F1 novih 6) — balkansko dopolnilo. */
const balkanSlugs = new Set(DESTINATIONS.filter((d) => d.country !== "SI").map((d) => d.slug));
const f2Events = EVENTS.filter((e) => BALKAN_F2_EVENT_IDS.includes(e.id));

describe("balkan-f2 (#41 F2): dogodki po državah", () => {
  test("8 novih balkanskih dogodkov z izrecno državo", () => {
    expect(EVENTS.length).toBe(39);
    expect(f2Events.length).toBe(8);
    for (const e of f2Events) expect(e.country).toBeDefined();
  });

  test("vsaka nova država ima vsaj 1 dogodek", () => {
    for (const c of NEW_COUNTRIES) {
      const hits = EVENTS.filter((e) => eventCountry(e) === c);
      expect(hits.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("potrjeni dogodki: ISO datum + veljaven razpon (dateEnd >= dateStart)", () => {
    const confirmed = f2Events.filter((e) => !e.dateUnconfirmed);
    expect(confirmed.length).toBe(4);
    for (const e of confirmed) {
      expect(e.dateStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (e.dateEnd) {
        expect(new Date(e.dateEnd).getTime()).toBeGreaterThanOrEqual(
          new Date(e.dateStart).getTime(),
        );
      }
      // label ne sme biti "še ni potrjen" za potrjenega:
      expect(e.dateLabel).not.toContain("še ni potrjen");
    }
  });

  test("nepotrjeni dogodki: prazen dateStart + iskren napis (kanon #38)", () => {
    const unconfirmed = f2Events.filter((e) => e.dateUnconfirmed);
    expect(unconfirmed.length).toBe(4);
    for (const e of unconfirmed) {
      expect(e.dateStart).toBe("");
      expect(e.dateLabel).toContain("še ni potrjen");
    }
  });

  test("provenance: vsak nov dogodek ima source + verifiedAt (website opcionalen po kanonu)", () => {
    for (const e of f2Events) {
      expect(e.source).toMatch(/^https?:\/\//);
      expect(e.verifiedAt).toBe("2026-10-14");
      if (e.website) expect(e.website).toMatch(/^https?:\/\//);
    }
  });

  test("destSlug novih dogodkov kaže na destinacije kanona 74", () => {
    for (const e of f2Events) {
      if (e.destSlug) expect(slugs.has(e.destSlug)).toBe(true);
    }
  });

  test("slike novih dogodkov obstajajo na disku", () => {
    for (const e of f2Events) {
      const p = join(process.cwd(), "public", e.image.replace(/^\//, ""));
      expect(existsSync(p)).toBe(true);
    }
  });

  test("unikatni id-ji dogodkov", () => {
    const ids = new Set(EVENTS.map((e) => e.id));
    expect(ids.size).toBe(EVENTS.length);
  });
});

describe("balkan-f2 (#41 F2): lokali v novih državah", () => {
  const balkanLokali = LOKALI.filter((l) => l.country !== "SI" && l.country !== "HR" && l.country !== "ME" && l.country !== "AL");

  test("6 novih lokali (BA/RS/MK/XK/BG/GR po 1)", () => {
    expect(balkanLokali.length).toBe(6);
    for (const c of NEW_COUNTRIES) {
      expect(balkanLokali.some((l) => l.country === c)).toBe(true);
    }
  });

  test("celoten opis v 6 jezikih je neprazen", () => {
    for (const l of balkanLokali) {
      for (const lang of ["sl", "en", "it", "de", "fr", "es"] as const) {
        expect(l.description[lang].length).toBeGreaterThan(20);
      }
    }
  });

  test("vsi balkanski lokali so notranji (indoor) in povezani na destinacijo", () => {
    for (const l of balkanLokali) {
      expect(l.weather).toBe("indoor");
      expect(l.destinationSlug).toBeDefined();
      expect(slugs.has(l.destinationSlug!)).toBe(true);
    }
  });

  test("skupni obseg lokali kanona: 34 zapisov", () => {
    expect(LOKALI.length).toBe(34);
  });
});

describe("balkan-f2 (#41 F2): doživetja", () => {
  test("7 tipov doživetij (6 izvornih + vinske-poti)", () => {
    expect(EXPERIENCE_TYPES.length).toBe(7);
    expect(EXPERIENCE_TYPES.some((t) => t.id === "vinske-poti")).toBe(true);
  });

  test("vsi destSlugi kažejo na destinacije kanona 74", () => {
    for (const t of EXPERIENCE_TYPES) {
      for (const s of t.destSlugs) expect(slugs.has(s)).toBe(true);
    }
  });

  test("vsak tip ima vsaj 1 balkansko destinacijo (dinaridsko dopolnilo)", () => {
    for (const t of EXPERIENCE_TYPES) {
      expect(t.destSlugs.some((s) => balkanSlugs.has(s))).toBe(true);
    }
  });

  test("naslovi tipov so prevedeni v vseh 6 jezikih", () => {
    for (const t of EXPERIENCE_TYPES) {
      for (const lang of ["sl", "en", "it", "de", "fr", "es"] as const) {
        expect(t.title[lang].length).toBeGreaterThan(2);
      }
    }
  });
});
