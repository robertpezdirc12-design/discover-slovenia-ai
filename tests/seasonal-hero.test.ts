/**
 * SEASONAL-HERO (POLIR15-b, 2.42.0) — SEZONSKA AFINITETA HEROJA
 * ============================================================================
 * Vrzel #3 iz raziskave POLIR15: hero je bil STATIČEN skozi vse leto
 * (zgled najboljših: Švica — sezonski koledar kampanj zima/pomlad/
 * poletje/jesen; Irska — »Home of Halloween«, dogodek kot sezonski
 * pripovedovalec). Rešitev: ČIST modul src/lib/seasonal-hero.ts —
 * determinističen MMDD resolver z ovitkom čez leto + izvorni SI
 * mikro-dogodki (martinovanje 8.–14.11., kurentovanje 2.–5.2., december
 * 1.–26.12.), razrešeno na STREŽNIKU (page.tsx) in posredovano kot prop
 * (0 hidracijske razlike, 0 CLS — statičen SSR čip).
 *
 * Ta datoteka: ENOTSKE preverbe čistega modula (0 omrežja, 0 DOM, 0 AI).
 */

import { describe, expect, test } from "bun:test";

import {
  getHeroSeasonal,
  HERO_MICRO_WINDOWS,
  resolveHeroMicroEvent,
  resolveHeroSeason,
  type HeroL6,
} from "../src/lib/seasonal-hero";

/** Datum iz MMDD (opoldne — izogibaj se robom časovnih pasov). */
const d = (mmdd: string) => {
  const [m, day] = mmdd.split("-").map(Number);
  return new Date(2026, m - 1, day, 12, 0, 0);
};

const LOCALE_KEYS: (keyof HeroL6)[] = ["sl", "en", "it", "de", "fr", "es"];

// ── ① MMDD okna sezon (zima se ovije čez leto) ──────────────────────────────

describe("POLIR15-b: resolveHeroSeason (MMDD okna)", () => {
  test("① zima: 1.12.–15.3. VKLJUČNO (ovitek čez novo leto)", () => {
    expect(resolveHeroSeason(d("12-01"))).toBe("winter");
    expect(resolveHeroSeason(d("12-31"))).toBe("winter");
    expect(resolveHeroSeason(d("01-01"))).toBe("winter");
    expect(resolveHeroSeason(d("03-15"))).toBe("winter");
  });

  test("② pomlad: 16.3.–31.5. (prvi dan po zimi / zadnji dan vključen)", () => {
    expect(resolveHeroSeason(d("03-16"))).toBe("spring");
    expect(resolveHeroSeason(d("05-31"))).toBe("spring");
  });

  test("③ poletje: 1.6.–14.9.", () => {
    expect(resolveHeroSeason(d("06-01"))).toBe("summer");
    expect(resolveHeroSeason(d("09-14"))).toBe("summer");
  });

  test("④ jesen: 15.9.–30.11. (do zime)", () => {
    expect(resolveHeroSeason(d("09-15"))).toBe("autumn");
    expect(resolveHeroSeason(d("11-30"))).toBe("autumn");
  });

  test("⑤ ni vrzeli: zaporedni dnevi 14.9.–16.9. in 30.11.–2.12. pokriti", () => {
    expect(resolveHeroSeason(d("09-14"))).not.toBe(resolveHeroSeason(d("09-15")));
    expect(resolveHeroSeason(d("11-30"))).not.toBe(resolveHeroSeason(d("12-01")));
    expect(resolveHeroSeason(d("03-15"))).not.toBe(resolveHeroSeason(d("03-16")));
  });
});

// ── ② Mikro-dogodki (izvorni SI koledar) ────────────────────────────────────

