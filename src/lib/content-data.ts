/**
 * CONTENT-DATA — vsebinski kanon strani 45-b (vodici, dogodki, doživetja …).
 *
 * Vir resnice: statični posnetek produkcije i-feel-slovenia 1.190.0
 * (production-mirror: vodici, dogodki, dozivetja, primerjava,
 * slovenia-pass, prijava, owner/prijava, destinacija/*) in njen rss.xml
 * (212 itemov: 38× things-to-do + 38×4 vodniki po temi + 22 vodnikov).
 * Slovenska vsebina je kanon; angleščina je prekrivni slovar UI
 * (vsebina ostaja SL z oznako — isti kanon kot destinacije).
 *
 * NE DODVAJAJ IZMIŠLJENIH PODATKOV — manjkajoči podatek preprosto ni
 * zapisan (iskrenostni kanon izvirnika).
 */

import type { CountryCode, Destination } from "./slovenia-data";

// ============================================================================
// DOGODKI — 31 dogodkov (30 iz produkcije + 1 razdvojen zapis P0 2. serije 2.44.0)
// ============================================================================

export type EventCategory =
  | "glasba"
  | "sport"
  | "tradicija"
  | "hrana"
  | "kultura"
  | "festival";

export const EVENT_CATEGORIES: Record<
  EventCategory,
  { sl: string; en: string; it: string; de: string; fr: string; es: string; icon: "music" | "trophy" | "sparkles" | "utensils" | "landmark" | "tent" }
> = {
  glasba: { sl: "Glasba", en: "Music", it: "Musica", de: "Musik", fr: "Musique", es: "Música", icon: "music" },
  sport: { sl: "Šport", en: "Sport", it: "Sport", de: "Sport", fr: "Sport", es: "Deporte", icon: "trophy" },
  tradicija: { sl: "Tradicija", en: "Tradition", it: "Tradizione", de: "Tradition", fr: "Tradition", es: "Tradición", icon: "sparkles" },
  hrana: { sl: "Hrana & pijača", en: "Food & drink", it: "Cibo e bevande", de: "Essen & Trinken", fr: "Gastronomie et boissons", es: "Comida y bebida", icon: "utensils" },
  kultura: { sl: "Kultura", en: "Culture", it: "Cultura", de: "Kultur", fr: "Culture", es: "Cultura", icon: "landmark" },
  festival: { sl: "Festival", en: "Festival", it: "Festival", de: "Festival", fr: "Festival", es: "Festival", icon: "tent" },
};

export type EventPrice = "free" | "euro" | "euro2";

export const EVENT_PRICE_LABEL: Record<EventPrice, { sl: string; en: string; it: string; de: string; fr: string; es: string }> = {
  free: { sl: "Brezplačno", en: "Free", it: "Gratuito", de: "Kostenlos", fr: "Gratuit", es: "Gratis" },
  euro: { sl: "€", en: "€", it: "€", de: "€", fr: "€", es: "€" },
  euro2: { sl: "€€", en: "€€", it: "€€", de: "€€", fr: "€€", es: "€€" },
};

export const EVENT_MONTHS: { index: number; sl: string; en: string; it: string; de: string; fr: string; es: string }[] = [
  { index: 1, sl: "Januar", en: "January", it: "Gennaio", de: "Januar", fr: "Janvier", es: "Enero" },
  { index: 2, sl: "Februar", en: "February", it: "Febbraio", de: "Februar", fr: "Février", es: "Febrero" },
  { index: 3, sl: "Marec", en: "March", it: "Marzo", de: "März", fr: "Mars", es: "Marzo" },
  { index: 4, sl: "April", en: "April", it: "Aprile", de: "April", fr: "Avril", es: "Abril" },
  { index: 5, sl: "Maj", en: "May", it: "Maggio", de: "Mai", fr: "Mai", es: "Mayo" },
  { index: 6, sl: "Junij", en: "June", it: "Giugno", de: "Juni", fr: "Juin", es: "Junio" },
  { index: 7, sl: "Julij", en: "July", it: "Luglio", de: "Juli", fr: "Juillet", es: "Julio" },
  { index: 8, sl: "Avgust", en: "August", it: "Agosto", de: "August", fr: "Août", es: "Agosto" },
  { index: 9, sl: "September", en: "September", it: "Settembre", de: "September", fr: "Septembre", es: "Septiembre" },
  { index: 10, sl: "Oktober", en: "October", it: "Ottobre", de: "Oktober", fr: "Octobre", es: "Octubre" },
  { index: 11, sl: "November", en: "November", it: "Novembre", de: "November", fr: "Novembre", es: "Noviembre" },
  { index: 12, sl: "December", en: "December", it: "Dicembre", de: "Dezember", fr: "Décembre", es: "Diciembre" },
];

export interface CommunityEvent {
  /** Kratek ID (dodajanje v moje pot: kind "event"). id se NE spreminja —
   *  obstoječa shranjena potovanja se referencirajo nanj (dogodek/{id}). */
  id: string;
  monthIndex: number;
  category: EventCategory;
  title: string;
  /** ISO datum začetka (prvi dan) — iz <time dateTime> v produkciji.
   *  QA #34/#38: PRAZEN niz, kadar je `dateUnconfirmed` — izmišljenega
   *  datuma nikoli ne zapisujemo (iskrenostni kanon). */
  dateStart: string;
  /** ISO datum konca (zadnji dan) za VEČDNEVNE dogodke s preverjenim
   *  razponom (2.48.0, #38 „pretekle dogodke jasno prikaži“). Izpolnjen
   *  IZKLJUČNO iz preverjene `dateLabel` range vrednosti pri primarnem
   *  viru; za enodnevne dogodke ostane neizpolnjen (= dateStart).
   *  Uporablja ga isEventPast (zaključek dogodka). */
  dateEnd?: string;
  /** Prirojen prikaz datuma, kot v produkciji (npr. „8. – 18. feb 2027").
   *  Pri `dateUnconfirmed` = pošten napis „datum še ni potrjen“. */
  dateLabel: string;
  venue: string;
  price: EventPrice;
  featured: boolean;
  /** Uradna spletna stran dogodka (zunanja; samo kjer jo produkcija navaja).
   *  QA #34/#38: mrtve domene so odstranjene (preverjeno z dostopnostjo). */
  website?: string;
  image: string;
  description: string;
  /** Destinacija iz nabora 74, na katero se dogodek navezuje (neobvezno). */
  destSlug?: string;
  /** QA P0 (#34→#38): datum ZA CIKLOV LETO še ni uradno objavljen — UI prikaže
   *  „datum še ni potrjen“ namesto izmišljenega datuma. monthIndex ostane
   *  kot PRIČAKOVANO okno po dokumentirani zgodovini organizatorja. */
  dateUnconfirmed?: boolean;
  /** Primarni vir (organizator), ki ga je zadnja verifikacija dejansko brala. */
  source?: string;
  /** Datum zadnje verifikacije pri primarnem viru (ISO). */
  verifiedAt?: string;
  /** Država dogodka (#41 Faza 0, 2.54.0). Opcijsko za združljivost s
   *  kanonom #38: obstoječih 31 zapisov ostane NEPOPREMLJENIH —
   *  manjkajoča vrednost pomeni "SI" (pomožnik eventCountry). Novi
   *  balkanski dogodki (F2) polje zapišejo izrecno. */
  country?: CountryCode;
}

/**
 * Država dogodka — enoten dostop z defaultom "SI" (#41 F0).
 * Sprejemljivost: obstoječi registri so implicitno slovenski; helper je
 * edino branje polja v UI/testih, da default ostane na enem mestu.
 */
export function eventCountry(e: Pick<CommunityEvent, "country">): CountryCode {
  return e.country ?? "SI";
}

