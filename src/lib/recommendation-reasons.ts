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
  /** Lokalizirana oznaka razloga (izbor sl/en po PlannerLang). */
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

const SEASON_LABELS: Record<string, { sl: string; en: string; it: string; de: string; fr: string; es: string }> = {
  spring: { sl: "pomlad", en: "spring", it: "primavera", de: "Frühling", fr: "printemps", es: "primavera" },
  summer: { sl: "poletje", en: "summer", it: "estate", de: "Sommer", fr: "été", es: "verano" },
  autumn: { sl: "jesen", en: "autumn", it: "autunno", de: "Herbst", fr: "automne", es: "otoño" },
  winter: { sl: "zima", en: "winter", it: "inverno", de: "Winter", fr: "hiver", es: "invierno" },
};

/**
 * Slovarji nizov razlogov (6 jezikov, isti vzorec kot GEO_MSG v
 * itinerary-engine). IZBORA jezika NE spreminjamo — buildCandidateReasons
 * ostaja vezan na PlannerLang ("sl" | "en"), razširitev izbire na
 * it/de/fr/es je sledilna naloga ob razširitvi PlannerLang.
 */
const REASON_MSG = {
  distance: {
    sl: (km: number, name: string, min: number) => `${km} km od ${name} (vožnja ~${min} min, ocena)`,
    en: (km: number, name: string, min: number) => `${km} km from ${name} (drive ~${min} min est.)`,
    it: (km: number, name: string, min: number) => `${km} km da ${name} (guida ~${min} min, stima)`,
    de: (km: number, name: string, min: number) => `${km} km von ${name} (Fahrt ~${min} Min., Schätzung)`,
    fr: (km: number, name: string, min: number) => `${km} km de ${name} (trajet ~${min} min, estimation)`,
    es: (km: number, name: string, min: number) => `${km} km de ${name} (conducción ~${min} min, estimación)`,
  },
  price: {
    sl: (n: number) => `~${n} € na osebo`,
    en: (n: number) => `~${n} € per person`,
    it: (n: number) => `~${n} € a persona`,
    de: (n: number) => `~${n} € pro Person`,
    fr: (n: number) => `~${n} € par personne`,
    es: (n: number) => `~${n} € por persona`,
  },
  budgetFit: {
    sl: (b: string) => `ustreza proračunu (${b})`,
    en: (b: string) => `fits your budget (${b})`,
    it: (b: string) => `rientra nel tuo budget (${b})`,
    de: (b: string) => `passt zu deinem Budget (${b})`,
    fr: (b: string) => `entre dans ton budget (${b})`,
    es: (b: string) => `encaja con tu presupuesto (${b})`,
  },
  budgetOver: {
    sl: (c: string, b: string) => `NAD proračunom (${c} pri cilju ${b})`,
    en: (c: string, b: string) => `above your budget (${c} vs ${b})`,
    it: (c: string, b: string) => `SOPRA il budget (${c} rispetto a ${b})`,
    de: (c: string, b: string) => `ÜBER dem Budget (${c} gegenüber ${b})`,
    fr: (c: string, b: string) => `AU-DESSUS du budget (${c} contre ${b})`,
    es: (c: string, b: string) => `POR ENCIMA del presupuesto (${c} frente a ${b})`,
  },
  seasonIn: {
    sl: (s: string) => `v sezoni (${s})`,
    en: (s: string) => `in season (${s})`,
    it: (s: string) => `in stagione (${s})`,
    de: (s: string) => `in der Saison (${s})`,
    fr: (s: string) => `en saison (${s})`,
    es: (s: string) => `en temporada (${s})`,
  },
  seasonOut: {
    sl: (s: string, best: string) => `izven sezone (${s}; najlepše: ${best || "neznano"})`,
    en: (s: string, best: string) => `out of season (${s}; best: ${best || "unknown"})`,
    it: (s: string, best: string) => `fuori stagione (${s}; migliore: ${best || "sconosciuto"})`,
    de: (s: string, best: string) => `außerhalb der Saison (${s}; am schönsten: ${best || "unbekannt"})`,
    fr: (s: string, best: string) => `hors saison (${s} ; au mieux : ${best || "inconnu"})`,
    es: (s: string, best: string) => `fuera de temporada (${s}; lo mejor: ${best || "desconocido"})`,
  },
  interestMatch: {
    sl: (list: string) => `ujema se z interesi: ${list}`,
    en: (list: string) => `matches interests: ${list}`,
    it: (list: string) => `corrisponde agli interessi: ${list}`,
    de: (list: string) => `passt zu deinen Interessen: ${list}`,
    fr: (list: string) => `correspond à tes intérêts : ${list}`,
    es: (list: string) => `coincide con tus intereses: ${list}`,
  },
  rating: {
    sl: (r: number) => `ocena obiskovalcev ${r}/10`,
    en: (r: number) => `rated ${r}/10`,
    it: (r: number) => `voto ${r}/10`,
    de: (r: number) => `Bewertung ${r}/10`,
    fr: (r: number) => `note ${r}/10`,
    es: (r: number) => `valoración ${r}/10`,
  },
  bestFor: {
    sl: (list: string) => `primerno za: ${list}`,
    en: (list: string) => `good for: ${list}`,
    it: (list: string) => `adatto per: ${list}`,
    de: (list: string) => `gut geeignet für: ${list}`,
    fr: (list: string) => `bien pour : ${list}`,
    es: (list: string) => `bueno para: ${list}`,
  },
} as const;

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
          ? REASON_MSG.distance.en(Math.round(km), ctx.anchor.name, driveMin)
          : REASON_MSG.distance.sl(Math.round(km), ctx.anchor.name, driveMin),
    });
  }

  reasons.push({
    kind: "price",
    label:
      lang === "en"
        ? REASON_MSG.price.en(candidate.costPerPerson)
        : REASON_MSG.price.sl(candidate.costPerPerson),
  });

  if (ctx.budget) {
    const fits = candidate.budget.length <= ctx.budget.length;
    reasons.push({
      kind: "budgetFit",
      label:
        lang === "en"
          ? fits
            ? REASON_MSG.budgetFit.en(ctx.budget)
            : REASON_MSG.budgetOver.en(candidate.budget, ctx.budget)
          : fits
            ? REASON_MSG.budgetFit.sl(ctx.budget)
            : REASON_MSG.budgetOver.sl(candidate.budget, ctx.budget),
    });
  }

  if (ctx.season) {
    const fits = candidate.bestSeason.includes(ctx.season);
    const s = SEASON_LABELS[ctx.season];
    const bestJoined = candidate.bestSeason.join(", ");
    reasons.push({
      kind: "seasonFit",
      label:
        lang === "en"
          ? fits
            ? REASON_MSG.seasonIn.en(s.en)
            : REASON_MSG.seasonOut.en(s.en, bestJoined)
          : fits
            ? REASON_MSG.seasonIn.sl(s.sl)
            : REASON_MSG.seasonOut.sl(s.sl, bestJoined),
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
            ? REASON_MSG.interestMatch.en(matched.join(", "))
            : REASON_MSG.interestMatch.sl(matched.join(", ")),
      });
    }
  }

  reasons.push({
    kind: "rating",
    label:
      lang === "en"
        ? REASON_MSG.rating.en(candidate.rating)
        : REASON_MSG.rating.sl(candidate.rating),
  });

  const bestFor = (candidate.bestFor ?? []).slice(0, 2);
  if (bestFor.length > 0) {
    reasons.push({
      kind: "bestFor",
      label:
        lang === "en"
          ? REASON_MSG.bestFor.en(bestFor.join(", "))
          : REASON_MSG.bestFor.sl(bestFor.join(", ")),
    });
  }

  return reasons;
}

/** Enovrstični izpis razlogov za klepet („Zakaj: …"). */
export function formatReasonsInline(reasons: ReasonItem[], max = 3): string {
  return reasons.slice(0, max).map((r) => r.label).join(", ");
}
