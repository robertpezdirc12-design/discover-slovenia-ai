/**
 * WATCH-ENGINE TESTS (P1-C, issue #3 §4) — čista deterministična plast.
 * ============================================================================
 * Iskronostni kanon §4 CRITICAL je tukaj ZAKLEPEN z regresijskimi testi:
 *  - »cena je padla« SAMO iz dveh preverljivih cen (baseline brez opozorila);
 *  - zavrnjene vrste (availability/flight) → iskrena zavrnitev;
 *  - horizont vremena: PENDING pred napovedjo (nikoli lažni mir);
 *  - vir nedosegljiv → UNAVAILABLE (nikoli optimistično);
 *  - dedupeKey stabilen (isti dogodek → isti ključ → idempotenten cron).
 */

import { describe, expect, test } from "bun:test";

import { addDaysIso, todayIso } from "../src/lib/trip-dates";
import type { WeatherDay } from "../src/lib/weather";
import {
  NOTIFICATION_LIST_MAX,
  SEVERE_WEATHER_CODES,
  TRIP_DAY_MILESTONES,
  UNSUPPORTED_WATCH_KINDS,
  WATCH_KINDS,
  WATCH_KIND_TARGETS,
  WATCH_MAX_PER_USER,
  evaluateBookingWatch,
  evaluatePriceWatch,
  evaluateTripDayWatch,
  evaluateWeatherWatch,
  parsePriceObservation,
  parseStoredCondition,
  sortNotificationsForList,
  sortWatchesForList,
  validateWatchCondition,
  validateWatchInput,
} from "../src/lib/watch-engine";

const NOW = "2026-10-08T12:00:00.000Z";
const TODAY = todayIso(new Date(NOW));
const D = (n: number): string => addDaysIso(TODAY, n) ?? TODAY;

function forecastDay(date: string, precipMm: number, code = 61): WeatherDay {
  return {
    date,
    code,
    tMaxC: 18,
    tMinC: 9,
    precipProbPct: 70,
    precipMm,
  };
}

// ── ① Fiksni nabori ─────────────────────────────────────────────────────────

describe("watch-engine: fiksni nabori (brez dinamičnih vrst)", () => {
  test("točno 4 podprte vrste z zapisano kombinacijo ciljev", () => {
    expect([...WATCH_KINDS]).toEqual(["price", "weather", "trip_day", "booking"]);
    expect(WATCH_KIND_TARGETS.price).toBe("product");
    expect(WATCH_KIND_TARGETS.weather).toBe("journey");
    expect(WATCH_KIND_TARGETS.trip_day).toBe("journey");
    expect(WATCH_KIND_TARGETS.booking).toBe("journey");
  });

  test("zavrnjene vrste so izrecno poimensko odklonjene (iskrenost)", () => {
    expect(UNSUPPORTED_WATCH_KINDS.availability.sl).toContain("ne morem spremljati");
    expect(UNSUPPORTED_WATCH_KINDS.availability.sl).toContain("potrjuje");
    expect(UNSUPPORTED_WATCH_KINDS.flight.sl).toContain("nimamo");
    expect(UNSUPPORTED_WATCH_KINDS.flight.en.toLowerCase()).toContain("no verifiable");
  });

  test("meje so fiksne (bounded)", () => {
    expect(WATCH_MAX_PER_USER).toBe(50);
    expect(NOTIFICATION_LIST_MAX).toBe(100);
    expect(SEVERE_WEATHER_CODES).toContain(95);
    expect(SEVERE_WEATHER_CODES).toContain(82);
    expect(TRIP_DAY_MILESTONES).toEqual([7, 1]);
  });
});

// ── ② Validacija vnosa ──────────────────────────────────────────────────────

