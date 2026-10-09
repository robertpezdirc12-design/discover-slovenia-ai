/**
 * NEXT-STEP — deterministični stanjski stroj proaktivnega pomočnika.
 *
 * Zaklenjene invariante (issue #1, področje 3):
 * - 0 AI žetonov, 0 omrežja — SAMO pravila (isti vhod → isti izhod),
 * - vedno NAJVIŠJA prioriteta ki ustreza + en sekundarni predlog (če je),
 * - reason se navezuje na DEJANSKI kontekst (števila dni/destinacij),
 * - null SAMO ob manjkajočem/pokvarjenem kontekstu (nikoli izmišljen),
 * - SL je privzeta resnica, "en" je polni prevod (pick fallback kanon).
 */

import { describe, expect, test } from "bun:test";

import {
  isNextStepContext,
  nextStepFor,
  nextStepsFor,
  type NextStepContext,
} from "../src/lib/next-step";

/** Izhodiščno stanje: popolnoma nov obiskovalec (vse nič). */
const base: NextStepContext = {
  myTripCount: 0,
  hasCloudTrip: false,
  hasPlan: false,
  planDays: 0,
  reservationCount: 0,
  confirmedCount: 0,
  goModeActive: false,
};

const ctx = (patch: Partial<NextStepContext>): NextStepContext => ({
  ...base,
  ...patch,
});

describe("next-step: stanja 1–7 (id, naslov SL, ctaHref, reason)", () => {
  test("1) goModeActive → Nadaljuj svojo pot → /na-poti", () => {
    const s = nextStepFor(ctx({ goModeActive: true }));
    expect(s).not.toBeNull();
    expect(s!.id).toBe("go-resume");
    expect(s!.title).toBe("Nadaljuj svojo pot");
    expect(s!.ctaHref).toBe("/na-poti");
    expect(s!.ctaLabel.length).toBeGreaterThan(0);
    expect(s!.reason.length).toBeGreaterThan(10);
  });

  test("2) načrt brez rezervacij → Rezerviraj vnaprej → /trznica", () => {
    const s = nextStepFor(ctx({ hasPlan: true, planDays: 3, reservationCount: 0 }));
    expect(s!.id).toBe("book-ahead");
    expect(s!.title).toBe("Rezerviraj vnaprej");
    expect(s!.ctaHref).toBe("/trznica");
    expect(s!.reason).toContain("3-dnevni načrt");
  });

  test("3) potrjene rezervacije → Pripravi se na pot → /na-poti", () => {
    const s = nextStepFor(
      ctx({ hasPlan: true, planDays: 2, reservationCount: 2, confirmedCount: 2 })
    );
    expect(s!.id).toBe("prepare-go");
    expect(s!.title).toBe("Pripravi se na pot");
    expect(s!.ctaHref).toBe("/na-poti");
    expect(s!.reason).toContain("2 potrjeni rezervaciji");
  });

  test("4) ≥ 2 destinaciji brez načrta → Zgradi načrt iz zbirke → /nacrtuj", () => {
    const s = nextStepFor(ctx({ myTripCount: 3 }));
    expect(s!.id).toBe("build-plan");
    expect(s!.title).toBe("Zgradi načrt iz zbirke");
    expect(s!.ctaHref).toBe("/nacrtuj");
    // Razlog po specifikaciji: "Ker imaš 3 dodane destinacije, a še brez načrta…"
    expect(s!.reason).toContain("3 dodane destinacije");
    expect(s!.reason).toContain("brez načrta");
  });

  test("5) točno ena destinacija → Dodaj še eno → /destinacije", () => {
    const s = nextStepFor(ctx({ myTripCount: 1 }));
    expect(s!.id).toBe("add-another");
    expect(s!.title).toBe("Dodaj še eno");
    expect(s!.ctaHref).toBe("/destinacije");
    expect(s!.reason.length).toBeGreaterThan(10);
  });

  test("6) prazna zbirka brez oblaka → Razišči Slovenijo → /destinacije", () => {
    const s = nextStepFor(ctx({}));
    expect(s!.id).toBe("explore-first");
    expect(s!.title).toBe("Razišči Slovenijo");
    expect(s!.ctaHref).toBe("/destinacije");
    expect(s!.reason.length).toBeGreaterThan(10);
  });

  test("7) prijavljen s potovanji, brez načrta → Odpri svoje potovanje → /moja-potovanja", () => {
    const s = nextStepFor(ctx({ hasCloudTrip: true }));
    expect(s!.id).toBe("open-trips");
    expect(s!.title).toBe("Odpri svoje potovanje");
    expect(s!.ctaHref).toBe("/moja-potovanja");
    expect(s!.reason.length).toBeGreaterThan(10);
  });
});

