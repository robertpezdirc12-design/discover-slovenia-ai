import { describe, expect, test } from "bun:test";

import { searchLokaliFor, LOKALI } from "@/lib/lokali-data";
import { getDestination } from "@/lib/slovenia-data";
import { answerAdvisorScript, type AdvisorScriptContext } from "@/lib/advisor/answer";
import type { SharedPlan } from "@/lib/shared-plan";

/**
 * QA U3 (2026-10-11) — @AI zna odgovoriti na lastni primer UI-ja
 * (»@AI kje lahko večerjamo v Bledu?«) iz ZBIRKE LOKALI:
 *  - deterministično iskanje (destinacija/kraj > regija; kategorije jesti);
 *  - iskrena atribucija vira + meje zbirke (naslovi/kontakti manjkajo);
 *  - BREZ zadetka → iskreni jedrni odgovor (nikoli ne ugibamo).
 *
 * Kanon: 0 omrežja (zbirka je del kode), 0 AI, isti vhod → isti izhod.
 */

const PLAN: SharedPlan = {
  shareId: "test",
  name: "Testna pot",
  createdAt: "2026-10-08T00:00:00.000Z",
  days: [
    { day: 1, title: "Dan 1", locations: [{ name: "Bled", destSlug: "bled" }] },
    { day: 2, title: "Dan 2", locations: [{ name: "Ljubljana", destSlug: "ljubljana" }] },
  ],
  totalBudget: 20,
};

const CTX: AdvisorScriptContext = {
  deps: {
    fetchCurrentWeather: async () => ({ temperatureC: 18.4, weatherCode: 0 }),
    fetchDailyWeather: async () => null,
    loadSto: async () => ({ status: "missing" as const }),
  },
};

// ── searchLokaliFor: deterministično iskanje ─────────────────────────────

describe("QA U3 — searchLokaliFor (deterministično iskanje zbirke)", () => {
  test("Bled: gostinske kategorije, restavracija pred hoteli", () => {
    const bled = getDestination("bled")!;
    const hits = searchLokaliFor({
      destinationSlug: bled.slug,
      town: bled.name,
      region: bled.region,
      categories: ["restaurant", "bar", "hotel"],
      categoryOrder: ["restaurant", "bar", "hotel"],
      limit: 3,
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].category).toBe("restaurant"); // Zima pred hoteli
    expect(hits.every((h) => ["restaurant", "bar", "hotel"].includes(h.category))).toBe(true);
  });

  test("vezava na destinacijo (tier 2) premaga isto regijo (tier 1)", () => {
    const bled = getDestination("bled")!;
    const bohinj = getDestination("bohinj")!;
    const hits = searchLokaliFor({
      destinationSlug: bohinj.slug,
      town: bohinj.name,
      region: bohinj.region,
      categories: ["restaurant", "bar", "hotel"],
      categoryOrder: ["restaurant", "bar", "hotel"],
      limit: 1,
    });
    // Hotel Bohinj je vezan na Bohinj — ne more ga premagati bližnji Bled
    expect(hits[0].destinationSlug).toBe("bohinj");
    void bled;
  });

  test("brez gostinskega zadetka → prazno (iskrena meja, ne ugibamo)", () => {
    const durmitor = getDestination("durmitor")!;
    expect(
      searchLokaliFor({
        destinationSlug: durmitor.slug,
        town: durmitor.name,
        region: durmitor.region,
        categories: ["restaurant", "bar", "hotel"],
        categoryOrder: ["restaurant", "bar", "hotel"],
        limit: 3,
      })
    ).toEqual([]);
  });

  test("determinizem: isti vhod → isti seznam (5×)", () => {
    const q = {
      destinationSlug: "ljubljana",
      region: "osrednja",
      categories: ["restaurant", "bar", "hotel"] as const,
      categoryOrder: ["restaurant", "bar", "hotel"] as const,
      limit: 3,
    };
    const first = searchLokaliFor(q);
    for (let i = 0; i < 5; i++) {
      expect(searchLokaliFor(q)).toEqual(first);
    }
    expect(first.length).toBe(3);
  });

  test("ne spreminja zbirke (samo-bralno iskanje)", () => {
    const before = JSON.stringify(LOKALI);
    searchLokaliFor({ destinationSlug: "bled", limit: 10 });
    expect(JSON.stringify(LOKALI)).toBe(before);
  });
});

// ── answerAdvisorScript: namen „hrana“ iz zbirke ────────────────────────

describe("QA U3 — @AI hrana iz zbirke Lokali", () => {
  test("PRIMER UI-JA: »@AI kje lahko večerjamo v Bledu?« dobi odgovor", async () => {
    const a = await answerAdvisorScript("@AI kje lahko večerjamo v Bledu?", PLAN, CTX);
    expect(a).toContain("zbirki Lokali");
    expect(a).toContain("Slaščičarna Zima"); // restavracija v Bledu (kuracija)
    expect(a).toContain("vir:");
    expect(a).not.toContain("Restavracij in jedilnikov v klepetu nimam");
  });

  test("iskrena atribucija: kuracija + manjkajoči naslovi/kontakti + /lokali", async () => {
    const a = await answerAdvisorScript("@AI kje lahko večerjamo v Bledu?", PLAN, CTX);
    expect(a).toContain("uredniška kuracija");
    expect(a).toContain("ne izmišljujemo");
    expect(a).toContain("/lokali");
  });

  test("brez omembe kraja → prvi postanek poti (Bled)", async () => {
    const a = await answerAdvisorScript("@AI kje lahko večerjamo?", PLAN, CTX);
    expect(a).toContain("Bled");
    expect(a).toContain("zbirki Lokali");
  });

  test("kraj brez lokalov v zbirki → ISKRENI jedrni odgovor (meja)", async () => {
    const a = await answerAdvisorScript("@AI kje lahko večerjamo na Durmitorju?", PLAN, CTX);
    expect(a).toContain("Restavracij in jedilnikov v klepetu nimam"); // jedro iskreno
  });

  test("determinizem: isti vhod → isti izhod", async () => {
    const q = "@AI kje lahko večerjamo v Bledu?";
    const a1 = await answerAdvisorScript(q, PLAN, CTX);
    const a2 = await answerAdvisorScript(q, PLAN, CTX);
    expect(a1).toBe(a2);
  });
});
