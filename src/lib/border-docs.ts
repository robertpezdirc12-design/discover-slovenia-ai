/**
 * BORDER-DOCS — mejni prehodi in potovalni dokumenti (F5, #41).
 *
 * Iskrenostni kanon #38: SAMO preverjeni trditvi ali jasno označeno
 * "preveri pri uradnem viru". Nič izmišljenih pravil.
 *
 * ŽIVO PREVERJENO (curl 200 + vsebina izvlečena, 2026-10-14):
 *  · home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/schengen-area_en
 *    — Schengen 29 držav; "Bulgaria and Romania being the last countries
 *    to join on 1 January 2025" → SI/HR/GR/BG so članice, ME/AL/BA/RS/
 *    MK/XK NISO (izpeljano iz uradnega seznama 29 članic).
 *  · europa.eu/youreurope/citizens/travel/entry-exit/eu-citizen/index_en.htm
 *    — EU državljani potujejo po EU/Čengnu "carrying either a valid
 *    passport or a national identity card (ID card)".
 *
 * NISMO preverili (omrežna omejitev ob pisanju — MZV gateway SSL/503):
 *  · vstop z osebno izkaznico v izvenschengenske države (ME/AL/BA/RS/MK/XK).
 *    Zato je spodnja vrstica za te države IZRECNO usmerjena k uradnemu
 *    viru MZV (drzave.mzz.gov.si) — ne trdi ničesar, kar ni potrjeno.
 *  · MZV per-country URL vzorci so kanonski naslovi (well-known), a
 *    trenutno niso curl-200 potrdjeni — zato nosijo status "reference".
 */

import { COUNTRIES } from "./countries-data";
import type { CountryCode } from "./slovenia-data";

/** Povezava do uradnega EU termina (Schengen članstvo — curl 200, 2026-10-14). */
export const SCHENGEN_SOURCE_URL =
  "https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/schengen-area_en";

/** Povezava do uradnega EU vira (dokumenti EU državljanov — curl 200, 2026-10-14). */
export const EU_DOCS_SOURCE_URL =
  "https://europa.eu/youreurope/citizens/travel/entry-exit/eu-citizen/index_en.htm";

/**
 * MZV država po državi (kanonski vzorec; status "reference" — glej glavo).
 */
export function mzzCountryUrl(code: string): string {
  const slug = MZZ_SLUGS[code.toUpperCase()] ?? "";
  return slug ? `https://www.drzave.mzz.gov.si/${slug}/` : "https://www.gov.si/drzave-in-podrocja/";
}

const MZZ_SLUGS: Record<string, string> = {
  SI: "slovenija",
  HR: "hrvaska",
  ME: "crna-gora",
  AL: "albanija",
  BA: "bosna-in-hercegovina",
  RS: "srbija",
  MK: "severna-makedonija",
  XK: "kosovo",
  BG: "bulgarija",
  GR: "grcija",
};

/**
 * Schengen članice v naboru (curl 200 vir zgoraj; seznam 29 članic —
 * izpeljava: nabor SI/HR/GR/BG je v seznamu, ostalih 6 ni).
 */
export const SCHENGEN_CODES: ReadonlySet<string> = new Set(["SI", "HR", "GR", "BG"]);

export interface BorderDocLine {
  sl: string;
  en: string;
  it: string;
  de: string;
  fr: string;
  es: string;
}

/** Vrsta bloka za UI: per-državna vrstica + vir. */
export interface BorderDocCountry {
  code: CountryCode;
  flag: string;
  nameSl: string;
  schengen: boolean;
  currency: string;
  doc: BorderDocLine;
  /** Uradni MZV vir za to državo (reference — glej glavo). */
  mzzUrl: string;
}

/**
 * Vrstice dokumentnih pogojev. Zgradimo iz kategorij (Schengen/notri vs.
 * izvenschengensko), da ne podvajamo besedila — in vsaka trditev zrcali
 * vrsto dokaza v glavi modula.
 */
