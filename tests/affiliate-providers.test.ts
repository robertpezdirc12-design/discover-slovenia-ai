/**
 * AFFILIATE-PROVIDERS — čisti register rezervacijskih partnerjev (Task
 * 55-core): iskanje po id-ju, gradnja partnerjskih povezav (javna /
 * provizijska / lastnikova predloga), ocena provizije, izplačilni koledar
 * T+3 meseci in javni DTO.
 *
 * Zaklene kanone:
 * - REGISTER: zmrznjen (Object.isFrozen), 13 partnerjev z unikatnimi id-ji
 *   (P0-F: 12 provizijskih + gorivo); ocene provizij >= 0 ALI null (= ocena
 *   neznana do pogodbe — nikoli izmišljena); gorivo (osm-fuel) je izrecno
 *   brez provizije — 0 % in prazen envId (bencin = odprti podatki).
 * - ISKRENOST: partner brez ID-ja še vedno preusmeri na JAVNO iskanje
 *   (tmpl "public", affiliateActive false) — uporabnik pride do cilja,
 *   lastnik pa vidi povpraševanje, ki ga (še) ne monizira.
 * - VARNOST: javni DTO (providersPublicDTO) ne nosi NOBENEGA od polj
 *   envId/envTmpl/publicTmpl/affiliateTmpl — javni odgovor nikoli ne
 *   razkrije predlog povezav. commissionPct je NAMENOMO javen od P0-F
 *   (javno razkritje ocene, pogodbena — ne skrivnost).
 * - DETERMINISTIČNOST: payoutDueDate vedno 28. v mesecu ob 12:00 UTC.
 */

import { describe, expect, test } from "bun:test";

import {
  AFFILIATE_CATEGORIES,
  AFFILIATE_PROVIDERS,
  applyTemplate,
  buildPartnerLink,
  estimateCommission,
  getProvider,
  nearestAirportForRegion,
  payoutDueDate,
  providersPublicDTO,
  type AffiliateProviderDef,
} from "../src/lib/affiliate-providers";

/** Kanonski partner po id-ju — če manjka, je register pokvarjen. */
function mustProvider(id: string): AffiliateProviderDef {
  const p = getProvider(id);
  if (!p) throw new Error(`kanonski partner "${id}" manjka v registru`);
  return p;
}

