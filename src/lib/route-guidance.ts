/**
 * NAVIGACIJA PO POTI — čista logika postanek-po-postanku.
 *
 * Izrazita želja uporabnika: »ko konča z vnašanjem, naj se odpre navigacija,
 * ki ga vodi po poti do destinacije« — uporabnik nikoli ne sme ostati brez
 * naslednjega koraka. Vodeni tok → karta → navigacija vodi skozi postanke
 * (Naprej/Nazaj) do obiska na zadnji destinaciji.
 *
 * Čisto in testabilno: brez Reacta, brez `window`, brez Leafleta.
 */

export interface NavStopLike {
  name: string;
  note: string;
}

/** Stanje navigacije: null = izklopljena, številka = indeks trenutne postanke. */
export type NavIndex = number | null;

/** Prva postanka (ali null, če poti ni). */
export function navFirst(stops: readonly NavStopLike[]): NavIndex {
  return stops.length > 0 ? 0 : null;
}

/** Naslednja postanka — ob zadnji ostane na zadnji (obisk dosežen). */
export function navNext(stops: readonly NavStopLike[], index: NavIndex): NavIndex {
  if (index === null || stops.length === 0) return null;
  return Math.min(index + 1, stops.length - 1);
}

/** Prejšnja postanka — na prvi ostane na prvi. */
export function navPrev(stops: readonly NavStopLike[], index: NavIndex): NavIndex {
  if (index === null || stops.length === 0) return null;
  return Math.max(index - 1, 0);
}

/** Ali je indeks na zadnji postanki (obisk)? */
export function navIsLast(stops: readonly NavStopLike[], index: NavIndex): boolean {
  if (index === null || stops.length === 0) return false;
  return index === stops.length - 1;
}

/** Slovensko sklanjanje: 1 postanek, 2 postanki, 3+ postankov. */
function stopsNoun(n: number): string {
  if (n === 1) return 'postanek';
  if (n === 2) return 'postanki';
  return 'postankov';
}

/**
 * Izrečen napredek (besedilo + glas): aplikacija vodi, uporabnik ne razmišlja.
 * Zadnja postanka = obisk ("Destinacija dosežena").
 */
export function navProgressLabel(
  stops: readonly NavStopLike[],
  index: NavIndex,
): string {
  if (index === null || stops.length === 0) return '';
  const stop = stops[index];
  if (navIsLast(stops, index)) {
    return stops.length === 1
      ? `Destinacija dosežena — ${stop.name}. ${stop.note}`
      : `Destinacija dosežena — ${stop.name} je zadnja od ${stops.length} ${stopsNoun(stops.length)}.`;
  }
  return `Postanek ${index + 1} od ${stops.length}: ${stop.name} — ${stop.note}`;
}

/** Kratek napis na traku: "1/2 · Bled" ali "obisk · Bled". */
export function navChipText(stops: readonly NavStopLike[], index: NavIndex): string {
  if (index === null || stops.length === 0) return '';
  const stop = stops[index];
  return navIsLast(stops, index) ? `obisk · ${stop.name}` : `${index + 1}/${stops.length} · ${stop.name}`;
}
