import { describe, expect, test } from "bun:test";

/**
 * POLIR C (2.28.0) — PRINT PARITETA /potovanje (navdih Wanderlog printable
 * heritage). /potovanje ima gumb »Natisni« (QA U10), a je bil izpis lastniškega
 * pogleda nečist: gumbi, dnevna navigacija in napotila so se tiskali skupaj
 * z načrtom. /pot/[shareId] (shared-trip-view.tsx) že ima čisto izkušnjo —
 * print:hidden na kontrolah, print:block na čistem podpisu.
 *
 * SOURCE-CONTRACT (kanon tests/p0h-ui-contract.test.ts / trip-chat-rate-limit):
 * UI komponenta je "use client" — zaklenemo STRUKTURO izvorne kode:
 *  · akcije (izvozi, QR-napotila, oblak, Natisni) se NE tiskajo;
 *  · dnevna navigacija in »Navigiraj« kontrole se NE tiskajo;
 *  · čist podpis (natisnjeno <datum> · iskren vir · znamka) je viden SAMO
 *    ob tiskanju — zrcalo noge shared-trip-view;
 *  · logika NESPREMENJENA: samo Tailwind print: razredi + podpis (brez novih
 *    handlerjev/stanji).
 */

const VIEW = "src/app/[locale]/potovanje/view.tsx";
const SHARED = "src/components/content/shared-trip-view.tsx";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe("print-parity [source-contract]: kontrole se NE tiskajo", () => {
  test("① akcijska vrstica (Zaženi, oblak, Načrtuj, PDF, .ics, Natisni) — print:hidden", async () => {
    const code = await src(VIEW);
    expect(code).toContain("mt-6 flex flex-wrap gap-3 print:hidden");
  });

  test("② dnevna navigacija (gumbi Dan 1/Dan 2 …) — print:hidden", async () => {
    const code = await src(VIEW);
    expect(code).toContain('mt-4 print:hidden');
  });

  test("③ »Navigiraj« povezava na postanku (OSM) — print:hidden", async () => {
    const code = await src(VIEW);
    // href osmDirectionsUrl … className … print:hidden (isti <a> element)
    expect(code).toMatch(/osmDirectionsUrl\(stop\.coords\)[\s\S]{0,400}print:hidden/);
  });

  test("④ marketing (cloudPerks) in napotili (.ics hint) — print:hidden", async () => {
    const code = await src(VIEW);
    expect(code).toMatch(/mt-2\.5 text-xs leading-relaxed text-muted-foreground print:hidden/);
    expect(code).toMatch(/id="potovanje-ics-hint"[\s\S]{0,220}print:hidden/);
  });

  test("⑤ napaki (oblak/PDF) se NE tiskata — print:hidden na obeh role=alert", async () => {
    const code = await src(VIEW);
    const alerts = code.match(/role="alert"[\s\S]{0,120}/g) ?? [];
    expect(alerts.length).toBe(2);
    for (const a of alerts) expect(a).toContain("print:hidden");
  });

  test("⑥ skupno število print:hidden ≥ 7 (varovalni pes: nova kontrola potrebuje razred)", async () => {
    const code = await src(VIEW);
    expect((code.match(/print:hidden/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });
});

describe("print-parity [source-contract]: čist podpis ob tiskanju", () => {
  test("⑦ podpis viden SAMO ob tiskanju (print:block) z datumom, virom in znamko", async () => {
    const code = await src(VIEW);
    expect(code).toContain("hidden pt-6 text-center text-xs text-muted-foreground print:block");
    expect(code).toContain("printStamp");
    expect(code).toContain("printSrcPlan");
    expect(code).toContain("printSrcDraft");
    // iskren vir glede na izvor podatkov (planner = lokalna shramba,
    // osnutek = Moja pot s predlogi časov) — obe veji sta izpeljani iz
    // OBSTOJEČEGA data.source (brez nove logike):
    expect(code).toContain('data.source === "planner" ? pick(l, L.printSrcPlan) : pick(l, L.printSrcDraft)');
    // datum izpisa je v jeziku vmesnika (intlDateLocale kanon):
    expect(code).toMatch(/printStamp[\s\S]{0,200}toLocaleString\(intlDateLocale\(l\)\)/);
  });

  test("⑧ podpis v 6 jezikih po vzorcu pick (sl/en/it/de/fr/es)", async () => {
    const code = await src(VIEW);
    expect(code).toContain('printStamp: { sl: "Natisnjeno"');
    expect(code).toContain("en: \"Printed\"");
    expect(code).toContain("it: \"Stampato\"");
    expect(code).toContain("de: \"Gedruckt\"");
    expect(code).toContain("fr: \"Imprimé\"");
    expect(code).toContain("es: \"Impreso\"");
  });

  test("⑨ podpis je zrcalo noge shared-trip-view (isti vzorec razreda)", async () => {
    const shared = await src(SHARED);
    expect(shared).toContain("hidden pt-6 text-center text-xs text-muted-foreground print:block");
    // lastniški pogled je brez deljene povezave → podpis pove vir, ne URL:
    const code = await src(VIEW);
    expect(code).not.toContain("{pageUrl}");
  });
});

describe("print-parity [source-contract]: logika in pariteta ostajajo", () => {
  test("⑩ gumb Natisni (window.print) obstaja — QA U10 pariteta izvozov nedotaknjena", async () => {
    const code = await src(VIEW);
    expect(code).toContain("window.print()");
    expect(code).toContain("exportPdf");
  });

  test("⑪ NOVI print razredi so čisti Tailwind (brez sprememb handlerjev/stanja)", async () => {
    const code = await src(VIEW);
    // podpis bere le obstoječe stanje (data.source/l) — noben novega useState:
    expect(code).not.toContain("printState");
    expect(code).not.toContain("usePrint");
    // vsebina, ki ostane na papirju: dnevi (DayTimeline) + postanki + meta
    // (vir/interesi/opozorila/metrike) — tekom printa NI print:hidden:
    expect(code).toContain("<DayTimeline");
    expect(code).toContain("<WarningsSection");
  });

  test("⑫ mobilni print: vrstice postankov varne pred horizontalnim overflowom", async () => {
    const code = await src(VIEW);
    // min-w-0 + flex-wrap na vrsticah (kanon mobilnega overflowa 2.26.0):
    expect(code).toContain("min-w-0 flex-1");
    expect(code).toContain("flex flex-wrap items-baseline");
  });
});