describe("affiliate-providers: register (kanonski nabor)", () => {
  test("zmrznjen seznam (Object.isFrozen) — prirejanje je napaka, ne lastnost", () => {
    expect(Object.isFrozen(AFFILIATE_PROVIDERS)).toBe(true);
  });

  test("13 partnerjev z unikatnimi id-ji (P0-F: 12 provizijskih + gorivo)", () => {
    expect(AFFILIATE_PROVIDERS.length).toBe(13);
    const ids = AFFILIATE_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(13);
    expect([...ids].sort()).toEqual([
      "airalo",
      "booking",
      "discovercars",
      "getyourguide",
      "kiwi",
      "omio",
      "osm-fuel",
      "rentalcars",
      "safetywing",
      "skyscanner",
      "tiqets",
      "viator",
      "worldnomads",
    ]);
  });

  test("commissionPct: znani >= 0, neznani null (ocena, nikoli negativna obljuba)", () => {
    for (const p of AFFILIATE_PROVIDERS) {
      if (p.commissionPct == null) continue; // null = neznano do pogodbe (P0-F)
      expect(p.commissionPct).toBeGreaterThanOrEqual(0);
    }
    // Partnerji z javno raziskano oceno (2.5.0 MindTrip raziskava + P0-F).
    expect(mustProvider("booking").commissionPct).toBe(6);
    expect(mustProvider("getyourguide").commissionPct).toBe(8);
    expect(mustProvider("viator").commissionPct).toBe(8);
    expect(mustProvider("kiwi").commissionPct).toBe(3);
    expect(mustProvider("rentalcars").commissionPct).toBe(6);
    expect(mustProvider("omio").commissionPct).toBe(4);
    // Partnerji brez javno dokumentirane ocene → null (iskreno).
    for (const id of ["tiqets", "skyscanner", "airalo", "discovercars", "worldnomads", "safetywing"]) {
      expect(mustProvider(id).commissionPct).toBeNull();
    }
  });

  test("P0-F: novi partnerji s praznim affiliateTmpl — ID sam NE more zgraditi provizijske povezave", () => {
    for (const id of ["viator", "tiqets", "skyscanner", "airalo", "discovercars", "worldnomads", "safetywing"]) {
      expect(mustProvider(id).affiliateTmpl).toBe("");
      // Javna predloga pa obstaja in je neprazna (preverjeni vzorci).
      expect(mustProvider(id).publicTmpl.length).toBeGreaterThan(0);
      expect(mustProvider(id).publicTmpl).toMatch(/^https:\/\//);
    }
    // Partnerji z javno dokumentiranim vzorcem žetona ostajajo (2.5.0).
    for (const id of ["booking", "getyourguide", "kiwi", "rentalcars", "omio"]) {
      expect(mustProvider(id).affiliateTmpl.length).toBeGreaterThan(0);
      expect(mustProvider(id).affiliateTmpl).toContain("{id}");
    }
  });

  test("gorivo (osm-fuel): 0 % provizije in prazen envId — bencin ni rezervacija", () => {
    const fuel = mustProvider("osm-fuel");
    expect(fuel.commissionPct).toBe(0);
    expect(fuel.envId).toBe("");
    expect(fuel.category).toBe("fuel");
    expect(fuel.domain).toBe("openstreetmap.org");
  });
});

describe("affiliate-providers: getProvider", () => {
  test("znan id vrne registrski vnos", () => {
    const p = getProvider("booking");
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.id).toBe("booking");
    expect(p.name).toBe("Booking.com");
    expect(p.category).toBe("stays");
  });

  test("neznan id → null (nikoli izjema)", () => {
    expect(getProvider("ne-obstaja")).toBeNull();
    expect(getProvider("")).toBeNull();
    expect(getProvider("Booking.com")).toBeNull(); // išče se po id-ju, ne po imenu
  });
});

describe("affiliate-providers: applyTemplate", () => {
  test("{dest} se URL-kodira: \"Bled\" ostane, \"Portorož\" se zakodira", () => {
    expect(applyTemplate("https://x.example/?q={dest}", "Bled", null)).toBe(
      "https://x.example/?q=Bled"
    );
    expect(applyTemplate("https://x.example/?q={dest}", "Portorož", null)).toBe(
      "https://x.example/?q=Portoro%C5%BE"
    );
  });

  test("{id} se nadomesti z žetonom partnerja", () => {
    expect(
      applyTemplate("https://x.example/?aid={id}&q={dest}", "Bled", "XY-123")
    ).toBe("https://x.example/?aid=XY-123&q=Bled");
  });

  test("brez dest: ostanki parametrov se počistijo (nikoli dobesednega {dest})", () => {
    const out = applyTemplate(
      "https://www.booking.com/searchresults.html?ss={dest}&lang=sl",
      null,
      null
    );
    expect(out).toBe("https://www.booking.com/searchresults.html?ss=&lang=sl");
    expect(out).not.toContain("{dest}");
    // tudi ko je {dest} zadnji parameter (oblika getyourguide)
    expect(applyTemplate("https://www.getyourguide.com/s/?q={dest}", null, null)).toBe(
      "https://www.getyourguide.com/s/?q="
    );
  });
});

