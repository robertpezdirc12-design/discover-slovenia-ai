import { llmChat, type LlmCompletionResult } from "@/lib/ai/client";
import { ADVISOR_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  buildAdvisorContext,
  questionIsInjection,
  type AdvisorContextDeps,
  type ReservationRow,
} from "@/lib/ai/context";
import { sanitizeUntrustedText } from "@/lib/system-data-guard";
import type { SharedPlan } from "@/lib/shared-plan";

/**
 * AI ADVISOR — utemeljeni @AI odgovor (P1/AI, 2.24.0).
 *
 * Nadgradnja trip-chat-engine (ki ostaja kot deterministična OMEGA pot):
 *  1. vprašanje + kanonski kontekst (register + STO + vreme + pot) → LLM;
 *  2. PRAVILA v sistemskem pozivu: odgovor SAMO iz podatkov, manjkajoči
 *     podatek = iskreno "ne vem", viri na koncu;
 *  3. FAIL-CLOSED: injekcija, izklopljen LLM, timeout, prazen odgovor,
 *     predolg odgovor → vrača null in klicatelj (messages route) uporabi
 *     DETERMINISTIČNI answerAiQuestion — obnašanje identično 2.23.0.
 *
 * 0 zasebnosti kompromisov: osebni spomin/profil NAMENOMA ni v kontekstu
 * (kanon P1-A §11 — sodelavci v skupinskem klepetu ne vidijo zasebnih
 * podatkov); pošiljamo samo pot + rezervacije + javne kanonske vire.
 */

export interface GroundedAnswer {
  body: string;
  sources: string[];
}

export interface AdvisorDeps {
  complete?: (messages: Parameters<typeof llmChat>[0]) => Promise<LlmCompletionResult>;
  context?: AdvisorContextDeps;
}

const MAX_ANSWER_CHARS = 1_500;

/** Ali odgovor vsebuje vrstico virov? (provenance v besedilu) */
function hasSourcesLine(text: string): boolean {
  return /(^|\n)viri?:/i.test(text);
}

/**
 * Utemeljeni odgovor ali null (fail-closed → deterministična pot).
 * Vrača NIKOLI izjem — vse napake so "null".
 */
export async function answerAiGrounded(
  question: string,
  plan: SharedPlan | null,
  opts?: { reservations?: ReservationRow[]; deps?: AdvisorDeps }
): Promise<GroundedAnswer | null> {
  // Prompt injekcija → NE kličemo LLM (deterministični stroj že vrne
  // varnostni odgovor AI_GUARD_ANSWER).
  if (questionIsInjection(question)) return null;

  const cleanQuestion = sanitizeUntrustedText(question, { maxLen: 600 });
  if (cleanQuestion.length < 2) return null;

  const complete = opts?.deps?.complete ?? llmChat;

  const ctx = await buildAdvisorContext(cleanQuestion, plan, {
    reservations: opts?.reservations,
    deps: opts?.deps?.context,
  });

  const dataBlock =
    ctx.blocks.length > 0
      ? `\n<podatki>\n${ctx.blocks.join("\n\n")}\n</podatki>`
      : "\n<podatki>\n(za to vprašanje ni razpoložljivih dodatnih podatkov)\n</podatki>";

  const result = await complete([
    { role: "system", content: ADVISOR_SYSTEM_PROMPT + dataBlock },
    { role: "user", content: cleanQuestion },
  ]);
  if (!result.ok) return null;

  let body = result.text.slice(0, MAX_ANSWER_CHARS).trim();
  if (body.length === 0) return null;

  // Provenance zagotovljena: če model ni zapisal virov, jih dodamo sami
  // (kanon: odgovor brez virov je nepopoln).
  if (!hasSourcesLine(body) && ctx.sources.length > 0) {
    body += `\n\nViri: ${ctx.sources.join(", ")}.`;
  }
  if (!hasSourcesLine(body)) {
    body += "\n\nViri: kanon destinacij Discover Slovenia AI.";
  }

  return { body, sources: ctx.sources };
}
