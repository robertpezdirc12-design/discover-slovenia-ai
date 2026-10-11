/**
 * LOKALI-DATA — B2B imenik lokalnih ponudnikov (rekonstrukcija /lokali).
 *
 * Viri in iskrenost (kanon projekta — brez izmišljenih podatkov):
 *  - STRUKTURA (kategorije, oznake vremena, razvrščanje) je izluščena iz
 *    produkcijske JS module strani /lokali (production-mirror/_next/…/app/
 *    lokali/page-0ead14662b4e4e5f.js): kategorije hotel/restaurant/bar/
 *    activity/shop/transport/other, vremenske oznake indoor/outdoor/
 *    all-weather, razvrščanje izpostavljeni/najvišja ocena/najnovejši.
 *  - ZAPISI: produkcijski API /api/listings (živi vir zapisov) ni bil
 *    zajet v posnetek — dejanski zapisi ponudnikov NISO obnovljivi.
 *    Spodnji nabor je UREDNIŠKA KURACIJA dobro znanih, realnih slovenskih
 *    ponudnikov (enak status "internal" kot del destinacij v slovenia-data).
 *  - BREZ koordinat, kontaktov, odpiralnih časov in cen: teh podatkov v
 *    obnovljenih virih ni, zato jih iskreno NE izmišljujemo (strani se
 *    dopolnijo po overjenih virih — glej LOKALI_HONESTY_NOTE).
 */

import type { CountryCode } from "./slovenia-data";

/** Kategorije 1:1 iz produkcije (ključi so kanonski ID-ji). */
export type LokalCategory =
  | "hotel"
  | "restaurant"
  | "bar"
  | "activity"
  | "shop"
  | "transport"
  | "other";

/** Ustreznost vremenu 1:1 iz produkcije. */
export type WeatherFit = "indoor" | "outdoor" | "all-weather";

export interface Lokal {
  /** Kanonski ID (slug). */
  id: string;
  name: string;
  category: LokalCategory;
  /** Kraj (mesto/vas) — natančnejša lokacija ni del obnovljenih podatkov. */
  town: string;
  /** Kanonski ID regije (ključi iz slovenia-data REGIONS). */
  region: string;
  country: CountryCode;
  /** Slovenščina je vir zapisa; en je prevod kuracije. */
  description: { sl: string; en: string; it: string; de: string; fr: string; es: string };
  weather: WeatherFit;
  /** Povezava na kanonsko destinacijo, kadar je kraj med 38 destinacijami. */
  destinationSlug?: string;
  /** Uredniško izpostavljeni (razvrščanje "Izpostavljeni" iz produkcije). */
  featured?: boolean;
}

/** Kategorije z oznakami (1:1 produkcija: hotel:"Hotel", restaurant:"Restavracija" …). */
export const LOKAL_CATEGORIES: Record<
  LokalCategory,
  { sl: string; en: string; it: string; de: string; fr: string; es: string; icon: string }
> = {
  hotel: { sl: "Hotel", en: "Hotel", it: "Hotel", de: "Hotel", fr: "Hôtel", es: "Hotel", icon: "🏨" },
  restaurant: { sl: "Restavracija", en: "Restaurant", it: "Ristorante", de: "Restaurant", fr: "Restaurant", es: "Restaurante", icon: "🍽️" },
  bar: { sl: "Bar", en: "Bar", it: "Bar", de: "Bar", fr: "Bar", es: "Bar", icon: "🍸" },
  activity: { sl: "Aktivnost", en: "Activity", it: "Attività", de: "Aktivität", fr: "Activité", es: "Actividad", icon: "🎯" },
  shop: { sl: "Trgovina", en: "Shop", it: "Negozio", de: "Geschäft", fr: "Boutique", es: "Tienda", icon: "🛍️" },
  transport: { sl: "Transport", en: "Transport", it: "Trasporti", de: "Transport", fr: "Transport", es: "Transporte", icon: "🚌" },
  other: { sl: "Drugo", en: "Other", it: "Altro", de: "Sonstiges", fr: "Autre", es: "Otro", icon: "📍" },
};

/** Vremenske oznake 1:1 iz produkcije. */
export const WEATHER_FIT_LABELS: Record<
  WeatherFit,
  { sl: string; en: string; it: string; de: string; fr: string; es: string }
> = {
  indoor: { sl: "Notranje (tudi v dežju)", en: "Indoor (fine in rain)", it: "Al coperto (bene anche con pioggia)", de: "Drinnen (auch bei Regen gut)", fr: "Intérieur (convient aussi sous la pluie)", es: "Interior (también con lluvia)" },
  outdoor: { sl: "Zunanje (ob lepem vremenu)", en: "Outdoor (fair weather)", it: "All'aperto (con bel tempo)", de: "Draußen (bei schönem Wetter)", fr: "Extérieur (par beau temps)", es: "Al aire libre (con buen tiempo)" },
  "all-weather": { sl: "V vsakem vremenu", en: "All-weather", it: "Con ogni tempo", de: "Bei jedem Wetter", fr: "Par tout temps", es: "Con cualquier clima" },
};

/**
 * Iskrena opomba o obsegu podatkov (vidna na strani — nikoli prikrita).
 */
