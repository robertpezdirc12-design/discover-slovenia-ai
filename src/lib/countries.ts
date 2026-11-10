/**
 * DRŽAVE BALKANA — kurirane praktične informacije (Faza D).
 *
 * Namen: uporabnik, ki načrtuje pot čez mejo, dobi poštena, nevtralna
 * dejstva o prevozu in mejah — brez API-ja, brez ključev. Vsebina je
 * informativna: za uradne vstopne pogoje uporabnik preveri uradne vire.
 * Ne nadomešča diplomatskih navodil.
 */

import type { GuideRegionId } from '@/lib/guide-store';

export interface CountryInfo {
  /** Ime države (slovensko). */
  name: string;
  /** EU članica? */
  eu: boolean;
  /** V območju Schengen? */
  schengen: boolean;
  /** Glavni prevozni vozli (avtobus/vlak/trajekt/letališče). */
  transport: readonly string[];
  /** Praktične opombe (vstop, gotovina, meje). */
  tips: readonly string[];
  /** Uradne/koristne povezave (informativne). */
  links: readonly { label: string; url: string }[];
}

/** Preslikava regij vodiča v informacije o državah. */
export const REGION_COUNTRY: Partial<Record<GuideRegionId, CountryInfo>> = {
  hrvaska: {
    name: 'Hrvaška',
    eu: true,
    schengen: true,
    transport: [
      'Avtobusi: Zagreb je glavno vozlišče (Avtobusni kolodvor Zagreb).',
      'Vlak: HŽPP — povezave Zagreb–Split, Zagreb–Rijeka, Zagreb–Osijek.',
      'Trajekti: Jadrolinija (Split–Ancona, Rijeka, otoki).',
      'Letališča: Zagreb, Split, Dubrovnik, Zadar.',
    ],
    tips: [
      'Članica EU in Schengena — za državljane EU zadostuje osebna izkaznica.',
      'Valuta je EUR (od 2023); plačilo s kartico je splošno sprejeto.',
      'Med sezono na obali rezerviraj trajekt zgodaj.',
    ],
    links: [
      { label: 'Jadrolinija (trajekti)', url: 'https://www.jadrolinija.hr' },
      { label: 'HŽPP (vlaki)', url: 'https://www.hzpp.hr' },
    ],
  },
  'bosna-hercegovina': {
    name: 'Bosna in Hercegovina',
    eu: false,
    schengen: false,
    transport: [
      'Avtobusi: Sarajevo, Mostar in Banja Luka — povezave z Zagrebom, Beogradom in obalo.',
      'Vlak: slikovita proga Sarajevo–Mostar (Čapljina).',
      'Letališča: Sarajevo, Tuzla, Banja Luka (nizkoproračunske sezonske povezave).',
    ],
    tips: [
      'Ni članica EU/Schengena — mejne kontrole so običajne; za državljane EU velja brezvizumski vstop do 90 dni.',
      'Valuta je konvertibilna marka (BAM); gotovina je pogosto bolj zaželena.',
      'Gorski prelazi so pozimi lahko zaprti — preveri razmere na cestah.',
    ],
    links: [
      { label: 'FlixBus (avtobusi)', url: 'https://www.flixbus.com/bosnia-and-herzegovina' },
      { label: 'Letališče Sarajevo', url: 'https://sarajevo-airport.ba' },
    ],
  },
  srbija: {
    name: 'Srbija',
    eu: false,
    schengen: false,
    transport: [
      'Avtobusi: Beograd (glavna avtobusna postaja) — povezave s celo regijo.',
      'Vlak: ŽS — Beograd–Novi Sad–Subotica; nočni vlak Beograd–Bar (Črna gora).',
      'Letališča: Beograd (BEG), Niš (INI), sezonsko Novi Sad.',
      'Reka: križarjenja po Donavi.',
    ],
    tips: [
      'Ni članica EU/Schengena — za državljane EU brezvizumski vstop do 90 dni.',
      'Valuta je srbski dinar (RSD); na večjih mestih je sprejemljivo plačilo s kartico.',
      'Ob mejah z EU je promet ob koncih tedna lahko gost.',
    ],
    links: [
      { label: 'Srbijanske železnice (ŽS)', url: 'https://srbvoz.rs' },
      { label: 'Letališče Beograd', url: 'https://www.beg.aero' },
    ],
  },
  kosovo: {
    name: 'Kosovo',
    eu: false,
    schengen: false,
    transport: [
      'Avtobusi: Priština in Prizren — povezave z Albanijo, Makedonijo in Črno goro.',
      'Letališče: Priština (PRN) — povezave z glavnimi evropskimi vozlišči.',
      'Medkrajevni avtobusi so glavni način prevoza; vlakovna mreža je skromna.',
    ],
    tips: [
      'Ni članica EU/Schengena — za državljane EU velja brezvizumski vstop (do 90 dni).',
      'Valuta je EUR (unilateralno); gotovina je pogosto bolj zaželena.',
      'Za podrobnejše vstopne pogoje preveri uradne vire (veljavnost potnih listin).',
    ],
    links: [
      { label: 'Letališče Priština', url: 'https://www.pristinaairport.com' },
      { label: 'Uradni turistični portal', url: 'https://www.visitkosovo.com' },
    ],
  },
  'crna-gora': {
    name: 'Črna gora',
    eu: false,
    schengen: false,
    transport: [
      'Avtobusi: obala (Budva, Kotor) in Podgorica — sezonske povezave s celo regijo.',
      'Trajekti: Bar–Bari (Italija); turistične ladje po zalivu Boka.',
      'Letališči: Podgorica (TGD) in Tivat (TIV).',
      'Vlak: proga Beograd–Bar (skozi kanjon Mala Rijeka).',
    ],
    tips: [
      'Ni članica EU/Schengena — za državljane EU brezvizumski vstop do 90 dni.',
      'Valuta je EUR (unilateralno); kartice so sprejete na večjih mestih.',
      'Obala je poleti zelo zasedena — nastanitve in trajekti se polnijo zgodaj.',
    ],
    links: [
      { label: 'Montenegro Airlines / letališča', url: 'https://www.montenegroairports.com' },
      { label: 'Nacionalni turistični portal', url: 'https://www.montenegro.travel' },
    ],
  },
  albanija: {
    name: 'Albanija',
    eu: false,
    schengen: false,
    transport: [
      'Avtobusi: Tirana (glavna postaja) — povezave z Grčijo, Makedonijo, Črno goro in Kosovom.',
      'Letališče: Tirana (TIA) — dobra povezanost z Evropo.',
      'Trajekt: Drač–Bari/Ancona (Italija).',
      'Obala: lokalni avtobusi vzdolž rivijere.',
    ],
    tips: [
      'Ni članica EU/Schengena — za državljane EU brezvizumski vstop do 90 dni.',
      'Valuta je albanski lek (ALL); gotovina je v manjših krajih nujna.',
      'Promet v mestih je živaben; pešpoti so pogosto boljša izbira.',
    ],
    links: [
      { label: 'Letališče Tirana', url: 'https://tirana-airport.com' },
      { label: 'Nacionalni turistični portal', url: 'https://www.albania.al' },
    ],
  },
  'severna-makedonija': {
    name: 'Severna Makedonija',
    eu: false,
    schengen: false,
    transport: [
      'Avtobusi: Skopje — glavno regionalno vozlišče (Sofija, Tirana, Solun, Beograd).',
      'Vlak: kratka, slikovita proga Skopje–Bitola.',
      'Letališče: Skopje (SKP); sezonsko Ohrid (OHD).',
      'Jezero Ohrid: čolni in obalne povezave.',
    ],
    tips: [
      'Ni članica EU/Schengena — za državljane EU brezvizumski vstop do 90 dni.',
      'Valuta je makedonski denar (MKD); evri so pogosto sprejeti, a z neugodnim tečajem.',
      'Poravnaj lokalno valuto — večina menjalnic je v mestih.',
    ],
    links: [
      { label: 'Letališče Skopje', url: 'https://skopje-airport.com.mk' },
      { label: 'FlixBus (avtobusi)', url: 'https://www.flixbus.com/north-macedonia' },
    ],
  },
};

