/**
 * DESTINATIONS-FILTER — regresijski testi filtrov destinacij (#38).
 * ============================================================================
 * Merilo #38: „Filtri dogodkov in destinacij imajo regresijske teste.“
 * Filtri dogodkov so zaklenjeni v tests/events-p0-qa38.test.ts (①–⑤); ta
 * datoteka zaklene filtre DESTINACIJ (/destinacije: iskanje + regija + tip),
 * katerih logika je bila do 2.47.0 živa v useMemo odjemalec komponente in
 * pokrita samo brskalniško (E2E zlata pot). Izvleček v
 * src/lib/destinations-filter.ts je 1 : 1 — ta testi DOKAZUJEJO semantiko:
 * rezanje iskalnega niza, neobčutljivost na velikost črk, iskanje po
 * name/tagline/description/highlights, neznana vrednost regije/tipa →
 * prazen rezultat (URL semantika ?region=/?type=), „all“ → brez omejitve,
 * ohranjeni vrstni red nabora (determinizem kartic) in integriteta
 * registra (vsaka destinacija ima veljaven par regija/tip, tako da filtri
 * nikoli ne morejo „izgubiti“ zapisa zaradi podatkovne napake).
 */

import { describe, expect, test } from "bun:test";

import {
  activeRegionKeys,
  filterDestinations,
  hasActiveFilters,
} from "../src/lib/destinations-filter";
import {
  DESTINATIONS,
  DEST_TYPES,
  REGIONS,
} from "../src/lib/slovenia-data";

const ids = <T extends { id: string }>(list: readonly T[]) =>
  list.map((d) => d.id);

const byId = (id: string) => {
  const d = DESTINATIONS.find((x) => x.id === id);
  if (!d) throw new Error(`destinacija ${id} manjka v kanonu`);
  return d;
};

// ---------------------------------------------------------------------------
// ① ISKANJE (q) — ime, tagline, opis, poudarki; rezanje + velikost črk
// ---------------------------------------------------------------------------

describe("destinations-filter (#38): iskanje", () => {
  test("①a ime: „bled“ najde Bled (neobčutljivo na velikost črk)", () => {
    const hits = filterDestinations(DESTINATIONS, { q: "bled", region: "all", type: "all" });
    expect(hits.some((d) => d.id === "bled")).toBeTrue();
    // vsak zadetek res ujema vsaj eno iskano polje (name/tagline/description/highlights):
    expect(
      hits.every((d) =>
        [d.name, d.tagline, d.description, ...d.highlights].some((t) =>
          t.toLowerCase().includes("bled"),
        ),
      ),
    ).toBeTrue();
  });

  test("①b rezanje + mešana velikost: „  BLED  “ = „bled“", () => {
    const trimmed = filterDestinations(DESTINATIONS, { q: "bled", region: "all", type: "all" });
    const padded = filterDestinations(DESTINATIONS, { q: "  BLED  ", region: "all", type: "all" });
    expect(ids(padded)).toEqual(ids(trimmed));
  });

  test("①c tagline: „biser alp“ najde Bled (tagline, ne ime)", () => {
    const tagline = byId("bled").tagline.toLowerCase();
    expect(tagline).toContain("biser alp");
    expect("bled".includes("biser alp")).toBeFalse();
    const hits = filterDestinations(DESTINATIONS, { q: "biser alp", region: "all", type: "all" });
    expect(hits.some((d) => d.id === "bled")).toBeTrue();
  });

  test("①d poudarki: „vintgarska“ najde Bled (highlights, ne ime/tagline)", () => {
    const d = byId("bled");
    expect(d.highlights.some((h) => h.toLowerCase().includes("vintgarska"))).toBeTrue();
    expect(`${d.name} ${d.tagline}`.toLowerCase().includes("vintgarska")).toBeFalse();
    // kanon: Bled (highlight „Vintgarska soteska“) + soteska Vintgar sama —
    // oba prek poudarkov/imen, vrstni red = vrstni red registra
    const hits = filterDestinations(DESTINATIONS, { q: "vintgarska", region: "all", type: "all" });
    expect(ids(hits)).toEqual(["bled", "vintgar"]);
  });

  test("①e brez zadetkov: nesmiselni niz → prazen rezultat", () => {
    const hits = filterDestinations(DESTINATIONS, { q: "xyz-ni-take-destinacije", region: "all", type: "all" });
    expect(hits).toEqual([]);
  });

  test("①f prazen/whitespace q = brez iskalne omejitve (vseh 74)", () => {
    expect(filterDestinations(DESTINATIONS, { q: "", region: "all", type: "all" })).toHaveLength(74);
    expect(filterDestinations(DESTINATIONS, { q: "   ", region: "all", type: "all" })).toHaveLength(74);
  });
});

// ---------------------------------------------------------------------------
// ② REGIJA — „all“ / ključ / neznana vrednost (URL semantika)
// ---------------------------------------------------------------------------

