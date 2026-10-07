/**
 * AFFILIATE-SERVER — stranski učinki provizijske plasti (v2.5.0).
 *
 * Kanon (kot marketplace-checkout-server):
 *  · env se bere ob KLICU (ne ob zagonu), da sprememba .env nemudoma
 *    velja — fail-closed preverba živo možna;
 *  · AFFILIATE_*_ID žetoni NIKOLI ne zapustijo strežnika (javni DTO jih
 *    ne nosi, shranjena povezava klika je BREZ žetona);
 *  · pisanje klika ne sme ZAVRNITI preusmeritve — če baza odpove, se
 *    uporabnik vseeno preusmeri (klik je izgubljen, ne rezervacija).
 *
 * Admin varovanje: DSA_ADMIN_EMAILS (vejica ločen seznam e-poštnih naslovov
 * skrbnikov). Brez nastavitve ali brez prijave → 403 (fail-closed).
 */

import { getServerSession } from "next-auth";

import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import {
  AFFILIATE_PROVIDERS,
  applyTemplate,
  buildPartnerLink,
  estimateCommission,
  getProvider,
  payoutDueDate,
  type AffiliateProviderDef,
  type BuiltLink,
} from "@/lib/affiliate-providers";

// ── Env (ob klicu) ────────────────────────────────────────────────────────

export interface AffiliateEnv {
  affiliateId: string | null;
  tmplOverride: string | null;
}

/** Prebere env žeton + predlogo za partnerja (null, če ni programa). */
export function affiliateEnvFor(provider: AffiliateProviderDef): AffiliateEnv {
  const affiliateId = provider.envId
    ? process.env[provider.envId]?.trim() || null
    : null;
  const tmplOverride = provider.envTmpl
    ? process.env[provider.envTmpl]?.trim() || null
    : null;
  return { affiliateId, tmplOverride };
}

/** Pregled aktiviranosti vseh partnerjev (za stats — brez vrednosti žetonov). */
export function affiliateActivationStatus(): {
  id: string;
  category: string;
  active: boolean;
}[] {
  return AFFILIATE_PROVIDERS.filter((p) => p.category !== "fuel").map((p) => {
    const env = affiliateEnvFor(p);
    return { id: p.id, category: p.category, active: Boolean(env.affiliateId) };
  });
}

// ── Zapis klika ───────────────────────────────────────────────────────────

export interface RecordClickInput {
  provider: AffiliateProviderDef;
  destinationSlug: string | null;
  destinationName: string | null;
  link: BuiltLink;
  userId: string | null;
  sessionKey: string;
  referrer: string | null;
}

/**
 * Zapiše klik (affiliateActive + javni URL brez žetona). Vrne id zapisa
 * ali null ob napaku baze — klicatelj preusmeri NEODVISNO od izida.
 */
export async function recordAffiliateClick(
  input: RecordClickInput,
): Promise<string | null> {
  try {
    const click = await db.affiliateClick.create({
      data: {
        providerId: input.provider.id,
        category: input.provider.category,
        destinationSlug: input.destinationSlug,
        destinationName: input.destinationName,
        affiliateActive: input.link.affiliateActive,
        url: publicUrlFor(input.provider, input.destinationName),
        userId: input.userId,
        sessionKey: input.sessionKey,
        referrer: input.referrer,
      },
    });
    return click.id;
  } catch {
    return null;
  }
}

/**
 * JAVNA povezava partnerja (brez žetona) za shranjevanje/prikaz: vedno
 * zgrajena iz javne predloge registnega vnosa — žeton NIKOLI ne pride v
 * bazo niti v odgovore API-ja (preusmeritveni URL živi samo v 302).
 */
export function publicUrlFor(
  provider: AffiliateProviderDef,
  destName: string | null,
): string {
  if (provider.category === "fuel") {
    return "https://www.openstreetmap.org/";
  }
  return applyTemplate(provider.publicTmpl, destName, null);
}

// ── Gradnja preusmeritvene povezave (z dest) ──────────────────────────────

/**
 * Izgradi KONČNO povezavo za preusmeritev (z žetonom, če je aktiven).
 * Destinacija se pošlje kot ime za iskanje pri partnerju.
 */
export function buildRedirectFor(
  providerId: string,
  destName: string | null,
): { provider: AffiliateProviderDef; link: BuiltLink } | null {
  const provider = getProvider(providerId);
  if (!provider) return null;
  const env = affiliateEnvFor(provider);
  const link = buildPartnerLink({
    provider,
    destName,
    affiliateId: env.affiliateId,
    tmplOverride: env.tmplOverride,
  });
  return { provider, link };
}

// ── Admin varovanje (DSA_ADMIN_EMAILS) ────────────────────────────────────

/**
 * Ali je prijavljeni uporabnik skrbnik (e-pošta v DSA_ADMIN_EMAILS)?
 * Fail-closed: brez env ali brez prijave → false.
 */
export async function isAdminSession(): Promise<boolean> {
  const raw = process.env.DSA_ADMIN_EMAILS?.trim();
  if (!raw) return false;
  const allowed = raw
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    return Boolean(email && allowed.includes(email));
  } catch {
    return false;
  }
}

// ── Statistika (admin) ────────────────────────────────────────────────────