export const EVENTS: CommunityEvent[] = [
  {
    id: "ljubljanski-zimski-festival",
    monthIndex: 2,
    category: "glasba",
    title: "Ljubljanski zimski festival",
    // SDK verifikacijska serija (2026-10-13): 10. Zimski festival Ljubljana
    // je v FEBRUARJU 2027 — prvi potrjeni termin 15. 2. 2027, 19.30, Cankarjev
    // dom (Eventim, uradna prodaja: Simfonični orkester RTV Slovenija;
    // neodvisno glasbenamatica.si: „10. zimski Festival Ljubljana … 15. februar
    // 2027“). Izmišljeni „15. – 26. jan 2027“ (odstranjen 2.44.0) se ne vrača —
    // zapisuje se izključno potrjeni termin; mesec popravljen jan → feb.
    dateStart: "2027-02-15",
    dateLabel: "od 15. feb 2027",
    venue: "Cankarjev dom, Ljubljana",
    price: "euro2",
    featured: false,
    website: "https://www.ljubljanafestival.si",
    image: "/content/ljubljanski-zimski-festival.jpg",
    description:
      "Vrhunski mednarodni glasbeni festival z diskografijami klasične in komorne glasbe v Cankarjevem domu, operi in ljubljanskih cerkvah. Tradicija, ki sega v leto 1952.",
    destSlug: "ljubljana",
    source: "https://www.eventim.si/en/event/zimski-festival-simfonicni-orkester-rtv-slovenija-cankarjev-dom-2218",
    verifiedAt: "2026-10-13",
  },
  {
    id: "zlati-lisjak-smucanje",
    monthIndex: 1,
    category: "sport",
    title: "Zlata lisica — svetovni pokal v alpskem smučanju za ženske",
    // QA #34→#38 (1. serija 2026-10-12): izmišljeni „18. – 19. jan 2027“
    // odstranjen, zapis neosten. QA 3. serija (POTRJENO 2026-10-13,
    // sloski.si — uradni koledar SP 2026/27): uradno ime je „ZLATA LISICA“
    // (NE „Zlati lisjak“), FIS svetovni pokal v alpskem smučanju za ženske,
    // 29. – 30. 1. 2027; lokacija Podkoren/Kranjska Gora (povezava viru →
    // kranjskagora-worldcup.si, domena dosegljiva) — Zlata lisica je na
    // Mariborskem Pohorju potekala do 2019, od 2020 v Podkorenu.
    // destSlug „maribor“ odstranjen (lokacija ni več Maribor; Kranjska Gora
    // ni (več) med dest., opomba kaže na zgodovinski sklop registra). Zgodovinska fotografija dirke; slika s
    // Podkorena sledi ob prekinitvi SDK kvote (image gen je bil 429).
    dateStart: "2027-01-29",
    dateEnd: "2027-01-30",
    dateLabel: "29. – 30. jan 2027",
    venue: "Podkoren, Kranjska Gora",
    price: "euro",
    featured: false,
    // zlati-lisjak.si NE OBSTAJA (domena nedosegljiva, preverjeno 2026-10-12);
    // uradna stran dirke kranjskagora-worldcup.si (dosegljiva 2026-10-13).
    website: "https://kranjskagora-worldcup.si",
    image: "/content/zlata-lisica-golden-fox.jpg",
    description:
      "Zlata lisica (Golden Fox) — tradicionalna dirka svetovnega pokala v alpskem smučanju za ženske. Najboljše smučarke sveta se pomerijo na Podkorenu nad Kranjsko Goro; legendarno tekmovanje, ki ga je do 2019 gostil Maribor, se vrnilo v Zgornjesavsko dolino.",
    source: "https://www.sloski.si",
    verifiedAt: "2026-10-13",
  },
  {
    id: "blejski-zimski-plavalni-memorial",
    monthIndex: 1,
    category: "sport",
    title: "Blejski zimski plavalni memorial",
    dateStart: "2027-01-25",
    dateLabel: "25. jan 2027",
    venue: "Kopališče Bled, Bled",
    price: "free",
    featured: false,
    website: "https://www.bled.si",
    image: "/content/bled-winter-swim.jpg",
    description:
      "Tradicionalni zimski plavalni memorial na Blejskem jezeru. Najbolj drzni plavalci skočijo v ledeno vodo jezera v februarskih jutrih. Družinski dogodek z vročo čokolado in kremšnito ob obali.",
    destSlug: "bled",
  },
  {
    id: "kurentovanje-ptuj",
    monthIndex: 2,
    category: "tradicija",
    title: "Kurentovanje — Pustni karneval Ptuj",
    // QA #34→#38 (POTRJENO 2026-10-12, kurentovanje.net: „3.-9. februar 2027“).
    dateStart: "2027-02-03",
    dateLabel: "3. – 9. feb 2027",
    venue: "Stari mestni trg, Ptuj",
    price: "free",
    featured: true,
    website: "https://www.kurentovanje.net",
    image: "/content/pustni-karneval-ptuj.jpg",
    description:
      "Največji pustni karneval v Sloveniji in eden najpomembnejših etnografskih festivalov v Evropi. Povorka kurentov — starodavnih bitij z rdečimi jeziki in kravjimi zvonci — preganja zimo skozi stare ulice Ptuja.",
    destSlug: "ptuj",
    source: "https://www.kurentovanje.net",
    verifiedAt: "2026-10-12",
  },
  {
    id: "smucarski-dnevi-ribnica-pohorje",
    monthIndex: 2,
    category: "sport",
    title: "Smučarski dnevi Ribnica na Pohorju",
    dateStart: "2027-02-15",
    dateLabel: "15. – 16. feb 2027",
    venue: "Smučišče Ribnica na Pohorju",
    price: "euro",
    featured: false,
    image: "/content/koroska-smucanje.jpg",
    description:
      "Tradicionalni smučarski dogodek na Ribniškem Pohorju z glasbenim programom in lokalnimi specialitetami. Družinski dan na snegu.",
    destSlug: "dravograd",
  },
  {
    // QA #34→#38 (verifikacija 2026-10-12, vinska-vigred.si): dogodek je v
    // METLIKI v Beli krajini (44. izdaja: 15.–17. maj 2026), NE v Mariboru in
    // ne v marcu — lokacija, mesec in povezava popravljeni po primarnem viru.
    // id ostane (shranjena potovanja se referencirajo nanj).
    id: "vinska-vigred-maribor",
    monthIndex: 5,
    category: "hrana",
    title: "Vinska vigred — največji vinski festival",
    dateStart: "",
    dateLabel: "datum še ni potrjen",
    venue: "Metlika, Bela krajina",
    price: "euro",
    featured: true,
    website: "https://www.vinska-vigred.si",
    image: "/content/vinska-vigred-maribor.jpg",
    description:
      "Največji vinski festival v Sloveniji v Metliki v Beli krajini — trije dnevi vina, tradicije in glasbe. Vinski plac na Mestnem trgu s pokušinami metliške črnine, izbor najboljše belokranjske pogače in svečana izbira kraljice metliške črnine.",
    destSlug: "crnomelj",
    dateUnconfirmed: true,
    source: "https://www.vinska-vigred.si",
    verifiedAt: "2026-10-12",
  },
  {
    id: "planica-nordic-festival",
    monthIndex: 3,
    category: "sport",
    // QA #34→#38 (1. serija 2026-10-12): izmišljeni „21. – 23. mar 2027“
    // odstranjen. QA 3. serija (POTRJENO 2026-10-13, planica.si):
    // „Program 2027 — Planica bo med 18. in 21. marcem 2027“; FIS finale
    // SP v smučarskih skokih, četrtek 18. 3. kvalifikacije → nedelja 21. 3.
    // finalna tekma; vstopnice v prodaji od 7. 10. 2026. Neodvisna
    // potrditev tudi na sloski.si („Planica 18. – 21. 3. 2027“).
    title: "Planica — FIS finale svetovnega pokala",
    dateStart: "2027-03-18",
    dateEnd: "2027-03-21",
    dateLabel: "18. – 21. mar 2027",
    venue: "Planica, Kranjska Gora",
    price: "euro2",
    featured: true,
    website: "https://www.planica.si",
    image: "/content/planica-nordic-festival.jpg",
    description:
      "FIS finale svetovnega pokala v smučarskih poletih v slavni Planici pod Poncami. Najboljši skakalci sveta letijo preko 240 metrov na največji skakalnici na svetu, ob strani pa tekmovanja v nordijskem teku in biatlonu.",
    source: "https://www.planica.si",
    verifiedAt: "2026-10-13",
  },
  {
    id: "blejski-danovski-festival",
    monthIndex: 4,
    category: "glasba",
    title: "Blejski danovski festival",
    // QA #34→#38 (verifikacija 2026-10-12): festivalblejskihdni.si NE OBSTAJA
    // (domena nedosegljiva) — mrtva povezava odstranjena; termin za 2027 ni
    // nikjer uradno objavljen — izmišljeni „10. – 13. apr 2027“ odstranjen.
    // P0 3. serija (2026-10-13): ime prireditve NI sledljivo nigdej —
    // nacionalni register dogodkov (e-občina /DobiDogodke) za „blejski“ in
    // „danovski“ vrne 0 zadetkov; RSS bled.si (1554 novic, prebrano) ne
    // omenja „danovskega festivala“ niti komornega glasbenega festivala na
    // Bledu; koledar prireditev na bled.si domači strani ga tudi ne pozna
    // (realni Bled dogodki: Narodnozabavna hit parada, triatlon, šah).
    // Zapis ostane po kanonu ④b („ne brišemo brez razloga“), a BREZ vira,
    // datuma in povezave, dokler ni kaj potrditi.
    dateStart: "",
    dateLabel: "datum še ni potrjen",
    venue: "Blejski grad, Bled",
    price: "euro2",
    featured: false,
    image: "/content/blejski-danovski-festival.jpg",
    description:
      "Mednarodni komorni glasbeni festival na Bledu z vrhunskimi koncerti v Blejskem gradu, na blejskem otoku in v cerkvah. Slovenski glasbeniki skupaj z mednarodnimi gosti v romantični alpski kulisi.",
    destSlug: "bled",
    dateUnconfirmed: true,
  },
  {
    // QA #34→#38 (verifikacija 2026-10-12, jurjevanje.si): 62. Jurjevanje je
    // bilo 22.–28. JUNIJ 2026 na „Jurjevanjski Draga in Črnomelj“ — mesec
    // popravljen (april → junij), lokacija po uradnem viru; termin za 2027
    // še ni objavljen — izmišljeni „22. – 23. apr 2027“ odstranjen.
    id: "jurjevanje-bela-krajina",
    monthIndex: 6,
    category: "tradicija",
    title: "Jurjevanje v Beli krajini",
    dateStart: "",
    dateLabel: "datum še ni potrjen",
    venue: "Draga in Črnomelj, Bela krajina",
    price: "free",
    featured: false,
    website: "https://www.jurjevanje.si",
    image: "/content/jurjevanje-bela-krajina.jpg",
    description:
      "Najstarejši folklorni festival v Sloveniji, ki praznuje pomlad in belokranjsko tradicijo. Povorka pisanic, tradicionalni plesi v belokranjskih nošah in glasba steljnikov v Črnomlju.",
    destSlug: "crnomelj",
    dateUnconfirmed: true,
    source: "https://www.jurjevanje.si",
    verifiedAt: "2026-10-12",
  },
  {
    id: "festival-soca",
    monthIndex: 7,
    category: "glasba",
    title: "Tolminator — metal festival na sotočju Soče in Tolminke",
    // P0 3. serija (verifikacija 2026-10-13): zapis „Festival Soča“ NI
    // sledljiv — festivalsoca.si NE OBSTAJA (že 2026-10-12), nacionalni
    // register dogodkov (e-občina /DobiDogodke) za ključne besede
    // „Soča“/„Soca“/„Tolminator“ vrne 0 zadetkov. Edini AKTIVNI glasbeni
    // festival na Soči v Tolminu je Tolminator (od 2023, naslednik
    // MetalDays 2004–2022 na ISTEM prizorišču sotočja) — korekcija na
    // realni dogodek po vzorcu celjski-sejem → POMP. Vir: Wikipedia
    // MetalDays (dejansko prebrana): „Since 2023 a new festival called
    // Tolminator has been held in Tolmin. The location is the same …“;
    // seznam metal festivalov: „Tolminator | Tolmin | 2023–present | July“.
    // Termin 2027 NI objavljen; stran organizatorja (tolminator.si) je iz
    // peskovnika nedosegljiva — povezave NE izmišljujemo (kanon ①d).
    // Zgodovinski kontekst: opis zapisa (reggae/alternative) je ustrezal
    // ugasnjenemu Soča Reggae Riversplashu (2000-ih), ne obstoječi
    // prireditvi — izmišljeni „23. – 25. maj 2027“ je bil odstranjen že
    // 2026-10-12.
    dateStart: "",
    dateLabel: "datum še ni potrjen",
    venue: "Sotočje Soče in Tolminke, Tolmin",
    price: "euro2",
    featured: false,
    image: "/content/festival-soca.jpg",
    description:
      "Največji metal festival na Slovenskem se od 2023 goduje na sotočju Soče in Tolminke, na prizorišču, kjer je več kot dve desetletji potekal MetalDays. Trije dnevi na obrežjih smaragdne reke z brezkončnim kampom in festivalskimi plažami.",
    destSlug: "reka-soca",
    dateUnconfirmed: true,
    source: "https://en.wikipedia.org/wiki/MetalDays",
    verifiedAt: "2026-10-13",
  },
  {
    id: "ljubljanski-maraton",
    monthIndex: 10,
    category: "sport",
    title: "Ljubljanski maraton",
    // QA #34→#38 (POTRJENO 2026-10-12, ljubljanamarathon.si): „NLB 30th
    // Ljubljana Marathon — Saturday 17th and Sunday 18th October 2026“ —
    // izmišljeni „25. maj 2027“ popravljen na uradne datume (oktober, ne maj).
    dateStart: "2026-10-17",
    dateLabel: "17. – 18. okt 2026",
    venue: "Slovenska cesta, Ljubljana",
    price: "euro2",
    featured: true,
    website: "https://ljubljanamarathon.si",
    image: "/content/ljubljanski-maraton.jpg",
    description:
      "Mednarodni maraton v Ljubljani z razdaljami 10 km, pol maratona in maratona. Tisoči tekačev iz vse Evrope tečejo skozi staro mestno jedro, ob Ljubljanici in po Tivoliju.",
    destSlug: "ljubljana",
    source: "https://ljubljanamarathon.si",
    verifiedAt: "2026-10-12",
  },
  {
    id: "bled-days-kremsnita",
    monthIndex: 6,
    category: "hrana",
    title: "Bled Days with Kremšnita",
    dateStart: "2027-06-13",
    dateLabel: "13. – 15. jun 2027",
    venue: "Obala Blejskega jezera, Bled",
    price: "free",
    featured: true,
    website: "https://www.bled.si",
    image: "/content/bled-days-kremsnita.jpg",
    description:
      "Tradicionalno praznovanje blejske kremšnite — slavne smetanove torte z injem pokrovom. Degustacije slaščic, obrtna tržnica, veseli dogodki ob jezeru in veličasten ognjemet nad blejskim otokom.",
    destSlug: "bled",
  },
  {
    id: "pivo-in-cvetje-lasko",
    monthIndex: 6,
    category: "festival",
    title: "Pivo in cvetje Laško",
    // QA #34→#38 (verifikacija 2026-10-12, pivoincvetje.si): termini za 2027
    // še niso objavljeni — izmišljeni „13. – 15. jun 2027“ odstranjen;
    // mesec 6 = pričakovano junijsko okno po zgodovini festivala.
    dateStart: "",
    dateLabel: "datum še ni potrjen",
    venue: "Center, Laško",
    price: "euro",
    featured: true,
    website: "https://www.pivoincvetje.si",
    image: "/content/pivo-in-cvetje-lasko.jpg",
    description:
      "Največji festival piva in cvetja v Sloveniji v Laškem. Več kot 50.000 obiskovalcev, pivska tržnica, koncerti domačih in tujih izvajalcev, razstava cvetja in ognjemet.",
    dateUnconfirmed: true,
    source: "https://www.pivoincvetje.si",
    verifiedAt: "2026-10-12",
  },
  {
    id: "porabje-lendava",
    monthIndex: 6,
    category: "kultura",
    title: "Porabje — srečanje Slovencev v sosednjih državah",
    dateStart: "2027-06-14",
    dateLabel: "14. jun 2027",
    venue: "Trg mladosti, Lendava",
    price: "free",
    featured: false,
    image: "/content/prekmurje-porabje.jpg",
    description:
      "Kulturni festival v Lendavi ki povezuje Slovence iz Prekmurja, Porabja in sosednjih regij. Glasba, ples in tradicionalne jedi.",
    destSlug: "lendava",
  },
  {
    id: "festival-solinarstva-secovlje",
    monthIndex: 6,
    category: "hrana",
    title: "Festival solinarstva Sečovlje",
    dateStart: "2027-06-21",
    dateLabel: "21. jun 2027",
    venue: "Soline Sečovlje, Portorož",
    price: "euro",
    featured: false,
    website: "https://www.kpss.si",
    image: "/content/festival-solinarstva-secovlje.jpg",
    description:
      "Praznik solinarstva v solinah Sečovlje s predstavitvijo tradicionalnega pridelovanja soli, degustacijami solinskih izdelkov, morske hrane in domačih vin ob obali.",
    destSlug: "portoroz",
  },
  {
    id: "ljubljana-festival",
    monthIndex: 7,
    category: "glasba",
    title: "Ljubljana Festival",
    dateStart: "2027-07-01",
    dateLabel: "1. jul – 31. avg 2027",
    venue: "Križanke, Ljubljana",
    price: "euro2",
    featured: true,
    website: "https://www.ljubljanafestival.si",
    image: "/content/ljubljana-festival.jpg",
    description:
      "Največji, najstarejši in najpomembnejši poletni kulturni festival v Sloveniji. Vrhunski koncerti simfonične glasbe, opere, baleta in gledališča na Križankah in v Cankarjevem domu z najvidnejšimi svetovnimi imeni.",
    destSlug: "ljubljana",
  },
  {
    id: "piran-music-nights",
    monthIndex: 7,
    category: "glasba",
    title: "Piran Music Nights",
    dateStart: "2027-07-10",
    dateLabel: "10. jul – 20. avg 2027",
    venue: "Minoritski samostan, Piran",
    price: "euro",
    featured: false,
    website: "https://www.piran.si",
    image: "/content/piran-music-nights.jpg",
    description:
      "Romantični glasbeni večeri v križnem hodniku piranskega minoritskega samostana. Jazz, komorna glasba in etno koncerti z mednarodnimi gosti ob zgodnjih poletnih nočeh ob Jadranskem morju.",
    destSlug: "piran",
  },
  {
    id: "musica-cubicularis-slovenj-gradec",
    monthIndex: 7,
    category: "glasba",
    title: "Musica Cubicularis — Dvorana slovenskih glasbenikov",
    dateStart: "2027-07-10",
    dateLabel: "10. – 12. jul 2027",
    venue: "Dvorana slovenskih glasbenikov, Slovenj Gradec",
    price: "euro2",
    featured: false,
    image: "/content/koroska-music.jpg",
    description:
      "Komorni glasbeni festival v Slovenj Gradcu z nastopi slovenskih in mednarodnih glasbenikov v zgodovinskih ambientih.",
    destSlug: "slovenj-gradec",
  },
  {
    id: "trnfest-ljubljana",
    monthIndex: 8,
    category: "glasba",
    title: "Trnfest — poletni festival Trnovo",
    dateStart: "2027-08-04",
    dateLabel: "4. – 29. avg 2027",
    venue: "Trnovo, Ljubljana",
    price: "free",
    featured: false,
    website: "https://www.trnfest.si",
    image: "/content/trnfest-ljubljana.jpg",
    description:
      "Tradicionalni avgustovski festival v ljubljanski četrti Trnovo. Koncerti jazz, blues in world glasbe na prostem, ulično gledališče, ustvarjalne delavnice in večerni vrvež ob Trnavskem mostu.",
    destSlug: "ljubljana",
  },
  {
    id: "okarina-festival-bled",
    monthIndex: 8,
    category: "glasba",
    title: "Okarina festival Bled",
    dateStart: "2027-08-05",
    dateLabel: "5. – 12. avg 2027",
    venue: "Blejski grad in otok, Bled",
    price: "euro2",
    featured: true,
    website: "https://www.okarina.si",
    image: "/content/okarina-festival-bled.jpg",
    description:
      "Mednarodni etno-glasbeni festival na Bledu z glasbeniki iz vsega sveta. Koncerti na blejskem otoku, v gradu in ob jezeru. Slovenski in mednarodni izvajalci world glasbe.",
    destSlug: "bled",
  },
  {
    id: "kmecki-ohcet",
    monthIndex: 8,
    category: "tradicija",
    title: "Kmečki ohcet",
    dateStart: "2027-08-15",
    dateLabel: "15. avg 2027",
    venue: "Razne vasi v Sloveniji",
    price: "free",
    featured: false,
    image: "/content/kmecji-ohcet.jpg",
    description:
      "Tradicionalna prikazitev slovenske kmečke svadbe z bogatimi ljudskimi nošami, starinskimi plesi, živino in obrtmi. Avtentično praznovanje podeželskega življenja v vaseh po vsej Sloveniji.",
  },
  {
    id: "festival-cvicka-novo-mesto",
    monthIndex: 9,
    category: "hrana",
    title: "Festival cvička v Novem mestu",
    dateStart: "2027-09-13",
    dateLabel: "13. sep 2027",
    venue: "Glavni trg, Novo mesto",
    price: "euro",
    featured: false,
    image: "/content/dolenjska-cvicek.jpg",
    description:
      "Praznik tradicionalnega dolenjskega vina cviček. Vinske degustacije, kulinarične stojnice in glasba ob Krki.",
    destSlug: "novo-mesto",
  },
  {
    id: "festival-buckk-murska-sobota",
    monthIndex: 9,
    category: "hrana",
    title: "Festival bučk in bučnega olja",
    dateStart: "2027-09-20",
    dateLabel: "20. – 21. sep 2027",
    venue: "Center, Murska Sobota",
    price: "free",
    featured: false,
    image: "/content/prekmurje-bucka.jpg",
    description:
      "Edinstven festival v Prekmurju posvečen bučam in prekmurskemu bučnemu olju. Degustacije, delavnice in tradicionalna glasba.",
    destSlug: "murska-sobota",
  },
  {
    id: "olive-festival",
    monthIndex: 9,
    category: "hrana",
    title: "Olive Festival",
    dateStart: "2027-09-27",
    dateLabel: "27. sep 2027",
    venue: "Koper in Izola",
    price: "euro",
    featured: false,
    website: "https://www.slovenia.info",
    image: "/content/olive-festival.jpg",
    description:
      "Praznovanje oljčne trgatve v Slovenski Istri z degustacijami ekstra deviških oljčnih olj, domačimi istrskimi jedmi, medom, vinom in vodenimi ogledi oljčnikov ob morju.",
  },
  {
    id: "festival-stara-trta",
    monthIndex: 10,
    category: "tradicija",
    title: "Festival Stara trta",
    dateStart: "2026-10-03",
    dateEnd: "2026-10-12",
    dateLabel: "3. – 12. okt 2026",
    venue: "Lent, Maribor",
    price: "euro",
    featured: false,
    website: "https://www.stara-trta.si",
    image: "/content/festival-stara-trta.jpg",
    description:
      "Festival ob najstarejši trti na svetu v Mariboru — vpisani v Guinnessovo knjigo rekordov. Vinogradniški dogodki, degustacije modre frankinje, kulturni program in tradicionalno martinjanje ob Dravi.",
    destSlug: "maribor",
  },
  {
    id: "celjski-sejem",
    // ID OSTANE (stara shranjena potovanja se referencirajo nanj);
    // vsebina popravljena: „Celjski sejem 9.–12. 10. 2026“ NE OBSTAJA —
    // uradni jesenski sejem na prizorišču je POMP (10.–11. 10. 2026),
    // potrjeno na organizatorjevem seznamu sejmov (verifikacija 2026-10-13).
    monthIndex: 10,
    category: "kultura",
    title: "POMP — sejem pompoznih dogodkov",
    dateStart: "2026-10-10",
    dateEnd: "2026-10-11",
    dateLabel: "10. – 11. okt 2026",
    venue: "Celjski sejem, Celje",
    price: "euro",
    featured: false,
    website: "https://www.ce-sejem.si",
    image: "/content/celjski-sejem.jpg",
    description:
      "POMP je sejem za poroke in pompozne dogodke na Celjskem sejmu: poročne lokacije, gostinstvo, foto in video storitve, dekoracija ter ponudniki za vse vrste praznovanj.",
    destSlug: "celje",
    source: "https://www.ce-sejem.si/sejmi/",
    verifiedAt: "2026-10-13",
  },
  {
    id: "bela-krajina-koline",
    monthIndex: 11,
    category: "tradicija",
    title: "Bela krajina koline in opankarija",
    // P0 2. serija (2026-10-13): edicije 22. 11. 2026 NI bilo mogoče
    // potrditi pri nobenem primarnem viru (iskalnik občine Črnomelj in
    // nacionalni register dogodkov = 0 zadetkov) — pošteno nepotrjeno.
    dateStart: "",
    dateLabel: "datum še ni potrjen",
    dateUnconfirmed: true,
    venue: "Stari trg, Črnomelj",
    price: "euro2",
    featured: false,
    image: "/content/bela-krajina-koline.jpg",
    description:
      "Tradicionalne koline v Beli krajini z opankanjem (pletje koruznih venčkov) in lokalno glasbo. Avtentična belokranjska kultura.",
    destSlug: "crnomelj",
  },
  {
    // ID OSTANE (zgodovinski — zapis je obsegal dve mesti; P0 2. serija
    // je RAZDVOJENA: Ljubljana tu, Maribor kot ločen zapis spodaj).
    id: "bozicni-sejmi-ljubljana-maribor",
    monthIndex: 11,
    category: "tradicija",
    title: "December v Ljubljani — božični sejmi",
    // SDK verifikacijska serija (2026-10-13): uradna stran visitljubljana.com
    // objavlja začetek sezone 2026/27 — „Začetek prešernosti s prižigom lučk:
    // 27. 11. 2026“. Potrjen je IZKLJUČNO začetek (konec sezone brez uradnega
    // razpona → brez dateEnd po kanonu); sejmi na Prešernovem trgu in Bregu.
    dateStart: "2026-11-27",
    dateLabel: "od 27. nov 2026",
    venue: "Prešernov trg in Breg, Ljubljana",
    price: "free",
    featured: true,
    website: "https://www.visitljubljana.com/sl/obiskovalci/prireditve/prireditve-v-ljubljani/december-v-ljubljani",
    image: "/content/bozicni-sejmi.jpg",
    description:
      "Romantični božični sejmi s stojnicami z ročnimi izdelki, medenimi piškoti, kuhanim vinom in prešanim sokom. Srednjeveško staro mestno jedro Ljubljane zasveti z venci in dišečimi jelkami.",
    destSlug: "ljubljana",
    source: "https://www.visitljubljana.com/sl/obiskovalci/prireditve/prireditve-v-ljubljani/december-v-ljubljani",
    verifiedAt: "2026-10-13",
  },
  {
    // P0 2. serija (2026-10-13): NOV zapis po razdvojitvi — uradni brand
    // „Čarobni Maribor“ (visitmaribor.si); datumi za 2026 še neobjavljeni.
    id: "bozicni-sejmi-maribor",
    monthIndex: 11,
    category: "tradicija",
    title: "Čarobni Maribor — božični sejmi",
    dateStart: "",
    dateLabel: "datum še ni potrjen",
    dateUnconfirmed: true,
    venue: "Maribor",
    price: "free",
    featured: false,
    website: "https://www.visitmaribor.si",
    image: "/content/maribor.jpg",
    description:
      "Čarobni Maribor prinaša praznično vasico z božičnimi sejmi, kuhanim vinom in programom za otroke v starem mestnem jedru ob Dravi.",
    destSlug: "maribor",
  },
  {
    id: "bled-winter-magic",
    monthIndex: 12,
    category: "tradicija",
    // P0 2. serija (2026-10-13): uradni brand na bled.si je „Blejska
    // zimska pravljica“ (ne „Bled Winter Magic“); lokacija Jezerska
    // promenada; datumi za 2026 še neobjavljeni (program „od začetka
    // decembra do začetka januarja“).
    title: "Blejska zimska pravljica",
    dateStart: "",
    dateLabel: "datum še ni potrjen",
    dateUnconfirmed: true,
    venue: "Jezerska promenada, Bled",
    price: "free",
    featured: true,
    website: "https://www.bled.si/sl/prireditve/glavne-prireditve/blejska-zimska-pravljica/",
    image: "/content/bled-winter-magic.jpg",
    source: "https://www.bled.si/sl/prireditve/glavne-prireditve/blejska-zimska-pravljica/",
    verifiedAt: "2026-10-13",
    description:
      "Romantična božična vasica ob Blejskem jezeru z lesenimi hišicami, ročnimi izdelki, medenimi piškoti, kuhanim vinom in prešanim sokom. Razsvetljeni blejski otok z zvezdami in dišeča jelka.",
    destSlug: "bled",
  },
  {
    id: "jamski-sejem-postojna",
    monthIndex: 12,
    category: "tradicija",
    title: "Jamski sejem Postojna",
    // P0 2. serija (2026-10-13): prireditev 13.–14. 12. 2026 NI bilo
    // mogoče potrditi (nacionalni register dogodkov in postojna.si
    // brez sledu) — pošteno nepotrjeno, zapis ostane (ne brišemo brez
    // razloga), datum pa nikoli ne izmišljen.
    dateStart: "",
    dateLabel: "datum še ni potrjen",
    dateUnconfirmed: true,
    venue: "Trg Tabor, Postojna",
    price: "free",
    featured: true,
    website: "https://www.postojna.si",
    image: "/content/jamski-sejem-postojna.jpg",
    description:
      "Tradicionalni decembrski sejem v Postojni ob Postojnski jami z ročnimi izdelki kraške regije, pršutom, teranom, keramiko in božično razsvetljavo. Glasbeni program vsak večer.",
    destSlug: "postojnska-jama",
  },

  // ── #41 F2 (2.56.0): balkanski dogodki — vsak z izrecnim country,
  // primarnim virom in datumom po kanonu #38 (potrjen ALI pošteno
  // nepotrjen — izmišljenega datuma nikoli). ──────────────────────────

  {
    // RS, potrjeno (2026-10-14): afisha.rs + belgrade-beat.com navajata
    // celoten program 58. BEMUS (17.–30. 10. 2026, Kolarac); večdnevni
    // razpon preverjen pri obeh virih.
    id: "bemus-beograd-2026",
    monthIndex: 10,
    category: "glasba",
    title: "BEMUS — Beogradska muzička svečanost",
    country: "RS",
    dateStart: "2026-10-17",
    dateEnd: "2026-10-30",
    dateLabel: "17. – 30. okt 2026",
    venue: "Zadužbina Ilije M. Kolarca, Beograd",
    price: "euro",
    featured: false,
    image: "/content/bemus-beograd-2026.jpg",
    description:
      "Najstarejši beograjski glasbeni festival (od 1969) prinaša simfonične in komorne večere v dvorani Kolarca — letos med drugim gosti Solunski državni orkester. Program v oktobrskih dneh po celotnem mestu.",
    destSlug: "beograd",
    source: "https://afisha.rs/en/festivals/58th-bemus-classical-music-festival-at-kolarac-with-vo",
    verifiedAt: "2026-10-14",
  },
  {
    // GR, potrjeno (2026-10-14): filmfestival.gr (uradna stran) v glavi
    // objavlja »TIFF67 — 5 NOVEMBER → 15 NOVEMBER 2026«. Sandbox pri
    // dostopu poroča neobičajen HTTP 404 (vsebina se vseeno servirá —
    // WAF posebnost); datum sta potrdila tudi Facebook AgoraTIFF in
    // asianfilmfestivals.com (poziv k prijavi, maj 2026).
    id: "tiff-solun-2026",
    monthIndex: 11,
    category: "festival",
    title: "67. Mednarodni filmski festival v Solunu",
    country: "GR",
    dateStart: "2026-11-05",
    dateEnd: "2026-11-15",
    dateLabel: "5. – 15. nov 2026",
    venue: "Kino Olympion in Pavlos Zannas, Solun",
    price: "euro",
    featured: true,
    website: "https://filmfestival.gr/en",
    image: "/content/tiff-solun-2026.jpg",
    description:
      "Ena najstarejših filmskih prireditev v jugovzhodni Evropi (od 1960) novembra napolni Solun z avtorskim filmom — tekmovalni program, retrospektive in industrijski del Agora. Dvorani Olympion in Pavlos Zannas ob Aristotelovem trgu.",
    destSlug: "solun",
    source: "https://filmfestival.gr/en",
    verifiedAt: "2026-10-14",
  },
  {
    // BA, potrjeno (2026-10-14): sarajevowinterfest.ba (uradna stran)
    // v odprtem pozivu objavlja »42. International Festival Sarajevo
    // Winter, which will be held from February 7 to March 21, 2027«.
    id: "sarajevo-winter-2027",
    monthIndex: 2,
    category: "kultura",
    title: "42. Mednarodni festival Sarajevo Winter",
    country: "BA",
    dateStart: "2027-02-07",
    dateEnd: "2027-03-21",
    dateLabel: "7. feb – 21. mar 2027",
    venue: "različne prizorišča po Sarajevu",
    price: "euro",
    featured: false,
    website: "https://sarajevowinterfest.ba",
    image: "/content/sarajevo-winter-2027.jpg",
    description:
      "Festival, ustanovljen po zimskih olimpijskih igrah 1984, vsako zimo prekrija Sarajevo z gledališčem, glasbo, filmom, likovno umetnostjo in ambijentalnimi namestitvami. Tradicionalno poteka od 7. februarja do 21. marca.",
    destSlug: "sarajevo",
    source: "https://sarajevowinterfest.ba/open-call-for-sarajevo-winter-2027-and-festival-grad-20",
    verifiedAt: "2026-10-14",
  },
  {
    // BG, nepotrjeno (2026-10-14): siff.bg (uradna stran) potrjuje le
    // »31st edition … March 2027« brez dnevnega razpona; zunanji viri
    // si nasprotujejo (wikipedia 12–31., festagent 11–21.) — po kanonu
    // #38 ne ugibamo, ampak pošteno nepotrjen mesec.
    id: "sofija-film-fest-2027",
    monthIndex: 3,
    category: "festival",
    title: "31. Mednarodni filmski festival v Sofiji",
    country: "BG",
    dateStart: "",
    dateLabel: "marec 2027 — datum še ni potrjen",
    dateUnconfirmed: true,
    venue: "Narodna palača kulture, Sofija",
    price: "euro",
    featured: false,
    website: "https://siff.bg/en",
    image: "/content/sofija-film-fest-2027.jpg",
    description:
      "Največji filmski dogodek v Bolgariji (od 1982) marca napolni dvorane Narodne palače kulture in mestnih kinematografov — izbor evropskega avtorskega filma s spremljajočimi projekcijami po Plovdivu, Burgasu in Varni.",
    destSlug: "sofija",
    source: "https://siff.bg/en",
    verifiedAt: "2026-10-14",
  },
  {
    // RS, nepotrjeno (2026-10-14): exitfest.org (uradna stran) še ne
    // objavlja datumov za 2027; wikipedia dokumentira izroček »štirje
    // dnevi od drugega četrtka v juliju« na Petrovaradinski trdnjavi.
    id: "exit-novi-sad-2027",
    monthIndex: 7,
    category: "glasba",
    title: "EXIT festival",
    country: "RS",
    dateStart: "",
    dateLabel: "julij 2027 — datum še ni potrjen",
    dateUnconfirmed: true,
    venue: "Petrovaradinska trdnjava, Novi Sad",
    price: "euro2",
    featured: false,
    website: "https://www.exitfest.org/en",
    image: "/content/exit-novi-sad-2027.jpg",
    description:
      "Nagrajeni glasbeni festival na Petrovaradinski trdnjavi (od 2000) — štirje dnevi elektronske, rock in hip-hop glasbe z razgledom na Podunavje. Izroček: začetek v drugem četrtku julija.",
    destSlug: "novi-sad",
    source: "https://www.exitfest.org/en",
    verifiedAt: "2026-10-14",
  },
  {
    // MK, nepotrjeno (2026-10-14): ohridskoleto.com.mk (uradna stran,
    // 200 po preusmeritvi na /en/homepage/) še ne objavlja programa za
    // 2027; EFA (European Festivals Association) dokumentira izroček
    // poletnega okna julij–avgust.
    id: "ohridsko-leto-2027",
    monthIndex: 7,
    category: "festival",
    title: "Ohridsko poletje",
    country: "MK",
    dateStart: "",
    dateLabel: "poletje 2027 — datum še ni potrjen",
    dateUnconfirmed: true,
    venue: "Antično gledališče v Ohridu",
    price: "euro",
    featured: false,
    website: "https://ohridskoleto.com.mk/en/homepage/",
    image: "/content/ohridsko-leto-2027.jpg",
    description:
      "Vrhunec makedonske kulturne sezone od 1961 — koncerti klasične glasbe, opera in gledališče v antičnem gledališču nad Ohridskim jezerom, ob večerih, ko sonce zahaja nad vodo.",
    destSlug: "ohrid",
    source: "https://ohridskoleto.com.mk/en/homepage/",
    verifiedAt: "2026-10-14",
  },
  {
    // BA, nepotrjeno (2026-10-14): sff.ba je živa (sveža 32. izdaja v
    // iskalnem kazalu; sandbox dostop zavrne — WAF/geo), datumi za 33.
    // izdajo (avgust 2027) še niso objavljeni. Wikipedia dokumentira
    // 32. izdajo (14.–21. 8. 2026) in avgustovski izroček.
    id: "sarajevo-film-fest-2027",
    monthIndex: 8,
    category: "festival",
    title: "33. Sarajevo Film Festival",
    country: "BA",
    dateStart: "",
    dateLabel: "avgust 2027 — datum še ni potrjen",
    dateUnconfirmed: true,
    venue: "Nacionalno gledališče in dvorane po Sarajevu",
    price: "euro",
    featured: false,
    website: "https://www.sff.ba/en",
    image: "/content/sarajevo-film-fest-2027.jpg",
    description:
      "Vodilni filmski festival regije (od 1995) avgusta oživi Sarajevo — tekmovalni program, projekcije na prostem pred Nacionalnim gledališčem in metropolitansko vzdušje. Ustanovljen kot simbol upora med obleganjem mesta.",
    destSlug: "sarajevo",
    source: "https://www.sff.ba/en",
    verifiedAt: "2026-10-14",
  },
  {
    // XK, potrjeno (2026-10-14): uradni DokuFest kanal navaja »06–14
    // August 2027, Prizren«; dokufest.com (uradna stran, 200) festival
    // pozicionira kot »International Documentary and Short Film
    // Festival held each year in Prizren«. Prizren je pošteno internal
    // provenance (XK nima potrjenega uradnega NTO portala — #41 F1).
    id: "dokufest-prizren-2027",
    monthIndex: 8,
    category: "festival",
    title: "DokuFest — festival dokumentarnega in kratkega filma",
    country: "XK",
    dateStart: "2027-08-06",
    dateEnd: "2027-08-14",
    dateLabel: "6. – 14. avg 2027",
    venue: "Prizren (kino Lumbardhi in odprte dvorišča)",
    price: "euro",
    featured: false,
    website: "https://dokufest.com",
    image: "/content/dokufest-prizren-2027.jpg",
    description:
      "Filmski praznik, ki vsak avgust spremeni srednjeveško Prizren — projekcije v restavriranem kinu Lumbardhi in dvoriščih pod trdnjavo Kalaja, pogovori in glasbeni program ob reki Bistrici.",
    destSlug: "prizren",
    source: "https://dokufest.com",
    verifiedAt: "2026-10-14",
  },
];

