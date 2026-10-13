/**
 * EVENTS PAST — „Pretekle dogodke odstrani iz privzetega seznama
 * prihodnjih dogodkov oziroma jih jasno prikaži kot pretekle“ (#38, 2.48.0).
 * ============================================================================
 * Kanon odločitve: oznaka (ne brisanje) — sledljivost zapisa in primarnega
 * vira ostane („ne briši podatkov brez razloga“). Datum reši STREŽNIK
 * (SSR prop `todayIso`, Europe/Ljubljana) → 0 hidracijskih razlik.
 *
 * Zaklenjena semantika:
 *  · `dateEnd` = ISO konec večdnevnega dogodka, izpolnjen IZKLJUČNO iz
 *    preverjenega razpona pri primarnem viru (4 zapisa od 2.49.0:
 *    Stara trta, POMP, Zlata lisica, Planica; enodnevni brez);
 *  · isEventPast: nepotrjen/prazen datum NIKOLI pretekli; zaključek ==
 *    danes → še teče; zaključek < danes → pretekli;
 *  · Event JSON-LD: `eventsJsonLd(events, locale, todayIso)` izključi
 *    zaključene (Google: ne označuj že zaključenih dogodkov); 2-argska
 *    forma (brez todayIso) ostane čisti podatkovni pogled (20 potrjenih).
 */

import { describe, expect, test } from "bun:test";

import { eventsJsonLd } from "../src/lib/jsonld";
import {
  eventEndIso,
  EVENTS,
  isEventPast,
  type CommunityEvent,
} from "../src/lib/content-data";

/** Fiksni „danes“ za teste — datumsko neodvisni zaklepi (nikoli ne drse). */
const TODAY = "2026-10-13";

const byId = (id: string): CommunityEvent => {
  const e = EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`dogodek ${id} manjka v kanonu`);
  return e;
};

const mk = (over: Partial<CommunityEvent>): CommunityEvent => ({
  id: "test",
  monthIndex: 1,
  category: "kultura",
  title: "Testni dogodek",
  dateStart: "",
  dateLabel: "",
  venue: "Test",
  price: "free",
  featured: false,
  image: "/content/x.jpg",
  description: "",
  ...over,
});

// ---------------------------------------------------------------------------
// ① eventEndIso — dateEnd za preverjene večdnevne, sicer dateStart
// ---------------------------------------------------------------------------

describe("events-past (#38): eventEndIso", () => {
  test("①a večdnevni z preverjenim razponom: dateEnd zmaga", () => {
    expect(eventEndIso(byId("festival-stara-trta"))).toBe("2026-10-12");
    expect(eventEndIso(byId("celjski-sejem"))).toBe("2026-10-11");
  });

  test("①b enodnevni/brez dateEnd: vrne dateStart", () => {
    const e = mk({ dateStart: "2027-02-03" });
    expect(eventEndIso(e)).toBe("2027-02-03");
  });
});

// ---------------------------------------------------------------------------
// ② isEventPast — semantika (iskrenostni kanon)
// ---------------------------------------------------------------------------

describe("events-past (#38): isEventPast semantika", () => {
  test("②a nepotrjen datum NIKOLI pretekli (tudi z mesecem v preteklosti)", () => {
    const e = mk({ dateStart: "", dateUnconfirmed: true, monthIndex: 1 });
    expect(isEventPast(e, "2026-12-31")).toBeFalse();
  });

  test("②b prazen dateStart brez zastavice → pretekli ne (varovalka)", () => {
    expect(isEventPast(mk({ dateStart: "" }), TODAY)).toBeFalse();
  });

  test("②c zaključek == danes → ŠE TEČE (ne pretekli)", () => {
    expect(isEventPast(mk({ dateStart: "2026-10-11", dateEnd: "2026-10-13" }), TODAY)).toBeFalse();
    expect(isEventPast(mk({ dateStart: "2026-10-13" }), TODAY)).toBeFalse();
  });

  test("②d zaključek < danes → pretekli (večdnevni in enodnevni)", () => {
    expect(isEventPast(mk({ dateStart: "2026-10-11", dateEnd: "2026-10-12" }), TODAY)).toBeTrue();
    expect(isEventPast(mk({ dateStart: "2026-10-12" }), TODAY)).toBeTrue();
  });

  test("②e prihodnji dogodek → ne pretekli", () => {
    expect(isEventPast(mk({ dateStart: "2026-10-17", dateEnd: "2026-10-18" }), TODAY)).toBeFalse();
  });
});

