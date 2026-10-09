/**
 * INTL-LOCALE — datumski Intl tag po jeziku (4-c, PRODUCT-AUDIT §9).
 *
 * Do 2.20.0 so vsa toLocaleDateString/toLocaleString vrata hardkodirala
 * `lang === "en" ? "en-GB" : "sl-SI"` — it/de/fr/es uporabniki so dobili
 * slovenske datume. Ta modul je enoten vir: isti tag povsod, neznan
 * locale → sl-SI (iskren fallback, nikoli ugibanje).
 *
 * Client-safe (čisti podatki, brez Node API-jev).
 */

import type { PickLocale } from "./i18n-pick";

/** ICU/Intl tag po podprtem jeziku (datumi, števila, ure). */
export const INTL_DATE_LOCALE: Record<PickLocale, string> = {
  sl: "sl-SI",
  en: "en-GB",
  it: "it-IT",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
};

/**
 * Datumski Intl tag za poljuben niz lokala (useLocale() / param).
 * Neznana vrednost → "sl-SI" (isti fallback kot pick()).
 */
export function intlDateLocale(l: string | undefined | null): string {
  return (INTL_DATE_LOCALE as Record<string, string>)[l ?? ""] ?? "sl-SI";
}
