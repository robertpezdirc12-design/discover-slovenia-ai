/**
 * TRŽNICA-DATA — ponudniška police /trznica (rekonstrukcija supply registra).
 *
 * Vir: PROVIDER_REGISTRY (recovered-src/read_1790842652332_f99d5e72e6e1.ts —
 * TRAVEL SUPPLY MAP, F1 1.49.0) + production-mirror/trznica.
 *
 * Struktura 1:1 po skupinah registra: local (odprti viri) · own (lastna
 * tržnica) · commercial (partnerji). Statusi so DEJANSKO stanje (iskrenostni
 * kanon: NIKOLI ne predstavljamo affiliate povezave kot inventarja).
 *
 * Lastni produkti so IZPELJANI iz kanonskega nabora destinacij
 * (src/lib/slovenia-data.ts): ime izkušnje = dejavna aktivnost destinacije,
 * ocena stroška = costPerPerson destinacije (realni polji nabora — ni
 * izmišljenih cen). Živi izdelki (zaloga, checkout) živijo v bazi
 * (GET /api/products, seed 48-c) — ta datoteka je referenčni sloj
 * imen/opisov/prevodov (SL kanon + EN prekrivni slovar).
 */

import type { SupplyStatus } from "./go-data";

/** Skupine ponudnikov po arhitekturi izvirnika. */
export type ShelfGroup = "local" | "own" | "commercial";

/** UI-dostopnost police (iskrenostni badge). */
export type ShelfAvailability = "available" | "coming" | "empty";

export interface SupplyShelf {
  slug: string;
  group: ShelfGroup;
  label: { sl: string; en: string };
  description: { sl: string; en: string };
  coverage: { sl: string; en: string };
  status: SupplyStatus;
  availability: ShelfAvailability;
  /** Povezava na partnersko podstran /go/<slug> (kadar obstaja). */
  goRoute?: string;
  /** Prikazna imena ponudnikov na polici (iz registra). */
  providers: string[];
}