// ---------------------------------------------------------------------------
// ③ ŽIVI KANON ob 2026-10-13 — natanko 2 zaključena (preverjena) dogodka
// ---------------------------------------------------------------------------

describe("events-past (#38): živi kanon ob 2026-10-13", () => {
  test("③a pretekla: Festival Stara trta (do 12.10.) + POMP (do 11.10.)", () => {
    const past = EVENTS.filter((e) => isEventPast(e, TODAY)).map((e) => e.id);
    expect(past.sort()).toEqual(["celjski-sejem", "festival-stara-trta"]);
  });

  test("③b prihodnji potrjeni niso pretekli (maraton 17.–18.10., Kurentovanje 2027)", () => {
    expect(isEventPast(byId("ljubljanski-maraton"), TODAY)).toBeFalse();
    expect(isEventPast(byId("kurentovanje-ptuj"), TODAY)).toBeFalse();
  });

  test("③c nepotrjeni (11) niso nikoli pretekli", () => {
    const unconfirmed = EVENTS.filter((e) => e.dateUnconfirmed);
    // 2.49.0: 13 → 11 (Zlata lisica + Planica potrjena s primarnima
    // viroma, QA 3. serija 2026-10-13 — glej events-p0-qa38 ①d/①f).
    expect(unconfirmed.length).toBe(11);
    expect(unconfirmed.every((e) => !isEventPast(e, TODAY))).toBeTrue();
  });

  test("③d dateEnd izpolnjen IZKLJUČNO pri preverjenih razponih (4 zapisi)", () => {
    const withEnd = EVENTS.filter((e) => e.dateEnd !== undefined).map((e) => e.id);
    expect(withEnd.sort()).toEqual([
      "celjski-sejem",
      "festival-stara-trta",
      "planica-nordic-festival",
      "zlati-lisjak-smucanje",
    ]);
  });
});

// ---------------------------------------------------------------------------
// ④ EVENT JSON-LD — zaključeni izključeni ob todayIso; 2-argska forma
//    ostane čisti podatkovni pogled (18 potrjenih)
// ---------------------------------------------------------------------------

describe("events-past (#38): Event JSON-LD izključitev zaključenih", () => {
  test("④a 3-argska forma ob 2026-10-13: brez Stare trte in POMP", () => {
    const graph = eventsJsonLd(EVENTS, "sl", TODAY)["@graph"];
    const names = graph.map((e) => e.name);
    expect(names).not.toContain("Festival Stara trta");
    expect(names).not.toContain("POMP — sejem pompoznih dogodkov");
  });

  test("④b 3-argska forma: prihodnji potrjeni ostanejo (maraton, Kurentovanje, Zlata lisica, Planica)", () => {
    const graph = eventsJsonLd(EVENTS, "sl", TODAY)["@graph"];
    // 2.49.0: 16 → 18 (Zlata lisica 29.–30. 1. 2027 + Planica 18.–21. 3.
    // 2027 prešli med potrjene prihodnje).
    expect(graph.length).toBe(18);
    expect(graph.some((e) => e.startDate === "2026-10-17")).toBeTrue();
    expect(graph.some((e) => e.startDate === "2027-02-03")).toBeTrue();
    expect(graph.some((e) => e.startDate === "2027-01-29")).toBeTrue();
    expect(graph.some((e) => e.startDate === "2027-03-18")).toBeTrue();
  });

  test("④c 2-argska forma (brez todayIso) NE filtrira zaključenih (20/31 kanon)", () => {
    const graph = eventsJsonLd(EVENTS, "sl")["@graph"];
    expect(graph.length).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// ⑤ POGODBA STRANI — SSR prop todayIso (0 hidracijskih razlik)
// ---------------------------------------------------------------------------

describe("events-past (#38): pogodba strani /dogodki", () => {
  test("⑤a page.tsx podaja SSR datum (Europe/Ljubljana, en-CA) kot prop in v JSON-LD", async () => {
    const src = await Bun.file("src/app/[locale]/dogodki/page.tsx").text();
    expect(src).toContain('timeZone: "Europe/Ljubljana"');
    expect(src).toContain("<EventsView todayIso={todayIso} />");
    expect(src).toContain("eventsJsonLd(EVENTS, locale, todayIso)");
  });

  test("⑤b events-view ima oznako „pretekli dogodek“ v vseh 6 jezikih", async () => {
    const src = await Bun.file("src/components/content/events-view.tsx").text();
    for (const label of [
      "pretekli dogodek",
      "past event",
      "evento passato",
      "vergangene Veranstaltung",
      "événement passé",
      "evento pasado",
    ]) {
      expect(src).toContain(label);
    }
  });
});
