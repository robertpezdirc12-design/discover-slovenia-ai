/**
 * OSNOVNI TIPI POTOVANJ — minimalna podmnožica centralnih tipov izvirnika
 * (src/lib/types.ts, 638 vrstic; glej docs/recovery/schema-1.163.4.prisma).
 * Tipi ponudniške plasti (supply) niso del tega temelja.
 */

import type { DestinationType } from "./slovenia-data";

/** Vrsta postanka v načrtu (usklajeno z DEST_TYPES + splošni postanki). */
export type TripStopKind = DestinationType | "food" | "activity" | "custom";

/**
 * En postanek načrta (poenoten prikaz AI in determinističnih načrtov).
 * - time: "09:30" (HH:mm) | null, ko ura ni znana (iskrenostni kanon)
 * - durationMin: trajanje v minutah
 * - cost: ocena stroška na osebo (EUR); 0 = brezplačno
 * - slug/region: izvor destinacije (povezava + prikaz regije; neobvezno
 *   za custom postanke brez kanonskega zapisa)
 */
export interface TripStop {
  id: string;
  name: string;
  time: string | null;
  durationMin: number;
  cost: number;
  kind: TripStopKind;
  coords?: { lat: number; lng: number };
  slug?: string;
  region?: string;
  /** Država destinacije (CountryCode; F5 čezmejna potovanja #41). */
  country?: string;
}

/**
 * Mejni prehod v načrtu (F5, #41): sprememba države med dvema zaporednima
 * postankoma (v dnevu ALI med dnevi). Dan je 1-indeksiran (prikaz).
 */
export interface BorderCrossing {
  from: string;
  to: string;
  /** Dan (1-indeksiran), na katerem se prehod zgodi. */
  day: number;
}

/**
 * Načrt potovanja: dnevi s postanki + povzetek (naslov, sinteza).
 * - totalCost: vsota stroškov vseh postankov na osebo (EUR)
 * - coverageNote: iskrena opomba o pokritju želja/filtrov (kanon izvirnika)
 * - dayTitles: naslov dneva ("Dan 1 · Gorenjska — Bled") v jeziku locale
 */
export interface ItineraryPlan {
  days: TripStop[][];
  title: string;
  summary: string;
  totalCost: number;
  coverageNote: string;
  dayTitles?: string[];
  meta?: PlanMeta;
  /**
   * Čezmejni prehodi v vrstnem redu potovanja (F5 #41). Odsoten/polje
   * prazno = načrt je znotraj ene države (nekateri stari klici ne polnijo).
   */
  borderCrossings?: BorderCrossing[];
}

/** Razlog determinističnega načrta (isti vhod → isti izhod). */
export interface PlanMeta {
  interests: string[];
  days: number;
  region?: string;
  /** Državni filter (CountryCode); neobvezen — privzeto cel Balkan. */
  country?: string;
  season?: string;
  budget?: string;
  locale: "sl" | "en" | "it" | "de" | "fr" | "es";
}

/** Vrsta zbirke "Moja pot" (dodajanje destinacij, dogodkov, izkušenj …). */
export type MyTripItemKind = "destination" | "event" | "experience" | "custom";

/**
 * Zapis v zbirki "Moja pot" (localStorage 'dai:my-trip').
 * refId = kanonski ID oz. slug (destinacije: slug).
 */
export interface MyTripItem {
  refId: string;
  name: string;
  kind: MyTripItemKind;
  addedAt: string;
  source?: string;
}

/** Stanje shranjevanja načrta (mapiranje JourneyBooking.status). */
export type PlanSaveState = "draft" | "saved" | "shared" | "unknown";
