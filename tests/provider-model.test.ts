/**
 * PROVIDER-MODEL TESTI — testni zaklepi faze 4a (#35, 2.61.0).
 * Čista logika brez DB/omrežja — enak kanon kot tests/listing-moderation.
 */

import { describe, expect, it } from "bun:test";

import {
  PROVIDER_BOOKING_MODES,
  PROVIDER_CATEGORIES,
  PROVIDER_REPORT_REASONS,
  PROVIDER_STATUSES,
  PROVIDER_VERIFICATIONS,
  geohashEncode,
  isCanonCountry,
  normalizeProviderName,
  providerCurrency,
  providerDedupKey,
  verificationState,
  VERIFICATION_TTL_MS,
} from "../src/lib/provider-model";

// ── Kanonski nabori (#35 §6a) ──────────────────────────────────────────────

describe("provider-model: kanonski nabori", () => {
  it("kategorije pokrijejo vseh 8 razredov iz #35 §3 (obseg ponudnikov)", () => {
    expect(PROVIDER_CATEGORIES).toEqual([
      "accommodation",
      "food",
      "guide",
      "activity",
      "transport",
      "attraction",
      "event",
      "wellness",
    ]);
  });

  it("booking mode vključuje partner — ki je ŠELE ob odobritvi (pogl. 7)", () => {
    expect(PROVIDER_BOOKING_MODES).toEqual(["none", "request", "redirect", "partner"]);
  });

  it("preverjanja so točno tri (unverified/claimed/verified)", () => {
    expect(PROVIDER_VERIFICATIONS).toEqual(["unverified", "claimed", "verified"]);
  });

  it("razlogi poročil so zaklenjeni", () => {
    expect(PROVIDER_REPORT_REASONS).toEqual(["napaka", "zaprt", "dupliciran", "drugo"]);
  });

  it("statusi publikacije so zaklenjeni", () => {
    expect(PROVIDER_STATUSES).toEqual(["draft", "published", "suspended"]);
  });
});

// ── Normalizacija imena ────────────────────────────────────────────────────

describe("provider-model: normalizeProviderName", () => {
  it("mala črka + razločevalni pregib (slovenščina)", () => {
    expect(normalizeProviderName("Turistična Kmetija Pri Jožetu")).toBe(
      "turisticna kmetija pri jozetu"
    );
  });

  it("ščžčć razločevalniki so pregibani", () => {
    expect(normalizeProviderName("Pizzeria Žabar")).toBe("pizzeria zabar");
    expect(normalizeProviderName("ŠČ ŽČ")).toBe("sc zc");
    expect(normalizeProviderName("Ćiro")).toBe("ciro");
  });

  it("đ je pregiban tudi, ko NFD ne razstavi (balkansko pomembno)", () => {
    expect(normalizeProviderName("Đakovica")).toBe("djakovica");
    expect(normalizeProviderName("Đerdap")).toBe("djerdap");
  });

  it("pravne priponke ne ločujejo istega ponudnika", () => {
    expect(normalizeProviderName("Motel Drina d.o.o.")).toBe(
      normalizeProviderName("Motel Drina")
    );
    expect(normalizeProviderName("Konak Stari Grad Srl")).toBe(
      normalizeProviderName("konak stari grad")
    );
  });

  it("ločila ne ločujejo (& , . -)", () => {
    expect(normalizeProviderName("Brka & Brka")).toBe(normalizeProviderName("Brka Brka"));
    expect(normalizeProviderName("Pri-Skoku, d.o.o.")).toBe("pri skoku");
  });

  it("prazno/vnos brez črk → prazen niz (klicalec sklepa na min dolžino)", () => {
    expect(normalizeProviderName("")).toBe("");
    expect(normalizeProviderName("!!!")).toBe("");
  });
});

// ── Geohash ────────────────────────────────────────────────────────────────

describe("provider-model: geohashEncode", () => {
  it("se ujema z znanim vektorjem (Wikipedia, 11 znakov)", () => {
    expect(geohashEncode(57.64911, 10.40744, 11)).toBe("u4pruydqqvj");
  });

  it("se ujema z znanim vektorjem (Wikipedia, 5 znakov)", () => {
    expect(geohashEncode(42.6, -5.6, 5)).toBe("ezs42");
  });

  it("Ljubljana p7 zaklenjen (u24q406 — slovenski prostor u24q4)", () => {
    expect(geohashEncode(46.0569, 14.5058, 7)).toBe("u24q406");
  });

  it("Beograd in Sarajevo p7 zaklenjena (različni prostori)", () => {
    expect(geohashEncode(44.7866, 20.4489, 7)).toBe("srywc34");
    expect(geohashEncode(43.8563, 18.4131, 7)).toBe("srv17pb");
  });

  it("daljša preciznost razširja (prefiks lastnost)", () => {
    const p7 = geohashEncode(46.0569, 14.5058, 7);
    const p9 = geohashEncode(46.0569, 14.5058, 9);
    expect(p9.slice(0, p7.length)).toBe(p7);
  });

  it("zavrne neveljavne vnose (iskrena napaka, ne ugibanje)", () => {
    expect(() => geohashEncode(91, 0, 7)).toThrow(RangeError);
    expect(() => geohashEncode(0, 181, 7)).toThrow(RangeError);
    expect(() => geohashEncode(Number.NaN, 0, 7)).toThrow(RangeError);
    expect(() => geohashEncode(0, 0, 0)).toThrow(RangeError);
    expect(() => geohashEncode(0, 0, 13)).toThrow(RangeError);
  });
});

// ── Dedup ključ (#35 §6c.5) ────────────────────────────────────────────────