export const LOKALI_HONESTY_NOTE = {
  sl: "Zapisi so uredniška kuracija dobro znanih ponudnikov. Natančni naslovi, kontakti, odpiralni časi, ocene in koordinate niso bili zajeti v obnovitvenem posnetku — dopolnjujemo jih po overjenih virih, ne pa izmišljujemo.",
  en: "Entries are an editorial curation of well-known providers. Exact addresses, contacts, opening hours, ratings and coordinates were not captured in the recovery snapshot — we complete them from verified sources instead of inventing them.",
  it: "Le voci sono una curatela editoriale di fornitori ben noti. Indirizzi precisi, contatti, orari di apertura, valutazioni e coordinate non sono stati acquisiti nell'istantanea di recupero — li completiamo da fonti verificate, invece di inventarli.",
  de: "Die Einträge sind eine redaktionelle Auswahl bekannter Anbieter. Exakte Adressen, Kontakte, Öffnungszeiten, Bewertungen und Koordinaten wurden im Wiederherstellungs-Snapshot nicht erfasst — wir ergänzen sie aus verifizierten Quellen, statt sie zu erfinden.",
  fr: "Les entrées sont une sélection éditoriale de prestataires renommés. Adresses exactes, contacts, horaires d'ouverture, notes et coordonnées n'ont pas été capturés dans l'instantané de récupération — nous les complétons à partir de sources vérifiées, sans rien inventer.",
  es: "Las entradas son una selección editorial de proveedores reconocidos. Las direcciones exactas, los contactos, los horarios de apertura, las valoraciones y las coordenadas no se capturaron en la instantánea de recuperación — las completamos a partir de fuentes verificadas, sin inventar nada.",
} as const;

