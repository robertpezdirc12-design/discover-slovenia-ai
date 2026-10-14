/**
 * P0-F (2.10.0) — REGISTRSKA RAZŠIRITEV: državne predloge {country},
 * iskrena veriga buildPartnerLink za partnerje brez znanega vzorca
 * žetona, ocene provizije z null (neznano do pogodbe) in predlog vnosa
 * iz poročila, ki pri neznanih odstotkih ZAHTEVA ročni vnos.
 *
 * Zaklene kanone:
 * - {COUNTRY}: discovercars/airalo uporabljata {country} (vzorci
 *   preverjeni s curl 200 po VSEH 10 državah nabora: slovenia/croatia/
 *   montenegro/albania + R41-F4 (2.58.0): bosnia-and-herzegovina/
 *   serbia/macedonia/kosovo/bulgaria/greece — curl 200, 2026-10-14);
 *   airalo brez države pade na domačo stran
 *   (noCountryTmpl) — NIKOLI pokvarjen URL z ostankom "-eSIM".
 * - ISKRENA VERIGA: ID brez znanega vzorca (affiliateTmpl "") NE more
 *   prikazati provizijske povezave — affiliateActive ostane false;
 *   lastnikov TMPL override aktivira.
 * - OCENE: estimateCommission za pct null vrne commissionEur null
 *   (ni izmišljene ocene); commissionDraftFromInput zahteva ročni vnos.
 */

import { describe, expect, test } from "bun:test";

import {
  applyTemplate,
  buildPartnerLink,
  COUNTRY_URL_NAMES,
  countryUrlName,
  estimateCommission,
  getProvider,
  type AffiliateProviderDef,
} from "../src/lib/affiliate-providers";
import { getDestination } from "../src/lib/slovenia-data";
import { commissionDraftFromInput } from "../src/lib/affiliate-server";

/** Kanonski partner po id-ju — če manjka, je register pokvarjen. */
function mustProvider(id: string): AffiliateProviderDef {
  const p = getProvider(id);
  if (!p) throw new Error(`kanonski partner "${id}" manjka v registru`);
  return p;
}

// ── Države v URL-jih ({country}) ───────────────────────────────────────────

describe("P0-F: COUNTRY_URL_NAMES + countryUrlName", () => {
  test("vseh 10 držav kanonskega nabora (cel Balkan) ima imena URL-jev", () => {
    expect(COUNTRY_URL_NAMES).toEqual({
      SI: "slovenia",
      HR: "croatia",
      ME: "montenegro",
      AL: "albania",
      // R41-F4 (2.58.0): 6 novih balkanskih držav — vzorci živo
      // preverjeni (curl 200 pri airalo IN discovercars, 2026-10-14).
      BA: "bosnia-and-herzegovina",
      RS: "serbia",
      MK: "macedonia",
      XK: "kosovo",
      BG: "bulgaria",
      GR: "greece",
    });
  });

  test("countryUrlName: veljavne kode → imena; neznane/null → null (fail-closed)", () => {
    expect(countryUrlName("SI")).toBe("slovenia");
    expect(countryUrlName("hr")).toBe("croatia"); // velikost ne pomembna
    expect(countryUrlName("ME")).toBe("montenegro");
    expect(countryUrlName("AL")).toBe("albania");
    // R41-F4: nove države — pretvorba kode v URL ime.
    expect(countryUrlName("BA")).toBe("bosnia-and-herzegovina");
    expect(countryUrlName("rs")).toBe("serbia");
    expect(countryUrlName("MK")).toBe("macedonia");
    expect(countryUrlName("XK")).toBe("kosovo");
    expect(countryUrlName("BG")).toBe("bulgaria");
    expect(countryUrlName("GR")).toBe("greece");
    expect(countryUrlName("IT")).toBeNull(); // izven nabora — ne izmišljujemo
    expect(countryUrlName("TR")).toBeNull(); // TR/RO so opcijsko kasneje (#41)
    expect(countryUrlName("")).toBeNull();
    expect(countryUrlName(null)).toBeNull();
    expect(countryUrlName(undefined)).toBeNull();
  });
});