/** Polica po skupinah — vrstni red: lokalni viri → lastna tržnica → partnerji. */
export const SUPPLY_SHELVES: SupplyShelf[] = [
  // ── Lokalni viri (odprti podatki) ───────────────────────────────────
  {
    slug: "osm",
    group: "local",
    label: { sl: "OpenStreetMap", en: "OpenStreetMap" },
    description: {
      sl: "Odprti podatki (ODbL) — znamenitosti, muzeji, restavracije, nastanitve in bencinske postaje z živimi poizvedbami po pogledu zemljevida.",
      en: "Open data (ODbL) — attractions, museums, restaurants, accommodation and petrol stations with live viewport queries.",
    },
    coverage: {
      sl: "Slovenija in zahodni Balkan (pogled zemljevida).",
      en: "Slovenia and the Western Balkans (map viewport).",
    },
    status: "local",
    availability: "available",
    providers: ["OpenStreetMap"],
  },
  {
    slug: "fsq",
    group: "local",
    label: { sl: "Foursquare Open Places", en: "Foursquare Open Places" },
    description: {
      sl: "Odprti podatki (Apache-2.0) — POI sloj z ocenami. Množica NI nameščena v peskovniku → sloj je iskreno neaktiven.",
      en: "Open data (Apache-2.0) — a POI layer with ratings. The dataset is NOT installed in the sandbox → the layer is honestly inactive.",
    },
    coverage: {
      sl: "SI + HR + ME + AL (ko bo množica nameščena).",
      en: "SI + HR + ME + AL (once the dataset is installed).",
    },
    status: "local",
    availability: "coming",
    providers: ["Foursquare"],
  },
  {
    slug: "sto",
    group: "local",
    label: { sl: "slovenia.info (STO)", en: "slovenia.info (STO)" },
    description: {
      sl: "Uradna vsebina slovenske turistične organizacije (llms.txt) — opisi za AI, brez geo feeeda.",
      en: "Official content of the Slovenian tourist board (llms.txt) — AI descriptions, no geo feed.",
    },
    coverage: {
      sl: "Besedilni vir (RAG) — ni sloj zemljevida.",
      en: "Text source (RAG) — not a map layer.",
    },
    status: "local",
    availability: "coming",
    providers: ["STO"],
  },

  // ── Lastna tržnica (own_marketplace) ────────────────────────────────
  {
    slug: "own",
    group: "own",
    label: { sl: "Lokalni ponudniki (naša tržnica)", en: "Local providers (our marketplace)" },
    description: {
      sl: "Lastna tržnica z lastnim checkoutom: izkušnje slovenskih ponudnikov z živo zalogo in nakupom na mestu (Stripe; v peskovniku demo plačila — izrecno označena). Listingi fizičnih ponudnikov iz produkcije niso bili zajeti — ta sloj ostaja iskreno prazen.",
      en: "Our own marketplace with our own checkout: experiences by Slovenian providers with live stock and on-site purchase (Stripe; demo payments in the sandbox — explicitly labelled). Physical provider listings from production were not captured — that layer stays honestly empty.",
    },
    coverage: {
      sl: "Izkušnje po destinacijah nabora (Bled, Soča, Piran …) z živim checkoutom.",
      en: "Experiences across the dataset destinations (Bled, Soča, Piran …) with a live checkout.",
    },
    status: "search",
    availability: "available",
    providers: ["Discover Slovenia (lastna tržnica)"],
  },

  // ── Komercialni partnerji ───────────────────────────────────────────
  {
    slug: "transfers",
    group: "commercial",
    label: { sl: "Transferji", en: "Transfers" },
    description: {
      sl: "Zasebni transferji z letališč in med mesti — fiksna cena, srečanje z voznikom, brezplačna odpoved.",
      en: "Private transfers from airports and between cities — fixed price, meet & greet, free cancellation.",
    },
    coverage: {
      sl: "Letališče Ljubljana, Bled, Portorož, Maribor …",
      en: "Ljubljana Airport, Bled, Portorož, Maribor …",
    },
    status: "static",
    availability: "available",
    goRoute: "transfers",
    providers: ["KiwiTaxi"],
  },
  {
    slug: "hotels",
    group: "commercial",
    label: { sl: "Nastanitve", en: "Stays" },
    description: {
      sl: "Hoteli, apartmaji in gostišča — rezervacija prek partnerja (povezava se konfigurira po odobritvi).",
      en: "Hotels, apartments and guesthouses — booking via a partner (link is configured upon approval).",
    },
    coverage: {
      sl: "Vse destinacije nabora.",
      en: "All dataset destinations.",
    },
    status: "affiliate",
    availability: "coming",
    goRoute: "hotels",
    providers: ["Booking.com"],
  },
  {
    slug: "flights",
    group: "commercial",
    label: { sl: "Leti", en: "Flights" },
    description: {
      sl: "Letalske povezave do Ljubljane in bližnjih letališč (Zagreb, Benetke, Dunaj).",
      en: "Flights to Ljubljana and nearby airports (Zagreb, Venice, Vienna).",
    },
    coverage: {
      sl: "Izhodišče → cilj (iskanje).",
      en: "Origin → destination (search).",
    },
    status: "affiliate",
    availability: "coming",
    goRoute: "flights",
    providers: ["Skyscanner", "Travelpayouts"],
  },
  {
    slug: "cars",
    group: "commercial",
    label: { sl: "Najem avtov", en: "Car rental" },
    description: {
      sl: "Primerjava ponudb najema avtomobilov z brezplačno odpovedjo.",
      en: "Rental comparison with free cancellation.",
    },
    coverage: {
      sl: "Letališča in mesta (Ljubljana, Zagreb, Split …).",
      en: "Airports and cities (Ljubljana, Zagreb, Split …).",
    },
    status: "affiliate",
    availability: "coming",
    goRoute: "cars",
    providers: ["DiscoverCars"],
  },
  {
    slug: "transport",
    group: "commercial",
    label: { sl: "Medkrajevni transport", en: "Intercity transport" },
    description: {
      sl: "Vlaki in avtobusi med mesti na enem iskanju.",
      en: "Trains and buses between cities in one search.",
    },
    coverage: {
      sl: "Ljubljana–Zagreb, obala, Dunaj …",
      en: "Ljubljana–Zagreb, the coast, Vienna …",
    },
    status: "affiliate",
    availability: "coming",
    goRoute: "transport",
    providers: ["Omio"],
  },
  {
    slug: "activities",
    group: "commercial",
    label: { sl: "Izkušnje in aktivnosti", en: "Experiences & activities" },
    description: {
      sl: "Izleti, vstopnine in aktivnosti z lokalnimi ponudniki.",
      en: "Tours, tickets and activities with local providers.",
    },
    coverage: {
      sl: "38 destinacij nabora.",
      en: "The 38 dataset destinations.",
    },
    status: "affiliate",
    availability: "coming",
    goRoute: "activities",
    providers: ["GetYourGuide"],
  },
  {
    slug: "viator",
    group: "commercial",
    label: { sl: "Turi in izleti", en: "Tours & excursions" },
    description: {
      sl: "Vodeni izleti skupnosti Tripadvisor.",
      en: "Tripadvisor-community guided tours.",
    },
    coverage: {
      sl: "Vodeni izleti, izletniški programi, kulinarika.",
      en: "Guided tours, day trips, food experiences.",
    },
    status: "affiliate",
    availability: "coming",
    goRoute: "viator",
    providers: ["Viator"],
  },
  {
    slug: "tickets",
    group: "commercial",
    label: { sl: "Vstopnice", en: "Tickets" },
    description: {
      sl: "Vstopnice za muzeje in znamenitosti — takoj na telefonu, brez čakanja.",
      en: "Museum and attraction tickets — instantly on your phone, skip the line.",
    },
    coverage: {
      sl: "Muzeji in znamenitosti po svetu.",
      en: "Museums and attractions worldwide.",
    },
    status: "affiliate",
    availability: "available",
    goRoute: "tickets",
    providers: ["Tiqets"],
  },
  {
    slug: "insurance",
    group: "commercial",
    label: { sl: "Zavarovanje", en: "Travel insurance" },
    description: {
      sl: "Popotniško zavarovanje za naslednjo dogodivščino — tudi avanturistične aktivnosti.",
      en: "Travel insurance for your next adventure — adventure activities included by option.",
    },
    coverage: {
      sl: "Zdravstveni stroški, prtljaga, odpoved (odvisno od police).",
      en: "Medical, luggage, cancellation (policy-dependent).",
    },
    status: "affiliate",
    availability: "available",
    goRoute: "insurance",
    providers: ["World Nomads", "SafetyWing"],
  },
  {
    slug: "esim",
    group: "commercial",
    label: { sl: "eSIM podatki", en: "eSIM data" },
    description: {
      sl: "eSIM podatkovni paketi za 200+ destinacij — namestitev v minutah.",
      en: "eSIM data packages for 200+ destinations — installed in minutes.",
    },
    coverage: {
      sl: "Lokalni (Slovenija), regionalni (Evropa), globalni.",
      en: "Local (Slovenia), regional (Europe), global.",
    },
    status: "affiliate",
    availability: "available",
    goRoute: "esim",
    providers: ["Airalo"],
  },
];

