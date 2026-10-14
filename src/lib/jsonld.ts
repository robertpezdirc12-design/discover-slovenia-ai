/**
 * JSON-LD GRADILNIKI — SEO strukturrirani podatki (POLIR C, 2.28.0).
 *
 * Navdih: MonkeyTravel rich results (schema.org SoftwareApplication s
 * featureList). Dva čista gradilnika (deterministični objekti, brez Reacta
 * in brez next/headers — primerna za pogodbene teste):
 *  · softwareApplicationJsonLd(locale) — aplikacija (domača stran);
 *  · touristDestinationJsonLd(d, locale) — destinacija (/destinacija/[slug]).
 *
 * ISKRENOSTNI KANON (enak kot povsod v repozitoriju):
 *  · featureList vsebuje IZKLJUČNO funkcije, ki res obstajajo v kodi
 *    (preverjeno proti README/2.24–2.27: deterministični motor, Go Mode s
 *    PWA offline, 6 jezikov, PDF, .ics, skupinske poti, skriptni @AI
 *    svetovalec z viri Open-Meteo/STO, 74 kuriranih destinacij);
 *  · offers.price = "0" — načrtovanje JE brezplačno (checkout je demo
 *    fail-closed, brez Stripe ključev ni nobenega plačila);
 *  · TouristDestination ima samo polja, ki res obstajajo v podatkih
 *    (name/description = slovenski kanon; geo = realne koordinate
 *    destinacij; image = realne fotografije iz public/content).
 *
 * CSP: izpis v straneh poteka prek <script type="application/ld+json"
 * nonce={nonce}> — nonce z zahteve postavi middleware (x-nonce), glej
 * src/middleware.ts + src/lib/csp.ts (inline skripta brez nonca bi bila
 * pod produkcjsko CSP blokirana).
 */

import { asPickLocale, pick, type PickDict } from "./i18n-pick";
import { localePrefixPath } from "@/i18n/routing";
import { isEventPast, type CommunityEvent } from "./content-data";
import type { Destination } from "./slovenia-data";

/**
 * Kanonski javni izvor strani za absolutne URL-je v JSON-LD.
 * Enaka prednost kot src/lib/email.ts publicOrigin: izrecni
 * NEXT_PUBLIC_SITE_URL (samo https), sicer produkcijski naslov
 * (i-feel-slovenia.vercel.app — živo potrjen v worklogu 8-14).
 */
const envSite = process.env.NEXT_PUBLIC_SITE_URL;
export const JSONLD_SITE_ORIGIN: string =
  envSite && /^https:\/\//.test(envSite)
    ? envSite.replace(/\/$/, "")
    : "https://i-feel-slovenia.vercel.app";

/** Vsi jeziki aplikacije (kanon i18n-pick PICK_LOCALES). */
const APP_LANGUAGES: readonly string[] = ["sl", "en", "it", "de", "fr", "es"];

/**
 * Resnične funkcije aplikacije ×6 jezikov (sl = kanon). Vrstni red je
 * fiksen in enak v vseh jezikih — tests/jsonld-schema.test.ts zaklene
 * število (8) in iskrenost (»deterministi«, »0 AI«), da bodočega
 * marketinga brez resnice ne morem vpisati tiho.
 */
