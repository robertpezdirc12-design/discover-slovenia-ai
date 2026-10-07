import { defineRouting } from "next-intl/routing";

/**
 * I18N USMERJANJE (kanon izvirnika Discover-Slovenia-AI):
 * - sl = privzeti jezik BREZ predpone (localePrefix: "as-needed")
 * - en/it/de/fr/es = polna pot s predpono (/en/destinacije, /it/destinacije …)
 *   — vseh 6 jezikov izvirnika (naloga 48-b).
 */
export const routing = defineRouting({
  locales: ["sl", "en", "it", "de", "fr", "es"],
  defaultLocale: "sl",
  localePrefix: "as-needed",
  // Produkcija streže SL na "/" VSEM obiskovalcem (mirror potrjen) —
  // brez samodejnega zaznavanja jezika brskalnika; uporabnik preklopi
  // ročno prek LanguageSwitcherja.
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];

/** Locale → predpona poti ("" za privzeti sl, "/en" za angleščino). */
export function localePrefixPath(locale: string): string {
  return locale === routing.defaultLocale ? "" : `/${locale}`;
}
