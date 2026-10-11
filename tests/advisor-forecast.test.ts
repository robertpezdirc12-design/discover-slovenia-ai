import { describe, expect, test } from "bun:test";

import {
  answerAdvisorScript,
  futureIsoDays,
  resolveFutureMention,
  type AdvisorScriptContext,
} from "@/lib/advisor/answer";
import type { SharedPlan } from "@/lib/shared-plan";
import { addDaysIso, todayIso, weekdayLong } from "@/lib/trip-dates";
import type { WeatherDay } from "@/lib/weather";

/**
 * QA U5 (2026-10-11) — vprašan „jutri“, svetovalec ne sme odgovarjati s
 * „trenutno“ brez opozorila. Vir DNEVNE napovedi obstaja (Open-Meteo,
 * 16 dni — enak kot zastavica na /pot):
 *  - prihodnji sklic (jutri/dan v tednu/datum/čez N dni/naslednji teden)
 *    + shranjeni datumi poti → DNEVNA napoved, iskreno označena z virom;
 *  - brez datumov poti / čez horizont / vir odpove → iskreno
 *    „napovedi nimam — tukaj je trenutno stanje“ + trenutno vreme;
 *  - vprašanje o sedanjosti → NESPREMENJEN obstoječi odgovor.
 *
 * Kanon: 0 omrežja (stub dep), 0 AI, isti vhod → isti izhod.
 */

const PLAN: SharedPlan = {
  shareId: "test",
  name: "Testna pot",
  createdAt: "2026-10-08T00:00:00.000Z",
  days: [
    { day: 1, title: "Dan 1", locations: [{ name: "Bled", destSlug: "bled" }] },
    { day: 2, title: "Dan 2", locations: [{ name: "Bohinj", destSlug: "bohinj" }] },
  ],
  totalBudget: 20,
};

const TODAY = todayIso();

/** Stub dnevne napovedi: 16 dni od DANES (deterministično glede na dan testa). */
const DAILY: WeatherDay[] = Array.from({ length: 16 }, (_, i) => ({
  date: addDaysIso(TODAY, i) ?? TODAY,
  code: i % 2 === 0 ? 2 : 61,
  tMaxC: 15 + i,
  tMinC: 5 + i,
  precipProbPct: 30 + i,
  precipMm: 0.5,
}));

const tripDates = {
  start: addDaysIso(TODAY, 1) ?? TODAY, // pot se začne JUTRI
  end: addDaysIso(TODAY, 4) ?? TODAY,
};

const CTX = (over: Partial<AdvisorScriptContext> = {}): AdvisorScriptContext => ({
  deps: {
    fetchCurrentWeather: async () => ({ temperatureC: 18.4, weatherCode: 0 }),
    fetchDailyWeather: async () => DAILY,
    loadSto: async () => ({ status: "missing" as const }),
  },
  tripDates,
  ...over,
});

// ── resolveFutureMention / futureIsoDays (čisti funkciji) ────────────────

describe("QA U5 — resolveFutureMention (razpoznavanje prihodnosti)", () => {
  test("jutri / tomorrow / domani / morgen → tomorrow", () => {
    expect(resolveFutureMention("@AI kakšno bo vreme v Bledu jutri?")).toEqual({
      kind: "tomorrow",
    });
    expect(resolveFutureMention("weather tomorrow in Bled?")).toEqual({
      kind: "tomorrow",
    });
  });

  test("„jutranji“ NE sproži (samo cela beseda — brez lažnih zadetkov)", () => {
    expect(resolveFutureMention("jutranji izlet na Bledu")).toBeNull();
  });

  test("dan v tednu (SL/EN) → weekday", () => {
    expect(resolveFutureMention("@AI vreme v ponedeljek?")).toEqual({
      kind: "weekday",
      dow: 1,
    });
    expect(resolveFutureMention("weather friday?")).toEqual({
      kind: "weekday",
      dow: 5,
    });
  });

  test("datum: ISO in slovenski zapis → date", () => {
    expect(resolveFutureMention("vreme 2026-12-24")).toEqual({
      kind: "date",
      iso: "2026-12-24",
    });
    expect(resolveFutureMention("kakšno bo vreme 24. 12.?")).toEqual({
      kind: "date",
      iso: `${TODAY.slice(0, 4)}-12-24`,
    });
  });

  test("čez N dni → date (danes + N)", () => {
    const m = resolveFutureMention("kakšno bo vreme čez 3 dni v Bledu?");
    expect(m).toEqual({ kind: "date", iso: addDaysIso(TODAY, 3) ?? TODAY });
  });

  test("naslednji teden → nextweek", () => {
    expect(resolveFutureMention("vreme naslednji teden?")).toEqual({
      kind: "nextweek",
    });
    expect(resolveFutureMention("vreme prihodnji teden?")).toEqual({
      kind: "nextweek",
    });
  });

  test("vprašanje o sedanjosti → null ( obstoječa pot nespremenjena)", () => {
    expect(resolveFutureMention("@AI kakšno je vreme v Bledu?")).toBeNull();
    expect(resolveFutureMention("@AI kakšno bo vreme?")).toBeNull();
  });
});

