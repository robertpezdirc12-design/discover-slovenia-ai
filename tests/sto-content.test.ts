/**
 * STO VSEBINA — testi P0-C plasti (issue §4/§7).
 *
 * Pokriva:
 *  · parser llms.txt formata (H1/blockquote/##/vnosi; BOM; CRLF;
 *    vgnezđeni zamaknjeni vnosi; vnos brez opisa; fail-closed števec),
 *  · varnostni filter URL (samo https + slovenia.info — zastrupitev ne),
 *  · deterministično iskanje (ocena, AND semantika, jezikovni filter,
 *    diakritike, stabilna ureditev),
 *  · ingest runner z lažnim fetchem (uspeh/partial/error brez prepisa),
 *  · DEJANSKO ingescirano množico (data/sto-content.json — strukturne
 *    invariantne, ne krhka števca).
 *
 * Kanon: 0 omrežja (lažni fetch), 0 db; isti vhod → isti izhod.
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  STO_ATTRIBUTION,
  STO_LLMS_LANGUAGE_SOURCES,
  flattenEntries,
  isAllowedStoUrl,
  parseLlmsTxt,
} from "../src/lib/supply/providers/sto/llms-source";
import {
  loadStoContent,
  normalizeSearchText,
  searchStoContent,
  type StoContentEntry,
} from "../src/lib/supply/providers/sto/content";
import { runStoIngest } from "../src/lib/supply/providers/sto/ingest";

// ── Fiksna priloga (oblika REALNE datoteke slovenia.info) ──────────────────

const FIXTURE = [
  "# I feel Slovenia - Uradni turistični vodnik (SL)",
  "> Raziskujte zeleno, aktivno in zdravo Slovenijo.",
  "",
  "## Aktivne počitnice",
  "- [Pohodništvo](https://www.slovenia.info/sl/dozivetja/pohodnistvo): Informacije o pohodniških poteh.",
  "    - [Alpske poti](https://www.slovenia.info/sl/dozivetja/alpske-poti): Vrzeli med dvema vrhovoma.",
  "- [Kolesarjenje](https://www.slovenia.info/sl/dozivetja/kolesarjenje)",
  "",
  "## Gastronomija",
  "- [Kraška pršut](https://www.slovenia.info/sl/kulinarika/prsut): Tradicija sušenja.",
].join("\n");

// ── Parser ──────────────────────────────────────────────────────────────────

describe("parseLlmsTxt — llms.txt standard", () => {
  test("razreže H1, blockquote, odseke in vnose (z BOM)", () => {
    const raw = "\uFEFF" + FIXTURE;
    const p = parseLlmsTxt(raw);
    expect(p.title).toBe("I feel Slovenia - Uradni turistični vodnik (SL)");
    expect(p.intro).toContain("zeleno, aktivno");
    expect(p.sections.length).toBe(2);
    expect(p.sections[0].name).toBe("Aktivne počitnice");
    expect(p.sections[0].entries.length).toBe(3); // vgnezđeni vnos je veljaven
    expect(p.sections[1].entries.length).toBe(1);
    expect(p.entryCount).toBe(4);
    expect(p.skippedLines).toBe(0);
  });

  test("vnos BREZ opisa je veljaven (llms.txt dovoljuje) — prazen opis", () => {
    const p = parseLlmsTxt(FIXTURE);
    const brez = p.sections[0].entries.find((e) => e.title === "Kolesarjenje");
    expect(brez).toBeDefined();
    expect(brez!.description).toBe("");
    expect(brez!.url).toBe("https://www.slovenia.info/sl/dozivetja/kolesarjenje");
  });

  test("CRLF konci vrstic so podprti", () => {
    const p = parseLlmsTxt(FIXTURE.replace(/\n/g, "\r\n"));
    expect(p.entryCount).toBe(4);
    expect(p.sections.length).toBe(2);
  });

  test("fail-closed: nedovoljen URL se izpusti in PREŠTEJE", () => {
    const zlonamerni = [
      "## Odsek",
      "- [Varen](https://www.slovenia.info/sl/ok): Opis.",
      "- [Zlobna povezava](https://zlobna-stran.si/napad): Opis.",
      "- [HTTP vir](http://www.slovenia.info/sl/ni-https): Opis.",
    ].join("\n");
    const p = parseLlmsTxt(zlonamerni);
    expect(p.entryCount).toBe(1);
    expect(p.skippedLines).toBe(2);
  });

  test("fail-closed: vnos pred prvim odsekom se izpusti", () => {
    const p = parseLlmsTxt("- [Siroči](https://www.slovenia.info/x): brez odseka");
    expect(p.entryCount).toBe(0);
    expect(p.skippedLines).toBe(1);
  });

  test("determinizem: isti vhod → isti izhod (globinsko)", () => {
    expect(parseLlmsTxt(FIXTURE)).toEqual(parseLlmsTxt(FIXTURE));
  });

  test("flattenEntries prinese jezik + odsek v vsak vnos", () => {
    const entries = flattenEntries("sl", parseLlmsTxt(FIXTURE));
    expect(entries.length).toBe(4);
    expect(entries[0]).toEqual({
      language: "sl",
      section: "Aktivne počitnice",
      title: "Pohodništvo",
      url: "https://www.slovenia.info/sl/dozivetja/pohodnistvo",
      description: "Informacije o pohodniških poteh.",
    });
  });
});

describe("isAllowedStoUrl — varnostni filter vira", () => {
  test("dovoljen: https na www.slovenia.info", () => {
    expect(isAllowedStoUrl("https://www.slovenia.info/sl/stran")).toBe(true);
  });
  test("zavrnjen: http (ni https)", () => {
    expect(isAllowedStoUrl("http://www.slovenia.info/sl/stran")).toBe(false);
  });
  test("zavrnjen: tuji gostitelj", () => {
    expect(isAllowedStoUrl("https://zlobna-stran.si/x")).toBe(false);
  });
  test("zavrnjen: pokvarjen URL", () => {
    expect(isAllowedStoUrl("ni-url")).toBe(false);
  });
});

// ── Iskanje ────────────────────────────────────────────────────────────────

const ENTRIES: StoContentEntry[] = flattenEntries("sl", parseLlmsTxt(FIXTURE));

describe("searchStoContent — deterministično iskanje", () => {
  test("zadetek po naslovu (najvišja ocena) na prvem mestu", () => {
    const hits = searchStoContent("pohodništvo", ENTRIES);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].entry.title).toBe("Pohodništvo");
  });

  test("diakritike se zložijo (iskanje brez šumnikov najde šumnike)", () => {
    const hits = searchStoContent("pohodnistvo", ENTRIES); // brez č-ja
    expect(hits.some((h) => h.entry.title === "Pohodništvo")).toBe(true);
  });

  test("zadetek po opisu (nižja ocena kot naslov)", () => {
    const hits = searchStoContent("sušenja", ENTRIES);
    expect(hits.length).toBe(1);
    expect(hits[0].entry.title).toContain("pršut");
  });

  test("AND semantika: vsa gesla morajo zadeti", () => {
    expect(searchStoContent("pohodništvo pršut", ENTRIES)).toEqual([]);
    expect(searchStoContent("pohodništvo informacije", ENTRIES).length).toBeGreaterThan(0);
  });

  test("sklonske oblike: „blede“ najde „Bled“ (predponsko ujemanje ≥ 4)", () => {
    const zBledom: StoContentEntry[] = [
      {
        language: "sl",
        section: "Regije",
        title: "Bled",
        url: "https://www.slovenia.info/sl/destinacije/bled",
        description: "Alpsko jezero z otokom.",
      },
    ];
    expect(searchStoContent("blede", zBledom).length).toBe(1);
    // kratka gesla (< 4) NE sprožijo predponskega ujemanja (brez smeti)
    expect(searchStoContent("bles", zBledom).length).toBe(0);
  });

  test("prazna poizvedba → prazni zadetki (0 gesel)", () => {
    expect(searchStoContent("", ENTRIES)).toEqual([]);
    expect(searchStoContent("   ", ENTRIES)).toEqual([]);
  });

  test("limit omeji število zadetkov", () => {
    const hits = searchStoContent("slovenia", ENTRIES, { limit: 2 });
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  test("determinizem: isti vhod → isti izhod", () => {
    expect(searchStoContent("poti", ENTRIES)).toEqual(searchStoContent("poti", ENTRIES));
  });

  test("normalizeSearchText zloži diakritike in presledke", () => {
    expect(normalizeSearchText("Češnja Že Šele Đe")).toBe("cesnja ze sele de");
  });
});

// ── Ingest runner (lažni fetch — 0 omrežja) ────────────────────────────────

function fetchFixture(_url: string): Promise<Response> {
  return Promise.resolve(new Response(FIXTURE, { status: 200 }));
}

describe("runStoIngest — runner z lažnim fetchem", () => {
  test("uspeh: vseh 7 jezikov + zapis datoteke + poročilo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sto-test-"));
    try {
      const report = await runStoIngest({
        fetchLike: fetchFixture,
        dataDir: dir,
        now: () => new Date("2026-10-07T12:00:00Z"),
      });
      expect(report.status).toBe("ok");
      expect(report.languages.length).toBe(7);
      expect(report.totalEntries).toBe(4 * 7);
      expect(report.wroteFile).toBe(join(dir, "sto-content.json"));

      // Zapisana datoteka se naloži in je veljavna.
      const loaded = await loadStoContent(dir);
      expect(loaded.status).toBe("ok");
      if (loaded.status === "ok") {
        expect(loaded.dataset.entries.length).toBe(28);
        expect(loaded.dataset.languages.map((l) => l.language)).toEqual(
          STO_LLMS_LANGUAGE_SOURCES.map((s) => s.language)
        );
        expect(loaded.dataset.fetchedAt).toBe("2026-10-07T12:00:00.000Z");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("partial: en jezik odpove, ostali se zapišejo (iskreno)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sto-test-"));
    try {
      const fetchLike = (url: string) =>
        url.includes("sto-llms-fr.txt")
          ? Promise.resolve(new Response("napaka", { status: 500 }))
          : Promise.resolve(new Response(FIXTURE, { status: 200 }));
      const report = await runStoIngest({ fetchLike, dataDir: dir });
      expect(report.status).toBe("partial");
      expect(report.languages.find((l) => l.language === "fr")?.ok).toBe(false);
      expect(report.totalEntries).toBe(4 * 6);
      expect(report.wroteFile).toBeDefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("error: VSI jeziki odpovejo → datoteka se NE prepiše", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sto-test-"));
    try {
      // Prejšnja dobra množica.
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, "sto-content.json"),
        JSON.stringify({
          source: "prejšnji",
          fetchedAt: "2026-01-01T00:00:00.000Z",
          languages: [{ language: "sl", title: "t", intro: "i", entryCount: 1 }],
          entries: [
            {
              language: "sl",
              section: "s",
              title: "stari",
              url: "https://www.slovenia.info/sl/star",
              description: "d",
            },
          ],
        }),
        "utf8"
      );

      const fetchLike = () =>
        Promise.resolve(new Response("napaka", { status: 503 }));
      const report = await runStoIngest({ fetchLike, dataDir: dir });
      expect(report.status).toBe("error");
      expect(report.wroteFile).toBeUndefined();

      // Stara množica je NEDOTAKNJENA.
      const loaded = await loadStoContent(dir);
      expect(loaded.status).toBe("ok");
      if (loaded.status === "ok") {
        expect(loaded.dataset.entries[0].title).toBe("stari");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ── Nalagalnik — iskrena stanja ────────────────────────────────────────────

describe("loadStoContent — iskrena stanja", () => {
  test("manjkajoča datoteka → missing (nikoli izjema)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sto-test-"));
    try {
      const loaded = await loadStoContent(dir);
      expect(loaded.status).toBe("missing");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("pokvarjen JSON → invalid z razlogom", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sto-test-"));
    try {
      await writeFile(join(dir, "sto-content.json"), "{pokvarjeno", "utf8");
      const loaded = await loadStoContent(dir);
      expect(loaded.status).toBe("invalid");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ── DEJANSKA množica (data/sto-content.json — živ ingest P0-C) ─────────────

describe("DEJANSKA STO množica (data/sto-content.json)", () => {
  test("naložena, 7 jezikov, vsi URL na slovenia.info, ≥600 vnosov", async () => {
    const loaded = await loadStoContent();
    expect(loaded.status).toBe("ok");
    if (loaded.status !== "ok") return;

    const jeziki = new Set(loaded.dataset.entries.map((e) => e.language));
    expect(jeziki.size).toBe(7);
    for (const jezik of ["sl", "en", "de", "it", "fr", "ru", "es"]) {
      expect(jeziki.has(jezik)).toBe(true);
    }
    // Strukturna invarianta (ne krhek števec — STO osvežuje vsebino).
    expect(loaded.dataset.entries.length).toBeGreaterThanOrEqual(600);
    for (const e of loaded.dataset.entries) {
      expect(isAllowedStoUrl(e.url)).toBe(true);
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.section.length).toBeGreaterThan(0);
    }
  });
});

describe("STO iskanje na dejanski množici", () => {
  test("poizvedba „blede“ vrne zadetke z URL na slovenia.info", async () => {
    const loaded = await loadStoContent();
    if (loaded.status !== "ok") return;
    const hits = searchStoContent("blede", loaded.dataset.entries, {
      language: "sl",
      limit: 5,
    });
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.entry.url).toContain("slovenia.info");
    }
  });

  test("atribucija vira je enkraten konstantni vir", () => {
    expect(STO_ATTRIBUTION).toContain("slovenia.info");
  });
});