// ── applyTemplate z {country} ──────────────────────────────────────────────

describe("P0-F: applyTemplate z {country}", () => {
  test("discovercars: {country}/{dest} se oba nadomestita (Zagreb/HR)", () => {
    expect(
      applyTemplate(
        "https://www.discovercars.com/{country}/{dest}",
        "Zagreb",
        null,
        "croatia"
      )
    ).toBe("https://www.discovercars.com/croatia/Zagreb");
  });

  test("airalo: {country}-eSIM z državo (Bled/SI)", () => {
    expect(
      applyTemplate(
        "https://www.airalo.com/{country}-eSIM",
        "Bled",
        null,
        "slovenia"
      )
    ).toBe("https://www.airalo.com/slovenia-eSIM");
  });

  test("brez države: discovercars počisti {country} BREZ dvojne poševnice", () => {
    // Dest je, države ni → /{country}/ se skrči na / (ne //).
    expect(
      applyTemplate(
        "https://www.discovercars.com/{country}/{dest}",
        "Bled",
        null,
        null
      )
    ).toBe("https://www.discovercars.com/Bled");
    // Nobenega parametra → domena brez sledi predloge.
    expect(
      applyTemplate("https://www.discovercars.com/{country}/{dest}", null, null, null)
    ).toBe("https://www.discovercars.com");
  });

  test("brez države: airalo NE pusti pokvarjenega ostanka „-eSIM“ (čisti {country})", () => {
    // applyTemplate sam počisti {country}, a ostanek NI veljavna stran
    // eSIM (zato registrski vnos airalo nosi noCountryTmpl — domača stran
    // z izbiro države; pokrit v sklopu buildPartnerLink spodaj).
    const out = applyTemplate(
      "https://www.airalo.com/{country}-eSIM",
      null,
      null,
      null
    );
    expect(out).not.toContain("{country}");
    expect(out).not.toMatch(/^https:\/\/www\.airalo\.com\/[a-z]+-eSIM$/);
  });
});

// ── buildPartnerLink: {country} + noCountryTmpl ────────────────────────────

describe("P0-F: buildPartnerLink — državni partnerji", () => {
  test("discovercars z državo: javna povezava {country}/{dest}", () => {
    const r = buildPartnerLink({
      provider: mustProvider("discovercars"),
      destName: "Zagreb",
      destCountryName: "croatia",
    });
    expect(r.url).toBe("https://www.discovercars.com/croatia/Zagreb");
    expect(r.affiliateActive).toBe(false);
    expect(r.tmpl).toBe("public");
  });

  test("airalo brez države → noCountryTmpl (domača stran z izbiro države)", () => {
    const r = buildPartnerLink({
      provider: mustProvider("airalo"),
      destName: null,
      destCountryName: null,
    });
    expect(r.url).toBe("https://www.airalo.com/");
    expect(r.affiliateActive).toBe(false);
    expect(r.tmpl).toBe("public");
  });

  test("airalo z državo → {country}-eSIM stran", () => {
    const r = buildPartnerLink({
      provider: mustProvider("airalo"),
      destName: "Bled",
      destCountryName: "slovenia",
    });
    expect(r.url).toBe("https://www.airalo.com/slovenia-eSIM");
  });

  test("discovercars brez države (custom postanek) → brez dvojne poševnice", () => {
    const r = buildPartnerLink({
      provider: mustProvider("discovercars"),
      destName: "Bled",
      destCountryName: null,
    });
    expect(r.url).toBe("https://www.discovercars.com/Bled");
    expect(r.url).not.toContain("//Bled");
  });
});

// ── R41-F4 (2.58.0): {country} za 6 novih balkanskih držav ─────────────────

