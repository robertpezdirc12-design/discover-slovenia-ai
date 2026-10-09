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
  Record<ConsultationBudget, { sl: string; en: string; it: string; de: string; fr: string; es: string }>
> = Object.freeze({
  "do-150": { sl: "do 150 € na osebo", en: "up to €150 per person", it: "fino a 150 € a persona", de: "bis zu 150 € pro Person", fr: "jusqu'à 150 € par personne", es: "hasta 150 € por persona" },
  "150-300": { sl: "150–300 € na osebo", en: "€150–300 per person", it: "150–300 € a persona", de: "150–300 € pro Person", fr: "150–300 € par personne", es: "150–300 € por persona" },
  "300-600": { sl: "300–600 € na osebo", en: "€300–600 per person", it: "300–600 € a persona", de: "300–600 € pro Person", fr: "300–600 € par personne", es: "300–600 € por persona" },
  "600-1200": { sl: "600–1.200 € na osebo", en: "€600–1,200 per person", it: "600–1.200 € a persona", de: "600–1.200 € pro Person", fr: "600–1 200 € par personne", es: "600–1.200 € por persona" },
  "1200-plus": { sl: "nad 1.200 € na osebo", en: "over €1,200 per person", it: "oltre 1.200 € a persona", de: "über 1.200 € pro Person", fr: "plus de 1 200 € par personne", es: "más de 1.200 € por persona" },
  neodlocen: { sl: "še ne vem", en: "not sure yet", it: "non so ancora", de: "weiß noch nicht", fr: "je ne sais pas encore", es: "aún no lo sé" },
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
  Record<ConsultationInterest, { sl: string; en: string; it: string; de: string; fr: string; es: string }>
> = Object.freeze({
  narava: { sl: "Narava", en: "Nature", it: "Natura", de: "Natur", fr: "Nature", es: "Naturaleza" },
  gore: { sl: "Gore in pohodi", en: "Mountains & hiking", it: "Montagna ed escursioni", de: "Berge & Wandern", fr: "Montagne et randonnée", es: "Montaña y senderismo" },
  kultura: { sl: "Kultura in zgodovina", en: "Culture & history", it: "Cultura e storia", de: "Kultur & Geschichte", fr: "Culture et histoire", es: "Cultura e historia" },
  hrana: { sl: "Hrana in pijača", en: "Food & drinks", it: "Cibo e bevande", de: "Essen & Trinken", fr: "Gastronomie et boissons", es: "Comida y bebida" },
  aktivnosti: { sl: "Aktivnosti in adrenalinski", en: "Activities & adventure", it: "Attività e avventura", de: "Aktivitäten & Abenteuer", fr: "Activités et aventure", es: "Actividades y aventura" },
  druzina: { sl: "Družinsko", en: "Family friendly", it: "Adatto alle famiglie", de: "Familienfreundlich", fr: "En famille", es: "En familia" },
  wellness: { sl: "Zdravje in wellness", en: "Wellness", it: "Salute e benessere", de: "Wellness", fr: "Bien-être", es: "Bienestar" },
  "nocno-zivljenje": { sl: "Nočno življenje", en: "Nightlife", it: "Vita notturna", de: "Nachtleben", fr: "Vie nocturne", es: "Vida nocturna" },
});
