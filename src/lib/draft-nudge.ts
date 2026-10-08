/**
 * DRAFT-NUDGE — dnevni spominski namigi za zamujeno predajo partnerjevih
 * osnutkov
 * (P0-I, issue #1 §21 „draft-reminders" — obnovljen relevanten job).
 * ============================================================================
 * Iskrenostni kanon (P0-H je uvedel statusni stroj: partner sam NIKOLI ne
 * objavi — osnutek miruje, dokler ga partner ne preda v pregled). Zamujen
 * osnutek pomeni neprihajajoč prihodek za partnerja, zato ga nežno opomnemo.
 *
 * KANONI (issue §21):
 *  - BREZ LAŽNE E-POŠTE: aplikacija nima poštnega strežnika (P0-H
 *    konzultacija to že odkrito razlaga — „e-pošte ne pošiljamo"). Nudge je
 *    VIDEN v portalu /partner (amber opomba) + zabeležen v AuditLog — nič
 *    se ne pretvarja, da je bilo poslano;
 *  - IDEMPOTENCA: en osnutek dobi NAJVEČ en nudge na NUDGE_INTERVAL_DAYS
 *    (7 dni) — dedup po AuditLog zapisih (entiteta + dejanje + čas);
 *  - AUDITABILITY: vsak nudge zapiše AuditLog „partner.draft_nudge" z
 *    starostjo osnutka (brez skrivnosti);
 *  - RETRY SAFETY: prekinjen zagon lahko varno ponovimo — že zabeležen
 *    nudge v oknu zavre ponovnega.
 *
 * ČISTO JEDRO (brez DB — testabilno): planDraftNudges sprejme osnutke in
 * datume zadnjih nudgeov ter vrne plan. Aplikacija živi v cron routi.
 */

/** Starost osnutka (dni), po kateri prvič opomnemo. */
export const DRAFT_NUDGE_AFTER_DAYS = 7;

/** Najmanjši razmik med dvema nudgeoma istega osnutka (dni). */
export const DRAFT_NUDGE_INTERVAL_DAYS = 7;

/** Kanonsko dejanje AuditLog zapisa nudgea. */
export const DRAFT_NUDGE_AUDIT_ACTION = "partner.draft_nudge";

/** Osnutek, ki ga zna prebrati jedro (subset polj Product). */
export interface DraftNudgeInput {
  id: string;
  /** Naziv osnutka (za dnevnik — sanitizira ga guard pri izpisu). */
  name: string;
  status: string;
  /** Zadnjič dotaknjeno (osnova za starost). */
  updatedAt: Date | string;
  /** Lastnik-partner (za dnevniško sledljivost). */
  ownerId: string | null;
}

/** Načrtovani nudge enega osnutka. */
export interface DraftNudgeAction {
  productId: string;
  ownerId: string | null;
  /** Starost osnutka v dnevih (celo število, za dnevnik). */
  ageDays: number;
}

export interface DraftNudgeReport {
  /** Pregledanih osnutkov skupno. */
  scanned: number;
  /** Koliko osnutkov je v planu (dolžina actions). */
  planned: number;
  actions: readonly DraftNudgeAction[];
}

/** Dni od datuma do zdaj (zaokroženo navzdol; negativno → 0). */
export function daysSince(
  at: Date | string,
  now: Date = new Date()
): number {
  const ms = at instanceof Date ? at.getTime() : Date.parse(at);
  if (!Number.isFinite(ms)) return 0;
  const days = Math.floor((now.getTime() - ms) / 86_400_000);
  return days > 0 ? days : 0;
}

/**
 * Zgradi plan nudgeov:
 *  - SAMO status „draft" (pending/published/rejected niso zamudne naloge
 *    partnerja — pregled je pri skrbniku, ne pri partnerju);
 *  - starost ≥ DRAFT_NUDGE_AFTER_DAYS (od updatedAt);
 *  - brez že zabeleženega nudgea za TA osnutek v zadnjih
 *    DRAFT_NUDGE_INTERVAL_DAYS dnevih (dedup).
 *
 * Determinizem: isti vhod (vključno z now) → isti plan.
 */
export function planDraftNudges(
  drafts: readonly DraftNudgeInput[],
  recentNudgeAt: ReadonlyMap<string, Date | string | null>,
  now: Date = new Date()
): DraftNudgeReport {
  const actions: DraftNudgeAction[] = [];

  for (const draft of drafts) {
    if (draft.status !== "draft") continue;

    // Platformski vnosi (brez lastnika) niso predmet opombe — so
    // uredniško pregledani (isti pogoj kot cron WHERE ownerId NOT NULL).
    if (draft.ownerId == null) continue;

    const ageDays = daysSince(draft.updatedAt, now);
    if (ageDays < DRAFT_NUDGE_AFTER_DAYS) continue;

    // Dedup: nudge v zadnjem intervalu zavre ponovitev.
    const lastNudge = recentNudgeAt.get(draft.id) ?? null;
    if (lastNudge != null) {
      const sinceNudge = daysSince(lastNudge, now);
      if (sinceNudge < DRAFT_NUDGE_INTERVAL_DAYS) continue;
    }

    actions.push({
      productId: draft.id,
      ownerId: draft.ownerId,
      ageDays,
    });
  }

  return { scanned: drafts.length, planned: actions.length, actions };
}
