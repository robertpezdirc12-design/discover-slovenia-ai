/**
 * I18N PICK — kanon izvirnika Discover-Slovenia-AI (navigation.tsx).
 *
 * Komponente nosijo LOKALNI dvojezični slovar:
 *   const L = { sl: "Odpri košarico", en: "Open cart" } as const;
 *   const t = pick(useLocale(), L);
 * namesto globalnih messages datotek. Slovensko je vedno resnica;
 * angleščina je prekrivni prevod po istem ključu.
 */

/** Vsi podprti jeziki lupine (širijo se po fazah: it/de/fr/es kasneje). */
export type PickLocale = "sl" | "en";

/** Vrni besedilo za aktivni locale; neznan locale → slovenščina (privzeta). */
export function pick<T>(locale: string, dict: Record<PickLocale, T>): T {
  return locale === "en" ? dict.en : dict.sl;
}

/** Kratek jezikovni nagovor (npr. za aria-label razlago). */
export function localeName(locale: string): string {
  return pick(locale, { sl: "Slovenščina", en: "English" });
}
