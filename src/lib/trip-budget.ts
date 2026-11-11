/**
 * PRORAČUN POTI — ocena stroška prenočišč + delitev med sopotniki.
 *
 * Izrazita želja (raziskava UX vzorcev, worklog POLIRAJ-5, vzorec Wanderlog):
 * »Moja pot« naj pokaže OCENO skupnega stroška rezerviranih prenočišč in
 * delitev na osebo — uporabnik vidi okvirni proračun brez kalkulatorja.
 *
 * Model (pošteno in enostavno):
 *   • noči = dnevi iz vodiča (privzeto 1 noč na prenočišče, če dni ni),
 *     enakomerno razporejene po prenočiščih po vrstnem redu rezervacij;
 *   • subtotal = noči × priceFrom (indikativna cena od, EUR/noč);
 *   • prenočišča brez objavljene cene NISO všteta — posebej prišteta
 *     v `unpricedCount` (nikoli tiho izpuščena).
 *
 * Čisto in testabilno: brez Reacta, brez `window`.
 */

export interface BudgetStayLike {
  name: string;
  city: string;
  /** Indikativna cena od (EUR/noč) ali null — cena ni znana. */
  priceFrom: number | null;
}

export interface BudgetItem {
  name: string;
  city: string;
  /** Noči, dodeljene temu prenočišču (enakomerna razporeditev). */
  nights: number;
  priceFrom: number | null;
  /** nights × priceFrom (zaokroženo); null, če cena ni znana. */
  subtotalEur: number | null;
}

export interface TripBudget {
  /** Skupno število noči, uporabljeno v izračunu. */
  nights: number;
  /** Število sopotnikov za delitev (1–8). */
  persons: number;
  items: BudgetItem[];
  /** Seštevek znanih subtotalov; null, če NOBENA postavka nima cene. */
  totalEur: number | null;
  /** totalEur / persons (zaokroženo); null, če totalEur ni znan. */
  perPersonEur: number | null;
  /** Št. prenočišč brez objavljene cene (niso všteta v seštevek). */
  unpricedCount: number;
}

/**
 * Enakomerna razdelitev `totalNights` noči na `stayCount` prenočišč;
 * ostanek (do count-1) gre prvima prenočiščema po vrsti.
 * Če je noči manj kot prenočišč, zadnja dobijo 0 noči (subtotal 0).
 */
export function allocateNights(totalNights: number, stayCount: number): number[] {
  if (stayCount <= 0) return [];
  const n = Math.max(0, Math.round(totalNights));
  const base = Math.floor(n / stayCount);
  const remainder = n % stayCount;
  return Array.from({ length: stayCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Zgradi oceno proračuna. Vse meje so varne:
 *   • nights null/neveljavno → privzeto 1 noč na prenočišče;
 *   • nights omejeno na 1..60; persons omejeno na 1..8;
 *   • prazen seznam → prazen proračun (items [], totalEur null).
 */
export function buildTripBudget(
  stays: readonly BudgetStayLike[],
  nights: number | null,
  persons: number,
): TripBudget {
  const personsSafe = Math.min(8, Math.max(1, Math.round(Number.isFinite(persons) ? persons : 1)));
  if (stays.length === 0) {
    return { nights: 0, persons: personsSafe, items: [], totalEur: null, perPersonEur: null, unpricedCount: 0 };
  }
  const nightsSafe = Math.min(
    60,
    Math.max(1, Math.round(typeof nights === 'number' && Number.isFinite(nights) ? nights : stays.length)),
  );
  const allocation = allocateNights(nightsSafe, stays.length);

  let total = 0;
  let priced = 0;
  let unpriced = 0;
  const items: BudgetItem[] = stays.map((s, i) => {
    const n = allocation[i] ?? 0;
    if (s.priceFrom === null) {
      unpriced += 1;
      return { name: s.name, city: s.city, nights: n, priceFrom: null, subtotalEur: null };
    }
    priced += 1;
    const subtotal = Math.round(n * s.priceFrom);
    total += subtotal;
    return { name: s.name, city: s.city, nights: n, priceFrom: s.priceFrom, subtotalEur: subtotal };
  });

  const totalEur = priced > 0 ? total : null;
  return {
    nights: nightsSafe,
    persons: personsSafe,
    items,
    totalEur,
    perPersonEur: totalEur === null ? null : Math.round(totalEur / personsSafe),
    unpricedCount: unpriced,
  };
}

/** Slovensko sklanjanje: 1 oseba, 2 osebi, 3–4 osebe, 5+ oseb. */
export function personsNoun(n: number): string {
  if (n === 1) return 'oseba';
  if (n === 2) return 'osebi';
  if (n === 3 || n === 4) return 'osebe';
  return 'oseb';
}

/** Slovensko sklanjanje: 1 noč, 2 noči, 3–4 noči, 5+ noči. */
export function nightsNoun(n: number): string {
  if (n === 1) return 'noč';
  if (n === 2) return 'noči';
  if (n === 3 || n === 4) return 'noči';
  return 'noči';
}

/**
 * Opomba za prenočišča brez cene — pravilna sklanjanja in dvojina:
 * 1 ni všteto · 2 nista všteti · 3–4 niso všteta · 5+ ni vštetih.
 */
export function unpricedNote(count: number): string {
  if (count === 1) return '1 prenočišče brez cene ni všteto v oceno.';
  if (count === 2) return '2 prenočišči brez cene nista všteti v oceno.';
  if (count === 3 || count === 4) return `${count} prenočišča brez cene niso všteta v oceno.`;
  return `${count} prenočišč brez cene ni vštetih v oceno.`;
}

/** "123 €" — brez decimalk, cene so indikativne. */
export function formatEur(n: number): string {
  return `${Math.round(n)} €`;
}
