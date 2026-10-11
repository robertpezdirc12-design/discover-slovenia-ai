/**
 * INTERESTS-I18N — prikazna preslikava interesnih žetonov (QA U4, 2026-10-11).
 * ============================================================================
 * Problem: kanonski žetoni interesov so SLOVENSKI (nabor podatkov 38
 * destinacij + NLU žetoni iz INTEREST_RULES) — v EN/IT/DE/FR/ES vmesniku so
 * čipi prikazali „družina/jezero/kolo“, naslov načrta pa je bil preveden.
 *
 * Rešitev (SAMO prikaz — motor itinerarja se NE spreminja):
 *  - INTEREST_DISPLAY: ključi so normText() oblike žetonov (male črke, brez
 *    diakritik — isti kanon kot ujemanje v itinerary-engine.ts), vrednosti
 *    so prevodi za en/it/de/fr/es (sl = surov žeton, slovenščina JE kanon);
 *  - pokritost: VSI čipi interestChips() (activities ∪ bestFor, 124 vnosov)
 *    + vsi bazni žetoni, ki jih lahko izžrejo skripte (NLU INTEREST_RULES:
 *    družina, gora, pohodništvo, jezero, morje, mesto, kulinarika, vino,
 *    kultura, zdravje, smučanje, kolo, narava, avantura, jame, soteska,
 *    plavanje; Start Anywhere TYPE_INTERESTS: grad, reka, …);
 *  - ISKRENA REZERVA: neznan žeton → surov žeton (nikoli ne skrijemo
 *    niti ne izmišljujemo prevoda); sl → vedno surov žeton;
 *  - preslikava je PRIKAZNA le — identiteta žetona (form.interests, ključi
 *    čipov, pošiljanje motorju) ostane kanonska, torej ujemanje, .ics,
 *    PDF in determinizem ostanejo nespremenjeni.
 *
 * 0 AI, 0 omrežja, čista preslikava: isti žeton + jezik → isti prikaz.
 */

import { asPickLocale, type PickLocale } from "@/lib/i18n-pick";
import { normText } from "@/lib/itinerary-engine";

/** Prevodi enega žetona (sl = surov kanon, prevodi za ostale jezike). */
export interface InterestTranslations {
  en: string;
  it: string;
  de: string;
  fr: string;
  es: string;
}

/**
 * Ključi = normText(žeton). Urejeni po kanonskem vrstnem redu interestChips()
 * (števec padajoče), nato bazni žetoni skript (NLU + Start Anywhere), ki
 * med čipi ne nastopajo samostojno.
 */