describe("provider-model: providerDedupKey", () => {
  it("isti ponudnik (različna velika/razločevalniki/priponka) → ISTI ključ", () => {
    const a = providerDedupKey("Motel Drina d.o.o.", 43.8563, 18.4131);
    const b = providerDedupKey("motel drina", 43.8563, 18.4131);
    const c = providerDedupKey("MOTEL DRINA", 43.8563, 18.4131);
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("ključ vsebuje geohash-7 celico + normalizirano ime (berljiva oblika)", () => {
    expect(providerDedupKey("Motel Drina", 43.8563, 18.4131)).toBe("srv17pb:motel drina");
  });

  it("različno ime v isti celici → RAZLIČEN ključ", () => {
    const a = providerDedupKey("Motel Drina", 43.8563, 18.4131);
    const b = providerDedupKey("Restoran Drina", 43.8563, 18.4131);
    expect(a).not.toBe(b);
  });

  it("isti ime, dosegljivo daleč proč → RAZLIČEN ključ (dedup je geografsko lokalno)", () => {
    const a = providerDedupKey("Motel Drina", 43.8563, 18.4131); // Sarajevo
    const b = providerDedupKey("Motel Drina", 44.7866, 20.4489); // Beograd
    expect(a).not.toBe(b);
  });

  it("kratka razdalja (~30 m, isti del celice) → ISTI ključ (dedup namen)", () => {
    // ~30 m proti vzhodu pri širini Sarajeva ≈ 0.00037°
    const a = providerDedupKey("Motel Drina", 43.8563, 18.4131);
    const b = providerDedupKey("Motel Drina", 43.8563, 18.41347);
    expect(a).toBe(b);
  });
});

// ── Preverjanje + 12-mesečni potek (#35 §6a/§6c.6) ─────────────────────────

describe("provider-model: verificationState", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const danes = new Date(now.getTime() - 24 * 60 * 60 * 1000); // včeraj
  const pred11Mesecev = new Date(now.getTime() - 330 * 24 * 60 * 60 * 1000);
  const pred13Mesecev = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);

  it("TTL je točno 365 dni (12 mesecev)", () => {
    expect(VERIFICATION_TTL_MS).toBe(365 * 24 * 60 * 60 * 1000);
  });

  it("svež verified ostane verified (stale: false)", () => {
    expect(verificationState({ verification: "verified", verifiedAt: danes }, now)).toEqual({
      effective: "verified",
      stale: false,
    });
    expect(
      verificationState({ verification: "verified", verifiedAt: pred11Mesecev }, now)
    ).toEqual({ effective: "verified", stale: false });
  });

  it("stale verified (≥ 12 mesecev) PADE na claimed (stale: true)", () => {
    expect(
      verificationState({ verification: "verified", verifiedAt: pred13Mesecev }, now)
    ).toEqual({ effective: "claimed", stale: true });
  });

  it("meja je vključujoča: točno na 365 dni še sveže", () => {
    const tocenTtl = new Date(now.getTime() - VERIFICATION_TTL_MS);
    expect(verificationState({ verification: "verified", verifiedAt: tocenTtl }, now)).toEqual({
      effective: "verified",
      stale: false,
    });
    const nadTtl = new Date(now.getTime() - VERIFICATION_TTL_MS - 1);
    expect(verificationState({ verification: "verified", verifiedAt: nadTtl }, now)).toEqual({
      effective: "claimed",
      stale: true,
    });
  });

  it("verified BREZ datuma → claimed (stale: true) — dokaz ni verodostojen", () => {
    expect(verificationState({ verification: "verified", verifiedAt: null }, now)).toEqual({
      effective: "claimed",
      stale: true,
    });
    expect(verificationState({ verification: "verified" }, now)).toEqual({
      effective: "claimed",
      stale: true,
    });
  });

  it("unverified ostane unverified — NIKOLI samodejna napredovanja", () => {
    expect(verificationState({ verification: "unverified", verifiedAt: danes }, now)).toEqual({
      effective: "unverified",
      stale: false,
    });
  });

  it("claimed ostane claimed", () => {
    expect(verificationState({ verification: "claimed", verifiedAt: pred13Mesecev }, now)).toEqual(
      { effective: "claimed", stale: false }
    );
  });
});

// ── Valuta po državi (COUNTRIES meta kot enoten izvor resnice) ─────────────

describe("provider-model: providerCurrency + isCanonCountry", () => {
  it("valute 10 držav kanona so iz COUNTRIES meta (F0)", () => {
    expect(providerCurrency("SI")).toBe("EUR");
    expect(providerCurrency("HR")).toBe("EUR");
    expect(providerCurrency("ME")).toBe("EUR");
    expect(providerCurrency("AL")).toBe("ALL");
    expect(providerCurrency("BA")).toBe("BAM");
    expect(providerCurrency("RS")).toBe("RSD");
    expect(providerCurrency("MK")).toBe("MKD");
    expect(providerCurrency("XK")).toBe("EUR");
    expect(providerCurrency("BG")).toBe("BGN");
    expect(providerCurrency("GR")).toBe("EUR");
  });

  it("neznana koda → null (nikoli ugibati — kanon iskrenosti)", () => {
    expect(providerCurrency("XX")).toBe(null);
    expect(providerCurrency("")).toBe(null);
    expect(providerCurrency("si")).toBe(null); // kanon je zapisan veliko
  });

  it("isCanonCountry sprejme vseh 10 in zavrne ostalo", () => {
    for (const c of ["SI", "HR", "ME", "AL", "BA", "RS", "MK", "XK", "BG", "GR"]) {
      expect(isCanonCountry(c)).toBe(true);
    }
    expect(isCanonCountry("US")).toBe(false);
    expect(isCanonCountry("si")).toBe(false);
  });
});
