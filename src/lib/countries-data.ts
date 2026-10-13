/**
 * COUNTRIES-DATA — državna meta balkanske ekspanzije (#41 Faza 0, 2.54.0).
 *
 * Skladno z #35 (docs/research/balkan-platform-no-ai.md, pogl. 2c
 * „Večdržavni podatkovni model — država/regija/kraj kot prvotne
 * dimenzije"): NOVI model ob obstoječih registrih, NE prepis aplikacije.
 * Izhodiščne države (SI/HR/ME/AL) so imele vsebino že prej; F0 doda
 * meta za cel Balkan (BA/RS/MK/XK/BG/GR), da filtri, landing strani
 * (F3) in supply templated povezave (F4) imajo enoten izvor resnice.
 *
 * Iskrenostni kanon (#38): meta je statična referenčna dejstva (ISO,
 * valuta, klicna, emergency); vsebinska državna VSEBINA (destinacije,
 * dogodki) pa je še vedno samo tista, ki je kurirana z virom (F1/F2).
 * Velikost nabora držav ≠ število držav z vsebino (to je Set destinacij).
 */

import type { CountryCode } from "./slovenia-data";

/** Vrednost slovarja imen (isti kanon kot REGIONS v slovenia-data). */
export type CountryNames = {
  sl: string;
  en: string;
  it: string;
  de: string;
  fr: string;
  es: string;
};

/** Valute balkanskih držav (ISO 4217). */
export type CountryCurrency = "EUR" | "BAM" | "RSD" | "MKD" | "ALL" | "BGN";

export interface CountryMeta {
  /** ISO 3166-1 alfa-2 (XK = uporabniška koda za Kosovo — glej glavo). */
  code: CountryCode;
  /** Zastava kot emoji (0 binarnih sredstev — pravilo repa). */
  flag: string;
  /** Ime v 6 jezikih lupine (sl obvezno = resnica; ostali prekrivni). */
  names: CountryNames;
  currency: CountryCurrency;
  /** Primarni jezik vsebine na terenu (ISO 639-1; XK sq/sr — zapis sq). */
  primaryLanguage: string;
  /** Enotna evropska številka za klice v sili; ločene lokalne številke se
   *  navedejo samo, kjer 112 ni primarni (XK: 192/194 kot dopolnilo). */
  emergency: string;
  /** Klicna predpona (brez "+"). */
  phoneCode: string;
  /** eSIM cona za templated affiliate povezave (F4, P0-F vzorec). */
  eSIMZone: "EU/EEA" | "Balkan" | "Evropa";
}