// ============================================================================
// VODNIKI — 22 road-trip vodnikov 1:1 iz /vodici + rss.xml
// ============================================================================

export type GuideGroup = "zimski" | "domaci" | "jadranski";

export const GUIDE_GROUPS: Record<
  GuideGroup,
  { kicker: string; title: string; lead: string }
> = {
  zimski: {
    kicker: "❄️ Zimski vodniki",
    title: "Slovenija pozimi",
    lead: "Od adventne Ljubljane (sejem 27. 11.–15. 1.) in božičnega Bohinja prek silvestrovanja in januarskega smučanja do februarskih počitnic z otroki — zimski vodniki s cenami vstopnic, zimskimi gumami in množicami.",
  },
  domaci: {
    kicker: "🇸🇮 Domači krog",
    title: "Slovenija v enem krogu",
    lead: "Krožna potovanja po Sloveniji z lastnim avtom — teden ali deset dni po Alpah, Soči, Krasu in obali, vikend Ljubljana–Bled in družinski krog z otroki: poti, vinjeta, vstopnine in kje spati.",
  },
  jadranski: {
    kicker: "🇸🇮🇭🇷🇧🇦🇲🇪🇦🇱 Cross-border",
    title: "Jadranska potovanja iz Slovenije",
    lead: "Road trip vodniki čez mejo — Hrvaška, Bosna, Črna gora in Albanija z osebnim avtom iz Slovenije: poti, cestnine, mejne formalnosti in kam vsak večer parkirati.",
  },
};

