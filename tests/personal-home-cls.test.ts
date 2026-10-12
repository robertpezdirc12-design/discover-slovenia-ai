/**
 * PERSONAL-HOME-CLS (POLIR15-c, 2.42.0) — STREŽNIŠKA VRATA OSEBNE DOMOV +
 * STRUKTUORNO IDENTIČEN SKELET (CLS ≈ 0)
 * ============================================================================
 * Prej: PersonalHomeSection je odločal z useSession() na klientu — status
 * je bil ob hidraciji „loading“ (sekca NIČ), nato „authenticated“ (sekca se
 * vstavi: ~200+ px nad vložiščem) in končno „data“ (skelet 3×h-40 zraste v
 * ploščo) — DVA premika vsebine pod sekco (web.dev kanon: „the root cause
 * is the addition of the new element above“).
 *
 * Rešitev (isti kanon kot POLIR13):
 *  1. STREŽNIŠKA vrata — page.tsx prek getSessionGate (React cache dedup
 *     getServerSession; JWT strategija = 0 db klicev; fail-closed = gost)
 *     posreduje `personalGate` prop: sekca je ŽE v SSR HTML (prijavljeni)
 *     oziroma trajno odsotna (gostje).
 *  2. STRUKTUORNO identičen skelet — PersonalBoardSkeleton zrcali ploščo:
 *     isti naslovni blok z REALNIMI statičnimi besedili (t() je
 *     determinističen), ista mreža, 6 kartic z realnimi naslovi, realna
 *     idle stanja za Vreme/V bližini, nalogovna kartica — podatki zamenjajo
 *     samo telesa kartic (dolgi seznami v omejenih max-h vsebnikih ⇒
 *     preostali primanjkljaj omejen).
 *
 * Ta datoteka: SOURCE-CONTRACT (vzorec cls-next-step — readFileSync +
 * statična preverba izvorne kode; 0 omrežja, 0 DOM, 0 AI).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const SEKCIJA = readFileSync(
  join(import.meta.dir, "../src/components/home/personal-home-section.tsx"),
  "utf8"
);

const HOME = readFileSync(
  join(import.meta.dir, "../src/components/home/home-view.tsx"),
  "utf8"
);

const STRAN = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/page.tsx"),
  "utf8"
);

const GATE = readFileSync(
  join(import.meta.dir, "../src/lib/session-gate.ts"),
  "utf8"
);

const TA_TEST = readFileSync(
  join(import.meta.dir, "./personal-home-cls.test.ts"),
  "utf8"
);

// ── ① Strežniška vrata (session-gate) ───────────────────────────────────────

describe("POLIR15-c: strežniška vrata osebne domov (getSessionGate)", () => {
  test("① session-gate: React cache + getServerSession + fail-closed", () => {
    // Dedup znotraj zahteve (več strežniških staršev = 1 dekodiranje JWT).
    expect(GATE).toContain("cache(");
    expect(GATE).toContain("getServerSession(authOptions)");
    // Napaka = gost (nikoli lažna prijava).
    expect(GATE).toContain("fail-closed");
    expect(GATE).toContain("{ authed: false }");
  });

  test("② page.tsx: vrata so ENI strežniški vir (getSessionGate) → prop", () => {
    expect(STRAN).toContain("getSessionGate()");
    expect(STRAN).toContain("personalGate={authed}");
    // Ni več klientnega odločanja o seji za osebno domov.
    expect(STRAN).toContain("POLIR15-c");
  });

  test("③ home-view: prop personalGate teče v PersonalHomeSection gate", () => {
    expect(HOME).toContain("personalGate?: boolean");
    expect(HOME).toContain("<PersonalHomeSection gate={personalGate} />");
  });

  test("④ sekcija: vrata prek propa, useSession IZKLJUČEN iz odločanja", () => {
    expect(SEKCIJA).toContain("gate?: boolean");
    expect(SEKCIJA).toContain("if (!gate) return null;");
    // Klientna seja NI več vir vrata (bila sta 2 premika: null→skelet→plošča).
    expect(SEKCIJA).not.toContain("useSession()");
  });
});

// ── ② Strukturno identičen skelet ───────────────────────────────────────────

describe("POLIR15-c: skelet strukturno identičen plošči (rezervacija prostora)", () => {
  test("⑤ skelet ima ISTI koren kot plošča (sekcija, aria-busy, max-w-7xl, pt-8)", () => {
    // Isti razredni niz v skeletu in končni plošči.
    const razred = "mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8";
    const pojavitve = SEKCIJA.split(razred).length - 1;
    expect(pojavitve).toBeGreaterThanOrEqual(2); // skelet + plošča
    expect(SEKCIJA).toContain('aria-busy="true"');
  });

  test("⑥ skelet nosi REALNA statična besedila (kicker/title/lead — deterministična)", () => {
    // PersonalBoardSkeleton: realni naslovni blok (ni golih h-40 blokov).
    const skelet = SEKCIJA.slice(
      SEKCIJA.indexOf("function PersonalBoardSkeleton"),
      SEKCIJA.indexOf("// ── 1) NADALJUJ POT")
    );
    expect(skelet).toContain('{t("kicker")}');
    expect(skelet).toContain('{t("title")}');
    expect(skelet).toContain('{t("lead")}');
  });

  test("⑦ skelet zrcali VSEH 6 kartic z realnimi naslovi + nalogovno kartico", () => {
    const skelet = SEKCIJA.slice(
      SEKCIJA.indexOf("function PersonalBoardSkeleton"),
      SEKCIJA.indexOf("// ── 1) NADALJUJ POT")
    );
    expect(skelet).toContain('t("continueTitle")');
    expect(skelet).toContain('t("alertsTitle")');
    expect(skelet).toContain('t("watchTitle")');
    expect(skelet).toContain('t("ideasTitle")');
    expect(skelet).toContain('t("tasksTitle")');
    // Ista mreža kot plošča.
    expect(skelet).toContain("grid gap-4 md:grid-cols-2 lg:grid-cols-3");
    // Nalogovna kartica v skeletu (mt-4, kot v plošči).
    expect(skelet).toContain('className="mt-4"');
  });

  test("⑧ Vreme/V bližini so v skeletu REALNI komponenti (idle = 0 premika)", () => {
    const skelet = SEKCIJA.slice(
      SEKCIJA.indexOf("function PersonalBoardSkeleton"),
      SEKCIJA.indexOf("// ── 1) NADALJUJ POT")
    );
    expect(skelet).toContain("<WeatherCard upcoming={null}");
    expect(skelet).toContain("<NearbyCard");
  });

  test("⑨ goli skelet 3×h-40 je ODTSTRANJEN (bil je vzrok 2. premika)", () => {
    expect(SEKCIJA).not.toContain('className="h-40 w-full"');
  });

  test("⑩ sledljivost: test sam omenja POLIR15 (house kanon dokazovanja)", () => {
    expect(TA_TEST).toContain("POLIR15");
  });
});