export interface ProviderClickStat {
  providerId: string;
  total: number;
  active: number; // kliki z affiliateActive
  last7: number;
  last30: number;
  estimatedEur: number; // ocena iz povprečnih vrednosti ni možna → 0 + opomba
}

export interface AffiliateStats {
  providers: ProviderClickStat[];
  commissions: {
    pendingCount: number;
    confirmedCount: number;
    paidCount: number;
    pendingEur: number;
    confirmedEur: number;
    paidEur: number;
  };
  totalClicks: number;
  generatedAt: string;
}

/**
 * Zbirna statistika za admin ploščo. Ocena provizije iz klikov NI možna
 * (klik ne pozna vrednosti rezervacije) — estimatedEur ostaja 0, ocena
 * se izračuna ob vnosu iz poročila (estimateCommission pri predlogu).
 */
export async function affiliateStats(): Promise<AffiliateStats> {
  const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [clicks, recent7, recent30, commissions] = await Promise.all([
    db.affiliateClick.groupBy({
      by: ["providerId"],
      _count: { _all: true },
      where: {},
    }),
    db.affiliateClick.groupBy({
      by: ["providerId"],
      _count: { _all: true },
      where: { createdAt: { gte: since7 } },
    }),
    db.affiliateClick.groupBy({
      by: ["providerId"],
      _count: { _all: true },
      where: { createdAt: { gte: since30 } },
    }),
    db.commissionEntry.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { commissionEur: true },
    }),
  ]);

  const activeCounts = new Map<string, number>();
  // active klikov (moniziranih) po partnerju — posebna poizvedba:
  const active = await db.affiliateClick.groupBy({
    by: ["providerId"],
    _count: { _all: true },
    where: { affiliateActive: true },
  });
  for (const a of active) activeCounts.set(a.providerId, a._count._all);

  const map7 = new Map(recent7.map((r) => [r.providerId, r._count._all]));
  const map30 = new Map(recent30.map((r) => [r.providerId, r._count._all]));

  const providers: ProviderClickStat[] = AFFILIATE_PROVIDERS.map((p) => {
    const total = clicks.find((c) => c.providerId === p.id)?._count._all ?? 0;
    return {
      providerId: p.id,
      total,
      active: activeCounts.get(p.id) ?? 0,
      last7: map7.get(p.id) ?? 0,
      last30: map30.get(p.id) ?? 0,
      estimatedEur: 0,
    };
  });

  const pick = (status: string) =>
    commissions.find((c) => c.status === status);
  const sum = (status: string) =>
    Math.round((pick(status)?._sum.commissionEur ?? 0) * 100) / 100;

  return {
    providers,
    commissions: {
      pendingCount: pick("PENDING")?._count._all ?? 0,
      confirmedCount: pick("CONFIRMED")?._count._all ?? 0,
      paidCount: pick("PAID")?._count._all ?? 0,
      pendingEur: sum("PENDING"),
      confirmedEur: sum("CONFIRMED"),
      paidEur: sum("PAID"),
    },
    totalClicks: clicks.reduce((acc, c) => acc + c._count._all, 0),
    generatedAt: new Date().toISOString(),
  };
}

// ── Predlog vnosa iz poročila (admin) ─────────────────────────────────────

export interface CommissionDraft {
  providerId: string;
  bookingRef: string;
  bookedFor: string | null;
  amountEur: number;
  commissionEur: number;
  stayCompletedAt: Date | null;
  payoutDueAt: Date | null;
  note: string | null;
}

/**
 * Predlog vnosa: commissionEur, če ni podan, ocenimo iz registra
 * (estimateCommission — vidno označeno kot predlog, poročilo je resnica),
 * payoutDueAt pa po MindTrip vzorcu (28. +3 meseca).
 */
export function commissionDraftFromInput(input: {
  providerId: string;
  bookingRef: string;
  bookedFor?: string | null;
  amountEur: number;
  commissionEur?: number | null;
  stayCompletedAt?: string | null;
  note?: string | null;
}): { ok: true; draft: CommissionDraft } | { ok: false; error: string } {
  const provider = getProvider(input.providerId);
  if (!provider || provider.category === "fuel") {
    return { ok: false, error: "Neznan rezervacijski partner." };
  }
  if (!input.bookingRef?.trim()) {
    return { ok: false, error: "Številka rezervacije je obvezna." };
  }
  const amount = Number(input.amountEur);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Vrednost rezervacije mora biti pozitivna." };
  }
  const est = estimateCommission(provider, amount);
  const commission =
    input.commissionEur != null && Number.isFinite(Number(input.commissionEur))
      ? Math.round(Number(input.commissionEur) * 100) / 100
      : est.commissionEur;
  const stay = input.stayCompletedAt ? new Date(input.stayCompletedAt) : null;
  const stayOk =
    !input.stayCompletedAt || (stay && !Number.isNaN(stay.getTime()))
      ? stay
      : null;
  const payout = stayOk ? payoutDueDate(stayOk) : null;
  return {
    ok: true,
    draft: {
      providerId: provider.id,
      bookingRef: input.bookingRef.trim(),
      bookedFor: input.bookedFor?.trim() || null,
      amountEur: amount,
      commissionEur: commission,
      stayCompletedAt: stayOk,
      payoutDueAt: payout,
      note: input.note?.trim() || null,
    },
  };
}
