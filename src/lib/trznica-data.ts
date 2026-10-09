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
  label: { sl: string; en: string; it: string; de: string; fr: string; es: string };
  description: { sl: string; en: string; it: string; de: string; fr: string; es: string };
  coverage: { sl: string; en: string; it: string; de: string; fr: string; es: string };
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
    label: { sl: "OpenStreetMap", en: "OpenStreetMap", it: "OpenStreetMap", de: "OpenStreetMap", fr: "OpenStreetMap", es: "OpenStreetMap" },
    description: {
      sl: "Odprti podatki (ODbL) — znamenitosti, muzeji, restavracije, nastanitve in bencinske postaje z živimi poizvedbami po pogledu zemljevida.",
      en: "Open data (ODbL) — attractions, museums, restaurants, accommodation and petrol stations with live viewport queries.",
      it: "Dati aperti (ODbL) — attrazioni, musei, ristoranti, alloggi e stazioni di servizio con interrogazioni in tempo reale sull'area visibile della mappa.",
      de: "Offene Daten (ODbL) — Sehenswürdigkeiten, Museen, Restaurants, Unterkünfte und Tankstellen mit Live-Abfragen zum sichtbaren Kartenausschnitt.",
      fr: "Données ouvertes (ODbL) — sites, musées, restaurants, hébergements et stations-service avec des requêtes en temps réel sur la zone visible de la carte.",
      es: "Datos abiertos (ODbL) — atracciones, museos, restaurantes, alojamientos y gasolineras con consultas en tiempo real sobre el área visible del mapa.",
    },
    coverage: {
      sl: "Slovenija in zahodni Balkan (pogled zemljevida).",
      en: "Slovenia and the Western Balkans (map viewport).",
      it: "Slovenia e Balcani occidentali (area visibile della mappa).",
      de: "Slowenien und der Westbalkan (Kartenausschnitt).",
      fr: "La Slovénie et les Balkans occidentaux (zone visible de la carte).",
      es: "Eslovenia y los Balcanes Occidentales (área visible del mapa).",
    },
    status: "local",
    availability: "available",
    providers: ["OpenStreetMap"],
  },
  {
    slug: "fsq",
    group: "local",
    label: { sl: "Foursquare Open Places", en: "Foursquare Open Places", it: "Foursquare Open Places", de: "Foursquare Open Places", fr: "Foursquare Open Places", es: "Foursquare Open Places" },
    description: {
      sl: "Odprti podatki (Apache-2.0) — POI sloj z ocenami. Množica NI nameščena v peskovniku → sloj je iskreno neaktiven.",
      en: "Open data (Apache-2.0) — a POI layer with ratings. The dataset is NOT installed in the sandbox → the layer is honestly inactive.",
      it: "Dati aperti (Apache-2.0) — livello POI con valutazioni. Il dataset NON è installato nella sandbox → il livello è onestamente inattivo.",
      de: "Offene Daten (Apache-2.0) — POI-Layer mit Bewertungen. Der Datensatz ist in der Sandbox NICHT installiert → der Layer ist ehrlicherweise inaktiv.",
      fr: "Données ouvertes (Apache-2.0) — couche de POI avec évaluations. Le jeu de données N'est PAS installé dans le bac à sable → la couche est honnêtement inactive.",
      es: "Datos abiertos (Apache-2.0) — capa de POI con valoraciones. El conjunto de datos NO está instalado en el entorno de pruebas → la capa está honestamente inactiva.",
    },
    coverage: {
      sl: "SI + HR + ME + AL (ko bo množica nameščena).",
      en: "SI + HR + ME + AL (once the dataset is installed).",
      it: "SI + HR + ME + AL (quando il dataset sarà installato).",
      de: "SI + HR + ME + AL (sobald der Datensatz installiert ist).",
      fr: "SI + HR + ME + AL (une fois le jeu de données installé).",
      es: "SI + HR + ME + AL (cuando el conjunto de datos esté instalado).",
    },
    status: "local",
    availability: "coming",
    providers: ["Foursquare"],
  },
  {
    slug: "sto",
    group: "local",
    label: { sl: "slovenia.info (STO)", en: "slovenia.info (STO)", it: "slovenia.info (STO)", de: "slovenia.info (STO)", fr: "slovenia.info (STO)", es: "slovenia.info (STO)" },
    description: {
      sl: "Uradna vsebina slovenske turistične organizacije (llms.txt) — opisi za AI, brez geo feeeda.",
      en: "Official content of the Slovenian tourist board (llms.txt) — AI descriptions, no geo feed.",
      it: "Contenuti ufficiali dell'organizzazione turistica slovena (llms.txt) — descrizioni per l'IA, senza feed geografico.",
      de: "Offizielle Inhalte der slowenischen Tourismusorganisation (llms.txt) — KI-Beschreibungen, ohne Geo-Feed.",
      fr: "Contenus officiels de l'office de tourisme slovène (llms.txt) — descriptions pour l'IA, sans flux géographique.",
      es: "Contenido oficial de la organización turística eslovena (llms.txt) — descripciones para la IA, sin feed geográfico.",
    },
    coverage: {
      sl: "Besedilni vir (RAG) — ni sloj zemljevida.",
      en: "Text source (RAG) — not a map layer.",
      it: "Fonte testuale (RAG) — non è un livello mappa.",
      de: "Textquelle (RAG) — keine Kartenebene.",
      fr: "Source textuelle (RAG) — pas une couche cartographique.",
      es: "Fuente textual (RAG) — no es una capa de mapa.",
    },
    status: "local",
    availability: "coming",
    providers: ["STO"],
  },

  // ── Lastna tržnica (own_marketplace) ────────────────────────────────
  {
    slug: "own",
    group: "own",
    label: { sl: "Lokalni ponudniki (naša tržnica)", en: "Local providers (our marketplace)", it: "Fornitori locali (il nostro mercato)", de: "Lokale Anbieter (unser Marktplatz)", fr: "Prestataires locaux (notre marketplace)", es: "Proveedores locales (nuestro mercado)" },
    description: {
      sl: "Lastna tržnica z lastnim checkoutom: izkušnje slovenskih ponudnikov z živo zalogo in nakupom na mestu (Stripe; v peskovniku demo plačila — izrecno označena). Listingi fizičnih ponudnikov iz produkcije niso bili zajeti — ta sloj ostaja iskreno prazen.",
      en: "Our own marketplace with our own checkout: experiences by Slovenian providers with live stock and on-site purchase (Stripe; demo payments in the sandbox — explicitly labelled). Physical provider listings from production were not captured — that layer stays honestly empty.",
      it: "Un nostro mercato con checkout proprio: esperienze di fornitori sloveni con scorte in tempo reale e acquisto sul posto (Stripe; nella sandbox pagamenti in demo — esplicitamente indicati). I listing dei fornitori fisici dalla produzione non sono stati acquisiti — quel livello resta onestamente vuoto.",
      de: "Ein eigener Marktplatz mit eigenem Checkout: Erlebnisse slowenischer Anbieter mit Live-Bestand und Kauf an Ort und Stelle (Stripe; in der Sandbox Demo-Zahlungen — ausdrücklich gekennzeichnet). Listings physischer Anbieter aus der Produktion wurden nicht erfasst — diese Ebene bleibt ehrlicherweise leer.",
      fr: "Notre propre place de marché avec notre propre paiement : expériences de prestataires slovènes avec stock en direct et achat sur place (Stripe ; paiements de démonstration dans le bac à sable — clairement signalés). Les annonces de prestataires physiques issues de la production n'ont pas été capturées — cette couche reste honnêtement vide.",
      es: "Nuestro propio mercado con checkout propio: experiencias de proveedores eslovenos con stock en vivo y compra en el sitio (Stripe; en el entorno de pruebas, pagos de demostración — señalados expresamente). Los listados de proveedores físicos de la producción no se capturaron — esa capa permanece honestamente vacía.",
    },
    coverage: {
      sl: "Izkušnje po destinacijah nabora (Bled, Soča, Piran …) z živim checkoutom.",
      en: "Experiences across the dataset destinations (Bled, Soča, Piran …) with a live checkout.",
      it: "Esperienze nelle destinazioni del dataset (Bled, Isonzo, Pirano …) con checkout attivo.",
      de: "Erlebnisse in den Destinationen des Datensatzes (Bled, Soča, Piran …) mit Live-Checkout.",
      fr: "Expériences sur les destinations du jeu de données (Bled, Soča, Piran …) avec un paiement en direct.",
      es: "Experiencias en los destinos del conjunto de datos (Bled, Soča, Piran …) con checkout en vivo.",
    },
    status: "search",
    availability: "available",
    providers: ["Discover Slovenia (lastna tržnica)"],
  },

  // ── Komercialni partnerji ───────────────────────────────────────────
  {
    slug: "transfers",
    group: "commercial",
    label: { sl: "Transferji", en: "Transfers", it: "Transfer", de: "Transfers", fr: "Transferts", es: "Traslados" },
    description: {
      sl: "Zasebni transferji z letališč in med mesti — fiksna cena, srečanje z voznikom, brezplačna odpoved.",
      en: "Private transfers from airports and between cities — fixed price, meet & greet, free cancellation.",
      it: "Transfer privati da e per gli aeroporti e tra le città — prezzo fisso, accoglienza dell'autista, cancellazione gratuita.",
      de: "Private Transfers von Flughäfen und zwischen Städten — Festpreis, Empfang durch den Fahrer, kostenlose Stornierung.",
      fr: "Transferts privés depuis les aéroports et entre villes — prix fixe, accueil par le chauffeur, annulation gratuite.",
      es: "Traslados privados desde aeropuertos y entre ciudades — precio fijo, recepción por el conductor, cancelación gratuita.",
    },
    coverage: {
      sl: "Letališče Ljubljana, Bled, Portorož, Maribor …",
      en: "Ljubljana Airport, Bled, Portorož, Maribor …",
      it: "Aeroporto di Lubiana, Bled, Portorose, Maribor …",
      de: "Flughafen Laibach, Bled, Portorož, Maribor …",
      fr: "Aéroport de Ljubljana, Bled, Portorož, Maribor …",
      es: "Aeropuerto de Liubliana, Bled, Portorož, Maribor …",
    },
    status: "static",
    availability: "available",
    goRoute: "transfers",
    providers: ["KiwiTaxi"],
  },
  {
    slug: "hotels",
    group: "commercial",
    label: { sl: "Nastanitve", en: "Stays", it: "Soggiorni", de: "Unterkünfte", fr: "Séjours", es: "Alojamientos" },
    description: {
      sl: "Hoteli, apartmaji in gostišča — rezervacija prek partnerja (povezava se konfigurira po odobritvi).",
      en: "Hotels, apartments and guesthouses — booking via a partner (link is configured upon approval).",
      it: "Hotel, appartamenti e pensioni — prenotazione tramite un partner (il link viene configurato dopo l'approvazione).",
      de: "Hotels, Apartments und Gasthöfe — Buchung über einen Partner (der Link wird nach Freigabe konfiguriert).",
      fr: "Hôtels, appartements et maisons d'hôtes — réservation via un partenaire (le lien est configuré après validation).",
      es: "Hoteles, apartamentos y casas de huéspedes — reserva a través de un socio (el enlace se configura tras la aprobación).",
    },
    coverage: {
      sl: "Vse destinacije nabora.",
      en: "All dataset destinations.",
      it: "Tutte le destinazioni del dataset.",
      de: "Alle Destinationen des Datensatzes.",
      fr: "Toutes les destinations du jeu de données.",
      es: "Todos los destinos del conjunto de datos.",
    },
    status: "affiliate",
    availability: "coming",
    goRoute: "hotels",
    providers: ["Booking.com"],
  },
  {
    slug: "flights",
    group: "commercial",
    label: { sl: "Leti", en: "Flights", it: "Voli", de: "Flüge", fr: "Vols", es: "Vuelos" },
    description: {
      sl: "Letalske povezave do Ljubljane in bližnjih letališč (Zagreb, Benetke, Dunaj).",
      en: "Flights to Ljubljana and nearby airports (Zagreb, Venice, Vienna).",
      it: "Voli per Lubiana e per gli aeroporti vicini (Zagabria, Venezia, Vienna).",
      de: "Flüge nach Laibach und zu nahegelegenen Flughäfen (Zagreb, Venedig, Wien).",
      fr: "Vols vers Ljubljana et les aéroports proches (Zagreb, Venise, Vienne).",
      es: "Vuelos a Liubliana y a aeropuertos cercanos (Zagreb, Venecia, Viena).",
    },
    coverage: {
      sl: "Izhodišče → cilj (iskanje).",
      en: "Origin → destination (search).",
      it: "Origine → destinazione (ricerca).",
      de: "Start → Ziel (Suche).",
      fr: "Origine → destination (recherche).",
      es: "Origen → destino (búsqueda).",
    },
    status: "affiliate",
    availability: "coming",
    goRoute: "flights",
    providers: ["Skyscanner", "Travelpayouts"],
  },
  {
    slug: "cars",
    group: "commercial",
    label: { sl: "Najem avtov", en: "Car rental", it: "Noleggio auto", de: "Mietwagen", fr: "Location de voiture", es: "Alquiler de coches" },
    description: {
      sl: "Primerjava ponudb najema avtomobilov z brezplačno odpovedjo.",
      en: "Rental comparison with free cancellation.",
      it: "Confronto di offerte di noleggio con cancellazione gratuita.",
      de: "Mietwagen-Vergleich mit kostenloser Stornierung.",
      fr: "Comparaison d'offres de location avec annulation gratuite.",
      es: "Comparación de ofertas de alquiler con cancelación gratuita.",
    },
    coverage: {
      sl: "Letališča in mesta (Ljubljana, Zagreb, Split …).",
      en: "Airports and cities (Ljubljana, Zagreb, Split …).",
      it: "Aeroporti e città (Lubiana, Zagabria, Spalato …).",
      de: "Flughäfen und Städte (Laibach, Zagreb, Split …).",
      fr: "Aéroports et villes (Ljubljana, Zagreb, Split …).",
      es: "Aeropuertos y ciudades (Liubliana, Zagreb, Split …).",
    },
    status: "affiliate",
    availability: "coming",
    goRoute: "cars",
    providers: ["DiscoverCars"],
  },
  {
    slug: "transport",
    group: "commercial",
    label: { sl: "Medkrajevni transport", en: "Intercity transport", it: "Trasporti interurbani", de: "Interurbaner Verkehr", fr: "Transport interurbain", es: "Transporte interurbano" },
    description: {
      sl: "Vlaki in avtobusi med mesti na enem iskanju.",
      en: "Trains and buses between cities in one search.",
      it: "Treni e autobus tra le città in un'unica ricerca.",
      de: "Züge und Busse zwischen Städten in einer Suche.",
      fr: "Trains et bus entre villes en une seule recherche.",
      es: "Trenes y autobuses entre ciudades en una sola búsqueda.",
    },
    coverage: {
      sl: "Ljubljana–Zagreb, obala, Dunaj …",
      en: "Ljubljana–Zagreb, the coast, Vienna …",
      it: "Lubiana–Zagabria, la costa, Vienna …",
      de: "Laibach–Zagreb, die Küste, Wien …",
      fr: "Ljubljana–Zagreb, la côte, Vienne …",
      es: "Liubliana–Zagreb, la costa, Viena …",
    },
    status: "affiliate",
    availability: "coming",
    goRoute: "transport",
    providers: ["Omio"],
  },
  {
    slug: "activities",
    group: "commercial",
    label: { sl: "Izkušnje in aktivnosti", en: "Experiences & activities", it: "Esperienze e attività", de: "Erlebnisse & Aktivitäten", fr: "Expériences et activités", es: "Experiencias y actividades" },
    description: {
      sl: "Izleti, vstopnine in aktivnosti z lokalnimi ponudniki.",
      en: "Tours, tickets and activities with local providers.",
      it: "Tour, biglietti e attività con fornitori locali.",
      de: "Touren, Tickets und Aktivitäten mit lokalen Anbietern.",
      fr: "Circuits, billets et activités avec des prestataires locaux.",
      es: "Tours, entradas y actividades con proveedores locales.",
    },
    coverage: {
      sl: "38 destinacij nabora.",
      en: "The 38 dataset destinations.",
      it: "Le 38 destinazioni del dataset.",
      de: "Die 38 Destinationen des Datensatzes.",
      fr: "Les 38 destinations du jeu de données.",
      es: "Los 38 destinos del conjunto de datos.",
    },
    status: "affiliate",
    availability: "coming",
    goRoute: "activities",
    providers: ["GetYourGuide"],
  },
  {
    slug: "viator",
    group: "commercial",
    label: { sl: "Turi in izleti", en: "Tours & excursions", it: "Tour ed escursioni", de: "Touren & Ausflüge", fr: "Circuits & excursions", es: "Visitas y excursiones" },
    description: {
      sl: "Vodeni izleti skupnosti Tripadvisor.",
      en: "Tripadvisor-community guided tours.",
      it: "Tour guidati della community di Tripadvisor.",
      de: "Geführte Touren aus der Tripadvisor-Community.",
      fr: "Circuits guidés de la communauté Tripadvisor.",
      es: "Visitas guiadas de la comunidad de Tripadvisor.",
    },
    coverage: {
      sl: "Vodeni izleti, izletniški programi, kulinarika.",
      en: "Guided tours, day trips, food experiences.",
      it: "Tour guidati, gite di un giorno, esperienze gastronomiche.",
      de: "Geführte Touren, Tagesausflüge, kulinarische Erlebnisse.",
      fr: "Circuits guidés, excursions d'une journée, expériences gourmandes.",
      es: "Visitas guiadas, excursiones de un día, experiencias gastronómicas.",
    },
    status: "affiliate",
    availability: "coming",
    goRoute: "viator",
    providers: ["Viator"],
  },
  {
    slug: "tickets",
    group: "commercial",
    label: { sl: "Vstopnice", en: "Tickets", it: "Biglietti", de: "Tickets", fr: "Billets", es: "Entradas" },
    description: {
      sl: "Vstopnice za muzeje in znamenitosti — takoj na telefonu, brez čakanja.",
      en: "Museum and attraction tickets — instantly on your phone, skip the line.",
      it: "Biglietti per musei e attrazioni — subito sul telefono, senza fila.",
      de: "Tickets für Museen und Sehenswürdigkeiten — sofort auf dem Handy, ohne Anstehen.",
      fr: "Billets pour musées et sites — immédiatement sur votre téléphone, sans file d'attente.",
      es: "Entradas para museos y atracciones — al instante en tu móvil, sin colas.",
    },
    coverage: {
      sl: "Muzeji in znamenitosti po svetu.",
      en: "Museums and attractions worldwide.",
      it: "Musei e attrazioni in tutto il mondo.",
      de: "Museen und Sehenswürdigkeiten weltweit.",
      fr: "Musées et sites dans le monde entier.",
      es: "Museos y atracciones de todo el mundo.",
    },
    status: "affiliate",
    availability: "available",
    goRoute: "tickets",
    providers: ["Tiqets"],
  },
  {
    slug: "insurance",
    group: "commercial",
    label: { sl: "Zavarovanje", en: "Travel insurance", it: "Assicurazione di viaggio", de: "Reiseversicherung", fr: "Assurance voyage", es: "Seguro de viaje" },
    description: {
      sl: "Popotniško zavarovanje za naslednjo dogodivščino — tudi avanturistične aktivnosti.",
      en: "Travel insurance for your next adventure — adventure activities included by option.",
      it: "Assicurazione di viaggio per la prossima avventura — attività avventurose incluse su opzione.",
      de: "Reiseversicherung für Ihr nächstes Abenteuer — Abenteueraktivitäten je nach Option inklusive.",
      fr: "Assurance voyage pour votre prochaine aventure — activités d'aventure incluses en option.",
      es: "Seguro de viaje para tu próxima aventura — actividades de aventura incluidas según opción.",
    },
    coverage: {
      sl: "Zdravstveni stroški, prtljaga, odpoved (odvisno od police).",
      en: "Medical, luggage, cancellation (policy-dependent).",
      it: "Medico, bagaglio, annullamento (in base alla polizza).",
      de: "Medizin, Gepäck, Stornierung (abhängig von der Police).",
      fr: "Médical, bagages, annulation (selon la police).",
      es: "Médico, equipaje, cancelación (según la póliza).",
    },
    status: "affiliate",
    availability: "available",
    goRoute: "insurance",
    providers: ["World Nomads", "SafetyWing"],
  },
  {
    slug: "esim",
    group: "commercial",
    label: { sl: "eSIM podatki", en: "eSIM data", it: "Dati eSIM", de: "eSIM-Daten", fr: "Données eSIM", es: "Datos eSIM" },
    description: {
      sl: "eSIM podatkovni paketi za 200+ destinacij — namestitev v minutah.",
      en: "eSIM data packages for 200+ destinations — installed in minutes.",
      it: "Pacchetti dati eSIM per oltre 200 destinazioni — attivazione in pochi minuti.",
      de: "eSIM-Datenpakete für über 200 Destinationen — in Minuten installiert.",
      fr: "Forfaits de données eSIM pour plus de 200 destinations — installés en quelques minutes.",
      es: "Paquetes de datos eSIM para más de 200 destinos — instalados en minutos.",
    },
    coverage: {
      sl: "Lokalni (Slovenija), regionalni (Evropa), globalni.",
      en: "Local (Slovenia), regional (Europe), global.",
      it: "Locale (Slovenia), regionale (Europa), globale.",
      de: "Lokal (Slowenien), regional (Europa), global.",
      fr: "Local (Slovénie), régional (Europe), mondial.",
      es: "Local (Eslovenia), regional (Europa), global.",
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
  name: { sl: string; en: string; it: string; de: string; fr: string; es: string };
  kind: "experience" | "ticket";
  destinationSlug: string;
  description: { sl: string; en: string; it: string; de: string; fr: string; es: string };
  /** Ocena stroška na osebo (EUR) — costPerPerson destinacije v naboru. */
  priceEstimate: number;
  image: string;
}

export const OWN_PRODUCTS: OwnProduct[] = [
  {
    id: "izk-bled-pletna",
    name: { sl: "Pletna vožnja do Blejskega otoka", en: "Pletna ride to Bled Island", it: "Gita in pletna all'isola di Bled", de: "Pletna-Fahrt zur Insel im Bleder See", fr: "Promenade en pletna vers l'île de Bled", es: "Paseo en pletna a la isla de Bled" },
    kind: "experience",
    destinationSlug: "bled",
    description: {
      sl: "Tradicionalna pletna vožnja čez jezero do cerkvice na otoku — dejavnost iz kanonskega nabora destinacije Bled.",
      en: "A traditional pletna boat ride across the lake to the island church — an activity from the canonical Bled dataset entry.",
      it: "Una tradizionale gita in pletna attraverso il lago fino alla chiesetta sull'isola — un'attività dal dataset canonico della destinazione Bled.",
      de: "Eine traditionelle Pletna-Fahrt über den See zur Inselkirche — eine Aktivität aus dem kanonischen Datensatz der Destination Bled.",
      fr: "Une promenade traditionnelle en pletna à travers le lac jusqu'à l'église de l'île — une activité de l'entrée canonique de la destination Bled.",
      es: "Un paseo tradicional en pletna a través del lago hasta la iglesia de la isla — una actividad del conjunto de datos canónico del destino Bled.",
    },
    priceEstimate: 25,
    image: "/content/bled.jpg",
  },
  {
    id: "izk-bohinj-vogel",
    name: { sl: "Žičnica Vogel nad Bohinjem", en: "Vogel cable car above Bohinj", it: "Funivia del Vogel sopra Bohinj", de: "Vogel-Seilbahn über Bohinj", fr: "Télécabine du Vogel au-dessus de Bohinj", es: "Teleférico del Vogel sobre Bohinj" },
    kind: "experience",
    destinationSlug: "bohinj",
    description: {
      sl: "Voznja z žičnico na Vogel (1535 m) s panoramskim razgledom na Bohinjsko jezero in Julijce.",
      en: "Ride up Mt Vogel (1535 m) for panoramic views of Lake Bohinj and the Julian Alps.",
      it: "Salita in funivia al Vogel (1535 m) con vista panoramica sul lago di Bohinj e sulle Alpi Giulie.",
      de: "Fahrt mit der Seilbahn auf den Vogel (1535 m) mit Panoramablick auf den Bohinjer See und die Julischen Alpen.",
      fr: "Montée en télécabine au Vogel (1535 m) avec vue panoramique sur le lac de Bohinj et les Alpes juliennes.",
      es: "Subida en teleférico al Vogel (1535 m) con vistas panorámicas del lago Bohinj y los Alpes Julianos.",
    },
    priceEstimate: 15,
    image: "/content/bohinj.jpg",
  },
  {
    id: "izk-ljubljana-kulinarika",
    name: { sl: "Kulinarična tura po Ljubljani", en: "Ljubljana food tour", it: "Tour gastronomico di Lubiana", de: "Kulinarische Tour durch Laibach", fr: "Tour gourmand de Ljubljana", es: "Ruta gastronómica por Liubliana" },
    kind: "experience",
    destinationSlug: "ljubljana",
    description: {
      sl: "Kulinarični sprehod po starem mestnem jedru — od Tromostovja do osrednje tržnice.",
      en: "A culinary walk through the old town — from the Triple Bridge to the central market.",
      it: "Una passeggiata gastronomica nel centro storico — dal Ponte Triplo al mercato centrale.",
      de: "Ein kulinarischer Spaziergang durch die Altstadt — von den Drei Brücken bis zum zentralen Markt.",
      fr: "Une balade gourmande dans la vieille ville — du Triple Pont au marché central.",
      es: "Un paseo gastronómico por el casco antiguo — desde el Puente Triple hasta el mercado central.",
    },
    priceEstimate: 20,
    image: "/content/ljubljana.jpg",
  },
  {
    id: "vstop-postojna-vlakec",
    name: { sl: "Jamska tura z vlakcem — Postojnska jama", en: "Cave tour by train — Postojna Cave", it: "Visita della grotta col trenino — Grotte di Postumia", de: "Höhlenrundfahrt mit dem Zug — Höhle von Postojna", fr: "Visite de la grotte en petit train — grotte de Postojna", es: "Visita a la cueva en trenecito — cueva de Postojna" },
    kind: "ticket",
    destinationSlug: "postojnska-jama",
    description: {
      sl: "Obisk največjega turističnega jamskega sistema v Evropi z edinstvenim podzemnim vlakcem.",
      en: "Visit Europe's largest show cave system with its unique underground train.",
      it: "Visita al più grande sistema di grotte turistiche d'Europa con il suo unico treno sotterraneo.",
      de: "Besuch des größten Schauhöhlensystems Europas mit seiner einzigartigen unterirdischen Bahn.",
      fr: "Visite du plus grand réseau de grottes touristiques d'Europe et de son unique train souterrain.",
      es: "Visita al mayor sistema de cuevas turísticas de Europa con su único tren subterráneo.",
    },
    priceEstimate: 30,
    image: "/content/postojnska-jama.jpg",
  },
  {
    id: "izk-soca-rafting",
    name: { sl: "Rafting na Soči", en: "Rafting on the Soča", it: "Rafting sull'Isonzo", de: "Rafting auf der Soča", fr: "Rafting sur la Soča", es: "Rafting en el Soča" },
    kind: "experience",
    destinationSlug: "reka-soca",
    description: {
      sl: "Spust po smaragdnih brzicah Soče — ena najbolj znanih aktivnosti doline.",
      en: "Paddle the emerald rapids of the Soča — one of the valley's best-known activities.",
      it: "Discesa nelle rapide smeraldo dell'Isonzo — una delle attività più note della valle.",
      de: "Paddeln auf den smaragdgrünen Stromschnellen der Soča — eine der bekanntesten Aktivitäten des Tals.",
      fr: "Descendez les rapides émeraude de la Soča — l'une des activités les plus connues de la vallée.",
      es: "Desciende los rápidos esmeralda del Soča — una de las actividades más conocidas del valle.",
    },
    priceEstimate: 40,
    image: "/content/reka-soca.jpg",
  },
  {
    id: "izk-piran-soline",
    name: { sl: "Obisk solin pri Piranu", en: "Salt-pans visit near Piran", it: "Visita alle saline vicino a Pirano", de: "Besuch der Salinen bei Piran", fr: "Visite des salines près de Piran", es: "Visita a las salinas cerca de Piran" },
    kind: "experience",
    destinationSlug: "piran",
    description: {
      sl: "Sprehod po Sečoveljskih solinah — stoletna tradicija pridobivanja soli.",
      en: "Walk the Sečovlje salt pans — centuries of traditional salt harvesting.",
      it: "Passeggiata nelle saline di Sicciole — secoli di tradizionale raccolta del sale.",
      de: "Spaziergang durch die Salinen von Sečovlje — jahrhundertealte Tradition der Salzgewinnung.",
      fr: "Balade dans les salines de Sečovlje — des siècles de récolte traditionnelle du sel.",
      es: "Paseo por las salinas de Sečovlje — siglos de cosecha tradicional de sal.",
    },
    priceEstimate: 35,
    image: "/content/piran.jpg",
  },
  {
    id: "izk-kobarid-kulinarika",
    name: { sl: "Kulinarična izkušnja v Kobardu", en: "Culinary experience in Kobarid", it: "Esperienza culinaria a Caporetto", de: "Kulinarisches Erlebnis in Kobarid", fr: "Expérience culinaire à Kobarid", es: "Experiencia culinaria en Kobarid" },
    kind: "experience",
    destinationSlug: "kobarid",
    description: {
      sl: "Gastro doživetje Posočja — od Hiše Franko do lokalnih gostiln ob Soči.",
      en: "A gastronomic taste of the Soča Valley — from Hiša Franko to local gostilnas along the river.",
      it: "Un assaggio gastronomico della valle dell'Isonzo — da Hiša Franko alle gostilne locali lungo il fiume.",
      de: "Ein gastronomischer Genuss des Isonzo-Tals — von Hiša Franko bis zu lokalen Gostilnas am Fluss.",
      fr: "Une dégustation gastronomique de la vallée de la Soča — de Hiša Franko aux gostilnas locales le long de la rivière.",
      es: "Un deleite gastronómico del valle del Soča — de Hiša Franko a las gostilnas locales junto al río.",
    },
    priceEstimate: 25,
    image: "/content/kobarid.jpg",
  },
  {
    id: "izk-maribor-vinska",
    name: { sl: "Vinska degustacija v Mariboru", en: "Wine tasting in Maribor", it: "Degustazione di vini a Maribor", de: "Weindegustation in Maribor", fr: "Dégustation de vins à Maribor", es: "Cata de vinos en Maribor" },
    kind: "experience",
    destinationSlug: "maribor",
    description: {
      sl: "Degustacija vinskih sort Štajerske Slovenije v mestu stare trte.",
      en: "Tastings of Styrian Slovenian varieties in the city of the Old Vine.",
      it: "Degustazione delle varietà della Stiria slovena nella città della Vecchia Vite.",
      de: "Degustation slowenisch-steirischer Rebsorten in der Stadt der Alten Rebe.",
      fr: "Dégustation des cépages de la Styrie slovène dans la ville de la Vieille Vigne.",
      es: "Cata de las variedades de la Estiria eslovena en la ciudad de la Vid Vieja.",
    },
    priceEstimate: 20,
    image: "/content/maribor.jpg",
  },
  {
    id: "izk-triglav-alpinizem",
    name: { sl: "Alpinizem v Triglavskem gorovju", en: "Alpinism in the Triglav range", it: "Alpinismo nel gruppo del Triglav", de: "Alpinismus im Triglav-Gebirge", fr: "Alpinisme dans le massif du Triglav", es: "Alpinismo en la cordillera del Triglav" },
    kind: "experience",
    destinationSlug: "triglav",
    description: {
      sl: "Vzpon na najvišjo slovensko goro (2864 m) z lokalnim vodnikom.",
      en: "Climb Slovenia's highest mountain (2864 m) with a local guide.",
      it: "Ascesa alla più alta montagna slovena (2864 m) con una guida locale.",
      de: "Aufstieg auf Sloweniens höchsten Berg (2864 m) mit einem lokalen Bergführer.",
      fr: "Ascension du plus haut sommet slovène (2864 m) avec un guide local.",
      es: "Ascenso a la montaña más alta de Eslovenia (2864 m) con un guía local.",
    },
    priceEstimate: 15,
    image: "/content/triglav.jpg",
  },
  {
    id: "izk-rogaska-wellness",
    name: { sl: "Wellness dan v Rogaški Slatini", en: "Wellness day in Rogaška Slatina", it: "Giornata wellness a Rogaška Slatina", de: "Wellness-Tag in Rogaška Slatina", fr: "Journée bien-être à Rogaška Slatina", es: "Día de bienestar en Rogaška Slatina" },
    kind: "experience",
    destinationSlug: "rogaska-slatina",
    description: {
      sl: "Zdraviliški dan z mineralno vodo Donat Mg, bazeni in masažami.",
      en: "A spa day with Donat Mg mineral water, pools and massages.",
      it: "Una giornata termale con acqua minerale Donat Mg, piscine e massaggi.",
      de: "Ein Kurbad-Tag mit Donat-Mg-Mineralwasser, Pools und Massagen.",
      fr: "Une journée thermale avec l'eau minérale Donat Mg, piscines et massages.",
      es: "Un día de spa con agua mineral Donat Mg, piscinas y masajes.",
    },
    priceEstimate: 80,
    image: "/content/rogaska-slatina.jpg",
  },
  {
    id: "izk-ptuj-pust",
    name: { sl: "Pustni festival v Ptuju", en: "Carnival festival in Ptuj", it: "Festival di carnevale a Ptuj", de: "Faschingsfestival in Ptuj", fr: "Festival de carnaval à Ptuj", es: "Festival de carnaval en Ptuj" },
    kind: "experience",
    destinationSlug: "ptuj",
    description: {
      sl: "Največji slovenski pustni festival s tradicionalnimi pustami (kurenti).",
      en: "Slovenia's largest carnival with the traditional kurenti figures.",
      it: "Il più grande carnevale sloveno con le tradizionali figure dei kurenti.",
      de: "Sloweniens größtes Faschingsfest mit den traditionellen Kurenti-Figuren.",
      fr: "Le plus grand carnaval slovène avec les traditionnelles figures des kurenti.",
      es: "El carnaval más grande de Eslovenia con las tradicionales figuras kurenti.",
    },
    priceEstimate: 18,
    image: "/content/ptuj.jpg",
  },
];

/** Poišči lastni produkt po ID-ju. */
export function getOwnProduct(id: string): OwnProduct | undefined {
  return OWN_PRODUCTS.find((p) => p.id === id);
}
