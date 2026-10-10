import { describe, expect, test } from "bun:test";

import {
  buildTripPdf,
  fromItineraryPlan,
  fromSharedPlan,
  pdfFilenameSlug,
  type TripPdfInput,
} from "../src/lib/pdf/trip-pdf-doc";
import { renderWith, type JsPdfCtor } from "../src/lib/pdf/trip-pdf-render";
import { jsPDF } from "jspdf";

/**
 * TRIP-PDF (P5, 2.27.0) — pogodbe:
 *  - vsebinski model: determinizem (isti vhod → isti doc), iskrenost
 *    (neznane ure izpuščene, neznan strokek izpuščen), i18n ×6, sluge
 *    datuma le ob realnih datumih;
 *  - renderer: %PDF glava, > 1 stran pri dolgem načrtu, BITNI DETERMINIZEM
 *    (isti doc + issuedAt → identičen izhod; CreationDate fiksiran);
 *  - ime datoteke: diakritiki → ASCII slug, nikoli prazen padec.
 */

const ctor = jsPDF as unknown as JsPdfCtor;
// Danes (UTC) v času pisanja — CreationDate test pričakuje to vrednost.
const ISSUED = new Date("2026-10-10T12:00:00Z");

const planInput = (over: Partial<TripPdfInput> = {}): TripPdfInput => ({
  name: "Gorenjska z držino",
  dates: { start: "2026-07-10", end: "2026-07-12" },
  days: [
    {
      dayIndex: 1,
      dateIso: null,
      weekday: null,
      title: null,
      locations: [
        { time: "09:00", name: "Bled — Blejsko jezero" },
        { time: "13:30", name: "Vintgar" },
        { time: null, name: "Bohinj (ura ni znana)" },
      ],
    },
    { dayIndex: 2, dateIso: null, weekday: null, title: null, locations: [] },
    {
      dayIndex: 3,
      dateIso: null,
      weekday: null,
      title: null,
      locations: [{ time: "10:00", name: "Ljubljana — staro mesto" }],
    },
  ],
  totalCost: 128.5,
  totalBudget: null,
  coverageNote: "Dan 3 pokriva 2 od 3 želja.",
  sourceNote: "plan",
  ...over,
});

describe("trip-pdf-doc — builder", () => {
  test("DETERMINIZEM: dva klica → strukturono identična doc-a", () => {
    const a = buildTripPdf(planInput(), "sl");
    const b = buildTripPdf(planInput(), "sl");
    expect(a).toEqual(b);
  });

  test("ISKRENOST: ura null ostane null (nikoli izmišljena) v dnevih", () => {
    const doc = buildTripPdf(planInput(), "sl");
    expect(doc.daySections[0].locations[2].time).toBeNull();
    expect(doc.daySections[0].locations[0].time).toBe("09:00");
  });

  test("ISKRENOST: neznan totalCost se ne izpiše; znan se izpiše z vejico", () => {
    const brez = buildTripPdf(planInput({ totalCost: null }), "sl");
    expect(brez.metaLines.some((l) => l.includes("stroški"))).toBe(false);

    const z = buildTripPdf(planInput(), "sl");
    const costLine = z.metaLines.find((l) => l.includes("stroški"));
    expect(costLine).toContain("128,50 €");
  });

  test("datumi: realni → obdobje v meta; brez → iskrena opomba", () => {
    const z = buildTripPdf(planInput(), "sl");
    expect(z.metaLines[0]).toContain(" — ");
    const brez = buildTripPdf(planInput({ dates: null }), "sl");
    expect(brez.metaLines[0]).toContain("datumi niso določeni");
  });

  test("dnevi s kalendarijem: dateLine vsebuje ime dneva in dolgo obliko datuma", () => {
    // 2026-07-10 je petek.
    const doc = buildTripPdf(planInput(), "sl");
    expect(doc.daySections[0].dateLine).toMatch(/petek/i);
    expect(doc.daySections[0].dateLine).toContain("julij");
    // Dan brez kalendarskega ujemanja (dayIndex 3 v 3-dnevnem obdobju) ima datum:
    expect(doc.daySections[2].dateLine).toBeTruthy();
  });

  test("pokritje: coverageNote prisoten → naslov + besedilo; null → odsoten", () => {
    const z = buildTripPdf(planInput(), "sl");
    expect(z.coverageHeading).toBe("Opomba o pokritju");
    expect(z.coverage).toContain("Dan 3");
    const brez = buildTripPdf(planInput({ coverageNote: null }), "sl");
    expect(brez.coverageHeading).toBeNull();
    expect(brez.coverage).toBeNull();
  });

  test("i18n: sl „Dan 1“, en „Day 1“, de „Tag 1“ + šumniki v heading ostanejo", () => {
    const sl = buildTripPdf(planInput(), "sl");
    const en = buildTripPdf(planInput(), "en");
    const de = buildTripPdf(planInput(), "de");
    expect(sl.daySections[0].label).toBe("Dan 1");
    expect(en.daySections[0].label).toBe("Day 1");
    expect(de.daySections[0].label).toBe("Tag 1");
    expect(sl.heading).toContain("Sloveniji");
    expect(de.heading).toContain("Slovenien");
  });

  test("številske slovenske oblike: 1 postanek / 2 postanka / 5 postankov", () => {
    const one = buildTripPdf(planInput({ days: [{ dayIndex: 1, dateIso: null, weekday: null, title: null, locations: [{ time: null, name: "Bled" }] }] }), "sl");
    expect(one.metaLines.find((l) => l.startsWith("Postanki"))).toBe("Postanki: 1 postanek");

    const two = buildTripPdf(planInput({ days: [
      { dayIndex: 1, dateIso: null, weekday: null, title: null, locations: [{ time: null, name: "Bled" }, { time: null, name: "Bohinj" }] },
    ] }), "sl");
    expect(two.metaLines.find((l) => l.startsWith("Postanki"))).toBe("Postanki: 2 postanka");

    // planInput ima skupaj 4 lokacije (3 + 0 + 1) → slovenska množina.
    const five = buildTripPdf(planInput(), "sl");
    expect(five.metaLines.find((l) => l.startsWith("Postanki"))).toBe("Postanki: 4 postankov");
  });

  test("adapter fromItineraryPlan: neveljavna oblika ure (25:99) → null; totalCost gre skozi", () => {
    const doc = buildTripPdf(
      fromItineraryPlan(
        {
          days: [[{ id: "a", name: "Bled", time: "25:99", durationMin: 90, cost: 10, kind: "custom" }]],
          title: "Test",
          summary: "",
          totalCost: 42,
          coverageNote: "",
          dayTitles: ["Dan 1 · Gorenjska"],
        },
        null
      ),
      "sl"
    );
    // 25:99 ne ustreza HH:mm → iskreno brez ure.
    expect(doc.daySections[0].locations[0].time).toBeNull();
    expect(doc.metaLines.some((l) => l.includes("42,00"))).toBe(true);
  });

  test("adapter fromSharedPlan: totalBudget (ne totalCost) + ime pote", () => {
    const doc = buildTripPdf(
      fromSharedPlan(
        {
          shareId: "ds123",
          name: "Poletje v Soči",
          createdAt: "2026-01-01T00:00:00Z",
          days: [{ day: 1, locations: [{ name: "Soča", time: "08:00" }] }],
          totalBudget: 300,
        },
        null,
        "cloud"
      ),
      "sl"
    );
    expect(doc.subtitle).toBe("Poletje v Soči");
    expect(doc.metaLines.some((l) => l.includes("Proračun") && l.includes("300,00"))).toBe(true);
    expect(doc.metaLines.some((l) => l.includes("stroški"))).toBe(false);
  });

  test("fallback ime: name null → jezikovno nadomestilo (potovanje/trip) kot slug", () => {
    const sl = buildTripPdf(planInput({ name: null }), "sl");
    expect(sl.filename).toBe("potovanje.pdf");
    const en = buildTripPdf(planInput({ name: null }), "en");
    expect(en.filename).toBe("trip.pdf");
  });
});

