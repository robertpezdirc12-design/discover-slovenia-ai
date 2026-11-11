/**
 * MUZEJI V SLOVENIJI — kuriran katalog uradnih muzejev (skriptno, brez API-ja).
 *
 * Vir: javno znani podatki o slovenskih muzejih (muzejske ustanove,
 * mestni gradovi, tehniški in etnografski muzeji). Koordinate so
 * približne (natančnost ~100 m) in informativne — za obisk preveri
 * uradno stran muzeja. Namen: »Iščem → Muzeji« vrne PRAVE muzeje z
 * opisom, ne splošnih mestnih rezerv.
 */

export interface Museum {
  id: string;
  name: string;
  /** Kraj (mesto). */
  city: string;
  /** Kratek opis (en stavek). */
  desc: string;
  lat: number;
  lng: number;
  /** Uradna spletna stran (samo zanesljive domene). */
  website?: string;
}

export const MUSEUMS: readonly Museum[] = [
  // ——— Ljubljana ———
  {
    id: 'narodni-muzej',
    name: 'Narodni muzej Slovenije',
    city: 'Ljubljana',
    desc: 'Najstarejši slovenski muzej: arheologija, numizmatika in steklena zbirka (Prešernova cesta).',
    lat: 46.0518,
    lng: 14.5063,
    website: 'https://www.narodni-muzej.si',
  },
  {
    id: 'narodna-galerija',
    name: 'Narodna galerija',
    city: 'Ljubljana',
    desc: 'Glavna umetnostna zbirka: slovenska umetnost od srednjega veka do 20. stoletja.',
    lat: 46.0522,
    lng: 14.5032,
    website: 'https://www.ng-slo.si',
  },
  {
    id: 'etnografski-muzej',
    name: 'Slovenski etnografski muzej',
    city: 'Ljubljana',
    desc: 'Ljudska kultura, vsakdan in identitete — na Metelkovi, z rednimi razstavami.',
    lat: 46.0545,
    lng: 14.5152,
    website: 'https://www.etno-muzej.si',
  },
  {
    id: 'msum',
    name: 'MSUM — Muzej sodobne umetnosti',
    city: 'Ljubljana',
    desc: 'Sodobna umetnost in Arteast zbirka (Metelkova 10).',
    lat: 46.0553,
    lng: 14.5165,
    website: 'https://www.msum.si',
  },
  {
    id: 'cekinov-grad',
    name: 'Muzej novejše zgodovine (Cekinov grad)',
    city: 'Ljubljana',
    desc: 'Zgodovina 20. stoletja v Cekinovem gradu ob Tivoliju.',
    lat: 46.0589,
    lng: 14.4938,
    website: 'https://www.mnzs.si',
  },
  {
    id: 'zeleznicni-muzej',
    name: 'Železniški muzej',
    city: 'Ljubljana',
    desc: 'Parne lokomotive in železniška zgodovina na Ljubljanski postaji.',
    lat: 46.0505,
    lng: 14.5218,
    website: 'https://www.zeleznicnimuzej.si',
  },
  {
    id: 'mao',
    name: 'Muzej za arhitekturo in oblikovanje (MAO)',
    city: 'Ljubljana',
    desc: 'Arhitektura, oblikovanje in Plečnikova zapuščina na Fužinskem gradu.',
    lat: 46.0478,
    lng: 14.5252,
    website: 'https://mao.si',
  },
  {
    id: 'plecnikov-muzej',
    name: 'Muzej Josipa Plečnika',
    city: 'Ljubljana',
    desc: 'Plečnikovo hiša in delavnica (Karunova ulica).',
    lat: 46.0469,
    lng: 14.5090,
  },
  {
    id: 'solski-muzej',
    name: 'Slovenski šolski muzej',
    city: 'Ljubljana',
    desc: 'Zgodovina šolstva od 18. stoletja naprej.',
    lat: 46.0483,
    lng: 14.5105,
  },
  // ——— Okolica Ljubljane ———
  {
    id: 'tehnicni-bistra',
    name: 'Tehniški muzej Slovenije (Bistra)',
    city: 'Bistra pri Vrhniki',
    desc: 'Grad Bistra: vozila, letala, lovstvo in tehnika — največji tehniški muzej.',
    lat: 45.9628,
    lng: 14.2750,
    website: 'https://www.tms.si',
  },
  {
    id: 'postni-muzej',
    name: 'Poštni in telekomunikacijski muzej',
    city: 'Polhov Gradec',
    desc: 'Zgodovina pošte in telekomunikacij na Polhograjskem.',
    lat: 46.0268,
    lng: 14.3727,
  },
  // ——— Gorenjska ———
  {
    id: 'gorenjski-muzej',
    name: 'Gorenjski muzej (Kieselstein)',
    city: 'Kranj',
    desc: 'Gorenjska zgodovina v Kaščeli in na Kieselsteinovem gradu.',
    lat: 46.2415,
    lng: 14.2795,
  },
  {
    id: 'muzej-radovljica',
    name: 'Muzej Radovljica',
    city: 'Radovljica',
    desc: 'Čebelarstvo, urarstvo in zgodovina kraja v Radovljiški graščini.',
    lat: 46.3430,
    lng: 14.1730,
  },
  {
    id: 'muzej-talcev',
    name: 'Muzej talcev (Begunje)',
    city: 'Begunje na Gorenjskem',
    desc: 'Spomin na II. svetovno vojno na Gorenjskem (Kacenštajn).',
    lat: 46.3455,
    lng: 14.2075,
  },
  // ——— Štajerska / Dolenjska ———
  {
    id: 'pm-maribor',
    name: 'Pokrajinski muzej Maribor (grad)',
    city: 'Maribor',
    desc: 'Najstarejša trta, grad in regionalna zgodovina Maribora.',
    lat: 46.5559,
    lng: 15.6472,
  },
  {
    id: 'ugm',
    name: 'Umetnostna galerija Maribor',
    city: 'Maribor',
    desc: 'Slovenska umetnost 20. stoletja v centru Maribora.',
    lat: 46.5565,
    lng: 15.6470,
    website: 'https://www.ugm.si',
  },
  {
    id: 'mno-maribor',
    name: 'Muzej narodne osvoboditve',
    city: 'Maribor',
    desc: 'Uporniška in vojna zgodovina Maribora (Vetrinjska ulica).',
    lat: 46.5542,
    lng: 15.6525,
  },
  {
    id: 'pm-celje',
    name: 'Pokrajinski muzej Celje',
    city: 'Celje',
    desc: 'Grofje Celjski, rimsko Celeio in steklarska zbirka (Muzejski trg).',
    lat: 46.2392,
    lng: 15.2605,
  },
  {
    id: 'pm-ptuj',
    name: 'Pokrajinski muzej Ptuj (Ptujski grad)',
    city: 'Ptuj',
    desc: 'Najstarejše slovensko mesto: glasbila, grajske zbirke, kurenti.',
    lat: 46.3975,
    lng: 15.8700,
    website: 'https://www.pmpo.si',
  },
  {
    id: 'zasavski-muzej',
    name: 'Zasavski muzej Trbovlje',
    city: 'Trbovlje',
    desc: 'Rudarska in industrijska zgodovina Zasavja.',
    lat: 46.1540,
    lng: 15.0500,
  },
  {
    id: 'muzej-velenje',
    name: 'Muzej Velenje (Velenjski grad)',
    city: 'Velenje',
    desc: 'Moderni muzej na gradu: umetnost, kultura in rudarstvo.',
    lat: 46.3585,
    lng: 15.1110,
  },
  {
    id: 'dolenjski-muzej',
    name: 'Dolenjski muzej',
    city: 'Novo mesto',
    desc: 'Situla iz Vač, arheologija in dolenjska zgodovina (Glavni trg).',
    lat: 45.8035,
    lng: 15.1670,
  },
  {
    id: 'posavski-muzej',
    name: 'Posavski muzej Brežice (grad)',
    city: 'Brežice',
    desc: 'Baročna grajska dvorana in zgodovina Posavja.',
    lat: 45.9040,
    lng: 15.5895,
  },
  // ——— Primorska ———
  {
    id: 'pm-koper',
    name: 'Pokrajinski muzej Koper',
    city: 'Koper',
    desc: 'Belo krajino in istrsko-benetsko zgodovino (Kidričeva ulica).',
    lat: 45.5475,
    lng: 13.7295,
  },
  {
    id: 'pm-piran',
    name: 'Pokrajinski muzej Piran',
    city: 'Piran',
    desc: 'Pomorska in solinska zgodovina obale (Piran in Portorož).',
    lat: 45.5270,
    lng: 13.7320,
  },
  {
    id: 'pm-gorica',
    name: 'Pokrajinski muzej Goriške (Kromberk)',
    city: 'Nova Gorica',
    desc: 'Kromberški grad: goriška zgodovina in umetnost.',
    lat: 45.9410,
    lng: 13.6530,
  },
  // ——— Notranjska / Primorska-notranjost ———
  {
    id: 'notranjski-muzej',
    name: 'Notranjski muzej Postojna',
    city: 'Postojna',
    desc: 'Notranjska narava, jamski svet in zgodovina kraja.',
    lat: 45.7755,
    lng: 14.2135,
  },
  // ——— Koroška ———
  {
    id: 'koroski-muzej',
    name: 'Koroški pokrajinski muzej',
    city: 'Slovenj Gradec',
    desc: 'Koroška umetnost in zgodovina (Glavni trg).',
    lat: 46.5095,
    lng: 15.0790,
    website: 'https://www.kpm.si',
  },
  // ——— Zasavje / Posavje ———
  {
    id: 'muzej-idrija',
    name: 'Muzej za Idrijo (Gewerkenegg)',
    city: 'Idrija',
    desc: 'Živosrebrni rudnik (UNESCO) in čipkarska zapuščina v Gewerkeneggovem gradu.',
    lat: 45.9985,
    lng: 14.0260,
    website: 'https://www.muzej-idrija-cerkno.si',
  },
  // ——— Dolenjska/jug ———
  {
    id: 'belokranjski-muzej',
    name: 'Belokranjski muzej',
    city: 'Metlika',
    desc: 'Bela krajina: pečine, panonske grobnice in ljudska kultura.',
    lat: 45.6535,
    lng: 15.3180,
  },
  {
    id: 'kocevski-muzej',
    name: 'Pokrajinski muzej Kočevje',
    city: 'Kočevje',
    desc: 'Kočevarji, gozdovi in medvedi — zgodovina Kočevske.',
    lat: 45.6435,
    lng: 14.8600,
  },
  {
    id: 'kamnik-muzej',
    name: 'Medobčinski muzej Kamnik (Zaprice)',
    city: 'Kamnik',
    desc: 'Kamniška zgodovina in zbirka dvorcev na Zapriškem gradu.',
    lat: 46.2250,
    lng: 14.6115,
  },
  {
    id: 'pomurski-muzej',
    name: 'Pomurski muzej (Murska Sobota)',
    city: 'Murska Sobota',
    desc: 'Prekmurje na Soboskem gradu: arheologija in etnologija.',
    lat: 46.6555,
    lng: 16.1570,
  },
  {
    id: 'lendava-muzej',
    name: 'Galerija-Muzej Lendava',
    city: 'Lendava',
    desc: 'Lendavska zgodovina in večkulturna zapuščina Prekmurja.',
    lat: 46.5645,
    lng: 16.4465,
  },
];

/** Približna meja Slovenije (za validacijo koordinat). */
const SI_BBOX = { minLat: 45.3, maxLat: 46.9, minLng: 13.3, maxLng: 16.8 };

/** Varnostna validacija kataloga ob uvozu (fail-fast v testih). */
for (const m of MUSEUMS) {
  if (!(m.lat >= SI_BBOX.minLat && m.lat <= SI_BBOX.maxLat)) {
    throw new Error(`museums: ${m.id} lat izven meja (${m.lat})`);
  }
  if (!(m.lng >= SI_BBOX.minLng && m.lng <= SI_BBOX.maxLng)) {
    throw new Error(`museums: ${m.id} lng izven meja (${m.lng})`);
  }
}
