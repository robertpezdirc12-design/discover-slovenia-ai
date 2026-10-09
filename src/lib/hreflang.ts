/**
 * HREFLANG POMOČNIK — kanon izvirnika Discover-Slovenia-AI (48-b).
 *
 * Strani prek generateMetadata izjavijo alternates: vsakemu jeziku ena
 * pot (sl brez predpone = privzeta; en/it/de/fr/es s predpono poti) +
 * x-default, ki kaže na privzeti (slovenski) vnos. Canonical je pot v
 * AKTIVNEM jeziku, da si vsak jezikni vnos ne prilasti tujih obiskov.
 */

import { routing } from "@/i18n/routing";

export interface PageAlternates {
  canonical: string;
  languages: Record<string, string>;
}

/**
 * HREFLANG ALTERNATES za podano pot v podanem jeziku.
 * - sl (privzeti) streže pot BREZ predpone; en/it/de/fr/es s predpono.
 * - canonical = pot v AKTIVNEM jeziku; x-default = privzeta (sl) pot.
 */
export function alternatesFor(locale: string, path: string): PageAlternates {
  const p = path.startsWith("/") ? path : `/${path}`;
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    languages[loc] = loc === routing.defaultLocale ? p : `/${loc}${p}`;
  }
  languages["x-default"] = p;
  const canonical = locale === routing.defaultLocale ? p : `/${locale}${p}`;
  return { canonical, languages };
}
