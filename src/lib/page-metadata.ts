/**
 * PAGE METADATA — P1 SEO (#34 → #38, 2.44.0)
 * ============================================================================
 * Vrzel iz QA pregleda (#38 P1 SEO): statične strani so razglasile SAMO
 * hreflang alternates — naslov in opis sta padla na layout privzeti naslov
 * „Discover Slovenia AI — Kaj želiš doživeti v Sloveniji?“ na VSEH straneh.
 * Benchmark najboljših NTO strani (raziskava R-3-a, 2026-10-13):
 * MySwitzerland, VisitNorway, austria.info, slovenia.info in Croatia.hr
 * imajo UNIKATEN naslov na vsaki strani (edina napaka v naboru:
 * slovenia.info podvojen brand na eni strani). Vzorec naslova:
 * „Tema · Discover Slovenia AI“ (template v layoutu), dolžina 30–60 zn,
 * opis 100–160 zn z konkretnimi podatki. Anti-vzorcev se izogibamo:
 * prazen opis (slovenia.info hub) in podvojen brand („| I feel Slovenia |
 * I feel Slovenia“) sta programsko nespremenljiva (testi zaklepajo).
 *
 * Ta modul: ČIST (0 omrežja, 0 DOM, 0 AI) — slovar SEO_PAGES + pageMetadata(),
 * ki sestavi Metadata iz 6-jezičnega vnosa (pick kanon: sl je resnica,
 * ostali jeziki prekrivni prevodi). Dinamične strani (/destinacija/[slug],
 * /vodici/[slug]) imajo lastne unikatne naslove iz podatkov in OSTANEJO
 * nespremenjene.
 */

import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import { asPickLocale, pick, type PickDict, type PickLocale } from "@/lib/i18n-pick";

/** Ime znamke (enoten pripona naslova — NIKOLI ne podvajati, testi zaklepajo). */
export const SITE_NAME = "Discover Slovenia AI";
/** Pripona naslova (layout template: „%s · Discover Slovenia AI“). */
export const TITLE_SUFFIX = ` · ${SITE_NAME}`;

/** OG locale koda (html lang → Open Graph) — enoten vir za layout in strani. */
export const OG_LOCALES: Record<string, string> = {
  sl: "sl_SI",
  en: "en_US",
  it: "it_IT",
  de: "de_DE",
  fr: "fr_FR",
  es: "es_ES",
};

/** Šestjezični SEO vnos za statično stran. */
export interface SeoPage {
  /** Pot strani (brez locale predpone; sl = privzeti, ostali s predpono). */
  path: string;
  /** Unikaten naslov BREZ pripone (template doda „ · Discover Slovenia AI“). */
  title: PickDict<string>;
  /** Unikaten opis (cilj 100–160 zn; nikoli prazen — anti-vzorec slovenia.info). */
  description: PickDict<string>;
  /** Neobvezni ključne besede (sl kanon; keyword meta je v praksi neuporabljen,
   *  a ohranimo obstoječe vnose namesto brisanja brez razloga). */
  keywords?: string[];
}

/**
 * SEO slovar statičnih strani (P1 SEO #38). Slovensko = resnica (kanon),
 * ostali jeziki prekrivni prevodi po istem ključu (pick kanon).
 */