describe("affiliate-providers: buildPartnerLink (vrsta prednosti predlog)", () => {
  test("lastnikova predloga (tmplOverride) ima prednost pred privzetimi", () => {
    const r = buildPartnerLink({
      provider: mustProvider("booking"),
      destName: "Bled",
      affiliateId: "123",
      tmplOverride: "https://ovr.example/?q={dest}&aid={id}",
    });
    expect(r.tmpl).toBe("override");
    expect(r.affiliateActive).toBe(true);
    expect(r.url).toBe("https://ovr.example/?q=Bled&aid=123");
  });

  test("override brez ID-ja: predloga velja, povezava pa ni provizijska", () => {
    const r = buildPartnerLink({
      provider: mustProvider("booking"),
      destName: "Bled",
      tmplOverride: "https://ovr.example/?q={dest}",
    });
    expect(r.tmpl).toBe("override");
    expect(r.affiliateActive).toBe(false);
    expect(r.url).toBe("https://ovr.example/?q=Bled");
  });

  test("ID brez override → privzeta provizijska predloga (booking: aid=)", () => {
    const r = buildPartnerLink({
      provider: mustProvider("booking"),
      destName: "Bled",
      affiliateId: "123",
    });
    expect(r.tmpl).toBe("affiliate");
    expect(r.affiliateActive).toBe(true);
    expect(r.url).toContain("aid=123");
    expect(r.url).toBe(
      "https://www.booking.com/searchresults.html?ss=Bled&lang=sl&aid=123"
    );
  });

  test("ID brez override → getyourguide uporabi partner_id=", () => {
    const r = buildPartnerLink({
      provider: mustProvider("getyourguide"),
      destName: "Piran",
      affiliateId: "GYG1",
    });
    expect(r.tmpl).toBe("affiliate");
    expect(r.affiliateActive).toBe(true);
    expect(r.url).toContain("partner_id=GYG1");
    expect(r.url).toBe(
      "https://www.getyourguide.com/s/?q=Piran&partner_id=GYG1"
    );
  });

  test("brez ID → javna predloga, klik neaktiven, brez aid/partner_id", () => {
    const r = buildPartnerLink({
      provider: mustProvider("booking"),
      destName: "Bled",
      affiliateId: null,
    });
    expect(r.tmpl).toBe("public");
    expect(r.affiliateActive).toBe(false);
    expect(r.url).toBe(
      "https://www.booking.com/searchresults.html?ss=Bled&lang=sl"
    );
    expect(r.url).not.toContain("aid=");
    expect(r.url).not.toContain("partner_id=");
  });

  test("kategorija fuel → vedno openstreetmap.org, neaktiven (tudi z ID in override)", () => {
    const r = buildPartnerLink({
      provider: mustProvider("osm-fuel"),
      destName: "Bled",
      affiliateId: "X",
      tmplOverride: "https://primer.example/?aid={id}",
    });
    expect(r.url).toBe("https://www.openstreetmap.org/");
    expect(r.affiliateActive).toBe(false);
    expect(r.tmpl).toBe("public");
  });

  test("prazen niz / presledki / null destName → enako kot brez destinacije", () => {
    for (const destName of ["", "   ", null]) {
      const r = buildPartnerLink({
        provider: mustProvider("booking"),
        destName,
        affiliateId: null,
      });
      expect(r.url).toBe(
        "https://www.booking.com/searchresults.html?ss=&lang=sl"
      );
      expect(r.url).not.toContain("{dest}");
      expect(r.tmpl).toBe("public");
    }
  });
});

describe("affiliate-providers: estimateCommission (ocena, ne obljuba)", () => {
  test("booking: 100 € → 6 € provizije (6 %)", () => {
    expect(estimateCommission(mustProvider("booking"), 100)).toEqual({
      baseEur: 100,
      commissionEur: 6,
      pct: 6,
    });
  });

  test("getyourguide: 100 € → 8 € provizije (8 %)", () => {
    expect(estimateCommission(mustProvider("getyourguide"), 100)).toEqual({
      baseEur: 100,
      commissionEur: 8,
      pct: 8,
    });
  });

  test("negativna, ničelna in neveljavna osnova → 0 (fail-closed; odstopek ostane)", () => {
    for (const osnova of [-50, 0, NaN, Infinity]) {
      const r = estimateCommission(mustProvider("booking"), osnova);
      expect(r.baseEur).toBe(0);
      expect(r.commissionEur).toBe(0);
      expect(r.pct).toBe(6);
    }
  });

  test("zaokroževanje na 2 decimalki: 33,33 € × 6 % = 2 €", () => {
    const r = estimateCommission(mustProvider("booking"), 33.33);
    expect(r.baseEur).toBe(33.33);
    expect(r.commissionEur).toBe(2); // 1,9998 → 2,00
  });

  test("gorivo: 0 % — odprti podatki, nič provizije", () => {
    expect(estimateCommission(mustProvider("osm-fuel"), 100)).toEqual({
      baseEur: 100,
      commissionEur: 0,
      pct: 0,
    });
  });
});

