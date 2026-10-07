/**
 * SHARED-PLAN — oblike deljenih poti (kanon izvirnika: kratki mali znaki).
 * + NORMALIZE-PLAN-INPUT iz trip-auth (strežniško normaliziranje vhoda
 *   pred zapisom v oblak — edina dovoljena pot do zapisane oblike).
 */

import { describe, expect, test } from "bun:test";

import { SHARE_ID_RE } from "../src/lib/shared-plan";
import { normalizePlanInput } from "../src/lib/trip-auth";

describe("shared-plan: SHARE_ID_RE (kanon kratkih malih znakov)", () => {
  test("veljavni: male črke/številke/vezaji, 1–32 znakov", () => {
    expect(SHARE_ID_RE.test("bled")).toBe(true);
    expect(SHARE_ID_RE.test("q09ynm5ctj")).toBe(true);
    expect(SHARE_ID_RE.test("2l3r514m62")).toBe(true);
    expect(SHARE_ID_RE.test("a")).toBe(true);
    expect("a".repeat(32)).toMatch(SHARE_ID_RE);
  });

  test("neveljavni: velike črke, presledki, posebni znaki, predolg", () => {
    expect(SHARE_ID_RE.test("Bled")).toBe(false);
    expect(SHARE_ID_RE.test("moja pot")).toBe(false);
    expect(SHARE_ID_RE.test("pot/do/nekje")).toBe(false);
    expect(SHARE_ID_RE.test("-najprej-vezaj")).toBe(false);
    expect(SHARE_ID_RE.test("a".repeat(33))).toBe(false);
    expect(SHARE_ID_RE.test("")).toBe(false);
  });
});

describe("trip-auth: normalizePlanInput (strežniška normalizacija)", () => {
  test("veljavna pot → JSON podatki + naslov iz imena", () => {
    const out = normalizePlanInput({
      name: "Blejski vikend",
      createdAt: "2026-10-07T08:00:00.000Z",
      days: [
        {
          day: 1,
          title: "Dan 1",
          locations: [{ name: " Bled ", destSlug: "bled", time: "09:00" }],
        },
      ],
    });
    expect(out).not.toBeNull();
    expect(out!.title).toBe("Blejski vikend");
    const parsed = JSON.parse(out!.data);
    expect(parsed.days[0].locations[0].name).toBe("Bled"); // okleščeno
    expect(parsed.days[0].day).toBe(1);
  });

  test("ne-objekt / brez dni / prazni dnevi → null (fail-closed)", () => {
    expect(normalizePlanInput(null)).toBeNull();
    expect(normalizePlanInput("smeti")).toBeNull();
    expect(normalizePlanInput({ days: [] })).toBeNull();
    expect(normalizePlanInput({ days: "ni-tabela" })).toBeNull();
    expect(normalizePlanInput({ days: [null, 42, "x"] })).toBeNull();
  });

  test("lokalni kraji brez destSlug ostanejo veljavni postanki", () => {
    const out = normalizePlanInput({
      days: [{ locations: [{ name: "Zaselok pri vodi" }] }],
    });
    expect(out).not.toBeNull();
    const parsed = JSON.parse(out!.data);
    expect(parsed.days[0].locations[0].name).toBe("Zaselok pri vodi");
    expect(parsed.days[0].locations[0].destSlug).toBeUndefined();
    expect(parsed.days[0].locations[0].time).toBeNull();
  });

  test("dnevi brez številke dobijo zaporedno številko", () => {
    const out = normalizePlanInput({
      days: [{ locations: [{ name: "A" }] }, { locations: [{ name: "B" }] }],
    });
    const parsed = JSON.parse(out!.data);
    expect(parsed.days[0].day).toBe(1);
    expect(parsed.days[1].day).toBe(2);
  });

  test("prazna imena postankov se tiho izpustijo (sanity)", () => {
    const out = normalizePlanInput({
      days: [{ locations: [{ name: "   " }, { name: "Veljaven" }] }],
    });
    const parsed = JSON.parse(out!.data);
    expect(parsed.days[0].locations.length).toBe(1);
    expect(parsed.days[0].locations[0].name).toBe("Veljaven");
  });

  test("ime/podatki se okleščijo na varne meje (caps proti zlorabi)", () => {
    const longName = "x".repeat(500);
    const out = normalizePlanInput({
      name: longName,
      days: [{ locations: [{ name: longName, destSlug: "y".repeat(200) }] }],
    });
    const parsed = JSON.parse(out!.data);
    expect(out!.title!.length).toBeLessThanOrEqual(120);
    expect(parsed.days[0].locations[0].name.length).toBeLessThanOrEqual(200);
    expect(parsed.days[0].locations[0].destSlug.length).toBeLessThanOrEqual(80);
  });
});
