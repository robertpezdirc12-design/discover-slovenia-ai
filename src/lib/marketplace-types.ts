/**
 * MARKETPLACE-TYPES — ŽIVLJENJSKI CIKEL IZPLAČIL LASTNE TRŽNICE
 * (P0-E, issue #1 §11 „marketplace payout + customer state").
 * ============================================================================
 * Rekonstrukcija iz izvirnikovega src/lib/marketplace-types.ts (kanon
 * Task 55/56): payoutStatus not_due → due → processing → paid.
 *
 * Kanoni:
 *  - IZVEDLJIVOST: izplačilo lastniku NI takojšnje — zadrževalna doba
 *    (PAYOUT_RETENTION_DAYS) pokriva obdobje za morebiten zahtevek kupca
 *    po povratilu; po njenem poteku naročilo POSTANE zapadlo (due);
 *  - DETERMINIZEM: „due" se IZPELJE iz stanja naročila (status + paidAt +
 *    now) — ni ročno nastavljivo mimo tranzicije; ročni (skrbniški)
 *    prehodi so SAMO due → processing → paid;
 *  - LEPLJIVOST (sticky): enkrat „processing"/„paid" stanje NIKOLI ne
 *    zdrsne nazaj (niti ob kasnejših prevzetih dogodkih);
 *  - ISKRENOST: zahtevek kupca po preklicu (cancellationRequestedAt) NE
 *    povzroči povratila sam — vidi ga lastnik v skrbniškem pregledu
 *    (povratek teče pri plačilnem ponudniku — Stripe);
 *  - ČISTO: vse funkcije so čiste (brez DB) — client-safe in testabilne;
 *    pisanje AuditLog živi v strežniški plasti (payouts pot).
 * ============================================================================
 */

// ── Statusi izplačila (§11) ────────────────────────────────────────────────

export type PayoutStatus = "not_due" | "due" | "processing" | "paid";

export const PAYOUT_STATUSES: readonly PayoutStatus[] = [
  "not_due",
  "due",
  "processing",
  "paid",
];

/** Ali je niz veljaven status izplačila? (fail-closed) */
export function isPayoutStatus(s: string): s is PayoutStatus {
  return (PAYOUT_STATUSES as readonly string[]).includes(s);
}

/**
 * Zadrževalna doba: koliko dni po plačilu naročilo ŠE NI zapadlo.
 * (Izvirniški vzorec: teden — pokrije okno za zahtevek po povratilu.)
 */
export const PAYOUT_RETENTION_DAYS = 7;

/**
 * Dovoljeni PREHODI statusov izplačila:
 *  - not_due → due      SAMO z izpeljavo (minevanje zadrževalne dobe);
 *  - due     → processing | paid   skrbniška dejanja (lastnik izplačuje);
 *  - processing → paid  skrbniško zaključenje izplačila;
 *  - paid    = terminalen (brez povratkov).
 */
export const ALLOWED_PAYOUT_TRANSITIONS: Readonly<
  Record<PayoutStatus, readonly PayoutStatus[]>
> = {
  not_due: ["due"],
  due: ["processing", "paid"],
  processing: ["paid"],
  paid: [],
};

/** Ali je prehod dovoljen? (neznan status → false, fail-closed) */
export function canTransitionPayout(from: string, to: string): boolean {
  if (!isPayoutStatus(from) || !isPayoutStatus(to)) return false;
  return ALLOWED_PAYOUT_TRANSITIONS[from].includes(to);
}

/** Prehod z izrecno slovensko napako (za API rute in teste). */
export function assertPayoutTransition(
  from: string,
  to: string
): { ok: true } | { ok: false; error: string } {
  if (!isPayoutStatus(from)) {
    return { ok: false, error: `Neznan status izplačila: "${from}".` };
  }
  if (!isPayoutStatus(to)) {
    return { ok: false, error: `Neznan ciljni status izplačila: "${to}".` };
  }
  if (ALLOWED_PAYOUT_TRANSITIONS[from].includes(to)) return { ok: true };
  return { ok: false, error: `Prehod izplačila "${from}" → "${to}" ni dovoljen.` };
}

// ── Izpeljava stanja (determinizem) ────────────────────────────────────────

/** Vhod izpeljave — polja, ki jih pozna resnična vrstica naročila. */
export interface PayoutDeriveInput {
  /** Status naročila: "pending" | "paid" | "cancelled" | "expired". */
  orderStatus: string;
  /** Kdaj je bilo naročilo plačano (Date | ISO niz | null). */
  paidAt: Date | string | null;
  /** Shranjeni (ročno napredovani) status izplačila — izpeljava je lepljiva. */
  currentPayout: string;
  /** Zdaj (injicirano za determinizem v testih; privzeto resnični čas). */
  now?: Date;
  /** Zadrževalna doba v dnevih (privzeto PAYOUT_RETENTION_DAYS). */
  retentionDays?: number;
}