describe("R41-F4: {country} predloge za 6 novih balkanskih držav", () => {
  // R41-F4: živo preverjeni vzorci (curl 200, 2026-10-14) — airalo
  // IN discovercars pokrivata cel Balkan; URL imena po obeh ponudnikih
  // enaka. Testi zaklenejo tok skozi buildPartnerLink (javna plast —
  // enaka, kot jo 302 /api/affiliate/go izgradi iz kanonskega nabora).
  const F4_CASES = [
    { code: "BA", urlName: "bosnia-and-herzegovina", dest: "Sarajevo" },
    { code: "RS", urlName: "serbia", dest: "Beograd" },
    { code: "MK", urlName: "macedonia", dest: "Ohrid" },
    { code: "XK", urlName: "kosovo", dest: "Prizren" },
    { code: "BG", urlName: "bulgaria", dest: "Sofija" },
    { code: "GR", urlName: "greece", dest: "Solun" },
  ] as const;

  test("discovercars: {country}/{dest} za vseh 6 novih držav", () => {
    for (const c of F4_CASES) {
      const r = buildPartnerLink({
        provider: mustProvider("discovercars"),
        destName: c.dest,
        destCountryName: c.urlName,
      });
      expect(r.url).toBe(
        `https://www.discovercars.com/${c.urlName}/${c.dest}`
      );
      expect(r.affiliateActive).toBe(false);
      expect(r.tmpl).toBe("public");
      expect(r.url).not.toContain("{country}");
      expect(r.url).not.toContain("/croatia//"); // brez dvojne poševnice za {country}/
    }
  });

  test("airalo: {country}-eSIM za vseh 6 novih držav", () => {
    for (const c of F4_CASES) {
      const r = buildPartnerLink({
        provider: mustProvider("airalo"),
        destName: c.dest,
        destCountryName: c.urlName,
      });
      expect(r.url).toBe(`https://www.airalo.com/${c.urlName}-eSIM`);
      expect(r.affiliateActive).toBe(false);
      expect(r.tmpl).toBe("public");
    }
  });

  test("cevovod 302: destinacija nabora → countryUrlName → {country} povezava", () => {
    // Pogled od konca do konca, kot ga 302 /api/affiliate/go izvede:
    // getDestination(slug).country → countryUrlName → applyTemplate.
    const dest = getDestination("sarajevo"); // F1 nabor (data-lock balkan-f1)
    expect(dest).toBeDefined();
    const name = countryUrlName(dest!.country);
    expect(name).toBe("bosnia-and-herzegovina");
    const r = buildPartnerLink({
      provider: mustProvider("airalo"),
      destName: dest!.name,
      destCountryName: name,
    });
    expect(r.url).toBe("https://www.airalo.com/bosnia-and-herzegovina-eSIM");
  });
});

// ── Iskrena veriga: ID brez znanega vzorca ─────────────────────────────────

