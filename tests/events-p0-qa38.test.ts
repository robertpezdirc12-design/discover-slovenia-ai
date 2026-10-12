/**
 * EVENTS P0 — QA #34 → #38: zanesljivost podatkov o dogodkih (1. serija).
 * ============================================================================
 * Vsebinski kanon dogodkov je bil delno izmišljen (rekonstrukcija) — ta
 * datoteka ZAKLENE popravke, ki jih podpirajo PRIMARNI VIRI organizatorjev
 * (verifikacija 2026-10-12), ter pošteno ravnanje z nepotrjenimi datumi:
 * „Nikoli ne ugibaj“ (#34) → nepotrjen datum = „datum še ni potrjen“ (#38).
 *
 * Regresijske zahteve iz #38: filtriranje po mesecu in kategoriji,
 * ponastavitev filtrov, prelom leta, prikaz začetnega datuma, status
 * nepotrjenega dogodka in vedenje pri manjkajočem viru.
 */

import { describe, expect, test } from "bun:test";

import {
  EVENT_CATEGORIES,
  EVENTS,
  type CommunityEvent,
  type EventCategory,
} from "../src/lib/content-data";

const byId = (id: string): CommunityEvent => {
  const e = EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`dogodek ${id} manjka v kanonu`);
  return e;
};

// ---------------------------------------------------------------------------
// ① POTRJENI DATUMI (primarni vir organizatorja, verifikacija 2026-10-12)
// ---------------------------------------------------------------------------

describe("events P0 (#38): potrditve primarnih virov", () => {
  test("①a Kurentovanje Ptuj: 3.–9. februar 2027 (kurentovanje.net)", () => {
    const e = byId("kurentovanje-ptuj");
    expect(e.dateStart).toBe("2027-02-03");
    expect(e.dateLabel).toBe("3. – 9. feb 2027");
    expect(e.monthIndex).toBe(2);
    expect(e.website).toBe("https://www.kurentovanje.net");
    expect(e.dateUnconfirmed).toBeUndefined();
    expect(e.source).toBe("https://www.kurentovanje.net");
    expect(e.verifiedAt).toBe("2026-10-12");
  });

  test("①b Ljubljanski maraton: 17.–18. oktobra 2026 (ljubljanamarathon.si) — NI maja", () => {
    const e = byId("ljubljanski-maraton");
    expect(e.dateStart).toBe("2026-10-17");
    expect(e.dateLabel).toBe("17. – 18. okt 2026");
    expect(e.monthIndex).toBe(10);
    // uradna kanonična domena (issue #34 navaja ljubljanamarathon.si)
    expect(e.website).toBe("https://ljubljanamarathon.si");
    expect(e.source).toBe("https://ljubljanamarathon.si");
    expect(e.verifiedAt).toBe("2026-10-12");
  });

  test("①c Vinska vigred: METLIKA (Bela krajina), maj — NI Maribor/Lent in ni marec", () => {
    const e = byId("vinska-vigred-maribor");
    expect(e.title).toContain("Vinska vigred");
    expect(e.venue).toContain("Metlika");
    expect(e.monthIndex).toBe(5);
    // uradna stran (vinskavigred.si je VINARNA, ne festival — QA #34→#38)
    expect(e.website).toBe("https://www.vinska-vigred.si");
    expect(e.description.toLowerCase()).toContain("metlik");
    expect(e.description).not.toContain("Dravi");
    // povezava na destinacijo: Metlika ni med 38 — najbližji kanon Bele krajine
    expect(e.destSlug).toBe("crnomelj");
    // termin 2027 ni še objavljen (44. izdaja 2026: 15.–17. maj) → nepotrjen
    expect(e.dateUnconfirmed).toBe(true);
    expect(e.dateStart).toBe("");
    expect(e.source).toBe("https://www.vinska-vigred.si");
  });

  test("①d Planica: uradni naziv FIS finale + termin 2027 še brez objave", () => {
    const e = byId("planica-nordic-festival");
    expect(e.title).toBe("Planica — FIS finale svetovnega pokala");
    expect(e.website).toBe("https://www.planica.si");
    expect(e.dateUnconfirmed).toBe(true);
    expect(e.dateStart).toBe("");
    expect(e.source).toBe("https://www.planica.si");
  });

  test("①e Jurjevanje: JUNIJ (62. izdaja 2026: 22.–28. junij) + lokacija po viru", () => {
    const e = byId("jurjevanje-bela-krajina");
    expect(e.monthIndex).toBe(6); // NE april
    expect(e.venue).toContain("Črnomelj");
    expect(e.dateUnconfirmed).toBe(true);
    expect(e.source).toBe("https://www.jurjevanje.si");
  });
});

// ---------------------------------------------------------------------------
// ② NEPOTRJENI DATUMI — pošteno ravnanje („nikoli ne ugibaj“)
// ---------------------------------------------------------------------------

