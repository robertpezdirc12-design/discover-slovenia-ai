/**
 * GO-OFFLINE — čista logika stanja povezave za Go Mode „Na poti“
 * (QA U12, produkcija 2.27.0, 2026-10-11).
 *
 * Ugotovitev QA: Go Mode offline deluje (napredek je lokalno), a vreme
 * tiho izgine brez opombe „ni povezave“ in nikjer ni živega kazalnika
 * povezave (raziskava R2). Ta modul nosi PRESLIKAVE (×6 jezikov) in
 * ČISTE odločitve za obe popravki — brez Reacta in brez DOM-a (isti
 * vzorec kot go-gps.ts / weather.ts), tako da ju zaklene bun test.
 *
 * Iskrenostna načela (kanon projekta):
 *  - „offline“ in „napaka servisa“ sta RAZLIČNI vzroka — ne krivimo
 *    povezave, ki deluje, ne skrivamo povezave, ki je ni;
 *  - vreme, ki se ob odklopu še prikazuje, je pošteno oznakovano kot
 *    shranjeno (nosi čas pridobitve fetchedAt — nikoli „sveže“ laži);
 *  - navigator.onLine je le PROXY stanja; omrežna napaka poizvedbe
 *    (ali zasilni 503 { offline: true } service workerja) je trden
 *    dokaz, da povezave ni — zato štejeta oba signala.
 */

import type { PickLocale } from "@/lib/i18n-pick";

/** Stanje povezave naprave (navigator.onLine + dogodka online/offline). */
export type OnlineStatus = "online" | "offline";

/** Vrsta napake vremenske poizvedbe (glej fetchStopWeather v weather.ts). */
export type WeatherFailureKind = "network" | "service";

/**
 * Oznaka živega kazalnika povezave ×6 jezikov (sl = resnica, ostali
 * prekrivni prevodi) — zelena pika „Povezano“ / siva pika „Brez povezave“
 * v glavi Go Mode (nevsiljivo, ne blokira UI-ja med vožnjo/pohodom).
 */
export const CONNECTION_LABELS: Readonly<
  Record<OnlineStatus, Readonly<Record<PickLocale, string>>>
> = {
  online: {
    sl: "Povezano",
    en: "Connected",
    it: "Connesso",
    de: "Verbunden",
    fr: "Connecté",
    es: "Conectado",
  },
  offline: {
    sl: "Brez povezave",
    en: "No connection",
    it: "Nessuna connessione",
    de: "Ohne Verbindung",
    fr: "Sans connexion",
    es: "Sin conexión",
  },
};

/**
 * Iskrena opomba, kadar vreme ni na voljo ZARADI povezave (QA U12):
 * stoji točno tam, kjer bi bilo vreme — ne tiha izginotja.
 */
export const WEATHER_OFFLINE_NOTE: Readonly<Record<PickLocale, string>> = {
  sl: "Ni povezave — vreme ni na voljo.",
  en: "No connection — weather is unavailable.",
  it: "Nessuna connessione — il meteo non è disponibile.",
  de: "Keine Verbindung — das Wetter ist nicht verfügbar.",
  fr: "Pas de connexion — la météo n’est pas disponible.",
  es: "Sin conexión — el tiempo no está disponible.",
};

/**
 * Oznaka vremena, ki se ob odklopu še prikazuje (QA U12): podatek je bil
 * pridobljen, medtem ko je povezava še delovala — bodisi v pomnilniku
 * komponente bodisi prek zasilnega predpomnilnika service workerja
 * (api-public, network-first). Funkcija prejme URO pridobitve
 * (fetchedAt, oblika HH:MM), da oznaka nikoli laže o starosti.
 */
export const WEATHER_CACHED_LABEL: Readonly<
  Record<PickLocale, (time: string) => string>
> = {
  sl: (time) => `shranjeno ob ${time}`,
  en: (time) => `cached at ${time}`,
  it: (time) => `salvato alle ${time}`,
  de: (time) => `gespeichert um ${time}`,
  fr: (time) => `enregistré à ${time}`,
  es: (time) => `guardado a las ${time}`,
};

/** Katera opomba vremenske kartice velja (null = brez opombe). */
export type WeatherNoticeKind = "offline" | "unavailable" | null;

/**
 * Čista odločitev, katera opomba vremenske kartice velja (QA U12):
 *  - "offline": poizvedba je padla IN naprava je brez povezave oz. je
 *    omrežje samo odpovedalo (failureKind "network" — npr. zasilni
 *    503 { offline: true } SW-ja ali zavrnitev fetch) — iskren RAZLOG;
 *  - "unavailable": napaka ob POVEZANI napravi, ki je dosegla strežnik
 *    (502/429/napačna oblika) — ne krivimo povezave, ki deluje;
 *  - null: vreme je prikazano ali se še nalaga (nič tihega).
 *
 * Prioriteta: prikazano vreme vedno izpodrine opombo (opomba opisuje le
 * odsotnost vremena); enako velja za stanje pred prvim odzivom.
 */
export function weatherNotice(input: {
  online: boolean;
  /** Vrsta zadnje napake poizvedbe ali null (še ni odgovora / uspeh). */
  failureKind: WeatherFailureKind | null;
  hasWeather: boolean;
}): WeatherNoticeKind {
  if (input.hasWeather) return null;
  if (input.failureKind === null) return null;
  if (!input.online || input.failureKind === "network") return "offline";
  return "unavailable";
}

/**
 * Ali naj prikazano vreme ob odklopu nosi oznako „shranjeno ob HH:MM“?
 * (Podatek obstaja iz časov, ko je povezava še delovala — pošteno ga
 * razkrijemo kot shranjen, nikoli kot svež.)
 */
export function showsCachedWeather(input: {
  online: boolean;
  hasWeather: boolean;
}): boolean {
  return !input.online && input.hasWeather;
}
