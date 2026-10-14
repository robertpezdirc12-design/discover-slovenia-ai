/**
 * COUNTRIES-SEO — SEO kanon državnih landing strani /drzava/[code]
 * (balkanska ekspanzija #41 Faza 3, 2.57.0).
 *
 * Sledi kanonu P1 SEO (#34 → #38, src/lib/page-metadata.ts): unikaten
 * naslov (8–38 zn brez pripone) + unikaten opis (100–160 zn) PER STRAN
 * PER JEZIK, slovenščina kot resnica, ostali jeziki prekrivni prevodi
 * (pick kanon). Naslovi/opisi NE vsebujejo znamke (pripono doda layout
 * template „ · Discover Slovenia AI“) in NE vsebujejo ranljivih števcev
 * vsebine (števcev destinacij/dogodkov je namenjen count-sync zaklep
 * na SEO_PAGES /destinacije, tukaj jih namenoma NE navajamo — strani
 * računajo realne naborе ob izgradnji).
 *
 * Iskrenostni kanon #38: opisi opisujejo, KAJ stran ponuja (kurirane
 * destinacije, dogodki, lokali s popisanim virom) — ne izmišljujejo
 * števil, datov ali URL-jev.
 */

import type { CountryCode } from "./slovenia-data";
import type { PickDict } from "./i18n-pick";

/** SEO vnos državne landing strani (isti oblikovni kanon kot SeoPage). */
export interface CountrySeo {
  /** Naslov BREZ pripone (layout doda „ · Discover Slovenia AI“). */
  title: PickDict<string>;
  /** Opis 100–160 zn (anti-vzorec: prazen opis ali podvojen brand). */
  description: PickDict<string>;
}

/**
 * SEO slovar za vseh 10 držav (ALL_COUNTRY_CODES vrstni red sever → jug).
 * Ključi so točno CountryCode — zaklepi preverijo parnost s kanonom.
 */