describe("next-step: prioritete (najvišja zmagovalka)", () => {
  test("goModeActive + načrt brez rezervacij → zmaga Go Mode (1 > 2)", () => {
    const s = nextStepFor(
      ctx({ goModeActive: true, hasPlan: true, planDays: 3 })
    );
    expect(s!.id).toBe("go-resume");
  });

  test("načrt z rezervacijami a brez potrditev → NE book-ahead (2 zahteva 0 rezervacij)", () => {
    const s = nextStepFor(
      ctx({ hasPlan: true, planDays: 2, reservationCount: 1, confirmedCount: 0 })
    );
    expect(s!.id).not.toBe("book-ahead");
  });

  test("zbirka ≥ 2 + že ima načrt → book-ahead (2) zmaga nad build-plan (4)", () => {
    const s = nextStepFor(ctx({ myTripCount: 4, hasPlan: true, planDays: 2 }));
    expect(s!.id).toBe("book-ahead");
  });

  test("ena destinacija + prijavljen z potovanji → add-another (5) zmaga nad open-trips (7)", () => {
    const s = nextStepFor(ctx({ myTripCount: 1, hasCloudTrip: true }));
    expect(s!.id).toBe("add-another");
  });

  test("primarna prioriteta ≥ sekundarna prioriteta (vedno)", () => {
    const out = nextStepsFor(
      ctx({ goModeActive: true, myTripCount: 5, hasCloudTrip: true })
    );
    expect(out).not.toBeNull();
    expect(out!.primary.priority).toBeGreaterThanOrEqual(
      out!.secondary?.priority ?? 0
    );
  });
});

describe("next-step: sekundarni predlog", () => {
  test("goModeActive + zbirka ≥ 2 brez načrta → sekundarni build-plan", () => {
    const out = nextStepsFor(ctx({ goModeActive: true, myTripCount: 5 }));
    expect(out!.primary.id).toBe("go-resume");
    expect(out!.secondary).not.toBeNull();
    expect(out!.secondary!.id).toBe("build-plan");
  });

  test("samo eno pravilo se ujame → sekundarni null", () => {
    const out = nextStepsFor(ctx({ myTripCount: 3 }));
    expect(out!.primary.id).toBe("build-plan");
    expect(out!.secondary).toBeNull();
  });

  test("sekundarni predlog ima veljavno povezavo in reason", () => {
    const out = nextStepsFor(
      ctx({ goModeActive: true, hasPlan: true, planDays: 3 })
    );
    expect(out!.secondary).not.toBeNull();
    expect(out!.secondary!.ctaHref.startsWith("/")).toBe(true);
    expect(out!.secondary!.reason.length).toBeGreaterThan(10);
  });
});

