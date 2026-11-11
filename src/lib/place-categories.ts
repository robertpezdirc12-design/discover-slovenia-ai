/**
 * KATEGORIJE KRAJEV (»Iščem:«) — preslikava v Overpass/Osm poizvedbe.
 *
 * Skriptno: uporabnik izbere kategorijo (muzeji, restavracije, hoteli …)
 * in območje (država/zemljevid), mi poiščemo kraje prek Overpassa in jih
 * pokažemo na zemljevidu. Brez AI, brez ključev.
 */

export type PlaceCategoryId =
  | 'muzeji'
  | 'restavracije'
  | 'kavarne'
  | 'barji'
  | 'hoteli'
  | 'kampi'
  | 'znamenitosti'
  | 'sakralni'
  | 'sport'
  | 'prevoz'
  | 'bencinske'
  | 'lekarne'
  | 'bankomati'
  | 'posta'
  | 'parkirisca'
  | 'supermarketi';

export interface PlaceCategory {
  id: PlaceCategoryId;
  label: string;
  /** Overpass tag-fragment, npr. ["tourism"="museum"]. */
  tag: string;
  /** Barva markerja (hex). */
  color: string;
  /** Photon iskalni niz + osm_tag (dosegljiv povsod, ~1 s). */
  photonQ: string;
  photonTag: string;
}

export const PLACE_CATEGORIES: readonly PlaceCategory[] = [
  { id: 'muzeji', label: 'Muzeji', tag: '["tourism"="museum"]', color: '#7c3aed', photonQ: 'muzej', photonTag: 'tourism:museum' },
  { id: 'restavracije', label: 'Restavracije', tag: '["amenity"="restaurant"]', color: '#b91c1c', photonQ: 'restavracija', photonTag: 'amenity:restaurant' },
  { id: 'kavarne', label: 'Kavarne', tag: '["amenity"="cafe"]', color: '#a16207', photonQ: 'kavarna', photonTag: 'amenity:cafe' },
  { id: 'barji', label: 'Barji in pubi', tag: '["amenity"~"^(bar|pub|nightclub)$"]', color: '#831843', photonQ: 'bar', photonTag: 'amenity:bar' },
  { id: 'hoteli', label: 'Hoteli', tag: '["tourism"~"^(hotel|hostel)$"]', color: '#d97706', photonQ: 'hotel', photonTag: 'tourism:hotel' },
  { id: 'kampi', label: 'Kampi', tag: '["tourism"="camp_site"]', color: '#65a30d', photonQ: 'kamp', photonTag: 'tourism:camp_site' },
  { id: 'znamenitosti', label: 'Znamenitosti', tag: '["tourism"="attraction"]', color: '#0891b2', photonQ: 'znamenitost', photonTag: 'tourism:attraction' },
  { id: 'sakralni', label: 'Sakralni objekti', tag: '["amenity"="place_of_worship"]', color: '#6d28d9', photonQ: 'cerkev', photonTag: 'amenity:place_of_worship' },
  { id: 'sport', label: 'Športni objekti', tag: '["leisure"~"^(sports_centre|stadium)$"]', color: '#0369a1', photonQ: 'stadion', photonTag: 'leisure:sports_centre' },
  { id: 'prevoz', label: 'Prevoz (postaje)', tag: '["public_transport"~"^(stop_position|station)$"]', color: '#2563eb', photonQ: 'postaja', photonTag: 'railway:station' },
  { id: 'bencinske', label: 'Bencinske', tag: '["amenity"="fuel"]', color: '#4d7c0f', photonQ: 'bencinska', photonTag: 'amenity:fuel' },
  { id: 'lekarne', label: 'Lekarne', tag: '["amenity"="pharmacy"]', color: '#be185d', photonQ: 'lekarna', photonTag: 'amenity:pharmacy' },
  { id: 'bankomati', label: 'Bankomati', tag: '["amenity"="atm"]', color: '#334155', photonQ: 'bankomat', photonTag: 'amenity:atm' },
  { id: 'posta', label: 'Pošta', tag: '["amenity"="post_office"]', color: '#57534e', photonQ: 'pošta', photonTag: 'amenity:post_office' },
  { id: 'parkirisca', label: 'Parkirišča', tag: '["amenity"="parking"]', color: '#52525b', photonQ: 'parkirišče', photonTag: 'amenity:parking' },
  { id: 'supermarketi', label: 'Supermarketi', tag: '["shop"="supermarket"]', color: '#166534', photonQ: 'supermarket', photonTag: 'shop:supermarket' },
];

export function placeCategoryById(id: string): PlaceCategory | null {
  return PLACE_CATEGORIES.find((c) => c.id === id) ?? null;
}

/** Zajetje celega Balkana (za iskanje »po vsem Balkanu«). */
export const BALKAN_BBOX = '39.5,13.0,47.2,24.2';

