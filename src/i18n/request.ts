import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

/**
 * Strežniška konfiguracija next-intl.
 *
 * OPOMBA O VZORCU PREVODOV: komponente aplikacije sledijo kanonu izvirnika —
 * lokalni dvojezični slovar `const L = { sl: {…}, en: {…} }` + `useLocale()`
 * (glej src/lib/i18n-pick.ts). Sporočila next-intl (messages) se zato ne
 * uporabljajo za UI besedila; datoteki messages/{sl,en}.json obstajata kot
 * prazni ogrodji za morečne prihodnje potrebe (npr. ob vključitvi it/de/fr/es).
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