/** Informacije za regijo; za Slovenijo (in neznane) vrne null. */
export function countryInfoForRegion(regionId: GuideRegionId | null): CountryInfo | null {
  if (!regionId) return null;
  return REGION_COUNTRY[regionId] ?? null;
}

/** Pogledi (središče + zoom) za navigacijo po državah na zemljevidu. */
export interface CountryView {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
}

export const BALKAN_COUNTRY_VIEWS: readonly CountryView[] = [
  { id: 'slovenija', name: 'Slovenija', lat: 46.1, lng: 14.8, zoom: 7 },
  { id: 'hrvaska', name: 'Hrvaška', lat: 45.4, lng: 16.5, zoom: 6 },
  { id: 'bosna-hercegovina', name: 'Bosna in Hercegovina', lat: 44.2, lng: 17.9, zoom: 7 },
  { id: 'srbija', name: 'Srbija', lat: 44.0, lng: 20.9, zoom: 7 },
  { id: 'kosovo', name: 'Kosovo', lat: 42.55, lng: 20.9, zoom: 9 },
  { id: 'crna-gora', name: 'Črna gora', lat: 42.75, lng: 19.2, zoom: 8 },
  { id: 'albanija', name: 'Albanija', lat: 41.0, lng: 20.0, zoom: 8 },
  { id: 'severna-makedonija', name: 'Severna Makedonija', lat: 41.5, lng: 21.7, zoom: 8 },
];