export const SEO_PAGES: Record<string, SeoPage> = {
  "/destinacije": {
    path: "/destinacije",
    title: {
      sl: "Destinacije v Sloveniji",
      en: "Destinations in Slovenia",
      it: "Destinazioni in Slovenia",
      de: "Destinationen in Slowenien",
      fr: "Destinations en Slovénie",
      es: "Destinos en Eslovenia",
    },
    description: {
      sl: "Raziskuj 74 kuriranih destinacij po državah Balkana: jezera, gore, obala in mesta. Filtri po državi, regiji in tipu ti poiščejo biser.",
      en: "Explore 74 curated destinations across the Balkans: lakes, mountains, coast and cities. Filter by country, region and type to find yours.",
      it: "Esplora 74 destinazioni curate nei Balcani: laghi, montagne, costa e città. Filtra per paese, regione e tipo per trovare la tua.",
      de: "Erkunde 74 kuratierte Destinationen auf dem Balkan: Seen, Berge, Küste und Städte. Filtere nach Land, Region und Typ.",
      fr: "Explore 74 destinations sélectionnées dans les Balkans : lacs, montagnes, côte et villes. Filtre par pays, région et type.",
      es: "Explora 74 destinos seleccionados por los Balcanes: lagos, montañas, costa y ciudades. Filtra por país, región y tipo.",
    },
  },
  "/zemljevid": {
    path: "/zemljevid",
    title: {
      sl: "Zemljevid Slovenije",
      en: "Map of Slovenia",
      it: "Mappa della Slovenia",
      de: "Karte von Slowenien",
      fr: "Carte de la Slovénie",
      es: "Mapa de Eslovenia",
    },
    description: {
      sl: "Interaktivni zemljevid s 74 destinacijami na realnih cestah: razdalje, časi vožnje in plasti od znamenitosti do letovišč.",
      en: "Interactive map with 74 destinations on real roads: distances, driving times and layers from sights to resorts and spas.",
      it: "Mappa interattiva con 74 destinazioni su strade reali: distanze, tempi di viaggio e livelli da monumenti a località termali.",
      de: "Interaktive Karte mit 74 Destinationen auf echten Straßen: Entfernungen, Fahrzeiten und Ebenen von Sehenswürdigkeiten bis Thermen.",
      fr: "Carte interactive avec 74 destinations sur des routes réelles : distances, temps de trajet et couches des sites aux stations.",
      es: "Mapa interactivo con 74 destinos por carreteras reales: distancias, tiempos de conducción y capas de monumentos a balnearios.",
    },
  },
  "/nacrtuj": {
    path: "/nacrtuj",
    title: {
      sl: "Načrtovalnik potovanja",
      en: "Trip planner",
      it: "Pianificatore di viaggio",
      de: "Reiseplaner",
      fr: "Planificateur de voyage",
      es: "Planificador de viajes",
    },
    description: {
      sl: "Sestavi dnevni načrt po Sloveniji v treh korakih: interesi, dni in proračun — destinacije po realnih cestah s časi vožnje.",
      en: "Build a day-by-day Slovenia plan in three steps: interests, days and budget — destinations on real roads with driving times.",
      it: "Crea un piano giorno per giorno in Slovenia in tre passaggi: interessi, giorni e budget — destinazioni su strade reali.",
      de: "Erstelle einen Tagesplan für Slowenien in drei Schritten: Interessen, Tage und Budget — Destinationen auf echten Straßen.",
      fr: "Compose un plan jour par jour en Slovénie en trois étapes : intérêts, jours et budget — destinations sur routes réelles.",
      es: "Crea un plan día a día por Eslovenia en tres pasos: intereses, días y presupuesto — destinos por carreteras reales.",
    },
  },
  "/dogodki": {
    path: "/dogodki",
    title: {
      sl: "Dogodki v Sloveniji",
      en: "Events in Slovenia",
      it: "Eventi in Slovenia",
      de: "Veranstaltungen in Slowenien",
      fr: "Événements en Slovénie",
      es: "Eventos en Eslovenia",
    },
    description: {
      sl: "Koledar prireditev 2026/2027: festivali, sejmi, pust in vinski dogodki. Filtriraj po mesecu in kategoriji — datumi z virom.",
      en: "Calendar of events 2026/2027: festivals, trade fairs, carnival and wine events. Filter by month and category — dates with sources.",
      it: "Calendario degli eventi 2026/2027: festival, fiere, carnevale ed eventi del vino. Filtra per mese e categoria — date con fonte.",
      de: "Veranstaltungskalender 2026/2027: Festivals, Messen, Karneval und Wein-Events. Nach Monat und Kategorie filtern — Quellenangaben.",
      fr: "Calendrier des événements 2026/2027 : festivals, salons, carnaval et manifestations viticoles. Filtre par mois et catégorie.",
      es: "Calendario de eventos 2026/2027: festivales, ferias, carnaval y enología. Filtra por mes y categoría — fechas con fuente.",
    },
    keywords: ["dogodki", "festivali", "koledar", "Slovenija", "prireditve"],
  },
  "/dozivetja": {
    path: "/dozivetja",
    title: {
      sl: "Doživetja v Sloveniji",
      en: "Experiences in Slovenia",
      it: "Esperienze in Slovenia",
      de: "Erlebnisse in Slowenien",
      fr: "Expériences en Slovénie",
      es: "Experiencias en Eslovenia",
    },
    description: {
      sl: "Pohodništvo, vodne avanture, kultura, kulinarika in skriti biseri — doživetja neposredno pri preverjenih lokalnih ponudnikih.",
      en: "Hiking, water adventures, culture, cuisine and hidden gems — experiences booked directly with vetted local providers.",
      it: "Escursioni, avventure sull'acqua, cultura, cucina e gemme nascoste — esperienze direttamente con fornitori locali verificati.",
      de: "Wandern, Wasserabenteuer, Kultur, Kulinarik und versteckte Schätze — Erlebnisse direkt bei geprüften lokalen Anbietern.",
      fr: "Randonnée, aventures aquatiques, culture, gastronomie et trésors cachés — des expériences auprès de prestataires locaux.",
      es: "Senderismo, aventuras acuáticas, cultura, gastronomía y tesoros ocultos — experiencias con proveedores locales verificados.",
    },
    keywords: ["doživetja", "izkušnje", "pohodništvo", "rafting", "Slovenija"],
  },
  "/lokali": {
    path: "/lokali",
    title: {
      sl: "Lokali in ponudniki",
      en: "Places & providers",
      it: "Locali e fornitori",
      de: "Lokale & Anbieter",
      fr: "Lieux & prestataires",
      es: "Locales y proveedores",
    },
    description: {
      sl: "Imenik lokalnih ponudnikov: hoteli, restavracije, vinske kleti, aktivnosti in izleti — s kontakti in trenutnimi ponudbami.",
      en: "Directory of local providers: hotels, restaurants, wine cellars, activities and trips — with contacts and current offers.",
      it: "Elenco di fornitori locali: hotel, ristoranti, cantine vitivinicole, attività ed escursioni — con contatti e offerte attuali.",
      de: "Verzeichnis lokaler Anbieter: Hotels, Restaurants, Weinkeller, Aktivitäten und Ausflüge — mit Kontakten und Angeboten.",
      fr: "Annuaire des prestataires locaux : hôtels, restaurants, caves, activités et excursions — avec contacts et offres du moment.",
      es: "Directorio de proveedores locales: hoteles, restaurantes, bodegas, actividades y excursiones — con contactos y ofertas.",
    },
  },
  "/trznica": {
    path: "/trznica",
    title: {
      sl: "Tržnica izdelkov",
      en: "Marketplace",
      it: "Mercato sloveno",
      de: "Marktplatz",
      fr: "Marché slovène",
      es: "Mercado esloveno",
    },
    description: {
      sl: "Tržnica lokalnih izdelkov in doživetij: domača hrana, obrt in suveniri neposredno od slovenskih izdelovalcev, z dostavo.",
      en: "Marketplace for local products and experiences: homemade food, crafts and souvenirs straight from Slovenian makers.",
      it: "Mercato di prodotti ed esperienze locali: cibo artigianale, artigianato e souvenir direttamente dai produttori sloveni.",
      de: "Marktplatz für lokale Produkte und Erlebnisse: hausgemachte Speisen, Kunsthandwerk und Souvenirs von slowenischen Machern.",
      fr: "Marché de produits et d'expériences locales : cuisine maison, artisanat et souvenirs directement des créateurs slovènes.",
      es: "Mercado de productos y experiencias locales: comida casera, artesanía y recuerdos directamente de creadores eslovenos.",
    },
  },
  "/vodici": {
    path: "/vodici",
    title: {
      sl: "Road-trip vodiči",
      en: "Road-trip guides",
      it: "Guide road-trip",
      de: "Roadtrip-Guides",
      fr: "Guides road-trip",
      es: "Guías road-trip",
    },
    description: {
      sl: "22 preverjenih road-trip vodičev po Sloveniji in sosednjih državah: postanki, časi vožnje, parkiranje in nasveti za pot.",
      en: "22 vetted road-trip guides for Slovenia and neighbours: stops, driving times, parking and practical tips for the road.",
      it: "22 guide road-trip verificate per Slovenia e paesi vicini: tappe, tempi di guida, parcheggi e consigli pratici per il viaggio.",
      de: "22 geprüfte Roadtrip-Guides für Slowenien und Nachbarländer: Zwischenstopps, Fahrzeiten, Parken und praktische Tipps.",
      fr: "22 guides road-trip vérifiés pour la Slovénie et ses voisins : arrêts, temps de conduite, stationnement et conseils pratiques.",
      es: "22 guías road-trip verificadas por Eslovenia y vecinos: paradas, tiempos de conducción, aparcamiento y consejos prácticos.",
    },
    keywords: ["vodiči", "road trip", "Slovenija", "itinererji"],
  },
  "/slovenia-pass": {
    path: "/slovenia-pass",
    title: {
      sl: "Slovenia Pass",
      en: "Slovenia Pass",
      it: "Slovenia Pass",
      de: "Slovenia Pass",
      fr: "Slovenia Pass",
      es: "Slovenia Pass",
    },
    description: {
      sl: "Slovenia Pass združuje vstopnice, prevoze in doživetja v enem paketu — ugodnosti po državi na enem mestu, brez papirjev.",
      en: "Slovenia Pass bundles tickets, transfers and experiences in one package — discounts across the country, no paperwork.",
      it: "Slovenia Pass unisce biglietti, transfer ed esperienze in un unico pacchetto — vantaggi in tutto il paese, senza burocrazia.",
      de: "Der Slovenia Pass bündelt Tickets, Transfers und Erlebnisse in einem Paket — Vergünstigungen im ganzen Land, ohne Papierkram.",
      fr: "Le Slovenia Pass réunit billets, transferts et expériences en un seul forfait — avantages dans tout le pays, sans paperasse.",
      es: "Slovenia Pass reúne entradas, traslados y experiencias en un paquete — ventajas por todo el país, sin papeleos.",
    },
  },
  "/vir-podatkov": {
    path: "/vir-podatkov",
    title: {
      sl: "Vir podatkov",
      en: "Data sources",
      it: "Fonti dei dati",
      de: "Datenquellen",
      fr: "Sources des données",
      es: "Fuentes de datos",
    },
    description: {
      sl: "Kako nastajajo vsebine: viri podatkov, pravila preverjanja dogodkov in ponudnikov ter jasna oznaka, kaj je potrjeno in kaj ne.",
      en: "How our content is built: data sources, verification rules for events and providers, and clear labels for what is confirmed.",
      it: "Come nascono i contenuti: fonti dei dati, regole di verifica per eventi e fornitori e chiare etichette su cosa è confermato.",
      de: "Wie Inhalte entstehen: Datenquellen, Prüfregeln für Veranstaltungen und Anbieter sowie klare Kennzeichnung des Bestätigten.",
      fr: "Comment nos contenus naissent : sources, règles de vérification des événements et prestataires, et étiquettes claires.",
      es: "Cómo se crea nuestro contenido: fuentes, reglas de verificación de eventos y proveedores, y etiquetas de confirmación.",
    },
  },
  "/moja-potovanja": {
    path: "/moja-potovanja",
    title: {
      sl: "Moja potovanja",
      en: "My trips",
      it: "I miei viaggi",
      de: "Meine Reisen",
      fr: "Mes voyages",
      es: "Mis viajes",
    },
    description: {
      sl: "Tvoja shranjena potovanja na enem mestu: načrti, destinacije in dogodki — sinhronizirana med napravami in dostopna tudi offline.",
      en: "Your saved trips in one place: plans, destinations and events — synced across devices and available offline too.",
      it: "I tuoi viaggi salvati in un unico posto: piani, destinazioni ed eventi — sincronizzati tra dispositivi e anche offline.",
      de: "Deine gespeicherten Reisen an einem Ort: Pläne, Destinationen und Veranstaltungen — geräteübergreifend und auch offline.",
      fr: "Tes voyages enregistrés en un seul endroit : plans, destinations et événements — synchronisés et accessibles hors ligne.",
      es: "Tus viajes guardados en un solo lugar: planes, destinos y eventos — sincronizados entre dispositivos y también offline.",
    },
  },
  "/na-poti": {
    path: "/na-poti",
    title: {
      sl: "Na poti — živi vodič",
      en: "On the road — live guide",
      it: "In viaggio — guida live",
      de: "Unterwegs — Live-Guide",
      fr: "En route — guide live",
      es: "En ruta — guía en vivo",
    },
    description: {
      sl: "Aktivna pot v realnem času: trenutni postanek, naslednji korak, vreme in preusmeritve ob odstopanju od poti — tudi offline.",
      en: "Your active trip in real time: current stop, next step, weather and rerouting when you leave the route — even offline.",
      it: "Il tuo viaggio attivo in tempo reale: tappa attuale, passo successivo, meteo e ricalcolo se devii — anche senza connessione.",
      de: "Deine aktive Reise in Echtzeit: aktueller Halt, nächster Schritt, Wetter und Umleitung bei Abweichung — auch offline.",
      fr: "Ton voyage actif en temps réel : arrêt actuel, prochaine étape, météo et réacheminement en cas de détour — même hors ligne.",
      es: "Tu viaje activo en tiempo real: parada actual, siguiente paso, tiempo y redirección si te desvías — incluso offline.",
    },
  },
  "/potovanje": {
    path: "/potovanje",
    title: {
      sl: "Dnevni načrt potovanja",
      en: "Day-by-day itinerary",
      it: "Itinerario giorno per giorno",
      de: "Tagesplan der Reise",
      fr: "Itinéraire jour par jour",
      es: "Itinerario día a día",
    },
    description: {
      sl: "Dnevni načrt po realnih cestah: postanki, časi vožnje, rezervacije in nasveti — pripravljen za izvoz, delitev in go mode.",
      en: "A day-by-day plan on real roads: stops, driving times, reservations and tips — ready to export, share and follow live.",
      it: "Un piano giorno per giorno su strade reali: tappe, tempi di guida, prenotazioni e consigli — pronto da esportare e condividere.",
      de: "Tagesplan auf echten Straßen: Stopps, Fahrzeiten, Reservierungen und Tipps — bereit zum Exportieren, Teilen und Verfolgen.",
      fr: "Un plan jour par jour sur des routes réelles : arrêts, temps de conduite, réservations et conseils — prêt à exporter et partager.",
      es: "Un plan día a día por carreteras reales: paradas, tiempos de conducción, reservas y consejos — listo para exportar y compartir.",
    },
  },
  "/kontakt": {
    path: "/kontakt",
    title: {
      sl: "Kontakt in povratne informacije",
      en: "Contact & feedback",
      it: "Contatti",
      de: "Kontakt & Feedback",
      fr: "Contact & retours",
      es: "Contacto",
    },
    description: {
      sl: "Vprašanje, opazka ali predlog sodelovanja? Piši nam prek obrazca — odgovorimo v roku dveh delovnih dni. Vsaka opazka šteje.",
      en: "Question, feedback or partnership idea? Write to us via the form — we reply within two working days. Every message counts.",
      it: "Domanda, suggerimento o proposta di collaborazione? Scrivici tramite il modulo — rispondiamo entro due giorni lavorativi.",
      de: "Frage, Feedback oder Kooperationsidee? Schreib uns über das Formular — wir antworten innerhalb von zwei Werktagen.",
      fr: "Question, retour ou proposition de partenariat ? Écris-nous via le formulaire — réponse sous deux jours ouvrés.",
      es: "¿Pregunta, sugerencia o propuesta de colaboración? Escríbenos por el formulario — respondemos en dos días laborables.",
    },
  },
  "/prijava": {
    path: "/prijava",
    title: {
      sl: "Prijava v račun popotnika",
      en: "Traveller sign in",
      it: "Accedi come viaggiatore",
      de: "Anmelden als Reisender",
      fr: "Connexion au compte voyageur",
      es: "Acceso a cuenta de viajero",
    },
    description: {
      sl: "Prijavi se in shrani načrte, destinacije in dogodke — sinhronizirano med napravami, z zaščito tvojih podatkov.",
      en: "Sign in to save your plans, destinations and events — synced across devices, with your data protected.",
      it: "Accedi per salvare piani, destinazioni ed eventi — sincronizzati tra dispositivi, con protezione dei tuoi dati.",
      de: "Melde dich an, um Pläne, Destinationen und Veranstaltungen zu speichern — geräteübergreifend, mit geschützten Daten.",
      fr: "Connecte-toi pour enregistrer plans, destinations et événements — synchronisés sur tes appareils, données protégées.",
      es: "Inicia sesión para guardar planes, destinos y eventos — sincronizados entre dispositivos, con tus datos protegidos.",
    },
  },
  "/pogoji-uporabe": {
    path: "/pogoji-uporabe",
    title: {
      sl: "Pogoji uporabe",
      en: "Terms of use",
      it: "Termini d'uso",
      de: "Nutzungsbedingungen",
      fr: "Conditions d'utilisation",
      es: "Términos de uso",
    },
    description: {
      sl: "Pravila uporabe Discover Slovenia AI: pravice in odgovornosti uporabnikov, pravila tržnice in naročil ter odgovornost za vsebine.",
      en: "Rules for using Discover Slovenia AI: user rights and responsibilities, marketplace and order rules, and content liability.",
      it: "Regole per l'uso di Discover Slovenia AI: diritti e doveri degli utenti, regole del mercato e degli ordini, responsabilità.",
      de: "Regeln für die Nutzung von Discover Slovenia AI: Rechte und Pflichten, Marktplatz- und Bestellregeln sowie Haftung.",
      fr: "Règles d'utilisation de Discover Slovenia AI : droits et devoirs, règles de la place de marché et des commandes, responsabilité.",
      es: "Reglas de uso de Discover Slovenia AI: derechos y responsabilidades, reglas del mercado y pedidos, responsabilidad del contenido.",
    },
  },
  "/politika-zasebnosti": {
    path: "/politika-zasebnosti",
    title: {
      sl: "Politika zasebnosti",
      en: "Privacy policy",
      it: "Informativa sulla privacy",
      de: "Datenschutzerklärung",
      fr: "Politique de confidentialité",
      es: "Política de privacidad",
    },
    description: {
      sl: "Katere podatke zbiramo in zakaj, kako dolgo jih hranimo, s kom jih delimo in kakšne pravice imaš kot uporabnik platforme.",
      en: "What data we collect and why, how long we keep it, who we share it with, and what rights you have as a platform user.",
      it: "Quali dati raccogliamo e perché, quanto a lungo li conserviamo, con chi li condividiamo e quali diritti hai come utente.",
      de: "Welche Daten wir erheben und warum, wie lange wir sie speichern, mit wem wir sie teilen und welche Rechte du als Nutzer hast.",
      fr: "Quelles données nous collectons et pourquoi, combien de temps, avec qui nous les partageons et tes droits d'utilisateur.",
      es: "Qué datos recogemos y por qué, cuánto los conservamos, con quién los compartimos y qué derechos tienes como usuario.",
    },
  },
  "/zaupanje-in-varnost": {
    path: "/zaupanje-in-varnost",
    title: {
      sl: "Zaupanje in varnost",
      en: "Trust & safety",
      it: "Fiducia e sicurezza",
      de: "Vertrauen & Sicherheit",
      fr: "Confiance & sécurité",
      es: "Confianza y seguridad",
    },
    description: {
      sl: "Kako skrbimo za zaupanje: preverjeni podatki z virom, moderiranje tržnice, varna plačila in zaščita tvojih osebnih podatkov.",
      en: "How we build trust: data verified at the source, marketplace moderation, secure payments and protection of your personal data.",
      it: "Come costruiamo la fiducia: dati verificati alla fonte, moderazione del mercato, pagamenti sicuri e protezione dei tuoi dati.",
      de: "So schaffen wir Vertrauen: Daten mit Quellenangabe, Marktplatz-Moderation, sichere Zahlungen und Schutz deiner Daten.",
      fr: "Comment nous bâtissons la confiance : données vérifiées à la source, modération, paiements sécurisés et protection des données.",
      es: "Cómo construimos confianza: datos verificados en la fuente, moderación del mercado, pagos seguros y protección de datos.",
    },
  },
};