describe("affiliate-providers: payoutDueDate (T+3 meseci, dan 28.)", () => {
  test("15. 5. 2026 → 28. 8. 2026", () => {
    const r = payoutDueDate(new Date("2026-05-15T12:00:00Z"));
    expect(r.getTime()).not.toBeNaN();
    expect(r.getUTCFullYear()).toBe(2026);
    expect(r.getUTCMonth()).toBe(7); // avgust
    expect(r.getUTCDate()).toBe(28);
  });

  test("31. 12. 2025 → 28. 3. 2026 (prekrok leta)", () => {
    const r = payoutDueDate(new Date("2025-12-31T12:00:00Z"));
    expect(r.getUTCFullYear()).toBe(2026);
    expect(r.getUTCMonth()).toBe(2); // marec
    expect(r.getUTCDate()).toBe(28);
  });

  // REGRESIJSKI ZAKLEP (popravek po odkritju 55-tests): setMonth na dan
  // 30 bi prelil v naslednji mesec (30. 11. + 3 → 1. 3.) in vrnil 28. 3.
  // Pravilen koledarski znesek je februar — mesec/leto seštevamo sami.
  test("30. 11. 2025 → 28. 2. 2026 (preliv dneva 30 — regresijski zaklep)", () => {
    const r = payoutDueDate(new Date("2025-11-30T12:00:00Z"));
    expect(r.getUTCFullYear()).toBe(2026);
    expect(r.getUTCMonth()).toBe(1); // februar
    expect(r.getUTCDate()).toBe(28);
  });

  test("29. 2. 2028 (prestopno) → 28. 5. 2028", () => {
    const r = payoutDueDate(new Date("2028-02-29T12:00:00Z"));
    expect(r.getUTCFullYear()).toBe(2028);
    expect(r.getUTCMonth()).toBe(4); // maj
    expect(r.getUTCDate()).toBe(28);
  });

  test("neveljaven datum → NaN (Number.isNaN(getTime()))", () => {
    expect(
      Number.isNaN(payoutDueDate(new Date("ne-veljavno")).getTime())
    ).toBe(true);
    expect(Number.isNaN(payoutDueDate(new Date(NaN)).getTime())).toBe(true);
  });

  test("ura deterministično nastavljena na 12:00 UTC (min/sek/ms = 0)", () => {
    const r = payoutDueDate(new Date("2026-05-15T18:45:30.500Z"));
    expect(r.getUTCHours()).toBe(12);
    expect(r.getUTCMinutes()).toBe(0);
    expect(r.getUTCSeconds()).toBe(0);
    expect(r.getUTCMilliseconds()).toBe(0);
    expect(r.toISOString()).toBe("2026-08-28T12:00:00.000Z");
  });
});

describe("affiliate-providers: nearestAirportForRegion (heuristika po regiji)", () => {
  test("primorska in kras → letališče Trst (TRS)", () => {
    for (const regija of ["primorska", "kras"]) {
      const a = nearestAirportForRegion(regija);
      expect(a.code).toBe("TRS");
      expect(a.city).toBe("Trst");
      expect(a.nameSl).toContain("Trst");
    }
  });

  test("stajerska in koroska → letališče Gradec (GRZ)", () => {
    for (const regija of ["stajerska", "koroska"]) {
      expect(nearestAirportForRegion(regija).code).toBe("GRZ");
    }
  });

  test("prekmurje → letališče Budimpešta (BUD)", () => {
    expect(nearestAirportForRegion("prekmurje").code).toBe("BUD");
  });

  test("gorenjska in neznane regije → Ljubljana (LJU, privzeto)", () => {
    for (const regija of ["gorenjska", "dolenjska", "zeptelinka", ""]) {
      expect(nearestAirportForRegion(regija).code).toBe("LJU");
    }
  });
});

