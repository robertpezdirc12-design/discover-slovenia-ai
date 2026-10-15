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
    // termin 2027 POTRJEN (2.66.2, verifikacija 2026-10-15,
    // zgodovinska-mesta.si): 21.–23. maj 2027 (prozna potrditev
    // organizatorja; isto polje strukturirano 19.–23.5. z postavitvijo)
    expect(e.dateUnconfirmed).toBeUndefined();
    expect(e.dateStart).toBe("2027-05-21");
    expect(e.dateEnd).toBe("2027-05-23");
    expect(e.dateLabel).toBe("21. – 23. maj 2027");
    expect(e.source).toBe("https://www.zgodovinska-mesta.si/prireditve/vinska-vigred-v-beli-krajini/");
    expect(e.verifiedAt).toBe("2026-10-15");
  });

  test("①d Planica: FIS finale SP 18.–21. marec 2027 (planica.si + sloski.si)", () => {
    const e = byId("planica-nordic-festival");
    expect(e.title).toBe("Planica — FIS finale svetovnega pokala");
    expect(e.website).toBe("https://www.planica.si");
    // QA 3. serija (2026-10-13): planica.si objavila „Program 2027 —
    // Planica bo med 18. in 21. marcem 2027“; sloski.si neodvisno potrdil.
    expect(e.dateUnconfirmed).toBeUndefined();
    expect(e.dateStart).toBe("2027-03-18");
    expect(e.dateEnd).toBe("2027-03-21");
    expect(e.dateLabel).toBe("18. – 21. mar 2027");
    expect(e.monthIndex).toBe(3);
    expect(e.venue).toBe("Planica, Kranjska Gora");
    expect(e.source).toBe("https://www.planica.si");
    expect(e.verifiedAt).toBe("2026-10-13");
  });

  test("①e Jurjevanje: JUNIJ + termin 2027 potrjen 21.–25.6. (zgodovinska-mesta.si)", () => {
    const e = byId("jurjevanje-bela-krajina");
    expect(e.monthIndex).toBe(6); // NE april
    expect(e.venue).toContain("Črnomelj");
    // termin 2027 POTRJEN (2.66.2, verifikacija 2026-10-15,
    // zgodovinska-mesta.si — RIC Bela krajina): 21.–25. junij 2027
    expect(e.dateUnconfirmed).toBeUndefined();
    expect(e.dateStart).toBe("2027-06-21");
    expect(e.dateEnd).toBe("2027-06-25");
    expect(e.dateLabel).toBe("21. – 25. jun 2027");
    expect(e.source).toBe("https://www.zgodovinska-mesta.si/prireditve/jurjevanje-v-beli-krajini/");
    expect(e.verifiedAt).toBe("2026-10-15");
  });

  test("①f Zlata lisica: 29.–30. jan 2027 na Podkorenu (sloski.si) — NI „Zlati lisjak“ in ni Maribor", () => {
    const e = byId("zlati-lisjak-smucanje");
    // QA 3. serija (2026-10-13, sloski.si — uradni koledar SP 2026/27):
    // „Zlata lisica 29. – 30. 1. 2027 FIS svetovni pokal v alpskem smučanju
    // za ženske“; povezava viru vodi na kranjskagora-worldcup.si → lokacija
    // Podkoren/Kranjska Gora (do 2019 Maribor, od 2020 Podkoren).
    expect(e.title).toContain("Zlata lisica");
    expect(e.title).not.toContain("Zlati lisjak");
    expect(e.dateUnconfirmed).toBeUndefined();
    expect(e.dateStart).toBe("2027-01-29");
    expect(e.dateEnd).toBe("2027-01-30");
    expect(e.dateLabel).toBe("29. – 30. jan 2027");
    expect(e.monthIndex).toBe(1);
    expect(e.venue).toContain("Kranjska Gora");
    expect(e.venue).not.toContain("Maribor");
    expect(e.website).toBe("https://kranjskagora-worldcup.si");
    expect(e.source).toBe("https://www.sloski.si");
    expect(e.verifiedAt).toBe("2026-10-13");
    // Kranjska Gora ni med 38 destinacijami → brez destSlug (ne „maribor“)
    expect(e.destSlug).toBeUndefined();
    expect(e.image).toBe("/content/zlata-lisica-golden-fox.jpg");
  });
});