/** Vsi kurirani lokalni ponudniki (28 zapisov · 7 kategorij · 9 regij). */
export const LOKALI: Lokal[] = [
  // ── Hoteli ────────────────────────────────────────────────────────────
  {
    id: "grand-hotel-toplice",
    name: "Grand Hotel Toplice",
    category: "hotel",
    town: "Bled",
    region: "gorenjska",
    country: "SI",
    description: {
      sl: "Zgodovinska stavba na severni obali Blejskega jezera z neposrednim dostopom do kopališča in pogledom na otok.",
      en: "Historic building on the northern shore of Lake Bled with direct lake access and views of the island.",
      it: "Edificio storico sulla riva settentrionale del lago di Bled, con accesso diretto allo stabilimento balneare e vista sull'isola.",
      de: "Historisches Gebäude am Nordufer des Bleder Sees mit direktem Badzugang und Blick auf die Insel.",
      fr: "Bâtiment historique sur la rive nord du lac de Bled, avec accès direct à la baignade et vue sur l'île.",
      es: "Edificio histórico en la orilla norte del lago Bled, con acceso directo al balneario y vistas a la isla.",
    },
    weather: "indoor",
    destinationSlug: "bled",
    featured: true,
  },
  {
    id: "hotel-park-bled",
    name: "Hotel Park",
    category: "hotel",
    town: "Bled",
    region: "gorenjska",
    country: "SI",
    description: {
      sl: "Klasičen hotel ob jezeru, znan po kremšniti — slaščičarna hotela je med najbolj znanimi v Bledu.",
      en: "Classic lakefront hotel, home of the kremšnita — its patisserie is among the most famous in Bled.",
      it: "Classico hotel sul lago, celebre per la kremšnita — la pasticceria dell'hotel è tra le più note di Bled.",
      de: "Klassisches Hotel am See, bekannt für die Kremšnita — die Konditorei des Hotels gehört zu den bekanntesten in Bled.",
      fr: "Hôtel classique au bord du lac, célèbre pour la kremšnita — sa pâtisserie est l'une des plus célèbres de Bled.",
      es: "Hotel clásico a orillas del lago, famoso por la kremšnita — su pastelería es una de las más conocidas de Bled.",
    },
    weather: "indoor",
    destinationSlug: "bled",
  },
  {
    id: "hotel-bohinj",
    name: "Hotel Bohinj",
    category: "hotel",
    town: "Ribčev Laz",
    region: "gorenjska",
    country: "SI",
    description: {
      sl: "Hotel ob vzhodni obali Bohinjskega jezera, od koder vodijo poti na Vogel in k slapu Savica.",
      en: "Hotel on the eastern shore of Lake Bohinj, with trails towards Vogel and the Savica waterfall.",
      it: "Hotel sulla riva orientale del lago di Bohinj, da dove partono i sentieri per il Vogel e la cascata Savica.",
      de: "Hotel am Ostufer des Bohinjer Sees, von wo Wege zum Vogel und zum Savica-Wasserfall führen.",
      fr: "Hôtel sur la rive est du lac de Bohinj, d'où partent les sentiers vers le Vogel et la cascade de Savica.",
      es: "Hotel en la orilla este del lago Bohinj, desde donde parten los senderos hacia el Vogel y la cascada Savica.",
    },
    weather: "indoor",
    destinationSlug: "bohinj",
  },
  {
    id: "grand-hotel-union",
    name: "Grand Hotel Union",
    category: "hotel",
    town: "Ljubljana",
    region: "osrednja",
    country: "SI",
    description: {
      sl: "Secesijska stavba iz leta 1905 v neposredni bližini Prešernovega trga in glavne železniške postaje.",
      en: "A 1905 Art Nouveau landmark a short walk from Prešeren Square and the main railway station.",
      it: "Monumento liberty del 1905 a pochi passi da piazza Prešeren e dalla stazione ferroviaria principale.",
      de: "Jugendstilgebäude aus dem Jahr 1905, nur wenige Gehminuten vom Prešeren-Platz und vom Hauptbahnhof entfernt.",
      fr: "Monument Art nouveau de 1905, à quelques pas de la place Prešeren et de la gare principale.",
      es: "Monumento modernista de 1905 a pocos pasos de la plaza Prešeren y de la estación principal de tren.",
    },
    weather: "indoor",
    destinationSlug: "ljubljana",
  },
  {
    id: "hotel-piran",
    name: "Hotel Piran",
    category: "hotel",
    town: "Piran",
    region: "primorska",
    country: "SI",
    description: {
      sl: "Hotel ob obrežju piranskega starega mestnega jedra, s pogledom na Tartinijev trg in morje.",
      en: "Hotel right on the waterfront of Piran's old town, overlooking Tartini Square and the sea.",
      it: "Hotel proprio sul lungomare del centro storico di Pirano, con vista su piazza Tartini e sul mare.",
      de: "Hotel direkt an der Uferpromenade der Altstadt von Piran, mit Blick auf den Tartini-Platz und das Meer.",
      fr: "Hôtel juste sur le front de mer du centre historique de Piran, avec vue sur la place Tartini et la mer.",
      es: "Hotel justo en el paseo marítimo del casco antiguo de Piran, con vistas a la plaza Tartini y al mar.",
    },
    weather: "indoor",
    destinationSlug: "piran",
  },
  {
    id: "kempinski-palace-portoroz",
    name: "Kempinski Palace Portorož",
    category: "hotel",
    town: "Portorož",
    region: "primorska",
    country: "SI",
    description: {
      sl: "Zgodovinska palača portoroške riviere z notranjim in zunanjim bazenom ter spa.",
      en: "A grand historic palace of the Portorož riviera with indoor and outdoor pools and a spa.",
      it: "Uno storico palazzo della riviera di Portorose, con piscina interna ed esterna e una spa.",
      de: "Ein historisches Palais der Riviera von Portorož mit Innen- und Außenpool sowie Spa.",
      fr: "Un palais historique de la riviera de Portorož, avec piscines intérieure et extérieure ainsi qu'un spa.",
      es: "Un palacio histórico de la riviera de Portorož, con piscinas interior y exterior y spa.",
    },
    weather: "indoor",
    destinationSlug: "portoroz",
  },

  // ── Restavracije in gostilne ──────────────────────────────────────────
  {
    id: "hisa-franko",
    name: "Hiša Franko",
    category: "restaurant",
    town: "Staro selo pri Kobaridu",
    region: "gorenjska",
    country: "SI",
    description: {
      sl: "Svetovno znana restavracija Ane Roš v Posočju — dve michelinovi zvezdi, kuhinja s krajevnimi sestavinami.",
      en: "Ana Roš's world-famous restaurant in the Soča Valley — two Michelin stars, built on local ingredients.",
      it: "Il ristorante di Ana Roš famoso in tutto il mondo nella valle dell'Isonzo — due stelle Michelin, cucina costruita su ingredienti locali.",
      de: "Ana Roš' weltberühmtes Restaurant im Isonzo-Tal — zwei Michelin-Sterne, Küche mit lokalen Zutaten.",
      fr: "Le restaurant d'Ana Roš, mondialement célèbre, dans la vallée de la Soča — deux étoiles Michelin, une cuisine bâtie sur les produits locaux.",
      es: "El restaurante de Ana Roš, famoso en todo el mundo, en el valle del Soča — dos estrellas Michelin, cocina de ingredientes locales.",
    },
    weather: "indoor",
    destinationSlug: "kobarid",
    featured: true,
  },
  {
    id: "jb-restaurant",
    name: "JB Restaurant",
    category: "restaurant",
    town: "Ljubljana",
    region: "osrednja",
    country: "SI",
    description: {
      sl: "Restavracija Janeza Bratovža v mestnem jedru — michelinova zvezda, klasika sodobne slovenske kuhinje.",
      en: "Janez Bratovž's restaurant in the city centre — a Michelin star and a modern Slovenian classic.",
      it: "Il ristorante di Janez Bratovž nel centro città — una stella Michelin e un classico della moderna cucina slovena.",
      de: "Janez Bratovž' Restaurant im Stadtzentrum — ein Michelin-Stern und ein Klassiker der modernen slowenischen Küche.",
      fr: "Le restaurant de Janez Bratovž en centre-ville — une étoile Michelin et un classique de la cuisine slovène moderne.",
      es: "El restaurante de Janez Bratovž en el centro de la ciudad — una estrella Michelin y un clásico de la cocina eslovena moderna.",
    },
    weather: "indoor",
    destinationSlug: "ljubljana",
  },
  {
    id: "restavracija-strelec",
    name: "Restavracija Strelec",
    category: "restaurant",
    town: "Ljubljana (grad)",
    region: "osrednja",
    country: "SI",
    description: {
      sl: "Vrhunska restavracija v utrdbi Ljubljanskega gradu z razgledom na mesto — michelinova zvezda.",
      en: "Fine-dining restaurant inside Ljubljana Castle's archer's tower with city views — a Michelin star.",
      it: "Ristorante di alta cucina nella torre degli arcieri del castello di Lubiana, con vista sulla città — una stella Michelin.",
      de: "Spitzengastronomie im Schützenturm der Burg von Laibach mit Blick über die Stadt — ein Michelin-Stern.",
      fr: "Restaurant gastronomique dans la tour des archers du château de Ljubljana, avec vue sur la ville — une étoile Michelin.",
      es: "Restaurante de alta cocina en la torre de los arqueros del castillo de Liubliana, con vistas a la ciudad — una estrella Michelin.",
    },
    weather: "indoor",
    destinationSlug: "ljubljana",
  },
  {
    id: "gostilna-sestica",
    name: "Gostilna Šestica",
    category: "restaurant",
    town: "Ljubljana",
    region: "osrednja",
    country: "SI",
    description: {
      sl: "Ena najstarejših ljubljanskih gostiln (1776) s tradicionalnimi jedmi v staromestnem jedru.",
      en: "One of Ljubljana's oldest gostilnas (1776) serving traditional dishes in the old town.",
      it: "Una delle più antiche gostilne di Lubiana (1776), con piatti tradizionali nel centro storico.",
      de: "Eine der ältesten Gasthäuser Laibachs (1776) mit traditionellen Gerichten in der Altstadt.",
      fr: "L'une des plus anciennes gostilnas de Ljubljana (1776), servant des plats traditionnels en vieille ville.",
      es: "Una de las gostilnas más antiguas de Liubliana (1776), con platos tradicionales en el casco antiguo.",
    },
    weather: "indoor",
    destinationSlug: "ljubljana",
  },
  {
    id: "gostilna-sokol",
    name: "Gostilna Sokol",
    category: "restaurant",
    town: "Ljubljana",
    region: "osrednja",
    country: "SI",
    description: {
      sl: "Priljubljena staromestna gostilna s staro slovensko kuhinjo — od ajdove kaše do kranjskih klobas.",
      en: "A beloved old-town gostilna with traditional Slovenian fare — from buckwheat dishes to Kranjska sausage.",
      it: "Una amata gostilna del centro storico con la vecchia cucina slovena — dai piatti di grano saraceno alla salsiccia di Carniola.",
      de: "Eine beliebte Altstadt-Gostilna mit alter slowenischer Küche — von Buchweizengerichten bis zur Krainer Wurst.",
      fr: "Une gostilna appréciée de la vieille ville, à l'ancienne cuisine slovène — des plats de sarrasin à la saucisse de Carniole.",
      es: "Una querida gostilna del casco antiguo con la vieja cocina eslovena — desde el trigo sarraceno hasta la salchicha de Carniola.",
    },
    weather: "indoor",
    destinationSlug: "ljubljana",
  },
  {
    id: "gostilna-valvasor",
    name: "Gostilna Valvas'or",
    category: "restaurant",
    town: "Ljubljana",
    region: "osrednja",
    country: "SI",
    description: {
      sl: "Prostorna staromestna gostilna blizu Tromostovja s slovenskimi klassikami in domačimi vini.",
      en: "A spacious old-town gostilna near the Triple Bridge with Slovenian classics and local wines.",
      it: "Una spaziosa gostilna del centro storico vicino al Ponte Triplo, con classici sloveni e vini locali.",
      de: "Eine geräumige Altstadt-Gostilna nahe der Drei Brücken mit slowenischen Klassikern und Weinen der Region.",
      fr: "Une gostilna spacieuse de la vieille ville, près du Triple Pont, avec des classiques slovènes et des vins locaux.",
      es: "Una amplia gostilna del casco antiguo cerca del Puente Triple, con clásicos eslovenos y vinos locales.",
    },
    weather: "indoor",
    destinationSlug: "ljubljana",
  },
  {
    id: "pri-lojzetu-na-zemonem",
    name: "Pri Lojzetu na Zemonem",
    category: "restaurant",
    town: "Dvorec Zemono (Goriška brda)",
    region: "primorska",
    country: "SI",
    description: {
      sl: "Kavčičeva restavracija v renesančnem dvorcu nad Brdi — vrhunska brdska kuhinja z razgledom na vinograde.",
      en: "The Kavčič family's restaurant in a Renaissance mansion above Brda — refined hill cuisine among vineyards.",
      it: "Il ristorante della famiglia Kavčič in un palazzo rinascimentale sopra il Collio — raffinata cucina di collina tra i vigneti.",
      de: "Das Restaurant der Familie Kavčič in einem Renaissance-Schloss über dem Brda-Hügelland — gehobene Hügellandküche zwischen den Weingärten.",
      fr: "Le restaurant de la famille Kavčič dans un manoir Renaissance au-dessus de Brda — cuisine raffinée des collines au milieu des vignes.",
      es: "El restaurante de la familia Kavčič en una mansión renacentista sobre Brda — refinada cocina de colinas entre viñedos.",
    },
    weather: "indoor",
    destinationSlug: "nova-gorica",
  },
  {
    id: "slascicarna-zima",
    name: "Slaščičarna Zima",
    category: "restaurant",
    town: "Bled",
    region: "gorenjska",
    country: "SI",
    description: {
      sl: "Družinska slaščičarna ob cesti ob jezeru, znana po klasični blejski kremšniti.",
      en: "A family patisserie on the lakeside road, famous for the classic Bled cream cake.",
      it: "Una pasticceria a conduzione familiare sulla strada del lago, famosa per la classica kremšnita di Bled.",
      de: "Eine familiengeführte Konditorei an der Seeuferstraße, berühmt für die klassische Bleder Kremšnita.",
      fr: "Une pâtisserie familiale sur la route du lac, célèbre pour la kremšnita classique de Bled.",
      es: "Una pastelería familiar en la carretera del lago, famosa por la clásica kremšnita de Bled.",
    },
    weather: "indoor",
    destinationSlug: "bled",
  },
  {
    id: "gostilna-murka",
    name: "Gostilna Murka",
    category: "restaurant",
    town: "Murska Sobota",
    region: "prekmurje",
    country: "SI",
    description: {
      sl: "Prekmurska gostilna z bogračem, bujto repo in ostalo srčno kuhinjo ravnine.",
      en: "A Prekmurje gostilna serving bograč stew, bujta repa and the hearty pork cuisine of the plain.",
      it: "Una gostilna del Prekmurje che serve bograč, bujta repa e il resto della generosa cucina di pianura.",
      de: "Eine Prekmurje-Gostilna mit Bograč, Bujta Repa und der übrigen deftigen Küche der Ebene.",
      fr: "Une gostilna du Prekmurje servant le bograč, la bujta repa et le reste de la généreuse cuisine de la plaine.",
      es: "Una gostilna de Prekmurje que sirve bograč, bujta repa y demás cocina contundente de la llanura.",
    },
    weather: "indoor",
    destinationSlug: "murska-sobota",
  },
  {
    id: "restavracija-mak",
    name: "Restavracija Mak",
    category: "restaurant",
    town: "Kamnik",
    region: "osrednja",
    country: "SI",
    description: {
      sl: "Majhna michelinova restavracija Davida Vračka v starem mestnem jedru Kamnika.",
      en: "David Vračko's small Michelin-starred restaurant in Kamnik's old town.",
      it: "Il piccolo ristorante stellato di David Vračko nel centro storico di Kamnik.",
      de: "David Vračkos kleines Michelin-Sterne-Restaurant in der Altstadt von Kamnik.",
      fr: "Le petit restaurant étoilé de David Vračko dans la vieille ville de Kamnik.",
      es: "El pequeño restaurante con estrella Michelin de David Vračko en el casco antiguo de Kamnik.",
    },
    weather: "indoor",
  },

  // ── Bari in slaščičarne ────────────────────────────────────────────────
  {
    id: "kavarna-zvezda",
    name: "Kavarna Zvezda",
    category: "bar",
    town: "Ljubljana",
    region: "osrednja",
    country: "SI",
    description: {
      sl: "Klasična ljubljanska slaščičarna s tortami in kavo v bližini Mestnega trga.",
      en: "A classic Ljubljana cake café with tortes and coffee near Town Square.",
      it: "Una classica pasticceria di Lubiana con torte e caffè vicino a Mestni trg.",
      de: "Ein klassisches Konditorei-Café in Laibach mit Torten und Kaffee nahe dem Stadtplatz.",
      fr: "Un café-pâtisserie classique de Ljubljana, avec tortes et café, près de la place de la Ville.",
      es: "Una pastelería clásica de Liubliana con tartas y café cerca de la plaza de la Ciudad.",
    },
    weather: "indoor",
    destinationSlug: "ljubljana",
  },
  {
    id: "cacao-ljubljana",
    name: "Cacao",
    category: "bar",
    town: "Ljubljana",
    region: "osrednja",
    country: "SI",
    description: {
      sl: "Poznata slaščičarna ob Ljubljanici — najbolj poznana po domačih sladoledih poleti.",
      en: "A well-known dessert café by the Ljubljanica — best known for its house-made ice cream in summer.",
      it: "Una nota pasticceria lungo la Ljubljanica — famosa soprattutto per i gelati fatti in casa d'estate.",
      de: "Ein bekanntes Dessert-Café an der Ljubljanica — vor allem bekannt für hausgemachtes Eis im Sommer.",
      fr: "Un café de desserts réputé au bord de la Ljubljanica — surtout connu pour ses glaces maison en été.",
      es: "Un café de postres conocido a orillas del Ljubljanica — famoso sobre todo por sus helados caseros en verano.",
    },
    weather: "indoor",
    destinationSlug: "ljubljana",
  },

  // ── Aktivnosti ────────────────────────────────────────────────────────
  {
    id: "pustolovski-park-bled",
    name: "Pustolovski park Bled",
    category: "activity",
    town: "Bled",
    region: "gorenjska",
    country: "SI",
    description: {
      sl: "Vrvični pustolovski park nad Blejskim jezerom s sestopanjem ob Lipovcu — adrenalinski poligon v krošnjah.",
      en: "A rope adventure park above Lake Bled — tree-top courses ending with a descent towards Lipoca.",
      it: "Un parco avventura su alberi sopra il lago di Bled — percorsi adrenalinici tra le chiome, con discesa verso Lipoca.",
      de: "Ein Kletterwald hoch über dem Bleder See — Adrenalinparcours in den Baumkronen, mit Abstieg Richtung Lipoca.",
      fr: "Un parc d'aventures dans les arbres au-dessus du lac de Bled — parcours d'adrénaline dans les cimes, avec descente vers Lipoca.",
      es: "Un parque de aventuras en los árboles sobre el lago Bled — circuitos de adrenalina entre las copas, con descenso hacia Lipoca.",
    },
    weather: "outdoor",
    destinationSlug: "bled",
  },
  {
    id: "plena-bled",
    name: "Pletna Bled",
    category: "activity",
    town: "Bled",
    region: "gorenjska",
    country: "SI",
    description: {
      sl: "Vožnja s pletno — tradicionalnim čolnom z vesli — na Blejski otok, večstoletna obrt lokalnih pletnarjev.",
      en: "Rides in a pletna — the traditional oared flatboat — to Bled Island, a centuries-old local trade.",
      it: "Gite in pletna — la tradizionale barca a remi — verso l'isola di Bled, un mestiere locale secolare.",
      de: "Fahrten mit der Pletna — dem traditionellen Ruderboot — zur Insel im Bleder See, ein jahrhundertealtes lokales Handwerk.",
      fr: "Promenades en pletna — la barque à rames traditionnelle — vers l'île de Bled, un savoir-faire local séculaire.",
      es: "Paseos en pletna — la tradicional barca de remos — a la isla de Bled, un oficio local de siglos.",
    },
    weather: "outdoor",
    destinationSlug: "bled",
  },
  {
    id: "zicnica-vogel",
    name: "Žičnica Vogel",
    category: "activity",
    town: "Bohinj",
    region: "gorenjska",
    country: "SI",
    description: {
      sl: "Kabinska žičnica iz doline Zakraj na Vogel (1535 m) s čudovitim razgledom na Bohinj in Julijce.",
      en: "Gondola from the Zakraj valley to Mt Vogel (1535 m), opening gradually over Lake Bohinj and the Julian Alps.",
      it: "Funivia dalla valle di Zakraj al Vogel (1535 m), con una splendida vista sul lago di Bohinj e sulle Alpi Giulie.",
      de: "Gondelbahn vom Zakraj-Tal auf den Vogel (1535 m) mit wunderbarem Blick auf den Bohinjer See und die Julischen Alpen.",
      fr: "Télécabine depuis la vallée de Zakraj jusqu'au Vogel (1535 m), avec une vue splendide sur le lac de Bohinj et les Alpes juliennes.",
      es: "Teleférico desde el valle de Zakraj hasta el Vogel (1535 m), con una vista espléndida del lago Bohinj y los Alpes Julianos.",
    },
    weather: "outdoor",
    destinationSlug: "bohinj",
    featured: true,
  },
  {
    id: "3glav-adventures",
    name: "3glav adventures",
    category: "activity",
    town: "Bled",
    region: "gorenjska",
    country: "SI",
    description: {
      sl: "Lokalna agencija za aktivne izlete z Bleda in Bohinja — kajakaštvo, kanyoning in rafting na Soči.",
      en: "A local agency for active trips from Bled and Bohinj — kayaking, canyoning and rafting on the Soča.",
      it: "Un'agenzia locale per gite attive da Bled e Bohinj — kayak, canyoning e rafting sull'Isonzo.",
      de: "Eine lokale Agentur für aktive Ausflüge ab Bled und Bohinj — Kajak, Canyoning und Rafting auf der Soča.",
      fr: "Une agence locale pour sorties actives depuis Bled et Bohinj — kayak, canyoning et rafting sur la Soča.",
      es: "Una agencia local para excursiones activas desde Bled y Bohinj — kayak, canyoning y rafting en el Soča.",
    },
    weather: "outdoor",
    destinationSlug: "bled",
  },
  {
    id: "terme-rogaska",
    name: "Terme Rogaška",
    category: "activity",
    town: "Rogaška Slatina",
    region: "stajerska",
    country: "SI",
    description: {
      sl: "Zdraviliški kompleks s termalnimi bazeni v domovini svetovno znane mineralne vode Donat Mg.",
      en: "A spa resort with thermal pools in the home of the world-famous Donat Mg mineral water.",
      it: "Un complesso termale con piscine termali nella patria dell'acqua minerale Donat Mg, celebre in tutto il mondo.",
      de: "Ein Kurkomplex mit Thermalbecken in der Heimat des weltberühmten Mineralwassers Donat Mg.",
      fr: "Un complexe thermal avec bassins d'eaux thermales dans la patrie de l'eau minérale Donat Mg, mondialement connue.",
      es: "Un complejo termal con piscinas de aguas termales en la patria del agua mineral Donat Mg, famosa en todo el mundo.",
    },
    weather: "indoor",
    destinationSlug: "rogaska-slatina",
  },
  {
    id: "zipline-ucja",
    name: "Zipline park Učja",
    category: "activity",
    town: "Učja (nad Bovcem)",
    region: "gorenjska",
    country: "SI",
    description: {
      sl: "Eno največjih zip-line poligonov v Evropi — proge čez sotesko Učje v okolici Bovca in Kobarida.",
      en: "One of Europe's largest zip-line parks — lines flying across the Učja gorge near Bovec and Kobarid.",
      it: "Uno dei più grandi parchi zip-line d'Europa — funi che sorvolano la gola dell'Učja nei dintorni di Plezzo e Caporetto.",
      de: "Einer der größten Zip-Line-Parks Europas — Seilrutschen quer über die Učja-Schlucht bei Bovec und Kobarid.",
      fr: "L'un des plus grands parcs de tyroliennes d'Europe — lignes survolant les gorges de l'Učja près de Bovec et Kobarid.",
      es: "Uno de los mayores parques de tirolinas de Europa — tirolinas que sobrevuelan el desfiladero del Učja cerca de Bovec y Kobarid.",
    },
    weather: "outdoor",
  },

  // ── Trgovine ──────────────────────────────────────────────────────────
  {
    id: "piranske-soline",
    name: "Piranske soline",
    category: "shop",
    town: "Portorož",
    region: "primorska",
    country: "SI",
    description: {
      sl: "Sol iz Sečoveljskih solin — prva slovenska sol s statusom POIS — in solni izdelki z obale.",
      en: "Salt from the Sečovlje salt pans — Slovenia's first salt with protected geographical status — and salt products.",
      it: "Sale dalle saline di Sicciole — il primo sale sloveno con riconoscimento geografico protetto — e prodotti del sale dalla costa.",
      de: "Salz aus den Salinen von Sečovlje — das erste slowenische Salz mit geschützter geografischer Angabe — und Salzprodukte von der Küste.",
      fr: "Sel des salines de Sečovlje — le premier sel slovène à bénéficier d'une protection géographique — et produits salins du littoral.",
      es: "Sal de las salinas de Sečovlje — la primera sal eslovena con protección geográfica — y productos de sal de la costa.",
    },
    weather: "indoor",
    destinationSlug: "portoroz",
  },
  {
    id: "osrednja-trznica-ljubljana",
    name: "Osrednja ljubljanska tržnica",
    category: "shop",
    town: "Ljubljana",
    region: "osrednja",
    country: "SI",
    description: {
      sl: "Plečnikova tržnica ob Ljubljanici — stojnice z zelenjavo, sadjem in kranjskimi klobasami ter petkova ulica Open Kitchen.",
      en: "Plečnik's market colonnade by the Ljubljanica — stalls of produce and sausages, plus Open Kitchen street food on weekends.",
      it: "Il mercato di Plečnik sulla Ljubljanica — banchi di frutta, verdura e salsicce di Carniola, più lo street food di Open Kitchen nel weekend.",
      de: "Plečniks Markthallen an der Ljubljanica — Stände mit Obst, Gemüse und Krainer Würsten, dazu Open-Kitchen-Streetfood am Wochenende.",
      fr: "La halle du marché de Plečnik au bord de la Ljubljanica — étals de fruits, légumes et saucisses de Carniole, plus le street food d'Open Kitchen le week-end.",
      es: "El mercado de Plečnik junto al Ljubljanica — puestos de fruta, verdura y salchichas de Carniola, más el street food de Open Kitchen los fines de semana.",
    },
    weather: "outdoor",
    destinationSlug: "ljubljana",
  },

  // ── Transport ─────────────────────────────────────────────────────────
  {
    id: "avtobusna-postaja-ljubljana",
    name: "Avtobusna postaja Ljubljana",
    category: "transport",
    town: "Ljubljana",
    region: "osrednja",
    country: "SI",
    description: {
      sl: "Glavna avtobusna postaja ob železniški — izhodišče medkrajevnih avtobusov proti Bledu, Primorski in celinski Hrvaški.",
      en: "The main bus station by the railway — hub for coaches towards Bled, the coast and inland Croatia.",
      it: "La stazione degli autobus principale accanto alla ferrovia — punto di partenza dei pullman per Bled, il Litorale e la Croazia interna.",
      de: "Der zentrale Busbahnhof neben dem Bahnhof — Ausgangspunkt für Überlandbusse Richtung Bled, Küstenland und Binnenkroatien.",
      fr: "La principale gare routière, à côté de la gare ferroviaire — point de départ des cars vers Bled, le littoral et la Croatie intérieure.",
      es: "La estación principal de autobuses junto a la de tren — punto de partida de autocares hacia Bled, el litoral y la Croacia interior.",
    },
    weather: "indoor",
    destinationSlug: "ljubljana",
  },
  {
    id: "bicikelj",
    name: "BicikeLJ",
    category: "transport",
    town: "Ljubljana",
    region: "osrednja",
    country: "SI",
    description: {
      sl: "Mestna izposoja koles z obračunom po vožnji — dolga leta je Ljubljana ena najbolj kolesarjem prijaznih prestolnic.",
      en: "The city bike-share system — Ljubljana has long ranked among Europe's most cycle-friendly capitals.",
      it: "Il bike sharing cittadino con pagamento a corsa — Lubiana è da anni una delle capitali europee più accoglienti per i ciclisti.",
      de: "Das städtische Leihradsystem mit Abrechnung pro Fahrt — Laibach zählt seit Jahren zu den fahrradfreundlichsten Hauptstädten Europas.",
      fr: "Le système de vélos en libre-service de la ville, facturé au trajet — Ljubljana compte depuis longtemps parmi les capitales européennes les plus favorables au vélo.",
      es: "El sistema municipal de préstamo de bicicletas con pago por trayecto — Liubliana lleva años entre las capitales europeas más amigables con los ciclistas.",
    },
    weather: "outdoor",
    destinationSlug: "ljubljana",
  },
];