/** Omejitveni okviri (bbox: south,west,north,east) za posamezne države.
 *  Uporabljeni pri `scope=country`, da iskanje omejimo na izbrano državo. */
export const COUNTRY_BBOX: Record<string, string> = {
  slovenija: '45.4,13.4,46.9,16.6',
  hrvaska: '42.2,13.5,46.5,19.5',
  'bosna-hercegovina': '42.4,15.7,45.3,19.7',
  srbija: '41.8,18.8,46.2,23.0',
  kosovo: '41.8,20.0,43.3,21.8',
  'crna-gora': '41.7,18.4,43.6,20.4',
  albanija: '39.6,19.2,42.7,21.2',
  'severna-makedonija': '40.8,20.4,42.4,23.0',
};

/** Večja mesta Balkana — rezerva za predloge območij, ko OSM ni dosegljiv.
 *  Vsak hub je označen z državo, da rezervo lahko omejimo na izbrano državo
 *  (in tako preprečimo, da bi se točke kazale »povsod«). Več mest na državo
 *  da je kurirana slika celotnega Balkana smiselna tudi brez Overpassa. */
export const FALLBACK_HUBS: readonly { name: string; lat: number; lng: number; country: string }[] = [
  // Slovenija
  { name: 'Ljubljana', lat: 46.0569, lng: 14.5058, country: 'slovenija' },
  { name: 'Maribor', lat: 46.5547, lng: 15.6459, country: 'slovenija' },
  { name: 'Celje', lat: 46.2312, lng: 15.2671, country: 'slovenija' },
  { name: 'Koper', lat: 45.5468, lng: 13.73, country: 'slovenija' },
  { name: 'Kranj', lat: 46.2389, lng: 14.3556, country: 'slovenija' },
  { name: 'Novo mesto', lat: 45.8049, lng: 15.1669, country: 'slovenija' },
  // Hrvaška
  { name: 'Zagreb', lat: 45.815, lng: 15.9819, country: 'hrvaska' },
  { name: 'Split', lat: 43.5081, lng: 16.4402, country: 'hrvaska' },
  { name: 'Rijeka', lat: 45.3271, lng: 14.4422, country: 'hrvaska' },
  { name: 'Osijek', lat: 45.555, lng: 18.6959, country: 'hrvaska' },
  { name: 'Zadar', lat: 44.1194, lng: 15.2314, country: 'hrvaska' },
  { name: 'Dubrovnik', lat: 42.6507, lng: 18.0944, country: 'hrvaska' },
  { name: 'Karlovac', lat: 45.4905, lng: 15.5512, country: 'hrvaska' },
  { name: 'Varaždin', lat: 46.3065, lng: 16.3365, country: 'hrvaska' },
  { name: 'Šibenik', lat: 43.7350, lng: 15.8950, country: 'hrvaska' },
  { name: 'Pula', lat: 44.8683, lng: 13.8480, country: 'hrvaska' },
  // Bosna in Hercegovina
  { name: 'Sarajevo', lat: 43.8563, lng: 18.4131, country: 'bosna-hercegovina' },
  { name: 'Mostar', lat: 43.3438, lng: 17.8078, country: 'bosna-hercegovina' },
  { name: 'Banja Luka', lat: 44.7722, lng: 17.191, country: 'bosna-hercegovina' },
  { name: 'Tuzla', lat: 44.5354, lng: 18.6759, country: 'bosna-hercegovina' },
  { name: 'Zenica', lat: 44.2017, lng: 17.9049, country: 'bosna-hercegovina' },
  { name: 'Trebinje', lat: 42.7105, lng: 18.3435, country: 'bosna-hercegovina' },
  // Srbija
  { name: 'Beograd', lat: 44.7866, lng: 20.4489, country: 'srbija' },
  { name: 'Novi Sad', lat: 45.2671, lng: 19.8335, country: 'srbija' },
  { name: 'Niš', lat: 43.3209, lng: 21.8956, country: 'srbija' },
  { name: 'Kragujevac', lat: 44.0143, lng: 20.928, country: 'srbija' },
  { name: 'Subotica', lat: 46.0979, lng: 19.6667, country: 'srbija' },
  { name: 'Čačak', lat: 43.8914, lng: 20.3497, country: 'srbija' },
  { name: 'Novi Pazar', lat: 43.1367, lng: 20.5122, country: 'srbija' },
  // Kosovo
  { name: 'Priština', lat: 42.6629, lng: 21.1655, country: 'kosovo' },
  { name: 'Prizren', lat: 42.2139, lng: 20.7396, country: 'kosovo' },
  { name: 'Peja', lat: 42.6606, lng: 20.287, country: 'kosovo' },
  { name: 'Gjakova', lat: 42.3817, lng: 20.43, country: 'kosovo' },
  { name: 'Gjilan', lat: 42.4625, lng: 21.4688, country: 'kosovo' },
  { name: 'Ferizaj', lat: 42.3703, lng: 21.1475, country: 'kosovo' },
  // Črna gora
  { name: 'Podgorica', lat: 42.4304, lng: 19.2594, country: 'crna-gora' },
  { name: 'Kotor', lat: 42.4247, lng: 18.7715, country: 'crna-gora' },
  { name: 'Budva', lat: 42.2864, lng: 18.8421, country: 'crna-gora' },
  { name: 'Bar', lat: 42.0922, lng: 19.1, country: 'crna-gora' },
  { name: 'Nikšić', lat: 42.7736, lng: 18.9475, country: 'crna-gora' },
  // Albanija
  { name: 'Tirana', lat: 41.3275, lng: 19.8187, country: 'albanija' },
  { name: 'Shkodër', lat: 42.0683, lng: 19.5126, country: 'albanija' },
  { name: 'Durrës', lat: 41.3089, lng: 19.4489, country: 'albanija' },
  { name: 'Vlorë', lat: 40.4667, lng: 19.4897, country: 'albanija' },
  { name: 'Fier', lat: 40.7239, lng: 19.5567, country: 'albanija' },
  { name: 'Berat', lat: 40.7058, lng: 19.9522, country: 'albanija' },
  { name: 'Gjirokastër', lat: 40.0758, lng: 20.1389, country: 'albanija' },
  // Severna Makedonija
  { name: 'Skopje', lat: 41.9973, lng: 21.428, country: 'severna-makedonija' },
  { name: 'Ohrid', lat: 41.1231, lng: 20.8016, country: 'severna-makedonija' },
  { name: 'Bitola', lat: 41.0289, lng: 21.329, country: 'severna-makedonija' },
  { name: 'Tetovo', lat: 42.0048, lng: 20.97, country: 'severna-makedonija' },
];