describe("QA U5 — futureIsoDays (sklic → datumi, DST-varno)", () => {
  test("jutri = danes + 1", () => {
    expect(futureIsoDays({ kind: "tomorrow" }, TODAY)).toEqual([
      addDaysIso(TODAY, 1) ?? TODAY,
    ]);
  });

  test("dan v tednu = NASLEDNJA pojavitev strogo v prihodnosti", () => {
    const iso = futureIsoDays({ kind: "weekday", dow: 1 }, TODAY)?.[0];
    expect(iso).toBeDefined();
    // ponedeljek je res ponedeljek in je v prihodnosti
    const [y, m, d] = iso!.split("-").map((x) => Number.parseInt(x, 10));
    expect(new Date(y, m - 1, d, 12).getDay()).toBe(1);
    expect(iso! > TODAY).toBe(true);
  });

  test("datum v preteklosti → null (ne ugibamo leta)", () => {
    expect(futureIsoDays({ kind: "date", iso: "2020-01-01" }, TODAY)).toBeNull();
  });

  test("naslednji teden: pon–ned, znotraj 16-dnevnega horizonta vira", () => {
    const days = futureIsoDays({ kind: "nextweek" }, TODAY);
    expect(days).not.toBeNull();
    expect(days!.length).toBeGreaterThan(0);
    expect(days!.length).toBeLessThanOrEqual(7);
    for (const iso of days!) {
      expect(iso > TODAY).toBe(true);
    }
  });
});

// ── answerAdvisorScript: dnevna napoved ──────────────────────────────────

describe("QA U5 — @AI dnevna napoved (prihodnost + datumi poti)", () => {
  test("»vreme jutri« z datumi poti → DNEVNA napoved z virom (ne trenutno)", async () => {
    const a = await answerAdvisorScript("@AI kakšno bo vreme v Bledu jutri?", PLAN, CTX());
    expect(a).toContain("Dnevna napoved");
    expect(a).toContain("Open-Meteo");
    expect(a).toContain("NAPOVED, ne zagotovilo");
    expect(a).toContain("°C");
    expect(a).toContain("ARSO");
    // jutri je dan 1 poti → izrecna vezava na dan poti
    expect(a).toContain("dan 1 tvoje poti");
    expect(a).not.toContain("Trenutno vreme");
  });

  test("ime dneva: „v ponedeljek“ → napoved za naslednji ponedeljek", async () => {
    const a = await answerAdvisorScript("@AI vreme v Bledu v ponedeljek?", PLAN, CTX());
    expect(a).toContain("Dnevna napoved");
    const mondayIso = futureIsoDays({ kind: "weekday", dow: 1 }, TODAY)![0];
    expect(a).toContain(weekdayLong(mondayIso, "sl"));
  });

  test("»vreme jutri« BREZ datumov poti → iskreno: napovedi nimam + trenutno", async () => {
    const a = await answerAdvisorScript(
      "@AI kakšno bo vreme v Bledu jutri?",
      PLAN,
      CTX({ tripDates: null })
    );
    expect(a).toContain("napovedi nimam");
    expect(a).toContain("trenutno stanje");
    expect(a).toContain("Trenutno vreme");
    expect(a).toContain("18 °C"); // trenutno iz stuba (iskren padec)
  });

  test("dan čez 16-dnevni horizont vira → iskrena opomba + trenutno", async () => {
    const a = await answerAdvisorScript("@AI vreme v Bledu čez 40 dni?", PLAN, CTX());
    expect(a).toContain("16-dnevni horizont");
    expect(a).toContain("napovedi nimam");
    expect(a).toContain("Trenutno vreme");
  });

  test("vir napovedi odpove → iskren padec na trenutno stanje", async () => {
    const a = await answerAdvisorScript(
      "@AI kakšno bo vreme v Bledu jutri?",
      PLAN,
      CTX({ deps: {
        fetchCurrentWeather: async () => ({ temperatureC: 9, weatherCode: 3 }),
        fetchDailyWeather: async () => null, // vir napovedi odpovedal
        loadSto: async () => ({ status: "missing" as const }),
      } })
    );
    expect(a).toContain("nisem dobil");
    expect(a).toContain("Trenutno vreme");
    expect(a).toContain("9 °C");
  });

  test("vprašanje o sedanjosti → obstoječi odgovor (regresija)", async () => {
    const a = await answerAdvisorScript("@AI kakšno je vreme v Bledu?", PLAN, CTX());
    expect(a).toContain("Trenutno vreme");
    expect(a).toContain("18 °C");
    expect(a).not.toContain("Dnevna napoved");
  });

  test("determinizem: isti vhod + isti dep → isti izhod", async () => {
    const q = "@AI kakšno bo vreme v Bledu jutri?";
    const a1 = await answerAdvisorScript(q, PLAN, CTX());
    const a2 = await answerAdvisorScript(q, PLAN, CTX());
    expect(a1).toBe(a2);
  });
});
