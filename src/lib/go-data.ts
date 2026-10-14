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
  accessNote: { sl: string; en: string; it: string; de: string; fr: string; es: string };
  /** Uradna dokumentacija vira (trditve vežejo na vir). */
  docsUrl?: string;
}

export interface GoContentSection {
  heading: { sl: string; en: string; it: string; de: string; fr: string; es: string };
  items: { sl: string; en: string; it: string; de: string; fr: string; es: string }[];
}

export interface GoStat {
  value: string;
  label: { sl: string; en: string; it: string; de: string; fr: string; es: string };
}

export interface GoPartnerRoute {
  slug: GoRouteSlug;
  title: { sl: string; en: string; it: string; de: string; fr: string; es: string };
  lead: { sl: string; en: string; it: string; de: string; fr: string; es: string };
  /** Pokritost (kaj ta kategorija pokriva). */
  coverage: { sl: string; en: string; it: string; de: string; fr: string; es: string };
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
export const SUPPLY_STATUS_LABELS: Record<SupplyStatus, { sl: string; en: string; it: string; de: string; fr: string; es: string }> = {
  local: { sl: "Lokalni vir", en: "Local source", it: "Fonte locale", de: "Lokale Quelle", fr: "Source locale", es: "Fuente local" },
  static: { sl: "Objavljeni podatki", en: "Published data", it: "Dati pubblicati", de: "Veröffentlichte Daten", fr: "Données publiées", es: "Datos publicados" },
  search: { sl: "Iskanje", en: "Search", it: "Ricerca", de: "Suche", fr: "Recherche", es: "Búsqueda" },
  affiliate: { sl: "Povezava partnerja", en: "Partner link", it: "Link del partner", de: "Partner-Link", fr: "Lien partenaire", es: "Enlace del socio" },
  planned: { sl: "Načrtovano", en: "Planned", it: "Previsto", de: "Geplant", fr: "Prévu", es: "Previsto" },
};

/** Vseh 10 /go rut (vrstni red po mirror index.html). */
export const GO_PARTNERS: GoPartnerRoute[] = [
  {
    slug: "hotels",
    title: { sl: "Nastanitve", en: "Stays", it: "Soggiorni", de: "Unterkünfte", fr: "Séjours", es: "Alojamientos" },
    lead: {
      sl: "Booking.com — največja baza nastanitev od hotelov do apartmajev.",
      en: "Booking.com — the largest inventory of stays from hotels to apartments.",
      it: "Booking.com — il più grande inventario di soggiorni, da hotel ad appartamenti.",
      de: "Booking.com — das größte Angebot an Unterkünften von Hotels bis zu Apartments.",
      fr: "Booking.com — le plus grand inventaire de séjours, des hôtels aux appartements.",
      es: "Booking.com — el mayor inventario de alojamientos, de hoteles a apartamentos.",
    },
    coverage: {
      sl: "Nastanitve v vseh 74 destinacijah nabora.",
      en: "Accommodation across all 74 destinations in the dataset.",
      it: "Soggiorni in tutte le 74 destinazioni del dataset.",
      de: "Unterkünfte in allen 74 Destinationen des Datensatzes.",
      fr: "Séjours dans les 74 destinations de l'ensemble de données.",
      es: "Alojamientos en los 74 destinos del conjunto de datos.",
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
          it: "La Demand API richiede lo stato di Managed Affiliate Partner (contratto) — oggi solo link di affiliazione, il livello è pronto e onestamente vuoto.",
          de: "Die Demand-API erfordert den Status Managed Affiliate Partner (Vertrag) — heute nur Partner-Link, die Schicht ist bereit und ehrlich leer.",
          fr: "L'API Demand exige le statut Managed Affiliate Partner (contrat) — aujourd'hui simple lien d'affiliation, la couche est prête et honnêtement vide.",
          es: "La Demand API exige el estado de Managed Affiliate Partner (contrato) — hoy solo enlace de afiliación, la capa está lista y honestamente vacía.",
        },
        docsUrl: "https://developers.booking.com/demand/docs",
      },
    ],
  },
  {
    slug: "flights",
    title: { sl: "Leti", en: "Flights", it: "Voli", de: "Flüge", fr: "Vols", es: "Vuelos" },
    lead: {
      sl: "Skyscanner in Travelpayouts — iskanje letov do Ljubljane in bližnjih letališč.",
      en: "Skyscanner and Travelpayouts — flight search to Ljubljana and nearby airports.",
      it: "Skyscanner e Travelpayouts — ricerca di voli per Ljubljana e gli aeroporti vicini.",
      de: "Skyscanner und Travelpayouts — Flugsuche nach Ljubljana und zu nahen Flughäfen.",
      fr: "Skyscanner et Travelpayouts — recherche de vols vers Ljubljana et les aéroports proches.",
      es: "Skyscanner y Travelpayouts — búsqueda de vuelos a Ljubljana y aeropuertos cercanos.",
    },
    coverage: {
      sl: "Letalske povezave (iskanje izhodišče → cilj).",
      en: "Flight connections (origin → destination search).",
      it: "Collegamenti aerei (ricerca origine → destinazione).",
      de: "Flugverbindungen (Suche Start → Ziel).",
      fr: "Liaisons aériennes (recherche origine → destination).",
      es: "Conexiones aéreas (búsqueda origen → destino).",
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
          it: "Travel API (iscrizione via partners.skyscanner.net) — contratto pubblicamente documentato; chiave API non ancora emessa. Oggi solo link di affiliazione.",
          de: "Travel API (Anmeldung über partners.skyscanner.net) — Vertrag öffentlich dokumentiert; API-Schlüssel noch nicht ausgegeben. Heute nur Partner-Link.",
          fr: "Travel API (inscription via partners.skyscanner.net) — contrat publiquement documenté ; clé API pas encore émise. Aujourd'hui simple lien d'affiliation.",
          es: "Travel API (registro vía partners.skyscanner.net) — contrato públicamente documentado; clave API aún no emitida. Hoy solo enlace de afiliación.",
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
          it: "Data API (token self-serve dopo la registrazione dell'account) — gate verificato dal vivo; token non ancora impostato. Il livello è pronto e onestamente vuoto.",
          de: "Data API (Self-Service-Token nach Kontoregistrierung) — Gate live geprüft; Token noch nicht gesetzt. Die Schicht ist bereit und ehrlich leer.",
          fr: "Data API (jeton libre-service après inscription) — porte vérifiée en direct ; jeton pas encore défini. La couche est prête et honnêtement vide.",
          es: "Data API (token de autoservicio tras registrar la cuenta) — puerta verificada en vivo; token aún sin configurar. La capa está lista y honestamente vacía.",
        },
        docsUrl: "https://support.travelpayouts.com/hc/en-us/categories/200358578-API-and-data",
      },
    ],
  },
  {
    slug: "cars",
    title: { sl: "Najem avtov", en: "Car rental", it: "Noleggio auto", de: "Mietwagen", fr: "Location de voiture", es: "Alquiler de coches" },
    lead: {
      sl: "DiscoverCars — primerjava ponudb najema z brezplačno odpovedjo.",
      en: "DiscoverCars — rental comparison with free cancellation.",
      it: "DiscoverCars — confronto dei noleggi con cancellazione gratuita.",
      de: "DiscoverCars — Vergleich von Mietangeboten mit kostenloser Stornierung.",
      fr: "DiscoverCars — comparaison des locations avec annulation gratuite.",
      es: "DiscoverCars — comparación de alquileres con cancelación gratuita.",
    },
    coverage: {
      sl: "Najem avtov po vsem Balkanu — 10 držav nabora (Ljubljana, Zagreb, Sarajevo, Beograd, Sofija …).",
      en: "Car hire across the Balkans — all 10 dataset countries (Ljubljana, Zagreb, Sarajevo, Belgrade, Sofia …).",
      it: "Noleggio auto in tutti i Balcani — tutti i 10 paesi del dataset (Lubiana, Zagabria, Sarajevo, Belgrado, Sofia …).",
      de: "Mietwagen auf dem ganzen Balkan — alle 10 Länder des Datensatzes (Laibach, Zagreb, Sarajevo, Belgrad, Sofia …).",
      fr: "Location de voiture dans toute la Balkanique — les 10 pays du jeu de données (Ljubljana, Zagreb, Sarajevo, Belgrade, Sofia …).",
      es: "Alquiler de coches en todos los Balcanes — los 10 países del conjunto de datos (Liubliana, Zagreb, Sarajevo, Belgrado, Sofía …).",
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
          it: "Search API solo tramite accordo B4B — oggi solo link di affiliazione.",
          de: "Search API nur über B4B-Vereinbarung — heute nur Partner-Link.",
          fr: "Search API uniquement via un accord B4B — aujourd'hui simple lien d'affiliation.",
          es: "Search API solo mediante acuerdo B4B — hoy solo enlace de afiliación.",
        },
        docsUrl: "https://www.discovercars.com/affiliate",
      },
    ],
  },
  {
    slug: "transfers",
    title: { sl: "Transferji", en: "Transfers", it: "Trasferimenti", de: "Transfers", fr: "Transferts", es: "Traslados" },
    lead: {
      sl: "KiwiTaxi — zasebni transferji po Sloveniji z letališč in med mesti (fiksna cena, srečanje z voznikom).",
      en: "KiwiTaxi — private transfers across Slovenia from airports and between cities (fixed price, meet & greet).",
      it: "KiwiTaxi — transfer privati in tutta la Slovenia da e per gli aeroporti e tra le città (prezzo fisso, autista che ti accoglie).",
      de: "KiwiTaxi — private Transfers in ganz Slowenien von Flughäfen und zwischen Städten (Festpreis, Fahrer empfängt dich).",
      fr: "KiwiTaxi — transferts privés dans toute la Slovénie depuis les aéroports et entre villes (prix fixe, accueil par le chauffeur).",
      es: "KiwiTaxi — traslados privados por toda Eslovenia desde aeropuertos y entre ciudades (precio fijo, recepción del conductor).",
    },
    coverage: {
      sl: "Odhodi: letališče Ljubljana, Ljubljana, Bled, Portorož, Rogaška Slatina, Maribor …",
      en: "Departures: Ljubljana Airport, Ljubljana, Bled, Portorož, Rogaška Slatina, Maribor …",
      it: "Partenze: aeroporto di Ljubljana, Ljubljana, Bled, Portorož, Rogaška Slatina, Maribor …",
      de: "Abfahrten: Flughafen Ljubljana, Ljubljana, Bled, Portorož, Rogaška Slatina, Maribor …",
      fr: "Départs : aéroport de Ljubljana, Ljubljana, Bled, Portorož, Rogaška Slatina, Maribor …",
      es: "Salidas: aeropuerto de Ljubljana, Ljubljana, Bled, Portorož, Rogaška Slatina, Maribor …",
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
          it: "Dati pubblicati dal partner: prezzi reali dei transfer, non preventivi dal vivo. La disponibilità si conferma con il fornitore al momento della prenotazione.",
          de: "Vom Partner veröffentlichte Daten: echte Transferpreise, keine Live-Angebote. Die Verfügbarkeit wird bei der Buchung beim Anbieter bestätigt.",
          fr: "Données publiées par le partenaire : prix réels des transferts, pas des devis en direct. La disponibilité est confirmée auprès du prestataire au moment de la réservation.",
          es: "Datos publicados por el socio: precios reales de los traslados, no cotizaciones en vivo. La disponibilidad se confirma con el proveedor al reservar.",
        },
        docsUrl: "https://kiwitaxi.com/en/partner/webmaster/instructions/api",
      },
    ],
    stats: [
      { value: "1.400.000+", label: { sl: "opravljenih voženj", en: "completed rides", it: "corse completate", de: "abgeschlossene Fahrten", fr: "trajets effectués", es: "viajes completados" } },
      { value: "100+", label: { sl: "obsluženih držav", en: "countries served", it: "paesi serviti", de: "bediente Länder", fr: "pays desservis", es: "países atendidos" } },
    ],
    sections: [
      {
        heading: { sl: "Odhodne točke v Sloveniji", en: "Departure points in Slovenia", it: "Punti di partenza in Slovenia", de: "Abfahrpunkte in Slowenien", fr: "Points de départ en Slovénie", es: "Puntos de salida en Eslovenia" },
        items: [
          { sl: "Letališče Ljubljana — 170 destinacij", en: "Ljubljana Airport — 170 destinations", it: "Aeroporto di Ljubljana — 170 destinazioni", de: "Flughafen Ljubljana — 170 Destinationen", fr: "Aéroport de Ljubljana — 170 destinations", es: "Aeropuerto de Ljubljana — 170 destinos" },
          { sl: "Ljubljana — 139 destinacij", en: "Ljubljana — 139 destinations", it: "Ljubljana — 139 destinazioni", de: "Ljubljana — 139 Destinationen", fr: "Ljubljana — 139 destinations", es: "Ljubljana — 139 destinos" },
          { sl: "Rogaška Slatina — 50 destinacij", en: "Rogaška Slatina — 50 destinations", it: "Rogaška Slatina — 50 destinazioni", de: "Rogaška Slatina — 50 Destinationen", fr: "Rogaška Slatina — 50 destinations", es: "Rogaška Slatina — 50 destinos" },
          { sl: "Portorož — 52 destinacij", en: "Portorož — 52 destinations", it: "Portorož — 52 destinazioni", de: "Portorož — 52 Destinationen", fr: "Portorož — 52 destinations", es: "Portorož — 52 destinos" },
          { sl: "Bled — 45 destinacij", en: "Bled — 45 destinations", it: "Bled — 45 destinazioni", de: "Bled — 45 Destinationen", fr: "Bled — 45 destinations", es: "Bled — 45 destinos" },
          { sl: "Maribor — 22 destinaciji", en: "Maribor — 22 destinations", it: "Maribor — 22 destinazioni", de: "Maribor — 22 Destinationen", fr: "Maribor — 22 destinations", es: "Maribor — 22 destinos" },
        ],
      },
      {
        heading: { sl: "Kako poteka prevoz", en: "How the ride works", it: "Come funziona il trasferimento", de: "So läuft die Fahrt ab", fr: "Comment se déroule le trajet", es: "Cómo funciona el trayecto" },
        items: [
          {
            sl: "Rezervacija vsaj 16 ur pred vožnjo — izbira časa in kraja, plačilo cene, ki jo vidiš.",
            en: "Book at least 16 hours ahead — pick any time or place and pay the fare you see.",
            it: "Prenota almeno 16 ore prima — scegli ora e luogo e paghi la tariffa che vedi.",
            de: "Buche mindestens 16 Stunden im Voraus — wähle Zeit und Ort und zahle den angezeigten Preis.",
            fr: "Réserve au moins 16 heures à l'avance — choisis l'heure et le lieu et paie le tarif affiché.",
            es: "Reserva con al menos 16 horas de antelación — elige hora y lugar y paga la tarifa que ves.",
          },
          {
            sl: "Srečanje z voznikom ob dogovorjeni uri — tablica z tvojim imenom, pomoč s prtljago.",
            en: "Meet your driver at the set time — a sign with your name, luggage assistance included.",
            it: "Il conducente ti attende all'ora concordata — cartello con il tuo nome, aiuto con i bagagli.",
            de: "Der Fahrer erwartet dich zur vereinbarten Zeit — Schild mit deinem Namen, Hilfe beim Gepäck.",
            fr: "Le chauffeur t'attend à l'heure convenue — pancarte à ton nom, aide aux bagages.",
            es: "El conductor te espera a la hora acordada — cartel con tu nombre, ayuda con el equipaje.",
          },
          {
            sl: "90-minutno čakanje ob zamudi leta (paket ob rezervaciji).",
            en: "90-minute waiting period if your flight is delayed (added at booking).",
            it: "Attesa di 90 minuti in caso di volo in ritardo (pacchetto aggiunto alla prenotazione).",
            de: "90 Minuten Wartezeit bei Flugverspätung (bei der Buchung hinzubuchbar).",
            fr: "Attente de 90 minutes si ton vol est retardé (ajouté à la réservation).",
            es: "Espera de 90 minutos si tu vuelo se retrasa (añadido al reservar).",
          },
          {
            sl: "Potrditveni voucher z vsemi podrobnostmi poti in točko srečanja.",
            en: "A confirmation voucher detailing the trip and the meeting point.",
            it: "Voucher di conferma con tutti i dettagli del viaggio e il punto d'incontro.",
            de: "Bestätigungsgutschein mit allen Details der Fahrt und dem Treffpunkt.",
            fr: "Bon de confirmation avec tous les détails du trajet et le point de rendez-vous.",
            es: "Vale de confirmación con todos los detalles del viaje y el punto de encuentro.",
          },
        ],
      },
      {
        heading: { sl: "Zakaj KiwiTaxi", en: "Why KiwiTaxi", it: "Perché KiwiTaxi", de: "Warum KiwiTaxi", fr: "Pourquoi KiwiTaxi", es: "Por qué KiwiTaxi" },
        items: [
          {
            sl: "Fiksna cena brez skritih stroškov in brez presenetljiv ob prihodu.",
            en: "Fixed fare with no hidden fees and no last-minute surprises.",
            it: "Prezzo fisso senza costi nascosti e senza sorprese all'ultimo minuto.",
            de: "Festpreis ohne versteckte Kosten und ohne Last-Minute-Überraschungen.",
            fr: "Prix fixe sans frais cachés et sans surprises de dernière minute.",
            es: "Precio fijo sin costes ocultos y sin sorpresas de última hora.",
          },
          {
            sl: "Brezplačna odpoved in možnost prestavitve terminov.",
            en: "Free cancellation and rescheduling options.",
            it: "Cancellazione gratuita e possibilità di spostare gli appuntamenti.",
            de: "Kostenlose Stornierung und Möglichkeit, Termine zu verschieben.",
            fr: "Annulation gratuite et possibilité de décaler les horaires.",
            es: "Cancelación gratuita y posibilidad de aplazar los horarios.",
          },
          {
            sl: "Prilagoditve: voda v vozilu, dodaten postanek, otroški sedeži.",
            en: "Customisation: water on board, an extra stop, child seats.",
            it: "Personalizzazioni: acqua a bordo, una sosta extra, seggiolini per bambini.",
            de: "Anpassungen: Wasser an Bord, ein Extra-Stopp, Kindersitze.",
            fr: "Ajustements : eau à bord, un arrêt supplémentaire, sièges enfant.",
            es: "Ajustes: agua a bordo, una parada extra, sillas infantiles.",
          },
          {
            sl: "Varna in prilagodljiva plačila — podatki o kartici so zaščiteni.",
            en: "Safe and flexible payment options — card details stay protected.",
            it: "Pagamenti sicuri e flessibili — i dati della carta restano protetti.",
            de: "Sichere und flexible Zahlungsoptionen — Kartendaten bleiben geschützt.",
            fr: "Paiements sûrs et flexibles — les données de carte restent protégées.",
            es: "Pagos seguros y flexibles — los datos de la tarjeta quedan protegidos.",
          },
        ],
      },
    ],
  },
  {
    slug: "transport",
    title: { sl: "Medkrajevni transport", en: "Intercity transport", it: "Trasporti tra città", de: "Intercity-Transport", fr: "Transport interurbain", es: "Transporte interurbano" },
    lead: {
      sl: "Omio — vlaki in avtobusi med mesti na enem iskanju.",
      en: "Omio — trains and buses between cities in one search.",
      it: "Omio — treni e autobus tra le città in un'unica ricerca.",
      de: "Omio — Züge und Busse zwischen Städten in einer Suche.",
      fr: "Omio — trains et bus entre villes en une seule recherche.",
      es: "Omio — trenes y autobuses entre ciudades en una sola búsqueda.",
    },
    coverage: {
      sl: "Vlaki in avtobusi (Ljubljana–Zagreb, obala, Dunaj …).",
      en: "Trains and buses (Ljubljana–Zagreb, the coast, Vienna …).",
      it: "Treni e autobus (Ljubljana–Zagreb, la costa, Vienna …).",
      de: "Züge und Busse (Ljubljana–Zagreb, die Küste, Wien …).",
      fr: "Trains et bus (Ljubljana–Zagreb, la côte, Vienne …).",
      es: "Trenes y autobuses (Ljubljana–Zagreb, la costa, Viena …).",
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
          it: "La Search API fa parte del programma di affiliazione (dopo l'iscrizione) — senza lat/lng; oggi solo link di affiliazione.",
          de: "Die Search API ist Teil des Partnerprogramms (nach Anmeldung) — ohne lat/lng; heute nur Partner-Link.",
          fr: "La Search API fait partie du programme d'affiliation (après inscription) — sans lat/lng ; aujourd'hui simple lien d'affiliation.",
          es: "La Search API forma parte del programa de afiliación (tras el registro) — sin lat/lng; hoy solo enlace de afiliación.",
        },
        docsUrl: "https://www.omio.com/affiliate",
      },
    ],
  },
  {
    slug: "activities",
    title: { sl: "Izkušnje in aktivnosti", en: "Experiences & activities", it: "Esperienze e attività", de: "Erlebnisse & Aktivitäten", fr: "Expériences et activités", es: "Experiencias y actividades" },
    lead: {
      sl: "GetYourGuide — izleti, vstopnine in aktivnosti z lokalnimi ponudniki.",
      en: "GetYourGuide — tours, tickets and activities with local providers.",
      it: "GetYourGuide — tour, biglietti e attività con fornitori locali.",
      de: "GetYourGuide — Touren, Tickets und Aktivitäten mit lokalen Anbietern.",
      fr: "GetYourGuide — visites, billets et activités avec des prestataires locaux.",
      es: "GetYourGuide — visitas, entradas y actividades con proveedores locales.",
    },
    coverage: {
      sl: "Turi in aktivnosti po 74 destinacijah (Bled, Ljubljana, Dubrovnik …).",
      en: "Tours and activities across the 74 destinations (Bled, Ljubljana, Dubrovnik …).",
      it: "Tour e attività nelle 74 destinazioni (Bled, Ljubljana, Dubrovnik …).",
      de: "Touren und Aktivitäten in den 74 Destinationen (Bled, Ljubljana, Dubrovnik …).",
      fr: "Visites et activités dans les 74 destinations (Bled, Ljubljana, Dubrovnik …).",
      es: "Visitas y actividades en los 74 destinos (Bled, Ljubljana, Dubrovnik …).",
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
          it: "Partner API (OpenAPI, approvazione via portale partner) — contratto verificato dal vivo; token API non ancora emesso. Oggi solo link di affiliazione.",
          de: "Partner API (OpenAPI, Freigabe über das Partnerportal) — Vertrag live geprüft; API-Token noch nicht ausgegeben. Heute nur Partner-Link.",
          fr: "Partner API (OpenAPI, approbation via le portail partenaire) — contrat vérifié en direct ; jeton API pas encore émis. Aujourd'hui simple lien d'affiliation.",
          es: "Partner API (OpenAPI, aprobación vía portal de socios) — contrato verificado en vivo; token API aún no emitido. Hoy solo enlace de afiliación.",
        },
        docsUrl: "https://github.com/getyourguide/partner-api-spec",
      },
    ],
  },
  {
    slug: "viator",
    title: { sl: "Turi in izleti (Viator)", en: "Tours & excursions (Viator)", it: "Tour ed escursioni (Viator)", de: "Touren & Ausflüge (Viator)", fr: "Visites & excursions (Viator)", es: "Visitas y excursiones (Viator)" },
    lead: {
      sl: "Viator — vodeni izleti Tripadvisor skupnosti po Sloveniji in Balkanu.",
      en: "Viator — Tripadvisor-community guided tours across Slovenia and the Balkans.",
      it: "Viator — tour guidati della community Tripadvisor in Slovenia e nei Balcani.",
      de: "Viator — geführte Touren der Tripadvisor-Community in Slowenien und auf dem Balkan.",
      fr: "Viator — visites guidées de la communauté Tripadvisor en Slovénie et dans les Balkans.",
      es: "Viator — visitas guiadas de la comunidad Tripadvisor por Eslovenia y los Balcanes.",
    },
    coverage: {
      sl: "Vodeni izleti, izletniški programi, kulinarika.",
      en: "Guided tours, day trips, food experiences.",
      it: "Tour guidati, gite, esperienze gastronomiche.",
      de: "Geführte Touren, Tagesausflüge, Kulinarik.",
      fr: "Visites guidées, excursions, expériences gastronomiques.",
      es: "Visitas guiadas, excursiones, experiencias gastronómicas.",
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
          it: "Partner API (Basic Access) — contratto verificato dal vivo; chiave API non ancora emessa (self-serve dopo la registrazione). Oggi solo link di affiliazione.",
          de: "Partner API (Basic Access) — Vertrag live geprüft; API-Schlüssel noch nicht ausgegeben (Self-Service nach Registrierung). Heute nur Partner-Link.",
          fr: "Partner API (Basic Access) — contrat vérifié en direct ; clé API pas encore émise (libre-service après inscription). Aujourd'hui simple lien d'affiliation.",
          es: "Partner API (Basic Access) — contrato verificado en vivo; clave API aún no emitida (autoservicio tras el registro). Hoy solo enlace de afiliación.",
        },
        docsUrl: "https://docs.viator.com/partner-api/technical/",
      },
    ],
  },
  {
    slug: "tickets",
    title: { sl: "Vstopnice", en: "Tickets", it: "Biglietti", de: "Tickets", fr: "Billets", es: "Entradas" },
    lead: {
      sl: "Tiqets — vstopnice za muzeje in znamenitosti, takoj na telefonu.",
      en: "Tiqets — museum and attraction tickets, instantly on your phone.",
      it: "Tiqets — biglietti per musei e attrazioni, subito sul tuo telefono.",
      de: "Tiqets — Tickets für Museen und Sehenswürdigkeiten, sofort auf dein Handy.",
      fr: "Tiqets — billets pour musées et monuments, aussitôt sur ton téléphone.",
      es: "Tiqets — entradas para museos y monumentos, al instante en tu teléfono.",
    },
    coverage: {
      sl: "Muzeji, galerije in znamenitosti po svetu, vključno s Slovenijo.",
      en: "Museums, galleries and attractions worldwide, including Slovenia.",
      it: "Musei, gallerie e attrazioni in tutto il mondo, Slovenia inclusa.",
      de: "Museen, Galerien und Sehenswürdigkeiten weltweit, Slowenien inklusive.",
      fr: "Musées, galeries et monuments dans le monde entier, Slovénie incluse.",
      es: "Museos, galerías y monumentos en todo el mundo, Eslovenia incluida.",
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
          it: "Distributor API (approvazione della domanda di affiliazione via Awin) — gate verificato dal vivo; chiave API non ancora emessa. Oggi solo link di affiliazione.",
          de: "Distributor API (Freigabe der Partnerbewerbung über Awin) — Gate live geprüft; API-Schlüssel noch nicht ausgegeben. Heute nur Partner-Link.",
          fr: "Distributor API (approbation de la candidature d'affiliation via Awin) — porte vérifiée en direct ; clé API pas encore émise. Aujourd'hui simple lien d'affiliation.",
          es: "Distributor API (aprobación de la solicitud de afiliación vía Awin) — puerta verificada en vivo; clave API aún no emitida. Hoy solo enlace de afiliación.",
        },
        docsUrl: "https://developers.tiqets.dev",
      },
    ],
    stats: [
      { value: "70 mio+", label: { sl: "popotnikov je kupilo prek Tiqets", en: "travelers have booked via Tiqets", it: "viaggiatori hanno prenotato via Tiqets", de: "Reisende haben über Tiqets gebucht", fr: "voyageurs ont réservé via Tiqets", es: "viajeros han reservado a través de Tiqets" } },
      { value: "3.000+", label: { sl: "partnerskih prizorišč", en: "partner venues", it: "sedi partner", de: "Partner-Veranstaltungsorte", fr: "lieux partenaires", es: "recintos asociados" } },
      { value: "4,6", label: { sl: "ocena aplikacije", en: "app rating", it: "valutazione dell'app", de: "App-Bewertung", fr: "note de l'app", es: "valoración de la app" } },
    ],
    sections: [
      {
        heading: { sl: "Zakaj Tiqets", en: "Why Tiqets", it: "Perché Tiqets", de: "Warum Tiqets", fr: "Pourquoi Tiqets", es: "Por qué Tiqets" },
        items: [
          {
            sl: "Ostanite prilagodljivi — možnosti prilagodljive odpovedi na vseh prizoriščih.",
            en: "Stay flexible — flexible cancellation options on all venues.",
            it: "Resta flessibile — opzioni di cancellazione flessibile su tutte le sedi.",
            de: "Bleib flexibel — flexible Stornierungsoptionen bei allen Veranstaltungsorten.",
            fr: "Reste flexible — options d'annulation flexible sur tous les lieux.",
            es: "Mantente flexible — opciones de cancelación flexible en todos los recintos.",
          },
          {
            sl: "Rezervirajte z zaupanjem — enostavna rezervacija in vstop brez čakanja na telefonu.",
            en: "Book with confidence — easy booking and skip-the-line entry on your phone.",
            it: "Prenota con fiducia — prenotazione semplice e ingresso senza fila sul tuo telefono.",
            de: "Buche mit Zuversicht — einfache Buchung und Einlass ohne Warteschlange auf deinem Handy.",
            fr: "Réserve en confiance — réservation simple et entrée sans file sur ton téléphone.",
            es: "Reserva con confianza — reserva sencilla y entrada sin colas en tu teléfono.",
          },
          {
            sl: "Uživajte v kulturi po svoje — najboljše izkušnje muzejev in znamenitosti po svetu.",
            en: "Enjoy culture your way — the best museum and attraction experiences worldwide.",
            it: "Goditi la cultura a modo tuo — le migliori esperienze di musei e attrazioni al mondo.",
            de: "Erlebe Kultur auf deine Art — die besten Museums- und Sehenswürdigkeitserlebnisse weltweit.",
            fr: "Profite de la culture à ta façon — les meilleures expériences de musées et monuments au monde.",
            es: "Disfruta de la cultura a tu manera — las mejores experiencias de museos y monumentos del mundo.",
          },
        ],
      },
      {
        heading: { sl: "Kako deluje", en: "How it works", it: "Come funziona", de: "So funktioniert es", fr: "Comment ça marche", es: "Cómo funciona" },
        items: [
          { sl: "Izberi prizorišče in termin.", en: "Pick a venue and a time slot.", it: "Scegli una sede e una fascia oraria.", de: "Wähle einen Ort und ein Zeitfenster.", fr: "Choisis un lieu et un créneau.", es: "Elige un recinto y un horario." },
          {
            sl: "Kupi vstopnico — takojšnja dobava na telefon.",
            en: "Buy the ticket — instant mobile delivery.",
            it: "Compra il biglietto — consegna istantanea sul telefono.",
            de: "Kaufe das Ticket — sofortige Zustellung aufs Handy.",
            fr: "Achète le billet — livraison instantanée sur téléphone.",
            es: "Compra la entrada — entrega instantánea en el móvil.",
          },
          {
            sl: "Pokaži kodo na vhodu — deluje tudi brez povezave v aplikaciji.",
            en: "Show the code at the entrance — works offline in the app too.",
            it: "Mostra il codice all'ingresso — funziona anche offline nell'app.",
            de: "Zeige den Code am Eingang — funktioniert auch offline in der App.",
            fr: "Montre le code à l'entrée — marche aussi hors ligne dans l'app.",
            es: "Muestra el código en la entrada — funciona también sin conexión en la app.",
          },
        ],
      },
      {
        heading: { sl: "Znana prizorišča po svetu", en: "Popular venues worldwide", it: "Sedi famose nel mondo", de: "Beliebte Veranstaltungsorte weltweit", fr: "Lieux populaires dans le monde", es: "Recintos populares en todo el mundo" },
        items: [
          { sl: "Sagrada Família in Park Güell (Barcelona)", en: "Sagrada Família and Park Güell (Barcelona)", it: "Sagrada Família e Park Güell (Barcellona)", de: "Sagrada Família und Park Güell (Barcelona)", fr: "Sagrada Família et Park Güell (Barcelone)", es: "Sagrada Família y Park Güell (Barcelona)" },
          { sl: "Kolosej in Vatikanski muzeji (Rim)", en: "Colosseum and Vatican Museums (Rome)", it: "Colosseo e Musei Vaticani (Roma)", de: "Kolosseum und Vatikanische Museen (Rom)", fr: "Colisée et Musées du Vatican (Rome)", es: "Coliseo y Museos Vaticanos (Roma)" },
          { sl: "Doževa palača (Benetke), Uffizi (Firence)", en: "Doge's Palace (Venice), Uffizi Gallery (Florence)", it: "Palazzo Ducale (Venezia), Uffizi (Firenze)", de: "Dogenpalast (Venedig), Uffizien (Florenz)", fr: "Palais des Doges (Venise), galerie des Uffizi (Florence)", es: "Palacio de los Dogos (Venecia), Uffizi (Florencia)" },
        ],
      },
    ],
  },
  {
    slug: "insurance",
    title: { sl: "Zavarovanje", en: "Travel insurance", it: "Assicurazione di viaggio", de: "Reiseversicherung", fr: "Assurance voyage", es: "Seguro de viaje" },
    lead: {
      sl: "World Nomads in SafetyWing — popotniško zavarovanje za naslednjo dogodivščino.",
      en: "World Nomads and SafetyWing — travel insurance for your next adventure.",
      it: "World Nomads e SafetyWing — assicurazione di viaggio per la tua prossima avventura.",
      de: "World Nomads und SafetyWing — Reiseversicherung für dein nächstes Abenteuer.",
      fr: "World Nomads et SafetyWing — assurance voyage pour ta prochaine aventure.",
      es: "World Nomads y SafetyWing — seguro de viaje para tu próxima aventura.",
    },
    coverage: {
      sl: "Zdravstveni stroški, prtljaga, odpoved potovanja (obseg je odvisen od police in države bivanja).",
      en: "Medical costs, luggage, trip cancellation (cover depends on the policy and country of residence).",
      it: "Spese mediche, bagaglio, annullamento del viaggio (la copertura dipende dalla polizza e dal paese di residenza).",
      de: "Medizinische Kosten, Gepäck, Reiseabbruch (Umfang hängt von der Police und dem Wohnsitzland ab).",
      fr: "Frais médicaux, bagages, annulation du voyage (la couverture dépend de la police et du pays de résidence).",
      es: "Gastos médicos, equipaje, cancelación del viaje (la cobertura depende de la póliza y del país de residencia).",
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
          it: "Nessuna API (solo affiliazione, pagamento per preventivo) — solo link.",
          de: "Keine API (nur Partnerprogramm, Zahlung pro Angebot) — nur Link.",
          fr: "Pas d'API (affiliation uniquement, paiement par devis) — lien seulement.",
          es: "Sin API (solo afiliación, pago por presupuesto) — solo enlace.",
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
          it: "Nessuna API pubblica (programma ambassador) — solo link.",
          de: "Keine öffentliche API (Botschafterprogramm) — nur Link.",
          fr: "Pas d'API publique (programme ambassadeur) — lien seulement.",
          es: "Sin API pública (programa de embajadores) — solo enlace.",
        },
        docsUrl: "https://safetywing.com/ambassador",
      },
    ],
    sections: [
      {
        heading: { sl: "Kaj pokriva", en: "What's covered", it: "Cosa copre", de: "Was abgedeckt ist", fr: "Ce qui est couvert", es: "Qué cubre" },
        items: [
          {
            sl: "Zdravstveni stroški in nujna pomoč na poti.",
            en: "Medical expenses and emergency assistance on the road.",
            it: "Spese mediche e assistenza d'emergenza in viaggio.",
            de: "Medizinische Kosten und Nothilfe unterwegs.",
            fr: "Frais médicaux et assistance d'urgence en route.",
            es: "Gastos médicos y asistencia de urgencia en camino.",
          },
          {
            sl: "Prtljaga in osebne stvari.",
            en: "Luggage and personal belongings.",
            it: "Bagaglio ed effetti personali.",
            de: "Gepäck und persönliche Gegenstände.",
            fr: "Bagages et effets personnels.",
            es: "Equipaje y efectos personales.",
          },
          {
            sl: "Odpoved in prekinitev potovanja — po pogoji izbrane police.",
            en: "Trip cancellation and interruption — per the chosen policy terms.",
            it: "Annullamento e interruzione del viaggio — secondo le condizioni della polizza scelta.",
            de: "Reiserücktritt und Unterbrechung — gemäß den Bedingungen der gewählten Police.",
            fr: "Annulation et interruption du voyage — selon les conditions de la police choisie.",
            es: "Cancelación e interrupción del viaje — según las condiciones de la póliza elegida.",
          },
          {
            sl: "Iskrenost: natančen obseg je odvisen od police in države bivanja — preveri pred nakupom.",
            en: "Honesty note: exact cover depends on the policy and your country of residence — check before buying.",
            it: "Nota di onestà: la copertura esatta dipende dalla polizza e dal tuo paese di residenza — verifica prima di acquistare.",
            de: "Ehrlichkeitsnotiz: Der genaue Umfang hängt von Police und Wohnsitzland ab — prüfe vor dem Kauf.",
            fr: "Note d'honnêteté : la couverture exacte dépend de la police et de ton pays de résidence — vérifie avant d'acheter.",
            es: "Nota de honestidad: la cobertura exacta depende de la póliza y de tu país de residencia — comprueba antes de comprar.",
          },
        ],
      },
      {
        heading: { sl: "Zakaj World Nomads", en: "Why World Nomads", it: "Perché World Nomads", de: "Warum World Nomads", fr: "Pourquoi World Nomads", es: "Por qué World Nomads" },
        items: [
          {
            sl: "Pokritje avanturističnih aktivnosti po izbiri (pohodi, kajak, smučanje …).",
            en: "Optional cover for adventure activities (hiking, kayaking, skiing …).",
            it: "Copertura opzionale per attività avventurose (escursioni, kayak, sci …).",
            de: "Optionale Deckung für Abenteueraktivitäten (Wandern, Kajak, Skifahren …).",
            fr: "Couverture optionnelle pour les activités d'aventure (randonnée, kayak, ski …).",
            es: "Cobertura opcional para actividades de aventura (senderismo, kayak, esquí …).",
          },
          {
            sl: "Nakup police tudi, ko si že na poti.",
            en: "Buy a policy even when you're already travelling.",
            it: "Acquista una polizza anche quando sei già in viaggio.",
            de: "Kaufe eine Police auch, wenn du schon unterwegs bist.",
            fr: "Achète une police même quand tu es déjà en voyage.",
            es: "Compra una póliza incluso cuando ya estás de viaje.",
          },
          {
            sl: "Spletni zahtevki in podpora v več jezikih.",
            en: "Online claims and multilingual support.",
            it: "Reclami online e supporto multilingue.",
            de: "Online-Ansprüche und mehrsprachiger Support.",
            fr: "Réclamations en ligne et assistance multilingue.",
            es: "Reclamaciones en línea y soporte multilingüe.",
          },
        ],
      },
      {
        heading: { sl: "Kako do ponudbe", en: "Getting a quote", it: "Come ottenere un preventivo", de: "So bekommst du ein Angebot", fr: "Comment obtenir un devis", es: "Cómo conseguir un presupuesto" },
        items: [
          {
            sl: "Ponudbo (quote) izračuna zavarovalnica za tvojo pot in državo bivanja.",
            en: "The insurer calculates a quote for your trip and country of residence.",
            it: "L'assicuratore calcola un preventivo per il tuo viaggio e il tuo paese di residenza.",
            de: "Der Versicherer berechnet ein Angebot für deine Reise und dein Wohnsitzland.",
            fr: "L'assureur calcule un devis pour ton voyage et ton pays de résidence.",
            es: "La aseguradora calcula un presupuesto para tu viaje y tu país de residencia.",
          },
          {
            sl: "Povezava do partnerja se konfigurira po odobritvi programa — do takaj iskren namestnik.",
            en: "The partner link is configured once the programme approves us — an honest placeholder until then.",
            it: "Il link al partner si configura dopo l'approvazione del programma — fino ad allora un segnaposto onesto.",
            de: "Der Partner-Link wird nach Freigabe des Programms konfiguriert — bis dahin ein ehrlicher Platzhalter.",
            fr: "Le lien partenaire est configuré une fois le programme approuvé — jusque-là un indicateur honnête.",
            es: "El enlace al socio se configura tras la aprobación del programa — hasta entonces un marcador honesto.",
          },
        ],
      },
    ],
  },
  {
    slug: "esim",
    title: { sl: "eSIM podatki", en: "eSIM data", it: "Dati eSIM", de: "eSIM-Daten", fr: "Données eSIM", es: "Datos eSIM" },
    lead: {
      sl: "Airalo — eSIM podatkovni paketi za 200+ destinacij, namestitev v minutah.",
      en: "Airalo — eSIM data packages for 200+ destinations, installed in minutes.",
      it: "Airalo — pacchetti dati eSIM per 200+ destinazioni, installati in pochi minuti.",
      de: "Airalo — eSIM-Datenpakete für 200+ Destinationen, in Minuten installiert.",
      fr: "Airalo — forfaits de données eSIM pour 200+ destinations, installés en quelques minutes.",
      es: "Airalo — paquetes de datos eSIM para 200+ destinos, instalados en minutos.",
    },
    coverage: {
      sl: "Lokalni (Slovenija), regionalni (Evropa) in globalni paketi.",
      en: "Local (Slovenia), regional (Europe) and global packages.",
      it: "Pacchetti locali (Slovenia), regionali (Europa) e globali.",
      de: "Lokale (Slowenien), regionale (Europa) und globale Pakete.",
      fr: "Forfaits locaux (Slovénie), régionaux (Europe) et mondiaux.",
      es: "Paquetes locales (Eslovenia), regionales (Europa) y globales.",
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
          it: "Partner API (OAuth2, approvazione) — gate della sandbox verificato dal vivo; credenziali non ancora emesse. Oggi solo link di affiliazione.",
          de: "Partner API (OAuth2, Freigabe) — Sandbox-Gate live geprüft; Zugangsdaten noch nicht ausgegeben. Heute nur Partner-Link.",
          fr: "Partner API (OAuth2, approbation) — porte du bac à sable vérifiée en direct ; identifiants pas encore émis. Aujourd'hui simple lien d'affiliation.",
          es: "Partner API (OAuth2, aprobación) — puerta del sandbox verificada en vivo; credenciales aún no emitidas. Hoy solo enlace de afiliación.",
        },
        docsUrl: "https://developers.partners.airalo.com",
      },
    ],
    stats: [
      { value: "30 mio+", label: { sl: "ljudi izbere Airalo", en: "people choose Airalo", it: "persone scelgono Airalo", de: "Menschen wählen Airalo", fr: "personnes choisissent Airalo", es: "personas eligen Airalo" } },
      { value: "200+", label: { sl: "pokritih lokacij", en: "covered locations", it: "località coperte", de: "abgedeckte Standorte", fr: "emplacements couverts", es: "ubicaciones cubiertas" } },
      { value: "53", label: { sl: "jezikov aplikacije", en: "app languages", it: "lingue dell'app", de: "App-Sprachen", fr: "langues de l'app", es: "idiomas de la app" } },
    ],
    sections: [
      {
        heading: { sl: "Zakaj Airalo", en: "Why Airalo", it: "Perché Airalo", de: "Warum Airalo", fr: "Pourquoi Airalo", es: "Por qué Airalo" },
        items: [
          {
            sl: "Lokalna, regionalna in globalna pokritost za 200+ lokacij.",
            en: "Local, regional and global coverage for 200+ locations.",
            it: "Copertura locale, regionale e globale per 200+ località.",
            de: "Lokale, regionale und globale Abdeckung für 200+ Standorte.",
            fr: "Couverture locale, régionale et mondiale pour 200+ emplacements.",
            es: "Cobertura local, regional y global para 200+ ubicaciones.",
          },
          {
            sl: "Prilagodljivi paketi, vključno z neomejenimi podatki.",
            en: "Flexible packages, including unlimited data options.",
            it: "Pacchetti flessibili, incluse opzioni di dati illimitati.",
            de: "Flexible Pakete, auch mit unbegrenzten Daten.",
            fr: "Forfaits flexibles, y compris données illimitées.",
            es: "Paquetes flexibles, incluidos datos ilimitados.",
          },
          {
            sl: "Aplikacija v 53 jezikih, podpora več valut.",
            en: "App in 53 languages, multiple currencies supported.",
            it: "App in 53 lingue, supporto a più valute.",
            de: "App in 53 Sprachen, Unterstützung mehrerer Währungen.",
            fr: "App en 53 langues, plusieurs devises prises en charge.",
            es: "App en 53 idiomas, soporte de varias divisas.",
          },
          {
            sl: "Enostavna namestitev — povezan si v minutah.",
            en: "Easy installation — connected in minutes.",
            it: "Installazione semplice — connesso in pochi minuti.",
            de: "Einfache Installation — in Minuten verbunden.",
            fr: "Installation simple — connecté en quelques minutes.",
            es: "Instalación sencilla — conectado en minutos.",
          },
        ],
      },
      {
        heading: { sl: "Vrste paketov", en: "Package types", it: "Tipi di pacchetto", de: "Pakettypen", fr: "Types de forfaits", es: "Tipos de paquetes" },
        items: [
          {
            sl: "Lokalni (Local) — eSIM za posamezno državo, npr. Slovenija.",
            en: "Local — an eSIM for a single country, e.g. Slovenia.",
            it: "Locale (Local) — un'eSIM per un singolo paese, es. Slovenia.",
            de: "Lokal (Local) — eine eSIM für ein einzelnes Land, z. B. Slowenien.",
            fr: "Local (Local) — une eSIM pour un seul pays, p. ex. la Slovénie.",
            es: "Local (Local) — una eSIM para un solo país, p. ej. Eslovenia.",
          },
          {
            sl: "Regionalni (Regional) — paketi za regije, npr. Evropa.",
            en: "Regional — packages for regions, e.g. Europe.",
            it: "Regionale (Regional) — pacchetti per regioni, es. Europa.",
            de: "Regional (Regional) — Pakete für Regionen, z. B. Europa.",
            fr: "Régional (Regional) — forfaits pour des régions, p. ex. l'Europe.",
            es: "Regional (Regional) — paquetes para regiones, p. ej. Europa.",
          },
          {
            sl: "Globalni (Global) — svetovna pokritost z enim paketom.",
            en: "Global — worldwide coverage with one package.",
            it: "Globale (Global) — copertura mondiale con un solo pacchetto.",
            de: "Global (Global) — weltweite Abdeckung mit einem Paket.",
            fr: "Global (Global) — couverture mondiale avec un seul forfait.",
            es: "Global (Global) — cobertura mundial con un solo paquete.",
          },
        ],
      },
      {
        heading: { sl: "Pogosta vprašanja", en: "Frequently asked questions", it: "Domande frequenti", de: "Häufige Fragen", fr: "Questions fréquentes", es: "Preguntas frecuentes" },
        items: [
          {
            sl: "Ali moj telefon podpira eSIM? Preveri pri proizvajalcu ali operaterju — Android potrebuje meni „Dodaj operaterja“, iOS nastavitve mobilnih storitev.",
            en: "Does my phone support eSIM? Confirm with the manufacturer or carrier — Android needs an “Add carrier” menu, iOS is under cellular settings.",
            it: "Il mio telefono supporta la eSIM? Verifica con il produttore o l'operatore — Android richiede il menu „Aggiungi operatore“, iOS si trova nelle impostazioni cellulare.",
            de: "Unterstützt mein Handy eSIM? Bestätige beim Hersteller oder Mobilfunkanbieter — Android braucht ein Menü „Mobilfunkanbieter hinzufügen“, iOS steht unter den Mobilfunk-Einstellungen.",
            fr: "Mon téléphone prend-il en charge l'eSIM ? Vérifie auprès du fabricant ou de l'opérateur — Android a besoin d'un menu « Ajouter un opérateur », iOS se trouve dans les réglages cellulaires.",
            es: "¿Mi teléfono admite eSIM? Confírmalo con el fabricante o el operador — Android necesita un menú «Añadir operador», iOS está en los ajustes de móvil.",
          },
          {
            sl: "Kdaj poteče paket? Ob izčrpanju podatkov ali poteku veljavnosti; veljavnost se začne z aktivacijo — ob prvi povezavi v podprtem omrežju.",
            en: "When does a package expire? When data runs out or validity ends; validity starts at activation — the first connection to a supported network.",
            it: "Quando scade il pacchetto? All'esaurimento dei dati o alla fine della validità; la validità parte dall'attivazione — alla prima connessione a una rete supportata.",
            de: "Wann läuft ein Paket ab? Wenn die Daten aufgebraucht sind oder die Gültigkeit endet; die Gültigkeit beginnt mit der Aktivierung — bei der ersten Verbindung mit einem unterstützten Netz.",
            fr: "Quand un forfait expire-t-il ? Quand les données sont épuisées ou à la fin de la validité ; la validité commence à l'activation — à la première connexion à un réseau pris en charge.",
            es: "¿Cuándo caduca el paquete? Al agotarse los datos o al terminar la validez; la validez empieza con la activación — en la primera conexión a una red compatible.",
          },
          {
            sl: "Kje kupim? Prek spletne strani ali aplikacije Airalo.",
            en: "Where do I buy? Via the Airalo website or app.",
            it: "Dove lo compro? Tramite il sito o l'app di Airalo.",
            de: "Wo kaufe ich? Über die Airalo-Website oder App.",
            fr: "Où l'acheter ? Via le site ou l'app d'Airalo.",
            es: "¿Dónde lo compro? A través de la web o la app de Airalo.",
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
