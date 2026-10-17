/**
 * SUPPLY-ACTIVATION — testi P0-B plasti (issue #1 RECOVER + RECONCILE).
 *
 * Pokriva:
 *  · integriteto registra zmožnosti (19 ponudnikov, unikatni id-ji),
 *  · integriteto matrike življenjskega cikla (isti nabor id-jev),
 *  · cross-ref usklajenost z /go hub registrom in affiliate registrom
 *    (RECONCILE kanon: en sam vir resnice čez vse tri registre),
 *  · vsa 8 mehanskih pravil izpeljke stanj (na sintetičnih vnosih),
 *  · dejansko stanje matrike (števci + konkretni ponudniki),
 *  · env aktivacijo partnerjev (Boolean prisotnost, prazni nizi),
 *  · KANARČEK: vrednosti env spremenljivk se NIKOLI ne izpišejo,
 *  · determinizem (isti env → isto poročilo).
 *
 * Kanon: 0 omrežja, 0 db, 0 stranskih učinkov; vsa imena v slovenščini.
 */

import { describe, expect, test } from "bun:test";

import {
  SUPPLY_REGISTRY,
  SUPPLY_PROVIDER_IDS,
  getProviderCapabilities,
  type ProviderCapabilities,
  type SupplyProviderId,
} from "../src/lib/supply/registry";
import {
  PRODUCTION_MATRIX,
  getMatrixEntry,
  type ProviderMatrixEntry,
} from "../src/lib/supply/production-matrix";
import {
  checkAllProviders,
  checkProvider,
  checkProviderById,
  deriveProductionState,
  PRODUCTION_STATE_LABELS,
  type EnvLike,
  type ProductionState,
} from "../src/lib/supply/activation-check";
import { GO_PARTNERS, type GoRouteSlug } from "../src/lib/go-data";
import { AFFILIATE_PROVIDERS } from "../src/lib/affiliate-providers";

// ── Pomožniki ──────────────────────────────────────────────────────────────

/** Sintetični vnos matrike za testiranje pravil izpeljke. */
function vnos(
  del: Partial<ProviderMatrixEntry> & Pick<ProviderMatrixEntry, "gate">
): ProviderMatrixEntry {
  return {
    id: "own",
    codeStatus: "LIVE",
    envKeys: [],
    reasonSl: "testni vnos",
    stepsSl: [],
    ...del,
  };
}

/** Seznam id-jev /go hub partnerjev (iz vseh rut). */
const GO_HUB_SLUGI = GO_PARTNERS.flatMap((r) => r.providers.map((p) => p.slug));

/** Affiliate register kot mapa id → definicija. */
const AFFILIATE_MAP = new Map(AFFILIATE_PROVIDERS.map((p) => [p.id, p]));

// ── Register zmožnosti ─────────────────────────────────────────────────────

