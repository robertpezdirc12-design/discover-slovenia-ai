/**
 * P2 DOSTOPNOST IN BESEDILA (issue #38, 2.44.0)
 * ============================================================================
 * P2 vsebina iz QA pregleda (#38): lektorirana vidna besedila + umik
 * razvojne oznake iz javnega prikaza.
 *
 * Popravki, ki jih ta datoteka zaklene:
 * ① „premočna ×1,3“ → „premočrtna razdalja ×1,3“ — „premočna“ je bila
 *    pomensko napačna („too powerful“); pravi termin za straight-line
 *    razdaljo je „premočrtna“ (vsi drugi jeziki so imeli pravilno:
 *    straight-line/Luftlinie/linea d'aria/à vol d'oiseau/línea recta).
 * ② SLOVENSKA SLOVNICA — PAUCAL: 1 postanek, 2 postanka, 3/4 postanki,
 *    5+ postankov (prej je bil 3/4 vsiljen roditelj množine „postankov“).
 * ③ MESTNIK po „v“: „v 2 regijAH“ (ne imenovalni „v 2 regiji“) —
 *    novi generator regionsWordIn (mestnik), call site uporablja le-tega.
 * ④ Noga: razvojna oznaka „Rekonstrukcija 2026-10-12“ umaknjena iz
 *    javnega prikaza (podatkovno poreklo ostaja v repozitoriju/worklogu).
 * ⑤ GLOBALNI SWEEP: „premočna“ se ne sme vrniti v noben src/** vir.
 *
 * Vse spremembe so BESEDILNE — številke, faktorji (×1,3, ~60 km/h) in
 * deterministična logika ostajajo nespremenjeni (⑤ test v
 * shared-measured.test.ts še vedno velja).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { PLANNER_MSG } from "../src/lib/itinerary-engine";

// ---------------------------------------------------------------------------
// ① + ② + ③ — generatorji besedila (izvoženi prav za ta zaklep)
// ---------------------------------------------------------------------------

describe("p2 besedila (#38): paucal in mestnik (slovenščina)", () => {
  test("① stopsWord sl: 1 postanek · 2 postanka · 3/4 postanki · 5+ postankov", () => {
    const f = PLANNER_MSG.stopsWord.sl;
    expect(f(1)).toBe("1 postanek");
    expect(f(2)).toBe("2 postanka");
    expect(f(3)).toBe("3 postanki");
    expect(f(4)).toBe("4 postanki");
    expect(f(5)).toBe("5 postankov");
    expect(f(12)).toBe("12 postankov");
  });

  test("① draftSummary sl: isti paucal (2 postanka, 4 postanki)", () => {
    const s2 = PLANNER_MSG.draftSummary.sl(2, 100, 60);
    const s4 = PLANNER_MSG.draftSummary.sl(4, 100, 60);
    expect(s2).toContain("2 postanka");
    expect(s4).toContain("4 postanki");
    expect(s2).not.toContain("2 postankov");
  });

  test("② regionsWord sl (imenovalnik) ostane: 1 regija · 2 regiji · 3/4 regije · 5+ regij", () => {
    const f = PLANNER_MSG.regionsWord.sl;
    expect(f(1)).toBe("1 regija");
    expect(f(2)).toBe("2 regiji");
    expect(f(3)).toBe("3 regije");
    expect(f(4)).toBe("4 regije");
    expect(f(5)).toBe("5 regij");
  });

  test("③ regionsWordIn sl (mestnik po „v“): 1 regiji · 2/3/4/5 regijah", () => {
    const f = PLANNER_MSG.regionsWordIn.sl;
    expect(f(1)).toBe("1 regiji");
    expect(f(2)).toBe("2 regijah");
    expect(f(3)).toBe("3 regijah");
    expect(f(4)).toBe("4 regijah");
    expect(f(5)).toBe("5 regijah");
  });

  test("③ regionsWordIn za druge jezike = regionsWord (predlogi delujejo z isto obliko)", () => {
    for (const l of ["en", "it", "de", "fr", "es"] as const) {
      expect(PLANNER_MSG.regionsWordIn[l](2)).toBe(PLANNER_MSG.regionsWord[l](2));
    }
  });

  test("① summary sl: vsebuje „premočrtna razdalja ×1,3“, NIKOLI „premočna“", () => {
    const out = PLANNER_MSG.summary.sl("3 dni", "4 postanki", "2 regijah", 120, 60);
    expect(out).toContain("4 postanki v 2 regijah");
    expect(out).toContain("premočrtna razdalja ×1,3 pri ~60 km/h");
    expect(out).not.toContain("premočna");
  });
});

// ---------------------------------------------------------------------------
// ⑤ GLOBALNI SWEEP — „premočna“ ne sme obstati v nobenem src viru
// ---------------------------------------------------------------------------

/** Zberi vse .ts/.tsx datoteke pod src/ (rekurzivno). */
function collectSrcFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) collectSrcFiles(p, acc);
    else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

describe("p2 besedila (#38): globalni sweep", () => {
  test("⑤ „premočna“ (napačni termin) ne obstaja več v src/**", () => {
    const files = collectSrcFiles(join(process.cwd(), "src"));
    expect(files.length).toBeGreaterThan(50); // sanity: sweep res teče po korpusu
    const offenders: string[] = [];
    for (const f of files) {
      if (readFileSync(f, "utf8").includes("premočna")) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ④ NOGA — razvojna oznaka izven javnega prikaza (source-contract)
// ---------------------------------------------------------------------------

describe("p2 dostopnost (#38): noga brez razvojne oznake", () => {
  test("④ footer.tsx: brez oznake „Rekonstrukcija“/reconstruction, verzija ostane", () => {
    const src = readFileSync(
      join(process.cwd(), "src", "components", "layout", "footer.tsx"),
      "utf8"
    );
    // razvojna oznaka ne sme biti več del javnega prikaza
    expect(src.includes("reconstruction")).toBe(false);
    expect(src.includes("Rekonstrukcija")).toBe(false);
    expect(src.includes("Reconstruction")).toBe(false);
    // verzija (hišni kanon: bump na 7 mestih vključno s footer) ostaja
    expect(src).toMatch(/v2\.\d+\.\d+/);
  });
});