describe("events P0 (#38): nepotrjeni datumi", () => {
  const UNCONFIRMED_IDS = [
    "ljubljanski-zimski-festival",
    "zlati-lisjak-smucanje",
    "vinska-vigred-maribor",
    "planica-nordic-festival",
    "festival-soca",
    "blejski-danovski-festival",
    "jurjevanje-bela-krajina",
    "pivo-in-cvetje-lasko",
  ];

  test("②a vsak nepotrjen dogodek: PRAZEN ISO datum + pošten napis + mesec 1–12", () => {
    expect(UNCONFIRMED_IDS.length).toBeGreaterThan(0);
    for (const id of UNCONFIRMED_IDS) {
      const e = byId(id);
      expect(e.dateUnconfirmed).toBe(true);
      expect(e.dateStart).toBe("");
      expect(e.dateLabel).toBe("datum še ni potrjen");
      expect(e.monthIndex).toBeGreaterThanOrEqual(1);
      expect(e.monthIndex).toBeLessThanOrEqual(12);
    }
  });

  test("②b potrjeni dogodki NIKOLI nimajo praznega datuma", () => {
    for (const e of EVENTS) {
      if (!e.dateUnconfirmed) {
        expect(e.dateStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(e.dateLabel.length).toBeGreaterThan(0);
      }
    }
  });

  test("②c sledljivost: nepotrjeni z opomba-izvorom ima veljaven source + verifiedAt", () => {
    for (const e of EVENTS) {
      if (e.source) {
        expect(e.source).toMatch(/^https:\/\//);
        expect(e.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
    // vsaj 6 dogodkov ima zapisan primarni vir (1. verifikacijska serija)
    const withSource = EVENTS.filter((e) => e.source).length;
    expect(withSource).toBeGreaterThanOrEqual(6);
  });

  test("②d mrtve domene (QA 2026-10-12) se ne vrnejo v kanon", () => {
    const dead = ["zlati-lisjak.si", "festivalsoca.si", "festivalblejskihdni.si", "vinskavigred.si"];
    for (const e of EVENTS) {
      if (e.website) {
        for (const d of dead) expect(e.website.includes(d)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ③ REGRESIJA FILTROV (logika zrcali events-view: mesec + kategorija)
// ---------------------------------------------------------------------------

/** Zrcali filtrirno logiko EventsView (mesec + kategorija). */
function filterEvents(month: number | "all", category: EventCategory | "all") {
  return EVENTS.filter(
    (e) =>
      (month === "all" || e.monthIndex === month) &&
      (category === "all" || e.category === category)
  );
}

describe("events P0 (#38): regresija filtrov", () => {
  test("③a brez filtrov = vseh 30 dogodkov (ponastavitev)", () => {
    expect(EVENTS.length).toBe(30);
    expect(filterEvents("all", "all").length).toBe(30);
  });

  test("③b filter po mesecu: februar najde Kurentovanje (potrjen 3. feb)", () => {
    const feb = filterEvents(2, "all");
    expect(feb.length).toBeGreaterThan(0);
    expect(feb.some((e) => e.id === "kurentovanje-ptuj")).toBe(true);
  });

  test("③c filter po mesecu: oktober najde Ljubljanski maraton (prelom iz maja)", () => {
    const oct = filterEvents(10, "all");
    expect(oct.some((e) => e.id === "ljubljanski-maraton")).toBe(true);
    // v maju NI več maratona (izmišljeni 25. maj odstranjen)
    expect(filterEvents(5, "all").some((e) => e.id === "ljubljanski-maraton")).toBe(false);
  });

  test("③d kombinacija mesec + kategorija vrne podmnožico in 0 pri napačni kombinaciji", () => {
    const febSport = filterEvents(2, "sport");
    expect(febSport.length).toBeGreaterThan(0);
    expect(febSport.every((e) => e.category === "sport" && e.monthIndex === 2)).toBe(true);
    // maj + glasba: kanon ne pozna take kombinacije → prazno (UI: empty state)
    expect(filterEvents(5, "glasba").length).toBe(0);
  });

  test("③e prelom leta: koledar pokriva nov 2026 → jan 2027 (ovitek sezone)", () => {
    expect(filterEvents(11, "all").length).toBeGreaterThan(0); // nov 2026
    expect(filterEvents(12, "all").length).toBeGreaterThan(0); // dec 2026
    expect(filterEvents(1, "all").length).toBeGreaterThan(0); // jan 2027
  });

  test("③f vsi dogodki imajo kategorijo iz dovoljenega nabora (obljuba UI čipov)", () => {
    const cats = Object.keys(EVENT_CATEGORIES) as EventCategory[];
    for (const e of EVENTS) expect(cats).toContain(e.category);
  });
});