/** Kurirani predlogi območij (»{kategorija} — {mesto}«) — jasno označeni.
 *  Če podamo `country`, omejimo predloge na to državo, da rezerva ne kaže
 *  točk »povsod« po Balkanu (pravokotni bbox tega ne more natančno). */
export function buildFallbackPlaces(
  category: PlaceCategory,
  categoryId: PlaceCategoryId,
  country?: string,
): PlaceResult[] {
  const hubs = country ? FALLBACK_HUBS.filter((h) => h.country === country) : FALLBACK_HUBS;
  return hubs.map((hub, i) => ({
    id: `fb-${categoryId}-${i + 1}`,
    name: `${category.label} — ${hub.name}`,
    category: categoryId,
    lat: hub.lat,
    lng: hub.lng,
    curated: true,
  }));
}

/** Overpass URL-kompatibilna poizvedba za posamezno kategorijo. */
export function overpassPlacesQuery(category: PlaceCategory, bbox: string, limit = 30): string {
  return `[out:json][timeout:15];nwr[${category.tag}](bbox:${bbox});out center ${limit};`;
}

/** Razčleni Overpass odziv v enotne kraje (varstvo vnosa). */
export interface PlaceResult {
  id: string;
  name: string;
  category: PlaceCategoryId;
  lat: number;
  lng: number;
  /** Rezerva (kurirano območje) — OSM ni bil dosegljiv. */
  curated?: boolean;
  /** Kratek opis (kurirani katalogi, npr. muzeji v Sloveniji). */
  note?: string;
  /** Kraj/mesto (kurirani katalogi). */
  city?: string;
  /** Ulica/naslov (uradni registri). */
  address?: string;
  /** Vir zapisa: 'remk' (uradni razvid muzejev RS) ipd. */
  source?: string;
  /** Uradna spletna stran (kurirani katalog). */
  website?: string;
  /** Natančen naslov Wikipedijinega članka (iz Wikidata sitelinka) — za exact enrichment. */
  wikiTitle?: string;
}

export function parseOverpassPlaces(raw: unknown, categoryId: PlaceCategoryId): PlaceResult[] {
  if (!raw || typeof raw !== 'object') return [];
  const elements = (raw as { elements?: unknown[] }).elements;
  if (!Array.isArray(elements)) return [];
  const out: PlaceResult[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    if (!el || typeof el !== 'object') continue;
    const e = el as Record<string, unknown>;
    const id = typeof e.id === 'number' ? String(e.id) : '';
    if (!id || seen.has(id)) continue;
    const props = (e.tags ?? {}) as Record<string, unknown>;
    const name = typeof props.name === 'string' ? props.name.trim() : '';
    if (!name) continue;
    let lat = Number(e.lat);
    let lng = Number(e.lon);
    if (!Number.isFinite(lat) && e.center && typeof e.center === 'object') {
      const c = e.center as Record<string, unknown>;
      lat = Number(c.lat);
      lng = Number(c.lon);
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    seen.add(id);
    out.push({ id, name: name.slice(0, 120), category: categoryId, lat, lng });
    if (out.length >= 80) break;
  }
  return out;
}
