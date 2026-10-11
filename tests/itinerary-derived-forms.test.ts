import { describe, expect, test } from "bun:test";

import {
  buildItinerary,
  interestMatches,
  normText,
  typeAffinityMatches,
} from "@/lib/itinerary-engine";
import { DESTINATIONS, type Destination } from "@/lib/slovenia-data";

/**
 * QA U13 (2026-10-11) — NLU morfologija: pridevniške/izpeljane oblike
 * („kolesarski izlet“, „pohodniški vikend“ …) so padle v „Brez neposrednega
 * zadetka“, čeprav je bil pomen znan. Zdaj:
 *  · izpeljanke (kolesarski → kolo, pohodniški → pohod, smučarski →
 *    smučanje, vinarski → vino, kulturni → kultura, družinski → družina …)
 *    ujemajo DIREKTNO (predpone pokrijejo vse sklone pridevnika);
 *  · večbesedni lastni interesi („kolesarski izlet“) poskusijo po besedah;
 *  · NEZNANE besede še vedno padajo v iskreno „Brez neposrednega zadetka“.
 *
 * Zaklenjeno tudi: U1 geo-koherenca + U8 čipi se NE smejo spremeniti
 * (enobesedna pot ujemanja je bitno identična — vrstni red preverjanj).
 */

function destinationBlob(d: Destination): string {
  return normText(
    [
      d.name,
      d.slug,
      d.tagline,
      d.type,
      d.region,
      ...d.highlights,
      ...d.activities,
      ...d.bestFor,
      ...d.bestSeason,
    ].join(" | ")
  );
}

const BLOBS = DESTINATIONS.map((d) => {
  const blob = destinationBlob(d);
  return { d, blob, tokens: blob.split(" ").filter(Boolean) };
});

/** Ali oblika ujame ≥ 1 destinacijo (isti klic kot načrtovalnik)? */
function matchesAtLeast(interest: string): number {
  return BLOBS.filter((b) => interestMatches(b.tokens, b.blob, interest)).length;
}

// ── direktne ujembe izpeljank ────────────────────────────────────────────

describe("QA U13 — pridevniške/izpeljane oblike ujemajo DIREKTNO", () => {
  test("QA primer: „kolesarski“ in „z kolesarjenjem“ ujameta ENAKO (11 destinacij)", () => {
    expect(matchesAtLeast("kolesarski")).toBe(matchesAtLeast("z kolesarjenjem"));
    expect(matchesAtLeast("kolesarski")).toBeGreaterThan(0);
  });

  test("večbesedna oblika „kolesarski izlet“ ujame vsaj toliko kot enobesedna", () => {
    expect(matchesAtLeast("kolesarski izlet")).toBeGreaterThanOrEqual(
      matchesAtLeast("kolesarski")
    );
  });

  test("imenovane izpeljanke: kolesarski/pohodniški/smučarski/vinarski/kulturni/družinski", () => {
    for (const form of [
      "kolesarski",
      "pohodniški",
      "smučarski",
      "vinarski",
      "kulturni",
      "družinski",
    ]) {
      expect(matchesAtLeast(form)).toBeGreaterThan(0);
    }
  });

  test("zemljepisni pridevniki: gorski/morski/jezerski/rečni", () => {
    for (const form of ["gorski", "morski", "jezerski", "rečni"]) {
      expect(matchesAtLeast(form)).toBeGreaterThan(0);
    }
  });

  test("skloni pridevnika pokriti (kolesarskega/kolesarskih/kolesarjenje)", () => {
    expect(matchesAtLeast("kolesarskega")).toBe(matchesAtLeast("kolesarski"));
    expect(matchesAtLeast("kolesarskih")).toBe(matchesAtLeast("kolesarski"));
    expect(matchesAtLeast("kolesarjenje")).toBeGreaterThan(0);
  });

  test("večbesedni lastni interes: „družinski vikend ob jezeru“", () => {
    expect(matchesAtLeast("družinski vikend ob jezeru")).toBeGreaterThan(0);
  });

  test("NEZNANE besede ostanejo brez zadetka (iskrenost — nikoli ugibamo)", () => {
    expect(matchesAtLeast("nesmiselni")).toBe(0);
    expect(matchesAtLeast("cvetkarski")).toBe(0); // pridevnik brez korena v podatkih
    expect(matchesAtLeast("xyzqwerski")).toBe(0);
  });
});

// ── tipska afiniteta tudi za izpeljanke (U1 kanon razširjen) ─────────────

describe("QA U13 — tipska afiniteta (U1) prepozna izpeljanke", () => {
  test("„jezerski“ dobi dvojno utež na jezerskih destinacijah (ne na mestih)", () => {
    const lake = DESTINATIONS.find((d) => d.type === "lake")!;
    const city = DESTINATIONS.find((d) => d.type === "city")!;
    expect(typeAffinityMatches(lake, "jezerski")).toBe(true);
    expect(typeAffinityMatches(city, "jezerski")).toBe(false);
  });

  test("„gorski“ do afinitete na gorah (gora/gorovje koreni)", () => {
    const mountain = DESTINATIONS.find((d) => d.type === "mountain")!;
    expect(typeAffinityMatches(mountain, "gorski")).toBe(true);
  });
});

// ── end-to-end: načrt brez „Brez neposrednega zadetka“ ───────────────────

describe("QA U13 — načrtovalnik: izpeljanke ne sprožijo iskrene opombe več", () => {
  test("interesi [kolesarski izlet] → „Želje z zadetkom“, NE „Brez neposrednega“", () => {
    const plan = buildItinerary({ interests: ["kolesarski izlet"], days: 2 });
    expect(plan.coverageNote).toContain("Želje z zadetkom");
    expect(plan.coverageNote).not.toContain("Brez neposrednega zadetka");
  });

  test("NLU → motor: „kolesarski“ ≙ „kolo“ data ENAK načrt (isti postanki)", () => {
    // parsePlannerIntent preslika obe obliki na bazni žeton „kolo“ (NLU je
    // že znal); motor pa sedaj razume tudi SUROVO pridevniško obliko —
    // enak vnos pomeni enak potek poti (razlikuje se le zapis želje).
    const slugs = (p: ReturnType<typeof buildItinerary>) =>
      p.days.flat().map((s) => s.slug).join(",");
    const a = buildItinerary({ interests: ["kolesarski"], days: 3 });
    const b = buildItinerary({ interests: ["kolo"], days: 3 });
    expect(slugs(a)).toBe(slugs(b));
  });

  test("neznan interes še vedno sproži iskreno opombo (regresija kanona)", () => {
    const plan = buildItinerary({ interests: ["nesmiselni"], days: 1 });
    expect(plan.coverageNote).toContain("Brez neposrednega zadetka");
  });

  test("determinizem: isti vhod → isti načrt (5×)", () => {
    const first = JSON.stringify(buildItinerary({ interests: ["pohodniški izlet", "družinski"], days: 3 }));
    for (let i = 0; i < 5; i++) {
      expect(
        JSON.stringify(buildItinerary({ interests: ["pohodniški izlet", "družinski"], days: 3 }))
      ).toBe(first);
    }
  });
});
