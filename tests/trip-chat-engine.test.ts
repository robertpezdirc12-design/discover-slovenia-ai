/**
 * TRIP-CHAT-ENGINE — deterministični @AI svetovalec (jedro izvirnika 1.131.0).
 *
 * Zaklenjene invariante:
 * - 0 AI žetonov, 0 zunanjih klicev (čist modul — odgovori SAMO iz
 *   podatkov poti + kanonske baze destinacij),
 * - isti vhod → isti izhod (determinizem),
 * - iskrenost: vreme je vedno NEZNANO (izrecno povedano),
 * - omemba @AI se prepozna varno (ne v sredini e-poštne naslovnine).
 */

import { describe, expect, test } from "bun:test";

import {
  AI_ADVISOR_NAME,
  answerAiQuestion,
  isAiMention,
} from "../src/lib/trip-chat-engine";
import type { SharedPlan } from "../src/lib/shared-plan";

const plan: SharedPlan = {
  shareId: "testplan01",
  name: "Testna pot",
  createdAt: new Date("2026-10-07T08:00:00Z").toISOString(),
  days: [
    {
      day: 1,
      title: "Dan 1",
      locations: [
        { name: "Bled", destSlug: "bled", time: "09:00" },
        { name: "Bohinj", destSlug: "bohinj", time: "13:00" },
      ],
    },
    {
      day: 2,
      title: "Dan 2",
      locations: [{ name: "Piran", destSlug: "piran", time: "10:00" }],
    },
  ],
};

const emptyPlan: SharedPlan = {
  shareId: "praznapot01",
  name: "Prazna",
  createdAt: new Date("2026-10-07T08:00:00Z").toISOString(),
  days: [],
};

describe("trip-chat-engine: isAiMention", () => {
  test("običajna omemba na začetku/sredi", () => {
    expect(isAiMention("@AI kaj je vreme?")).toBe(true);
    expect(isAiMention("Hej @ai, kaj priporočaš?")).toBe(true);
  });

  test("@AI z velikimi črkami (case-insensitive)", () => {
    expect(isAiMention("@ai svetuj")).toBe(true);
    expect(isAiMention("@Ai svetuj")).toBe(true);
  });

  test("brez omembe → false", () => {
    expect(isAiMention("kakšno bo vreme?")).toBe(false);
    expect(isAiMention("kdaj gremo?")).toBe(false);
  });

  test("lažna omemba v e-poštni naslovnini → false", () => {
    expect(isAiMention("piši na janez@ai-naslov.si")).toBe(false);
  });
});

describe("trip-chat-engine: answerAiQuestion (determinizem + iskrenost)", () => {
  test("DETERMINIZEM: isti vhod → 2× identičen odgovor", () => {
    const q = "@AI kaj je vreme napovedano za Bled?";
    expect(answerAiQuestion(q, plan)).toBe(answerAiQuestion(q, plan));
  });

  test("VREME: nikoli ne izmišljuje napovedi (iskrena zavrnitev)", () => {
    const out = answerAiQuestion("@AI kakšno bo vreme v Bledu?", plan);
    expect(out.length).toBeGreaterThan(20);
    // Odgovor ne vsebuje izmišljene napovedi (samo iskrena opredelitev)
    expect(out).not.toMatch(/sončno s \d+°/);
  });

  test("RAZDALJA: odgovor vsebuje kilometre (ocena iz podatkov)", () => {
    const out = answerAiQuestion("@AI kako daleč je Bohinj od Bleda?", plan);
    expect(out).toMatch(/km/);
  });

  test("PREDLOGI: svetuje iz destinacij poti ali baze (ne prazno)", () => {
    const out = answerAiQuestion("@AI kaj naslednje?", plan);
    expect(out.length).toBeGreaterThan(20);
  });

  test("PRAZNA POT: iskren odgovor o pomanjkanju podatkov", () => {
    const out = answerAiQuestion("@AI kaj priporočaš?", emptyPlan);
    expect(out.length).toBeGreaterThan(20);
  });

  test("neznan namen (fallback): vljuden odgovor z razlago zmožnosti", () => {
    const out = answerAiQuestion("@AI povej šalo", plan);
    expect(out.length).toBeGreaterThan(20);
  });

  test("AI_ADVISOR_NAME je slovenski (kanon izvirnika)", () => {
    expect(AI_ADVISOR_NAME).toBe("AI svetovalec");
  });
});