/**
 * Izpelji trenutni status izplačila iz resničnega stanja naročila:
 *  - naročilo ni plačano (pending/expired/cancelled) → not_due
 *    (izplačilo ne zapade NIKOLI — razen če je bilo že v teku/zaključeno);
 *  - plačano + zadrževalna doba ŠE teče → not_due;
 *  - plačano + doba potekla → due;
 *  - processing/paid sta LEPLJIVA (ročno napredovana stanja ne zdrsnejo).
 *
 * Čista funkcija: isti vhod (vključno z now) → isti izhod.
 */
export function derivePayoutStatus(input: PayoutDeriveInput): PayoutStatus {
  const current = isPayoutStatus(input.currentPayout) ? input.currentPayout : "not_due";
  // Lepljivost: enkrat v teku/zaključeno ostane takšno.
  if (current === "processing" || current === "paid") return current;

  if (input.orderStatus !== "paid") return "not_due";
  if (input.paidAt == null) return "not_due"; // plačano brez časovnega žiga — iskreno ne zapade

  const retention = input.retentionDays ?? PAYOUT_RETENTION_DAYS;
  const paidAtMs =
    input.paidAt instanceof Date
      ? input.paidAt.getTime()
      : Date.parse(input.paidAt);
  if (!Number.isFinite(paidAtMs)) return "not_due"; // neberljiv žig → fail-closed
  const nowMs = (input.now ?? new Date()).getTime();
  const elapsedDays = (nowMs - paidAtMs) / 86_400_000;

  return elapsedDays >= retention ? "due" : "not_due";
}

/** Datum zapadlosti: paidAt + zadrževalna doba (za prikaz lastniku). */
export function payoutDueDate(
  paidAt: Date | string,
  retentionDays: number = PAYOUT_RETENTION_DAYS
): Date | null {
  const ms =
    paidAt instanceof Date ? paidAt.getTime() : Date.parse(paidAt);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + retentionDays * 86_400_000);
}

// ── Statusne oznake (SL/EN — enak kanon kot booking.ts) ────────────────────

const PAYOUT_LABELS: Record<PayoutStatus, { sl: string; en: string; it: string; de: string; fr: string; es: string }> = {
  not_due: { sl: "Še ne zapadlo", en: "Not yet due", it: "Non ancora dovuto", de: "Noch nicht fällig", fr: "Pas encore dû", es: "Aún no vencido" },
  due: { sl: "Zapadlo", en: "Due", it: "Dovuto", de: "Fällig", fr: "Dû", es: "Vencido" },
  processing: { sl: "Izplačilo v teku", en: "Payout processing", it: "Pagamento in corso", de: "Auszahlung läuft", fr: "Paiement en cours", es: "Pago en proceso" },
  paid: { sl: "Izplačano", en: "Paid out", it: "Pagato", de: "Ausgezahlt", fr: "Payé", es: "Pagado" },
};

/** Oznaka statusa izplačila za UI (SL privzeto / EN). Neznan → surovo. */
export function payoutStatusLabel(status: string, locale: "sl" | "en" = "sl"): string {
  if (!isPayoutStatus(status)) return status;
  const label = PAYOUT_LABELS[status];
  return locale === "en" ? label.en : label.sl;
}

// ── Zahtevek kupca po preklicu (customer state) ────────────────────────────

/** Preveri, ali kupec LAHKO zaprosi za preklic/povratek tega naročila. */
export function canRequestCancellation(
  order: { status: string; cancellationRequestedAt: Date | string | null }
): { ok: true } | { ok: false; error: string } {
  if (order.cancellationRequestedAt != null) {
    return { ok: false, error: "Zahtevek za preklic je že podan — čaka obravnavo lastnika." };
  }
  if (order.status === "paid") {
    return { ok: true };
  }
  if (order.status === "cancelled") {
    return { ok: false, error: "Naročilo je že preklicano." };
  }
  if (order.status === "expired") {
    return { ok: false, error: "Naročilo je že poteklo — ničesar ni treba preklicati." };
  }
  // pending: plačilo se še ni zgodilo — zahtevek nima smisla.
  return {
    ok: false,
    error: "Naročilo še ni plačano — zahtevek za preklic je mogoč šele po plačilu.",
  };
}