export interface Guide {
  slug: string;
  group: GuideGroup;
  /** Oznaka držav na poti (emoji, kot v produkciji). */
  flags: string;
  title: string;
  days: number;
  km: number;
  /** Kratek opis s seznama vodnikov (produkcija /vodici). */
  description: string;
  /** Daljši opis iz rss.xml itema. */
  rssDescription: string;
  /** Datum objave (rss pubDate). */
  pubDate: string;
  /** Kategorija iz rss.xml. */
  rssCategory: string;
  /** Povezane destinacije iz nabora 74 (samo tiste, ki res obstajajo). */
  destSlugs: string[];
}

export const GUIDES: Guide[] = [
  {
    slug: "slovenija-pozimi",
    group: "zimski",
    flags: "🇸🇮",
    title: "Slovenija pozimi: Ljubljana, Bled in Alpe v 5 dneh",
    days: 5,
    km: 330,
    description:
      "Pet dni od Ljubljane prek Bleda in Bohinja na Kranjsko Goro, s Postojno na poti domov. Snežne kulise, prazne ceste in razgledi brez čakanja — od decembra do marca je država na svojem najlepšem.",
    rssDescription:
      "Pet zimskih dni in okoli 330 kilometrov: Ljubljana, zasnežen Bled, razgled z Vogla, Planica in Postojna — Slovenija v letnem času, ko ni množic.",
    pubDate: "2026-10-13",
    rssCategory: "Vodič po Sloveniji",
    destSlugs: ["ljubljana", "bled", "bohinj", "triglav", "postojnska-jama"],
  },
  {
    slug: "bozicni-vikend-ljubljana",
    group: "zimski",
    flags: "🇸🇮",
    title: "Božični sejem Ljubljana: adventni vikend v 3 dneh",
    days: 3,
    km: 110,
    description:
      "Praznična Ljubljana traja kratek čas — od 27. novembra do 15. januarja — in ta vikend postavi stvari v pravi vrstni red: staro mesto in stojnice zvečer, grad in drsanje čez dan, Postojna na poti domov. Ob najbolj polnih sobotah se mestu raje izognite; v tednu je isti praznik tu za pol manj ljudi.",
    rssDescription:
      "Božični sejem v Ljubljani traja od 27. 11. 2026 do 15. 1. 2027: trije dnevi, 110 kilometrov, stojnice pod lučmi, grad, drsanje v Tivoliju in Postojna.",
    pubDate: "2026-10-20",
    rssCategory: "Vodič po Sloveniji",
    destSlugs: ["ljubljana", "postojnska-jama"],
  },
  {
    slug: "smuci-vikend-iz-ljubljane",
    group: "zimski",
    flags: "🇸🇮",
    title: "Smučarski vikend iz Ljubljane: Vogel ali Krvavec",
    days: 3,
    km: 160,
    description:
      "Tri dni, 160 kilometrov in ena odločitev: Vogel, Krvavec ali Kranjska Gora? Kako izbrati smučišče, kdaj postanejo zimske gume zakon in zakaj obe noči prespite v Bohinju.",
    rssDescription:
      "Tri dni, 160 kilometrov in primerjava treh smučišč: Vogel, Krvavec ali Kranjska Gora — cene vozovnic, zimske gume in spanje v Bohinju.",
    pubDate: "2026-10-27",
    rssCategory: "Vodič po Sloveniji",
    destSlugs: ["bohinj"],
  },
  {
    slug: "zima-v-termah",
    group: "zimski",
    flags: "🇸🇮",
    title: "Zima v termah: Čatež in Olimia za družine",
    days: 3,
    km: 230,
    description:
      "Krajši zimski dopust, ki ga prenesejo malčki: topli zunanji bazeni pod dimom pare, več kot 6 500 kvadratnih metrov pokrite Zimske riviere v Čatežu in Aqualuna v Olimiji. Etape so kratke — 50, 65 in 115 kilometrov — večino dopusta pa preživite v vodi, ne v avtu.",
    rssDescription:
      "Trije dnevi in 230 kilometrov po slovenskih termah: Zimska riviera v Čatežu, Aqualuna v Olimiji — otroci do 115 cm vstopajo brezplačno.",
    pubDate: "2026-11-03",
    rssCategory: "Vodič po Sloveniji",
    destSlugs: [],
  },
  {
    slug: "bozicni-bohinj",
    group: "zimski",
    flags: "🇸🇮",
    title: "Bohinj ob božiču: pravljica, jezero in Vogel",
    days: 3,
    km: 170,
    description:
      "Bohinj je tisto, kar si obljubljate, ko si predstavljate božič v Alpah: vas ob jezeru, kjer se luči odsevajo v temni vodi, nad njo pa gora. Decembra tu poteka Bohinjska pravljica, Vogel streže smučanje pod Triglavom, vožnja od Ljubljane pa meri okoli 85 kilometrov. Vodnik za družine in pare, ki bežijo pred decembrsko vrvežem.",
    rssDescription:
      "Trije decembrski dnevi v Bohinju: Bohinjska pravljica v Ribčevem Lazu, zasneženo jezero in vzpon na Vogel s pogledom na Triglav.",
    pubDate: "2026-09-14",
    rssCategory: "Vodič po Sloveniji",
    destSlugs: ["bohinj", "triglav"],
  },
  {
    slug: "silvestrovanje-v-sloveniji",
    group: "zimski",
    flags: "🇸🇮",
    title: "Silvestrovanje v Ljubljani: novo leto z Bledom",
    days: 3,
    km: 130,
    description:
      "Silvestrovanje v Sloveniji je še vedno skrivnost tistim, ki ga niso preizkusili: Ljubljana na silvestrovsko noč spremeni center v en sam prost praznik, 1. januar pa pripada tihim jezerom. Ta vodnik združi oboje — dva nočitvi v mestu, izlet na Bled v premirju in povratek domov z novim letom, ki se je začel takoj, kot je bil mišljen.",
    rssDescription:
      "Novoletni vikend v Sloveniji: mestno praznovanje v Ljubljani, drsanje na Kongresnem trgu in premirje zasneženega Bleda 1. januarja.",
    pubDate: "2026-09-14",
    rssCategory: "Vodič po Sloveniji",
    destSlugs: ["ljubljana", "bled"],
  },
  {
    slug: "smucanje-v-januarju",
    group: "zimski",
    flags: "🇸🇮",
    title: "Smučanje v januarju: zakaj je to najboljši mesec",
    days: 4,
    km: 335,
    description:
      "Januar je mesec, ki ga smučarska aritmetika najbolj ljubi: sneg je na vrhuncu, februarske šolske počitnice še niso prispele, nastanitve so pod prazničnimi cenami, na treh gurah pa dan še vedno stane pod 50 evrov. Ta vodnik preizkusi Vogel, Kranjsko Goro in Krvavec v štirih dneh in 335 kilometrih — primerjalnica, ki jo naslednje leto uporabite kot odločitev.",
    rssDescription:
      "Januarski smučarski odmor na treh gurah: Vogel, Kranjska Gora in Krvavec s snežno gotovostjo, krajšimi vrstami in ceno dneva pod 50 evrov.",
    pubDate: "2026-09-14",
    rssCategory: "Vodič po Sloveniji",
    destSlugs: ["bohinj"],
  },
  {
    slug: "zimske-pocitnice-z-otroki",
    group: "zimski",
    flags: "🇸🇮",
    title: "Zimske počitnice z otroki: sankanje in drsanje",
    days: 4,
    km: 270,
    description:
      "Zimske počitnice so edini teden v letu, ko mora celotna družina enakovredno preživeti — tudi tista polovica, ki ne smuča. Ta vodnik združi sankanje na Voglu, drsanje na ljubljanskem mestnem trgu in termalne bazene v Čatežu kot rezervo za sive dneve. Štirje dnevi, 270 kilometrov, en skupen dopust.",
    rssDescription:
      "Februarske počitnice brez obveznega smučanja: sankanje na Voglu, drsanje v Ljubljani in topli bazeni Čateža kot rezerva za sive dneve.",
    pubDate: "2026-09-14",
    rssCategory: "Vodič po Sloveniji",
    destSlugs: ["bohinj", "ljubljana"],
  },
  {
    slug: "slovenija-v-7-dneh",
    group: "domaci",
    flags: "🇸🇮",
    title: "Slovenija v 7 dneh: popolni krožni road trip",
    days: 7,
    km: 420,
    description:
      "Sedem dni, okoli 420 kilometrov in nobene meje: Bled, Vršič, turkizna Soča, jame Krasa in Piran — prvi krog, ki ga zapeljete povsem po Sloveniji.",
    rssDescription:
      "Sedem dni in okoli 420 kilometrov: Bled in Bohinj, prelaz Vršič, turkizna Soča, Kobarid, Postojna in Piran — krog brez mej in izgubljenih ur.",
    pubDate: "2026-09-15",
    rssCategory: "Vodič po Sloveniji",
    destSlugs: ["bled", "bohinj", "triglav", "reka-soca", "kobarid", "postojnska-jama", "piran"],
  },
  {
    slug: "slovenija-v-10-dneh",
    group: "domaci",
    flags: "🇸🇮",
    title: "Slovenija v 10 dneh: Alpi, Kras, obala in Štajerska",
    days: 10,
    km: 800,
    description:
      "Desetdnevni krog, ki v enem dopustu sešteje vzhod in zahod države: Maribor na začetku, Bled, Bohinj in Soča sredi, obala pred koncem in Ptuj na ovinku domov. Z vrstnim redom, ki obremeni najmanj avtoceste.",
    rssDescription:
      "Deset dni in okoli 800 kilometrov: Ljubljana, Maribor, Bled, Soča, Postojna ali Škocjan in Piran — veliki krog po Sloveniji z avtom.",
    pubDate: "2026-09-22",
    rssCategory: "Vodič po Sloveniji",
    destSlugs: ["ljubljana", "maribor", "bled", "bohinj", "reka-soca", "postojnska-jama", "piran", "ptuj"],
  },
  {
    slug: "slovenija-vikend",
    group: "domaci",
    flags: "🇸🇮",
    title: "Vikend v Sloveniji: Ljubljana in Bled v treh dneh",
    days: 3,
    km: 120,
    description:
      "Petek v Ljubljani, sobota na Bledu, nedelja po vaši meri: krog, krajši od enega dolgega dneva za volanom na Hrvaškem. Slovenija je majhna — in to je prednost.",
    rssDescription:
      "Trije dnevi in 120 kilometrov: Ljubljana v petek zvečer, Bled ob jutranji svetlobi, Vintgar in odločitev o povratku — direkt ali čez Postojno.",
    pubDate: "2026-09-29",
    rssCategory: "Vodič po Sloveniji",
    destSlugs: ["ljubljana", "bled", "vintgarska-soteska", "postojnska-jama"],
  },
  {
    slug: "slovenija-z-otroki",
    group: "domaci",
    flags: "🇸🇮",
    title: "Slovenija z otroki: družinski krog v 7 dneh",
    days: 7,
    km: 420,
    description:
      "Družinski krog, ki ga prenesejo tudi malčki: Bled s pletno in s kolesom, vlakiček v Postojnski jami, na koncu pa dva dneva v Termah Olimia. Vsaka etapa pod dvema urama, bazeni na koncu.",
    rssDescription:
      "Sedem dni in okoli 420 kilometrov z otroki: Ljubljana, Bled, Postojnska jama in Terme Olimia — kratke etape, vlakiček v jami in bazeni za zadnje dneve.",
    pubDate: "2026-10-06",
    rssCategory: "Vodič po Sloveniji",
    destSlugs: ["ljubljana", "bled", "postojnska-jama"],
  },
  {
    slug: "ljubljana-dubrovnik-road-trip",
    group: "jadranski",
    flags: "🇸🇮 🇭🇷",
    title: "Road trip Ljubljana–Dubrovnik: Plitvice, Split, Ston",
    days: 8,
    km: 1500,
    description:
      "Najdaljša jadranska relacija, ki jo v enem dopustu še naredite humano: Plitvice, Split, Dubrovnik in Ston, skupaj okoli 1 500 kilometrov.",
    rssDescription:
      "Osem dni in 1 500 kilometrov od Ljubljane do Dubrovnika: Plitvice zgodaj zjutraj, Dioklecijanova palača, Pelješki most in ostrige v Stonu.",
    pubDate: "2026-07-21",
    rssCategory: "Jadranski vodnik",
    destSlugs: ["plitvicka-jezera", "split", "dubrovnik"],
  },
  {
    slug: "slovenija-hrvaska-10-dni",
    group: "jadranski",
    flags: "🇸🇮 🇭🇷",
    title: "Slovenija in Hrvaška v 10 dneh: Bled, Plitvice, Split",
    days: 10,
    km: 1350,
    description:
      "Desetdnevni načrt, ki v enem dopustu združi alpski svet, kraško podzemlje in jadransko obalo — napisan za Slovence, ki gostom pokažejo vse, in za tujce, ki želijo oboje.",
    rssDescription:
      "Deset dni, 1 350 kilometrov: Bled, Ljubljana in Postojna na začetku, Plitvice, Zadar in Split na jugu, Piran na koncu. Za Slovence z gosti in za tujce.",
    pubDate: "2026-07-24",
    rssCategory: "Jadranski vodnik",
    destSlugs: ["bled", "ljubljana", "postojnska-jama", "plitvicka-jezera", "zadar", "split", "piran"],
  },
  {
    slug: "bled-plitvice-split",
    group: "jadranski",
    flags: "🇸🇮 🇭🇷",
    title: "Bled, Plitvice in Split: hitri teden na Jadran",
    days: 7,
    km: 900,
    description:
      "Teden, ki se začne ob Blejskem jezeru in konča na Rivi v Splitu — sedem dni, ena smer, brez voženj nazaj.",
    rssDescription:
      "Sedemdnevni načrt od Bleda do Splita v eni smeri: Ljubljana, Postojnska jama, Plitvice in Zadar na poti. Vrstni red, ki ne vozi nazaj, z vstopninami.",
    pubDate: "2026-07-28",
    rssCategory: "Jadranski vodnik",
    destSlugs: ["bled", "ljubljana", "postojnska-jama", "plitvicka-jezera", "zadar", "split"],
  },
  {
    slug: "istria-vikend-iz-slovenije",
    group: "jadranski",
    flags: "🇸🇮 🇭🇷",
    title: "Vikend v Istri iz Slovenije: Motovun, Rovinj, Pula",
    days: 3,
    km: 420,
    description:
      "Istra je najbližja tuja pokrajina, ki se obnaša, kot da je vaša: sol, griči, tartufi in rdeča streha za vsakim ovinkom — trije dnevi in 420 kilometrov.",
    rssDescription:
      "Petek, sobota, nedelja: Piran in obala na začetku, griči s tartufi sredi, Rovinj in Pula na koncu. Okoli 420 kilometrov in vse v enem vikendu.",
    pubDate: "2026-07-31",
    rssCategory: "Jadranski vodnik",
    destSlugs: ["piran", "pula"],
  },
  {
    slug: "hrvaska-obala-prakticni-vodnik",
    group: "jadranski",
    flags: "🇸🇮 🇭🇷",
    title: "Hrvaška obala praktično: cestnine, trajekti, plaže",
    days: 7,
    km: 1000,
    description:
      "Vse, kar se na hrvaški obali naučite drago, v enem vodniku: meseci in množice, cestnine po odsekih, trajekti, parkiranje, spanje in morje od maja do oktobra.",
    rssDescription:
      "Priročnik obale od Istre do Konavlja: kdaj na jug, plačljive in proste plaže, cestnine HAC, trajekti Jadrolinija, parkiranje, spanje in temperatura morja.",
    pubDate: "2026-08-04",
    rssCategory: "Jadranski vodnik",
    destSlugs: [],
  },
  {
    slug: "najem-avta-cross-border",
    group: "jadranski",
    flags: "🇸🇮 🇭🇷 🇧🇦",
    title: "Najem avta na jug: Hrvaška, Bosna, Črna gora, Albanija",
    days: 7,
    km: 1200,
    description:
      "Praktični vodnik za najem avta, ki bo peljal čez meje: kaj mora pisati v pogodbi, kaj na zelenem kartonu, koliko varščine blokirajo in kdaj se najem splača.",
    rssDescription:
      "Kdaj se splača najem namesto lastnega avta, kaj preveriti pri agenciji, kako urediti prestop meje v Bosno, Črno goro in Albanijo ter varščino.",
    pubDate: "2026-08-07",
    rssCategory: "Jadranski vodnik",
    destSlugs: [],
  },
  {
    slug: "kotor-crna-gora-iz-slovenije",
    group: "jadranski",
    flags: "🇸🇮 🇭🇷 🇲🇪",
    title: "Kotor in Črna gora z avtom iz Slovenije",
    days: 7,
    km: 750,
    description:
      "Črna gora je bližje, kot se zdi: Pelješki most odpelje mimo Bosne, za Dubrovnikom pa se odpre Boka, zaliv, ki ga gledate še, ko ste že doma. Sedemdnevni načrt z mejami in evri.",
    rssDescription:
      "Road trip v Črno goro: Split in Dubrovnik na poti, Pelješki most, Boka Kotorska, Perast, Lovćen in Budva. Okoli 750 km in 7 dni z nasveti za mejo.",
    pubDate: "2026-08-12",
    rssCategory: "Jadranski vodnik",
    destSlugs: ["split", "dubrovnik", "kotor", "budva"],
  },
  {
    slug: "albanija-z-avtom-iz-slovenije",
    group: "jadranski",
    flags: "🇸🇮 🇭🇷 🇲🇪 🇦🇱",
    title: "Albanija z avtom iz Slovenije: road trip v 10 dneh",
    days: 10,
    km: 2000,
    description:
      "Najdaljša etapa jadranskega koridorja: 900 kilometrov do Tirane, leki v denarnici, ovinki namesto avtocest in Ksamil na koncu poti. Deset dni, 2 000 kilometrov in štiri kontrole — potovanje, ki si ga boste še leta pripovedovali.",
    rssDescription:
      "Road trip v Albanijo iz Slovenije: meja pri Sukobinu, zeleni karton, leki in ceste, Tirana, Ksamil, Butrint in Gjirokastër v desetih dneh.",
    pubDate: "2026-08-16",
    rssCategory: "Jadranski vodnik",
    destSlugs: ["tirana", "saranda", "gjirokaster"],
  },
  {
    slug: "sarajevo-mostar-iz-slovenije",
    group: "jadranski",
    flags: "🇸🇮 🇭🇷 🇧🇦",
    title: "Sarajevo, Mostar in Hercegovina z avtom iz Slovenije",
    days: 7,
    km: 1300,
    description:
      "Bosna je bližje, kot se zdi: Sarajevo je od Ljubljane oddaljen okoli 520, Mostar pa okoli 580 kilometrov. Sedemdnevni načrt z mejami, markami, dolino Neretve in povratkom po obali ali Posavini.",
    rssDescription:
      "Teden v Bosni z avtom iz Slovenije: Sarajevo, Mostar, Blagaj in slapi Kravice s nasveti o meji, zeleni karti, markah in povratku po obali ali Posavini.",
    pubDate: "2026-08-20",
    rssCategory: "Jadranski vodnik",
    destSlugs: [],
  },
  {
    slug: "hrvaski-otoki-iz-slovenije",
    group: "jadranski",
    flags: "🇸🇮 🇭🇷",
    title: "Hrvaški otoki z avtom iz Slovenije: Hvar, Korčula, Brač",
    days: 9,
    km: 1100,
    description:
      "Otoški dopust z lastnim avtom: Krk prek mosta, trajekt v Stari Grad, Pakleni otoki, Korčula in Zlatni rat pred povratkom. Trajekte in nastanitve uredite še doma — poleti rezervacija ni priporočilo, ampak pogoj.",
    rssDescription:
      "Krk, Hvar, Korčula in Brač z osebnim avtom: trajekti Jadrolinije, rezervacije poleti, Pakleni otoci, Zlatni rat in devetdnevni načrt iz Ljubljane.",
    pubDate: "2026-08-25",
    rssCategory: "Jadranski vodnik",
    destSlugs: ["hvar"],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

// ============================================================================
// BLOG — 16 člankov („Zgodbe iz Slovenije") 1:1 iz /vodici
// ============================================================================

export type BlogCategory =
  | "vsi"
  | "narava"
  | "kulinarika"
  | "kultura"
  | "avantura"
  | "nasveti";

export const BLOG_CATEGORIES: Record<
  Exclude<BlogCategory, "vsi">,
  { sl: string; en: string; it: string; de: string; fr: string; es: string }
> = {
  narava: { sl: "Narava", en: "Nature", it: "Natura", de: "Natur", fr: "Nature", es: "Naturaleza" },
  kulinarika: { sl: "Kulinarika", en: "Food", it: "Gastronomia", de: "Kulinarik", fr: "Gastronomie", es: "Gastronomía" },
  kultura: { sl: "Kultura", en: "Culture", it: "Cultura", de: "Kultur", fr: "Culture", es: "Cultura" },
  avantura: { sl: "Avantura", en: "Adventure", it: "Avventura", de: "Abenteuer", fr: "Aventure", es: "Aventura" },
  nasveti: { sl: "Nasveti", en: "Tips", it: "Consigli", de: "Tipps", fr: "Conseils", es: "Consejos" },
};

export interface BlogArticle {
  id: string;
  category: Exclude<BlogCategory, "vsi">;
  /** Datum objave, kot v produkciji. */
  dateLabel: string;
  readMinutes: number;
  title: string;
  description: string;
  image: string;
  /** Povezana destinacija iz nabora 74 (neobvezno). */
  destSlug?: string;
}

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    id: "blejsko-jezero-vodic",
    category: "narava",
    dateLabel: "12. mar. 2026",
    readMinutes: 5,
    title: "Blejsko jezero: Vodič za popoln obisk",
    description:
      "Blejsko jezero je najbolj prepoznavna slovenska razglednica. Spoznajte najboljše čas obiska, kaj početi in kako izkoristiti dan ob alkanskem biseru.",
    image: "/content/blejsko-jezero-vodic.jpg",
    destSlug: "bled",
  },
  {
    id: "soca-adrenalinski-vodnik",
    category: "avantura",
    dateLabel: "18. feb. 2026",
    readMinutes: 6,
    title: "Soča: Adrenalinski vodnik za poletje",
    description:
      "Smaragdna reka med Julijci je raj za adrenalinže. Od raftinga do canyoninga — spoznajte najboljše adrenalinske aktivnosti ob Soči.",
    image: "/content/soca-adrenalinski-vodnik.jpg",
    destSlug: "reka-soca",
  },
  {
    id: "slovenska-kulinarika-7-jedi",
    category: "kulinarika",
    dateLabel: "22. jan. 2026",
    readMinutes: 7,
    title: "Slovenska kulinarika: 7 jedi ki jih morate poskusiti",
    description:
      "Od štrukljev do potice — slovenska kuhinja je presenetljivo raznolika. Tu je 7 jedi, ki definirajo slovensko mizo.",
    image: "/content/slovenska-kulinarika-7-jedi.jpg",
  },
  {
    id: "triglav-vzpon-vodic",
    category: "avantura",
    dateLabel: "3. feb. 2026",
    readMinutes: 8,
    title: "Triglav: Vzpon na najvišji vrh Slovenije",
    description:
      "Triglav (2864 m) je narodni simbol in najvišji vrh Slovenije. Pripravite se pravilno — vodnik o opremi, poteh in najboljšem času za vzpon.",
    image: "/content/triglav-vzpon-vodic.jpg",
    destSlug: "triglav",
  },
  {
    id: "piran-slovenska-obala-24-ur",
    category: "kultura",
    dateLabel: "4. mar. 2026",
    readMinutes: 6,
    title: "Piran in slovenska obala v 24 urah",
    description:
      "Kako izkoristiti 24 ur na slovenski obali? Spoznajte Piran, Portorož in soline Sečovlje v enem dnevu — z najboljšo hrano in razgledi.",
    image: "/content/piran-slovenska-obala-24-ur.jpg",
    destSlug: "piran",
  },
  {
    id: "zima-v-sloveniji-smucanje-thermalni",
    category: "nasveti",
    dateLabel: "8. jan. 2026",
    readMinutes: 7,
    title: "Zima v Sloveniji: Smučanje in termalni vrelci",
    description:
      "Slovenska zima ponuja dve strani — adrenalinsko smučanje na Julijcih in sprostitev v termalnih vrelcih. Spoznajte najboljše destinacije za zimske mesece.",
    image: "/content/zima-v-sloveniji-smucanje-thermalni.jpg",
  },
  {
    id: "vintgarska-soteska-vodic",
    category: "narava",
    dateLabel: "5. apr. 2026",
    readMinutes: 5,
    title: "Vintgarska soteska: Vodič po naravnem biseru ob Bledu",
    description:
      "1,6 km dolga soteska ob reki Radovni le 4 km od Bleda — lesen most, slap Šum in kristalno čista voda. Vse za popoln obisk.",
    image: "/content/vintgarska-soteska-vodic.jpg",
    destSlug: "vintgarska-soteska",
  },
  {
    id: "cvicek-in-dolenjska-kuhinja",
    category: "kulinarika",
    dateLabel: "12. jul. 2026",
    readMinutes: 6,
    title: "Cviček in dolenjska kuhinja: Vodič po lokalnih okusih",
    description:
      "Cviček je kralj dolenjskih vin, dolenjska kuhinja pa je kmečka, enostavna in polna okusa. Spoznajte najboljše jedi in vinarje.",
    image: "/content/cvicek-in-dolenjska-kuhinja.jpg",
    destSlug: "novo-mesto",
  },
  {
    id: "bohinj-pozimi",
    category: "narava",
    dateLabel: "18. apr. 2026",
    readMinutes: 6,
    title: "Bohinj pozimi: Smučanje, pohodi in tople jazbe",
    description:
      "Bohinj pozimi je tihi, snežni raj. Smučanje na Voglu, pohodi na Komno in sprostitev v toplih jazbah — vodnik za zimski obisk.",
    image: "/content/bohinj-pozimi.jpg",
    destSlug: "bohinj",
  },
  {
    id: "kolesarjenje-ob-dravi",
    category: "avantura",
    dateLabel: "22. maj 2026",
    readMinutes: 5,
    title: "Kolesarjenje ob Dravi: Od Maribora do Ptuja",
    description:
      "Kolesarska pot ob Dravi je ena najlepših v Sloveniji. 35 km od Maribora do Ptuja skozi vinograde in vasice. Vodnik za enodnevni izlet.",
    image: "/content/kolesarjenje-ob-dravi.jpg",
    destSlug: "maribor",
  },
  {
    id: "kam-na-pohorju",
    category: "nasveti",
    dateLabel: "8. sep. 2026",
    readMinutes: 7,
    title: "Kam na Pohorju: Vodnik po smučanju, pohodih in turizmu",
    description:
      "Pohorje je največja slovenska planota — smučanje, pohodi, gondola in tradicionalna kuhinja. Vodnik po najboljšim destinacijam na Pohorju.",
    image: "/content/kam-na-pohorju.jpg",
    destSlug: "maribor",
  },
  {
    id: "slapovi-slovenije",
    category: "narava",
    dateLabel: "9. maj 2026",
    readMinutes: 7,
    title: "Slapovi Slovenije: 10 najlepših za obisk",
    description:
      "Slovenija je dežela slapov — od 80-metrskega Bokovega do najbolj obiskanega Blediškega. Spoznajte 10 najlepših slapov in kako jih obiskati.",
    image: "/content/slapovi-slovenije.jpg",
  },
  {
    id: "ljubljana-v-48-urah",
    category: "kultura",
    dateLabel: "5. sep. 2026",
    readMinutes: 8,
    title: "Ljubljana v 48 urah: Popoln itinerer za vikend",
    description:
      "Kako izkoristiti 48 ur v Ljubljani? Vodnik po najboljših znamenitostih, restavracijah in skritih kotičkih slovenske prestolnice.",
    image: "/content/ljubljana-v-48-urah.jpg",
    destSlug: "ljubljana",
  },
  {
    id: "prekmurska-gibanica-zgodovina-in-recept",
    category: "kulinarika",
    dateLabel: "15. jun. 2026",
    readMinutes: 7,
    title: "Prekmurska gibanica: Zgodovina, legenda in pravi recept",
    description:
      "Prekmurska gibanica je kraljica slovenskih sladic. Spoznajte njeno zgodovino, legendo o poroki in pravi tradicionalni recept za pripravo doma.",
    image: "/content/prekmurska-gibanica-zgodovina-in-recept.jpg",
    destSlug: "murska-sobota",
  },
  {
    id: "vinogradi-stajerske-turizem",
    category: "kulinarika",
    dateLabel: "18. avg. 2026",
    readMinutes: 8,
    title: "Vinogradi Štajerske: Vodnik po vinskih turističnih kleteh",
    description:
      "Štajerska je ena najpomembnejših slovenskih vinorodnih regij. Spoznajte najboljše vinske kleti, degustacije in nastanitve v vinogradih.",
    image: "/content/vinogradi-stajerske-turizem.jpg",
    destSlug: "maribor",
  },
  {
    id: "triglavski-narodni-park-vodic",
    category: "narava",
    dateLabel: "8. avg. 2026",
    readMinutes: 9,
    title: "Triglavski narodni park: Vodič po edinem slovenskem narodnem parku",
    description:
      "Triglavski narodni park je edini narodni park v Sloveniji. 840 km² alpske narave z vrhovi, dolinami, jezera in slapovi. Spoznajte najlepše kotičke.",
    image: "/content/triglavski-narodni-park-vodic.jpg",
    destSlug: "triglav",
  },
];