const FEATURES: PickDict<string[]> = {
  sl: [
    "Deterministični načrtovalnik potovanj — isti vhod vedno da isti načrt (0 AI)",
    "Go Mode: izvedba na poti z delovanjem brez povezave (PWA offline)",
    "6 jezikov vmesnika: sl, en, it, de, fr, es",
    "Izvoz načrta v PDF",
    "Izvoz dogodkov v koledar (.ics)",
    "Deljene skupinske poti (vabila, ankete, rezervacije, klepet)",
    "@AI svetovalec z živimi viri (Open-Meteo, STO slovenia.info) — deterministične skripte, 0 AI modelov",
    "74 kuriranih destinacij (cel Balkan — 10 držav)",
  ],
  en: [
    "Deterministic travel planner — the same input always yields the same plan (0 AI)",
    "Go Mode: on-the-road execution that works offline (PWA offline)",
    "6 interface languages: sl, en, it, de, fr, es",
    "Plan export to PDF",
    "Calendar export (.ics)",
    "Shared group trips (invitations, polls, reservations, chat)",
    "@AI advisor with live sources (Open-Meteo, STO slovenia.info) — deterministic scripts, 0 AI models",
    "74 curated destinations (the entire Balkans — 10 countries)",
  ],
  it: [
    "Pianificatore di viaggio deterministico — lo stesso input dà sempre lo stesso piano (0 AI)",
    "Go Mode: esecuzione in viaggio con funzionamento offline (PWA offline)",
    "6 lingue d'interfaccia: sl, en, it, de, fr, es",
    "Esportazione del piano in PDF",
    "Esportazione degli eventi nel calendario (.ics)",
    "Viaggi di gruppo condivisi (inviti, sondaggi, prenotazioni, chat)",
    "Consulente @AI con fonti in tempo reale (Open-Meteo, STO slovenia.info) — script deterministici, 0 modelli AI",
    "74 destinazioni curate (tutti i Balcani — 10 paesi)",
  ],
  de: [
    "Deterministischer Reiseplaner — dieselbe Eingabe ergibt immer denselben Plan (0 KI)",
    "Go Mode: Umsetzung unterwegs mit Offline-Funktion (PWA offline)",
    "6 Oberflächensprachen: sl, en, it, de, fr, es",
    "Planexport als PDF",
    "Kalenderexport (.ics)",
    "Geteilte Gruppenreisen (Einladungen, Umfragen, Reservierungen, Chat)",
    "@AI-Berater mit Live-Quellen (Open-Meteo, STO slovenia.info) — deterministische Skripte, 0 KI-Modelle",
    "74 kuratierte Reiseziele (der ganze Balkan — 10 Länder)",
  ],
  fr: [
    "Planificateur de voyage déterministe — la même entrée donne toujours le même plan (0 IA)",
    "Go Mode : déroulé en route avec fonctionnement hors ligne (PWA hors ligne)",
    "6 langues d'interface : sl, en, it, de, fr, es",
    "Export du plan en PDF",
    "Export des événements vers le calendrier (.ics)",
    "Voyages de groupe partagés (invitations, sondages, réservations, chat)",
    "Conseiller @AI avec sources en direct (Open-Meteo, STO slovenia.info) — scripts déterministes, 0 modèle d'IA",
    "74 destinations curatées (tous les Balkans — 10 pays)",
  ],
  es: [
    "Planificador de viajes determinista — la misma entrada da siempre el mismo plan (0 IA)",
    "Go Mode: ejecución en ruta con funcionamiento sin conexión (PWA sin conexión)",
    "6 idiomas de interfaz: sl, en, it, de, fr, es",
    "Exportación del plan a PDF",
    "Exportación de eventos al calendario (.ics)",
    "Viajes de grupo compartidos (invitaciones, encuestas, reservas, chat)",
    "Asesor @AI con fuentes en vivo (Open-Meteo, STO slovenia.info) — guiones deterministas, 0 modelos de IA",
    "74 destinos curados (todos los Balcanes — 10 países)",
  ],
};

export interface SoftwareApplicationLd {
  "@context": "https://schema.org";
  "@type": "SoftwareApplication";
  name: string;
  applicationCategory: string;
  operatingSystem: string;
  url: string;
  offers: { "@type": "Offer"; price: string; priceCurrency: string };
  inLanguage: string[];
  featureList: string[];
}

export interface TouristDestinationLd {
  "@context": "https://schema.org";
  "@type": "TouristDestination";
  name: string;
  description: string;
  url: string;
  image: string;
  geo: { "@type": "GeoCoordinates"; latitude: number; longitude: number };
}

/**
 * SoftwareApplication za domačo stran v danem jeziku.
 * Neznan locale → slovenščina (iskrena rezerva, nikoli ugibanje — kanon
 * asPickLocale). URL sledi hreflang konvenciji (sl brez predpone).
 */
export function softwareApplicationJsonLd(locale: string): SoftwareApplicationLd {
  const lang = asPickLocale(locale);
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Discover Slovenia AI",
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    url: `${JSONLD_SITE_ORIGIN}${localePrefixPath(lang)}/`,
    // Iskrenost: načrtovanje je res brezplačno (demo checkout fail-closed).
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    inLanguage: [...APP_LANGUAGES],
    featureList: [...pick(lang, FEATURES)],
  };
}

/**
 * TouristDestination za /destinacija/[slug] v danem jeziku.
 * SAMO polja, ki res obstajajo v kanonskih podatkih: name/description sta
 * slovenski kanon (prekrivnih prevodov opisov ni v podatkih — iskrena
 * odsotnost, ne izmišljanje), geo so realne koordinate destinacije,
 * image je realna fotografija iz public/content (absolutni URL).
 */
export function touristDestinationJsonLd(
  d: Destination,
  locale: string
): TouristDestinationLd {
  const lang = asPickLocale(locale);
  return {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: d.name,
    description: d.description,
    url: `${JSONLD_SITE_ORIGIN}${localePrefixPath(lang)}/destinacija/${d.slug}`,
    image: `${JSONLD_SITE_ORIGIN}${d.image}`,
    geo: {
      "@type": "GeoCoordinates",
      latitude: d.coords.lat,
      longitude: d.coords.lng,
    },
  };
}