describe("affiliate-providers: providersPublicDTO (javni DTO — varnostni kanon)", () => {
  test("dolžina 13, id-ji in imena 1:1 z registrom", () => {
    const dtos = providersPublicDTO();
    expect(dtos.length).toBe(13);
    expect(dtos.map((d) => d.id)).toEqual(AFFILIATE_PROVIDERS.map((p) => p.id));
    for (const d of dtos) {
      const p = AFFILIATE_PROVIDERS.find((x) => x.id === d.id);
      expect(p).toBeDefined();
      if (!p) continue;
      expect(d.name).toBe(p.name);
      expect(d.domain).toBe(p.domain);
    }
  });

  test("VARNOST: noben DTO ne nosi envId/envTmpl/publicTmpl/affiliateTmpl (ocena provizije je javna — P0-F)", () => {
    const dtos = providersPublicDTO();
    const prepovedana = [
      "envId",
      "envTmpl",
      "publicTmpl",
      "affiliateTmpl",
    ];
    for (const d of dtos) {
      for (const polje of prepovedana) {
        expect(polje in d).toBe(false);
      }
      // P0-F: commissionPct je NAMENOMO v DTO (javno razkritje ocene) in je
      // 1:1 z registrom (null = neznano do pogodbe).
      expect(d.commissionPct).toBe(
        AFFILIATE_PROVIDERS.find((p) => p.id === d.id)!.commissionPct
      );
    }
    // niti vrednostno: v celem javnem odgovoru ni predlog niti env imen
    const json = JSON.stringify(dtos);
    expect(json).not.toContain("{dest}");
    expect(json).not.toContain("{id}");
    expect(json).not.toContain("{country}");
    expect(json).not.toContain("AFFILIATE_");
  });

  test("gorivo commissionable false, vse ostale kategorije true", () => {
    const dtos = providersPublicDTO();
    for (const d of dtos) {
      expect(d.commissionable).toBe(d.category !== "fuel");
    }
    expect(dtos.find((d) => d.id === "osm-fuel")?.commissionable).toBe(false);
    expect(dtos.find((d) => d.id === "booking")?.commissionable).toBe(true);
  });

  test("categoryLabel obstaja za vse (sl + en, neprazni oznaki 1:1 iz registra)", () => {
    for (const d of providersPublicDTO()) {
      expect(typeof d.categoryLabel.sl).toBe("string");
      expect(d.categoryLabel.sl.length).toBeGreaterThan(0);
      expect(typeof d.categoryLabel.en).toBe("string");
      expect(d.categoryLabel.en.length).toBeGreaterThan(0);
      expect(d.categoryLabel).toEqual(AFFILIATE_CATEGORIES[d.category]);
    }
  });
});

describe("affiliate-providers: AFFILIATE_CATEGORIES (ključi kategorij)", () => {
  test("9 ključev (P0-F: + tickets/esim/insurance), vsak z oznakama sl + en", () => {
    expect(Object.keys(AFFILIATE_CATEGORIES).sort()).toEqual([
      "car",
      "esim",
      "experiences",
      "flights",
      "fuel",
      "insurance",
      "stays",
      "tickets",
      "transfers",
    ]);
    for (const lbl of Object.values(AFFILIATE_CATEGORIES)) {
      expect(lbl.sl.length).toBeGreaterThan(0);
      expect(lbl.en.length).toBeGreaterThan(0);
    }
    // kanon predstavniških oznak
    expect(AFFILIATE_CATEGORIES.stays).toEqual({ sl: "Nastanitve", en: "Stays" });
    expect(AFFILIATE_CATEGORIES.fuel).toEqual({ sl: "Bencinske", en: "Fuel" });
    expect(AFFILIATE_CATEGORIES.tickets).toEqual({ sl: "Vstopnice", en: "Tickets" });
    expect(AFFILIATE_CATEGORIES.esim).toEqual({ sl: "eSIM podatki", en: "eSIM data" });
    expect(AFFILIATE_CATEGORIES.insurance).toEqual({ sl: "Zavarovanje", en: "Insurance" });
  });
});
