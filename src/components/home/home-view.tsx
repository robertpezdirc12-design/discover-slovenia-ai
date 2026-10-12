"use client";

import {
  ArrowRight,
  BedDouble,
  Building2,
  Car,
  Castle,
  Check,
  Droplets,
  ExternalLink,
  Flower2,
  Fuel,
  Landmark,
  Milestone,
  Mountain,
  MountainSnow,
  Plane,
  Sailboat,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Ticket,
  TrainFront,
  Trees,
  UtensilsCrossed,
  Waves,
} from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { AffiliateChip } from "@/components/affiliate-chip";
import { DestinationCard } from "@/components/destination-card";
import { NextStepCard, useNextStepContext } from "@/components/next-step-card";
import { PersonalHomeSection } from "@/components/home/personal-home-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link, useRouter } from "@/i18n/navigation";
// Rezervacijski register (ČIST modul, brez env — varen za klienta; gorivo ni
// provizijsko: črpalke so odprti podatki, zato ne vodijo na partnerja).
import {
  AFFILIATE_CATEGORIES,
  providersPublicDTO,
  type AffiliateCategory,
} from "@/lib/affiliate-providers";
import { pick } from "@/lib/i18n-pick";
import {
  DATA_STATS,
  DESTINATIONS,
  DEST_TYPES,
  getFeaturedDestinations,
  type DestinationType,
} from "@/lib/slovenia-data";
// POLIR15-b (2.42.0): sezonska varianta heroja razrešena na STREŽNIKU
// (page.tsx → prop) — klient nikoli ne računa datuma sam (0 hidracijske
// razlike ob polnoči/robu okna).
import type { HeroSeasonalVariant } from "@/lib/seasonal-hero";

/** Ikone tipov (Razišči po temah). */
const TYPE_ICONS: Record<DestinationType, React.ComponentType<{ className?: string }>> = {
  castle: Castle,
  cave: Landmark,
  city: Building2,
  coast: Waves,
  gorge: Milestone,
  lake: Droplets,
  mountain: MountainSnow,
  river: Sailboat,
  spa: Flower2,
};

