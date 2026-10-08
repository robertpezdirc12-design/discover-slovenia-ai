/**
 * CONSULTATION-OPTIONS — client-safe oznake možnosti konzultacij
 * (P0-H). Ločeno od src/lib/consultation-fallback.ts, ker ta uvaža
 * node:crypto (strežniški žeton) — te oznake pa potrebuje javni
 * obrazec na odjemalcu.
 *
 * VREDNOSTI so en same resnice s strežniško validacijo — spreminjaj
 * IZKLJUČNO skupaj (consultation-fallback.ts re-importa od tu).
 */

export const CONSULTATION_BUDGETS = [
  "do-150",
  "150-300",
  "300-600",
  "600-1200",
  "1200-plus",
  "neodlocen",
] as const;
export type ConsultationBudget = (typeof CONSULTATION_BUDGETS)[number];

export const CONSULTATION_BUDGET_LABELS: Readonly<
  Record<ConsultationBudget, { sl: string; en: string }>
> = Object.freeze({
  "do-150": { sl: "do 150 € na osebo", en: "up to €150 per person" },
  "150-300": { sl: "150–300 € na osebo", en: "€150–300 per person" },
  "300-600": { sl: "300–600 € na osebo", en: "€300–600 per person" },
  "600-1200": { sl: "600–1.200 € na osebo", en: "€600–1,200 per person" },
  "1200-plus": { sl: "nad 1.200 € na osebo", en: "over €1,200 per person" },
  neodlocen: { sl: "še ne vem", en: "not sure yet" },
});

export const CONSULTATION_INTERESTS = [
  "narava",
  "gore",
  "kultura",
  "hrana",
  "aktivnosti",
  "druzina",
  "wellness",
  "nocno-zivljenje",
] as const;
export type ConsultationInterest = (typeof CONSULTATION_INTERESTS)[number];

export const CONSULTATION_INTEREST_LABELS: Readonly<
  Record<ConsultationInterest, { sl: string; en: string }>
> = Object.freeze({
  narava: { sl: "Narava", en: "Nature" },
  gore: { sl: "Gore in pohodi", en: "Mountains & hiking" },
  kultura: { sl: "Kultura in zgodovina", en: "Culture & history" },
  hrana: { sl: "Hrana in pijača", en: "Food & drinks" },
  aktivnosti: { sl: "Aktivnosti in adrenalinski", en: "Activities & adventure" },
  druzina: { sl: "Družinsko", en: "Family friendly" },
  wellness: { sl: "Zdravje in wellness", en: "Wellness" },
  "nocno-zivljenje": { sl: "Nočno življenje", en: "Nightlife" },
});
