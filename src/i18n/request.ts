import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

/**
 * Strežniška konfiguracija next-intl.
 *
 * OPOMBA O VZORCU PREVODOV: komponente aplikacije sledijo kanonu izvirnika —
 * lokalni večjezični slovar `const L = { sl: {…}, en: {…}, it: {…} … }` +
 * `useLocale()` (glej src/lib/i18n-pick.ts). Sporočila next-intl (messages)
 * se zato ne uporabljajo za UI besedila; datoteke messages/{sl,en,it,de,fr,es}
 * .json nosijo le skupne ključe (meta naslovi/opisi za generateMetadata).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