const L = {
  heroKicker: {
    sl: "I Feel Slovenia",
    en: "I Feel Slovenia",
    it: "I Feel Slovenia",
    de: "I Feel Slovenia",
    fr: "I Feel Slovenia",
    es: "I Feel Slovenia",
  },
  heroTitle: {
    sl: "Kaj želiš doživeti v Sloveniji?",
    en: "What do you want to experience in Slovenia?",
    it: "Cosa vuoi vivere in Slovenia?",
    de: "Was möchtest du in Slowenien erleben?",
    fr: "Que veux-tu vivre en Slovénie ?",
    es: "¿Qué quieres vivir en Eslovenia?",
  },
  heroLead: {
    sl: "Napiši, kaj te veseli — odkrij 38 kuriranih destinacij Slovenije in zahodnega Balkana, sestavi načrt in pojdi.",
    en: "Write what you enjoy — discover 38 curated destinations across Slovenia and the Western Balkans, build a plan, and go.",
    it: "Scrivi cosa ti piace — scopri 38 destinazioni selezionate tra Slovenia e Balcani occidentali, crea un itinerario e parti.",
    de: "Schreib, was dir Freude macht — entdecke 38 kuratierte Reiseziele in Slowenien und auf dem westlichen Balkan, plane deine Route und los geht’s.",
    fr: "Écris ce que tu aimes — découvre 38 destinations sélectionnées en Slovénie et dans les Balkans occidentaux, compose ton itinéraire et pars.",
    es: "Escribe lo que te gusta — descubre 38 destinos seleccionados de Eslovenia y los Balcanes occidentales, arma tu plan y sal.",
  },
  searchPlaceholder: {
    sl: "Iskanje: Bled, jama, Soča, obala …",
    en: "Search: Bled, cave, Soča, coast …",
    it: "Cerca: Bled, grotta, Soča, costa …",
    de: "Suche: Bled, Höhle, Soča, Küste …",
    fr: "Rechercher : Bled, grotte, Soča, côte …",
    es: "Buscar: Bled, cueva, Soča, costa …",
  },
  searchLabel: {
    sl: "Iskanje destinacij",
    en: "Search destinations",
    it: "Cerca destinazioni",
    de: "Reiseziele suchen",
    fr: "Rechercher des destinations",
    es: "Buscar destinos",
  },
  searchSubmit: {
    sl: "Poišči",
    en: "Search",
    it: "Cerca",
    de: "Suchen",
    fr: "Rechercher",
    es: "Buscar",
  },
  ctaPlan: {
    sl: "Načrtuj pot",
    en: "Plan a trip",
    it: "Pianifica un viaggio",
    de: "Reise planen",
    fr: "Planifier un voyage",
    es: "Planifica un viaje",
  },
  ctaExplore: {
    sl: "Razišči destinacije",
    en: "Explore destinations",
    it: "Scopri le destinazioni",
    de: "Reiseziele entdecken",
    fr: "Explorer les destinations",
    es: "Descubre destinos",
  },
  stats: {
    sl: {
      d: `${DATA_STATS.destinations} destinacij`,
      c: `${DATA_STATS.countries} države`,
      r: `${DATA_STATS.regions} regij`,
    },
    en: {
      d: `${DATA_STATS.destinations} destinations`,
      c: `${DATA_STATS.countries} countries`,
      r: `${DATA_STATS.regions} regions`,
    },
    it: {
      d: `${DATA_STATS.destinations} destinazioni`,
      c: `${DATA_STATS.countries} paesi`,
      r: `${DATA_STATS.regions} regioni`,
    },
    de: {
      d: `${DATA_STATS.destinations} Reiseziele`,
      c: `${DATA_STATS.countries} Länder`,
      r: `${DATA_STATS.regions} Regionen`,
    },
    fr: {
      d: `${DATA_STATS.destinations} destinations`,
      c: `${DATA_STATS.countries} pays`,
      r: `${DATA_STATS.regions} régions`,
    },
    es: {
      d: `${DATA_STATS.destinations} destinos`,
      c: `${DATA_STATS.countries} países`,
      r: `${DATA_STATS.regions} regiones`,
    },
  },
  themesKicker: {
    sl: "Razišči po temah",
    en: "Explore by theme",
    it: "Esplora per tema",
    de: "Nach Themen entdecken",
    fr: "Explorer par thème",
    es: "Explora por tema",
  },
  themesLead: {
    sl: "Od srednjeveških gradov do jadranske obale — vsaka tema je vstop v drugo Slovenijo.",
    en: "From medieval castles to the Adriatic coast — each theme is an entrance into a different Slovenia.",
    it: "Dai castelli medievali alla costa adriatica — ogni tema è un ingresso in una Slovenia diversa.",
    de: "Von mittelalterlichen Burgen bis zur Adriaküste — jedes Thema ist ein Zugang zu einem anderen Slowenien.",
    fr: "Des châteaux médiévaux à la côte adriatique — chaque thème est une porte d’entrée vers une autre Slovénie.",
    es: "De castillos medievales a la costa adriática — cada tema es una entrada a una Eslovenia distinta.",
  },
  themesCount: {
    sl: (n: number) => `${n} destinacij`,
    en: (n: number) => `${n} destinations`,
    it: (n: number) => `${n} destinazioni`,
    de: (n: number) => `${n} Reiseziele`,
    fr: (n: number) => `${n} destinations`,
    es: (n: number) => `${n} destinos`,
  },
  popularTitle: {
    sl: "Priljubljene destinacije",
    en: "Popular destinations",
    it: "Destinazioni popolari",
    de: "Beliebte Reiseziele",
    fr: "Destinations populaires",
    es: "Destinos populares",
  },
  popularLead: {
    sl: "Šest izpostavljenih krajev, ki jih uredništvo najpogosteje priporoča.",
    en: "Six featured places our editors recommend most often.",
    it: "Sei luoghi in evidenza che la redazione consiglia più spesso.",
    de: "Sechs vorgestellte Orte, die unsere Redaktion am häufigsten empfiehlt.",
    fr: "Six lieux à la une que notre rédaction recommande le plus souvent.",
    es: "Seis lugares destacados que nuestro equipo editorial recomienda con más frecuencia.",
  },
  itinerariesKicker: {
    sl: "Sestavi načrt v 30 sekundah",
    en: "Build a plan in 30 seconds",
    it: "Crea un itinerario in 30 secondi",
    de: "In 30 Sekunden zur Route",
    fr: "Créez un itinéraire en 30 secondes",
    es: "Crea un plan en 30 segundos",
  },
  itinerariesTitle: {
    sl: "Ali izberi preverjen itinerer",
    en: "Or pick a proven itinerary",
    it: "Oppure scegli un itinerario collaudato",
    de: "Oder wähle einen erprobten Reiseplan",
    fr: "Ou choisissez un itinéraire éprouvé",
    es: "O elige un itinerario probado",
  },
  itinerariesLead: {
    sl: "Predlagane izhodiščne izbire za načrtovalnik — vsako prilagodiš v naslednjem koraku.",
    en: "Suggested starting points for the planner — each one adapts in the next step.",
    it: "Punti di partenza suggeriti per il pianificatore — ciascuno si adatta nel passaggio successivo.",
    de: "Vorgeschlagene Ausgangspunkte für den Planer — jeder lässt sich im nächsten Schritt anpassen.",
    fr: "Points de départ suggérés pour le planificateur — chacun s’adapte à l’étape suivante.",
    es: "Puntos de partida sugeridos para el planificador — cada uno se adapta en el siguiente paso.",
  },
  checkTitle: {
    sl: "Preveri svoj načrt",
    en: "Check your plan",
    it: "Controlla il tuo itinerario",
    de: "Prüfe deinen Plan",
    fr: "Vérifie ton itinéraire",
    es: "Comprueba tu plan",
  },
  checkLead: {
    sl: "Načrtovalnik išče prekrivanja, nemogoče razdalje in časovne konflikte — preden greš na pot.",
    en: "The planner catches overlaps, impossible distances and timing conflicts — before you leave.",
    it: "Il pianificatore individua sovrapposizioni, distanze impossibili e conflitti di orario — prima di partire.",
    de: "Der Planer findet Überschneidungen, unmögliche Distanzen und Zeitkonflikte — bevor du losfährst.",
    fr: "Le planificateur détecte les chevauchements, les distances impossibles et les conflits d’horaire — avant ton départ.",
    es: "El planificador detecta solapamientos, distancias imposibles y conflictos de horario — antes de salir.",
  },
  checkCta: {
    sl: "Preveri svoj načrt",
    en: "Check your plan",
    it: "Controlla il tuo itinerario",
    de: "Prüfe deinen Plan",
    fr: "Vérifie ton itinéraire",
    es: "Comprueba tu plan",
  },
  newsletterTitle: {
    sl: "Prejmi skrite bisere Slovenije",
    en: "Receive Slovenia's hidden gems",
    it: "Ricevi i gioielli nascosti della Slovenia",
    de: "Erhalte Sloweniens verborgene Schätze",
    fr: "Recevez les trésors cachés de la Slovénie",
    es: "Recibe las joyas ocultas de Eslovenia",
  },
  newsletterLead: {
    sl: "Enkrat mesečno: manj znane destinacije, sezonski nasveti in praktični vodniki. Brez vsiljene pošte.",
    en: "Once a month: lesser-known destinations, seasonal tips and practical guides. No spam.",
    it: "Una volta al mese: destinazioni poco note, consigli di stagione e guide pratiche. Nessuno spam.",
    de: "Einmal im Monat: wenig bekannte Reiseziele, Saison-Tipps und praktische Guides. Kein Spam.",
    fr: "Une fois par mois : destinations méconnues, conseils de saison et guides pratiques. Sans spam.",
    es: "Una vez al mes: destinos poco conocidos, consejos de temporada y guías prácticas. Sin spam.",
  },
  newsletterPlaceholder: {
    sl: "tvoja@email.si",
    en: "you@email.com",
    it: "tua@email.it",
    de: "deine@email.de",
    fr: "ton@email.fr",
    es: "tu@email.es",
  },
  newsletterLabel: {
    sl: "E-poštni naslov",
    en: "Email address",
    it: "Indirizzo e-mail",
    de: "E-Mail-Adresse",
    fr: "Adresse e-mail",
    es: "Correo electrónico",
  },
  newsletterSubmit: {
    sl: "Prijavi me",
    en: "Subscribe",
    it: "Iscrivimi",
    de: "Abonnieren",
    fr: "M’inscrire",
    es: "Suscribirme",
  },
  newsletterOk: {
    sl: "Prijavljeno! Preveri e-pošto za dobrodošlico.",
    en: "Subscribed! Check your inbox for a welcome.",
    it: "Iscrizione fatta! Controlla la posta per il messaggio di benvenuto.",
    de: "Angemeldet! Schau in dein Postfach für die Begrüßung.",
    fr: "Inscription réussie ! Vérifie ta boîte mail pour le message d’accueil.",
    es: "¡Suscrito! Revisa tu correo para el mensaje de bienvenida.",
  },
  newsletterErr: {
    sl: "Prijava ni uspela — preveri e-poštni naslov.",
    en: "Subscription failed — please check your email address.",
    it: "Iscrizione non riuscita — controlla l’indirizzo e-mail.",
    de: "Anmeldung fehlgeschlagen — bitte E-Mail-Adresse prüfen.",
    fr: "Échec de l’inscription — vérifie ton adresse e-mail.",
    es: "No se pudo suscribir — revisa tu correo electrónico.",
  },
  endlessTitle: {
    sl: "Neskončne možnosti doživetij",
    en: "Endless possibilities of experiences",
    it: "Infinite possibilità di esperienze",
    de: "Endlose Erlebnismöglichkeiten",
    fr: "Des possibilités d’expériences infinies",
    es: "Infinitas posibilidades de experiencias",
  },
  endlessLead: {
    sl: "Vsi vklopi istega kanonskega nabora destinacij — 38 krajev, 21 regij, 4 države.",
    en: "All paths draw from the same canonical set of destinations — 38 places, 21 regions, 4 countries.",
    it: "Tutti i percorsi attingono dallo stesso insieme canonico di destinazioni — 38 luoghi, 21 regioni, 4 paesi.",
    de: "Alle Wege speisen sich aus demselben kanonischen Bestand an Reisezielen — 38 Orte, 21 Regionen, 4 Länder.",
    fr: "Tous les parcours puisent dans le même ensemble canonique de destinations — 38 lieux, 21 régions, 4 pays.",
    es: "Todos los caminos surgen del mismo conjunto canónico de destinos — 38 lugares, 21 regiones, 4 países.",
  },
  // Booking hub (v2.5.0) — DELNI slovar {sl, en}: ostali jeziki padajo na
  // slovenščino (kanon 48-b); provizijska razkritja so poštena in vidna.
  bookingTitle: {
    sl: "Rezerviraj potovanje",
    en: "Book your trip",
    it: "Prenota il tuo viaggio",
    de: "Reise buchen",
    fr: "Réserve ton voyage",
    es: "Reserva tu viaje",
  },
  bookingLead: {
    sl: "Nastanitve, doživetja, leti, avto in prevozi — povezave odprejo pri preverjenih partnerjih, bencinske črpalke pa najdeš na našem zemljevidu.",
    en: "Stays, experiences, flights, cars and transfers — links open with verified partners; fuel stations live on our map.",
    it: "Soggiorni, esperienze, voli, auto e trasferimenti — i link si aprono con partner verificati; le stazioni di servizio le trovi sulla nostra mappa.",
    de: "Unterkünfte, Erlebnisse, Flüge, Autos und Transfers — Links öffnen sich bei überprüften Partnern; Tankstellen findest du auf unserer Karte.",
    fr: "Hébergements, expériences, vols, voitures et transferts — les liens s’ouvrent chez des partenaires vérifiés ; les stations-service se trouvent sur notre carte.",
    es: "Alojamientos, experiencias, vuelos, coches y traslados — los enlaces se abren con socios verificados; las gasolineras las encuentras en nuestro mapa.",
  },
  bookingOpenAt: {
    sl: (name: string) => `Odpri pri ${name}`,
    en: (name: string) => `Open at ${name}`,
    it: (name: string) => `Apri presso ${name}`,
    de: (name: string) => `Öffnen bei ${name}`,
    fr: (name: string) => `Ouvrir chez ${name}`,
    es: (name: string) => `Abrir en ${name}`,
  },
  bookingMapCta: {
    sl: "Poglej na zemljevidu",
    en: "View on the map",
    it: "Guarda sulla mappa",
    de: "Auf der Karte ansehen",
    fr: "Voir sur la carte",
    es: "Ver en el mapa",
  },
  bookingDisclosure: {
    sl: "Ko rezerviraš prek povezav naših partnerjev, partner nama izplača provizijo — cena zate ostaja enaka.",
    en: "When you book through our partner links, the partner pays us a commission — your price stays the same.",
    it: "Quando prenoti tramite i link dei nostri partner, il partner ci paga una commissione — il prezzo per te resta invariato.",
    de: "Wenn du über die Links unserer Partner buchst, zahlt uns der Partner eine Provision — dein Preis bleibt gleich.",
    fr: "Quand tu réserves via les liens de nos partenaires, le partenaire nous verse une commission — ton prix reste le même.",
    es: "Cuando reservas a través de los enlaces de nuestros socios, el socio nos paga una comisión — tu precio sigue igual.",
  },
} as const;

