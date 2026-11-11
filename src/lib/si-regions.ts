/**
 * SLOVENSKE REGIJE — poštena preslikava krajev v regije za skupine v UI.
 *
 * Nominatim vrača kraj (city/town/village) — za preglednejši seznam v
 * stranski plošči apartmaje združimo po regijah. Preslikava je kurirana
 * (najpogostejši kraji); neznan kraj → "Drugo".
 */

export const SI_REGIONS = [
  'Gorenjska',
  'Primorska',
  'Notranjska',
  'Dolenjska',
  'Štajerska',
  'Koroška',
  'Prekmurje',
  'Zasavje in Posavje',
  'Osrednja Slovenija',
  'Drugo',
] as const;

export type SiRegion = (typeof SI_REGIONS)[number];

/** Kuriran seznam: ime kraja (malo črke, brez šumnikov za toleranco) → regija. */
const CITY_REGION: Record<string, SiRegion> = {
  // Osrednja Slovenija
  ljubljana: 'Osrednja Slovenija',
  'skofja loka': 'Osrednja Slovenija',
  vrhnika: 'Osrednja Slovenija',
  logatec: 'Osrednja Slovenija',
  horjul: 'Osrednja Slovenija',
  'polhov gradec': 'Osrednja Slovenija',
  ig: 'Osrednja Slovenija',
  preserje: 'Osrednja Slovenija',
  borovnica: 'Osrednja Slovenija',
  menges: 'Osrednja Slovenija',
  trzin: 'Osrednja Slovenija',
  moravce: 'Osrednja Slovenija',
  litija: 'Osrednja Slovenija',
  'smartno pri litiji': 'Osrednja Slovenija',
  grosuplje: 'Osrednja Slovenija',
  dobrepolje: 'Osrednja Slovenija',
  'velike lasce': 'Osrednja Slovenija',

  // Gorenjska
  bled: 'Gorenjska',
  bohinj: 'Gorenjska',
  'ribcev laz': 'Gorenjska',
  ukanc: 'Gorenjska',
  'kranjska gora': 'Gorenjska',
  'gozd martuljek': 'Gorenjska',
  ratece: 'Gorenjska',
  planica: 'Gorenjska',
  jesenice: 'Gorenjska',
  radovljica: 'Gorenjska',
  'begunje na gorenjskem': 'Gorenjska',
  trzic: 'Gorenjska',
  'cerklje na gorenjskem': 'Gorenjska',
  kranj: 'Gorenjska',
  naklo: 'Gorenjska',
  preddvor: 'Gorenjska',
  jezersko: 'Gorenjska',
  'zgornje jezersko': 'Gorenjska',
  zirovnica: 'Gorenjska',
  'gorenja vas': 'Gorenjska',
  ziri: 'Gorenjska',
  sorica: 'Gorenjska',
  zelezniki: 'Gorenjska',

  // Primorska
  piran: 'Primorska',
  portoroz: 'Primorska',
  lucija: 'Primorska',
  'porta portoroz': 'Primorska',
  izola: 'Primorska',
  koper: 'Primorska',
  ankaran: 'Primorska',
  divaca: 'Primorska',
  sezana: 'Primorska',
  komen: 'Primorska',
  dutovlje: 'Primorska',
  'nova gorica': 'Primorska',
  ajdovscina: 'Primorska',
  vipava: 'Primorska',
  'vipavski kriz': 'Primorska',
  'sempeter pri gorici': 'Primorska',
  rence: 'Primorska',
  tolmin: 'Primorska',
  kobarid: 'Primorska',
  bovec: 'Primorska',
  'log pod mangartom': 'Primorska',
  dreznica: 'Primorska',
  'most na soci': 'Primorska',
  idrija: 'Primorska',
  crkno: 'Primorska',
  cerkno: 'Primorska',

  // Notranjska
  postojna: 'Notranjska',
  pivka: 'Notranjska',
  'ilirska bistrica': 'Notranjska',
  loz: 'Notranjska',
  'stari trg pri lozu': 'Notranjska',
  cerknica: 'Notranjska',
  rakek: 'Notranjska',
  bloke: 'Notranjska',
  'loska dolina': 'Notranjska',

  // Dolenjska in Bela krajina
  'novo mesto': 'Dolenjska',
  krsko: 'Dolenjska',
  brezice: 'Dolenjska',
  'catez ob savi': 'Dolenjska',
  sevnica: 'Dolenjska',
  trebnje: 'Dolenjska',
  'dolenjske toplice': 'Dolenjska',
  'smarjeske toplice': 'Dolenjska',
  zuzemberk: 'Dolenjska',
  ribnica: 'Dolenjska',
  kocevje: 'Dolenjska',
  crnomelj: 'Dolenjska',
  metlika: 'Dolenjska',
  semic: 'Dolenjska',
  osilnica: 'Dolenjska',
  straza: 'Dolenjska',
  sentjernej: 'Dolenjska',
  'kostanjevica na krki': 'Dolenjska',
  mirna: 'Dolenjska',

  // Štajerska
  maribor: 'Štajerska',
  ptuj: 'Štajerska',
  'slovenske konjice': 'Štajerska',
  zrece: 'Štajerska',
  rogla: 'Štajerska',
  podcetrtek: 'Štajerska',
  'rogaska slatina': 'Štajerska',
  'smarje pri jelsah': 'Štajerska',
  celje: 'Štajerska',
  lasko: 'Štajerska',
  'rimske toplice': 'Štajerska',
  velenje: 'Štajerska',
  'slovenska bistrica': 'Štajerska',
  ruse: 'Štajerska',
  'radlje ob dravi': 'Štajerska',
  'selnica ob dravi': 'Štajerska',
  'lovrenc na pohorju': 'Štajerska',
  pesnica: 'Štajerska',
  lenart: 'Štajerska',
  ljutomer: 'Štajerska',
  'gornja radgona': 'Štajerska',
  sentilj: 'Štajerska',
  mislinja: 'Štajerska',
  'mariborsko pohorje': 'Štajerska',
  pohorje: 'Štajerska',

  // Koroška
  'slovenj gradec': 'Koroška',
  'ravne na koroskem': 'Koroška',
  dravograd: 'Koroška',
  mezica: 'Koroška',
  'crna na koroskem': 'Koroška',
  prevalje: 'Koroška',

  // Prekmurje
  'murska sobota': 'Prekmurje',
  'moravske toplice': 'Prekmurje',
  banovci: 'Prekmurje',
  lendava: 'Prekmurje',
  radenci: 'Prekmurje',
  goricko: 'Prekmurje',
  beltinci: 'Prekmurje',
  dobrovnik: 'Prekmurje',
  hodos: 'Prekmurje',

  // Zasavje in Posavje
  'zagorje ob savi': 'Zasavje in Posavje',
  trbovlje: 'Zasavje in Posavje',
  hrastnik: 'Zasavje in Posavje',
  radece: 'Zasavje in Posavje',
};