// ============================================================================
// DOŽIVETJA — 7 tipov (6 1:1 iz /dozivetja + vinske-poti #41 F2)
// ============================================================================

export interface ExperienceType {
  id: string;
  title: { sl: string; en: string; it: string; de: string; fr: string; es: string };
  description: string;
  /** Destinacije iz nabora 74, kjer je tip doživetja doma. */
  destSlugs: string[];
}

export const EXPERIENCE_TYPES: ExperienceType[] = [
  {
    id: "pohodnistvo",
    title: { sl: "Pohodništvo", en: "Hiking", it: "Escursionismo", de: "Wandern", fr: "Randonnée", es: "Senderismo" },
    // #41 F2: dinarski grebeni in Šar planina (Durmitor, Kopaonik,
    // Jahorina, Rugova, Brezovica) — balkansko dopolnilo alpske matice.
    description: "Triglav, Mangart, Storžič — od lahnih sprehodov do zahtevnih vzponov. Dinaridi: Durmitor, Kopaonik, Rugova.",
    destSlugs: ["triglav", "bohinj", "bled", "vintgarska-soteska", "durmitor", "kopaonik", "jahorina", "rugova", "brezovica"],
  },
  {
    id: "vodne-avanture",
    title: { sl: "Vodne avanture", en: "Water adventures", it: "Avventure acquatiche", de: "Wasserabenteuer", fr: "Aventures nautiques", es: "Aventuras náuticas" },
    description: "Rafting na Soči, kajak na Kolpi, smučanje na vodi v Portorožu. Balkan: Kravica, kanjon Matka, Đerdap.",
    destSlugs: ["reka-soca", "portoroz", "crnomelj", "kravica", "matka", "derdap"],
  },
  {
    id: "zgodovina-kultura",
    title: { sl: "Zgodovina & kultura", en: "History & culture", it: "Storia e cultura", de: "Geschichte & Kultur", fr: "Histoire et culture", es: "Historia y cultura" },
    description: "Srednjeveški gradovi, Predjama, Ljubljanski grad, muzeji Soške fronte. Balkan: Sarajevo, Ohrid, Prizren, Solun.",
    destSlugs: ["ljubljana", "kobarid", "postojnska-jama", "ptuj", "celje", "sarajevo", "mostar", "ohrid", "prizren", "sofija", "plovdiv", "solun", "berat"],
  },
  {
    id: "narava-parki",
    title: { sl: "Narava & parki", en: "Nature & parks", it: "Natura e parchi", de: "Natur & Parks", fr: "Nature et parcs", es: "Naturaleza y parques" },
    description: "Triglavski narodni park, Cerkniško jezero, slovenski gozdovi. Balkan: Plitvice, Prespa, Mavrovo.",
    destSlugs: ["triglav", "bohinj", "vintgarska-soteska", "plitvicka-jezera", "prespa", "mavrovo", "durmitor"],
  },
  {
    id: "kulinarika",
    title: { sl: "Kulinarika", en: "Gastronomy", it: "Gastronomia", de: "Gastronomie", fr: "Gastronomie", es: "Gastronomía" },
    description: "Od kremšnite do štrukljev, od Teranov do rebule — 24 gastronomskih regij. Balkan: kafane Beograda, bokeljska kuhinja, solunska kuhinja.",
    destSlugs: ["bled", "piran", "kobarid", "novo-mesto", "murska-sobota", "beograd", "kotor", "solun"],
  },
  {
    id: "skrite-dragulje",
    title: { sl: "Skrite dragulje", en: "Hidden gems", it: "Gioielli nascosti", de: "Verborgene Schätze", fr: "Pépites cachées", es: "Joyas ocultas" },
    description: "Vintgarska soteska, soline Sečovlje, Logarska dolina — izven utirjenih poti. Balkan: Blagaj, Sremski Karlovci, Gjakova, Nesebar.",
    destSlugs: ["vintgarska-soteska", "piran", "portoroz", "blagaj", "sremski-karlovci", "gjakova", "nesebar", "kastoria"],
  },
  {
    // #41 F2 (2.56.0): nov tip doživetja — balkanski vinski predeli
    // (Hercegovina, Fruška gora, Trakija, Naoussa); slugi kažejo na
    // destinacije kanona 74.
    id: "vinske-poti",
    title: { sl: "Vinske poti", en: "Wine routes", it: "Strade del vino", de: "Weinstraßen", fr: "Routes des vins", es: "Rutas del vino" },
    description: "Žilavka in Blatina iz Hercegovine (Mostar, Blagaj), bermet s Fruške gore (Novi Sad), trakijska vina okoli Plovdiva, vina iz okolic Soluna.",
    destSlugs: ["mostar", "blagaj", "novi-sad", "plovdiv", "solun"],
  },
];

