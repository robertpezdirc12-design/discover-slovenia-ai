/**
 * VODIČ PO ZEMLJEVIDU — cel Balkan (izrazita želja uporabnika):
 * "gum vklopi vodica ali isklopi za vse kraje balkana — vsa mesta, vse
 * vasi, vse kmečke turizme, vse kaj ponuja discover slovenia".
 *
 * Prag turneje: EN gumb Vklopi/Izklopi; ko je vklopljen, zemljevid sama
 * pelje uporabnika od kraja do kraja (poleti + pojavnokno opis + govor),
 * s filtri kategorij in napredkom "3 od 31".
 *
 * Čista plast (brez Reacta, brez `window`): katalog je urejen kot pot od
 * severozahoda Slovenije do Balkana — turneja je geografsko smiselna
 * potovanje, ne naključni skoki.
 *
 * POŠTENOST: katalog je UREJEN IZBOR realnih krajev (koordinate = OSM),
 * ni popolna baza vseh vasi in kmetij — to je v UI izrecno povedano
 * ("izbor krajev · polna baza sledi"). Kategorije: mesta, vasi, kmečki
 * turizem, narava — vsaka mora imeti vsaj dva vnosa (testi to zagotavljajo).
 */

export type MapGuideCategory = 'mesto' | 'vas' | 'kmecki' | 'narava';

export interface MapGuideCategoryInfo {
  id: MapGuideCategory;
  /** Oznaka filtra (čip): "Mesta", "Kmečki turizem" … */
  label: string;
  /** Samostalnik za pripoved/popup: "mesto", "kmečki turizem" … */
  noun: string;
}

export const MAP_GUIDE_CATEGORIES: readonly MapGuideCategoryInfo[] = [
  { id: 'mesto', label: 'Mesta', noun: 'mesto' },
  { id: 'vas', label: 'Vasi', noun: 'vas' },
  { id: 'kmecki', label: 'Kmečki turizem', noun: 'kmečki turizem' },
  { id: 'narava', label: 'Narava', noun: 'naravna znamenitost' },
] as const;