export const INTEREST_DISPLAY: Record<string, InterestTranslations> = {
  // ── čipi nabora (activities ∪ bestFor, po števcu) ──────────────────────
  kultura: { en: "culture", it: "cultura", de: "Kultur", fr: "culture", es: "cultura" },
  narava: { en: "nature", it: "natura", de: "Natur", fr: "nature", es: "naturaleza" },
  hrana: { en: "food", it: "cibo", de: "Essen", fr: "cuisine", es: "comida" },
  druzina: { en: "family", it: "famiglia", de: "Familie", fr: "famille", es: "familia" },
  fotografija: { en: "photography", it: "fotografia", de: "Fotografie", fr: "photographie", es: "fotografía" },
  "sprehod po starem mestu": { en: "Walk through the old town", it: "Passeggiata nel centro storico", de: "Rundgang durch die Altstadt", fr: "Promenade dans la vieille ville", es: "Paseo por el casco antiguo" },
  romantika: { en: "romance", it: "romanticismo", de: "Romantik", fr: "romantisme", es: "romanticismo" },
  "obisk gradu": { en: "Castle visit", it: "Visita al castello", de: "Burgbesuch", fr: "Visite du château", es: "Visita al castillo" },
  mesto: { en: "city", it: "città", de: "Stadt", fr: "ville", es: "ciudad" },
  pohodnistvo: { en: "hiking", it: "escursionismo", de: "Wandern", fr: "randonnée", es: "senderismo" },
  wellness: { en: "wellness", it: "benessere", de: "Wellness", fr: "bien-être", es: "bienestar" },
  mir: { en: "peace", it: "tranquillità", de: "Ruhe", fr: "calme", es: "tranquilidad" },
  poletje: { en: "summer", it: "estate", de: "Sommer", fr: "été", es: "verano" },
  "vinska degustacija": { en: "Wine tasting", it: "Degustazione di vini", de: "Weinverkostung", fr: "Dégustation de vins", es: "Cata de vinos" },
  avantura: { en: "adventure", it: "avventura", de: "Abenteuer", fr: "aventure", es: "aventura" },
  muzej: { en: "Museum", it: "Museo", de: "Museum", fr: "Musée", es: "Museo" },
  smucanje: { en: "skiing", it: "sci", de: "Skifahren", fr: "ski", es: "esquí" },
  vino: { en: "wine", it: "vino", de: "Wein", fr: "vin", es: "vino" },
  zgodovina: { en: "history", it: "storia", de: "Geschichte", fr: "histoire", es: "historia" },
  adrenalin: { en: "adrenaline", it: "adrenalina", de: "Adrenalin", fr: "adrénaline", es: "adrenalina" },
  "etnografski muzej": { en: "Ethnographic museum", it: "Museo etnografico", de: "Völkerkundemuseum", fr: "Musée ethnographique", es: "Museo etnográfico" },
  "igre na sreco": { en: "Gambling", it: "Giochi d'azzardo", de: "Glücksspiel", fr: "Jeux d'argent", es: "Juegos de azar" },
  kajakastvo: { en: "Kayaking", it: "Kayak", de: "Kajakfahren", fr: "kayak", es: "kayak" },
  "kolo ob krki": { en: "Cycling along the Krka", it: "Ciclopedalata lungo la Krka", de: "Radfahren an der Krka", fr: "Cyclisme le long de la Krka", es: "Ciclismo por el Krka" },
  "kolo ob soci": { en: "Cycling along the Soča", it: "Ciclopedalata lungo la Soča", de: "Radfahren an der Soča", fr: "Cyclisme le long de la Soča", es: "Ciclismo por el Soča" },
  plavanje: { en: "swimming", it: "nuoto", de: "Schwimmen", fr: "natation", es: "natación" },
  "soncni zahod": { en: "Sunset", it: "Tramonto", de: "Sonnenuntergang", fr: "coucher de soleil", es: "atardecer" },
  "sprehod po korzu": { en: "Stroll along the promenade", it: "Passeggiata sul lungomare", de: "Spaziergang über die Promenade", fr: "Promenade sur l'esplanade", es: "Paseo por el paseo marítimo" },
  "sprehod po obzidju": { en: "Walk along the city walls", it: "Passeggiata sulle mura", de: "Spaziergang auf der Stadtmauer", fr: "Promenade sur les remparts", es: "Paseo por las murallas" },
  "trajektni izleti na otoke": { en: "Ferry trips to the islands", it: "Escursioni in traghetto alle isole", de: "Fährenausflüge zu den Inseln", fr: "Excursions en ferry vers les îles", es: "Excursiones en ferry a las islas" },
  "advent v decembru": { en: "December Advent", it: "Avvento a dicembre", de: "Advent im Dezember", fr: "Avent en décembre", es: "Adviento en diciembre" },
  aktivnosti: { en: "activities", it: "attività", de: "Aktivitäten", fr: "activités", es: "actividades" },
  alpinizem: { en: "Alpinism", it: "Alpinismo", de: "Alpinismus", fr: "alpinisme", es: "alpinismo" },
  canyoning: { en: "Canyoning", it: "Canyoning", de: "Canyoning", fr: "canyoning", es: "barranquismo" },
  festival: { en: "festival", it: "festival", de: "Festival", fr: "festival", es: "festival" },
  "fotografija narave": { en: "Nature photography", it: "Fotografia naturalistica", de: "Naturfotografie", fr: "photographie de nature", es: "Fotografía de naturaleza" },
  "glasbeni koncerti": { en: "Music concerts", it: "Concerti", de: "Konzerte", fr: "Concerts", es: "Conciertos" },
  golf: { en: "Golf", it: "Golf", de: "Golf", fr: "Golf", es: "Golf" },
  "izlet na kornate": { en: "Trip to the Kornati", it: "Escursione alle Kornati", de: "Ausflug zu den Kornaten", fr: "Excursion aux Kornati", es: "Excursión a los Kornati" },
  "izlet na lokrum": { en: "Trip to Lokrum", it: "Escursione a Lokrum", de: "Ausflug nach Lokrum", fr: "Excursion à Lokrum", es: "Excursión a Lokrum" },
  "izlet na paklene otoke": { en: "Trip to the Pakleni Islands", it: "Escursione alle isole Pakleni", de: "Ausflug zu den Pakleni-Inseln", fr: "Excursion aux îles Pakleni", es: "Excursión a las islas Pakleni" },
  "izlet na skadarsko jezero": { en: "Trip to Lake Skadar", it: "Escursione al lago di Scutari", de: "Ausflug zum Skutarisee", fr: "Excursion au lac de Skadar", es: "Excursión al lago Skadar" },
  "izlet v perast": { en: "Trip to Perast", it: "Escursione a Perast", de: "Ausflug nach Perast", fr: "Excursion à Perast", es: "Excursión a Perast" },
  "jamska tura z vlakcem": { en: "Cave tour by train", it: "Tour della grotta in trenino", de: "Höhlentour mit der Bahn", fr: "Visite de la grotte en petit train", es: "Tour de la cueva en trenecillo" },
  "kava na tkalcicevo": { en: "Coffee on Tkalčićeva", it: "Caffè su Tkalčićeva", de: "Kaffee auf der Tkalčićeva", fr: "Café sur Tkalčićeva", es: "Café en Tkalčićeva" },
  "kava ob moraci": { en: "Coffee by the Morača", it: "Caffè lungo la Morača", de: "Kaffee an der Morača", fr: "Café sur la Morača", es: "Café junto al Morača" },
  "kavarniska kultura": { en: "Café culture", it: "Cultura dei caffè", de: "Kaffeehauskultur", fr: "culture des cafés", es: "Cultura cafetera" },
  "kolo ob dravi": { en: "Cycling along the Drava", it: "Ciclopedalata lungo la Drava", de: "Radfahren an der Drau", fr: "Cyclisme le long de la Drava", es: "Ciclismo por el Drava" },
  "kolo ob ljubljanici": { en: "Cycling along the Ljubljanica", it: "Ciclopedalata lungo la Ljubljanica", de: "Radfahren an der Ljubljanica", fr: "Cyclisme le long de la Ljubljanica", es: "Ciclismo por el Ljubljanica" },
  "kolo ob morju": { en: "Cycling by the sea", it: "Ciclopedalata sul mare", de: "Radfahren am Meer", fr: "Cyclisme au bord de la mer", es: "Ciclismo junto al mar" },
  "kolo ob savinji": { en: "Cycling along the Savinja", it: "Ciclopedalata lungo la Savinja", de: "Radfahren an der Savinja", fr: "Cyclisme le long de la Savinja", es: "Ciclismo por el Savinja" },
  "kolo po beli krajini": { en: "Cycling through Bela Krajina", it: "Ciclopedalata nella Bela krajina", de: "Radfahren durch die Bela krajina", fr: "Cyclisme dans la Bela krajina", es: "Ciclismo por la Bela krajina" },
  "kolo po ravnini": { en: "Cycling on the flat", it: "Ciclopedalata in pianura", de: "Radfahren im Flachen", fr: "Cyclisme sur le plat", es: "Ciclismo en llano" },
  "kolo po vinogradih": { en: "Cycling through the vineyards", it: "Ciclopedalata tra i vigneti", de: "Radfahren durch die Weinberge", fr: "Cyclisme à travers les vignobles", es: "Ciclismo entre viñedos" },
  kopanje: { en: "swimming", it: "bagni", de: "Baden", fr: "baignade", es: "baños" },
  "kopanje na mogrenu": { en: "Swimming at Mogren", it: "Bagni a Mogren", de: "Baden am Mogren-Strand", fr: "Baignade à Mogren", es: "Baños en Mogren" },
  "kopanje v kolpi": { en: "Swimming in the Kolpa", it: "Bagni nella Kolpa", de: "Baden in der Kolpa", fr: "Baignade dans la Kolpa", es: "Baños en el Kolpa" },
  "kopanje v ksamila": { en: "Swimming in Ksamil", it: "Bagni a Ksamil", de: "Baden in Ksamil", fr: "Baignade à Ksamil", es: "Baños en Ksamil" },
  "kopanje v zalivih": { en: "Swimming in the coves", it: "Bagni nelle calette", de: "Baden in den Buchten", fr: "Baignade dans les criques", es: "Baños en las calas" },
  "krizarjenje po boki": { en: "Cruising the Bay of Kotor", it: "Crociera nella Boka", de: "Kreuzfahrt durch die Boka", fr: "Croisière dans la Boka", es: "Crucero por la Boka" },
  "krizni hodnik franciskanskega samostana": { en: "Franciscan monastery cloister", it: "Chiostro del convento francescano", de: "Kreuzgang des Franziskanerklosters", fr: "Cloître du couvent franciscain", es: "Claustro del convento franciscano" },
  "kulinaricna izkusnja": { en: "Culinary experience", it: "Esperienza culinaria", de: "Kulinarisches Erlebnis", fr: "expérience culinaire", es: "Experiencia culinaria" },
  "kulinaricna tura": { en: "Culinary tour", it: "Tour culinario", de: "Kulinarische Tour", fr: "circuit culinaire", es: "Ruta culinaria" },
  "kulinaricne izkusnje": { en: "Culinary experiences", it: "Esperienze culinarie", de: "Kulinarische Erlebnisse", fr: "expériences culinaires", es: "Experiencias culinarias" },
  masaze: { en: "Massages", it: "Massaggi", de: "Massagen", fr: "massages", es: "masajes" },
  "mejni sprehod": { en: "Border walk", it: "Passeggiata di confine", de: "Grenzspaziergang", fr: "Promenade à la frontière", es: "Paseo fronterizo" },
  "mejni sprehod v italijo": { en: "Border walk into Italy", it: "Passeggiata di confine verso l'Italia", de: "Grenzspaziergang nach Italien", fr: "Promenade à la frontière vers l'Italie", es: "Paseo fronterizo a Italia" },
  "morska hrana": { en: "Seafood", it: "Frutti di mare", de: "Meeresfrüchte", fr: "fruits de mer", es: "mariscos" },
  "most cez osum": { en: "Bridge over the Osum", it: "Ponte sull'Osum", de: "Brücke über den Osum", fr: "Pont sur l'Osum", es: "Puente sobre el Osum" },
  muzeji: { en: "Museums", it: "Musei", de: "Museen", fr: "musées", es: "museos" },
  "muzeji in galerije": { en: "Museums and galleries", it: "Musei e gallerie", de: "Museen und Galerien", fr: "musées et galeries", es: "museos y galerías" },
  "obisk predjamskega gradu": { en: "Visit to Predjama Castle", it: "Visita al castello di Predjama", de: "Besuch der Burg Predjama", fr: "Visite du château de Predjama", es: "Visita al castillo de Predjama" },
  "obisk solin": { en: "Salt pans visit", it: "Visita alle saline", de: "Besuch der Salinen", fr: "Visite des salines", es: "Visita a las salinas" },
  "obisk stare trte": { en: "Visit to the Old Vine", it: "Visita alla Vecchia Vite", de: "Besuch des Alten Weinstocks", fr: "Visite de la Vieille Vigne", es: "Visita a la Vid Vieja" },
  "ogled arene": { en: "Arena tour", it: "Visita all'Arena", de: "Besichtigung der Arena", fr: "Visite de l'Arène", es: "Visita a la Arena" },
  "ogled butrinta": { en: "Butrint tour", it: "Visita a Butrinto", de: "Besichtigung von Butrint", fr: "Visite de Butrint", es: "Visita a Butrint" },
  "ogled velikega slapa": { en: "View of the Great Waterfall", it: "Visione della Grande Cascata", de: "Blick auf den Großen Wasserfall", fr: "Vue de la Grande Cascade", es: "Vista de la Gran Cascada" },
  "opazovanje narave": { en: "Nature watching", it: "Osservazione della natura", de: "Naturbeobachtung", fr: "observation de la nature", es: "Observación de la naturaleza" },
  "panoramska voznja cez sedlo": { en: "Panoramic drive over the Sedlo pass", it: "Corsa panoramica sul passo Sedlo", de: "Panoramafahrt über den Sedlo-Pass", fr: "Route panoramique par le col de Sedlo", es: "Ruta panorámica por el paso de Sedlo" },
  "pitje mineralne vode": { en: "Drinking mineral water", it: "Bevanda di acqua minerale", de: "Trinken von Mineralwasser", fr: "Boisson d'eau minérale", es: "Beber agua mineral" },
  "plaza bacvice": { en: "Bačvice beach", it: "Spiaggia di Bačvice", de: "Strand Bačvice", fr: "Plage Bačvice", es: "Playa Bačvice" },
  "pletna voznja do otoka": { en: "Pletna boat ride to the island", it: "Giro in pletna fino all'isola", de: "Pletna-Fahrt zur Insel", fr: "Promenade en pletna jusqu'à l'île", es: "Paseo en pletna hasta la isla" },
  "pogled s fortice": { en: "View from the Fortress", it: "Vista dalla Fortezza", de: "Blick von der Festung", fr: "Vue depuis la forteresse", es: "Vista desde la fortaleza" },
  "pogled s trsata": { en: "View from Trsat", it: "Vista da Trsat", de: "Blick von Trsat", fr: "Vue depuis Trsat", es: "Vista desde Trsat" },
  "pohod okrog crnega jezera": { en: "Hike around the Black Lake", it: "Escursione attorno al lago Nero", de: "Wanderung um den Schwarzen See", fr: "Randonnée autour du lac Noir", es: "Senderismo alrededor del lago Negro" },
  "pohodi v okolico": { en: "Hikes in the area", it: "Escursioni nei dintorni", de: "Wanderungen in der Umgebung", fr: "Randonnées dans les environs", es: "Senderismo por los alrededores" },
  "poslusanje morskih orgel": { en: "Listening to the sea organ", it: "Ascolto dell'organo marino", de: "Lauschen auf die Meeresorgel", fr: "Écouter l'orgue de mer", es: "Escuchar el órgano del mar" },
  "pustni festival": { en: "Carnival festival", it: "Festival di carnevale", de: "Faschingsfestival", fr: "festival de carnaval", es: "festival de carnaval" },
  rafting: { en: "Rafting", it: "Rafting", de: "Rafting", fr: "Rafting", es: "Rafting" },
  "rafting po tari": { en: "Rafting on the Tara", it: "Rafting sulla Tara", de: "Rafting auf der Tara", fr: "Rafting sur la Tara", es: "Rafting en el Tara" },
  "razgled na sveti stefan": { en: "View of Sveti Stefan", it: "Vista su Sveti Stefan", de: "Blick auf Sveti Stefan", fr: "Vue sur Sveti Stefan", es: "Vista de Sveti Stefan" },
  "raziskovanje centra": { en: "Exploring the centre", it: "Esplorazione del centro", de: "Erkundung des Zentrums", fr: "Exploration du centre", es: "Explorar el centro" },
  "raziskovanje palace": { en: "Exploring the palace", it: "Esplorazione del palazzo", de: "Erkundung des Palasts", fr: "Exploration du palais", es: "Explorar el palacio" },
  "raziskovanje stare varosi": { en: "Exploring the Old Town", it: "Esplorazione della Stara varoš", de: "Erkundung der Stara varoš", fr: "Exploration de la Stara varoš", es: "Explorar la Stara varoš" },
  ribolov: { en: "Fishing", it: "Pesca", de: "Angeln", fr: "pêche", es: "pesca" },
  "rijeski karneval": { en: "Rijeka Carnival", it: "Carnevale di Fiume", de: "Karneval von Rijeka", fr: "Carnaval de Rijeka", es: "Carnaval de Rijeka" },
  "romanticni vecerja": { en: "Romantic dinner", it: "Cena romantica", de: "Romantisches Dinner", fr: "dîner romantique", es: "cena romántica" },
  "smucanje pohorje": { en: "Skiing on Pohorje", it: "Sci sul Pohorje", de: "Skifahren am Pohorje", fr: "Ski au Pohorje", es: "Esquí en el Pohorje" },
  "smucanje pozimi": { en: "Winter skiing", it: "Sci invernale", de: "Skifahren im Winter", fr: "ski en hiver", es: "esquí en invierno" },
  "soncni zahod iz lekuresija": { en: "Sunset from Lëkurësi", it: "Tramonto da Lëkurësi", de: "Sonnenuntergang von Lëkurësi", fr: "Coucher de soleil depuis Lëkurësi", es: "Atardecer desde Lëkurësi" },
  "soncni zahod z srda": { en: "Sunset from Srđ", it: "Tramonto dal Srđ", de: "Sonnenuntergang vom Srđ", fr: "Coucher de soleil depuis le Srđ", es: "Atardecer desde el Srđ" },
  sprehod: { en: "Walk", it: "Passeggiata", de: "Spaziergang", fr: "promenade", es: "paseo" },
  "sprehod na marjan": { en: "Walk on Marjan hill", it: "Passeggiata sul Marjan", de: "Spaziergang auf dem Marjan", fr: "Promenade sur la colline de Marjan", es: "Paseo por el Marjan" },
  "sprehod ob dravi": { en: "Walk along the Drava", it: "Passeggiata lungo la Drava", de: "Spaziergang an der Drau", fr: "Promenade le long de la Drava", es: "Paseo por el Drava" },
  "sprehod ob jezeru": { en: "Walk by the lake", it: "Passeggiata lungo il lago", de: "Spaziergang am See", fr: "Promenade au bord du lac", es: "Paseo junto al lago" },
  "sprehod po bazarju": { en: "Walk through the bazaar", it: "Passeggiata per il bazar", de: "Spaziergang durch den Basar", fr: "Promenade dans le bazar", es: "Paseo por el bazar" },
  "sprehod po brveh": { en: "Walk on the stilt path", it: "Passeggiata sui passerelli", de: "Spaziergang auf dem Steg", fr: "Promenade sur la passerelle", es: "Paseo por la pasarela" },
  "sprehod po gornjem gradu": { en: "Walk through the Upper Castle", it: "Passeggiata nel castello superiore", de: "Spaziergang durch die Oberburg", fr: "Promenade dans le château supérieur", es: "Paseo por el castillo superior" },
  "sprehod po mangalemu": { en: "Walk through Mangalem", it: "Passeggiata a Mangalem", de: "Spaziergang durch Mangalem", fr: "Promenade dans Mangalem", es: "Paseo por Mangalem" },
  "sprehod po parku": { en: "Walk in the park", it: "Passeggiata nel parco", de: "Spaziergang im Park", fr: "Promenade dans le parc", es: "Paseo por el parque" },
  "sprehod po soteski": { en: "Walk through the gorge", it: "Passeggiata nella gola", de: "Spaziergang durch die Schlucht", fr: "Promenade dans la gorge", es: "Paseo por la garganta" },
  "sprehodi po parku": { en: "Walks in the park", it: "Passeggiate nel parco", de: "Spaziergänge im Park", fr: "Promenades dans le parc", es: "Paseos por el parque" },
  sprostitev: { en: "relaxation", it: "relax", de: "Entspannung", fr: "détente", es: "relajación" },
  "staro mesto": { en: "Old town", it: "Città vecchia", de: "Altstadt", fr: "vieille ville", es: "casco antiguo" },
  "trajekt na korfu": { en: "Ferry to Corfu", it: "Traghetto per Corfù", de: "Fähre nach Korfu", fr: "Ferry vers Corfou", es: "Ferry a Corfú" },
  "veceri na obali": { en: "Seaside dinners", it: "Cene sul lungomare", de: "Abendessen am Meer", fr: "dîners au bord de la mer", es: "cenas junto al mar" },
  "vinska degustacija posipine": { en: "Pošip wine tasting", it: "Degustazione di pošip", de: "Weinverkostung von Pošip", fr: "Dégustation de pošip", es: "Cata de pošip" },
  "vinske degustacije po istri": { en: "Wine tastings in Istria", it: "Degustazioni di vini in Istria", de: "Weinverkostungen in Istrien", fr: "Dégustations de vins en Istrie", es: "Catas de vino en Istria" },
  "voznja z ladjo po kozjaku": { en: "Boat ride on Kozjak", it: "Giro in barca sul Kozjak", de: "Bootsfahrt auf dem Kozjak", fr: "Promenade en bateau sur le Kozjak", es: "Paseo en barca por el Kozjak" },
  "vzpon na obzidje": { en: "Climb onto the city walls", it: "Salita sulle mura", de: "Aufstieg auf die Stadtmauer", fr: "Montée sur les remparts", es: "Subida a las murallas" },
  zdravje: { en: "wellness", it: "benessere", de: "Gesundheit", fr: "bien-être", es: "bienestar" },
  "zip line": { en: "Zip-line", it: "Zip-line", de: "Zipline", fr: "tyrolienne", es: "tirolina" },
  "zicnica na dajti": { en: "Cable car to Dajti", it: "Funivia per il Dajti", de: "Seilbahn auf den Dajti", fr: "Téléphérique vers le Dajti", es: "Teleférico al Dajti" },
  "zicnica vogel": { en: "Vogel cable car", it: "Funivia del Vogel", de: "Seilbahn Vogel", fr: "Téléphérique du Vogel", es: "Teleférico del Vogel" },

  // ── bazni žetoni skript (NLU INTEREST_RULES + Start Anywhere
  //    TYPE_INTERESTS), ki med čipi ne nastopajo samostojno ───────────────
  gora: { en: "mountain", it: "montagna", de: "Berg", fr: "montagne", es: "montaña" },
  jezero: { en: "lake", it: "lago", de: "See", fr: "lac", es: "lago" },
  morje: { en: "sea", it: "mare", de: "Meer", fr: "mer", es: "mar" },
  kulinarika: { en: "cuisine", it: "cucina", de: "Küche", fr: "gastronomie", es: "gastronomía" },
  kolo: { en: "cycling", it: "ciclismo", de: "Radfahren", fr: "cyclisme", es: "ciclismo" },
  jame: { en: "caves", it: "grotte", de: "Höhlen", fr: "grottes", es: "cuevas" },
  soteska: { en: "gorge", it: "gola", de: "Schlucht", fr: "gorge", es: "garganta" },
  grad: { en: "castle", it: "castello", de: "Burg", fr: "château", es: "castillo" },
  reka: { en: "river", it: "fiume", de: "Fluss", fr: "rivière", es: "río" },
};

/**
 * Prikazno ime žetona interesa v jeziku vmesnika.
 *  - sl → surov žeton (slovenščina je kanon podatkov);
 *  - neznan žeton → surov žeton (iskrena rezerva, nikoli skrito);
 *  - ujemanje po normText (male črke, brez diakritik) — robustno na
 *    velike/male začetnice in oblike čipov iz nabora.
 * Čista funkcija: isti (žeton, jezik) → isti prikaz.
 */
export function interestDisplay(token: string, locale: string | PickLocale): string {
  const lang = asPickLocale(locale);
  if (lang === "sl") return token;
  return INTEREST_DISPLAY[normText(token)]?.[lang] ?? token;
}