describe("supply register — integriteta", () => {
  test("19 ponudnikov (16 izvirnikovih + 3 novi po MindTrip)", () => {
    expect(SUPPLY_REGISTRY.length).toBe(19);
  });

  test("unikatni id-ji", () => {
    const ids = SUPPLY_REGISTRY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("16 izvirnikovih + 3 novi — dokumentirana RECONCILE preslikava", () => {
    const izvirnikovi: readonly SupplyProviderId[] = [
      "fsq",
      "osm",
      "sto",
      "kiwitaxi",
      "viator",
      "getyourguide",
      "tiqets",
      "booking",
      "skyscanner",
      "airalo",
      "travelpayouts",
      "discovercars",
      "omio",
      "worldnomads",
      "safetywing",
      "own",
    ];
    const novi: readonly SupplyProviderId[] = ["kiwi", "rentalcars", "osm-fuel"];
    for (const id of [...izvirnikovi, ...novi]) {
      expect(SUPPLY_PROVIDER_IDS).toContain(id);
    }
    // ničesar zunaj teh dveh množic
    expect(SUPPLY_REGISTRY.length).toBe(izvirnikovi.length + novi.length);
  });

  test("vsak vnos ima veljavno vrsto dostopa in stanje cen", () => {
    const dostopi = new Set([
      "open-data",
      "open-data-live",
      "static-content",
      "partner-feed",
      "affiliate-deeplink",
      "api",
      "own-marketplace",
    ]);
    const cene = new Set([
      "LIVE_PRICE",
      "FROM_PRICE",
      "UNKNOWN",
      "NOT_SUPPORTED",
    ]);
    for (const p of SUPPLY_REGISTRY) {
      expect(dostopi.has(p.accessType)).toBe(true);
      expect(cene.has(p.priceState)).toBe(true);
      expect(p.categories.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  test("kanonska stanja cen: lastna tržnica živa, feed od-cena, partnerji neznani", () => {
    expect(getProviderCapabilities("own")?.priceState).toBe("LIVE_PRICE");
    expect(getProviderCapabilities("kiwitaxi")?.priceState).toBe("FROM_PRICE");
    expect(getProviderCapabilities("booking")?.priceState).toBe("UNKNOWN");
    expect(getProviderCapabilities("getyourguide")?.priceState).toBe("UNKNOWN");
    expect(getProviderCapabilities("fsq")?.priceState).toBe("NOT_SUPPORTED");
    expect(getProviderCapabilities("osm-fuel")?.priceState).toBe(
      "NOT_SUPPORTED"
    );
  });

  test("getProviderCapabilities: neznani id → undefined (nikoli izjema)", () => {
    expect(getProviderCapabilities("neobstojec")).toBeUndefined();
  });
});

// ── Matrika ────────────────────────────────────────────────────────────────

describe("production-matrix — integriteta", () => {
  test("matrika ima ISTE id-je kot register (en vir resnice)", () => {
    const registrirani = new Set(SUPPLY_PROVIDER_IDS);
    for (const e of PRODUCTION_MATRIX) {
      expect(registrirani.has(e.id)).toBe(true);
    }
    expect(PRODUCTION_MATRIX.length).toBe(SUPPLY_REGISTRY.length);
  });

  test("vsak vnos ima neprazen razlog in veljavno stanje kode", () => {
    const stanja = new Set(["LIVE", "CONTENT_LIVE", "PENDING_RESTORE"]);
    for (const e of PRODUCTION_MATRIX) {
      expect(stanja.has(e.codeStatus)).toBe(true);
      expect(e.reasonSl.length).toBeGreaterThan(10);
    }
  });

  test("gate „env“ mora imeti vsaj en envKey (sicer bi bil vakuumsko aktiven)", () => {
    for (const e of PRODUCTION_MATRIX) {
      if (e.gate === "env" && e.codeStatus === "LIVE") {
        expect(e.envKeys.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── Cross-ref usklajenost (RECONCILE) ──────────────────────────────────────

describe("cross-ref: /go hub + affiliate register + matrika", () => {
  test("vsak /go hub partner (12) obstaja v registru zmožnosti", () => {
    expect(GO_HUB_SLUGI.length).toBe(12);
    for (const slug of GO_HUB_SLUGI) {
      expect(getProviderCapabilities(slug)).toBeDefined();
    }
  });

  test("vsak affiliate partner 2.5.0+ obstaja v registru zmožnosti", () => {
    for (const p of AFFILIATE_PROVIDERS) {
      expect(getProviderCapabilities(p.id)).toBeDefined();
    }
  });

  test("P0-F popolnost: VSAK ponudnik z dostopom affiliate-deeplink je v registru partnerjev", () => {
    // Pravilo P0-F (2.10.0): register partnerjev sprejme VSE supply
    // ponudnike z accessType „affiliate-deeplink" (+ osm-fuel izjema za
    // gorivo). kiwitaxi (partner-feed) in travelpayouts (api) NAMENOMA
    // nista — njuna plast sta vir/API, ne globoka povezava.
    const pričakovani = SUPPLY_REGISTRY.filter(
      (p) => p.accessType === "affiliate-deeplink"
    ).map((p) => p.id as string);
    const registrirani = new Set(
      AFFILIATE_PROVIDERS.map((p) => p.id as string)
    );
    for (const id of pričakovani) {
      expect(registrirani.has(id)).toBe(true);
    }
    // In obratno: vsak ne-gorivni vnos registra ima affiliate-deeplink
    // dostop v supply registru (usklajenost dostopov).
    for (const p of AFFILIATE_PROVIDERS) {
      if (p.category === "fuel") continue;
      expect(getProviderCapabilities(p.id)?.accessType).toBe(
        "affiliate-deeplink"
      );
    }
    // 12 moniziranih + gorivo = 13 vnosov registra.
    expect(AFFILIATE_PROVIDERS.length).toBe(13);
    expect(pričakovani.length).toBe(12);
  });

  test("goSlug navzkrižne reference obstajajo v GO_PARTNERS", () => {
    const rute = new Set(GO_PARTNERS.map((r) => r.slug as string));
    for (const e of PRODUCTION_MATRIX) {
      if (e.goSlug) {
        expect(rute.has(e.goSlug)).toBe(true);
      }
    }
  });

  test("envKeys so NATANČNO envId+envTmpl affiliate registra (brez izmišljenih ključev)", () => {
    for (const e of PRODUCTION_MATRIX) {
      if (!e.affiliateId) continue;
      const def = AFFILIATE_MAP.get(e.affiliateId);
      expect(def).toBeDefined();
      if (!def) continue;
      const pričakovani = [def.envId, def.envTmpl].filter(
        (k) => k.length > 0
      );
      expect([...e.envKeys].sort()).toEqual([...pričakovani].sort());
    }
  });

  test("vsak rezervacijski partner registra ima affiliateId v matriki", () => {
    const zAffiliate = new Set(
      PRODUCTION_MATRIX.filter((e) => e.affiliateId).map((e) => e.id)
    );
    for (const p of AFFILIATE_PROVIDERS) {
      expect(zAffiliate.has(p.id as never)).toBe(true);
    }
  });
});

// ── Mehanika izpeljke (8 pravil na sintetičnih vnosih) ─────────────────────

describe("deriveProductionState — mehanska pravila", () => {
  test("P1: gate restore → NOT_CONFIGURED (tudi če je koda živa)", () => {
    expect(deriveProductionState(vnos({ gate: "restore" }), {})).toBe(
      "NOT_CONFIGURED"
    );
  });

  test("P1b: gate data → NOT_CONFIGURED (koda obnovljena, čaka podatkovni vir — P0-C)", () => {
    expect(deriveProductionState(vnos({ gate: "data" }), {})).toBe(
      "NOT_CONFIGURED"
    );
    // tudi z env (vir podatkov NI env)
    expect(deriveProductionState(vnos({ gate: "data" }), { KARKOLI: "x" })).toBe(
      "NOT_CONFIGURED"
    );
  });

  test("P2: PENDING_RESTORE → NOT_CONFIGURED (obnova čaka)", () => {
    expect(
      deriveProductionState(
        vnos({ gate: "none", codeStatus: "PENDING_RESTORE" }),
        {}
      )
    ).toBe("NOT_CONFIGURED");
  });

  test("P3: CONTENT_LIVE + partner-approval → BLOCKED", () => {
    expect(
      deriveProductionState(
        vnos({ gate: "partner-approval", codeStatus: "CONTENT_LIVE" }),
        {}
      )
    ).toBe("BLOCKED");
  });

  test("P3: CONTENT_LIVE + contract → BLOCKED", () => {
    expect(
      deriveProductionState(
        vnos({ gate: "contract", codeStatus: "CONTENT_LIVE" }),
        {}
      )
    ).toBe("BLOCKED");
  });

  test("P4: CONTENT_LIVE + env → NOT_CONFIGURED (register še ni razširjen)", () => {
    expect(
      deriveProductionState(
        vnos({ gate: "env", codeStatus: "CONTENT_LIVE", envKeys: ["X_ID"] }),
        { X_ID: "karkoli" }
      )
    ).toBe("NOT_CONFIGURED");
  });

  test("P5: LIVE + none → ACTIVE (odprti podatki)", () => {
    expect(deriveProductionState(vnos({ gate: "none" }), {})).toBe("ACTIVE");
  });

  test("P6: LIVE + production-proof → CONFIGURED (namerno zadržano)", () => {
    expect(deriveProductionState(vnos({ gate: "production-proof" }), {})).toBe(
      "CONFIGURED"
    );
  });

  test("P7: LIVE + env → vsi ključi prisotni = ACTIVE", () => {
    const e = vnos({ gate: "env", envKeys: ["A_ID", "A_TMPL"] });
    expect(
      deriveProductionState(e, { A_ID: "123", A_TMPL: "https://x/{id}" })
    ).toBe("ACTIVE");
  });

  test("P7: LIVE + env → manjka en ključ = NOT_CONFIGURED", () => {
    const e = vnos({ gate: "env", envKeys: ["A_ID", "A_TMPL"] });
    expect(deriveProductionState(e, { A_ID: "123" })).toBe("NOT_CONFIGURED");
  });

  test("P7: LIVE + env → prazen niz NI prisotnost (Boolean-only)", () => {
    const e = vnos({ gate: "env", envKeys: ["A_ID"] });
    expect(deriveProductionState(e, { A_ID: "   " })).toBe("NOT_CONFIGURED");
    expect(deriveProductionState(e, { A_ID: "" })).toBe("NOT_CONFIGURED");
  });

  test("P8: LIVE + partner-approval → BLOCKED", () => {
    expect(deriveProductionState(vnos({ gate: "partner-approval" }), {})).toBe(
      "BLOCKED"
    );
  });

  test("P8: LIVE + contract → BLOCKED", () => {
    expect(deriveProductionState(vnos({ gate: "contract" }), {})).toBe(
      "BLOCKED"
    );
  });
});

// ── Dejansko stanje matrike ────────────────────────────────────────────────

describe("checkAllProviders — dejansko stanje (2.x resnica)", () => {
  const prazno = checkAllProviders({});

  test("števci: 4 ACTIVE · 1 CONFIGURED · 14 NOT_CONFIGURED · 0 BLOCKED (kiwitaxi vir živ)", () => {
    expect(prazno.counts.ACTIVE).toBe(4);
    expect(prazno.counts.CONFIGURED).toBe(1);
    expect(prazno.counts.NOT_CONFIGURED).toBe(14);
    expect(prazno.counts.BLOCKED).toBe(0);
    expect(prazno.rows.length).toBe(19);
  });

  test("odprti/vsebinski viri brez aktivacije so ACTIVE (osm-fuel + osm + sto — P0-C)", () => {
    expect(checkProviderById("osm-fuel", {})?.state).toBe("ACTIVE");
    expect(checkProviderById("osm", {})?.state).toBe("ACTIVE");
    expect(checkProviderById("sto", {})?.state).toBe("ACTIVE");
  });

  test("own tržnica je CONFIGURED (čaka dokaz živih partnerjev)", () => {
    expect(checkProviderById("own", {})?.state).toBe("CONFIGURED");
  });

  test("rezervacijski partnerji so NOT_CONFIGURED brez env (iskrene javne povezave)", () => {
    for (const id of [
      "booking",
      "getyourguide",
      "kiwi",
      "rentalcars",
      "omio",
      "viator",
      "tiqets",
      "skyscanner",
      "airalo",
      "discovercars",
      "worldnomads",
      "safetywing",
    ]) {
      expect(checkProviderById(id, {})?.state).toBe("NOT_CONFIGURED");
    }
  });

  test("P0-F: affiliate partnerji izvirnikovega /go registra niso več BLOCKED — plast je živa, vrata so env", () => {
    // 2.9.0: ti partnerji so bili BLOCKED (partner-approval/contract), ker
    // providerska plast ni obstajala. P0-F (2.10.0) je register razširil na
    // vseh 12 affiliate-deeplink ponudnikov — ovira je ODSTRANJENA, vrata
    // aktivacije so zdaj env (prijava v program + TMPL/ID — lastnikovo dejanje).
    for (const id of [
      "viator",
      "tiqets",
      "skyscanner",
      "airalo",
      "discovercars",
      "worldnomads",
      "safetywing",
    ]) {
      const vnos = getMatrixEntry(id)!;
      expect(vnos.codeStatus).toBe("LIVE");
      expect(vnos.gate).toBe("env");
      expect(vnos.envKeys.length).toBeGreaterThan(0);
      expect(checkProviderById(id, {})?.state).toBe("NOT_CONFIGURED");
    }
    // Ni ZUNANJE ovire več — 0 BLOCKED.
    expect(checkAllProviders({}).counts.BLOCKED).toBe(0);
  });

  test("fsq: koda obnovljena (P0-C), a čaka PODATKOVNI VIR → NOT_CONFIGURED (gate data)", () => {
    expect(checkProviderById("fsq", {})?.state).toBe("NOT_CONFIGURED");
    expect(getMatrixEntry("fsq")?.gate).toBe("data");
  });

  test("kiwitaxi: vir najden (webmaster CSV API) in ingesciran → ACTIVE (gate none)", () => {
    // Odločitveni paket docs/research/kiwitaxi-vir.md: uradni webmaster
    // CSV API (javno dokumentiran) — množica regije SI·HR·ME·AL je
    // ingescirana v data/kiwitaxi-routes.json; vrata „data" so padla.
    const vnos = getMatrixEntry("kiwitaxi");
    expect(vnos?.gate).toBe("none");
    expect(checkProviderById("kiwitaxi", {})?.state).toBe("ACTIVE");
  });

  test("z ves env nastavljenimi postanejo VSI affiliate partnerji ACTIVE (12)", () => {
    const env: EnvLike = {
      AFFILIATE_BOOKING_ID: "b1",
      AFFILIATE_BOOKING_TMPL: "https://b/{id}",
      AFFILIATE_GYG_ID: "g1",
      AFFILIATE_GYG_TMPL: "https://g/{id}",
      AFFILIATE_KIWI_ID: "k1",
      AFFILIATE_KIWI_TMPL: "https://k/{id}",
      AFFILIATE_RENTALCARS_ID: "r1",
      AFFILIATE_RENTALCARS_TMPL: "https://r/{id}",
      AFFILIATE_OMIO_ID: "o1",
      AFFILIATE_OMIO_TMPL: "https://o/{id}",
      AFFILIATE_VIATOR_ID: "v1",
      AFFILIATE_VIATOR_TMPL: "https://v/{id}",
      AFFILIATE_TIQETS_ID: "t1",
      AFFILIATE_TIQETS_TMPL: "https://t/{id}",
      AFFILIATE_SKYSCANNER_ID: "s1",
      AFFILIATE_SKYSCANNER_TMPL: "https://s/{id}",
      AFFILIATE_AIRALO_ID: "a1",
      AFFILIATE_AIRALO_TMPL: "https://a/{id}",
      AFFILIATE_DISCOVERCARS_ID: "d1",
      AFFILIATE_DISCOVERCARS_TMPL: "https://d/{id}",
      AFFILIATE_WORLDNOMADS_ID: "w1",
      AFFILIATE_WORLDNOMADS_TMPL: "https://w/{id}",
      AFFILIATE_SAFETYWING_ID: "sw1",
      AFFILIATE_SAFETYWING_TMPL: "https://sw/{id}",
    };
    const poročilo = checkAllProviders(env);
    expect(poročilo.counts.ACTIVE).toBe(16); // osm-fuel + osm + sto + kiwitaxi + 12 partnerjev
    for (const id of [
      "booking",
      "getyourguide",
      "kiwi",
      "rentalcars",
      "omio",
      "viator",
      "tiqets",
      "skyscanner",
      "airalo",
      "discovercars",
      "worldnomads",
      "safetywing",
    ]) {
      expect(checkProviderById(id, env)?.state).toBe("ACTIVE");
    }
    // P0-F: zunanjih ovir ni več (BLOCKED 0)
    expect(poročilo.counts.BLOCKED).toBe(0);
  });

  test("stanja imajo slovenske in angleške oznake", () => {
    for (const s of Object.keys(PRODUCTION_STATE_LABELS) as ProductionState[]) {
      expect(PRODUCTION_STATE_LABELS[s].sl.length).toBeGreaterThan(0);
      expect(PRODUCTION_STATE_LABELS[s].en.length).toBeGreaterThan(0);
    }
  });
});

// ── Varnostni kanarček ─────────────────────────────────────────────────────

describe("kanarček — env vrednosti se NIKOLI ne izpišejo", () => {
  test("skrivnost v env se ne pojavi v JSON izpisu poročila", () => {
    const SKRIVNOST = "ghp-TAJNA-VREDNOST-12345-nikoli-v-izpis";
    const env: EnvLike = {
      AFFILIATE_BOOKING_ID: SKRIVNOST,
      AFFILIATE_BOOKING_TMPL: `https://booking.com/?aid=${SKRIVNOST}`,
    };
    const izpis = JSON.stringify(checkAllProviders(env));
    expect(izpis.includes(SKRIVNOST)).toBe(false);
  });

  test("envPresent vsebuje SAMO boolovske zastavice (ne nizov)", () => {
    const env: EnvLike = { AFFILIATE_BOOKING_ID: "abc123" };
    const r = checkProvider(
      PRODUCTION_MATRIX.find((e) => e.id === "booking")!,
      env
    );
    for (const v of Object.values(r.envPresent)) {
      expect(typeof v).toBe("boolean");
    }
    expect(r.envPresent["AFFILIATE_BOOKING_ID"]).toBe(true);
    expect(r.envPresent["AFFILIATE_BOOKING_TMPL"]).toBe(false);
  });
});

// ── Determinizem ───────────────────────────────────────────────────────────

describe("determinizem", () => {
  test("isti env → isto poročilo (globinsko)", () => {
    const env: EnvLike = { AFFILIATE_KIWI_ID: "k1" };
    expect(checkAllProviders(env)).toEqual(checkAllProviders(env));
  });

  test("vrstni red vrstic sledi matriki (stabilen izpis CLI)", () => {
    const a = checkAllProviders({});
    expect(a.rows.map((r) => r.id)).toEqual(
      PRODUCTION_MATRIX.map((e) => e.id as string)
    );
  });
});