// ---------------------------------------------------------------------------
// ② NEPOTRJENI DATUMI — pošteno ravnanje („nikoli ne ugibaj“)
// ---------------------------------------------------------------------------

describe("events P0 (#38): nepotrjeni datumi", () => {
  const UNCONFIRMED_IDS = [
    // 2.66.2 (verifikacija 2026-10-15): vigred (21.–23.5.2027),
    // festival-soca/Tolminator (28.7.–1.8.2027) in jurjevanje (21.–25.6.2027)
    // so potrjeni — izločeni iz tega seznamu; ostala P0-sledenja:
    "blejski-danovski-festival",
    "pivo-in-cvetje-lasko",
  ];
  // QA 3. serija (2026-10-13): „zlati-lisjak-smucanje“ (→ Zlata lisica,
  // 29.–30. 1. 2027) in „planica-nordic-festival“ (→ 18.–21. 3. 2027)
  // prešla med POTRJENE — glej ①d/①f.
  // SDK serija (2026-10-13): „ljubljanski-zimski-festival“ → POTRJEN
  // (15. 2. 2027, Eventim + glasbenamatica.si) — mesec popravljen jan → feb;
  // „bozicni-sejmi-ljubljana-maribor“ (Ljubljana del) → POTRJEN začetek
  // 27. 11. 2026 (uradna stran visitljubljana.com). Maribor ostaja nepotrjen.

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
  test("③a brez filtrov = vseh 38 dogodkov (F2: 31 SI kanona + 7 balkanskih #41 — EXIT odstranjen 2.66.2)", () => {
    expect(EVENTS.length).toBe(38);
    expect(filterEvents("all", "all").length).toBe(38);
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

// ---------------------------------------------------------------------------
// ④ P0 2. SERIJA (verifikacija 2026-10-13) — popravki na podlagi primarnih
//    virov: ce-sejem.si (seznam sejmov), crnomelj.si + nacionalni register
//    dogodkov (e-občina), visitljubljana.com, visitmaribor.si, bled.si,
//    postojna.si. Kanon: vir se zapiše SAMO, če ga je verifikacija
//    dejansko prebrala; nepotrjen datum = „datum še ni potrjen“.
// ---------------------------------------------------------------------------

describe("events P0 2. serija (2026-10-13): popravki po primarnih virih", () => {
  test("④a celjski-sejem: uradni jesenski sejem je POMP, 10.–11. okt 2026", () => {
    const e = byId("celjski-sejem");
    // zapis „Celjski sejem 9.–12. 10. 2026“ ne obstaja — „Celjski sejem
    // d.d.“ je prizorišče/organizator; edini oktobrski sejem 2026 = POMP.
    expect(e.title).toBe("POMP — sejem pompoznih dogodkov");
    expect(e.dateStart).toBe("2026-10-10");
    expect(e.dateLabel).toBe("10. – 11. okt 2026");
    expect(e.monthIndex).toBe(10);
    expect(e.venue).toBe("Celjski sejem, Celje");
    expect(e.website).toBe("https://www.ce-sejem.si");
    expect(e.source).toBe("https://www.ce-sejem.si/sejmi/");
    expect(e.verifiedAt).toBe("2026-10-13");
    expect(e.dateUnconfirmed).toBeUndefined();
  });

  test("④b bela-krajina-koline: 2026 edicija NI potrdljiva → pošteno nepotrjeno", () => {
    const e = byId("bela-krajina-koline");
    expect(e.dateUnconfirmed).toBe(true);
    expect(e.dateStart).toBe("");
    expect(e.dateLabel).toBe("datum še ni potrjen");
    // manjkajoči vir: brez izmišljenega source-a (iskrenostni kanon)
    expect(e.source).toBeUndefined();
    expect(e.verifiedAt).toBeUndefined();
    // mesec ostane kot PRIČAKOVANO okno (november, tradicija)
    expect(e.monthIndex).toBe(11);
  });

  test("④c božični sejmi RAZDVOJENI: Ljubljana (obstoječi id) + Maribor (nov id)", () => {
    const lj = byId("bozicni-sejmi-ljubljana-maribor");
    const mb = byId("bozicni-sejmi-maribor");
    // Ljubljana: uradni brand „December v Ljubljani“, glavni prizorišči
    // Prešernov trg/Breg (ne „Stari trg“); SDK serija (2026-10-13): začetek
    // sezone 2026/27 POTRJEN — prižig lučk 27. 11. 2026 (uradna stran).
    expect(lj.title).toBe("December v Ljubljani — božični sejmi");
    expect(lj.dateUnconfirmed).toBeUndefined();
    expect(lj.dateStart).toBe("2026-11-27");
    expect(lj.dateLabel).toBe("od 27. nov 2026");
    expect(lj.monthIndex).toBe(11);
    expect(lj.source).toContain("visitljubljana.com");
    expect(lj.verifiedAt).toBe("2026-10-13");
    expect(lj.venue).toBe("Prešernov trg in Breg, Ljubljana");
    expect(lj.website).toBe("https://www.visitljubljana.com/sl/obiskovalci/prireditve/prireditve-v-ljubljani/december-v-ljubljani");
    // Maribor: uradni brand „Čarobni Maribor“ (visitmaribor.si)
    expect(mb.title).toBe("Čarobni Maribor — božični sejmi");
    expect(mb.dateUnconfirmed).toBe(true);
    expect(mb.dateStart).toBe("");
    expect(mb.website).toBe("https://www.visitmaribor.si");
    expect(mb.monthIndex).toBe(11);
    // oba zapisa si delita kategorijo tradicija in mesec 11
    expect(lj.category).toBe("tradicija");
    expect(mb.category).toBe("tradicija");
  });

  test("④d bled-winter-magic: uradni brand „Blejska zimska pravljica“ (bled.si)", () => {
    const e = byId("bled-winter-magic");
    expect(e.title).toBe("Blejska zimska pravljica");
    expect(e.venue).toBe("Jezerska promenada, Bled");
    expect(e.dateUnconfirmed).toBe(true);
    expect(e.dateStart).toBe("");
    expect(e.website).toBe("https://www.bled.si/sl/prireditve/glavne-prireditve/blejska-zimska-pravljica/");
    expect(e.source).toBe("https://www.bled.si/sl/prireditve/glavne-prireditve/blejska-zimska-pravljica/");
    expect(e.verifiedAt).toBe("2026-10-13");
  });

  test("④e jamski-sejem-postojna: NI sledu v primarnih virih → pošteno nepotrjeno", () => {
    const e = byId("jamski-sejem-postojna");
    expect(e.dateUnconfirmed).toBe(true);
    expect(e.dateStart).toBe("");
    expect(e.dateLabel).toBe("datum še ni potrjen");
    // zapis ostane (ne brišemo brez razloga), a brez izmišljenega datuma
    expect(e.venue).toBe("Trg Tabor, Postojna");
    expect(e.monthIndex).toBe(12);
  });

  test("④f vsi potrjeni datumi (2. serija) imajo vir + datum verifikacije", () => {
    for (const e of EVENTS) {
      if (e.dateUnconfirmed) continue;
      // dogodek z 2. serija popravkom NOSI vir; starejši zapisi (1. serija
      // in nerazvrščeni) ostanejo nespremenjeni — tu zaklepamo le, da
      // POPRAVLJENI zapisi (celjski-sejem) nosita vir.
      if (e.id === "celjski-sejem") {
        expect(e.source).toBeTruthy();
        expect(e.verifiedAt).toBe("2026-10-13");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ⑤ P0 3. SERIJA (verifikacija 2026-10-13, SDK kvota izčrpana → curl pri
//    primarnih virih): nacionalni register dogodkov (e-občina
//    /DobiDogodke — instanca tolmin.si, ključne besede „Soča“/„Soca“/
//    „Tolminator“/„blejski“/„danovski“/„koline“/„opankarija“/„jamski“ =
//    0 zadetkov), postojna.si register (eo_id=105, „jamski“ = 0),
//    bled.si RSS (1554 novic) + koledar na domači strani, Wikipedia
//    MetalDays/Tolminator (dejansko prebrana). Kanon nespremenjen:
//    vir se zapiše SAMO, če ga je verifikacija dejansko brala.
// ---------------------------------------------------------------------------

describe("events P0 3. serija (2026-10-13): korekcija + ponovna sledljivost", () => {
  test("⑤a festival-soca: korigiran na REALNI Tolminator (Tolmin, julij, metal)", () => {
    const e = byId("festival-soca");
    // fiktivni „Festival Soča“ (sport/reggae, maj) ne obstaja — edini
    // aktivni glasbeni festival na Soči v Tolminu je Tolminator (od 2023
    // na istem prizorišču kot MetalDays 2004–2022), vzorec ④a.
    expect(e.title).toBe("Tolminator — metal festival na sotočju Soče in Tolminke");
    expect(e.title).toContain("Tolminator");
    expect(e.category).toBe("glasba"); // NE „sport“ več
    expect(e.monthIndex).toBe(7); // julij (seznam metal festivalov: „July“)
    expect(e.venue).toContain("Tolmin");
    expect(e.venue).toContain("Sotočje");
    // termin 2027 POTRJEN (2.66.2, verifikacija 2026-10-15): tolminator.com
    // (prava domena organizatorja — prejšnja „tolminator.si“ je bila napačna):
    // „28 July - 1 August 2027“ + EARLY BIRD vstopnice v predprodaji
    expect(e.dateUnconfirmed).toBeUndefined();
    expect(e.dateStart).toBe("2027-07-28");
    expect(e.dateEnd).toBe("2027-08-01");
    expect(e.dateLabel).toBe("28. jul – 1. avg 2027");
    // vir dejansko prebran (2.66.2): uradna stran organizatorja
    expect(e.source).toBe("https://tolminator.com");
    expect(e.verifiedAt).toBe("2026-10-15");
    expect(e.website).toBe("https://tolminator.com");
    // destinacija ostane Soča (Tolmin je pokrit z vodičem reka-soca)
    expect(e.destSlug).toBe("reka-soca");
  });

  test("⑤b blejski-danovski-festival: ime NI sledljivo (register + bled.si) → pošteno nepotrjeno", () => {
    const e = byId("blejski-danovski-festival");
    expect(e.dateUnconfirmed).toBe(true);
    expect(e.dateStart).toBe("");
    expect(e.dateLabel).toBe("datum še ni potrjen");
    // not_found kanon ④b: brez izmišljenega source-a in povezave
    expect(e.source).toBeUndefined();
    expect(e.verifiedAt).toBeUndefined();
    expect(e.website).toBeUndefined();
    // mesec = pričakovano okno (april, po izmišljenem terminu), ostane
    expect(e.monthIndex).toBe(4);
    expect(e.destSlug).toBe("bled");
  });

  test("⑤c ponovna verifikacija registra (2026-10-13): koline/jamski/božični-MB/blejski → datumi ostanejo prazni", () => {
    // vsi izrecno ponovno preverjeni prek e-občina /DobiDogodke (0 zadetkov);
    // SDK serija (2026-10-13): ljubljanski del božičnih sejmov POTRJEN
    // (27. 11. 2026, visitljubljana.com) — iz seznama izločen, Maribor ostane.
    // 2.66.2: festival-soca izločen — POTRJEN 28.7.–1.8.2027 (tolminator.com).
    const RECHECKED = [
      "bela-krajina-koline",
      "jamski-sejem-postojna",
      "bozicni-sejmi-maribor",
      "blejski-danovski-festival",
    ];
    for (const id of RECHECKED) {
      const e = byId(id);
      expect(e.dateUnconfirmed).toBe(true);
      expect(e.dateStart).toBe("");
      expect(e.dateLabel).toBe("datum še ni potrjen");
    }
    // koline: vir ostane NEDEFINIRAN (zaklep ④b ne sme biti oslabjen)
    expect(byId("bela-krajina-koline").source).toBeUndefined();
    expect(byId("jamski-sejem-postojna").source).toBeUndefined();
  });

  test("⑤d nedosegljive/mrtve domene (3. serija) se ne vrnejo v kanon", () => {
    const dead = ["tolminator.si", "festival-soca.com", "festivalsoca.si", "festivalblejskihdni.si"];
    for (const e of EVENTS) {
      if (e.website) {
        for (const d of dead) expect(e.website.includes(d)).toBe(false);
      }
    }
    // vire prav tako ne kažemo na mrtve domene
    for (const e of EVENTS) {
      if (e.source) {
        for (const d of dead) expect(e.source.includes(d)).toBe(false);
      }
    }
  });

  test("⑤e Tolminator vsebinska zahteva: omenja nasledništvo MetalDays + lokacijo sotočja", () => {
    const e = byId("festival-soca");
    expect(e.description).toContain("MetalDays");
    expect(e.description).toContain("sotočju");
    // opis ne sme več trditi reggae/alternative (ugasnjeni Riversplash)
    expect(e.description.toLowerCase()).not.toContain("reggae");
    expect(e.description.toLowerCase()).not.toContain("rafting");
  });
});
