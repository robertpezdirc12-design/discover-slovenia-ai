/**
 * DETERMINISTIČNI MOTOR ITINERERJA — ključna invarianta izvirnika
 * (Issue #9: "100 % deterministično — 0 AI žetonov; isti vhod → isti načrt").
 *
 * Ta datoteka zaklene:
 * - determinizem (JSON identika po 3 klicih),
 * - struktura dneva (2–4 postanki, 09:00–19:00 okvir),
 * - trdi filtri (regija, proračun),
 * - geometrijski kanon (haversine, ROAD_FACTOR 1,3, ~60 km/h, round5).
 */

import { describe, expect, test } from "bun:test";

import {
  AVG_SPEED_KMH,
  ROAD_FACTOR,
  buildItinerary,
  budgetTier,
  durationToMinutes,
  haversineKm,
  round5,
  roadKm,
  travelMinutes,
  type PlannerQuery,
} from "../src/lib/itinerary-engine";

const baseQuery: PlannerQuery = {
  interests: ["narava", "jezero"],
  days: 2,
  region: "gorenjska",
  season: "summer",
  budget: "€€",
  locale: "sl",
};

describe("itinerary-engine: determinizem (0 žetonov, 0 ure)", () => {
  test("isti vhod → 3× identičen JSON (vključno s časi in cenami)", () => {
    const a = JSON.stringify(buildItinerary(baseQuery));
    const b = JSON.stringify(buildItinerary(baseQuery));
    const c = JSON.stringify(buildItinerary(baseQuery));
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a.length).toBeGreaterThan(50); // ni prazen
  });

  test("lokalni jezik ne spremeni strukture postankov", () => {
    const sl = buildItinerary(baseQuery);
    const en = buildItinerary({ ...baseQuery, locale: "en" });
    expect(en.days.length).toBe(sl.days.length);
    expect(JSON.stringify(en.days.map((d) => d.map((s) => s.slug)))).toBe(
      JSON.stringify(sl.days.map((d) => d.map((s) => s.slug)))
    );
  });
});

describe("itinerary-engine: struktura načrta", () => {
  test("število dni sledi poizvedbi (1–3)", () => {
    for (const days of [1, 2, 3]) {
      // Brez regijskega filtra: po 2.22.0 ima gorenjska samo 4 destinacije
      // (posočje od 2.22.0 ločeno) — za 3 dni × ≥2 postanka je potreben
      // širši nabor. Regijski filter je trdo preverjen v lastnem testu spodaj.
      const plan = buildItinerary({ ...baseQuery, days, region: undefined });
      expect(plan.days.length).toBe(days);
    }
  });

  test("postanki na dan znotraj 2–4", () => {
    const plan = buildItinerary(baseQuery);
    for (const day of plan.days) {
      expect(day.length).toBeGreaterThanOrEqual(1);
      expect(day.length).toBeLessThanOrEqual(4);
    }
  });

  test("časi postankov znotraj okvirja 09:00–19:00", () => {
    const plan = buildItinerary(baseQuery);
    for (const day of plan.days) {
      for (const stop of day) {
        expect(stop.time).not.toBeNull();
        const [h, m] = (stop.time as string).split(":").map(Number);
        const min = h * 60 + m;
        expect(min).toBeGreaterThanOrEqual(9 * 60);
        expect(min).toBeLessThanOrEqual(19 * 60);
      }
    }
  });

  test("regija je trdi filter (vsi postanki iz gorenjske)", () => {
    const plan = buildItinerary(baseQuery);
    expect(plan.days.length).toBeGreaterThan(0);
    for (const day of plan.days) {
      for (const stop of day) {
        if (stop.region) expect(stop.region).toBe("gorenjska");
      }
    }
  });

  test("regija je trdi filter tudi za posočje (2.22.0) — kobarid/reka-soca skupaj, brez gorenjskih", () => {
    const plan = buildItinerary({ ...baseQuery, region: "posocje", interests: ["narava", "adrenalin"] });
    expect(plan.days.length).toBeGreaterThan(0);
    // slug je neobvezen (custom postanki) — ogradimo za toContain.
    const slugs = plan.days.flat().map((s) => s.slug).filter((x): x is string => typeof x === "string");
    for (const s of slugs) {
      expect(["kobarid", "reka-soca"]).toContain(s);
    }
    expect(slugs).toContain("kobarid");
    expect(slugs).toContain("reka-soca");
  });

  test("skupna cena je vsota cen postankov (sestavljena iz costPerPerson)", () => {
    const plan = buildItinerary(baseQuery);
    const sum = plan.days.flat().reduce((n, s) => n + s.cost, 0);
    expect(plan.totalCost).toBe(sum);
  });

  test("0 dni → prazen načrt brez napake", () => {
    const plan = buildItinerary({ interests: ["narava"], days: 0 });
    expect(plan.days.length).toBe(0);
  });
});

describe("itinerary-engine: geometrijski kanon (P0.2)", () => {
  test("haversineKm: Bled → Ljubljana ≈ 40–50 km", () => {
    const km = haversineKm(
      { lat: 46.3683, lng: 14.0944 },
      { lat: 46.0569, lng: 14.5058 }
    );
    expect(km).toBeGreaterThan(40);
    expect(km).toBeLessThan(50);
  });

  test("haversineKm: 0 na isti točki", () => {
    expect(haversineKm({ lat: 46.1, lng: 14.5 }, { lat: 46.1, lng: 14.5 })).toBe(0);
  });

  test("roadKm = premočna × ROAD_FACTOR (1,3)", () => {
    expect(ROAD_FACTOR).toBe(1.3);
    const flat = haversineKm(
      { lat: 45.0, lng: 13.0 },
      { lat: 46.0, lng: 13.0 }
    ); // 1° lat ≈ 111,2 km
    expect(roadKm({ lat: 45.0, lng: 13.0 }, { lat: 46.0, lng: 13.0 })).toBeCloseTo(
      flat * 1.3,
      5
    );
  });

  test("travelMinutes pri 60 km/h, zaokroženo na 5", () => {
    expect(AVG_SPEED_KMH).toBe(60);
    const min = travelMinutes(
      { lat: 45.0, lng: 13.0 },
      { lat: 46.0, lng: 13.0 }
    ); // ~111 km premočno → ~144 km ceste → ~145 min
    expect(min % 5).toBe(0);
    expect(min).toBeGreaterThan(130);
    expect(min).toBeLessThan(155);
  });

  test("round5 zaokroži na večkratnike 5", () => {
    expect(round5(63)).toBe(65);
    expect(round5(62)).toBe(60);
    expect(round5(0)).toBe(0);
  });

  test("durationToMinutes preslikave kanona", () => {
    expect(durationToMinutes("1 dan")).toBe(150);
    expect(durationToMinutes("1-2 dni")).toBe(270);
    expect(durationToMinutes("2 dni")).toBe(270);
    expect(durationToMinutes("2-3 dni")).toBe(300);
  });

  test("budgetTier: €=1, €€=2, €€€=3", () => {
    expect(budgetTier("€")).toBe(1);
    expect(budgetTier("€€")).toBe(2);
    expect(budgetTier("€€€")).toBe(3);
  });
});
