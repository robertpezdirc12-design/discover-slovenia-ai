/**
 * JESENSKE DESTINACIJE — kuriran izbor (vinske ceste + kostanj).
 *
 * Skriptni, statični podatki (brez API-ja): znane jesenske točke po
 * Balkanu, kjer jesen ponuja vinske ceste ali kostanj. UI jih prikaže
 * kot ločen sloj na zemljevidu z gumbom »Dodaj v pot«.
 */

export type AutumnCategory = 'vino' | 'kostanj';

export interface AutumnDestination {
  id: string;
  name: string;
  category: AutumnCategory;
  country: string;
  lat: number;
  lng: number;
  /** Kratek opis (esejska jesenska nota). */
  note: string;
}

export const AUTUMN_CATEGORY_LABELS: Record<AutumnCategory, string> = {
  vino: 'Vinske ceste',
  kostanj: 'Kostanj',
};

export const AUTUMN_DESTINATIONS: readonly AutumnDestination[] = [
  // ——— Slovenija: vino ———
  {
    id: 'jesen-vino-jeruzalem',
    name: 'Jeruzalem, Ljutomer',
    category: 'vino',
    country: 'Slovenija',
    lat: 46.477,
    lng: 16.182,
    note: 'Razgledne vinske griče in šipkovo jesensko barvanje — prva slovenska vinska turistična pot.',
  },
  {
    id: 'jesen-vino-maribor',
    name: 'Maribor — najstarejša trta',
    category: 'vino',
    country: 'Slovenija',
    lat: 46.557,
    lng: 15.645,
    note: 'Žametovka iz leta 1558 ob Lentu; trgatev septembra je mestni praznik.',
  },
  {
    id: 'jesen-vino-brda',
    name: 'Goriška Brda',
    category: 'vino',
    country: 'Slovenija',
    lat: 45.99,
    lng: 13.55,
    note: 'Griči vinske dežele z braide, fuge in kleti — jesenska trgatev.',
  },
  {
    id: 'jesen-vino-kras',
    name: 'Kras — Teran',
    category: 'vino',
    country: 'Slovenija',
    lat: 45.75,
    lng: 13.75,
    note: 'Teran ob pršutu in kraškem kruhu; jesenski Kras diši po jesih in teranu.',
  },
  // ——— Hrvaška: vino ———
  {
    id: 'jesen-vino-motovun',
    name: 'Motovun, Istra',
    category: 'vino',
    country: 'Hrvaška',
    lat: 45.335,
    lng: 13.828,
    note: 'Istrska Malvazija in tartufi obale Mirne — idealna jesenska kombinacija.',
  },
  {
    id: 'jesen-vino-peljesac',
    name: 'Pelješac — Dingač',
    category: 'vino',
    country: 'Hrvaška',
    lat: 42.94,
    lng: 17.28,
    note: 'Dingač in Postup na strmih pobočjih; jesensko dozorevanje rdečega vina.',
  },
  // ——— Srbija: vino ———
  {
    id: 'jesen-vino-fruska',
    name: 'Fruška Gora',
    category: 'vino',
    country: 'Srbija',
    lat: 45.16,
    lng: 19.68,
    note: 'Samostani in vinske kleti ob Fruškogorskih cestah — Bermet in škrlet.',
  },
  // ——— Makedonija: vino ———
  {
    id: 'jesen-vino-tikves',
    name: 'Tikveš — Kavadarci',
    category: 'vino',
    country: 'Severna Makedonija',
    lat: 41.43,
    lng: 22.01,
    note: 'Največje makedonsko vinorodno okrožje; jesenske trgatve ob Tikveškem jezeru.',
  },
  // ——— Slovenija: kostanj ———
  {
    id: 'jesen-kostanj-kostanjevica',
    name: 'Kostanjevica na Krki',
    category: 'kostanj',
    country: 'Slovenija',
    lat: 45.846,
    lng: 15.421,
    note: 'Samostan in breg ob Krki; praženi kostanj in kostanjev žganec — klasika.',
  },
  {
    id: 'jesen-kostanj-smarje',
    name: 'Šmarje pri Jelšah',
    category: 'kostanj',
    country: 'Slovenija',
    lat: 46.23,
    lng: 15.52,
    note: 'Kostanjev sejem in kostanj vsako jesen — kraljestvo kostanja.',
  },
  {
    id: 'jesen-kostanj-cerknica',
    name: 'Cerkniško jezero — okolica',
    category: 'kostanj',
    country: 'Slovenija',
    lat: 45.76,
    lng: 14.37,
    note: 'Notranjski gozdovi kostanja ob presihajočem jezeru; jesensko nabiranje.',
  },
  // ——— Hrvaška: kostanj ———
  {
    id: 'jesen-kostanj-lovran',
    name: 'Lovran, Istra',
    category: 'kostanj',
    country: 'Hrvaška',
    lat: 45.29,
    lng: 14.27,
    note: 'Lovranski marun in festival kostanja ob obali Kvarnerja.',
  },
  {
    id: 'jesen-kostanj-samobor',
    name: 'Samobor',
    category: 'kostanj',
    country: 'Hrvaška',
    lat: 45.8,
    lng: 15.71,
    note: 'Samoborski kostanj in kremšnite — jesenski izlet blizu Zagreba.',
  },
];

/** Pomožno: filtriraj po kategoriji (ali vrni vse). */
export function autumnByCategory(category: AutumnCategory | null): readonly AutumnDestination[] {
  if (!category) return AUTUMN_DESTINATIONS;
  return AUTUMN_DESTINATIONS.filter((d) => d.category === category);
}