/** DOMAČA STRAN (klientni del — metadata nosi server ovoj v [locale]/page.tsx). */

/** Števci destinacij po tipu (enkraten izračun — fiksni kanonski nabor). */
function countByType(): Record<DestinationType, number> {
  const out = {} as Record<DestinationType, number>;
  for (const key of Object.keys(DEST_TYPES) as DestinationType[]) out[key] = 0;
  for (const d of DESTINATIONS) out[d.type] += 1;
  return out;
}
const DESTINATION_COUNTS = countByType();

/** Predlogi itinererjev (izhod na /nacrtuj?preset=…) — slovarji po pick(). */
const PRESETS = [
  {
    slug: "mirni-vikend-reka",
    title: {
      sl: "Miren vikend ob reki",
      en: "A calm weekend by the river",
      it: "Un fine settimana tranquillo al fiume",
      de: "Ein ruhiges Wochenende am Fluss",
      fr: "Un week-end paisible au bord de la rivière",
      es: "Un fin de semana tranquilo junto al río",
    },
    body: {
      sl: "Soča ali Krka — počasen tempo, sprehodi in lokalna hrana.",
      en: "Soča or Krka — slow pace, walks and local food.",
      it: "Soča o Krka — ritmo lento, passeggiate e cibo locale.",
      de: "Soča oder Krka — gemächliches Tempo, Spaziergänge und lokale Küche.",
      fr: "Soča ou Krka — rythme lent, promenades et cuisine locale.",
      es: "Soča o Krka — ritmo tranquilo, paseos y comida local.",
    },
  },
  {
    slug: "druzinski-izlet",
    title: {
      sl: "Družinski izlet danes",
      en: "Family day trip today",
      it: "Gita in famiglia oggi",
      de: "Familienausflug heute",
      fr: "Excursion en famille aujourd’hui",
      es: "Excursión familiar hoy",
    },
    body: {
      sl: "Krajše razdalje, varne atrakcije in sladki zastanki.",
      en: "Shorter distances, safe sights and sweet stops.",
      it: "Distanze brevi, attrazioni sicure e soste dolci.",
      de: "Kürzere Strecken, sichere Sehenswürdigkeiten und süße Stopps.",
      fr: "Distances courtes, sites sûrs et pauses gourmandes.",
      es: "Distancias cortas, atracciones seguras y paradas dulces.",
    },
  },
  {
    slug: "romantika-vino",
    title: {
      sl: "Romantičen vikend z vinom",
      en: "Romantic wine weekend",
      it: "Weekend romantico col vino",
      de: "Romantisches Wein-Wochenende",
      fr: "Week-end romantique et vin",
      es: "Fin de semana romántico con vino",
    },
    body: {
      sl: "Vinske gorice, razgledi in večerja za dva.",
      en: "Wine hills, viewpoints and dinner for two.",
      it: "Colli del vino, panorami e cena per due.",
      de: "Weinhügel, Aussichtspunkte und Dinner zu zweit.",
      fr: "Coteaux viticoles, points de vue et dîner en tête-à-tête.",
      es: "Colinas vinícolas, miradores y cena para dos.",
    },
  },
  {
    slug: "izlet-brez-guzve",
    title: {
      sl: "Cenejši izlet brez gužve",
      en: "Cheaper trip without crowds",
      it: "Gita più economica senza folle",
      de: "Günstigerer Ausflug ohne Menschenmassen",
      fr: "Voyage moins cher, sans la foule",
      es: "Viaje más barato sin multitudes",
    },
    body: {
      sl: "Manj znane točke izven vrhov sezone — za manj košarke.",
      en: "Lesser-known spots off the seasonal peaks.",
      it: "Punti meno noti fuori dai picchi di stagione.",
      de: "Weniger bekannte Orte abseits der Saisonhöhepunkte.",
      fr: "Sites moins connus hors des pics de saison.",
      es: "Lugares menos conocidos fuera de la temporada alta.",
    },
  },
  {
    slug: "lokalna-hrana",
    title: {
      sl: "Najboljša lokalna hrana",
      en: "Best local food",
      it: "Il meglio del cibo locale",
      de: "Beste lokale Küche",
      fr: "La meilleure cuisine locale",
      es: "La mejor comida local",
    },
    body: {
      sl: "Od kremšnite do štrukljev — postanki, kjer kuhajo doma.",
      en: "From cream cake to štruklji — stops that cook like home.",
      it: "Dalla kremšnita agli štruklji — soste dove si cucina come a casa.",
      de: "Von der Bleier Kremšnita bis zu Štruklji — Stopps, die wie zu Hause kochen.",
      fr: "De la kremšnita aux štruklji — des étapes où l’on cuisine comme à la maison.",
      es: "De la kremšnita a los štruklji — paradas donde se cocina como en casa.",
    },
  },
] as const;

