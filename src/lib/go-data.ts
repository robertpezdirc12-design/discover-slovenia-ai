/**
 * GO-DATA — register partnerjev /go (rekonstrukcja iz PROVIDER_REGISTRY).
 *
 * Vir: recovered-src/read_1790842652332_f99d5e72e6e1.ts (TRAVEL SUPPLY MAP —
 * F1, 1.49.0) + production-mirror/go/* (4 partnerske podstrani, zajete z
 * produkcije: esim/insurance/tickets/transfers).
 *
 * ISKRENOSTNI KANON (1:1 iz izvirnika):
 *  - statusi so DEJANSKO stanje: affiliate = globoka povezava prek /go,
 *    DOKLER partner dostop ni odobren; static = objavljeni podatki partnerja.
 *  - NIKOLI ne predstavljamo affiliate URL-ja kot inventarja in NE izmišljujemo
 *    partnerskih URL-jev: zunanja povezava se izriše kot onemogočena ("se
 *    konfigurira"), dokler žetoni niso nastavljeni.
 *  - Vsebina 4 rekonstruiranih podstrani je izluščena iz production-mirror
 *    (naslovi, koristi, odhodne točke, statistike) — brez dodajanja podatkov.
 */

/** Status ponudbe (1:1 SupplyStatus iz registra, brez "live" — ni nikoli aktiven v peskovniku). */
export type SupplyStatus = "local" | "static" | "search" | "affiliate" | "planned";

/** UI-status iskrenosti: NA VOLJO = rekonstruirana vsebina; PRIHAJA = po konfiguraciji. */
export type HonestBadge = "available" | "coming";

/** Vse /go rute izvirnika (GoRoute = AffiliateProvider union v izvirniku). */
export type GoRouteSlug =
  | "hotels"
  | "flights"
  | "cars"
  | "transfers"
  | "transport"
  | "activities"
  | "viator"
  | "tickets"
  | "insurance"
  | "esim";

export interface GoProvider {
  /** Kanonski slug ponudnika iz PROVIDER_REGISTRY. */
  slug: string;
  label: string;
  status: SupplyStatus;
  /** Iskrena opomba o dostopu (iz registra). */
  accessNote: { sl: string; en: string };
  /** Uradna dokumentacija vira (trditve vežejo na vir). */
  docsUrl?: string;
}

export interface GoContentSection {
  heading: { sl: string; en: string };
  items: { sl: string; en: string }[];
}

export interface GoStat {
  value: string;
  label: { sl: string; en: string };
}

export interface GoPartnerRoute {
  slug: GoRouteSlug;
  title: { sl: string; en: string };
  lead: { sl: string; en: string };
  /** Pokritost (kaj ta kategorija pokriva). */
  coverage: { sl: string; en: string };
  /** Vsebinski status podstrani: rekonstruirano iz mirror (available) ali pošten stub (coming). */
  content: HonestBadge;
  /** Zunanja partnerska povezava: v peskovniku ŠE ni konfigurirana (coming). */
  link: HonestBadge;
  providers: GoProvider[];
  stats?: GoStat[];
  sections?: GoContentSection[];
  featured?: boolean;
}

/** Prikazni status (badge) — 1:1 statusLabel() iz registra (sl/en). */
export const SUPPLY_STATUS_LABELS: Record<SupplyStatus, { sl: string; en: string }> = {
  local: { sl: "Lokalni vir", en: "Local source" },
  static: { sl: "Objavljeni podatki", en: "Published data" },
  search: { sl: "Iskanje", en: "Search" },
  affiliate: { sl: "Povezava partnerja", en: "Partner link" },
  planned: { sl: "Načrtovano", en: "Planned" },
};