// ============================================================================
// VODNIKI PO TIPU POTOVANJA — 4 teme po destinaciji (rss: 38×4 itemov)
// ============================================================================

export type GuideThemeId = "romanticni-pobeg" | "druzinski" | "budget" | "vikend";

export interface GuideTheme {
  id: GuideThemeId;
  emoji: string;
  label: { sl: string; en: string; it: string; de: string; fr: string; es: string };
  description: string;
}

export const GUIDE_THEMES: GuideTheme[] = [
  {
    id: "romanticni-pobeg",
    emoji: "❤️",
    label: { sl: "Romantični pobeg", en: "Romantic getaway", it: "Fuga romantica", de: "Romantische Auszeit", fr: "Escapade romantique", es: "Escapada romántica" },
    description:
      "Pobeg za dva — romantične aktivnosti, večerje ob svečkah, zasebne izkušnje in nastanitve z razgledom.",
  },
  {
    id: "druzinski",
    emoji: "👨‍👩‍👧",
    label: { sl: "Družinski izlet", en: "Family trip", it: "Gita in famiglia", de: "Familienausflug", fr: "Sortie en famille", es: "Viaje en familia" },
    description:
      "Družinski prijazne aktivnosti za vse starosti — varne pohodne poti, zabavišča, otroški meniji in interaktivne izkušnje.",
  },
  {
    id: "budget",
    emoji: "💰",
    label: { sl: "Cenovno ugoden obisk", en: "Budget visit", it: "Visita economica", de: "Günstiger Besuch", fr: "Visite économique", es: "Visita económica" },
    description:
      "Maksimalna izkušnja z minimalnim proračunom — brezplačne atrakcije, lokalni piknik, poceni prenočišča in javni transport.",
  },
  {
    id: "vikend",
    emoji: "🗓️",
    label: { sl: "Vikend pobeg", en: "Weekend escape", it: "Fuga nel weekend", de: "Wochenendtrip", fr: "Escapade week-end", es: "Escapada de fin de semana" },
    description:
      "Popoln 2-dnevni pobeg — petek zvečer do nedelje popoldan. Uravnotežen program z glavnimi znamenitostmi in lokalno kulinarike.",
  },
];