/** Sestavljen naslov z enotno pripono (template rezultat — testi zaklepajo). */
export function composedTitle(title: string): string {
  return `${title}${TITLE_SUFFIX}`;
}

/**
 * Metadata za statično stran po poti (iz SEO_PAGES).
 * - title: lokaliziran unikaten naslov (layout template doda pripono)
 * - description: lokaliziran unikaten opis
 * - alternates: hreflang + canonical (alternatesFor kanon: sl brez predpone,
 *   x-default → sl pot)
 * - openGraph/twitter: sestavljen naslov z pripono + opis + canonical URL
 *   (og:title NIKOLI ne podvoji pripone — testi zaklepajo)
 * - locale: sl_SI/en_US/… (OG_LOCALES); siteName iz layouta NE gre tja
 *   (page-level openGraph ZAMENJA layout openGraph — zaradi tega ga tu
 *   ponovimo, da se ne izgubi).
 * Neznana pot → ONLY alternates (pošteno: boljše nič, kot izmišljen SEO).
 */
export function pageMetadata(locale: string, path: string): Metadata {
  const { canonical, languages } = alternatesFor(locale, path);
  const page = SEO_PAGES[path];
  if (!page) {
    return { alternates: { canonical, languages } };
  }
  const l: PickLocale = asPickLocale(locale);
  const title = pick(l, page.title);
  const description = pick(l, page.description);
  const ogTitle = composedTitle(title);
  return {
    title,
    description,
    alternates: { canonical, languages },
    keywords: page.keywords,
    openGraph: {
      title: ogTitle,
      description,
      url: canonical,
      type: "website",
      siteName: SITE_NAME,
      locale: OG_LOCALES[l] ?? "sl_SI",
    },
    twitter: { card: "summary_large_image", title: ogTitle, description },
    other: { "format-detection": "telephone=no" },
  };
}
