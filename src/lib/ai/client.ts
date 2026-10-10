import ZAI from "z-ai-web-dev-sdk";

/**
 * AI CLIENT — tanka strežniška ovojnica nad z-ai-web-dev-sdk (P1/AI, 2.24.0).
 *
 * Kanon iskrenosti ostaja: to NI "pametnejši" prosto-živeči LLM klepet —
 * vsak klic je UTEMELJEN na kanonskih podatkih (glej context.ts/prompts.ts)
 * in FAIL-CLOSED: ob KATERI koli napaki (izklopljeno, timeout, prazen
 * odgovor) vrne { ok: false } in klicatelj PADE NA DETERMINISTIČNI stroj
 * (trip-chat-engine / ročni vnosi). Obnašanje brez LLM-ja je IDENTIČNO
 * stanju pred 2.24.0.
 *
 * Konfiguracija (strežniški env, nikoli klient):
 *  - DSA_AI_LLM=1   … feature flag (izklopljen = 0 žetonov, 0 omrežja)
 *  - ZAI_BASE_URL   … endpoint (npr. https://internal-api.z.ai/v1)
 *  - ZAI_API_KEY    … ključ (skrivnost)
 *  - ZAI_TOKEN      … žeton za X-Token glavo (zahteva endpoint — skrivnost)
 *  - ZAI_CHAT_ID / ZAI_USER_ID … izbirni identifikatorja seje
 *
 * SDK se konfigurira prek KONSTRUKTORJA (ZAIConfig) iz env spremenljivk —
 * datoteka .z-ai-config (cwd/home//etc) na serverless (Vercel) ne obstaja.
 * Timeout 8 s drži klic znotraj Hobby meje (10 s) — dolgotrajnejši klic
 * se prekine in pade na deterministično pot.
 */

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCompletionResult {
  ok: boolean;
  text: string;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 8_000;

/** Ali je LLM sloj vklopljen? (env gate — v CI/lokalno privzeto IZKLOPLJEN) */
export function isLlmConfigured(): boolean {
  return (
    process.env.DSA_AI_LLM === "1" &&
    typeof process.env.ZAI_BASE_URL === "string" &&
    process.env.ZAI_BASE_URL.length > 0 &&
    typeof process.env.ZAI_API_KEY === "string" &&
    process.env.ZAI_API_KEY.length > 0
  );
}

/** Izbirni sejni podatki (X-Token zahteva endpoint; chatId/userId izbirna). */
function sessionConfig(): {
  token?: string;
  chatId?: string;
  userId?: string;
} {
  const out: { token?: string; chatId?: string; userId?: string } = {};
  if (typeof process.env.ZAI_TOKEN === "string" && process.env.ZAI_TOKEN) {
    out.token = process.env.ZAI_TOKEN;
  }
  if (typeof process.env.ZAI_CHAT_ID === "string" && process.env.ZAI_CHAT_ID) {
    out.chatId = process.env.ZAI_CHAT_ID;
  }
  if (typeof process.env.ZAI_USER_ID === "string" && process.env.ZAI_USER_ID) {
    out.userId = process.env.ZAI_USER_ID;
  }
  return out;
}

interface SdkChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * SDK konstruktor je v tipih private (avtor želi datotečno konfiguracijo
 * .z-ai-config, ki na serverless — Vercel — ne obstaja). Runtime podpis je
 * povsem enak: new ZAI({ baseUrl, apiKey }). Ozek, dokumentiran cast na
 * enem mestu; uporabljamo IZKLJUČNO SDK-jevo implementacijo klica (glave,
 * endpoint, privzete nastavitve) — samo konfiguracija prihaja iz env.
 */
type ZaiInstance = {
  chat: {
    completions: {
      create: (body: {
        messages: LlmMessage[];
        thinking?: { type: "enabled" | "disabled" };
      }) => Promise<SdkChatCompletionResponse>;
    };
  };
};
const ZaiCtor = ZAI as unknown as new (config: {
  baseUrl: string;
  apiKey: string;
  token?: string;
  chatId?: string;
  userId?: string;
}) => ZaiInstance;

/**
 * Enkraten pogovorni klic. Vrača { ok: true, text } ALI { ok: false, error }
 * — NIKOLI ne meče izjem (fail-closed za vse klicatelje).
 */
export async function llmChat(
  messages: LlmMessage[],
  opts?: { timeoutMs?: number }
): Promise<LlmCompletionResult> {
  if (!isLlmConfigured()) {
    return { ok: false, text: "", error: "llm-not-configured" };
  }
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const zai = new ZaiCtor({
      baseUrl: process.env.ZAI_BASE_URL as string,
      apiKey: process.env.ZAI_API_KEY as string,
      ...sessionConfig(),
    });
    const request = zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    });
    const completion = await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("llm-timeout")), timeoutMs);
      }),
    ]);
    const text = (completion?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return { ok: false, text: "", error: "llm-empty-answer" };
    return { ok: true, text };
  } catch (e) {
    return {
      ok: false,
      text: "",
      error: e instanceof Error ? e.message : "llm-error",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