export function getGuideTheme(tema: string): GuideTheme | undefined {
  return GUIDE_THEMES.find((t) => t.id === tema);
}

/**
 * Opis teme za destinacijo — 1:1 vzorec rss itemov produkcije:
 * „{ime} — {tagline}. {opis teme}." (izpeljano iz kanonskih podatkov,
 * nikoli izmišljeno).
 */
export function themeDescriptionFor(d: Destination, theme: GuideTheme): string {
  return `${d.name} — ${d.tagline}. ${theme.description}`;
}

// ============================================================================
// KAJ POČETI — uvodni opisi things-to-do strani (rss.xml, 74 destinacij)
// ============================================================================

/** Uvodni odstavek /destinacija/[slug]/things-to-do (rss.xml item opisi). */
export const THINGS_TO_DO_INTRO: Record<string, string> = {
  bled: "Biser Alp s srednjeveškim gradom in otokom. Blejski otok, Blejski grad, Vintgarska soteska, Kremšnita — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  bohinj: "Divja, nedotaknjena lepota Triglavskega narodnega parka. Bohinjsko jezero, Vogel, Slap Savica, Triglavski narodni park — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  ljubljana: "Zelena, ustvarjalna prestolnica z zmajevim mostom. Ljubljanski grad, Zmajev most, Prešernov trg, Tivoli park — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  "postojnska-jama": "24 km podzemnih rovov in vilinsko kraljestvo kapnikov. Podzemno vlakec, Kapniki, Človeška ribica, Predjamski grad — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  piran: "Slovenske Benetke s kamnitimi uličicami in Tartinijevim trgom. Tartinijev trg, Cerkev sv. Jurija, Obala, Stare uličice — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  "reka-soca": "Smaragdna reka med Julijci za adrenalinske avanture. Korita Soče, Bovec, Tolmin, Trdnjava Kluže — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  triglav: "2864 m visok simbol naroda z neštetimi potmi. Vrh 2864 m, Aljažev stolp, Triglavska roža, Pohodništvo — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  kobarid: "Zgodovina, Soška fronta in kulinarika v eni vasi. Kobaridski muzej, Napoleonov most, Kolovrat, Hiša Franko — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  maribor: "Drugo največje mesto z najstarejšo trto na svetu. Stara trta, Pohorje, Glavni trg, Vinogradništvo — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  portoroz: "Slovensko obmorsko letovišče s Casino in wellness. Plaža, Casino, Soline Sečovlje, Wellness — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  "vintgarska-soteska": "Kratek sprehod skozi apnenec ob umirjeni reki. Slap Šum, Lesene poti, Kristalna voda, Naravni bazeni — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  "rogaska-slatina": "Najstarejše slovensko zdravilišče z mineralno vodo. Donat Mg, Secesijska arhitektura, Grand hotel, Wellness — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  ptuj: "Najstarejše mesto v Sloveniji z rimsko zgodovino. Ptujski grad, Rimske izkopanine, Kurentovanje, Drava — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  celje: "Nekdanja prestolnica grofov Celjskih z impresivnim gradom. Stari grad Celje, Stari trg, Savinja, Pokrajinski muzej — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  "nova-gorica": "Mesto vrtnic na meji z Italijo. Trg Evrope, Park vrtnic, Casino Perla, Solkan most — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  "slovenj-gradec": "Alpsko mestece z bogato glasbeno tradicijo. Dvorana slovenskih glasbenikov, Stari trg, Pohorje, Uršlja gora — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  dravograd: "Tromeja rek Drave, Meže in Mislinje. Sotoče treh rek, HE Dravograd, Kozjak, Pohodništvo — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  "murska-sobota": "Center Prekmurja z gradom ob jezeru. Grad Murska Sobota, Sobotoško jezero, Prekmurska gibanica, Pokrajinski muzej — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  lendava: "Dvojezično mesto z vinogradi in gradom na hribu. Grad Lendava, Vinogradi Lendavskih goric, Dvojezična kultura, Vinska klet — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  "novo-mesto": "Dolenjska prestolnica ob reki Krki. Stari trg, Reka Krka, Cviček, Arheološki muzej — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  otocec: "Edini slovenski grad na otoku reke. Grad na otoku, Reka Krka, Golf, Wellness — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  crnomelj: "Srce Bele krajine ob reki Kolpi. Reka Kolpa, Stari trg, Belokranjska pisanica, Steljniki — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  zagreb: "Hrvaška prestolnica z dunajskim šarmom in kavarniško kulturo. Gornji grad, Trg bana Jelačića, Tržnica Dolac, Katedrala — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  "plitvicka-jezera": "UNESCO kaskada turkiznih jezer in slapov. Veliki slap, Jezero Kozjak, Lesene brvi, Travertinske barjere — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  rijeka: "Prestolnica kulture z največjim hrvaškim pristaniščem. Korzo, Trsatski grad, Mestni stolp, Stolnica sv. Vida — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  pula: "Rimski amfiteater ob Jadranskem morju. Amfiteater Arena, Zlati portal, Stari trg, Istrska riviera — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  zadar: "Mesto sončnega zahoda in morskih orgel. Morske orgle, Pozdrav soncu, Cerkev sv. Donata, Rimske ruševine — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  split: "Živo mesto znotraj Dioklecijanove palače. Dioklecijanova palača, Peristil, Katedrala sv. Duje, Marjan — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  hvar: "Najsončnejši jadranski otok sivine in levandule. Tvrdjava Fortica, Hvarsko pristanišče, Pakleni otoki, Levandulna polja — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  dubrovnik: "Srednjeveško obzidano mesto nad modrim Jadranom. Mestno obzidje, Stradun, Otok Lokrum, Žičnica na Srđ — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  kotor: "Fjordu podobna Boka s srednjeveškim obzidanim mestom. Stari grad Kotor, Obzidje San Giovanni, Boka kotorska, Perast — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  budva: "Stari grad na polotoku med plažami in borovci. Stari grad Budva, Plaža Mogren, Sveti Stefan, Plaža Jaz — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  podgorica: "Sproščeno glavno mesto na stičišču rek in planin. Millenniumski most, Stara varoš, Stolp z uro, Gorica — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  durmitor: "UNESCO gorovje nad Črnim jezerom in kanjonom Tare. Črno jezero, Kanjon Tare, Žabljak, Sedlo Soa — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  tirana: "Barvita prestolnica z otomanskim jedrom in kavarniškim tempom. Skanderbegov trg, Mošeja Et'hem Bej, Bunk'Art, Gora Dajti — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  berat: "Mesto tisočerih oken pod gradom ob reki Osum. Beratski grad, Četrt Mangalem, Stari most, Onufrijev muzej — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  gjirokaster: "Mesto kamna — sive strehe pod mogočnim gradom. Gjirokastrski grad, Stara baza, Kamnite hiše, Kadarejeva hiša — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
  saranda: "Sončno jonsko mesto nasproti Korfu. Ksamil, Antični Butrint, Trdnjava Lëkurësi, Pogled na Korfu — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.",
};