/** Doživetjski blok: 6 tem (povezave v raziskovalco z delujočimi filtri). */
const ENDLESS = [
  {
    icon: Mountain,
    q: "/destinacije?type=mountain",
    label: { sl: "Pohodništvo", en: "Hiking", it: "Escursioni", de: "Wandern", fr: "Randonnée", es: "Senderismo" },
  },
  {
    icon: Waves,
    q: "/destinacije?type=river",
    label: { sl: "Vodne avanture", en: "Water adventures", it: "Avventure d’acqua", de: "Wasserabenteuer", fr: "Aventures aquatiques", es: "Aventuras acuáticas" },
  },
  {
    icon: Landmark,
    q: "/destinacije?type=castle",
    label: { sl: "Zgodovina & kultura", en: "History & culture", it: "Storia e cultura", de: "Geschichte & Kultur", fr: "Histoire et culture", es: "Historia y cultura" },
  },
  {
    icon: Trees,
    q: "/destinacije?type=gorge",
    label: { sl: "Narava & parki", en: "Nature & parks", it: "Natura e parchi", de: "Natur & Parks", fr: "Nature et parcs", es: "Naturaleza y parques" },
  },
  {
    icon: UtensilsCrossed,
    q: "/destinacije?q=hrana",
    label: { sl: "Kulinarija", en: "Culinary", it: "Cucina", de: "Kulinarik", fr: "Gastronomie", es: "Gastronomía" },
  },
  {
    icon: Sparkles,
    q: "/destinacije?type=cave",
    label: { sl: "Skrite dragulje", en: "Hidden gems", it: "Gioioli nascosti", de: "Verborgene Schätze", fr: "Trésors cachés", es: "Joyas ocultas" },
  },
] as const;