/** Normalizacija imena kraja: male črke, šumniki → osnovne črke, trim. */
export function normalizeCityName(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/č/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/[ćc]/g, 'c')
    .replace(/đ/g, 'd');
}

/** Regija za kraj ali "Drugo", če kraja ni v kuriranem seznamu. */
export function regionForCity(city: string | null): SiRegion {
  if (!city) return 'Drugo';
  return CITY_REGION[normalizeCityName(city)] ?? 'Drugo';
}

/**
 * Približni geografski okviri regij [south, west, north, east] — rezerva,
 * ko kraja ni v kuriranem seznamu (Nominatim pogosto vrne vas/zaselok).
 * Preverjajo se v vrstnem od najbolj specifičnih; zadostna točnost za
 * skupine v UI, ne za uradno statistiko.
 */
const REGION_BOXES: readonly { region: SiRegion; box: [number, number, number, number] }[] = [
  // Soška dolina (Bovec, Kobarid, Tolmin) — severni del Primorske
  { region: 'Primorska', box: [46.1, 13.35, 46.5, 13.82] },
  // Obala, Vipavska, Goriška, Idrija/Cerkno — južni/nižji del Primorske
  { region: 'Primorska', box: [45.4, 13.35, 46.1, 14.15] },
  // Gorenjska (Bled, Bohinj, Kranj, Jesenice, Kranjska Gora)
  { region: 'Gorenjska', box: [46.15, 13.8, 46.9, 14.55] },
  // Koroška
  { region: 'Koroška', box: [46.4, 14.75, 46.75, 15.45] },
  // Notranjska (Postojna, Cerknica, Pivka)
  { region: 'Notranjska', box: [45.4, 14.05, 46.0, 14.75] },
  // Dolenjska in Bela krajina
  { region: 'Dolenjska', box: [45.4, 14.55, 46.05, 15.85] },
  // Zasavje in Posavje
  { region: 'Zasavje in Posavje', box: [46.0, 14.8, 46.3, 15.35] },
  // Prekmurje
  { region: 'Prekmurje', box: [46.4, 15.9, 46.9, 16.65] },
  // Osrednja Slovenija (Ljubljana z obrobo)
  { region: 'Osrednja Slovenija', box: [45.95, 14.15, 46.35, 15.0] },
];

/**
 * Regija iz kraja (kurirana preslikava) ali — pri neznanem kraju — iz
 * koordinat (približni okviri). Brez obojega → "Drugo".
 */
export function regionForCityWithCoords(
  city: string | null,
  lat?: number,
  lng?: number,
): SiRegion {
  if (city) {
    const byName = CITY_REGION[normalizeCityName(city)];
    if (byName) return byName;
  }
  if (typeof lat === 'number' && typeof lng === 'number') {
    for (const { region, box } of REGION_BOXES) {
      const [south, west, north, east] = box;
      if (lat >= south && lat <= north && lng >= west && lng <= east) return region;
    }
    // Severovzhodni del (Celje, Maribor, Ptuj, Pohorje) — ostali zahodni/južni
    // okviri so že pokriti zgoraj.
    if (lat >= 45.4 && lat <= 46.9 && lng >= 14.55 && lng <= 16.65) return 'Štajerska';
  }
  return 'Drugo';
}