describe("destinations-filter (#38): filter regije", () => {
  test("②a gorenjska: samo gorenjski zapisi in vsi gorenjski zapisi", () => {
    const hits = filterDestinations(DESTINATIONS, { q: "", region: "gorenjska", type: "all" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((d) => d.region === "gorenjska")).toBeTrue();
    const expected = DESTINATIONS.filter((d) => d.region === "gorenjska").length;
    expect(hits).toHaveLength(expected);
  });

  test("②b „all“ ne omejuje (identično naboru)", () => {
    const hits = filterDestinations(DESTINATIONS, { q: "", region: "all", type: "all" });
    expect(ids(hits)).toEqual(ids(DESTINATIONS));
  });

  test("②c NEZNANA regija iz URL-ja → prazen rezultat (semantika ohranjena)", () => {
    const hits = filterDestinations(DESTINATIONS, { q: "", region: "neznana-regija", type: "all" });
    expect(hits).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ③ TIP — „all“ / ključ DEST_TYPES / neznana vrednost
// ---------------------------------------------------------------------------

describe("destinations-filter (#38): filter tipa", () => {
  test("③a jezero: samo jezera in vsa jezera registra", () => {
    const hits = filterDestinations(DESTINATIONS, { q: "", region: "all", type: "lake" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((d) => d.type === "lake")).toBeTrue();
    const expected = DESTINATIONS.filter((d) => d.type === "lake").length;
    expect(hits).toHaveLength(expected);
  });

  test("③b NEZNAN tip iz URL-ja → prazen rezultat (semantika ohranjena)", () => {
    expect(filterDestinations(DESTINATIONS, { q: "", region: "all", type: "vesoljska-postaja" })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ④ KOMBINACIJA — zlata pot E2E (Bled + Gorenjska + jezero) in negativna
// ---------------------------------------------------------------------------

describe("destinations-filter (#38): kombinirani filtri (zlata pot)", () => {
  test("④a E2E pot: q=Bled + region=gorenjska + type=jezero → natanko Bled", () => {
    const hits = filterDestinations(DESTINATIONS, { q: "bled", region: "gorenjska", type: "lake" });
    expect(ids(hits)).toEqual(["bled"]);
  });

  test("④b negativna kombinacija: Bled ni jama → prazen rezultat", () => {
    const hits = filterDestinations(DESTINATIONS, { q: "bled", region: "gorenjska", type: "cave" });
    expect(hits).toEqual([]);
  });

  test("④c vrstni red nabora je OHRANJEN (determinizem kartic/fingerprinta)", () => {
    const all = filterDestinations(DESTINATIONS, { q: "", region: "all", type: "all" });
    expect(ids(all)).toEqual(ids(DESTINATIONS));
    const lakes = filterDestinations(DESTINATIONS, { q: "", region: "all", type: "lake" });
    const lakesFromAll = ids(all).filter((id) => byId(id).type === "lake");
    expect(ids(lakes)).toEqual(lakesFromAll);
  });
});

// ---------------------------------------------------------------------------
// ⑤ PONASTAVITEV — hasActiveFilters (vidnost gumba „Počisti filtre“)
// ---------------------------------------------------------------------------

describe("destinations-filter (#38): ponastavitev filtrov", () => {
  test("⑤a privzeto stanje ni aktivno (tudi whitespace-only q)", () => {
    expect(hasActiveFilters({ q: "", region: "all", type: "all" })).toBeFalse();
    expect(hasActiveFilters({ q: "   ", region: "all", type: "all" })).toBeFalse();
  });

  test("⑤b vsak kanal sam aktivira; vse skupaj = aktivno", () => {
    expect(hasActiveFilters({ q: "bled", region: "all", type: "all" })).toBeTrue();
    expect(hasActiveFilters({ q: "", region: "gorenjska", type: "all" })).toBeTrue();
    expect(hasActiveFilters({ q: "", region: "all", type: "lake" })).toBeTrue();
    expect(hasActiveFilters({ q: "bled", region: "gorenjska", type: "lake" })).toBeTrue();
  });
});

// ---------------------------------------------------------------------------
// ⑥ AKTIVNE REGIJE — kanonski vrstni red slovarja REGIONS
// ---------------------------------------------------------------------------

describe("destinations-filter (#38): aktivne regije", () => {
  test("⑥a vrstni red = vrstni red REGIONS (ne nabora destinacij), samo prisotne", () => {
    const active = activeRegionKeys(DESTINATIONS);
    const canonical = Object.keys(REGIONS);
    // podmnožica v kanonskem vrstnem redu:
    expect(active.every((r) => canonical.includes(r))).toBeTrue();
    const positions = active.map((r) => canonical.indexOf(r));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // in vsaka regija v registru dejansko nastopa:
    const present = new Set(DESTINATIONS.map((d) => d.region));
    expect(new Set(active)).toEqual(new Set(present));
  });

  test("⑥b popravek 2.22.0 ostaja: „posocje“ je veljavna aktivna regija", () => {
    expect(activeRegionKeys(DESTINATIONS)).toContain("posocje");
  });
});

// ---------------------------------------------------------------------------
// ⑦ INTEGRITETA REGISTRA — filtri nikoli ne morejo izgubiti zapisa
// ---------------------------------------------------------------------------

describe("destinations-filter (#38): integriteta registra", () => {
  test("⑦a vsaka destinacija ima veljaven par regija/tip (samo testirane vrednosti)", () => {
    for (const d of DESTINATIONS) {
      expect(Object.keys(REGIONS)).toContain(d.region);
      expect(Object.keys(DEST_TYPES)).toContain(d.type);
    }
  });

  test("⑦b registr ostaja 74 destinacij / 44 regij / 10 tipov (kanon glave, #41 F1)", () => {
    expect(DESTINATIONS).toHaveLength(74);
    expect(Object.keys(REGIONS)).toHaveLength(44);
    expect(Object.keys(DEST_TYPES)).toHaveLength(10);
  });
});
