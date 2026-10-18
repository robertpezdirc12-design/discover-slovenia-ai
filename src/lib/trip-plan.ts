/**
 * MOJA POT — čista podatkovna plast (vodič → zemljevid).
 *
 * Izrazita želja uporabnika: aplikacija vodi uporabnika; ko vodeni tok
 * zaključi (regija + interesi + dni + tempo), se rezultat POKAŽE na
 * zemljevidu — izbrana regija dobi svoje destinacije (Komootov vzorec:
 * načrt je takoj viden na karti, ne samo v besedilu).
 *
 * Čisto in testabilno: brez Reacta, brez `window`, brez ikon (ikone so
 * sloj komponente). Pokritost VSEH regij je obvezna — tudi Koroška mora
 * imeti vsaj eno destinacijo, sicer vodič obljubi, kar zemljevid ne pokaže.
 */

import type { GuideRegionId } from '@/lib/guide-store';

export interface TripStop {
  /** Enolično ime destinacije (ključ za označevalce na karti). */
  name: string;
  /** Kratek opis — pokaže se v pojavnem oknu zemljevida. */
  note: string;
  lat: number;
  lng: number;
}

/**
 * Vsebina "Moje poti" po regijah vodnega toka.
 * Koordinate = dejanski geografski položaji (OSM), ne središča regij.
 */
export const TRIP_PLAN: Record<GuideRegionId, readonly TripStop[]> = {
  gorenjska: [
    { name: 'Bled', note: 'Jezerski otok in grad nad strmino', lat: 46.3625, lng: 14.0936 },
    { name: 'Bohinj', note: 'Ledeniško jezero pod Triglavom', lat: 46.2714, lng: 13.9526 },
  ],
  osrednja: [
    { name: 'Ljubljana', note: 'Ljubljanica, grad in mestne tržnice', lat: 46.0569, lng: 14.5058 },
  ],
  primorska: [
    { name: 'Dolina Soče', note: 'Smaragdna reka in panoramske poti', lat: 46.3377, lng: 13.5556 },
    { name: 'Piran', note: 'Srednjeveški zaliv in soline', lat: 45.528, lng: 13.568 },
  ],
  stajerska: [
    { name: 'Maribor', note: 'Najstarejša trta na svetu in Pohorje', lat: 46.5547, lng: 15.6459 },
  ],
  koroska: [
    { name: 'Dravograd', note: 'Sotočje Drave in Meže — vrata Koroške', lat: 46.5864, lng: 15.0019 },
  ],
} as const;

/** Destinacije izbrane regije — vedno vsaj ena (zagotovljeno s testi). */
export function tripPlanFor(region: GuideRegionId): readonly TripStop[] {
  return TRIP_PLAN[region];
}