describe("P0-F: iskrena veriga — partnerji brez javno dokumentiranega vzorca žetona", () => {
  test("viator z ID-jem a brez vzorca → javna povezava, NEAKTIVNA (brez lažne provizije)", () => {
    const r = buildPartnerLink({
      provider: mustProvider("viator"),
      destName: "Bled",
      affiliateId: "moj-id-123",
    });
    expect(r.tmpl).toBe("public");
    expect(r.affiliateActive).toBe(false);
    expect(r.url).toBe("https://www.viator.com/searchResults/all?text=Bled");
    expect(r.url).not.toContain("moj-id-123"); // ID se ne razkrije v javni povezavi
  });

  test("viator z lastnikovim TMPL override → aktivna provizijska povezava", () => {
    const r = buildPartnerLink({
      provider: mustProvider("viator"),
      destName: "Bled",
      affiliateId: "moj-id-123",
      tmplOverride: "https://www.viator.com/searchResults/all?text={dest}&pid={id}",
    });
    expect(r.tmpl).toBe("override");
    expect(r.affiliateActive).toBe(true);
    expect(r.url).toBe(
      "https://www.viator.com/searchResults/all?text=Bled&pid=moj-id-123"
    );
  });

  test("ista iskrena veriga za vseh 7 novih partnerjev (P0-F)", () => {
    for (const id of [
      "viator",
      "tiqets",
      "skyscanner",
      "airalo",
      "discovercars",
      "worldnomads",
      "safetywing",
    ]) {
      const zId = buildPartnerLink({
        provider: mustProvider(id),
        destName: "Bled",
        affiliateId: "test-id",
      });
      expect(zId.affiliateActive).toBe(false);
      expect(zId.tmpl).toBe("public");
      expect(zId.url).not.toContain("test-id");
      // In obratno: override z ID aktivira.
      const zOverride = buildPartnerLink({
        provider: mustProvider(id),
        destName: "Bled",
        affiliateId: "test-id",
        tmplOverride: "https://primer.example/?x={dest}&p={id}",
      });
      expect(zOverride.affiliateActive).toBe(true);
      expect(zOverride.tmpl).toBe("override");
    }
  });

  test("fiksni javni URL-ji (skyscanner/worldnomads/safetywing) — brez destinacije, brez izmišljenih parametrov", () => {
    expect(
      buildPartnerLink({ provider: mustProvider("skyscanner"), destName: "Bled" }).url
    ).toBe("https://www.skyscanner.net/");
    expect(
      buildPartnerLink({ provider: mustProvider("worldnomads"), destName: "Bled" }).url
    ).toBe("https://www.worldnomads.com/travel-insurance");
    expect(
      buildPartnerLink({ provider: mustProvider("safetywing"), destName: "Bled" }).url
    ).toBe("https://safetywing.com/nomad-insurance");
  });

  test("tiqets: iskanje po {dest} (vzorec preverjen s curl 200)", () => {
    expect(
      buildPartnerLink({ provider: mustProvider("tiqets"), destName: "Bled" }).url
    ).toBe("https://www.tiqets.com/en/search?search_query=Bled");
  });
});

// ── Ocena provizije z null (neznano do pogodbe) ────────────────────────────

describe("P0-F: estimateCommission — neznani odstotki", () => {
  test("pct null → commissionEur null (NI izmišljene ocene)", () => {
    for (const id of ["tiqets", "skyscanner", "airalo", "discovercars", "worldnomads", "safetywing"]) {
      const r = estimateCommission(mustProvider(id), 250);
      expect(r).toEqual({ baseEur: 250, commissionEur: null, pct: null });
    }
  });

  test("viator (pct 8 iz MindTrip raziskave) → ocena deluje kot pri starih partnerjih", () => {
    expect(estimateCommission(mustProvider("viator"), 100)).toEqual({
      baseEur: 100,
      commissionEur: 8,
      pct: 8,
    });
  });

  test("gorivo ostaja 0 % (izrecno — ni monizacija)", () => {
    expect(estimateCommission(mustProvider("osm-fuel"), 100)).toEqual({
      baseEur: 100,
      commissionEur: 0,
      pct: 0,
    });
  });
});

// ── Predlog vnosa iz poročila (admin) ──────────────────────────────────────

describe("P0-F: commissionDraftFromInput — partnerji z neznanim odstotkom", () => {
  test("brez ročne provizije → izrecna napaka (ne izmišljujemo ocene)", () => {
    const r = commissionDraftFromInput({
      providerId: "tiqets",
      bookingRef: "TQ-1001",
      amountEur: 120,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("vnesi provizijo iz poročila");
    }
  });

  test("z ročno provizijo iz poročila → veljaven predlog (payout T+3/28.)", () => {
    const r = commissionDraftFromInput({
      providerId: "tiqets",
      bookingRef: "TQ-1001",
      amountEur: 120,
      commissionEur: 9.6,
      stayCompletedAt: "2026-10-14",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.draft.commissionEur).toBe(9.6);
      expect(r.draft.payoutDueAt?.getUTCDate()).toBe(28);
      expect(r.draft.payoutDueAt?.getUTCMonth()).toBe(0); // januar 2027
    }
  });

  test("partner z znano oceno brez ročne provizije → ocena registra (nespremenjeno)", () => {
    const r = commissionDraftFromInput({
      providerId: "booking",
      bookingRef: "BK-77",
      amountEur: 100,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.draft.commissionEur).toBe(6);
    }
  });
});
