/**
 * USER-PREFERENCES-SERVER — P1-A strežniška plast (issue #3 §1/§2/§11).
 * ============================================================================
 * Načela:
 *  - AGENTSKA POT (getPersonalContext): fail-closed — personalizacija
 *    IZKLOPLJENA → spomin se SPOLOH NE bere (vrne prazen kontekst).
 *    To je edini vhod za osebnega agenta (P1-B) — skupinski klepet itd.
 *    NIKOLI ne sme klicati te funkcije v kontekstu, kjer bi tuji
 *    sodelujoči videli zasebne podatke.
 *  - UPRAVNAJALNA POT (API rute + /moj-profil): lastnik VEDNO vidi in
 *    ureja SVOJE podatke (pravica dostopa/popravljanja/izbrisa) — tudi ko
 *    je personalizacija izklopljena; zbiranje novih zapisov (POST) je
 *    takrat pošteno zavrnjeno.
 *  - 0-AI: brez LLM/omrežja; samo Prisma + čiste preslikave.
 */

import { db } from "@/lib/db";
import {
  buildPersonalProfile,
  isPersonalizationOff,
  MEMORY_LIST_LIMIT,
  planMemoryPurge,
  sortMemoriesForList,
  PERSONAL_AUDIT_ACTIONS,
  type PersonalProfile,
  type MemorySource,
  memoryConfidenceForSource,
} from "@/lib/user-preferences";

export interface MemoryView {
  id: string;
  kind: string;
  value: string;
  source: string;
  confidence: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalContext {
  /** Ali agent sme uporabljati osebne podatke (personalizacija ON). */
  enabled: boolean;
  profile: PersonalProfile;
  /** Bounded, determinističen izsek spomina (prazen, kadar enabled=false). */
  memories: MemoryView[];
}

function toMemoryView(row: {
  id: string;
  kind: string;
  value: string;
  source: string;
  confidence: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): MemoryView {
  return {
    id: row.id,
    kind: row.kind,
    value: row.value,
    source: row.source,
    confidence: row.confidence,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Preberi vse preference uporabnika (upravaljalna pot — lastnik vidi vse). */
export async function readUserPreferences(userId: string) {
  return db.userPreference.findMany({ where: { userId } });
}

/**
 * AGENTSKA POT: enoten osebni kontekst (profile + bounded spomin).
 * Personalizacija IZKLOPLJENA → { enabled:false, prazen profil, PRAZEN
 * spomin } — spomin se sploh ne bere iz baze (fail-closed).
 */
export async function getPersonalContext(userId: string): Promise<PersonalContext> {
  const prefRows = await db.userPreference.findMany({ where: { userId } });
  const profile = buildPersonalProfile(prefRows);
  if (!profile.enabled) {
    return { enabled: false, profile, memories: [] };
  }
  const rows = await db.memoryItem.findMany({
    where: { userId, active: true },
    take: MEMORY_LIST_LIMIT + 20, // blazina pred sortom ( updatedAt iz DB ni nujno enoličen)
  });
  const memories = sortMemoriesForList(rows)
    .slice(0, MEMORY_LIST_LIMIT)
    .map(toMemoryView);
  return { enabled: true, profile, memories };
}

/**
 * Lenko zadrževalno čiščenje (retention): fizično izbriši mehko izbrisane
 * zapise (active=false), starejše od meje. Vrne število pobrisanih
 * (0 = ničesar ni bilo treba — idempotentno). Kliče se ob upravaljalnem
 * branju spomina (GET /api/memory).
 */
export async function purgeExpiredMemories(userId: string, now: Date): Promise<number> {
  const { cutoff } = planMemoryPurge(now);
  const result = await db.memoryItem.deleteMany({
    where: { userId, active: false, updatedAt: { lt: cutoff } },
  });
  return result.count;
}

/** Skupni zapis revizijskega dnevnika za osebno plast (append-only). */
export async function writePersonalAudit(entry: {
  userId: string;
  action: string;
  entityId: string;
  meta: Record<string, unknown>;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      actorType: "customer",
      actorId: entry.userId,
      action: entry.action,
      entityType: entry.action.startsWith("preference.")
        ? "user_preference"
        : "memory_item",
      entityId: entry.entityId,
      meta: JSON.stringify(entry.meta),
    },
  });
}

export { PERSONAL_AUDIT_ACTIONS, memoryConfidenceForSource };
export type { MemorySource };