export const COUNTRY_SEO: Record<CountryCode, CountrySeo> = {
  SI: {
    title: {
      sl: "Slovenija — destinacije in dogodki",
      en: "Slovenia — destinations and events",
      it: "Slovenia — destinazioni ed eventi",
      de: "Slowenien — Ziele und Veranstaltungen",
      fr: "Slovénie — destinations et événements",
      es: "Eslovenia — destinos y eventos",
    },
    description: {
      sl: "Vsi kurirani viri za Slovenijo na enem mestu: destinacije od Alp do Jadrana, prireditve po koledarju, lokali in praktične informacije za načrtovanje poti.",
      en: "All curated resources for Slovenia in one place: destinations from the Alps to the Adriatic, calendar of events, venues and practical info for trip planning.",
      it: "Tutte le risorse curate per la Slovenia in un unico luogo: destinazioni dalle Alpi all'Adriatico, eventi, locali e informazioni pratiche.",
      de: "Alle kuratierten Quellen für Slowenien an einem Ort: Destinationen von den Alpen bis zur Adria, Veranstaltungen, Lokale und praktische Infos.",
      fr: "Toutes les ressources sélectionnées pour la Slovénie en un lieu : destinations des Alpes à l'Adriatique, événements, adresses et infos pratiques.",
      es: "Todos los recursos curados para Eslovenia en un lugar: destinos de los Alpes al Adriático, eventos, locales e información práctica.",
    },
  },
  HR: {
    title: {
      sl: "Hrvaška — destinacije in dogodki",
      en: "Croatia — destinations and events",
      it: "Croazia — destinazioni ed eventi",
      de: "Kroatien — Ziele und Veranstaltungen",
      fr: "Croatie — destinations et événements",
      es: "Croacia — destinos y eventos",
    },
    description: {
      sl: "Hrvaška od Istre do Dalmacije: kurirane destinacije, dogodki s filtrom po državi, lokali in praktične informacije — vsak vnos s popisanim virom.",
      en: "Croatia from Istria to Dalmatia: curated destinations, country-filtered events, venues and practical info — every entry with a recorded source.",
      it: "Croazia dall'Istria alla Dalmazia: destinazioni curate, eventi filtrabili per paese, locali e informazioni pratiche, con fonte per ogni voce.",
      de: "Kroatien von Istrien bis Dalmatien: kuratierte Destinationen, nach Land filterbare Veranstaltungen, Lokale und praktische Infos mit Quellenangabe.",
      fr: "La Croatie de l'Istrie à la Dalmatie : destinations sélectionnées, événements filtrables par pays, adresses et infos pratiques, sources incluses.",
      es: "Croacia de Istria a Dalmacia: destinos curados, eventos filtrables por país, locales e información práctica, con fuente en cada entrada.",
    },
  },
  ME: {
    title: {
      sl: "Črna gora — destinacije in dogodki",
      en: "Montenegro — destinations and events",
      it: "Montenegro — destinazioni ed eventi",
      de: "Montenegro — Ziele und Events",
      fr: "Monténégro — lieux et événements",
      es: "Montenegro — destinos y eventos",
    },
    description: {
      sl: "Črna gora: Boka Kotorska, Durmitor in jadranska obala — kurirane destinacije, dogodki, lokali in praktične informacije po iskrenostnem kanonu virov.",
      en: "Montenegro: the Bay of Kotor, Durmitor and the Adriatic coast — curated destinations, events, venues and practical info under the honesty canon.",
      it: "Montenegro: la baia di Cattaro, il Durmitor e la costa adriatica — destinazioni curate, eventi, locali e informazioni pratiche con fonti.",
      de: "Montenegro: Bucht von Kotor, Durmitor und Adriaküste — kuratierte Destinationen, Veranstaltungen, Lokale und praktische Infos mit Quellen.",
      fr: "Le Monténégro : la baie de Kotor, le Durmitor et la côte adriatique — destinations sélectionnées, événements, adresses et infos pratiques.",
      es: "Montenegro: la bahía de Kotor, Durmitor y la costa adriática — destinos curados, eventos, locales e información práctica con fuentes.",
    },
  },
  AL: {
    title: {
      sl: "Albanija — destinacije in dogodki",
      en: "Albania — destinations and events",
      it: "Albania — destinazioni ed eventi",
      de: "Albanien — Ziele und Veranstaltungen",
      fr: "Albanie — destinations et événements",
      es: "Albania — destinos y eventos",
    },
    description: {
      sl: "Albanija: obala Jadrana in Jonije, gorske poti in mesta — kurirane destinacije, dogodki in lokali s popisanim virom za vsak posamezen vnos.",
      en: "Albania: the Adriatic and Ionian coast, mountain trails and cities — curated destinations, events and venues with a recorded source per entry.",
      it: "Albania: la costa adriatica e ionica, sentieri di montagna e città — destinazioni curate, eventi e locali con fonte per ogni voce.",
      de: "Albanien: Adriaküste und Ionisches Meer, Bergwege und Städte — kuratierte Destinationen, Veranstaltungen und Lokale mit Quellenangabe.",
      fr: "L'Albanie : côtes adriatique et ionienne, sentiers de montagne et villes — destinations sélectionnées, événements et adresses sourcées.",
      es: "Albania: la costa adriática y jónica, rutas de montaña y ciudades — destinos curados, eventos y locales con fuente en cada entrada.",
    },
  },
  BA: {
    title: {
      sl: "Bosna in Hercegovina — vodnik",
      en: "Bosnia and Herzegovina — guide",
      it: "Bosnia ed Erzegovina — guida",
      de: "Bosnien und Herzegowina — Guide",
      fr: "Bosnie-Herzégovine — guide",
      es: "Bosnia y Herzegovina — guía",
    },
    description: {
      sl: "Bosna in Hercegovina: Sarajevo, Mostar z Unescovim Stari mostom in narava Dinaridov — kurirane destinacije, dogodki in lokali z izrecnim virom.",
      en: "Bosnia and Herzegovina: Sarajevo, Mostar with UNESCO's Stari Most and the Dinaric nature — curated destinations, events and venues, all sourced.",
      it: "Bosnia ed Erzegovina: Sarajevo, Mostar con il Ponte Vecchio UNESCO e la natura delle Alpi Dinariche — destinazioni, eventi e locali con fonte.",
      de: "Bosnien und Herzegowina: Sarajevo, Mostar mit der UNESCO-Brücke Stari Most und dinarische Natur — Destinationen, Events und Lokale mit Quelle.",
      fr: "La Bosnie-Herzégovine : Sarajevo, Mostar avec le Pont UNESCO et la nature dinarique — destinations, événements et adresses avec sources.",
      es: "Bosnia y Herzegovina: Sarajevo, Mostar con el Puente Viejo de la UNESCO y naturaleza dinárica — destinos, eventos y locales con fuentes.",
    },
  },
  RS: {
    title: {
      sl: "Srbija — destinacije in dogodki",
      en: "Serbia — destinations and events",
      it: "Serbia — destinazioni ed eventi",
      de: "Serbien — Ziele und Veranstaltungen",
      fr: "Serbie — destinations et événements",
      es: "Serbia — destinos y eventos",
    },
    description: {
      sl: "Srbija: Beograd na sotočju Save in Donave, Novi Sad s Petrovaradinom in Kopaonik — kurirane destinacije, prireditve, lokali in praktične informacije.",
      en: "Serbia: Belgrade at the Sava-Danube confluence, Novi Sad with Petrovaradin and Kopaonik — curated destinations, events, venues and practical info.",
      it: "Serbia: Belgrado alla confluenza di Sava e Danubio, Novi Sad con Petrovaradin e Kopaonik — destinazioni, eventi, locali e info pratiche.",
      de: "Serbien: Belgrad an der Save-Donau-Mündung, Novi Sad mit Petrovaradin und Kopaonik — Destinationen, Veranstaltungen, Lokale, praktische Infos.",
      fr: "La Serbie : Belgrade à la confluence de la Save et du Danube, Novi Sad et Petrovaradin, Kopaonik — destinations, événements et infos pratiques.",
      es: "Serbia: Belgrado en la confluencia del Sava y el Danubio, Novi Sad con Petrovaradin y Kopaonik — destinos, eventos e información práctica.",
    },
  },
  MK: {
    title: {
      sl: "Severna Makedonija — vodnik",
      en: "North Macedonia — guide",
      it: "Macedonia del Nord — guida",
      de: "Nordmazedonien — Guide",
      fr: "Macédoine du Nord — guide",
      es: "Macedonia del Norte — guía",
    },
    description: {
      sl: "Severna Makedonija: Ohrid z Unescovo dediščino, Skopje in kanjon Matka — kurirane destinacije, dogodki in lokali z zapisanim virom vsakega vnosa.",
      en: "North Macedonia: Ohrid with its UNESCO heritage, Skopje and Matka canyon — curated destinations, events and venues with a recorded source.",
      it: "Macedonia del Nord: Ohrid con il patrimonio UNESCO, Skopje e la gola di Matka — destinazioni, eventi e locali con fonte per ogni voce.",
      de: "Nordmazedonien: Ohrid mit UNESCO-Erbe, Skopje und die Matka-Schlucht — kuratierte Destinationen, Events und Lokale mit Quellenangabe.",
      fr: "La Macédoine du Nord : Ohrid et son patrimoine UNESCO, Skopje et les gorges de Matka — destinations, événements et adresses sourcées.",
      es: "Macedonia del Norte: Ohrid con su patrimonio de la UNESCO, Skopie y el cañón de Matka — destinos, eventos y locales con fuentes.",
    },
  },
  XK: {
    title: {
      sl: "Kosovo — destinacije in dogodki",
      en: "Kosovo — destinations and events",
      it: "Kosovo — destinazioni ed eventi",
      de: "Kosovo — Ziele und Veranstaltungen",
      fr: "Kosovo — destinations et événements",
      es: "Kosovo — destinos y eventos",
    },
    description: {
      sl: "Kosovo: Prizren, soteska Rugova in samostani na Unescovem seznamu nevarnosti — kurirane destinacije, dogodki in lokali po iskrenostnem kanonu.",
      en: "Kosovo: Prizren, the Rugova gorge and monasteries on UNESCO's danger list — curated destinations, events and venues under the honesty canon.",
      it: "Kosovo: Prizren, la gola di Rugova e i monasteri nella lista UNESCO in pericolo — destinazioni, eventi e locali con fonti dichiarate.",
      de: "Kosovo: Prizren, die Rugova-Schlucht und Klöster auf der UNESCO-Gefährdungsliste — kuratierte Destinationen, Events und Lokale mit Quelle.",
      fr: "Le Kosovo : Prizren, les gorges de Rugova et des monastères sur la liste UNESCO en danger — destinations, événements et adresses sourcées.",
      es: "Kosovo: Prizren, la garganta de Rugova y monasterios en la lista de peligro de la UNESCO — destinos, eventos y locales con fuentes.",
    },
  },
  BG: {
    title: {
      sl: "Bolgarija — destinacije in dogodki",
      en: "Bulgaria — destinations and events",
      it: "Bulgaria — destinazioni ed eventi",
      de: "Bulgarien — Ziele und Veranstaltungen",
      fr: "Bulgarie — destinations et événements",
      es: "Bulgaria — destinos y eventos",
    },
    description: {
      sl: "Bolgarija: Sofija, Plovdiv in Rilski samostan (Unescova dediščina) — kurirane destinacije, dogodki in lokali z javno zapisanim virom vsakega vnosa.",
      en: "Bulgaria: Sofia, Plovdiv and Rila Monastery (UNESCO heritage) — curated destinations, events and venues with a publicly recorded source.",
      it: "Bulgaria: Sofia, Plovdiv e il monastero di Rila (patrimonio UNESCO) — destinazioni, eventi e locali con fonte pubblica per ogni voce.",
      de: "Bulgarien: Sofia, Plovdiv und das Rila-Kloster (UNESCO-Erbe) — kuratierte Destinationen, Events und Lokale mit öffentlicher Quellenangabe.",
      fr: "La Bulgarie : Sofia, Plovdiv et le monastère de Rila (patrimoine UNESCO) — destinations, événements et adresses avec sources publiques.",
      es: "Bulgaria: Sofía, Plovdiv y el monasterio de Rila (patrimonio de la UNESCO) — destinos, eventos y locales con fuente pública.",
    },
  },
  GR: {
    title: {
      sl: "Grčija — destinacije in dogodki",
      en: "Greece — destinations and events",
      it: "Grecia — destinazioni ed eventi",
      de: "Griechenland — Ziele und Events",
      fr: "Grèce — destinations et événements",
      es: "Grecia — destinos y eventos",
    },
    description: {
      sl: "Grčija: Solun kot Unescovo mesto, Meteora in severna Grčija — kurirane destinacije, dogodki in lokali z zapisanim virom vsakega vnosa.",
      en: "Greece: Thessaloniki as a UNESCO city, Meteora and the north — curated destinations, events and venues with a recorded source per entry.",
      it: "Grecia: Salonicco città UNESCO, le Meteore e il nord della Grecia — destinazioni, eventi e locali con fonte per ogni voce.",
      de: "Griechenland: Thessaloniki als UNESCO-Stadt, Meteora und der Norden — kuratierte Destinationen, Events und Lokale mit Quellenangabe.",
      fr: "La Grèce : Thessalonique ville UNESCO, les Météores et le Nord — destinations, événements et adresses avec sources enregistrées.",
      es: "Grecia: Salónica ciudad de la UNESCO, Meteora y el norte del país — destinos, eventos y locales con fuente en cada entrada.",
    },
  },
};