export function borderDocFor(code: CountryCode): BorderDocCountry {
  const meta = COUNTRIES[code];
  const schengen = SCHENGEN_CODES.has(code);
  return {
    code,
    flag: meta.flag,
    nameSl: meta.names.sl,
    schengen,
    currency: meta.currency,
    doc: schengen
      ? {
          sl: "Potni list ALI osebna izkaznica — znotraj Schengena zadošča eno od obojega (veljavno na dan potovanja).",
          en: "Passport OR national ID card — inside Schengen either suffices (valid on the day of travel).",
          it: "Passaporto O carta d'identità — all'interno di Schengen basta uno dei due (valido il giorno del viaggio).",
          de: "Reisepass ODER Personalausweis — in Schengen genügt eines von beiden (am Reisetag gültig).",
          fr: "Passeport OU carte d'identité — dans Schengen, l'un des deux suffit (valide le jour du voyage).",
          es: "Pasaporte O DNI — dentro de Schengen basta uno de los dos (válido el día del viaje).",
        }
      : code === "XK"
        ? {
            sl: "Veljaven potni list priporočeno; za Kosovo veljajo posebna pravila — pogoje vstopa preveri pri MZV RS pred potovanjem.",
            en: "A valid passport is recommended; special rules apply for Kosovo — check entry conditions with the Slovenian MFA before travel.",
            it: "È consigliato un passaporto valido; per il Kosovo valgono regole particolari — verifica le condizioni d'ingresso con il MFA sloveno prima del viaggio.",
            de: "Ein gültiger Reisepass wird empfohlen; für den Kosovogelten Sonderregeln — prüfe die Einreisebedingungen beim slowenischen MFA vor der Reise.",
            fr: "Un passeport valide est recommandé ; des règles spéciales s'appliquent au Kosovo — vérifie les conditions d'entrée auprès du MAE slovène avant le voyage.",
            es: "Se recomienda un pasaporte válido; para Kosovo se aplican reglas especiales — consulta las condiciones de entrada con el MFA esloveno antes de viajar.",
          }
        : {
            sl: "Veljaven potni list; ali zadošča osebna izkaznica, preveri pri uradnem viru MZV RS pred potovanjem (pogoji se spreminjajo).",
            en: "A valid passport; whether an ID card suffices, check with the official Slovenian MFA source before travel (conditions change).",
            it: "Un passaporto valido; se basta la carta d'identità, verifica presso la fonte ufficiale MFA slovena prima del viaggio (le condizioni cambiano).",
            de: "Ein gültiger Reisepass; ob ein Personalausweis genügt, prüfe bei der offiziellen slowenischen MFA-Quelle vor der Reise (Bedingungen ändern sich).",
            fr: "Un passeport valide ; si une carte d'identité suffit, vérifie auprès de la source officielle du MAE slovène avant le voyage (les conditions changent).",
            es: "Un pasaporte válido; si basta el DNI, consúltalo en la fuente oficial del MFA esloveno antes de viajar (las condiciones cambian).",
          },
    mzzUrl: mzzCountryUrl(code),
  };
}

/** Blok za UI za vse države v načrtu (vrstni red prvih pojavitev). */
export function borderDocBlock(countries: string[]): BorderDocCountry[] {
  const seen = new Set<string>();
  const out: BorderDocCountry[] = [];
  for (const c of countries) {
    const code = c.toUpperCase();
    if (!seen.has(code) && code in COUNTRIES) {
      seen.add(code);
      out.push(borderDocFor(code as CountryCode));
    }
  }
  return out;
}

/** Ali blok nosi sporočilo o Schengenu (vsaj ena schengenska država)? */
export function blockTouchesSchengen(countries: string[]): boolean {
  return countries.some((c) => SCHENGEN_CODES.has(c.toUpperCase()));
}
