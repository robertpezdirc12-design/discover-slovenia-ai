/**
 * SYSTEM_DATA_GUARD — zaščita pred vnosi zunanjih/nezanesljivih podatkov
 * (P0-I, issue #1 §23 „SYSTEM_DATA_GUARD/prompt-injection zaščita").
 * ============================================================================
 * Grožnje, ki jih ta plast pokriva (Aplikacija je 0-AI — 0 žetonov, 0
 * zunanjih LLM klicev — zato je tveganje NEIZVAJANJE ukazov, ne izvajanje;
 * vendar guard prepreči, da bi tuji nizi PREOBLIKOVALI deterministične
 * odgovore ali onesnažili prikaz):
 *
 *  1. NADZORNI ZNAKI (C0/C1) + prikazne prevare: zero-width (U+200B–200D,
 *     U+2060, U+FEFF) in bidi override (U+202A–202E, U+2066–2069) —
 *     „trojanski vir" vidnega besedila; v odgovorih so ODSTRANJENI;
 *  2. NEDOLOČENA DOLŽINA: imena/oznake iz zunanjih virov so omejena
 *     (maxLen) — tisoč-znakovna imena POI ne morejo zasesti odgovora/prikaza;
 *  3. VZORCI NAVODIL ZA AI („ignore previous instructions", …): zaznani v
 *     SL in EN — deterministični odgovarjalč (@AI svetovalec) takega
 *     sporočila NE izvede in NE odmeva, ampak odkrito pove, da ne izvaja
 *     ukazov (glej trip-chat-engine.ts);
 *  4. FAIL-CLOSED: ne-niz (undefined/number/…) ali niz, ki po čiščenju
 *     ostane prazen, se zamenja z varnim nadomestkom (fallback) — nikoli
 *     ne posredujemo naprej neznanega tipa.
 *
 * Kanon iskrenosti: guard NE prikriva — odstranjuje le tehnične onesnaževalce
 * in odkrito javlja poskuse navodil. Vsebuje 0 skrivnosti, čiste funkcije.
 */

/** Privzeta največja dolžina sanitiziranega besedila (znaki, ne bajti). */
export const GUARD_DEFAULT_MAX_LEN = 300;

/** Daljša meja za odstavke (opisi, vprašanja — ne imena). */
export const GUARD_LONG_MAX_LEN = 2000;

/** Nadomestilo, ko po čiščenju ni ostalo nič uporabnega. */
export const GUARD_FALLBACK = "";

/**
 * Kategorije znakov, ki se ODSTRANIJO iz nezanesljivega besedila:
 *  - C0 nadzorni znaki (razen \n \t — besedilu smeta, strukturi ne) in DEL (U+007F);
 *  - C1 nadzorni znaki (U+0080–U+009F);
 *  - zero-width ločila (U+200B–U+200D, U+2060, U+FEFF) — nevidni vmešalci;
 *  - bidi nadzorni znaki (U+202A–U+202E, U+2066–U+2069) — prevare s smerjo
 *    besedila (omogočajo, da vidno besedilo ni enako logičnemu).
 */
const INVISIBLE_OR_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0080-\u009F\u200B-\u200D\u2060\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export interface GuardOptions {
  /** Največja dolžina (znaki). null = brez omejitve (za dolga besedila). */
  maxLen?: number | null;
  /** Nadomestilo, če po čiščenju ni ostalo nič (privzeto ""). */
  fallback?: string;
  /** Strni zaporedja presledkov v enega (privzeto true). */
  collapseWhitespace?: boolean;
}

/**
 * Sanitiziraj nezanesljiv niz za varen izpis/vstavitev v deterministične
 * predloge: odstrani nevidne/nadzorne znake, po potrebi strni presledke in
 * skrči na maxLen. ČISTO (brez omrežja/DB) in fail-closed:
 *  - ne-niz → fallback;
 *  - prazno po čiščenju → fallback.
 *
 * ISTI VHOD → ISTI IZHOD (determinizem).
 */
