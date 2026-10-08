/**
 * RECOMMENDATION-REASONS — P1-B §5 (issue #3): INTELIGENTNA PODPORA
 * ODLOČANJU — strukturirani, DOKAZI PODPERTI razlogi za vsak predlog
 * („Zakaj to predlagam?").
 * ============================================================================
 * Kanon iskrenosti: razlog se zgradi SAMO iz kanonskih podatkov
 * (register destinacij + proračun/sezona/interesi konteksta). Kar
 * podatki ne podpirajo, se NE izjavi (npr. delovni čas destinacij
 * NE obstaja v registru — razlog "openingHours" je pošteno izpuščen;
 * edini vir delovnih časov so OSM POI na zemljevidu, ki pa niso vezani
 * na postanke načrta).
 *
 * 0-AI: 0 žetonov, 0 omrežja; isti vhod → isti izhod.
 */

import type { Destination } from "@/lib/slovenia-data";
import { interestMatches, type PlannerLang } from "@/lib/itinerary-engine";

export type ReasonKind =
  | "distance"
  | "price"
  | "budgetFit"
  | "seasonFit"
  | "interestMatch"
  | "rating"
  | "bestFor";

export interface ReasonItem {
  kind: ReasonKind;
  /** SL/EN oznaka razloga (lokalizirana). */
  label: string;
}

export interface ReasonContext {
  /** Sidrna točka (naslednji postanek / omenjena destinacija) ali null. */
  anchor: { name: string; lat: number; lng: number } | null;
  /** Ciljni proračun (€/€€/€€€) ali null, če ni znan. */
  budget: "€" | "€€" | "€€€" | null;
  /** Letni čas konteksta (npr. iz preferenc) ali null. */
  season: "spring" | "summer" | "autumn" | "winter" | null;
  /** Interesi konteksta (pot ali osebni profil) — proste besede. */
  interests: string[];
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function stripDia(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/č|ć/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z");
}

const SEASON_LABELS: Record<string, { sl: string; en: string }> = {
  spring: { sl: "pomlad", en: "spring" },
  summer: { sl: "poletje", en: "summer" },
  autumn: { sl: "jesen", en: "autumn" },
  winter: { sl: "zima", en: "winter" },
};

/**
 * Zgradi strukturirane razloge za kandidata (deterministično).
 * Razlogi so urejeni po fiksni prioriteti: razdalja → cena →
 * ujemanje proračuna → sezona → interesi → ocena → primernost.
 */
export function buildCandidateReasons(
  candidate: Destination,
  ctx: ReasonContext,
  lang: PlannerLang = "sl"
): ReasonItem[] {
  const reasons: ReasonItem[] = [];

  if (ctx.anchor) {
    const km = haversineKm(ctx.anchor, candidate.coords);
    const roadKm = Math.round(km * 1.3);
    const driveMin = Math.round((roadKm / 60) * 60);
    reasons.push({
      kind: "distance",
      label:
        lang === "en"
          ? `${Math.round(km)} km from ${ctx.anchor.name} (drive ~${driveMin} min est.)`
          : `${Math.round(km)} km od ${ctx.anchor.name} (vožnja ~${driveMin} min, ocena)`,
    });
  }

  reasons.push({
    kind: "price",
    label:
      lang === "en"
        ? `~${candidate.costPerPerson} € per person`
        : `~${candidate.costPerPerson} € na osebo`,
  });

  if (ctx.budget) {
    const fits = candidate.budget.length <= ctx.budget.length;
    reasons.push({
      kind: "budgetFit",
      label:
        lang === "en"
          ? fits
            ? `fits your budget (${ctx.budget})`
            : `above your budget (${candidate.budget} vs ${ctx.budget})`
          : fits
            ? `ustreza proračunu (${ctx.budget})`
            : `NAD proračunom (${candidate.budget} pri cilju ${ctx.budget})`,
    });
  }

  if (ctx.season) {
    const fits = candidate.bestSeason.includes(ctx.season);
    const s = SEASON_LABELS[ctx.season];
    reasons.push({
      kind: "seasonFit",
      label:
        lang === "en"
          ? fits
            ? `in season (${s.en})`
            : `out of season (${s.en}; best: ${candidate.bestSeason.join(", ") || "unknown"})`
          : fits
            ? `v sezoni (${s.sl})`
            : `izven sezone (${s.sl}; najlepše: ${candidate.bestSeason.join(", ") || "neznano"})`,
    });
  }

  if (ctx.interests.length > 0) {
    // ISTI kanon ujemanja kot načrtovalnik (interestMatches s sinonimi —
    // npr. »morje« ujame obalo/coast; brez podvojenega slovarja).
    const blob = stripDia(
      [
        candidate.name,
        candidate.slug,
        candidate.tagline,
        candidate.type,
        ...(candidate.highlights ?? []),
        ...(candidate.activities ?? []),
        ...(candidate.bestFor ?? []),
      ].join(" ")
    );
    const blobTokens = blob.split(" ").filter(Boolean);
    const matched = ctx.interests
      .filter((w) => w.length >= 3 && interestMatches(blobTokens, blob, w));
    if (matched.length > 0) {
      reasons.push({
        kind: "interestMatch",
        label:
          lang === "en"
            ? `matches interests: ${matched.join(", ")}`
            : `ujema se z interesi: ${matched.join(", ")}`,
      });
    }
  }

  reasons.push({
    kind: "rating",
    label:
      lang === "en"
        ? `rated ${candidate.rating}/10`
        : `ocena obiskovalcev ${candidate.rating}/10`,
  });

  const bestFor = (candidate.bestFor ?? []).slice(0, 2);
  if (bestFor.length > 0) {
    reasons.push({
      kind: "bestFor",
      label:
        lang === "en"
          ? `good for: ${bestFor.join(", ")}`
          : `primerno za: ${bestFor.join(", ")}`,
    });
  }

  return reasons;
}

/** Enovrstični izpis razlogov za klepet („Zakaj: …"). */
export function formatReasonsInline(reasons: ReasonItem[], max = 3): string {
  return reasons.slice(0, max).map((r) => r.label).join(", ");
}