describe("POLIR15-b: resolveHeroMicroEvent (izvorni SI mikro-dogodki)", () => {
  test("⑥ martinovanje: 8.–14.11. vključno, zunaj okna null", () => {
    expect(HERO_MICRO_WINDOWS.martinovanje.from).toBe(1108);
    expect(HERO_MICRO_WINDOWS.martinovanje.to).toBe(1114);
    expect(resolveHeroMicroEvent(d("11-07"))).toBeNull();
    expect(resolveHeroMicroEvent(d("11-08"))).toBe("martinovanje");
    expect(resolveHeroMicroEvent(d("11-14"))).toBe("martinovanje");
    expect(resolveHeroMicroEvent(d("11-15"))).toBeNull();
  });

  test("⑦ kurentovanje: 2.–5.2. vključno, zunaj okna null", () => {
    expect(HERO_MICRO_WINDOWS.kurentovanje.from).toBe(202);
    expect(HERO_MICRO_WINDOWS.kurentovanje.to).toBe(205);
    expect(resolveHeroMicroEvent(d("02-01"))).toBeNull();
    expect(resolveHeroMicroEvent(d("02-02"))).toBe("kurentovanje");
    expect(resolveHeroMicroEvent(d("02-05"))).toBe("kurentovanje");
    expect(resolveHeroMicroEvent(d("02-06"))).toBeNull();
  });

  test("⑧ december (božični sejmi): 1.–26.12. vključno, zunaj okna null", () => {
    expect(HERO_MICRO_WINDOWS.december.from).toBe(1201);
    expect(HERO_MICRO_WINDOWS.december.to).toBe(1226);
    expect(resolveHeroMicroEvent(d("12-01"))).toBe("december");
    expect(resolveHeroMicroEvent(d("12-26"))).toBe("december");
    expect(resolveHeroMicroEvent(d("12-27"))).toBeNull();
  });
});

// ── ③ Razrešena varianta (badge) ────────────────────────────────────────────

describe("POLIR15-b: getHeroSeasonal (razrešena varianta heroja)", () => {
  test("⑨ mikro-dogodek NADOMESTI sezonski čip v svojem oknu (Irska kanon)", () => {
    const v = getHeroSeasonal({ now: d("11-10") });
    expect(v.season).toBe("autumn");
    expect(v.microEvent).toBe("martinovanje");
    expect(v.badge.sl).toContain("Martinovanje");
    // Datum je VIDEN v nizu (iskreno koledarsko okno).
    expect(v.badge.sl).toContain("8.–14. november");
  });

  test("⑩ izven mikro-okna = čist sezonski čip", () => {
    const v = getHeroSeasonal({ now: d("06-15") });
    expect(v.season).toBe("summer");
    expect(v.microEvent).toBeNull();
    expect(v.badge.sl).toBe("Poletje v Sloveniji");
  });

  test("⑪ QA override `?sezona=` prisili sezono in UTIŠA mikro-dogodek", () => {
    // 10.11. je sicer martinovanje — override mora dati čist jesenski pogled.
    const v = getHeroSeasonal({ now: d("11-10"), override: "autumn" });
    expect(v.season).toBe("autumn");
    expect(v.microEvent).toBeNull();
    expect(v.badge.sl).toBe("Jeseni v Sloveniji");
    for (const s of ["winter", "spring", "summer", "autumn"] as const) {
      expect(getHeroSeasonal({ override: s }).season).toBe(s);
    }
    // Neveljaven override → ignoriran (vrne se dejansko stanje 10.11.).
    const bad = getHeroSeasonal({ now: d("11-10"), override: "karamela" });
    expect(bad.microEvent).toBe("martinovanje");
  });

  test("⑫ vsi čipi so popolnoma lokalizirani (6 jezikov, neprazna besedila)", () => {
    // Prečesi vsa 4 sezona + 3 mikro-dogodke — vsak badge v vseh jezikih.
    const samples = [
      "01-10", "04-10", "07-10", "10-10",
      "11-10", "02-03", "12-10",
    ];
    for (const md of samples) {
      const v = getHeroSeasonal({ now: d(md) });
      for (const key of LOCALE_KEYS) {
        expect(typeof v.badge[key]).toBe("string");
        expect(v.badge[key].length).toBeGreaterThan(0);
      }
    }
  });

  test("⑬ determinizem: isti datum → identična varianta (0 naključja)", () => {
    const a = getHeroSeasonal({ now: d("02-03") });
    const b = getHeroSeasonal({ now: d("02-03") });
    expect(a).toEqual(b);
  });
});