export function thingsToDoIntro(slug: string): string | undefined {
  return THINGS_TO_DO_INTRO[slug];
}

/**
 * Konec dogodka v ISO obliki — `dateEnd` za preverjene večdnevne
 * dogodke, sicer `dateStart` (enodnevni dogodek). Pomočnik za
 * isEventPast (#38: „Pretekle dogodke … jasno prikaži kot pretekle“).
 */
export function eventEndIso(e: CommunityEvent): string {
  return e.dateEnd && e.dateEnd !== "" ? e.dateEnd : e.dateStart;
}

/**
 * Ali je dogodek ZAKLJUČEN ob danem dnevu (`todayIso`, ISO „YYYY-MM-DD“).
 *
 * Semantika (#38, iskrenostni kanon):
 *  · nepotrjen/prazen datum → NIKOLI „pretekli“ (ne ugibamo iz monthIndex);
 *  · zaključek == danes → ŠE TEČE (ne pretekli);
 *  · zaključek < danes → pretekli (za večdnevne z dateEnd; za enodnevne
 *    po dateStart).
 * `todayIso` podaja strežnik (SSR prop — 0 hidracijskih razlik,
 * deterministično per build/zahteva, kanon POLIR15-b).
 */
export function isEventPast(e: CommunityEvent, todayIso: string): boolean {
  if (e.dateUnconfirmed || e.dateStart === "") return false;
  const end = eventEndIso(e);
  return end !== "" && end < todayIso;
}
