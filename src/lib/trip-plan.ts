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
  // Balkan (Faza A)
  hrvaska: [
    { name: 'Zagreb', note: 'Zgornji grad, katedrala in živahna ulica Tkalčićeva', lat: 45.815, lng: 15.9819 },
    { name: 'Plitvice', note: 'Kaskadna jezera in slapovi (UNESCO)', lat: 44.8806, lng: 15.6161 },
    { name: 'Split', note: 'Dioklecijanova palača ob morju', lat: 43.5081, lng: 16.4402 },
    { name: 'Dubrovnik', note: 'Srednjeveško mestno obzidje nad Jadranom', lat: 42.6507, lng: 18.0944 },
  ],
  'bosna-hercegovina': [
    { name: 'Sarajevo', note: 'Kjer se srečata vzhod in zahod — Baščaršija in Vijećnica', lat: 43.8563, lng: 18.4131 },
    { name: 'Mostar', note: 'Stari most (UNESCO) čez Neretvo', lat: 43.3438, lng: 17.8078 },
    { name: 'Banja Luka', note: 'Vrbas, trdnjava Kastel in zeleno obrežje', lat: 44.7722, lng: 17.192 },
  ],
  srbija: [
    { name: 'Beograd', note: 'Kalemegdan, sotočje Save in Donave ter Skadarlija', lat: 44.7866, lng: 20.4489 },
    { name: 'Novi Sad', note: 'Trdnjava Petrovaradin in festival EXIT', lat: 45.2671, lng: 19.8335 },
    { name: 'Niš', note: 'Niška trdnjava in spomenik Čele-kula', lat: 43.3209, lng: 21.8956 },
  ],
  kosovo: [
    { name: 'Priština', note: 'Sodobno mesto z zgodovinskim jedrom in pomnikom mladosti', lat: 42.6629, lng: 21.1655 },
    { name: 'Prizren', note: 'Stari kamniti most in Sinan-pašina mošeja', lat: 42.2139, lng: 20.7396 },
    { name: 'Peja', note: 'Patriarhija Peć in soteska Rugova', lat: 42.659, lng: 20.288 },
  ],
  'crna-gora': [
    { name: 'Kotor', note: 'Zaliv in srednjeveško obzidje (UNESCO)', lat: 42.4247, lng: 18.7715 },
    { name: 'Budva', note: 'Staro mestno jedro in plaže', lat: 42.291, lng: 18.84 },
    { name: 'Žabljak', note: 'Durmitor in Črno jezero — pohodniška naravna lepotica', lat: 43.1556, lng: 19.1339 },
    { name: 'Podgorica', note: 'Prestolnica ob Morači in bližnje jezero Skadar', lat: 42.4304, lng: 19.2594 },
  ],
  albanija: [
    { name: 'Tirana', note: 'Barvite zgradbe, Skenderbegov trg in hrib Dajti', lat: 41.3275, lng: 19.8187 },
    { name: 'Berat', note: 'Mesto tisoč okenc — bela hiša na pobočju (UNESCO)', lat: 40.7086, lng: 19.9434 },
    { name: 'Gjirokastër', note: 'Kamnito mesto in grad nad dolino (UNESCO)', lat: 40.0756, lng: 20.1384 },
    { name: 'Sarandë', note: 'Obala Jonskega morja in bližnje ruševine Butrint', lat: 39.8746, lng: 20.0056 },
  ],
  'severna-makedonija': [
    { name: 'Skopje', note: 'Stari bazar, kamniti most in velika skulpturna promenada', lat: 41.9973, lng: 21.428 },
    { name: 'Ohrid', note: 'Jezero in staro mestno jedro (UNESCO)', lat: 41.1231, lng: 20.8016 },
    { name: 'Bitola', note: 'Širok sokak in antični Heraclea Lyncestis', lat: 41.0311, lng: 21.3346 },
  ],
} as const;

/** Destinacije izbrane regije — vedno vsaj ena (zagotovljeno s testi). */
export function tripPlanFor(region: GuideRegionId): readonly TripStop[] {
  return TRIP_PLAN[region];
}