/** Poišči lokal po ID-ju; undefined, če ne obstaja. */
export function getLokal(id: string): Lokal | undefined {
  return LOKALI.find((x) => x.id === id);
}

/** Kategorije, ki dejansko nastopajo v naboru (kanonska vrstni red slovarja). */
export function activeLokalCategories(): LokalCategory[] {
  const present = new Set(LOKALI.map((x) => x.category));
  return (Object.keys(LOKAL_CATEGORIES) as LokalCategory[]).filter((c) =>
    present.has(c)
  );
}

/** Regije, ki dejansko nastopajo v naboru. */
export function activeLokalRegions(): string[] {
  return [...new Set(LOKALI.map((x) => x.region))];
}

// ── iskanje za svetovalca (QA U3, 2026-10-11) ───────────────────────────

/** Parametri iskanja lokalov za destinacijo/kraj/regijo. */
export interface LokaliSearchQuery {
  /** Kanonski slug destinacije (najsibkejša veza: lokal.destinationSlug). */
  destinationSlug?: string;
  /** Ime kraja (npr. ime destinacije iz registra — primerjava po imenih). */
  town?: string;
  /** Ključ regije iz REGIONS (šibkejša veza — isti konec dežele). */
  region?: string;
  /** Prednostni vrstni red kategorij (npr. hrana: restaurant, bar, hotel). */
  categoryOrder?: readonly LokalCategory[];
  /** Beli seznam kategorij (če je podan, druge izpade — npr. samo jesti). */
  categories?: readonly LokalCategory[];
  /** Največ zadetkov (privzeto 3 — enako meji svetovalca). */
  limit?: number;
}

