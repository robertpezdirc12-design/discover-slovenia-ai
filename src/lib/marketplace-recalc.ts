/**
 * MARKETPLACE-RECALC — dnevno usklajevanje shranjenih statusov izplačil
 * (P0-I, issue #1 §21 „recalculate-status" — obnovljen relevanten job).
 * ============================================================================
 * Problem, ki ga job rešuje: `payoutStatus` na naročilu se izpeljuje ob
 * branju (derivePayoutStatus — MarketplaceTypes), SHRANJENA vrednost pa
 * ostane „not_due", dokler je kdo ne premakne. Cilj joba: shranjeno stanje
 * USKLADI z izpeljavo (materializacija), tako da so poizvedbe/pregledi
 * konsistentni BREZ ponovnega izračuna ob vsakem branju.
 *
 * Kanoni (issue §21): CRON_SECRET + fail-closed (routa), IDEMPOTENCA
 * (ponovni zagon ne spremeni ničesar — plan je prazen), AUDITABILITY
 * (vsaka sprememba dobi AuditLog „payout.due_materialized"), RETRY SAFETY
 * (prekinjen zagon lahko varno ponovimo — prehodi so pogojni na trenutno
 * stanje) in LEPLJIVOST (processing/paid NIKOLI ne zdrsne nazaj — to velja
 * tudi tu: job premika SAMO not_due → due).
 *
 * ČISTO JEDRO (brez DB — testabilno): planPayoutRecalc vrse naročila, ki
 * potrebujejo materializacijo. Aplikacija (pisanje + AuditLog) živi v routi.
 */

import {
  derivePayoutStatus,
  type PayoutStatus,
} from "@/lib/marketplace-types";

/** Vrstica naročila, ki jo zna prebrati jedro (subset polj Order). */
export interface RecalcOrderInput {
  id: string;
  status: string;
  paidAt: Date | string | null;
  payoutStatus: string;
}

/** Načrtovana materializacija enega naročila. */
export interface PayoutRecalcAction {
  orderId: string;
  from: PayoutStatus;
  to: PayoutStatus;
}

export interface PayoutRecalcReport {
  /** Koliko naročil je bilo pregledanih (vsa plačila v obdelavi). */
  scanned: number;
  /** Koliko naročil potrebuje materializacijo (dolžina plana). */
  planned: number;
  /** Plan — prazna tabela = nič za pisanje (idempotenten zagon). */
  actions: readonly PayoutRecalcAction[];
}

/**
 * Zgradi plan materializacije: za vsako naročilo izračunaj izpeljani status
 * in ga primerjaj s shranjenim. Premeščamo SAMO not_due → due (enina
 * dovoljena samodejna tranzicija — glej ALLOWED_PAYOUT_TRANSITIONS);
 * ročna stanja (processing/paid) in ne-plačana naročila ostanejo pri miru.
 *
 * Determinizem: isti vhod (vključno z now) → isti plan.
 */
export function planPayoutRecalc(
  orders: readonly RecalcOrderInput[],
  now: Date = new Date()
): PayoutRecalcReport {
  const actions: PayoutRecalcAction[] = [];

  for (const order of orders) {
    const derived = derivePayoutStatus({
      orderStatus: order.status,
      paidAt: order.paidAt,
      currentPayout: order.payoutStatus,
      now,
    });

    // Samo materializacija izpeljave „due" nad shranjenim „not_due".
    // Vse ostalo (sticky ročna stanja, ne-plačana, že usklajena) preskoči.
    if (order.payoutStatus === "not_due" && derived === "due") {
      actions.push({ orderId: order.id, from: "not_due", to: "due" });
    }
  }

  return { scanned: orders.length, planned: actions.length, actions };
}

/** Kanonsko dejanje AuditLog zapisa materializacije (dnevniška sledljivost). */
export const PAYOUT_RECALC_AUDIT_ACTION = "payout.due_materialized";