/** Oznake uporabniškega vmesnika državne strani (pick kanon, ×6 jezikov). */
export const COUNTRY_UI = {
  /** Razdelek: praktične informacije (valuta/klicna/nujne/jezik). */
  prakticno: {
    sl: "Praktične informacije",
    en: "Practical information",
    it: "Informazioni pratiche",
    de: "Praktische Informationen",
    fr: "Informations pratiques",
    es: "Información práctica",
  },
  valuta: { sl: "Valuta", en: "Currency", it: "Valuta", de: "Währung", fr: "Monnaie", es: "Moneda" },
  klicna: {
    sl: "Klicna predpona",
    en: "Dialling code",
    it: "Prefisso telefonico",
    de: "Vorwahl",
    fr: "Indicatif téléphonique",
    es: "Prefijo telefónico",
  },
  sili: {
    sl: "Številka v sili",
    en: "Emergency number",
    it: "Numero di emergenza",
    de: "Notrufnummer",
    fr: "Numéro d'urgence",
    es: "Número de emergencia",
  },
  jezik: {
    sl: "Jezik na terenu",
    en: "Local language",
    it: "Lingua locale",
    de: "Lokale Sprache",
    fr: "Langue locale",
    es: "Idioma local",
  },
  destinacije: { sl: "Destinacije", en: "Destinations", it: "Destinazioni", de: "Destinationen", fr: "Destinations", es: "Destinos" },
  dogodki: { sl: "Dogodki", en: "Events", it: "Eventi", de: "Veranstaltungen", fr: "Événements", es: "Eventos" },
  lokali: { sl: "Lokali", en: "Venues", it: "Locali", de: "Lokale", fr: "Adresses", es: "Locales" },
  ctaDestinacije: {
    sl: "Razišči destinacije s filtrom po državi",
    en: "Explore destinations with the country filter",
    it: "Esplora le destinazioni con il filtro paese",
    de: "Destinationen mit Länderfilter erkunden",
    fr: "Explorer les destinations avec le filtre pays",
    es: "Explorar destinos con el filtro por país",
  },
  ctaDogodki: {
    sl: "Poglej koledar dogodkov s filtrom po državi",
    en: "Open the events calendar with the country filter",
    it: "Apri il calendario eventi con il filtro paese",
    de: "Veranstaltungskalender mit Länderfilter öffnen",
    fr: "Ouvrir l'agenda des événements avec le filtre pays",
    es: "Abrir el calendario de eventos con el filtro por país",
  },
  /** Iskren prazen stanji (#38): registru ni vnosa — ne ugibamo. */
  brezDestinacij: {
    sl: "Destinacij za to državo v registru še ni — dodajamo jih kurirano, z virom.",
    en: "No destinations for this country in the registry yet — we add them in a curated way, with a source.",
    it: "Ancora nessuna destinazione per questo paese nel registro — le aggiungiamo in modo curato, con fonte.",
    de: "Noch keine Destinationen für dieses Land im Register — wir ergänzen sie kuratiert, mit Quelle.",
    fr: "Aucune destination pour ce pays dans le registre — nous les ajoutons de façon curatée, avec source.",
    es: "Aún no hay destinos para este país en el registro — los añadimos de forma curada, con fuente.",
  },
  brezDogodkov: {
    sl: "Dogodkov za to državo v registru še ni — koledar pokriva države s potrjenimi vnosi.",
    en: "No events for this country in the registry yet — the calendar covers countries with confirmed entries.",
    it: "Ancora nessun evento per questo paese nel registro — il calendario copre i paesi con voci confermate.",
    de: "Noch keine Veranstaltungen für dieses Land im Register — der Kalender umfasst Länder mit bestätigten Einträgen.",
    fr: "Aucun événement pour ce pays dans le registre — l'agenda couvre les pays avec des entrées confirmées.",
    es: "Aún no hay eventos para este país en el registro — el calendario cubre países con entradas confirmadas.",
  },
  brezLokalov: {
    sl: "Lokalov za to državo v registru še ni — dodajamo jih kurirano, z virom.",
    en: "No venues for this country in the registry yet — we add them in a curated way, with a source.",
    it: "Ancora nessun locale per questo paese nel registro — li aggiungiamo in modo curato, con fonte.",
    de: "Noch keine Lokale für dieses Land im Register — wir ergänzen sie kuratiert, mit Quelle.",
    fr: "Aucune adresse pour ce pays dans le registre — nous les ajoutons de façon curatée, avec source.",
    es: "Aún no hay locales para este país en el registro — los añadimos de forma curada, con fuente.",
  },
} as const;

export interface GeoCenter {
  lat: number;
  lng: number;
}

/**
 * Geo središče države, IZPELJANO iz kuriranih destinacij (min/max oklep
 * → sredina). Ni izmišljene koordinate — resnična geometrija nabora;
 * null, kadar država (še) nima destinacij. Uporablja jo JSON-LD državne
 * strani (TouristDestination.geo).
 */
export function countryGeoCenter(
  dests: readonly { coords: { lat: number; lng: number } }[],
): GeoCenter | null {
  if (dests.length === 0) return null;
  const lats = dests.map((d) => d.coords.lat);
  const lngs = dests.map((d) => d.coords.lng);
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
}