describe("next-step: null / robni primeri", () => {
  test("manjkajoč kontekst (null/undefined) → null", () => {
    expect(nextStepFor(null)).toBeNull();
    expect(nextStepFor(undefined)).toBeNull();
    expect(nextStepsFor(null)).toBeNull();
  });

  test("pokvarjen kontekst (negative števci / napačni tipi) → null", () => {
    expect(nextStepFor(ctx({ myTripCount: -1 }))).toBeNull();
    expect(nextStepFor(ctx({ planDays: -2 }))).toBeNull();
    expect(nextStepFor({ myTripCount: "3" } as unknown as NextStepContext)).toBeNull();
    expect(nextStepFor({ goModeActive: "da" } as unknown as NextStepContext)).toBeNull();
  });

  test("isNextStepContext: veljavno stanje da, okvari ne", () => {
    expect(isNextStepContext(base)).toBe(true);
    expect(isNextStepContext(null)).toBe(false);
    expect(isNextStepContext({})).toBe(false);
    expect(isNextStepContext({ ...base, confirmedCount: Number.NaN })).toBe(false);
  });

  test("vse nič + hasCloudTrip false → Razišči (prvi korak, ne null)", () => {
    const s = nextStepFor(ctx({}));
    expect(s).not.toBeNull();
    expect(s!.id).toBe("explore-first");
    expect(s!.title).toBe("Razišči Slovenijo");
  });

  test("brez ujemajočega pravila (redko) → iskren izhodilni predlog explore-any", () => {
    // oblak + načrt brez dni + samo nepotrjene rezervacije → nobeno pravilo
    const s = nextStepFor(
      ctx({
        hasCloudTrip: true,
        hasPlan: true,
        planDays: 0,
        reservationCount: 2,
        confirmedCount: 0,
      })
    );
    expect(s).not.toBeNull();
    expect(s!.id).toBe("explore-any");
    expect(s!.ctaHref).toBe("/destinacije");
    // prozornost: razlog izrecno prizna, da stanje ne kaže enoličnega koraka
    expect(s!.reason).toContain("ne morem enolično");
  });
});

describe("next-step: SL/EN lokalizacija (L vzorec)", () => {
  test("stanje 1: naslov SL ≠ EN, EN pravilen", () => {
    expect(nextStepFor(ctx({ goModeActive: true }), "sl")!.title).toBe(
      "Nadaljuj svojo pot"
    );
    expect(nextStepFor(ctx({ goModeActive: true }), "en")!.title).toBe(
      "Continue your trip"
    );
  });

  test("stanje 4: reason v EN nosi dejansko številko destinacij", () => {
    const s = nextStepFor(ctx({ myTripCount: 3 }), "en");
    expect(s!.reason).toContain("3 saved destinations");
    expect(s!.ctaLabel).toBe("Open the planner");
  });

  test("stanje 6: naslov EN 'Explore Slovenia'", () => {
    expect(nextStepFor(ctx({}), "en")!.title).toBe("Explore Slovenia");
  });

  test("neznan locale (xx) → slovenska resnica (pick fallback); it ima pravi prevod (P3)", () => {
    expect(nextStepFor(ctx({ myTripCount: 1 }), "xx")!.title).toBe("Dodaj še eno");
    // P3 (i18n štirijezična razširitev): "it" ni več neznan — next-step
    // slovarji nosijo prave italijanske prevode (fallback ostane za xx/yy …).
    expect(nextStepFor(ctx({ myTripCount: 1 }), "it")!.title).toBe(
      "Aggiungine un’altra"
    );
  });

  test("slovenščina: ednina/dvojina/množina v razlogu rezervacij (slUnit)", () => {
    const one = nextStepFor(ctx({ hasPlan: true, confirmedCount: 1 }))!;
    const two = nextStepFor(ctx({ hasPlan: true, confirmedCount: 2 }))!;
    const five = nextStepFor(ctx({ hasPlan: true, confirmedCount: 5 }))!;
    expect(one.reason).toContain("1 potrjeno rezervacijo");
    expect(two.reason).toContain("2 potrjeni rezervaciji");
    expect(five.reason).toContain("5 potrjenih rezervacij");
  });

  test("slovenščina: dvojina destinacij v razlogu (2 dodani destinaciji)", () => {
    const s = nextStepFor(ctx({ myTripCount: 2 }))!;
    expect(s.reason).toContain("2 dodani destinaciji");
  });
});

describe("next-step: determinizem (isti vhod → isti izhod)", () => {
  test("ponovljen klic da identičen predlog", () => {
    const c = ctx({ goModeActive: true, myTripCount: 2, hasCloudTrip: true });
    expect(nextStepFor(c)).toEqual(nextStepFor(c));
    expect(nextStepsFor(c)).toEqual(nextStepsFor(c));
  });

  test("različen kontekst → različen reason (razlog sledi dejstvom)", () => {
    const a = nextStepFor(ctx({ hasPlan: true, planDays: 2 }))!;
    const b = nextStepFor(ctx({ hasPlan: true, planDays: 5 }))!;
    expect(a.reason).toContain("2-dnevni načrt");
    expect(b.reason).toContain("5-dnevni načrt");
    expect(a.reason).not.toBe(b.reason);
  });
});
