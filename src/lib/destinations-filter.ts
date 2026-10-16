/**
 * DESTINATIONS-FILTER — čista (odjemalec- in strežnik-varna) logika
 * raziskovalke destinacij (/destinacije).
 *
 * Izvlečeno iz destinations-explorer.tsx (2.47.0, issue #38, merilo
 * „Filtri dogodkov in destinacij imajo regresijske teste“): logika je
 * prej živela v useMemo znotraj odjemalske komponente in ni bila
 * enotsko testirana (samo brskalniško prek E2E). Izvleček je 1 : 1 —
 * semantika (vrstni red pogojev, rezanje iskalnega niza, neobčutljivost
 * na velikost črk, neznana vrednost regije/tipa → prazen rezultat,
 * „all“ → brez omejitve) je OHRANJENA in zdaj zaklenjena s testi
 * tests/destinations-filter.test.ts.
 */

import type { Destination } from "./slovenia-data";
import { ALL_COUNTRY_CODES } from "./countries-data";
import { REGIONS } from "./slovenia-data";

/** Stanje kontrol raziskovalke (?q= ?region= ?type= ?country= iz URL-ja). */
export interface DestinationFilterState {
  /** Iskalni niz (rezanje + neobčutljivost na velikost črk v logiki). */
  q: string;
  /** „all“ ali ključ REGIONS; neznana vrednost → prazen rezultat. */
  region: string;
  /** „all“ ali ključ DEST_TYPES; neznana vrednost → prazen rezultat. */
  type: string;
  /** „all“ (ALI MANJKA — združljivost s starimi klici, #41 F0) ali
   *  ključ COUNTRIES; neznana vrednost → prazen rezultat. */
  country?: string;
}

/**
 * Normalizira besedilo za iskanje: "plitvicka" najde tudi "Plitvička".
 * Isto pravilo uporablja seznam destinacij in interaktivni zemljevid.
 */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Minimalna oblika zapisa, ki jo logika filtra bere. */
export type FilterableDestination = Pick<
  Destination,
  "country" | "region" | "type" | "name" | "tagline" | "description" | "highlights"
>;

/**
 * Filtrira destinacije po državi (#41 F0), iskalnem nizu (name/tagline/
 * description/highlights) in po regiji/tipu. Vrstni red pogojev je kanon
 * komponente (država → regija → tip → iskanje) — ne spreminjaj brez testov.
 */
export function filterDestinations<T extends FilterableDestination>(
  destinations: readonly T[],
  filters: DestinationFilterState,
): T[] {
  const needle = normalizeSearchText(filters.q.trim());
  const wantCountry = filters.country ?? "all";
  return destinations.filter((d) => {
    if (wantCountry !== "all" && d.country !== wantCountry) return false;
    if (filters.region !== "all" && d.region !== filters.region) return false;
    if (filters.type !== "all" && d.type !== filters.type) return false;
    if (
      needle &&
      !normalizeSearchText(d.name).includes(needle) &&
      !normalizeSearchText(d.tagline).includes(needle) &&
      !normalizeSearchText(d.description).includes(needle) &&
      !d.highlights.some((h) => normalizeSearchText(h).includes(needle))
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Regije, ki dejansko nastopajo v naboru — v KANONSKEM vrstnem redu
 * slovarja REGIONS (vstavljalni vrstni red ključev), ne vrstnega redu
 * nabora destinacij.
 */
export function activeRegionKeys<T extends { region: string }>(
  destinations: readonly T[],
): string[] {
  const present = new Set(destinations.map((d) => d.region));
  return Object.keys(REGIONS).filter((r) => present.has(r));
}

/**
 * Države, ki dejansko nastopajo v naboru — v kanonskem vrstnem redu
 * ALL_COUNTRY_CODES (geografski sever → jug, #41 F0).
 */
export function activeCountryKeys<T extends { country: Destination["country"] }>(
  destinations: readonly T[],
): Destination["country"][] {
  const present = new Set<Destination["country"]>(destinations.map((d) => d.country));
  return ALL_COUNTRY_CODES.filter((c) => present.has(c));
}

/** Ali je katerikoli filter aktiven (vidnost gumba za ponastavitev). */
export function hasActiveFilters(filters: DestinationFilterState): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.region !== "all" ||
    filters.type !== "all" ||
    (filters.country ?? "all") !== "all"
  );
}