export function mapGuideCategoryLabel(id: MapGuideCategory): string {
  return MAP_GUIDE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function mapGuideCategoryNoun(id: MapGuideCategory): string {
  return MAP_GUIDE_CATEGORIES.find((c) => c.id === id)?.noun ?? id;
}

export interface MapGuidePlace {
  /** Enolični ključ (označevalci na karti, klik v turneji). */
  id: string;
  name: string;
  category: MapGuideCategory;
  /** Kratek opis — pojavnokno okno + govor vodiča. */
  note: string;
  lat: number;
  lng: number;
  /**
   * Naslov sl.Wikipedia članka za živi povzetek (odprti podatki, brez ključev).
   * Ni na voljo za vse — Šmartno (Brda) nima članka (izmerjeno 404), kjer
   * manjka, vodič preprosto ne pokaže povzetka (pošteno brez izmišljanja).
   */
  wikiTitle?: string;
}

/**
 * Urejen katalog — pot od severozahoda Slovenije čez vse regije do
 * srednje Jugo-vzhodne Evrope (Zagreb → Beograd → Skopje → Tirana).
 */
export const MAP_GUIDE_PLACES: readonly MapGuidePlace[] = [
  // ————— Gorenjska —————
  { id: 'nar-bled', name: 'Bled', category: 'narava', note: 'Jezerski otok in grad nad strmino', lat: 46.3625, lng: 14.0936, wikiTitle: 'Bled' },
  { id: 'mesto-kranj', name: 'Kranj', category: 'mesto', note: 'Khislstein in soteska Kokre', lat: 46.2412, lng: 14.2824, wikiTitle: 'Kranj' },
  { id: 'vas-kropa', name: 'Kropa', category: 'vas', note: 'Kovaška vas s staro fužino', lat: 46.2419, lng: 14.1644, wikiTitle: 'Kropa' },
  { id: 'vas-velika-planina', name: 'Velika Planina', category: 'vas', note: 'Planšarska vas nad Kamnikom', lat: 46.289, lng: 14.599, wikiTitle: 'Velika planina' },
  { id: 'nar-triglav', name: 'Triglav', category: 'narava', note: 'Najvišji vrh države (2 864 m)', lat: 46.3832, lng: 13.8366, wikiTitle: 'Triglav' },
  // ————— Primorska —————
  { id: 'nar-soca', name: 'Dolina Soče', category: 'narava', note: 'Smaragdna reka in panoramske poti', lat: 46.3377, lng: 13.5556, wikiTitle: 'Soča' },
  { id: 'vas-smartno', name: 'Šmartno (Brda)', category: 'vas', note: 'Slikovita vas med oljkami in vinogradi', lat: 45.9131, lng: 13.5962 },
  { id: 'vas-goce', name: 'Goče', category: 'vas', note: 'Vipavska vas z vinskimi kleti', lat: 45.845, lng: 13.689, wikiTitle: 'Goče' },
  { id: 'km-kras', name: 'Kmečki turizem na Krasu', category: 'kmecki', note: 'Pliskovica — pršut, teran in nočitev na domačiji', lat: 45.753, lng: 13.812, wikiTitle: 'Pliskovica' },
  { id: 'mesto-koper', name: 'Koper', category: 'mesto', note: 'Titojev trg in primorska pristaniška preteklost', lat: 45.5471, lng: 13.7294, wikiTitle: 'Koper' },
  { id: 'nar-skocjan', name: 'Škocjanske jame', category: 'narava', note: 'UNESCO kras z eno največjih podzemnih sotesk', lat: 45.6619, lng: 14.1614, wikiTitle: 'Škocjanske jame' },
  { id: 'nar-postojna', name: 'Postojnska jama', category: 'narava', note: 'Najobiskanejša jama Evrope s človeško ribico', lat: 45.7843, lng: 14.2145, wikiTitle: 'Postojnska jama' },
  // ————— Osrednja / Dolenjska —————
  { id: 'mesto-ljubljana', name: 'Ljubljana', category: 'mesto', note: 'Ljubljanica, grad in mestne tržnice', lat: 46.0569, lng: 14.5058, wikiTitle: 'Ljubljana' },
  { id: 'mesto-novo-mesto', name: 'Novo mesto', category: 'mesto', note: 'Bend na Krki — dolenjska prestolnica', lat: 45.8036, lng: 15.1681, wikiTitle: 'Novo mesto' },
  { id: 'km-bela', name: 'Kmečki turizem Bele krajine', category: 'kmecki', note: 'Dragatuš — belokranjska pogača in vinogradi', lat: 45.793, lng: 15.295, wikiTitle: 'Dragatuš' },
  // ————— Zasavje / Štajerska —————
  { id: 'mesto-celje', name: 'Celje', category: 'mesto', note: 'Stari grad in dediščina celjskih grofov', lat: 46.2306, lng: 15.2604, wikiTitle: 'Celje' },
  { id: 'nar-kozjansko', name: 'Kozjanski park', category: 'narava', note: 'Stare sadovnjake in grad Podsreda ohranja park', lat: 46.13, lng: 15.588, wikiTitle: 'Kozjanski park' },
  { id: 'vas-olimje', name: 'Olimje', category: 'vas', note: 'Frančiškanski samostan in čokoladnica v mlinu', lat: 46.166, lng: 15.642, wikiTitle: 'Olimje' },
  { id: 'km-lenar', name: 'Turizem Lenar', category: 'kmecki', note: 'Kmečki turizem pri Zrečah — glamping pod Pohorjem', lat: 46.383, lng: 15.356, wikiTitle: 'Zreče' },
  { id: 'nar-pohorje', name: 'Pohorje', category: 'narava', note: 'Šumišče, jezero in smučišče nad Mariborom', lat: 46.472, lng: 15.572, wikiTitle: 'Pohorje' },
  { id: 'mesto-maribor', name: 'Maribor', category: 'mesto', note: 'Najstarejša trta na svetu in Lent', lat: 46.5547, lng: 15.6459, wikiTitle: 'Maribor' },
  { id: 'mesto-ptuj', name: 'Ptuj', category: 'mesto', note: 'Najstarejše mesto države z gradom', lat: 46.4201, lng: 15.8693, wikiTitle: 'Ptuj' },
  // ————— Koroška / Goričko —————
  { id: 'mesto-slovenj-gradec', name: 'Slovenj Gradec', category: 'mesto', note: 'Mestni trg in galerija Koroške', lat: 46.5139, lng: 15.08, wikiTitle: 'Slovenj Gradec' },
  { id: 'km-solinc', name: 'Kmetija Šolinc', category: 'kmecki', note: 'Goričko — stara domačija s konji in čebelarstvom', lat: 46.693, lng: 16.033, wikiTitle: 'Goričko' },
  // ————— Balkan —————
  { id: 'mesto-zagreb', name: 'Zagreb', category: 'mesto', note: 'Gornji grad, Dolac in hrvaška prestolnica', lat: 45.815, lng: 15.9819, wikiTitle: 'Zagreb' },
  { id: 'mesto-mostar', name: 'Mostar', category: 'mesto', note: 'Stari most over Neretvo — UNESCO', lat: 43.3438, lng: 17.8111, wikiTitle: 'Mostar' },
  { id: 'mesto-sarajevo', name: 'Sarajevo', category: 'mesto', note: 'Baščaršija — srečanje Vzhoda in Zahoda', lat: 43.8563, lng: 18.4131, wikiTitle: 'Sarajevo' },
  { id: 'mesto-beograd', name: 'Beograd', category: 'mesto', note: 'Kalemegdan na sotočju Save in Donave', lat: 44.7866, lng: 20.4489, wikiTitle: 'Beograd' },
  { id: 'mesto-podgorica', name: 'Podgorica', category: 'mesto', note: 'Gorica, Morača in vrata črnogorskih gor', lat: 42.4304, lng: 19.2594, wikiTitle: 'Podgorica' },
  { id: 'mesto-skopje', name: 'Skopje', category: 'mesto', note: 'Kamen most in stara čaršija', lat: 41.9962, lng: 21.4319, wikiTitle: 'Skopje' },
  { id: 'mesto-tirana', name: 'Tirana', category: 'mesto', note: 'Skanderbegov trg in barvit Blvd Dëshmorët', lat: 41.3275, lng: 19.8189, wikiTitle: 'Tirana' },
] as const;

/** Meja Balkana za teste — vsi kraji kataloga morajo biti znotraj. */
export const MAP_GUIDE_BALKAN_BBOX = {
  minLat: 39,
  maxLat: 47.5,
  minLng: 13.2,
  maxLng: 23.2,
} as const;

export function isInBalkanBbox(lat: number, lng: number): boolean {
  return (
    lat >= MAP_GUIDE_BALKAN_BBOX.minLat &&
    lat <= MAP_GUIDE_BALKAN_BBOX.maxLat &&
    lng >= MAP_GUIDE_BALKAN_BBOX.minLng &&
    lng <= MAP_GUIDE_BALKAN_BBOX.maxLng
  );
}

/**
 * Filtriran katalog po kategorijah (vrstni red kataloga se ohranja).
 * Prazen seznam → prazen izid (UI onemogoči zadnjo kategorijo).
 */
export function placesForCategories(
  cats: readonly MapGuideCategory[],
): readonly MapGuidePlace[] {
  if (cats.length === 0) return [];
  const wanted = new Set(cats);
  return MAP_GUIDE_PLACES.filter((p) => wanted.has(p.category));
}

/** "3 od 31 · Celje" — za čip napredka turneje (izrečen bralcem zaslona). */
export function mapGuideProgressLabel(
  places: readonly MapGuidePlace[],
  index: number,
): string {
  if (places.length === 0) return '';
  const i = Math.max(0, Math.min(index, places.length - 1));
  return `${i + 1} od ${places.length} · ${places[i].name}`;
}

/** Govor vodiča: ime + opis (isti glas kot navigacija po poti). */
export function mapGuideSpeakText(place: MapGuidePlace): string {
  return `${place.name}. ${place.note}.`;
}
