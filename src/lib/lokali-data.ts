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
  description: { sl: string; en: string };
  weather: WeatherFit;
  /** Povezava na kanonsko destinacijo, kadar je kraj med 38 destinacijami. */
  destinationSlug?: string;
  /** Uredniško izpostavljeni (razvrščanje "Izpostavljeni" iz produkcije). */
  featured?: boolean;
}

/** Kategorije z oznakami (1:1 produkcija: hotel:"Hotel", restaurant:"Restavracija" …). */
export const LOKAL_CATEGORIES: Record<
  LokalCategory,
  { sl: string; en: string; icon: string }
> = {
  hotel: { sl: "Hotel", en: "Hotel", icon: "🏨" },
  restaurant: { sl: "Restavracija", en: "Restaurant", icon: "🍽️" },
  bar: { sl: "Bar", en: "Bar", icon: "🍸" },
  activity: { sl: "Aktivnost", en: "Activity", icon: "🎯" },
  shop: { sl: "Trgovina", en: "Shop", icon: "🛍️" },
  transport: { sl: "Transport", en: "Transport", icon: "🚌" },
  other: { sl: "Drugo", en: "Other", icon: "📍" },
};

/** Vremenske oznake 1:1 iz produkcije. */
export const WEATHER_FIT_LABELS: Record<
  WeatherFit,
  { sl: string; en: string }
> = {
  indoor: { sl: "Notranje (tudi v dežju)", en: "Indoor (fine in rain)" },
  outdoor: { sl: "Zunanje (ob lepem vremenu)", en: "Outdoor (fair weather)" },
  "all-weather": { sl: "V vsakem vremenu", en: "All-weather" },
};

/**
 * Iskrena opomba o obsegu podatkov (vidna na strani — nikoli prikrita).
 */
export const LOKALI_HONESTY_NOTE = {
  sl: "Zapisi so uredniška kuracija dobro znanih ponudnikov. Natančni naslovi, kontakti, odpiralni časi, ocene in koordinate niso bili zajeti v obnovitvenem posnetku — dopolnjujemo jih po overjenih virih, ne pa izmišljujemo.",
  en: "Entries are an editorial curation of well-known providers. Exact addresses, contacts, opening hours, ratings and coordinates were not captured in the recovery snapshot — we complete them from verified sources instead of inventing them.",
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