/**
 * Event (@graph) za /dogodki v danem jeziku (vzor MySwitzerland: Event
 * JSON-LD na koledarju prireditev — raziskava benchmarka #35, R-5-c2a).
 *
 * ISKRENOSTNI KANON (QA #38, najožja varovala):
 *  · @graph vsebuje SAMO dogodke s POTRJENIM datumom (dateStart ≠ "" IN
 *    !dateUnconfirmed) — schema.org Event z izmišljenim startDate bi
 *    pomenil objavo ugibanja kot resnice; nepotrjeni ostanejo vidni v UI
 *    („datum še ni potrjen“), a NIKOLI v strukturiranih podatkih.
 *  · startDate = dateStart iz kanona (ISO), NE iz dateLabel prikaza.
 *  · location = Place z imenom prizorišča 1:1 iz podatkov + država SI;
 *    addressLocality NE ugibamo (venue formati so heterogeni: „Metlika,
 *    Bela krajina“ je mesto+regija, „Koper in Izola“ sta dve mesti) —
 *    Google Event rich result zahteva Place, pošteno ime prizorišča je zadostno.
 *  · endDate IZPUŠČEN — podatki vsebujejo samo začetek; izmišljenega
 *    trajanja ne vpisujemo (Google priporoča, a ne zahteva endDate).
 *  · isAccessibleForFree: true IZKLJUČNO za price "free" (resnična
 *    lastnost); euro/euro2 simboli niso numerična cena → offers izpuščen.
 *  · url = kanonični naslov strani, ki dogodek opisuje (/dogodki) po
 *    hreflang konvenciji; uradna stran organizatorja v podatkih ni
 *    per-dogodek landing stran našega spletišča.
 */
export interface EventLd {
  "@type": "Event";
  name: string;
  url: string;
  image: string;
  description: string;
  startDate: string;
  location: {
    "@type": "Place";
    name: string;
    address: { "@type": "PostalAddress"; addressCountry: string };
  };
  isAccessibleForFree?: boolean;
}

export interface EventsGraphLd {
  "@context": "https://schema.org";
  "@graph": EventLd[];
}

export function eventsJsonLd(
  events: readonly CommunityEvent[],
  locale: string,
  todayIso?: string
): EventsGraphLd {
  const lang = asPickLocale(locale);
  const listUrl = `${JSONLD_SITE_ORIGIN}${localePrefixPath(lang)}/dogodki`;
  const confirmed = events.filter(
    (e) => e.dateStart !== "" && !e.dateUnconfirmed
  );
  // #38 (2.48.0): dogodki, ki so že ZAKLJUČENI ob danem dnevu, ne grejo v
  // strukturirane podatke (Google: ne označuj že zaključenih dogodkov —
  // bogat rezultat sme zavajati). Filtrira se po isEventPast (dateEnd
  // ?? dateStart); brez `todayIso` (pogodbene teste/čisti podatkovni
  // pogled) se zaključeni ne filtrirajo — stran /dogodki podaja SSR datum.
  const upcoming =
    todayIso !== undefined
      ? confirmed.filter((e) => !isEventPast(e, todayIso))
      : confirmed;
  return {
    "@context": "https://schema.org",
    "@graph": upcoming.map((e) => ({
      "@type": "Event",
      name: e.title,
      url: listUrl,
      image: `${JSONLD_SITE_ORIGIN}${e.image}`,
      description: e.description,
      startDate: e.dateStart,
      location: {
        "@type": "Place",
        name: e.venue,
        address: { "@type": "PostalAddress", addressCountry: "SI" },
      },
      ...(e.price === "free" ? { isAccessibleForFree: true } : {}),
    })),
  };
}

/**
 * TouristDestination za /drzava/[code] v danem jeziku (#41 Faza 3, 2.57.0).
 * ISKRENOSTNI KANON (enak kot touristDestinationJsonLd zgoraj):
 *  · name/description = 6-jezični SEO kanon države (src/lib/countries-seo)
 *    v AKTIVNEM jeziku — prekrivni prevodi obstajajo, zato jih tudi uporabimo;
 *  · geo = središče, IZPELJANO iz kuriranih destinacij države (min/max oklep
 *    → sredina, countryGeoCenter) — ni izmišljene koordinate; null center
 *    (država brez vsebine) → geo polje IZPUŠČENO (pošteno, ne ugibamo);
 *  · image IZPUŠČEN — države nimajo lastnih binarnih sredstev (pravilo
 *    emoji zastav), izmišljene slike ne izpisujemo.
 */
export interface CountryTouristDestinationLd {
  "@context": "https://schema.org";
  "@type": "TouristDestination";
  name: string;
  description: string;
  url: string;
  geo?: { "@type": "GeoCoordinates"; latitude: number; longitude: number };
}

export function countryTouristDestinationJsonLd(
  code: string,
  locale: string,
  name: string,
  description: string,
  center: { lat: number; lng: number } | null,
): CountryTouristDestinationLd {
  const lang = asPickLocale(locale);
  return {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name,
    description,
    url: `${JSONLD_SITE_ORIGIN}${localePrefixPath(lang)}/drzava/${code}`,
    ...(center
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: center.lat,
            longitude: center.lng,
          },
        }
      : {}),
  };
}

/**
 * Varno telo za <script type="application/ld+json" dangerouslySetInnerHTML>:
 * JSON.stringify + ubežniška zamenjava '<' → \u003c (kanon Next.js JSON-LD
 * vodnika). Izpis nikoli ne more vsebovati zaporedja </script> — ni odprtega
 * XHTML/HTML vektorja; \u003c je veljaven JSON ubežni znak (JSON.parse ga
 * vrne nazaj v '<').
 */
export function jsonldScriptHtml(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