export const COUNTRIES: Record<CountryCode, CountryMeta> = {
  SI: {
    code: "SI",
    flag: "🇸🇮",
    names: {
      sl: "Slovenija",
      en: "Slovenia",
      it: "Slovenia",
      de: "Slowenien",
      fr: "Slovénie",
      es: "Eslovenia",
    },
    currency: "EUR",
    primaryLanguage: "sl",
    emergency: "112",
    phoneCode: "386",
    eSIMZone: "EU/EEA",
  },
  HR: {
    code: "HR",
    flag: "🇭🇷",
    names: {
      sl: "Hrvaška",
      en: "Croatia",
      it: "Croazia",
      de: "Kroatien",
      fr: "Croatie",
      es: "Croacia",
    },
    currency: "EUR",
    primaryLanguage: "hr",
    emergency: "112",
    phoneCode: "385",
    eSIMZone: "EU/EEA",
  },
  ME: {
    code: "ME",
    flag: "🇲🇪",
    names: {
      sl: "Črna gora",
      en: "Montenegro",
      it: "Montenegro",
      de: "Montenegro",
      fr: "Monténégro",
      es: "Montenegro",
    },
    currency: "EUR",
    primaryLanguage: "sr",
    emergency: "112",
    phoneCode: "382",
    eSIMZone: "Balkan",
  },
  AL: {
    code: "AL",
    flag: "🇦🇱",
    names: {
      sl: "Albanija",
      en: "Albania",
      it: "Albania",
      de: "Albanien",
      fr: "Albanie",
      es: "Albania",
    },
    currency: "ALL",
    primaryLanguage: "sq",
    emergency: "112",
    phoneCode: "355",
    eSIMZone: "Balkan",
  },
  BA: {
    code: "BA",
    flag: "🇧🇦",
    names: {
      sl: "Bosna in Hercegovina",
      en: "Bosnia and Herzegovina",
      it: "Bosnia ed Erzegovina",
      de: "Bosnien und Herzegowina",
      fr: "Bosnie-Herzégovine",
      es: "Bosnia y Herzegovina",
    },
    currency: "BAM",
    primaryLanguage: "bs",
    emergency: "112",
    phoneCode: "387",
    eSIMZone: "Balkan",
  },
  RS: {
    code: "RS",
    flag: "🇷🇸",
    names: {
      sl: "Srbija",
      en: "Serbia",
      it: "Serbia",
      de: "Serbien",
      fr: "Serbie",
      es: "Serbia",
    },
    currency: "RSD",
    primaryLanguage: "sr",
    emergency: "112",
    phoneCode: "381",
    eSIMZone: "Balkan",
  },
  MK: {
    code: "MK",
    flag: "🇲🇰",
    names: {
      sl: "Severna Makedonija",
      en: "North Macedonia",
      it: "Macedonia del Nord",
      de: "Nordmazedonien",
      fr: "Macédoine du Nord",
      es: "Macedonia del Norte",
    },
    currency: "MKD",
    primaryLanguage: "mk",
    emergency: "112",
    phoneCode: "389",
    eSIMZone: "Balkan",
  },
  XK: {
    code: "XK",
    flag: "🇽🇰",
    names: {
      sl: "Kosovo",
      en: "Kosovo",
      it: "Kosovo",
      de: "Kosovo",
      fr: "Kosovo",
      es: "Kosovo",
    },
    currency: "EUR",
    primaryLanguage: "sq",
    // Kosovo: 112 se uvaja, primarni sta še vedno policija 192 in
    // reševalna 194 — zapis obe, ker „one number to rule“ tu ne velja.
    emergency: "112/192/194",
    phoneCode: "383",
    eSIMZone: "Balkan",
  },
  BG: {
    code: "BG",
    flag: "🇧🇬",
    names: {
      sl: "Bolgarija",
      en: "Bulgaria",
      it: "Bulgaria",
      de: "Bulgarien",
      fr: "Bulgarie",
      es: "Bulgaria",
    },
    currency: "BGN",
    primaryLanguage: "bg",
    emergency: "112",
    phoneCode: "359",
    eSIMZone: "Evropa",
  },
  GR: {
    code: "GR",
    flag: "🇬🇷",
    names: {
      sl: "Grčija",
      en: "Greece",
      it: "Grecia",
      de: "Griechenland",
      fr: "Grèce",
      es: "Grecia",
    },
    currency: "EUR",
    primaryLanguage: "el",
    emergency: "112",
    phoneCode: "30",
    eSIMZone: "EU/EEA",
  },
};

/** Kanonski vrstni red držav (geografski: sever → jug/vzhod). */
export const ALL_COUNTRY_CODES: readonly CountryCode[] = [
  "SI",
  "HR",
  "BA",
  "RS",
  "ME",
  "XK",
  "AL",
  "MK",
  "BG",
  "GR",
];

/** Nova država F0 (brez vsebine do F1) — za UI oznake „prihaja“. */
export function isNewInF0(code: CountryCode): boolean {
  return !["SI", "HR", "ME", "AL"].includes(code);
}

/** Ime države v aktivnem jeziku (pick kanon: sl fallback). */
export function countryName(locale: string, code: CountryCode): string {
  return COUNTRIES[code].names[locale as keyof CountryNames] ?? COUNTRIES[code].names.sl;
}

/** „🇭🇷 Hrvaška“ — enoten prikaz za filtre in landing strani. */
export function countryLabel(locale: string, code: CountryCode): string {
  return `${COUNTRIES[code].flag} ${countryName(locale, code)}`;
}