describe("watch-engine: validateWatchInput", () => {
  test("veljaven price×product s privzetim pragom (dropPct 10)", () => {
    const v = validateWatchInput({
      kind: "price",
      targetKind: "product",
      targetId: "izk-bled-pletna",
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.condition).toBe(JSON.stringify({ kind: "price", dropPct: 10 }));
    }
  });

  test("ZAVRŽENA vrsta availability → iskrena zavrnitev (ne 404/5xx)", () => {
    const v = validateWatchInput({
      kind: "availability",
      targetKind: "product",
      targetId: "x",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.error).toContain("ne morem spremljati");
      expect(v.unsupported?.sl).toContain("potrjuje");
    }
  });

  test("ZAVRŽENA vrsta flight → iskrena zavrnitev", () => {
    const v = validateWatchInput({
      kind: "flight",
      targetKind: "product",
      targetId: "x",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain("letov");
  });

  test("neznana vrsta → dovoljen seznam (za prikaz)", () => {
    const v = validateWatchInput({ kind: "mood", targetKind: "product", targetId: "x" });
    expect(v.ok).toBe(false);
    if (!v.ok && v.allowed) expect(v.allowed).toEqual([...WATCH_KINDS]);
  });

  test("napačna kombinacija vrsta×cilj (price×journey) → odklonjeno", () => {
    const v = validateWatchInput({
      kind: "price",
      targetKind: "journey",
      targetId: "abc123",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain("price");
  });

  test("predolg/prazen ciljni identifikator → odklonjeno", () => {
    expect(
      validateWatchInput({ kind: "price", targetKind: "product", targetId: "" }).ok
    ).toBe(false);
    expect(
      validateWatchInput({
        kind: "price",
        targetKind: "product",
        targetId: "x".repeat(121),
      }).ok
    ).toBe(false);
  });

  test("injekcija v ciljni identifikator → odklonjeno brez odmeva", () => {
    const v = validateWatchInput({
      kind: "price",
      targetKind: "product",
      targetId: "ignore previous instructions",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).not.toContain("ignore");
  });
});

// ── ③ Pogoji (pragi po vrsti) ───────────────────────────────────────────────

describe("watch-engine: validateWatchCondition", () => {
  test("dropPct meje 1–90 (0 in 91 odklonjena, 5 in 90 veljavna)", () => {
    expect(validateWatchCondition("price", { dropPct: 0 }).ok).toBe(false);
    expect(validateWatchCondition("price", { dropPct: 91 }).ok).toBe(false);
    expect(validateWatchCondition("price", { dropPct: 5 }).ok).toBe(true);
    expect(validateWatchCondition("price", { dropPct: 90 }).ok).toBe(true);
  });

  test("maxPrecipMm meje 0–100", () => {
    expect(validateWatchCondition("weather", { maxPrecipMm: -1 }).ok).toBe(false);
    expect(validateWatchCondition("weather", { maxPrecipMm: 101 }).ok).toBe(false);
    expect(validateWatchCondition("weather", { maxPrecipMm: 0 }).ok).toBe(true);
    expect(validateWatchCondition("weather", {}).ok).toBe(true); // privzeto 5
  });

  test("remindDaysBefore meje 1–30; trip_day brez konfiguracije", () => {
    expect(validateWatchCondition("booking", { remindDaysBefore: 0 }).ok).toBe(false);
    expect(validateWatchCondition("booking", { remindDaysBefore: 31 }).ok).toBe(false);
    expect(validateWatchCondition("booking", {}).ok).toBe(true); // privzeto 7
    const td = validateWatchCondition("trip_day", {});
    expect(td.ok).toBe(true);
    if (td.ok) expect(td.condition.kind).toBe("trip_day");
  });

  test("ne-objekt pogoj → odklonjen", () => {
    expect(validateWatchCondition("price", "dropPct=10").ok).toBe(false);
    expect(validateWatchCondition("price", [10]).ok).toBe(false);
  });

  test("parseStoredCondition: pokvarjen zapis → null (fail-closed)", () => {
    expect(parseStoredCondition("price", "{not json")).toBeNull();
    expect(parseStoredCondition("price", '{"dropPct":999}')).toBeNull();
    expect(parseStoredCondition("unknown-kind", "{}")).toBeNull();
    const ok = parseStoredCondition("weather", '{"maxPrecipMm":8}');
    expect(ok).not.toBeNull();
    expect(ok?.kind).toBe("weather");
  });
});

// ── ④ PRICE: dve preverljivi ceni (CRITICAL) ────────────────────────────────

describe("watch-engine: evaluatePriceWatch (iskrenost dveh cen)", () => {
  const base = {
    watchId: "w1",
    productSlug: "izk-bled-pletna",
    productName: "Pletna vožnja",
    dropPct: 10,
    now: NOW,
  };

  test("PRVIČ: brez prejšnjega opažanja → BASELINE, NO opozorilo", () => {
    const r = evaluatePriceWatch({ ...base, currentPriceCents: 2000, previous: null });
    expect(r.status).toBe("baseline");
    expect(r.notification).toBeNull();
    expect(r.observation).toBe(
      JSON.stringify({ priceCents: 2000, observedAt: NOW })
    );
  });

  test("padec 25 % ≥ prag 10 % → TRIGGERED z dedupe ključem prehoda", () => {
    const r = evaluatePriceWatch({
      ...base,
      currentPriceCents: 1500,
      previous: { priceCents: 2000, observedAt: "2026-10-07T00:00:00.000Z" },
    });
    expect(r.status).toBe("triggered");
    expect(r.notification).not.toBeNull();
    expect(r.notification?.severity).toBe("success");
    expect(r.notification?.dedupeKey).toBe("price:w1:2000:1500");
    expect(r.notification?.body).toContain("25 %");
    // obe ceni v telesu (dokazljivost):
    expect(r.notification?.body).toContain("20,00");
    expect(r.notification?.body).toContain("15,00");
  });

  test("manjši padec 5 % < prag 10 % → QUIET (brez opozorila)", () => {
    const r = evaluatePriceWatch({
      ...base,
      currentPriceCents: 1900,
      previous: { priceCents: 2000, observedAt: NOW },
    });
    expect(r.status).toBe("quiet");
    expect(r.notification).toBeNull();
  });

  test("zvišanje → QUIET z novim izhodiščem (naslednji padec primerja nanj)", () => {
    const r = evaluatePriceWatch({
      ...base,
      currentPriceCents: 2200,
      previous: { priceCents: 2000, observedAt: NOW },
    });
    expect(r.status).toBe("quiet");
    expect(JSON.parse(r.observation ?? "{}").priceCents).toBe(2200);
  });

  test("natančno na pragu → TRIGGERED (≥ velja)", () => {
    // 2000 → 1800 je natanko 10 %
    const r = evaluatePriceWatch({
      ...base,
      currentPriceCents: 1800,
      previous: { priceCents: 2000, observedAt: NOW },
    });
    expect(r.status).toBe("triggered");
  });

  test("izdelek ni več na voljo → NOT_APPLICABLE (brez lažnega opazovanja)", () => {
    const r = evaluatePriceWatch({
      ...base,
      currentPriceCents: null,
      previous: { priceCents: 2000, observedAt: NOW },
    });
    expect(r.status).toBe("not_applicable");
    expect(r.notification).toBeNull();
  });

  test("parsePriceObservation: pokvarjeno/ničelno → null (brez izmišljene osnove)", () => {
    expect(parsePriceObservation(null)).toBeNull();
    expect(parsePriceObservation("junk")).toBeNull();
    expect(parsePriceObservation('{"priceCents":0,"observedAt":"x"}')).toBeNull();
    expect(parsePriceObservation('{"priceCents":-5,"observedAt":"x"}')).toBeNull();
    expect(parsePriceObservation('{"priceCents":1500,"observedAt":"x"}')).toEqual({
      priceCents: 1500,
      observedAt: "x",
    });
  });
});

// ── ⑤ WEATHER: horizont, vir, resnost ───────────────────────────────────────

describe("watch-engine: evaluateWeatherWatch", () => {
  const base = {
    watchId: "w2",
    shareId: "abc123",
    tripName: "Poletje v Bohinju",
    maxPrecipMm: 5,
    todayIso: TODAY,
  };

  test("brez datumov pote → NOT_APPLICABLE (iskreno čaka)", () => {
    const r = evaluateWeatherWatch({
      ...base,
      tripDays: [],
      forecastByCoord: new Map(),
    });
    expect(r.status).toBe("not_applicable");
    expect(r.notification).toBeNull();
  });

  test("vir nedosegljiv (null napoved) → UNAVAILABLE, NO opozorilo", () => {
    const r = evaluateWeatherWatch({
      ...base,
      tripDays: [{ iso: D(1), coordKey: "46.36,14.10" }],
      forecastByCoord: new Map([["46.36,14.10", null]]),
    });
    expect(r.status).toBe("unavailable");
    expect(r.notification).toBeNull();
  });

  test("lokacija izven meje preverjanja (undefined) → UNAVAILABLE", () => {
    const r = evaluateWeatherWatch({
      ...base,
      tripDays: [{ iso: D(1), coordKey: "zz-prek-meje" }],
      forecastByCoord: new Map(),
    });
    expect(r.status).toBe("unavailable");
    expect(r.notification).toBeNull();
  });

  test("dan še izven horizonta 16 dni → PENDING (nikoli lažni mir)", () => {
    const r = evaluateWeatherWatch({
      ...base,
      tripDays: [{ iso: D(20), coordKey: "a" }],
      forecastByCoord: new Map([["a", [forecastDay(D(20), 0)]]]),
    });
    expect(r.status).toBe("pending");
    expect(r.notification).toBeNull();
  });

  test("padavine ≥ prag → TRIGGERED z dedupe po dnevu", () => {
    const iso = D(2);
    const r = evaluateWeatherWatch({
      ...base,
      tripDays: [{ iso, coordKey: "a" }],
      forecastByCoord: new Map([["a", [forecastDay(iso, 12.4)]]]),
    });
    expect(r.status).toBe("triggered");
    expect(r.notification?.severity).toBe("warning");
    expect(r.notification?.dedupeKey).toBe(`weather:w2:${iso}`);
    expect(r.notification?.body).toContain("12,4");
  });

  test("vroča WMO koda (nevihta 95) tudi brez padavin → TRIGGERED", () => {
    const iso = D(3);
    const r = evaluateWeatherWatch({
      ...base,
      tripDays: [{ iso, coordKey: "a" }],
      forecastByCoord: new Map([["a", [forecastDay(iso, 0, 95)]]]),
    });
    expect(r.status).toBe("triggered");
    expect(r.notification?.body).toContain("vroča vremenska koda");
  });

  test("vsi dnevi v horizontu mirni → QUIET z najslabšim dnem v opažanju", () => {
    const r = evaluateWeatherWatch({
      ...base,
      tripDays: [
        { iso: D(1), coordKey: "a" },
        { iso: D(2), coordKey: "a" },
      ],
      forecastByCoord: new Map([
        ["a", [forecastDay(D(1), 0.2), forecastDay(D(2), 4.9)]],
      ]),
    });
    expect(r.status).toBe("quiet");
    const obs = JSON.parse(r.observation ?? "{}");
    expect(obs.precipMm).toBe(4.9);
    expect(obs.worstDayIso).toBe(D(2));
  });

  test("mešano: mirni dnevi v horizontu + dnevi zunaj → PENDING", () => {
    const r = evaluateWeatherWatch({
      ...base,
      tripDays: [
        { iso: D(1), coordKey: "a" },
        { iso: D(20), coordKey: "a" },
      ],
      forecastByCoord: new Map([["a", [forecastDay(D(1), 0.5)]]]),
    });
    expect(r.status).toBe("pending");
  });

  test("že mimo dnevi se preskočijo (pot poteka)", () => {
    const r = evaluateWeatherWatch({
      ...base,
      tripDays: [
        { iso: D(-2), coordKey: "a" },
        { iso: D(-1), coordKey: "a" },
      ],
      forecastByCoord: new Map(),
    });
    expect(r.status).toBe("pending"); // noben dan znotraj horizonta ni bil preverjen
  });
});

// ── ⑥ TRIP DAY: mejniki 7 in 1 ──────────────────────────────────────────────

describe("watch-engine: evaluateTripDayWatch", () => {
  const base = { watchId: "w3", shareId: "abc123", tripName: "Jesen v Soči", todayIso: TODAY };

  test("brez začetka → NOT_APPLICABLE", () => {
    const r = evaluateTripDayWatch({ ...base, dateStart: null });
    expect(r.status).toBe("not_applicable");
  });

  test("mejnik 7 dni → TRIGGERED (dedupe po mejniku)", () => {
    const r = evaluateTripDayWatch({ ...base, dateStart: D(7) });
    expect(r.status).toBe("triggered");
    expect(r.notification?.dedupeKey).toBe("tripday:w3:d7");
    expect(r.notification?.severity).toBe("info");
  });

  test("mejnik 1 dan → TRIGGERED", () => {
    const r = evaluateTripDayWatch({ ...base, dateStart: D(1) });
    expect(r.status).toBe("triggered");
    expect(r.notification?.dedupeKey).toBe("tripday:w3:d1");
  });

  test("med mejniki (3 dni) → QUIET", () => {
    expect(evaluateTripDayWatch({ ...base, dateStart: D(3) }).status).toBe("quiet");
  });

  test("pred odhodom več kot teden → QUIET (še daleč)", () => {
    expect(evaluateTripDayWatch({ ...base, dateStart: D(14) }).status).toBe("quiet");
  });

  test("pot že mimo → NOT_APPLICABLE", () => {
    expect(evaluateTripDayWatch({ ...base, dateStart: D(-1) }).status).toBe("not_applicable");
  });
});

// ── ⑦ BOOKING: nepotrjene rezervacije v oknu ────────────────────────────────

describe("watch-engine: evaluateBookingWatch", () => {
  const base = {
    watchId: "w4",
    shareId: "abc123",
    tripName: "Zima na Kranjski Gori",
    remindDaysBefore: 7,
    todayIso: TODAY,
  };

  test("brez datumov → NOT_APPLICABLE", () => {
    const r = evaluateBookingWatch({ ...base, dateStart: null, ideaCount: 3 });
    expect(r.status).toBe("not_applicable");
  });

  test("2 IDEA rezervaciji 5 dni pred potjo → TRIGGERED warning (dedupe po dnevu)", () => {
    const r = evaluateBookingWatch({ ...base, dateStart: D(5), ideaCount: 2 });
    expect(r.status).toBe("triggered");
    expect(r.notification?.severity).toBe("warning");
    expect(r.notification?.dedupeKey).toBe(`booking:w4:${TODAY}`);
    expect(r.notification?.body).toContain("IDEA");
    expect(r.notification?.body).toContain("2");
  });

  test("0 IDEA (vse rešene) → QUIET", () => {
    const r = evaluateBookingWatch({ ...base, dateStart: D(5), ideaCount: 0 });
    expect(r.status).toBe("quiet");
    expect(r.note).toContain("0 v statusu IDEA");
  });

  test("izven okna (10 dni > 7) → QUIET", () => {
    const r = evaluateBookingWatch({ ...base, dateStart: D(10), ideaCount: 3 });
    expect(r.status).toBe("quiet");
  });

  test("pot že mimo → NOT_APPLICABLE", () => {
    const r = evaluateBookingWatch({ ...base, dateStart: D(-2), ideaCount: 1 });
    expect(r.status).toBe("not_applicable");
  });
});

// ── ⑧ Determinizem (isti vhod → isti izhod) ─────────────────────────────────

describe("watch-engine: determinizem", () => {
  test("dvojno vrednotenje cene da IDENTIČEN rezultat", () => {
    const input = {
      watchId: "w5",
      productSlug: "s",
      productName: "n",
      dropPct: 10,
      currentPriceCents: 1200,
      previous: { priceCents: 1500, observedAt: NOW },
      now: NOW,
    } as const;
    const a = evaluatePriceWatch({ ...input });
    const b = evaluatePriceWatch({ ...input });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("sortWatchesForList/sortNotificationsForList sta stabilna", () => {
    const t = new Date("2026-10-08T10:00:00Z");
    const watches = [
      { id: "b", updatedAt: t },
      { id: "a", updatedAt: t },
      { id: "c", updatedAt: new Date("2026-10-09T10:00:00Z") },
    ];
    expect(sortWatchesForList(watches).map((w) => w.id)).toEqual(["c", "b", "a"]);
    const notes = [
      { id: "y", createdAt: t },
      { id: "x", createdAt: t },
      { id: "z", createdAt: new Date("2026-10-09T10:00:00Z") },
    ];
    expect(sortNotificationsForList(notes).map((n) => n.id)).toEqual(["z", "y", "x"]);
  });
});