describe("trip-pdf-doc — pdfFilenameSlug", () => {
  test("šumniki → ASCII (č→c, ž→z), presledki → vezaji, mala črka", () => {
    expect(pdfFilenameSlug("Žimska Gorenjska čez Bohinj")).toBe("zimska-gorenjska-cez-bohinj");
    expect(pdfFilenameSlug("  Bled--Vintgar  ")).toBe("bled-vintgar");
  });
  test("prazno / samo ločila / null → null (klical uporabi nadomestno ime)", () => {
    expect(pdfFilenameSlug(null)).toBeNull();
    expect(pdfFilenameSlug("")).toBeNull();
    expect(pdfFilenameSlug("---   ---")).toBeNull();
  });
  test("nondeterministični znaki (cirilica) se odstranijo, ASCII ostane", () => {
    expect(pdfFilenameSlug("Поход na Bled")).toBe("na-bled");
  });
});

describe("trip-pdf-render — resni jsPDF (0 omrežja)", () => {
  test("glava %PDF, velikost > 5 KB, 1 stran za kratek načrt", () => {
    const doc = buildTripPdf(planInput(), "sl");
    const out = renderWith(ctor, doc, { issuedAt: ISSUED });
    const head = new TextDecoder("latin1").decode(out.bytes.slice(0, 8));
    expect(head.startsWith("%PDF-1.")).toBe(true);
    expect(out.bytes.byteLength).toBeGreaterThan(5000);
    expect(out.filename).toBe("gorenjska-z-drzino.pdf");
  });

  test("BITNI DETERMINIZEM: isti (doc, issuedAt) → identičen izhod", () => {
    const doc = buildTripPdf(planInput(), "sl");
    const a = renderWith(ctor, doc, { issuedAt: ISSUED });
    const b = renderWith(ctor, doc, { issuedAt: ISSUED });
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
  });

  test("CreationDate je fiksiran na issuedAt (ne na trenutek izrisa)", () => {
    const doc = buildTripPdf(planInput(), "sl");
    const out = renderWith(ctor, doc, { issuedAt: ISSUED });
    const s = new TextDecoder("latin1").decode(out.bytes);
    const m = s.match(/\/CreationDate \(D:(\d{14})/);
    expect(m?.[1]).toBe("20261010120000");
  });

  test("dolg načrt (14 dni × 6 lokacij) → ≥ 2 strani (noga na vsaki — drawFooters iterira)", () => {
    const days = Array.from({ length: 14 }, (_, i) => ({
      dayIndex: i + 1,
      dateIso: null,
      weekday: null,
      title: null,
      locations: Array.from({ length: 6 }, (_, j) => ({
        time: `${String(8 + j).padStart(2, "0")}:00`,
        name: `Kraj št. ${i + 1}-${j + 1} z dolgim imenom skupnosti`,
      })),
    }));
    const doc = buildTripPdf(planInput({ days }), "sl");
    const out = renderWith(ctor, doc, { issuedAt: ISSUED });
    const s = new TextDecoder("latin1").decode(out.bytes);
    // Strani štejemo po /Type /Page (ne /Pages) in potrjujemo /Count v korenu.
    expect(out.pages).toBeGreaterThanOrEqual(2);
    const count = s.match(/\/Count (\d+)/g) ?? [];
    expect(count.some((c) => parseInt(c.slice(7), 10) === out.pages)).toBe(true);
  });
});