/** Normaliziran niz za primerjavo (male črke, brez diakritik, brez ločil). */
function lokalNorm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/**
 * Deterministično iskanje lokalov za kontekst svetovalca (QA U3):
 *  · stopnja 2 — lokal je POVEZAN na destinacijo (destinationSlug) ali
 *    stoji v ISTEM KRAJU (primerjava imena kraja po normalizaciji);
 *  · stopnja 1 — lokal je v ISTI REGIJI (če je regija podana);
 *  · stopnja 0 — brez veze → IZPUSTI (nikoli ne ugibamo).
 * Razvrščanje: stopnja ↓ → prednostna kategorija (categoryOrder) ↑ →
 * izpostavljeni (featured) ↓ → ime abecedno (slowenska abeceda) — čisto
 * deterministično, isti vhod vedno da isti seznam.
 * ZAPISI imajo iskreno BREZ koordinat (glej LOKALI_HONESTY_NOTE) — zato
 * bližino merimo po kraju/regiji/vezavi na destinacijo, ne po km.
 */
export function searchLokaliFor(query: LokaliSearchQuery): Lokal[] {
  const limit = query.limit ?? 3;
  const catRank = new Map<string, number>(
    (query.categoryOrder ?? []).map((c, i) => [c, i])
  );
  const townNorm = query.town ? lokalNorm(query.town) : null;

  const scored: { lokal: Lokal; tier: number }[] = [];
  for (const lokal of LOKALI) {
    if (query.categories && !query.categories.includes(lokal.category)) continue;
    let tier = 0;
    if (
      (query.destinationSlug && lokal.destinationSlug === query.destinationSlug) ||
      (townNorm && lokalNorm(lokal.town).includes(townNorm))
    ) {
      tier = 2;
    } else if (query.region && lokal.region === query.region) {
      tier = 1;
    }
    if (tier === 0) continue;
    scored.push({ lokal, tier });
  }

  return scored
    .sort((a, b) => {
      if (a.tier !== b.tier) return b.tier - a.tier;
      const ca = catRank.get(a.lokal.category) ?? catRank.size;
      const cb = catRank.get(b.lokal.category) ?? catRank.size;
      if (ca !== cb) return ca - cb;
      const fa = a.lokal.featured ? 0 : 1;
      const fb = b.lokal.featured ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return a.lokal.name.localeCompare(b.lokal.name, "sl");
    })
    .slice(0, limit)
    .map((s) => s.lokal);
}
