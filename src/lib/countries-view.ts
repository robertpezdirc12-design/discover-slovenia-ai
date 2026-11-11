/**
 * DRŽAVE V SPUSTNEM OKENCU — izbira + pogledi (flyTo ob izbiri).
 *
 * Uporabnikov tok: v spustnem okencu izbereš državo (Slovenija, Hrvaška,
 * Bosna …) → zemljevid se približa izbrani državi. Na zemljevidu ni pinov
 * držav. Pogledi prirejeni iz repozitorija discover-slovenia-ai
 * (BALKAN_COUNTRY_VIEWS).
 */

export interface CountryView {
  id: string;
  name: string;
  flag: string;
  lat: number;
  lng: number;
  zoom: number;
  /** Kratek opis za oblaček ob izbiri države. */
  hint: string;
}

export const REGION_VIEW = { lat: 44.9, lng: 16.4, zoom: 5.4 } as const;

/** Slovenia fit-bounds za prikaz vseh apartmajev naenkrat. */
export const SLOVENIA_BOUNDS: [[number, number], [number, number]] = [
  [45.4, 13.35],
  [46.9, 16.65],
];

export const COUNTRIES: readonly CountryView[] = [
  {
    id: 'slovenija',
    name: 'Slovenija',
    flag: '🇸🇮',
    lat: 46.1,
    lng: 14.8,
    zoom: 7.4,
    hint: 'Zdaj izberi »Apartmaji« v istem okencu — pokažejo se vsi apartmaji v državi.',
  },
  {
    id: 'hrvaska',
    name: 'Hrvaška',
    flag: '🇭🇷',
    lat: 45.4,
    lng: 16.5,
    zoom: 6.4,
    hint: 'Prikaz prenočišč prihaja kmalu.',
  },
  {
    id: 'bosna-hercegovina',
    name: 'Bosna in Hercegovina',
    flag: '🇧🇦',
    lat: 44.2,
    lng: 17.9,
    zoom: 7,
    hint: 'Prikaz prenočišč prihaja kmalu.',
  },
  {
    id: 'srbija',
    name: 'Srbija',
    flag: '🇷🇸',
    lat: 44.0,
    lng: 20.9,
    zoom: 7,
    hint: 'Prikaz prenočišč prihaja kmalu.',
  },
  {
    id: 'kosovo',
    name: 'Kosovo',
    flag: '🇽🇰',
    lat: 42.55,
    lng: 20.9,
    zoom: 8.4,
    hint: 'Prikaz prenočišč prihaja kmalu.',
  },
  {
    id: 'crna-gora',
    name: 'Črna gora',
    flag: '🇲🇪',
    lat: 42.75,
    lng: 19.2,
    zoom: 8,
    hint: 'Prikaz prenočišč prihaja kmalu.',
  },
  {
    id: 'albanija',
    name: 'Albanija',
    flag: '🇦🇱',
    lat: 41.0,
    lng: 20.0,
    zoom: 8,
    hint: 'Prikaz prenočišč prihaja kmalu.',
  },
  {
    id: 'severna-makedonija',
    name: 'Severna Makedonija',
    flag: '🇲🇰',
    lat: 41.5,
    lng: 21.7,
    zoom: 8,
    hint: 'Prikaz prenočišč prihaja kmalu.',
  },
];

export function countryById(id: string | null): CountryView | null {
  if (!id) return null;
  return COUNTRIES.find((c) => c.id === id) ?? null;
}
