/**
 * I18N PICK — kanon izvirnika Discover-Slovenia-AI (navigation.tsx).
 *
 * Komponente nosijo LOKALNI večjezični slovar:
 *   const L = { sl: "Odpri košarico", en: "Open cart", it: "Apri il carrello" } as const;
 *   const t = pick(useLocale(), L);
 * namesto globalnih messages datotek. Slovensko je vedno resnica;
 * ostali jeziki so prekrivni prevodi po istem ključu.
 *
 * DELNI SLOVARJI (48-b): slovarji so lahko delni — "sl" je edini OBAVEZNI
 * vnos (resnica/fallback); en/it/de/fr/es so neobvezni. Kadar slovar nima
 * vnosa za aktivni jezik, pick() vrne slovenski vnos. Tako stare komponente
 * z { sl, en } ostanejo veljavne in se postopoma nadgrajujejo na 6 jezikov.
 */

/** Vsi podprti jeziki lupine (sl privzet; en/it/de/fr/es s predpono poti). */
export type PickLocale = "sl" | "en" | "it" | "de" | "fr" | "es";

/** Lokalni slovar pick(): sl obvezen, ostali jeziki neobvezni (fallback sl). */
export type PickDict<T> = { sl: T } & Partial<
  Record<Exclude<PickLocale, "sl">, T>
>;

/**
 * Pogosta oblika (delnega) slovarja za interni izbor vnosa — vrednost "sl"
* je kanonski tip, ki ga pick() vrne (ostali jeziki imajo isto obliko).
 */
type LoosePickDict = { sl: unknown } & Partial<Record<PickLocale, unknown>>;

/** Vrednost slovarskega vnosa "sl" (kanonski tip rezultata pick()). */
type SlValue<D extends LoosePickDict> = D extends { sl: infer T } ? T : never;

/** Kanonski seznam jezikov (vrstni red LanguageSwitcherja). */
export const PICK_LOCALES: readonly PickLocale[] = [
  "sl",
  "en",
  "it",
  "de",
  "fr",
  "es",
];

/** Ali je niz ena od podprtih jezikovnih kod? */
export function isPickLocale(value: string): value is PickLocale {
  return PICK_LOCALES.includes(value as PickLocale);
}

/**
 * Normaliziraj poljuben niz (npr. useLocale()) na podprti jezik.
 * Neznana/nedoločena vrednost → "sl" (iskren fallback, nikoli ugibanje).
 * Uporaba: kadar stroga funkcija zahteva PickLocale (npr. PlannerLang
 * vrata v itinerary-engine, weatherLabel, statusLabel), ne pa pick()
 * slovarja.
 */
export function asPickLocale(l: string | undefined | null): PickLocale {
  return isPickLocale(l ?? "") ? (l as PickLocale) : "sl";
}

/**
 * Vrni besedilo za aktivni locale iz (delnega) slovarja.
 * - neznan locale → slovenščina (privzeta)
 * - slovar brez vnosa za aktivni locale → slovenščina (fallback)
 *
 * Tip: rezultat nosi tip vnosa "sl" (kanon); vnosi za ostale jezike
 * imajo po dogovoru isto obliko, a se jim pri preverbi tipov ne
 * vsiljuje dobesedna enakost literarlov (različni prevodi!).
 */
export function pick<D extends LoosePickDict>(
  locale: string,
  dict: D
): SlValue<D>;
export function pick(locale: string, dict: LoosePickDict): unknown {
  if (isPickLocale(locale) && locale !== "sl") {
    const v = dict[locale];
    if (v !== undefined) return v;
  }
  return dict.sl;
}

/** Jeziki aplikacije za izbirnik: koda, kratka oznaka, domače ime. */
export const APP_LANGUAGES: ReadonlyArray<{
  code: PickLocale;
  short: string;
  native: string;
}> = [
  { code: "sl", short: "SL", native: "Slovenščina" },
  { code: "en", short: "EN", native: "English" },
  { code: "it", short: "IT", native: "Italiano" },
  { code: "de", short: "DE", native: "Deutsch" },
  { code: "fr", short: "FR", native: "Français" },
  { code: "es", short: "ES", native: "Español" },
];

/** Kratek jezikovni nagovor (npr. za aria-label razlago). */
export function localeName(locale: string): string {
  switch (locale) {
    case "en":
      return "English";
    case "it":
      return "Italiano";
    case "de":
      return "Deutsch";
    case "fr":
      return "Français";
    case "es":
      return "Español";
    default:
      return "Slovenščina";
  }
}
