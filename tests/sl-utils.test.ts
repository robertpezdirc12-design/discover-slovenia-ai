/**
 * SL-UTILS — slovenske jezikovne oblike (ednina / dvojina / množina),
 * rekonstruirane 1:1 iz izvorne kode izvirnika.
 *
 * Slovenščina: 1 → ednina, 2 → dvojina, 3–4 → priredna množina,
 * 5+ → splošna množina (r = n % 100).
 */

import { describe, expect, test } from "bun:test";

import {
  entriesLabel,
  likesLabel,
  messagesLabel,
  slTimeAgo,
  slUnit,
  votesLabel,
} from "../src/lib/sl-utils";

describe("sl-utils: slUnit (klasične slovenske oblike)", () => {
  test("1 → ednina", () => {
    expect(slUnit(1, "glas", "glasa", "glasi", "glasov")).toBe("glas");
  });

  test("2 → dvojina", () => {
    expect(slUnit(2, "glas", "glasa", "glasi", "glasov")).toBe("glasa");
  });

  test("3 in 4 → priredna množina", () => {
    expect(slUnit(3, "glas", "glasa", "glasi", "glasov")).toBe("glasi");
    expect(slUnit(4, "glas", "glasa", "glasi", "glasov")).toBe("glasi");
  });

  test("5+ → splošna množina", () => {
    expect(slUnit(5, "glas", "glasa", "glasi", "glasov")).toBe("glasov");
    expect(slUnit(17, "glas", "glasa", "glasi", "glasov")).toBe("glasov");
    expect(slUnit(101, "glas", "glasa", "glasi", "glasov")).toBe("glasov");
  });

  test("r = n % 100: 102 → dvojina, 103 → priredna (kanon izvirnika)", () => {
    expect(slUnit(102, "glas", "glasa", "glasi", "glasov")).toBe("glasa");
    expect(slUnit(103, "glas", "glasa", "glasi", "glasov")).toBe("glasi");
    expect(slUnit(104, "glas", "glasa", "glasi", "glasov")).toBe("glasi");
  });
});

describe("sl-utils: slTimeAgo", () => {
  test("neveljaven ISO → neznano (iskrenost kanona)", () => {
    expect(slTimeAgo("smeti")).toBe("neznano");
  });

  test("zapis pred floorIso → absolutni datum (sanity cap)", () => {
    const floor = new Date(Date.now() - 60_000).toISOString();
    const stale = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();
    const out = slTimeAgo(stale, floor);
    // oblika "9. jul. 2026" (toLocaleDateString sl-SI, day/month/year)
    expect(out).toMatch(/^\d{1,2}\.\s*\w+\.\s*\d{4}$/);
  });

  test("zelo svež zapis → pravkar", () => {
    expect(slTimeAgo(new Date(Date.now() - 5_000).toISOString())).toBe("pravkar");
  });

  test("pred 2 minutama → dvojina", () => {
    const two = new Date(Date.now() - 2 * 60_000 - 5_000).toISOString();
    expect(slTimeAgo(two)).toBe("pred 2 minutama");
  });

  test("pred 1 uro → ednina", () => {
    const one = new Date(Date.now() - 61 * 60_000).toISOString();
    expect(slTimeAgo(one)).toBe("pred 1 uro");
  });

  test("pred 3 dnevi → priredna množina", () => {
    const three = new Date(Date.now() - 3 * 24 * 3600_000 - 60_000).toISOString();
    expect(slTimeAgo(three)).toBe("pred 3 dnevi");
  });
});

describe("sl-utils: oznake (komponente izvirnika)", () => {
  test("votesLabel: 0 / 1 / 2 / 5", () => {
    expect(votesLabel(0)).toBe("Ni še glasov");
    expect(votesLabel(1)).toBe("1 glas");
    expect(votesLabel(2)).toBe("2 glasa");
    expect(votesLabel(5)).toBe("5 glasov");
  });

  test("likesLabel: dativne oblike oseb", () => {
    expect(likesLabel(0)).toBe("Ni še všečkov");
    expect(likesLabel(1)).toBe("1 osebi je to potovanje všeč");
    expect(likesLabel(2)).toBe("2 osebama je to potovanje všeč");
    expect(likesLabel(7)).toBe("7 osebam je to potovanje všeč");
  });

  test("entriesLabel: spomini", () => {
    expect(entriesLabel(0)).toBe("še ni spominov");
    expect(entriesLabel(1)).toBe("1 spomin");
    expect(entriesLabel(3)).toBe("3 spomini");
    expect(entriesLabel(6)).toBe("6 spominov");
  });

  test("messagesLabel: sporočila", () => {
    expect(messagesLabel(0)).toBe("Ni sporočil");
    expect(messagesLabel(1)).toBe("1 sporočilo");
    expect(messagesLabel(2)).toBe("2 sporočili");
    expect(messagesLabel(5)).toBe("5 sporočil");
  });
});
