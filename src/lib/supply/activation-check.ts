/**
 * ACTIVATION-CHECK — mehanska preslikava matrika → 4 stanja (P0-B).
 *
 * RECOVER: naslednik src/lib/supply/activation-check.ts izvirnika
 * (izgubljen ob varnostnem incidentu 2026-10-06). Vrstni red izpeljka
 * je TOG in testno zaklenjen — stanja NIKOLI niso zapisana ročno,
 * dokumentacija jih izpisuje IZKLJUČNO iz te funkcije.
 *
 * PRAVILA (mehansko, po vrsti):
 *  1. gate „restore"                    → NOT_CONFIGURED (prvo obnova P0-x)
 *  1b. gate „data"                      → NOT_CONFIGURED (koda obnovljena,
 *                                          čaka podatkovni vir — v naših
 *          rokah: dataset/feed, ne env in ne zunanja odobritev)
 *  2. codeStatus PENDING_RESTORE        → NOT_CONFIGURED (obnova čaka)
 *  3. codeStatus CONTENT_LIVE
 *     + partner-approval/contract       → BLOCKED (zunanja odobritev)
 *  4. codeStatus CONTENT_LIVE (ostalo)  → NOT_CONFIGURED (register/env)
 *  5. codeStatus LIVE + none            → ACTIVE
 *  6. codeStatus LIVE + production-proof→ CONFIGURED (namerno zadržano)
 *  7. codeStatus LIVE + env             → vsi envKeys prisotni ? ACTIVE
 *                                          : NOT_CONFIGURED
 *  8. codeStatus LIVE + partner-approval
 *     ali contract                      → BLOCKED
 *
 * VARNOSTNI KANON (kanarček v testih):
 *  · Env se preverja SAMO po Boolean prisotnosti (neprazen niz).
 *  · Vrednosti env spremenljivk se NIKOLI ne vrnejo v izpisu — izhod
 *    vsebuje izključno boolovske zastavice envPresent.
 *
 * ČISTA LOGIKA: env je VBRIZGAN (parameter) — lib ne bere process.env;
 * to počne samo tanek CLI (scripts/activation-check.ts) ali strežniški
 * sloj ob klicu.
 */

import type { ProviderMatrixEntry } from "./production-matrix";
import {
  PRODUCTION_MATRIX,
  getMatrixEntry,
} from "./production-matrix";
import { getProviderCapabilities } from "./registry";

// ── Štiri kanonska stanja ──────────────────────────────────────────────────

export type ProductionState =
  | "ACTIVE"
  | "CONFIGURED"
  | "NOT_CONFIGURED"
  | "BLOCKED";

export const PRODUCTION_STATE_LABELS: Record<
  ProductionState,
  { sl: string; en: string }
> = {
  ACTIVE: { sl: "Dejansko živo", en: "Actually live" },
  CONFIGURED: { sl: "Konfigurirano (čaka dokaz)", en: "Configured (proof pending)" },
  NOT_CONFIGURED: { sl: "Ni konfigurirano", en: "Not configured" },
  BLOCKED: { sl: "Zunanja ovira", en: "Externally blocked" },
};

/** Env, vbrizgan od klicatelja (lib nikoli ne bere process.env). */
export type EnvLike = Record<string, string | undefined>;

// ── Izpis za enega ponudnika ───────────────────────────────────────────────

export interface ProviderActivation {
  id: string;
  name: string;
  state: ProductionState;
  /** Iskren razlog trenutnega stanja (iz matrike). */
  reasonSl: string;
  /** Koraki do aktivacije (iz matrike). */
  stepsSl: readonly string[];
  /** SAMO Boolean prisotnost env ključev — vrednosti se nikoli ne izpišejo. */
  envPresent: Readonly<Record<string, boolean>>;
}

// ── Mehanika ───────────────────────────────────────────────────────────────

/** Ali je env ključ prisoten (neprazen niz) — edina dovoljena preverba. */
function isEnvKeyPresent(env: EnvLike, key: string): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

/**
 * Mehansko izpelji stanje enega vnosa matrike iz danega env.
 * Čista preslikava — brez omrežja, brez stranskih učinkov.
 */
export function deriveProductionState(
  entry: ProviderMatrixEntry,
  env: EnvLike
): ProductionState {
  // 1. Prvo obnova — nič ni mogoče, dokler sloj ni obnovljen.
  if (entry.gate === "restore") return "NOT_CONFIGURED";

  // 1b. Koda obnovljena, a čaka PODATKOVNI VIR (P0-C: fsq/kiwitaxi) —
  //     pridobitev množice je v naših rokah (dump/feed), torej
  //     NOT_CONFIGURED, ne BLOCKED (ni zunanje ovire) in ne ACTIVE
  //     (brez podatkov sloj ne deluje).
  if (entry.gate === "data") return "NOT_CONFIGURED";

  // 2. Obnova načrtovana (P0-C/P0-D).
  if (entry.codeStatus === "PENDING_RESTORE") return "NOT_CONFIGURED";

  // 3.–4. Vsebina živa, providerska plast čaka.
  if (entry.codeStatus === "CONTENT_LIVE") {
    if (entry.gate === "partner-approval" || entry.gate === "contract") {
      return "BLOCKED";
    }
    return "NOT_CONFIGURED";
  }

  // 5.–8. Koda živa — odloča vrata aktivacije.
  // („restore" je že pokrito s pravilom 1 zgoraj — zato je tu tip že
  //  zožen na preostala vrata.)
  switch (entry.gate) {
    case "none":
      return "ACTIVE";
    case "production-proof":
      return "CONFIGURED";
    case "env": {
      const allPresent =
        entry.envKeys.length > 0 &&
        entry.envKeys.every((k) => isEnvKeyPresent(env, k));
      return allPresent ? "ACTIVE" : "NOT_CONFIGURED";
    }
    case "partner-approval":
    case "contract":
      return "BLOCKED";
  }
}

/** Preveri enega ponudnika (vnos matrike + zmožnosti + env zastavice). */
export function checkProvider(
  entry: ProviderMatrixEntry,
  env: EnvLike = {}
): ProviderActivation {
  const caps = getProviderCapabilities(entry.id);
  const envPresent: Record<string, boolean> = {};
  for (const k of entry.envKeys) {
    envPresent[k] = isEnvKeyPresent(env, k);
  }
  return {
    id: entry.id,
    name: caps?.name ?? entry.id,
    state: deriveProductionState(entry, env),
    reasonSl: entry.reasonSl,
    stepsSl: entry.stepsSl,
    envPresent,
  };
}

// ── Poročilo ───────────────────────────────────────────────────────────────

export interface ActivationReport {
  rows: readonly ProviderActivation[];
  /** Števci po stanju (vedno vsa štiri, tudi z 0). */
  counts: Record<ProductionState, number>;
}

/** Preveri vse ponudnike iz danega env (deterministično). */
export function checkAllProviders(env: EnvLike = {}): ActivationReport {
  const rows = PRODUCTION_MATRIX.map((e) => checkProvider(e, env));
  const counts: Record<ProductionState, number> = {
    ACTIVE: 0,
    CONFIGURED: 0,
    NOT_CONFIGURED: 0,
    BLOCKED: 0,
  };
  for (const r of rows) counts[r.state] += 1;
  return { rows, counts };
}

/** Stanje enega ponudnika po id (undefined za neznane — nikoli izjema). */
export function checkProviderById(
  id: string,
  env: EnvLike = {}
): ProviderActivation | undefined {
  const entry = getMatrixEntry(id);
  if (!entry) return undefined;
  return checkProvider(entry, env);
}