/** Vseh 10 /go rut (vrstni red po mirror index.html). */
export const GO_PARTNERS: GoPartnerRoute[] = [
  {
    slug: "hotels",
    title: { sl: "Nastanitve", en: "Stays" },
    lead: {
      sl: "Booking.com — največja baza nastanitev od hotelov do apartmajev.",
      en: "Booking.com — the largest inventory of stays from hotels to apartments.",
    },
    coverage: {
      sl: "Nastanitve v vseh 38 destinacijah nabora.",
      en: "Accommodation across all 38 destinations in the dataset.",
    },
    content: "coming",
    link: "coming",
    providers: [
      {
        slug: "booking",
        label: "Booking.com",
        status: "affiliate",
        accessNote: {
          sl: "Demand API zahteva status Managed Affiliate Partner (pogodba) — danes samo affiliate povezava, sloj je pripravljen in iskreno prazen.",
          en: "Demand API requires Managed Affiliate Partner status (contract) — today affiliate link only, layer is ready and honestly empty.",
        },
        docsUrl: "https://developers.booking.com/demand/docs",
      },
    ],
  },
  {
    slug: "flights",
    title: { sl: "Leti", en: "Flights" },
    lead: {
      sl: "Skyscanner in Travelpayouts — iskanje letov do Ljubljane in bližnjih letališč.",
      en: "Skyscanner and Travelpayouts — flight search to Ljubljana and nearby airports.",
    },
    coverage: {
      sl: "Letalske povezave (iskanje izhodišče → cilj).",
      en: "Flight connections (origin → destination search).",
    },
    content: "coming",
    link: "coming",
    providers: [
      {
        slug: "skyscanner",
        label: "Skyscanner",
        status: "affiliate",
        accessNote: {
          sl: "Travel API (prijava prek partners.skyscanner.net) — pogodba javno dokumentirana; API ključ še ni izdan. Danes samo affiliate povezava.",
          en: "Travel API (application via partners.skyscanner.net) — contract publicly documented; API key not yet issued. Today affiliate link only.",
        },
        docsUrl: "https://developers.skyscanner.net/docs/intro",
      },
      {
        slug: "travelpayouts",
        label: "Travelpayouts",
        status: "search",
        accessNote: {
          sl: "Data API (self-serve žeton po registraciji računa) — vrata živo preverjena; žeton še ni nastavljen. Sloj je pripravljen in iskreno prazen.",
          en: "Data API (self-serve token after account sign-up) — gate verified live; token not yet set. Layer is ready and honestly empty.",
        },
        docsUrl: "https://support.travelpayouts.com/hc/en-us/categories/200358578-API-and-data",
      },
    ],
  },
  {
    slug: "cars",
    title: { sl: "Najem avtov", en: "Car rental" },
    lead: {
      sl: "DiscoverCars — primerjava ponudb najema z brezplačno odpovedjo.",
      en: "DiscoverCars — rental comparison with free cancellation.",
    },
    coverage: {
      sl: "Najem avtov na letališčih in v mestih (Ljubljana, Zagreb, Split …).",
      en: "Car hire at airports and cities (Ljubljana, Zagreb, Split …).",
    },
    content: "coming",
    link: "coming",
    providers: [
      {
        slug: "discovercars",
        label: "DiscoverCars",
        status: "affiliate",
        accessNote: {
          sl: "Search API le prek B4B pogodbe — danes samo affiliate povezava.",
          en: "Search API only via B4B agreement — today affiliate link only.",
        },
        docsUrl: "https://www.discovercars.com/affiliate",
      },
    ],
  },
  {
    slug: "transfers",
    title: { sl: "Transferji", en: "Transfers" },
    lead: {
      sl: "KiwiTaxi — zasebni transferji po Sloveniji z letališč in med mesti (fiksna cena, srečanje z voznikom).",
      en: "KiwiTaxi — private transfers across Slovenia from airports and between cities (fixed price, meet & greet).",
    },
    coverage: {
      sl: "Odhodi: letališče Ljubljana, Ljubljana, Bled, Portorož, Rogaška Slatina, Maribor …",
      en: "Departures: Ljubljana Airport, Ljubljana, Bled, Portorož, Rogaška Slatina, Maribor …",
    },
    content: "available",
    link: "coming",
    featured: true,
    providers: [
      {
        slug: "kiwitaxi",
        label: "KiwiTaxi",
        status: "static",
        accessNote: {
          sl: "Objavljeni podatki partnerja: realne cene transferjev, niso živi citat. Razpoložljivost se pri ponudniku preveri ob rezervaciji.",
          en: "Partner published data: real transfer prices, not live quotes. Availability is confirmed with the provider at booking.",
        },
        docsUrl: "https://kiwitaxi.com/en/partner/webmaster/instructions/api",
      },
    ],
    stats: [
      { value: "1.400.000+", label: { sl: "opravljenih voženj", en: "completed rides" } },
      { value: "100+", label: { sl: "obsluženih držav", en: "countries served" } },
    ],
    sections: [
      {
        heading: { sl: "Odhodne točke v Sloveniji", en: "Departure points in Slovenia" },
        items: [
          { sl: "Letališče Ljubljana — 170 destinacij", en: "Ljubljana Airport — 170 destinations" },
          { sl: "Ljubljana — 139 destinacij", en: "Ljubljana — 139 destinations" },
          { sl: "Rogaška Slatina — 50 destinacij", en: "Rogaška Slatina — 50 destinations" },
          { sl: "Portorož — 52 destinacij", en: "Portorož — 52 destinations" },
          { sl: "Bled — 45 destinacij", en: "Bled — 45 destinations" },
          { sl: "Maribor — 22 destinaciji", en: "Maribor — 22 destinations" },
        ],
      },
      {
        heading: { sl: "Kako poteka prevoz", en: "How the ride works" },
        items: [
          {
            sl: "Rezervacija vsaj 16 ur pred vožnjo — izbira časa in kraja, plačilo cene, ki jo vidiš.",
            en: "Book at least 16 hours ahead — pick any time or place and pay the fare you see.",
          },
          {
            sl: "Srečanje z voznikom ob dogovorjeni uri — tablica z tvojim imenom, pomoč s prtljago.",
            en: "Meet your driver at the set time — a sign with your name, luggage assistance included.",
          },
          {
            sl: "90-minutno čakanje ob zamudi leta (paket ob rezervaciji).",
            en: "90-minute waiting period if your flight is delayed (added at booking).",
          },
          {
            sl: "Potrditveni voucher z vsemi podrobnostmi poti in točko srečanja.",
            en: "A confirmation voucher detailing the trip and the meeting point.",
          },
        ],
      },
      {
        heading: { sl: "Zakaj KiwiTaxi", en: "Why KiwiTaxi" },
        items: [
          {
            sl: "Fiksna cena brez skritih stroškov in brez presenetljiv ob prihodu.",
            en: "Fixed fare with no hidden fees and no last-minute surprises.",
          },
          {
            sl: "Brezplačna odpoved in možnost prestavitve terminov.",
            en: "Free cancellation and rescheduling options.",
          },
          {
            sl: "Prilagoditve: voda v vozilu, dodaten postanek, otroški sedeži.",
            en: "Customisation: water on board, an extra stop, child seats.",
          },
          {
            sl: "Varna in prilagodljiva plačila — podatki o kartici so zaščiteni.",
            en: "Safe and flexible payment options — card details stay protected.",
          },
        ],
      },
    ],
  },
  {
    slug: "transport",
    title: { sl: "Medkrajevni transport", en: "Intercity transport" },
    lead: {
      sl: "Omio — vlaki in avtobusi med mesti na enem iskanju.",
      en: "Omio — trains and buses between cities in one search.",
    },
    coverage: {
      sl: "Vlaki in avtobusi (Ljubljana–Zagreb, obala, Dunaj …).",
      en: "Trains and buses (Ljubljana–Zagreb, the coast, Vienna …).",
    },
    content: "coming",
    link: "coming",
    providers: [
      {
        slug: "omio",
        label: "Omio",
        status: "affiliate",
        accessNote: {
          sl: "Search API del affiliate programa (po prijavi) — brez lat/lng; danes samo affiliate povezava.",
          en: "Search API part of affiliate program (post-application) — no lat/lng; today affiliate link only.",
        },
        docsUrl: "https://www.omio.com/affiliate",
      },
    ],
  },
  {
    slug: "activities",
    title: { sl: "Izkušnje in aktivnosti", en: "Experiences & activities" },
    lead: {
      sl: "GetYourGuide — izleti, vstopnine in aktivnosti z lokalnimi ponudniki.",
      en: "GetYourGuide — tours, tickets and activities with local providers.",
    },
    coverage: {
      sl: "Turi in aktivnosti po 38 destinacijah (Bled, Ljubljana, Piran …).",
      en: "Tours and activities across the 38 destinations (Bled, Ljubljana, Piran …).",
    },
    content: "coming",
    link: "coming",
    providers: [
      {
        slug: "getyourguide",
        label: "GetYourGuide",
        status: "affiliate",
        accessNote: {
          sl: "Partner API (OpenAPI, odobritev prek partner portala) — pogodba živo preverjena; API žeton še ni izdan. Danes samo affiliate povezava.",
          en: "Partner API (OpenAPI, approval via partner portal) — contract verified live; API token not yet issued. Today affiliate link only.",
        },
        docsUrl: "https://github.com/getyourguide/partner-api-spec",
      },
    ],
  },
  {
    slug: "viator",
    title: { sl: "Turi in izleti (Viator)", en: "Tours & excursions (Viator)" },
    lead: {
      sl: "Viator — vodeni izleti Tripadvisor skupnosti po Sloveniji in Balkanu.",
      en: "Viator — Tripadvisor-community guided tours across Slovenia and the Balkans.",
    },
    coverage: {
      sl: "Vodeni izleti, izletniški programi, kulinarika.",
      en: "Guided tours, day trips, food experiences.",
    },
    content: "coming",
    link: "coming",
    providers: [
      {
        slug: "viator",
        label: "Viator",
        status: "affiliate",
        accessNote: {
          sl: "Partner API (Basic Access) — pogodba živo preverjena; API ključ še ni izdan (self-serve po registraciji). Danes samo affiliate povezava.",
          en: "Partner API (Basic Access) — contract verified live; API key not yet issued (self-serve after sign-up). Today affiliate link only.",
        },
        docsUrl: "https://docs.viator.com/partner-api/technical/",
      },
    ],
  },
  {
    slug: "tickets",
    title: { sl: "Vstopnice", en: "Tickets" },
    lead: {
      sl: "Tiqets — vstopnice za muzeje in znamenitosti, takoj na telefonu.",
      en: "Tiqets — museum and attraction tickets, instantly on your phone.",
    },
    coverage: {
      sl: "Muzeji, galerije in znamenitosti po svetu, vključno s Slovenijo.",
      en: "Museums, galleries and attractions worldwide, including Slovenia.",
    },
    content: "available",
    link: "coming",
    featured: true,
    providers: [
      {
        slug: "tiqets",
        label: "Tiqets",
        status: "affiliate",
        accessNote: {
          sl: "Distributor API (odobritev affiliate prijave prek Awin) — vrata živo preverjena; API ključ še ni izdan. Danes samo affiliate povezava.",
          en: "Distributor API (approval via Awin affiliate application) — gate verified live; API key not yet issued. Today affiliate link only.",
        },
        docsUrl: "https://developers.tiqets.dev",
      },
    ],
    stats: [
      { value: "70 mio+", label: { sl: "popotnikov je kupilo prek Tiqets", en: "travelers have booked via Tiqets" } },
      { value: "3.000+", label: { sl: "partnerskih prizorišč", en: "partner venues" } },
      { value: "4,6", label: { sl: "ocena aplikacije", en: "app rating" } },
    ],
    sections: [
      {
        heading: { sl: "Zakaj Tiqets", en: "Why Tiqets" },
        items: [
          {
            sl: "Ostanite prilagodljivi — možnosti prilagodljive odpovedi na vseh prizoriščih.",
            en: "Stay flexible — flexible cancellation options on all venues.",
          },
          {
            sl: "Rezervirajte z zaupanjem — enostavna rezervacija in vstop brez čakanja na telefonu.",
            en: "Book with confidence — easy booking and skip-the-line entry on your phone.",
          },
          {
            sl: "Uživajte v kulturi po svoje — najboljše izkušnje muzejev in znamenitosti po svetu.",
            en: "Enjoy culture your way — the best museum and attraction experiences worldwide.",
          },
        ],
      },
      {
        heading: { sl: "Kako deluje", en: "How it works" },
        items: [
          { sl: "Izberi prizorišče in termin.", en: "Pick a venue and a time slot." },
          {
            sl: "Kupi vstopnico — takojšnja dobava na telefon.",
            en: "Buy the ticket — instant mobile delivery.",
          },
          {
            sl: "Pokaži kodo na vhodu — deluje tudi brez povezave v aplikaciji.",
            en: "Show the code at the entrance — works offline in the app too.",
          },
        ],
      },
      {
        heading: { sl: "Znana prizorišča po svetu", en: "Popular venues worldwide" },
        items: [
          { sl: "Sagrada Família in Park Güell (Barcelona)", en: "Sagrada Família and Park Güell (Barcelona)" },
          { sl: "Kolosej in Vatikanski muzeji (Rim)", en: "Colosseum and Vatican Museums (Rome)" },
          { sl: "Doževa palača (Benetke), Uffizi (Firence)", en: "Doge's Palace (Venice), Uffizi Gallery (Florence)" },
        ],
      },
    ],
  },
  {
    slug: "insurance",
    title: { sl: "Zavarovanje", en: "Travel insurance" },
    lead: {
      sl: "World Nomads in SafetyWing — popotniško zavarovanje za naslednjo dogodivščino.",
      en: "World Nomads and SafetyWing — travel insurance for your next adventure.",
    },
    coverage: {
      sl: "Zdravstveni stroški, prtljaga, odpoved potovanja (obseg je odvisen od police in države bivanja).",
      en: "Medical costs, luggage, trip cancellation (cover depends on the policy and country of residence).",
    },
    content: "available",
    link: "coming",
    providers: [
      {
        slug: "worldnomads",
        label: "World Nomads",
        status: "affiliate",
        accessNote: {
          sl: "Brez API-ja (affiliate-only, plačilo po ponudbi) — samo povezava.",
          en: "No API (affiliate-only, pay-per-quote) — link only.",
        },
        docsUrl: "https://partner.worldnomads.com",
      },
      {
        slug: "safetywing",
        label: "SafetyWing",
        status: "affiliate",
        accessNote: {
          sl: "Brez javnega API-ja (ambassador program) — samo povezava.",
          en: "No public API (ambassador program) — link only.",
        },
        docsUrl: "https://safetywing.com/ambassador",
      },
    ],
    sections: [
      {
        heading: { sl: "Kaj pokriva", en: "What's covered" },
        items: [
          {
            sl: "Zdravstveni stroški in nujna pomoč na poti.",
            en: "Medical expenses and emergency assistance on the road.",
          },
          {
            sl: "Prtljaga in osebne stvari.",
            en: "Luggage and personal belongings.",
          },
          {
            sl: "Odpoved in prekinitev potovanja — po pogoji izbrane police.",
            en: "Trip cancellation and interruption — per the chosen policy terms.",
          },
          {
            sl: "Iskrenost: natančen obseg je odvisen od police in države bivanja — preveri pred nakupom.",
            en: "Honesty note: exact cover depends on the policy and your country of residence — check before buying.",
          },
        ],
      },
      {
        heading: { sl: "Zakaj World Nomads", en: "Why World Nomads" },
        items: [
          {
            sl: "Pokritje avanturističnih aktivnosti po izbiri (pohodi, kajak, smučanje …).",
            en: "Optional cover for adventure activities (hiking, kayaking, skiing …).",
          },
          {
            sl: "Nakup police tudi, ko si že na poti.",
            en: "Buy a policy even when you're already travelling.",
          },
          {
            sl: "Spletni zahtevki in podpora v več jezikih.",
            en: "Online claims and multilingual support.",
          },
        ],
      },
      {
        heading: { sl: "Kako do ponudbe", en: "Getting a quote" },
        items: [
          {
            sl: "Ponudbo (quote) izračuna zavarovalnica za tvojo pot in državo bivanja.",
            en: "The insurer calculates a quote for your trip and country of residence.",
          },
          {
            sl: "Povezava do partnerja se konfigurira po odobritvi programa — do takaj iskren namestnik.",
            en: "The partner link is configured once the programme approves us — an honest placeholder until then.",
          },
        ],
      },
    ],
  },
  {
    slug: "esim",
    title: { sl: "eSIM podatki", en: "eSIM data" },
    lead: {
      sl: "Airalo — eSIM podatkovni paketi za 200+ destinacij, namestitev v minutah.",
      en: "Airalo — eSIM data packages for 200+ destinations, installed in minutes.",
    },
    coverage: {
      sl: "Lokalni (Slovenija), regionalni (Evropa) in globalni paketi.",
      en: "Local (Slovenia), regional (Europe) and global packages.",
    },
    content: "available",
    link: "coming",
    featured: true,
    providers: [
      {
        slug: "airalo",
        label: "Airalo",
        status: "affiliate",
        accessNote: {
          sl: "Partner API (OAuth2, odobritev) — vrata peskovnika živo preverjena; poverilnici še nista izdani. Danes samo affiliate povezava.",
          en: "Partner API (OAuth2, approval) — sandbox gate verified live; credentials not yet issued. Today affiliate link only.",
        },
        docsUrl: "https://developers.partners.airalo.com",
      },
    ],
    stats: [
      { value: "30 mio+", label: { sl: "ljudi izbere Airalo", en: "people choose Airalo" } },
      { value: "200+", label: { sl: "pokritih lokacij", en: "covered locations" } },
      { value: "53", label: { sl: "jezikov aplikacije", en: "app languages" } },
    ],
    sections: [
      {
        heading: { sl: "Zakaj Airalo", en: "Why Airalo" },
        items: [
          {
            sl: "Lokalna, regionalna in globalna pokritost za 200+ lokacij.",
            en: "Local, regional and global coverage for 200+ locations.",
          },
          {
            sl: "Prilagodljivi paketi, vključno z neomejenimi podatki.",
            en: "Flexible packages, including unlimited data options.",
          },
          {
            sl: "Aplikacija v 53 jezikih, podpora več valut.",
            en: "App in 53 languages, multiple currencies supported.",
          },
          {
            sl: "Enostavna namestitev — povezan si v minutah.",
            en: "Easy installation — connected in minutes.",
          },
        ],
      },
      {
        heading: { sl: "Vrste paketov", en: "Package types" },
        items: [
          {
            sl: "Lokalni (Local) — eSIM za posamezno državo, npr. Slovenija.",
            en: "Local — an eSIM for a single country, e.g. Slovenia.",
          },
          {
            sl: "Regionalni (Regional) — paketi za regije, npr. Evropa.",
            en: "Regional — packages for regions, e.g. Europe.",
          },
          {
            sl: "Globalni (Global) — svetovna pokritost z enim paketom.",
            en: "Global — worldwide coverage with one package.",
          },
        ],
      },
      {
        heading: { sl: "Pogosta vprašanja", en: "Frequently asked questions" },
        items: [
          {
            sl: "Ali moj telefon podpira eSIM? Preveri pri proizvajalcu ali operaterju — Android potrebuje meni „Dodaj operaterja“, iOS nastavitve mobilnih storitev.",
            en: "Does my phone support eSIM? Confirm with the manufacturer or carrier — Android needs an “Add carrier” menu, iOS is under cellular settings.",
          },
          {
            sl: "Kdaj poteče paket? Ob izčrpanju podatkov ali poteku veljavnosti; veljavnost se začne z aktivacijo — ob prvi povezavi v podprtem omrežju.",
            en: "When does a package expire? When data runs out or validity ends; validity starts at activation — the first connection to a supported network.",
          },
          {
            sl: "Kje kupim? Prek spletne strani ali aplikacije Airalo.",
            en: "Where do I buy? Via the Airalo website or app.",
          },
        ],
      },
    ],
  },
];

/** Poišči ruto po slug-u; undefined, če ne obstaja. */
export function getGoRoute(slug: string): GoPartnerRoute | undefined {
  return GO_PARTNERS.find((p) => p.slug === slug);
}