/** Ikone rezervacijskih kategorij (Booking hub) — lucide, brez emodžijev. */
const CATEGORY_ICONS: Record<
  AffiliateCategory,
  React.ComponentType<{ className?: string }>
> = {
  stays: BedDouble,
  experiences: Ticket,
  flights: Plane,
  car: Car,
  transfers: TrainFront,
  tickets: Landmark,
  esim: Smartphone,
  insurance: ShieldCheck,
  fuel: Fuel,
};

/**
 * Javni seznam rezervacijskih partnerjev (čisti register brez žetonov —
 * partnerska imena in opisi prihajajo iz enega vira, nič hardkodirano).
 */
const BOOKING_PARTNERS = providersPublicDTO();

export function HomeView({
  nextStepDismissed = false,
  personalGate = false,
  seasonalHero = null,
}: {
  /** POLIR13 (2.40.0): sejni dismiss zrcaljen v piškotek
   *  dai:next-step-dismissed — strežniški starš (page.tsx) ga prebere s
   *  cookies() in kartico izpusti ŽE v SSR (ni rezervacije prostora, ni
   *  premika vsebine po ponovnem nalaganju v isti seji). */
  nextStepDismissed?: boolean;
  /** POLIR15-c (2.42.0): STREŽNIŠKA vrata osebne domov (getSessionGate —
   *  cache getServerSession) — sekca je ŽE v SSR (prijavljeni) oziroma
   *  trajno odsotna (gostje); prej je useSession() na klientu vstavljal
   *  sekco šele po razrešitvi statusa (dva premika vsebine). */
  personalGate?: boolean;
  /** POLIR15-b (2.42.0): sezonska varianta heroja (badge čip) razrešena
   *  na strežniku; null = brez čipa (defenzivno — page.tsx vedno poda). */
  seasonalHero?: HeroSeasonalVariant | null;
}) {
  const l = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);
  const featured = React.useMemo(() => getFeaturedDestinations().slice(0, 6), []);
  const { ctx: nextStepCtx, ready: nextStepReady } = useNextStepContext();

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/destinacije?q=${encodeURIComponent(q)}` : "/destinacije");
  };

  const onNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || !sending) {
      try {
        setSending(true);
        const res = await fetch("/api/newsletter/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: value }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast({ title: t("newsletterOk") });
        setEmail("");
      } catch {
        toast({ title: t("newsletterErr"), variant: "destructive" });
      } finally {
        setSending(false);
      }
    }
  };

  return (
    <div className="w-full">
      {/* ======== HERO ======== */}
      {/* POLIR9 (WCAG 1.4.3): -mt-16 zavleče hero pod prozorno sticky glavo
          (h-16) — glava z belo pisavo sedi na zelenem, ne na belem telesu
          (živa napaka: nevidna glava @scroll 0, svetla tema). py-16/24
          absorbira 64 px glave, zato vsebina (kicker/h1/uvod/iskalnik) ostane
          pod glavo. Temne stopnje gradienta: svetli --primary (oklch 0.586)
          bi belo besedilo spodnesel na ~2–2,9:1 — izrecne temnozelene stopnje
          držijo ≥ 4,5:1 (via #0e5c28 = 8,15:1 za čisto belo). */}
      <section className="relative -mt-16 overflow-hidden bg-gradient-to-br from-primary via-primary to-[#1e4f2d] text-white dark:from-[#0b4d20] dark:via-[#0e5c28] dark:to-[#063615]">
        {/* Dekorativni vzorec (radialne lise, brez zunanjih slik) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_12%),radial-gradient(circle_at_80%_60%,white_0,transparent_16%)]"
        />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          {/* POLIR15-b (2.42.0): SEZONSKI ČIP nad kickerjem — sezonska
              afiniteta po vzoru Švice (sezonski koledar kampanj) in Irske
              (dogodek kot pripovedovalec): ST MMDD okna + izvorni SI
              mikro-dogodki (martinovanje/kurentovanje/december) razrešeni
              na strežniku. Statičen SSR = 0 CLS (višino absorbira py-16/24). */}
          {seasonalHero && (
            <p
              data-testid="seasonal-badge"
              className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90"
            >
              {pick(l, seasonalHero.badge)}
            </p>
          )}
          <p className="mt-3 text-xs font-bold tracking-[0.22em] text-white/80 uppercase">
            {t("heroKicker")}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">
            {t("heroLead")}
          </p>

          {/* Iskanje */}
          <form
            onSubmit={onSearch}
            role="search"
            aria-label={t("searchLabel")}
            className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-xl bg-white/95 p-1.5 shadow-xl backdrop-blur"
          >
            <Search
              className="ml-2 size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="hero-search" className="sr-only">
              {t("searchLabel")}
            </label>
            <Input
              id="hero-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-11 border-none bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
              autoComplete="off"
            />
            <Button type="submit" className="h-11 shrink-0 px-4 sm:px-6">
              {t("searchSubmit")}
            </Button>
          </form>

          {/* CTA gumba */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="tap-target font-semibold"
            >
              <Link href="/nacrtuj">
                {t("ctaPlan")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="tap-target border-white/50 bg-transparent font-semibold text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/destinacije">{t("ctaExplore")}</Link>
            </Button>
          </div>

          {/* Statistika nabora */}
          <dl className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-white/85">
            {(["d", "c", "r"] as const).map((k, i) => (
              <React.Fragment key={k}>
                {i > 0 && (
                  <span aria-hidden="true" className="hidden text-white/50 sm:inline">
                    ·
                  </span>
                )}
                <div className="flex items-baseline gap-1">
                  <dt className="sr-only">{k}</dt>
                  <dd>{pick(l, L.stats)[k]}</dd>
                </div>
              </React.Fragment>
            ))}
          </dl>
        </div>
      </section>

      {/* ======== PROAKTIVNI POMOČNIK — naslednji smiseln korak (issue #1) ========
          POLIR13 (2.40.0): vrata so ZDAJ strežniška (piškotek
          dai:next-step-dismissed, ne več nextStepReady) + kartica se izriše
          NEVIDNA že v SSR in se razkrije ob `ready` (prop) — rezervacija
          prostora po web.dev kanonu „Reserve space for late-loading
          content“ (vstavitev 379 px po hidraciji je povzročala CLS 0,161). */}
      {!nextStepDismissed && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          <NextStepCard ctx={nextStepCtx} surface="home" ready={nextStepReady} />
        </div>
      )}

      {/* ======== P1-D (issue #3 §9): PERSONALIZIRANA DOMOV — samo prijavljeni
           (gostjev javni Discover se nadaljuje nespremenjen spodaj).
           POLIR15-c (2.42.0): vrata so ZDAJ STREŽNIŠKA (personalGate —
           getSessionGate v page.tsx); sekca je ŽE v SSR HTML ali trajno
           odsotna — brez useSession „loading“ faze in brez vstavljanja po
           hidraciji (0 premika vsebine pod sekco). ======== */}
      <PersonalHomeSection gate={personalGate} />

      {/* ======== RAZIŠČI PO TEMAH ======== */}
      <section aria-labelledby="teme" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 id="teme" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("themesKicker")}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("themesLead")}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9 lg:gap-2">
          {(Object.keys(DEST_TYPES) as DestinationType[]).map((type) => {
            const Icon = TYPE_ICONS[type];
            return (
              <Link
                key={type}
                href={`/destinacije?type=${type}`}
                className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold">{pick(l, DEST_TYPES[type])}</span>
                <span className="text-[11px] text-muted-foreground">
                  {pick(l, L.themesCount)(DESTINATION_COUNTS[type] ?? 0)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ======== PRILJUBLJENE DESTINACIJE ======== */}
      <section
        aria-labelledby="priljubljene"
        className="bg-muted/40 py-14"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="priljubljene" className="text-2xl font-bold tracking-tight sm:text-3xl">
                {t("popularTitle")}
              </h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">{t("popularLead")}</p>
            </div>
            <Link
              href="/destinacije"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              {t("ctaExplore")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((d, i) => (
              <DestinationCard key={d.slug} d={d} priority={i < 3} />
            ))}
          </div>
        </div>
      </section>

      {/* ======== PREVERJENI ITINERERJI ======== */}
      <section
        aria-labelledby="itinererji"
        className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
      >
        <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">
          {t("itinerariesKicker")}
        </p>
        <h2 id="itinererji" className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("itinerariesTitle")}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("itinerariesLead")}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PRESETS.map((p) => (
            <Link
              key={p.slug}
              href={`/nacrtuj?preset=${p.slug}`}
              className="group flex min-h-36 flex-col justify-between rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div>
                <h3 className="text-base font-bold leading-snug group-hover:text-primary">
                  {pick(l, p.title)}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{pick(l, p.body)}</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                {t("ctaPlan")}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ======== PREVERI SVOJ NAČRT (zamegljen blok) ======== */}
      <section aria-labelledby="preveri" className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-primary/5 p-6 sm:p-10">
          {/* Zamegljena "predogledna" vsebina (dekoracija, ne berljiva) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 select-none blur-[3px] [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]"
          >
            <div className="flex h-full flex-col justify-center gap-3 px-6 opacity-40">
              <div className="h-3 w-3/5 rounded bg-primary/40" />
              <div className="h-3 w-4/5 rounded bg-muted-foreground/30" />
              <div className="h-3 w-2/3 rounded bg-muted-foreground/30" />
              <div className="h-3 w-1/2 rounded bg-muted-foreground/30" />
            </div>
          </div>
          <div className="relative max-w-xl">
            <h2 id="preveri" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("checkTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground">{t("checkLead")}</p>
            <Button asChild className="mt-6 tap-target font-semibold">
              <Link href="/nacrtuj">
                {t("checkCta")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ======== REZERVIRAJ POTOVANJE (provizijski partnerji + odprti podatki) ========
          Iskrenost: partnerje brez aktiviranega programa še vedno odpremo
          (javno iskanje), gorivo pa NI provizijsko — vodi na lastni zemljevid. */}
      <section
        aria-labelledby="rezerviraj"
        className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
      >
        <h2 id="rezerviraj" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("bookingTitle")}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("bookingLead")}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BOOKING_PARTNERS.map((p) => {
            const Icon = CATEGORY_ICONS[p.category];
            return (
              <Card key={p.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold leading-tight">
                        {pick(l, AFFILIATE_CATEGORIES[p.category])}
                      </h3>
                      <p className="text-xs font-medium text-muted-foreground">{p.name}</p>
                    </div>
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {pick(l, { sl: p.descSl, en: p.descEn })}
                  </p>
                  {p.commissionable ? (
                    <>
                      {/* POLIR8 (2.35.0): whitespace-normal h-auto — dolga oznaka
                          („Odpri pri Viator (Tripadvisor)“ min 275 px) je
                          razširila kartico na 313 px > 288 px @320 (WCAG 1.4.10);
                          min-h-8 ohrani minimalno višino tap-target. */}
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="mt-4 w-full whitespace-normal h-auto min-h-8 font-semibold tap-target"
                      >
                        {/* Vodeni klik skozi lastni API (izpis klika + 302);
                            rel="sponsored" je obvezen za provizijske povezave. */}
                        <a
                          href={`/api/affiliate/go?provider=${p.id}`}
                          target="_blank"
                          rel="nofollow sponsored noopener"
                        >
                          {t("bookingOpenAt")(p.name)}
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                      </Button>
                      {/* POLIR B (FTC): razkritje OB povezavi — čip vodi na
                          /zaupanje-in-varnost (celotna objava o proviziji). */}
                      <AffiliateChip className="mt-2 self-center" />
                    </>
                  ) : (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="mt-4 w-full font-semibold tap-target"
                    >
                      {/* Gorivo = odprti podatki (OSM), ne partner — zemljevid. */}
                      <Link href="/zemljevid">
                        {t("bookingMapCta")}
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {t("bookingDisclosure")}
        </p>
      </section>

      {/* ======== NEWSLETTER ======== */}
      <section aria-labelledby="newsletter" className="border-t bg-muted/40 py-14">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Send className="size-5" aria-hidden="true" />
          </span>
          <h2 id="newsletter" className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("newsletterTitle")}
          </h2>
          <p className="mt-2 max-w-xl text-muted-foreground">{t("newsletterLead")}</p>
          <form
            onSubmit={onNewsletter}
            className="mt-6 flex w-full max-w-md flex-col gap-2 sm:flex-row"
          >
            <label htmlFor="newsletter-email" className="sr-only">
              {t("newsletterLabel")}
            </label>
            <Input
              id="newsletter-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("newsletterPlaceholder")}
              autoComplete="email"
              className="h-11 flex-1"
            />
            <Button type="submit" disabled={sending} className="h-11 font-semibold">
              {sending ? "…" : t("newsletterSubmit")}
            </Button>
          </form>
        </div>
      </section>

      {/* ======== NESKONČNE MOŽNOSTI ======== */}
      <section
        aria-labelledby="neskoncne"
        className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
      >
        <h2 id="neskoncne" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("endlessTitle")}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("endlessLead")}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ENDLESS.map((theme) => {
            const Icon = theme.icon;
            return (
              <Link
                key={theme.q}
                href={theme.q}
                className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Icon className="size-6 text-primary" aria-hidden="true" />
                <span className="text-sm font-semibold">{pick(l, theme.label)}</span>
              </Link>
            );
          })}
        </div>
        <Card className="mt-10 border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-5">
            <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              {pick(l, {
                sl: "Iskrenostni kanon: vsi prikazi (ocena, vir, cena) prihajajo iz kanonskega nabora 38 destinacij z zapisanim izvorom — nič ni izmišljeno.",
                en: "Honesty canon: every displayed value (rating, source, price) comes from the canonical set of 38 destinations with recorded provenance — nothing is invented.",
                it: "Canone dell’onestà: ogni valore mostrato (valutazione, fonte, prezzo) proviene dall’insieme canonico di 38 destinazioni con provenienza documentata — nulla è inventato.",
                de: "Ehrlichkeits-Kanon: Jeder angezeigte Wert (Bewertung, Quelle, Preis) stammt aus dem kanonischen Bestand von 38 Reisezielen mit erfasster Herkunft — nichts ist erfunden.",
                fr: "Canon d’honnêteté : chaque valeur affichée (note, source, prix) provient de l’ensemble canonique de 38 destinations avec provenance enregistrée — rien n’est inventé.",
                es: "Canon de honestidad: cada valor mostrado (valoración, fuente, precio) proviene del conjunto canónico de 38 destinos con procedencia registrada — nada es inventado.",
              })}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