/**
 * LASTNI PRODUKTI — izkušnje izpeljane iz kanonskega nabora destinacij
 * (ime = aktivnost destinacije v naboru; ocena = costPerPerson).
 * Živi izdelki (zaloga, nakup) živijo v bazi — glej sekcijs
 * "Lastna tržnica" na /trznica (48-c) in GET /api/products.
 */
export interface OwnProduct {
  id: string;
  /** Ime izkušnje (prevod dejavnosti iz nabora). */
  name: { sl: string; en: string };
  kind: "experience" | "ticket";
  destinationSlug: string;
  description: { sl: string; en: string };
  /** Ocena stroška na osebo (EUR) — costPerPerson destinacije v naboru. */
  priceEstimate: number;
  image: string;
}

export const OWN_PRODUCTS: OwnProduct[] = [
  {
    id: "izk-bled-pletna",
    name: { sl: "Pletna vožnja do Blejskega otoka", en: "Pletna ride to Bled Island" },
    kind: "experience",
    destinationSlug: "bled",
    description: {
      sl: "Tradicionalna pletna vožnja čez jezero do cerkvice na otoku — dejavnost iz kanonskega nabora destinacije Bled.",
      en: "A traditional pletna boat ride across the lake to the island church — an activity from the canonical Bled dataset entry.",
    },
    priceEstimate: 25,
    image: "/content/bled.jpg",
  },
  {
    id: "izk-bohinj-vogel",
    name: { sl: "Žičnica Vogel nad Bohinjem", en: "Vogel cable car above Bohinj" },
    kind: "experience",
    destinationSlug: "bohinj",
    description: {
      sl: "Voznja z žičnico na Vogel (1535 m) s panoramskim razgledom na Bohinjsko jezero in Julijce.",
      en: "Ride up Mt Vogel (1535 m) for panoramic views of Lake Bohinj and the Julian Alps.",
    },
    priceEstimate: 15,
    image: "/content/bohinj.jpg",
  },
  {
    id: "izk-ljubljana-kulinarika",
    name: { sl: "Kulinarična tura po Ljubljani", en: "Ljubljana food tour" },
    kind: "experience",
    destinationSlug: "ljubljana",
    description: {
      sl: "Kulinarični sprehod po starem mestnem jedru — od Tromostovja do osrednje tržnice.",
      en: "A culinary walk through the old town — from the Triple Bridge to the central market.",
    },
    priceEstimate: 20,
    image: "/content/ljubljana.jpg",
  },
  {
    id: "vstop-postojna-vlakec",
    name: { sl: "Jamska tura z vlakcem — Postojnska jama", en: "Cave tour by train — Postojna Cave" },
    kind: "ticket",
    destinationSlug: "postojnska-jama",
    description: {
      sl: "Obisk največjega turističnega jamskega sistema v Evropi z edinstvenim podzemnim vlakcem.",
      en: "Visit Europe's largest show cave system with its unique underground train.",
    },
    priceEstimate: 30,
    image: "/content/postojnska-jama.jpg",
  },
  {
    id: "izk-soca-rafting",
    name: { sl: "Rafting na Soči", en: "Rafting on the Soča" },
    kind: "experience",
    destinationSlug: "reka-soca",
    description: {
      sl: "Spust po smaragdnih brzicah Soče — ena najbolj znanih aktivnosti doline.",
      en: "Paddle the emerald rapids of the Soča — one of the valley's best-known activities.",
    },
    priceEstimate: 40,
    image: "/content/reka-soca.jpg",
  },
  {
    id: "izk-piran-soline",
    name: { sl: "Obisk solin pri Piranu", en: "Salt-pans visit near Piran" },
    kind: "experience",
    destinationSlug: "piran",
    description: {
      sl: "Sprehod po Sečoveljskih solinah — stoletna tradicija pridobivanja soli.",
      en: "Walk the Sečovlje salt pans — centuries of traditional salt harvesting.",
    },
    priceEstimate: 35,
    image: "/content/piran.jpg",
  },
  {
    id: "izk-kobarid-kulinarika",
    name: { sl: "Kulinarična izkušnja v Kobardu", en: "Culinary experience in Kobarid" },
    kind: "experience",
    destinationSlug: "kobarid",
    description: {
      sl: "Gastro doživetje Posočja — od Hiše Franko do lokalnih gostiln ob Soči.",
      en: "A gastronomic taste of the Soča Valley — from Hiša Franko to local gostilnas along the river.",
    },
    priceEstimate: 25,
    image: "/content/kobarid.jpg",
  },
  {
    id: "izk-maribor-vinska",
    name: { sl: "Vinska degustacija v Mariboru", en: "Wine tasting in Maribor" },
    kind: "experience",
    destinationSlug: "maribor",
    description: {
      sl: "Degustacija vinskih sort Štajerske Slovenije v mestu stare trte.",
      en: "Tastings of Styrian Slovenian varieties in the city of the Old Vine.",
    },
    priceEstimate: 20,
    image: "/content/maribor.jpg",
  },
  {
    id: "izk-triglav-alpinizem",
    name: { sl: "Alpinizem v Triglavskem gorovju", en: "Alpinism in the Triglav range" },
    kind: "experience",
    destinationSlug: "triglav",
    description: {
      sl: "Vzpon na najvišjo slovensko goro (2864 m) z lokalnim vodnikom.",
      en: "Climb Slovenia's highest mountain (2864 m) with a local guide.",
    },
    priceEstimate: 15,
    image: "/content/triglav.jpg",
  },
  {
    id: "izk-rogaska-wellness",
    name: { sl: "Wellness dan v Rogaški Slatini", en: "Wellness day in Rogaška Slatina" },
    kind: "experience",
    destinationSlug: "rogaska-slatina",
    description: {
      sl: "Zdraviliški dan z mineralno vodo Donat Mg, bazeni in masažami.",
      en: "A spa day with Donat Mg mineral water, pools and massages.",
    },
    priceEstimate: 80,
    image: "/content/rogaska-slatina.jpg",
  },
  {
    id: "izk-ptuj-pust",
    name: { sl: "Pustni festival v Ptuju", en: "Carnival festival in Ptuj" },
    kind: "experience",
    destinationSlug: "ptuj",
    description: {
      sl: "Največji slovenski pustni festival s tradicionalnimi pustami (kurenti).",
      en: "Slovenia's largest carnival with the traditional kurenti figures.",
    },
    priceEstimate: 18,
    image: "/content/ptuj.jpg",
  },
];

/** Poišči lastni produkt po ID-ju. */
export function getOwnProduct(id: string): OwnProduct | undefined {
  return OWN_PRODUCTS.find((p) => p.id === id);
}
