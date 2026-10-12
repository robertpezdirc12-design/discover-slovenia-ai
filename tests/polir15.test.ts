/**
 * POLIR15 (2.42.0) — STICKY PREKLOP NAD LEAFLETOM + SEZONSKA AFINITETA
 * HEROJA + 2× CLS → 0
 * ============================================================================
 * Deseti krog poliranja (issue #34): štiri točke
 *  (a) sticky preklop „Zemljevid ⇄ Seznam“ nad Leafletom (z-index izolacija),
 *  (b) sezonska afiniteta heroja (vrzel #3: Švica „Winter“, Irska
 *      „Home of Halloween“) — determinističen SSR resolver,
 *  (c) osebna plošča brez premika za prijavljene (SSR seja + skelet pariteta),
 *  (d) skelet zemljevida s polno strukturno pariteto (7 nadzornih vrstic).
 *
 * Ta datoteka: SOURCE-CONTRACT (vzorec map-mobile-first / reflow-320 —
 * readFileSync + statična preverba izvorne kode) + ČISTE ENOTE resolverja
 * (resolveSeason/getHeroVariant sta deterministični, brez DOM/omrežja;
 * datum se poda kot argument — 0 AI, 0 ura-sod).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import { getHeroVariant, resolveSeason, SEASONAL_HERO } from "../src/lib/seasonal-hero";

const MAPA = readFileSync(
  join(import.meta.dir, "../src/components/map/travel-map.tsx"),
  "utf8"
);

const STRAN = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/zemljevid/view.tsx"),
  "utf8"
);

const DOMOV = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/page.tsx"),
  "utf8"
);

const HERO = readFileSync(
  join(import.meta.dir, "../src/components/home/home-view.tsx"),
  "utf8"
);

const OSEBNO = readFileSync(
  join(import.meta.dir, "../src/components/home/personal-home-section.tsx"),
  "utf8"
);

// ── ENOTE: resolveSeason (MMDD okna) ────────────────────────────────────────

describe("POLIR15-b: resolveSeason (deterministične MMDD meje)", () => {
  test("① zima 1.12.–15.3. (prelom leta vključen)", () => {
    expect(resolveSeason(new Date(2026, 11, 1))).toBe("winter"); // 1. 12.
    expect(resolveSeason(new Date(2027, 0, 6))).toBe("winter"); // 6. 1.
    expect(resolveSeason(new Date(2026, 2, 15))).toBe("winter"); // 15. 3.
  });
  test("② pomlad 16.3.–31.5.", () => {
    expect(resolveSeason(new Date(2026, 2, 16))).toBe("spring");
    expect(resolveSeason(new Date(2026, 4, 31))).toBe("spring");
  });
  test("③ poletje 1.6.–14.9.", () => {
    expect(resolveSeason(new Date(2026, 5, 1))).toBe("summer");
    expect(resolveSeason(new Date(2026, 8, 14))).toBe("summer");
  });
  test("④ jesen 15.9.–30.11.", () => {
    expect(resolveSeason(new Date(2026, 8, 15))).toBe("autumn");
    expect(resolveSeason(new Date(2026, 10, 30))).toBe("autumn");
  });
});

// ── ENOTE: getHeroVariant (mikro-dogodki + QA override) ─────────────────────

describe("POLIR15-b: getHeroVariant (mikro-dogodki premagajo sezono)", () => {
  test("⑤ december 1.–26.12. → varianta december, sezona zima", () => {
    const v = getHeroVariant({ now: new Date(2026, 11, 5) });
    expect(v.variant).toBe("december");
    expect(v.season).toBe("winter");
    expect(v.href).toBe("/dogodki");
  });
  test("⑥ kurentovanje 2.–5.2. → varianta kurentovanje", () => {
    expect(getHeroVariant({ now: new Date(2026, 1, 3) }).variant).toBe("kurentovanje");
    expect(getHeroVariant({ now: new Date(2026, 1, 6) }).variant).toBe("winter");
  });
  test("⑦ martinovanje 8.–14.11. → varianta martinovanje", () => {
    expect(getHeroVariant({ now: new Date(2026, 10, 11) }).variant).toBe("martinovanje");
    expect(getHeroVariant({ now: new Date(2026, 10, 15) }).variant).toBe("autumn");
  });
  test("⑧ brez mikro-dogodka → varianta = sezona; override premaguje vse", () => {
    expect(getHeroVariant({ now: new Date(2026, 6, 10) }).variant).toBe("summer");
    const o = getHeroVariant({ seasonOverride: "spring", now: new Date(2026, 6, 10) });
    expect(o.season).toBe("spring");
    expect(o.variant).toBe("spring");
    // neveljaven override se ignorira (fail-open na resnični koledar)
    expect(getHeroVariant({ seasonOverride: "kura", now: new Date(2026, 6, 10) }).variant).toBe("summer");
  });
  test("⑨ vsi namigi imajo vseh 6 jezikov, nepraznih", () => {
    for (const hint of Object.values(SEASONAL_HERO)) {
      for (const jezik of ["sl", "en", "it", "de", "fr", "es"] as const) {
        expect(hint[jezik].length, `hint.${jezik}`).toBeGreaterThan(4);
      }
    }
  });
});

// ── ⑩–⑪ SOURCE-CONTRACT: sticky preklop + izolacija Leafleta (POLIR15-a) ────

describe("POLIR15-a: sticky preklop nad Leafletom (travel-map.tsx)", () => {
  test("⑩ preklopna vrstica: sticky top-16 z-30 + bg-background (samo <lg)", () => {
    const idx = MAPA.indexOf('aria-label={t("viewToggleLabel")}');
    expect(idx).toBeGreaterThan(-1);
    const zacetek = MAPA.lastIndexOf("<div", idx);
    const konec = MAPA.indexOf('">', idx);
    const vrstica = MAPA.slice(zacetek, konec);
    expect(vrstica).toContain("sticky top-16 z-30");
    expect(vrstica).toContain("bg-background");
    expect(vrstica).toContain("lg:hidden");
  });
  test("⑪ ovoj zemljevida: relative z-0 isolate (stacking kontekst zapre Leaflet pane/kontrole)", () => {
    const idx = MAPA.indexOf('aria-label={t("mapLabel")}');
    expect(idx).toBeGreaterThan(-1);
    const ovoj = MAPA.slice(MAPA.lastIndexOf("<div", idx), idx);
    expect(ovoj).toContain("relative z-0 isolate");
  });
});

// ── ⑫ SOURCE-CONTRACT: skelet zemljevida s polno pariteto (POLIR15-d) ───────

describe("POLIR15-d: skelet zemljevida (zemljevid/view.tsx)", () => {
  test("⑫ skelet zrcali vseh 7 vrstic v istem vrstnem redu in višinah", () => {
    const loading = STRAN.slice(STRAN.indexOf("loading: () =>"), STRAN.indexOf("}),") );
    // 1) iskanje+regija: h-11, grid-cols-[1fr_auto], lg:mt-8
    expect(loading).toContain('mt-4 grid grid-cols-[1fr_auto] gap-3 lg:mt-8');
    expect(loading).toContain('h-11 w-36 rounded-md md:w-56');
    // 2) čipi: h-9, mt-3
    expect(loading).toContain('mt-3 flex gap-2 overflow-hidden pb-1');
    // 3) preklop: STICKY zrcali POLIR15-a (max-lg:sticky max-lg:top-16)
    expect(loading).toContain("max-lg:sticky max-lg:top-16 max-lg:z-30 lg:hidden");
    // 4) plasti nad zemljevidom (namizje)
    expect(loading).toContain('mt-3 hidden gap-2 lg:flex');
    // 5) mreža: svh pariteta z MapContainer (POLIR12, nespremenjeno)
    expect(loading).toContain(
      "h-[62svh] min-h-80 rounded-xl sm:h-[70svh] lg:h-[calc(100svh-15rem)] lg:min-h-[540px]"
    );
    // 6) plasti pod zemljevidom (mobilni)
    expect(loading).toContain('mt-3 flex gap-2 lg:hidden');
    // 7) legenda
    expect(loading).toContain('mt-4 h-28 rounded-xl');
  });
});

// ── ⑬–⑭ SOURCE-CONTRACT: SSR seja + skelet plošče (POLIR15-c) ───────────────

describe("POLIR15-c: osebna plošča brez premika (SSR seja)", () => {
  test("⑬ page.tsx: cache(() => getServerSession(authOptions)) + sezonski override", () => {
    expect(DOMOV).toContain("const getSession = cache(() => getServerSession(authOptions));");
    expect(DOMOV).toContain('SEASON_WHITELIST = new Set(["winter", "spring", "summer", "autumn"])');
    expect(DOMOV).toContain("seasonHero={seasonHero}");
    expect(DOMOV).toContain("sessionName={sessionName}");
  });
  test("⑭ osebna sekcija: brez useSession, strežniška vrata, skelet s pariteto 6+1 kartic", () => {
    expect(OSEBNO).not.toContain('from "next-auth/react"');
    expect(OSEBNO).toContain('export function PersonalHomeSection({ name }: { name: string })');
    expect(OSEBNO).toContain("function PersonalHomeSkeleton({ t }");
    expect(OSEBNO).toContain('Array.from({ length: 6 })');
    expect(OSEBNO).toContain('Skeleton className="mt-4 h-44 w-full"');
    // osebni pozdrav z imenom (ena vrstica — 0 višinske razlike)
    expect(OSEBNO).toContain('text-primary">, {name}</span>');
    // heroj: vrata po imenu (sessionName && …)
    expect(HERO).toContain("{sessionName && <PersonalHomeSection name={sessionName} />}");
  });
});

// ── ⑮ SOURCE-CONTRACT: sezonski namig v heroju (POLIR15-b) ──────────────────

describe("POLIR15-b: sezonski namig v heroju (home-view.tsx)", () => {
  test("⑮ chip je pogojen z seasonHero, vodi na /dogodki, ikona po varianti", () => {
    expect(HERO).toContain("const SEASON_ICONS: Record<SeasonVariant, LucideIcon>");
    expect(HERO).toContain("{seasonHero && (");
    expect(HERO).toContain('href={seasonHero.href}');
    expect(HERO).toContain("pick(l, seasonHero.hint)");
    // vse 7 variant ima ikono
    for (const v of ["winter", "december", "kurentovanje", "spring", "summer", "martinovanje", "autumn"]) {
      expect(HERO.indexOf(`${v}:`), `ikona za ${v}`).toBeGreaterThan(-1);
    }
  });
});

// ── ⑯ verzija 2.42.0 (bump na vseh mestih — vzorec p2-data-plane) ───────────

describe("POLIR15: verzija 2.42.0", () => {
  test("⑯ package.json nosi 2.42.0", () => {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dir, "../package.json"), "utf8")
    );
    expect(pkg.version).toBe("2.42.0");
  });
});
