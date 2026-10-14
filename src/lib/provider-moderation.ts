/**
 * PROVIDER-MODERATION — čista prehodna logika ponudniških statusov (#35 faza 4b).
 *
 * Enak kanon kot listing-moderation.ts: brez DB/omrežja, testno zaklenjeno.
 * Kanoni #35:
 *  · Ponudnik NIKOLI ne objavi sam — vsak prehod iz "draft" opravi skrbnik
 *    (§6c.3 moderacija); partnerbooking mode ostane "none" do pisne odobritve.
 *  · "verify" je SAMO skrbniško dejanje po dokazih (§6c.1–2) — postavi
 *    verifiedAt na trenutni čas (12-mesečni potek §6c.6 že računa
 *    verificationState iz provider-model).
 *  · Vsi prehodi so zabeleženi v AuditLog (actorType "owner").
 */

import {
  PROVIDER_STATUSES,
  type ProviderStatus,
} from "@/lib/provider-model";

/** Kanonska skrbniška dejanja na profilu ponudnika (faza 4b admin UI). */
export const PROVIDER_ACTIONS = ["publish", "unpublish", "suspend", "verify"] as const;
export type ProviderAction = (typeof PROVIDER_ACTIONS)[number];

export function isProviderAction(value: unknown): value is ProviderAction {
  return PROVIDER_ACTIONS.includes(value as ProviderAction);
}

/** Javna skrbniška dejanja na prijavi napake (§6c.4). */
export const PROVIDER_REPORT_ACTIONS = ["resolve", "dismiss"] as const;
export type ProviderReportAction = (typeof PROVIDER_REPORT_ACTIONS)[number];

export function isProviderReportAction(value: unknown): value is ProviderReportAction {
  return PROVIDER_REPORT_ACTIONS.includes(value as ProviderReportAction);
}

/** Prehodi statusov: od kod (izvorni status) → kam (akcija). */
export const PROVIDER_TRANSITIONS: Readonly<
  Record<ProviderStatus, readonly { action: ProviderAction; to: ProviderStatus }[]>
> = {
  draft: [
    { action: "publish", to: "published" },
    { action: "suspend", to: "suspended" },
  ],
  published: [
    { action: "unpublish", to: "draft" },
    { action: "suspend", to: "suspended" },
  ],
  suspended: [
    { action: "publish", to: "published" },
    { action: "unpublish", to: "draft" },
  ],
};

/** Ciljni status za akcijo iz izvornega statusa; null, če prehod ni dovoljen. */
export function providerStatusAfter(from: ProviderStatus, action: ProviderAction): ProviderStatus | null {
  if (action === "verify") return from; // verify NE spreminja statusa
  const hit = PROVIDER_TRANSITIONS[from].find((t) => t.action === action);
  return hit ? hit.to : null;
}

/** Ali sme akter izvesti prehod? (faza 4b: samo skrbnik) */
export function canActorTransitionProvider(
  from: ProviderStatus,
  action: ProviderAction,
  actor: "admin"
): boolean {
  return actor === "admin" && providerStatusAfter(from, action) !== null;
}

/** AuditLog dejanje za prehod (kanon "entity.verb"). */
export function providerAuditAction(from: ProviderStatus, action: ProviderAction): string {
  return `provider.${action}`;
}

/** Status je veljaven kanon? (varovalka pred tujki v bazi) */
export function isProviderStatus(value: unknown): value is ProviderStatus {
  return PROVIDER_STATUSES.includes(value as ProviderStatus);
}
