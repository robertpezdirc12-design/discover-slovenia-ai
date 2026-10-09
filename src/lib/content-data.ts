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

import type { Destination } from "./slovenia-data";

// ============================================================================
// DOGODKI — 30 dogodkov 1:1 iz produkcjske strani /dogodki
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
  /** Kratek ID (dodajanje v mojo pot: kind "event"). */
  id: string;
  monthIndex: number;
  category: EventCategory;
  title: string;
  /** ISO datum začetka (prvi dan) — iz <time dateTime> v produkciji. */
  dateStart: string;
  /** Prirojen prikaz datuma, kot v produkciji (npr. „8. – 18. feb 2027"). */
  dateLabel: string;
  venue: string;
  price: EventPrice;
  featured: boolean;
  /** Uradna spletna stran dogodka (zunanja; samo kjer jo produkcija navaja). */
  website?: string;
  image: string;
  description: string;
  /** Destinacija iz nabora 38, na katero se dogodek navezuje (neobvezno). */
  destSlug?: string;
}

export const EVENTS: CommunityEvent[] = [
  {
    id: "ljubljanski-zimski-festival",
    monthIndex: 1,
    category: "glasba",
    title: "Ljubljanski zimski festival",
    dateStart: "2027-01-15",
    dateLabel: "15. – 26. jan 2027",
    venue: "Cankarjev dom, Ljubljana",
    price: "euro2",
    featured: false,
    website: "https://www.ljubljanafestival.si",
    image: "/content/ljubljanski-zimski-festival.jpg",
    description:
      "Vrhunski mednarodni glasbeni festival z diskografijami klasične in komorne glasbe v Cankarjevem domu, operi in ljubljanskih cerkvah. Tradicija, ki sega v leto 1952.",
    destSlug: "ljubljana",
  },
  {
    id: "zlati-lisjak-smucanje",
    monthIndex: 1,
    category: "sport",
    title: "Zlati lisjak — svetovni pokal v smučanju",
    dateStart: "2027-01-18",
    dateLabel: "18. – 19. jan 2027",
    venue: "Smučišče Mariborsko Pohorje, Maribor",
    price: "euro",
    featured: false,
    website: "https://www.zlati-lisjak.si",
    image: "/content/zlati-lisjak-maribor.jpg",
    description:
      "Tradicionalno tekmovanje svetovnega pokala v ženskem veleslalomu na Pohorju. Najboljše smučarke sveta se pomerijo na progi Golden Fox pred tisoči gledalcev ob pogorju.",
    destSlug: "maribor",
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
    dateStart: "2027-02-08",
    dateLabel: "8. – 18. feb 2027",
    venue: "Stari mestni trg, Ptuj",
    price: "free",
    featured: true,
    website: "https://www.kurentovanje.net",
    image: "/content/pustni-karneval-ptuj.jpg",
    description:
      "Največji pustni karneval v Sloveniji in eden najpomembnejših etnografskih festivalov v Evropi. Povorka kurentov — starodavnih bitij z rdečimi jeziki in kravjimi zvonci — preganja zimo skozi stare ulice Ptuja.",
    destSlug: "ptuj",
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
    id: "vinska-vigred-maribor",
    monthIndex: 3,
    category: "hrana",
    title: "Vinska vigred — festival vina",
    dateStart: "2027-03-14",
    dateLabel: "14. – 16. mar 2027",
    venue: "Lent, Maribor",
    price: "euro",
    featured: true,
    website: "https://www.vinskavigred.si",
    image: "/content/vinska-vigred-maribor.jpg",
    description:
      "Največji festival vina v Sloveniji v Mariboru z več kot 200 vinarji iz vseh slovenskih regij. Degustacije, delavnice, kulinarika in glasba ob Dravi.",
    destSlug: "maribor",
  },
  {
    id: "planica-nordic-festival",
    monthIndex: 3,
    category: "sport",
    title: "Planica Nordic Festival",
    dateStart: "2027-03-21",
    dateLabel: "21. – 23. mar 2027",
    venue: "Planica, Kranjska Gora",
    price: "euro2",
    featured: true,
    website: "https://www.planica.si",
    image: "/content/planica-nordic-festival.jpg",
    description:
      "Svetovni pokal v smučarskih poletih v slavni Planici pod Poncami. Najboljši skakalci sveta letijo preko 240 metrov na največji skakalnici na svetu, ob strani pa tekmovanja v nordijskem teku in biatlonu.",
  },
  {
    id: "blejski-danovski-festival",
    monthIndex: 4,
    category: "glasba",
    title: "Blejski danovski festival",
    dateStart: "2027-04-10",
    dateLabel: "10. – 13. apr 2027",
    venue: "Blejski grad, Bled",
    price: "euro2",
    featured: false,
    website: "https://www.festivalblejskihdni.si",
    image: "/content/blejski-danovski-festival.jpg",
    description:
      "Mednarodni komorni glasbeni festival na Bledu z vrhunskimi koncerti v Blejskem gradu, na blejskem otoku in v cerkvah. Slovenski glasbeniki skupaj z mednarodnimi gosti v romantični alpski kulisi.",
    destSlug: "bled",
  },
  {
    id: "jurjevanje-bela-krajina",
    monthIndex: 4,
    category: "tradicija",
    title: "Jurjevanje v Beli krajini",
    dateStart: "2027-04-22",
    dateLabel: "22. – 23. apr 2027",
    venue: "Stari trg, Črnomelj",
    price: "free",
    featured: false,
    website: "https://www.jurjevanje.si",
    image: "/content/jurjevanje-bela-krajina.jpg",
    description:
      "Najstarejši folklorni festival v Sloveniji, ki praznuje pomlad in belokranjsko tradicijo. Povorka pisanic, tradicionalni plesi v belokranjskih nošah in glasba steljnikov v Črnomlju.",
    destSlug: "crnomelj",
  },
  {
    id: "festival-soca",
    monthIndex: 5,
    category: "sport",
    title: "Festival Soča",
    dateStart: "2027-05-23",
    dateLabel: "23. – 25. maj 2027",
    venue: "Bovec in Tolmin",
    price: "euro2",
    featured: false,
    website: "https://www.festivalsoca.si",
    image: "/content/festival-soca.jpg",
    description:
      "Športno-glasbeni festival ob smaragdni Soči z raftingom, kajakaštvom, canyoningom in adrenalinskimi izzivi čez dan. Zvečer ob reki tonejo toni alternative, reggaeja in world musica.",
    destSlug: "reka-soca",
  },
  {
    id: "ljubljanski-maraton",
    monthIndex: 5,
    category: "sport",
    title: "Ljubljanski maraton",
    dateStart: "2027-05-25",
    dateLabel: "25. maj 2027",
    venue: "Slovenska cesta, Ljubljana",
    price: "euro2",
    featured: true,
    website: "https://www.ljubljanskimaraton.si",
    image: "/content/ljubljanski-maraton.jpg",
    description:
      "Mednarodni maraton v Ljubljani z razdaljami 10 km, pol maratona in maratona. Tisoči tekačev iz vse Evrope tečejo skozi staro mestno jedro, ob Ljubljanici in po Tivoliju.",
    destSlug: "ljubljana",
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
    dateStart: "2027-06-13",
    dateLabel: "13. – 15. jun 2027",
    venue: "Center, Laško",
    price: "euro",
    featured: true,
    website: "https://www.pivoincvetje.si",
    image: "/content/pivo-in-cvetje-lasko.jpg",
    description:
      "Največji festival piva in cvetja v Sloveniji v Laškem. Več kot 50.000 obiskovalcev, pivska tržnica, koncerti domačih in tujih izvajalcev, razstava cvetja in ognjemet.",
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
    monthIndex: 10,
    category: "tradicija",
    title: "Celjski sejem",
    dateStart: "2026-10-09",
    dateLabel: "9. – 12. okt 2026",
    venue: "Celjski sejem, Celje",
    price: "euro",
    featured: false,
    website: "https://www.celjski-sejem.si",
    image: "/content/celjski-sejem.jpg",
    description:
      "Tradicionalni celjski sejem z razstavo obrti, kmetijstva, domačih izdelkov in vozil. Spremljevalni program z glasbo, degustacijami in animacijami za otroke na sejmišču.",
    destSlug: "celje",
  },
  {
    id: "bela-krajina-koline",
    monthIndex: 11,
    category: "tradicija",
    title: "Bela krajina koline in opankarija",
    dateStart: "2026-11-22",
    dateLabel: "22. nov 2026",
    venue: "Stari trg, Črnomelj",
    price: "euro2",
    featured: false,
    image: "/content/bela-krajina-koline.jpg",
    description:
      "Tradicionalne koline v Beli krajini z opankanjem (pletje koruznih venčkov) in lokalno glasbo. Avtentična belokranjska kultura.",
    destSlug: "crnomelj",
  },
  {
    id: "bozicni-sejmi-ljubljana-maribor",
    monthIndex: 11,
    category: "tradicija",
    title: "Božični sejmi v Ljubljani in Mariboru",
    dateStart: "2026-11-29",
    dateLabel: "29. nov – 31. dec 2026",
    venue: "Stari trg, Ljubljana in Maribor",
    price: "free",
    featured: true,
    website: "https://www.ljubljana.si",
    image: "/content/bozicni-sejmi.jpg",
    description:
      "Romantični božični sejmi s stojnicami z ročnimi izdelki, medenimi piškoti, kuhanim vinom in prešanim sokom. Srednjeveški starem mestnem jedru Ljubljane in Maribora zasvetita z vencev in dišečimi jelkami.",
    destSlug: "ljubljana",
  },
  {
    id: "bled-winter-magic",
    monthIndex: 12,
    category: "tradicija",
    title: "Bled Winter Magic — božična vasica",
    dateStart: "2026-12-01",
    dateLabel: "1. – 31. dec 2026",
    venue: "Obala Blejskega jezera, Bled",
    price: "free",
    featured: true,
    website: "https://www.bled.si",
    image: "/content/bled-winter-magic.jpg",
    description:
      "Romantična božična vasica ob Blejskem jezeru z lesenimi hišicami, ročnimi izdelki, medenimi piškoti, kuhanim vinom in prešanim sokom. Razsvetljeni blejski otok z zvezdami in dišeča jelka.",
    destSlug: "bled",
  },
  {
    id: "jamski-sejem-postojna",
    monthIndex: 12,
    category: "tradicija",
    title: "Jamski sejem Postojna",
    dateStart: "2026-12-13",
    dateLabel: "13. – 14. dec 2026",
    venue: "Trg Tabor, Postojna",
    price: "free",
    featured: true,
    website: "https://www.postojna.si",
    image: "/content/jamski-sejem-postojna.jpg",
    description:
      "Tradicionalni decembrski sejem v Postojni ob Postojnski jami z ročnimi izdelki kraške regije, pršutom, teranom, keramiko in božično razsvetljavo. Glasbeni program vsak večer.",
    destSlug: "postojnska-jama",
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
  /** Povezane destinacije iz nabora 38 (samo tiste, ki res obstajajo). */
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
  /** Povezana destinacija iz nabora 38 (neobvezno). */
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
// DOŽIVETJA — 6 tipov 1:1 iz /dozivetja
// ============================================================================

export interface ExperienceType {
  id: string;
  title: { sl: string; en: string; it: string; de: string; fr: string; es: string };
  description: string;
  /** Destinacije iz nabora 38, kjer je tip doživetja doma. */
  destSlugs: string[];
}

export const EXPERIENCE_TYPES: ExperienceType[] = [
  {
    id: "pohodnistvo",
    title: { sl: "Pohodništvo", en: "Hiking", it: "Escursionismo", de: "Wandern", fr: "Randonnée", es: "Senderismo" },
    description: "Triglav, Mangart, Storžič — od lahnih sprehodov do zahtevnih vzponov.",
    destSlugs: ["triglav", "bohinj", "bled", "vintgarska-soteska"],
  },
  {
    id: "vodne-avanture",
    title: { sl: "Vodne avanture", en: "Water adventures", it: "Avventure acquatiche", de: "Wasserabenteuer", fr: "Aventures nautiques", es: "Aventuras acuáticas" },
    description: "Rafting na Soči, kajak na Kolpi, smučanje na vodi v Portorožu.",
    destSlugs: ["reka-soca", "portoroz", "crnomelj"],
  },
  {
    id: "zgodovina-kultura",
    title: { sl: "Zgodovina & kultura", en: "History & culture", it: "Storia e cultura", de: "Geschichte & Kultur", fr: "Histoire et culture", es: "Historia y cultura" },
    description: "Srednjeveški gradovi, Predjama, Ljubljanski grad, muzeji Soške fronte.",
    destSlugs: ["ljubljana", "kobarid", "postojnska-jama", "ptuj", "celje"],
  },
  {
    id: "narava-parki",
    title: { sl: "Narava & parki", en: "Nature & parks", it: "Natura e parchi", de: "Natur & Parks", fr: "Nature et parcs", es: "Naturaleza y parques" },
    description: "Triglavski narodni park, Cerkniško jezero, slovenski gozdovi.",
    destSlugs: ["triglav", "bohinj", "vintgarska-soteska"],
  },
  {
    id: "kulinarika",
    title: { sl: "Kulinarika", en: "Gastronomy", it: "Gastronomia", de: "Gastronomie", fr: "Gastronomie", es: "Gastronomía" },
    description: "Od kremšnite do štrukljev, od Teranov do rebule — 24 gastronomskih regij.",
    destSlugs: ["bled", "piran", "kobarid", "novo-mesto", "murska-sobota"],
  },
  {
    id: "skrite-dragulje",
    title: { sl: "Skrite dragulje", en: "Hidden gems", it: "Gioielli nascosti", de: "Verborgene Schätze", fr: "Pépites cachées", es: "Joyas ocultas" },
    description: "Vintgarska soteska, soline Sečovlje, Logarska dolina — izven utirjenih poti.",
    destSlugs: ["vintgarska-soteska", "piran", "portoroz"],
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
// KAJ POČETI — uvodni opisi things-to-do strani (rss.xml, 38 destinacij)
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