export function sanitizeUntrustedText(
  input: unknown,
  opts: GuardOptions = {}
): string {
  const {
    maxLen = GUARD_DEFAULT_MAX_LEN,
    fallback = GUARD_FALLBACK,
    collapseWhitespace = true,
  } = opts;

  if (typeof input !== "string") return fallback;

  let out = input.replace(INVISIBLE_OR_CONTROL, "");
  if (collapseWhitespace) {
    // Zaporedja belih znakov (vključno s tabelatorji/novimi vrsticami iz
    // zunanji virov) strnemo — enovrstična imena ostanejo enovrstična.
    out = out.replace(/\s+/g, " ").trim();
  } else {
    out = out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  if (out.length === 0) return fallback;
  if (typeof maxLen === "number" && out.length > maxLen) {
    out = out.slice(0, maxLen);
  }
  return out;
}

/**
 * Vzorci poskusov NAVODIL ZA AI v nezanesljivem besedilu (SL + EN).
 * Zaznavanje je NAMERNO ozko (napake prve vrste so sprejemljive — lažni
 * pozitiv v podatku ne škodi, ker se odgovor vseeno gradi iz lastnega
 * registra; zamujen poskus pa bi lahko preoblikoval odgovor).
 */
const INJECTION_PATTERNS: readonly { id: string; re: RegExp }[] = [
  { id: "ignore-previous", re: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i },
  { id: "ignoriraj-prejsnja", re: /ignorira(j|jmo)?\s+(vsa\s+)?(prej(š|s)nja|predhodna|zgornja)\s+(navodila|pravila)/i },
  { id: "disregard", re: /disregard\s+((all\s+)?(the\s+)?(instructions?|rules?|context))/i },
  { id: "system-prompt", re: /(system\s+prompt|sistemsk[ao]\s+(poziv|navodil))/i },
  { id: "you-are-now", re: /you\s+are\s+now\s+(a|an|the)\b/i },
  { id: "zdaj-si", re: /zdaj\s+si\s+(ti\s+)?(nov|druge[nn]|drugačen)/i },
  { id: "role-switch", re: /\b(ADMIN|DEVELOPER|SYSTEM)\s*:/i },
  { id: "override", re: /override\s+(all\s+)?(instructions?|rules?|safety)/i },
];

export interface InjectionCheck {
  /** Ali je bil zaznan znan vzorec poskusa navodil? */
  hit: boolean;
  /** Identifikator prvega zadetega vzorca (identifikator za dnevnik/prikaz). */
  patternId: string | null;
}

/**
 * Preveri, ali besedilo vsebuje znane vzorce poskusov navodil za AI.
 * ČISTO in hitro — uporabno pred shranjevanjem in pred odgovarjanjem.
 * Vrne {hit, patternId}; nikoli ne vrača ujete vsebine (ne odmevamo).
 */
export function detectPromptInjection(text: unknown): InjectionCheck {
  if (typeof text !== "string" || text.length === 0) {
    return { hit: false, patternId: null };
  }
  for (const p of INJECTION_PATTERNS) {
    if (p.re.test(text)) {
      return { hit: true, patternId: p.id };
    }
  }
  return { hit: false, patternId: null };
}

/**
 * Kratek, iskren oznakovani izpis za odgovarjalča: nezanesljivi niz se v
 * odgovoru pojavi jasno ločen kot PODATEK (ne kot del navodila). React
 * že ščiti pred XSS — to ločilo je za človeškega bralca in za dnevniško
 * sledljivost.
 */
export function guardDataLabel(label: string, value: string): string {
  const cleanLabel = sanitizeUntrustedText(label, { maxLen: 40, fallback: "podatek" });
  const cleanValue = sanitizeUntrustedText(value, { maxLen: GUARD_DEFAULT_MAX_LEN });
  return `${cleanLabel}: „${cleanValue}"`;
}
