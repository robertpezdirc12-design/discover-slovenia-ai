'use client';

import 'leaflet/dist/leaflet.css';
import type { CircleMarker as LeafletCircleMarker, Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BedDouble, CalendarDays, Check, ChevronLeft, ChevronRight, CloudSun, Compass, Flag, Landmark, List, Loader2, Map as MapIcon, MapPin, Mountain, Navigation, Palmtree, Pause, Play, Route, Search, Waves, Wine, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ARSO_LIDAR_ATTRIBUTION, arsoLidarTileUrl, formatElevation } from '@/lib/arso-lidar';
import {
  GUIDE_EVENT,
  GUIDE_REGIONS,
  addStayStop,
  emptyGuideState,
  isStayReserved,
  loadGuideState,
  saveGuideState,
  type GuideStorage,
  type GuideStayStop,
} from '@/lib/guide-store';
import { useGuideState } from '@/components/home/use-guide-state';
import { tripPlanFor, type TripStop } from '@/lib/trip-plan';
import {
  MAP_GUIDE_CATEGORIES,
  MAP_GUIDE_PLACES,
  mapGuideCategoryNoun,
  mapGuideProgressLabel,
  mapGuideSpeakText,
  placesForCategories,
  type MapGuideCategory,
} from '@/lib/map-guide';
import { STAY_KINDS, STAY_KIND_LABELS, type StayKind, type StayResult } from '@/lib/stays';
import {
  balkanCurrencyLines,
  countryFromDisplayName,
  holidaysLine,
  reverseTypeLabel,
  weatherOneLiner,
  wikiShort,
  type Holiday,
  type ReversePlace,
  type WeatherPayload,
  type WikiSummary,
} from '@/lib/open-data';
import { navChipText, navIsLast, navNext, navPrev, navProgressLabel } from '@/lib/route-guidance';
import type { OsrmLegInfo } from '@/lib/osrm-route';
import { SHOW_TRIP_EVENT, speak } from '@/lib/speech';

/**
 * POLIR15-a — sticky preklop brez z-index nasprotja z Leafletom:
 *   • mapa je zaprta v lasten stacking context (wrapper: `relative z-0 isolate`),
 *     tako da Leafletove interne vrednosti (pane ≈ 400, kontrole ≈ 1000)
 *     ne morejo prekriti sticky vrstice (`z-30`); Leaflet CSS NI spreminjan.
 *   • vrstica je `sticky top-14 z-30` — top-14 se ujema z višino lepljive glave.
 *
 * POLIR15-d — CLS skeleta zemljevida = 0:
 *   • EEN vir višine (`MAP_H`) za skeleton IN mapo; vsebina je `absolute inset-0`,
 *     tako da wrapper višine nikoli ne spremeni (0,023 → 0).
 */

const MAP_H = 'h-[420px] md:h-[520px]'; // ← enoten vir višine

/** Preferenca LiDAR relief sloja — trajna ("aplikacija si zapomni"). */
const LIDAR_PREF_KEY = 'dsa.lidar.relief';
const LIDAR_PREF_EVENT = 'dsa:lidar-pref';

/** useSyncExternalStore: localStorage je zunanja shramba (brez setState v efektih). */
function subscribeLidarPref(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(LIDAR_PREF_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(LIDAR_PREF_EVENT, onChange);
  };
}

function getLidarSnapshot(): boolean {
  try {
    return window.localStorage.getItem(LIDAR_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

function setLidarPref(value: boolean): void {
  try {
    window.localStorage.setItem(LIDAR_PREF_KEY, value ? '1' : '0');
  } catch {
    /* preferenca je prijetnost */
  }
  window.dispatchEvent(new Event(LIDAR_PREF_EVENT));
}

/** Višina na točko (ARSO LiDAR 1 m ali Copernicus 90 m): mirovanje → nalaganje → rezultat. */
type ElevationState =
  | { status: 'idle' }
  | { status: 'loading'; lat: number; lng: number }
  | { status: 'ok'; meters: number; label: string; license: string }
  | { status: 'error' };

const DESTINATIONS = [
  { name: 'Bled', region: 'Gorenjska', note: 'Jezerski otok in grad nad strmino', icon: Mountain, pos: [46.3625, 14.0936] as const },
  { name: 'Ljubljana', region: 'Osrednja Slovenija', note: 'Ljubljanica, grad in mestne tržnice', icon: CalendarDays, pos: [46.0569, 14.5058] as const },
  { name: 'Dolina Soče', region: 'Primorska', note: 'Smaragdna reka in panoramske poti', icon: Waves, pos: [46.3377, 13.5556] as const },
  { name: 'Piran', region: 'Primorska', note: 'Srednjeveški zaliv in soline', icon: Palmtree, pos: [45.528, 13.568] as const },
  { name: 'Maribor', region: 'Štajerska', note: 'Najstarejša trta na svetu in Pohorje', icon: Wine, pos: [46.5547, 15.6459] as const },
] as const;

function PinSvg() {
  // SVG čepkinja (brez slike — ni težav z bundler potmi Leafletovih ikon)
  return `<svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="#059669"/><circle cx="12" cy="12" r="4.5" fill="#ffffff"/></svg>`;
}

/** Jantarjeva čepkinja s posteljo — prenočišča (iskanje + rezervacije). */
function StayPinSvg() {
  return `<svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="#d97706"/><g stroke="#ffffff" stroke-width="1.6" fill="none" stroke-linecap="round" transform="translate(3.1,3.6) scale(0.75)"><path d="M3 16v-4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/><path d="M3 14h14"/><path d="M5 10V8a1 1 0 0 1 1-1h3v3"/><path d="M9 10V7h3a1 1 0 0 1 1 1v2"/></g></svg>`;
}

/** Spletne strani iz OSM včasih brez protokola — varno dopolni. */
function stayWebsiteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Iskanje prenočišč: mirovanje → nalaganje → zadetki / napaka. */
type StaySearchState =
  | { status: 'idle' }
  | { status: 'loading'; q: string }
  | { status: 'ok'; q: string; place: { name: string; lat: number; lng: number }; stays: StayResult[] }
  | { status: 'error'; q: string; message: string };

/** Fotografija prenočišča (zastopna, iskalnica): mirovanje → nalaganje → ok/napaka. */
type StayPhotoState = { status: 'idle' | 'loading' | 'ok' | 'error'; photos: string[] };

/** Živi odprti podatki vodiča: vreme+zrak ('loading' → podatek | null = ni na voljo). */
type LiveData<T> = 'loading' | T | null;

const EMPTY_STAYS: GuideStayStop[] = [];

/** Barve točk vodiča po kategorijah (označevalci + čipi filtra). */
const TOUR_COLORS: Record<MapGuideCategory, string> = {
  mesto: '#059669',
  vas: '#d97706',
  kmecki: '#ea580c',
  narava: '#0d9488',
};

export function MapSection() {
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [mapReady, setMapReady] = useState(false);
  const relief = useSyncExternalStore(subscribeLidarPref, getLidarSnapshot, () => false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const reliefLayerRef = useRef<unknown>(null);
  const LeafletRef = useRef<typeof import('leaflet') | null>(null);
  const [elevation, setElevation] = useState<ElevationState>({ status: 'idle' });
  const elevAbortRef = useRef<AbortController | null>(null);
  const elevMarkerRef = useRef<LeafletCircleMarker | null>(null);

  // MOJA POT: vodeni tok → zemljevid (rezultat vodiča je VIDEN na karti)
  const guide = useGuideState();
  const guideRegion =
    guide && guide.region && guide.answered.includes('region')
      ? (GUIDE_REGIONS.find((g) => g.id === guide.region) ?? null)
      : null;
  const plan = guideRegion ? tripPlanFor(guideRegion.id) : null;
  const [planDismissed, setPlanDismissed] = useState(false);
  const planLayerRef = useRef<unknown>(null);
  const planMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const planKey = guideRegion?.id ?? null;

  /** Klik na postanko v "Tvoji poti" → mapa pripotuje + odpre pojavnno okno. */
  const focusStop = (stop: TripStop) => {
    mapRef.current?.flyTo([stop.lat, stop.lng], 11, { duration: 1.2 });
    planMarkersRef.current.get(stop.name)?.openPopup();
  };

  // ————— PRENOČIŠČA: iskanje → slike/cena → »Rezerviraj« (samodejno shrani) —————
  const { toast } = useToast();
  const [stayQuery, setStayQuery] = useState('');
  const [stayKinds, setStayKinds] = useState<readonly StayKind[]>(STAY_KINDS);
  const [staySearch, setStaySearch] = useState<StaySearchState>({ status: 'idle' });
  const [stayPanelClosed, setStayPanelClosed] = useState(false);
  const [selectedStay, setSelectedStay] = useState<StayResult | null>(null);
  const [stayPhoto, setStayPhoto] = useState<StayPhotoState>({ status: 'idle', photos: [] });
  const [reserving, setReserving] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const photoAbortRef = useRef<AbortController | null>(null);
  const stayLayerRef = useRef<unknown>(null);
  const stayMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const reservedLayerRef = useRef<unknown>(null);
  const reservedMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const reservedStays = guide?.stays ?? EMPTY_STAYS;

  // ————— ODPRTI PODATKI BREZ POVERILNIC (vse živo izmerjeno): vreme+zrak,
  // Wikipedia, tečaji, prazniki — vstavljeno v vodič in prenočišča —————
  const [tourWeather, setTourWeather] = useState<LiveData<WeatherPayload>>('loading');
  const [tourWiki, setTourWiki] = useState<LiveData<WikiSummary>>('loading');
  const tourInfoAbortRef = useRef<AbortController | null>(null);
  const [stayWeather, setStayWeather] = useState<LiveData<WeatherPayload>>('loading');
  const stayWeatherAbortRef = useRef<AbortController | null>(null);
  const ratesRef = useRef<Record<string, number> | null>(null);
  const [stayRatesLine, setStayRatesLine] = useState<string | null>(null);
  const [stayHolidays, setStayHolidays] = useState<{ country: string; line: string } | null>(null);

  /** Iskanje prenočišč kjerkoli (Overpass je globalen — Skopje = Bled);
      kinds = podmnožica vrst (apartment → samo apartmaji, ves Balkan). */
  const runStaySearch = (raw: string, kinds: readonly StayKind[] = stayKinds) => {
    const q = raw.trim();
    if (q.length === 0) return;
    setStayQuery(q);
    setStayKinds(kinds);
    setSelectedStay(null);
    setStayPhoto({ status: 'idle', photos: [] });
    setStayHolidays(null);
    setStayPanelClosed(false);
    setStaySearch({ status: 'loading', q });
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const kindsParam = kinds.length !== STAY_KINDS.length ? `&kinds=${encodeURIComponent(kinds.join(','))}` : '';
    fetch(`/api/stays/search?q=${encodeURIComponent(q)}${kindsParam}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<{ ok: boolean; place?: { name: string; lat: number; lng: number; country?: string | null }; stays?: StayResult[]; error?: string }>)
      .then((j) => {
        if (controller.signal.aborted) return;
        if (j.ok && j.place && Array.isArray(j.stays)) {
          setStaySearch({ status: 'ok', q, place: j.place, stays: j.stays });
          mapRef.current?.flyTo([j.place.lat, j.place.lng], 12, { duration: 1.2 });
          // PRAZNIKI (Nager.Date, brez ključev) — po državi iskanega kraja;
          // pomagajo odločitvi kdaj potovati. Neznana država → brez vrstice.
          const iso = countryFromDisplayName(j.place.country ?? null);
          if (iso) {
            fetch(`/api/open-data/holidays?country=${iso}`, { signal: controller.signal })
              .then((r) => r.json() as Promise<{ ok: boolean; holidays?: Holiday[] }>)
              .then((hj) => {
                if (!controller.signal.aborted && hj.ok && Array.isArray(hj.holidays) && hj.holidays.length > 0) {
                  setStayHolidays({ country: iso, line: holidaysLine(hj.holidays) });
                }
              })
              .catch(() => {
                /* prazniki so prijetnost — iskanje je že uspešno */
              });
          }
        } else {
          setStaySearch({ status: 'error', q, message: j.error ?? 'Iskanje ni uspelo — poskusi znova.' });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStaySearch({ status: 'error', q, message: 'Iskanje trenutno ni na voljo — poskusi znova.' });
        }
      });
  };

  /** Klik na čip vrste: ena vrsta ↔ nazaj na vse; obstoječe iskanje se takoj ponovi. */
  const clickStayKind = (k: StayKind | 'all') => {
    const next: readonly StayKind[] = k === 'all' || (stayKinds.length === 1 && stayKinds[0] === k)
      ? STAY_KINDS
      : [k];
    if (staySearch.status !== 'idle' && stayQuery.trim().length > 0) runStaySearch(stayQuery, next);
    else setStayKinds(next);
  };

  /** Klik na prenočišče → podrobnosti (slika, vreme, tečaji v ozadju) + polet na karti. */
  const openStayDetail = (stay: StayResult) => {
    setSelectedStay(stay);
    setStayPanelClosed(false);
    setStayPhoto({ status: 'loading', photos: [] });
    setStayWeather('loading');
    // tečaji (er-api, brez ključev): enkrat na sejo — nato sinhr. pretvorba
    setStayRatesLine(ratesRef.current ? balkanCurrencyLines(stay.priceFrom, ratesRef.current) : null);
    mapRef.current?.flyTo([stay.lat, stay.lng], 14, { duration: 1.2 });
    stayMarkersRef.current.get(stay.id)?.openPopup();
    photoAbortRef.current?.abort();
    stayWeatherAbortRef.current?.abort();
    const controller = new AbortController();
    const weatherController = new AbortController();
    photoAbortRef.current = controller;
    stayWeatherAbortRef.current = weatherController;
    const city = staySearch.status === 'ok' ? staySearch.place.name : '';
    fetch(`/api/stays/photo?name=${encodeURIComponent(stay.name)}&city=${encodeURIComponent(city)}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<{ ok: boolean; photos?: string[] }>)
      .then((j) => {
        if (controller.signal.aborted) return;
        setStayPhoto(
          j.ok && Array.isArray(j.photos) && j.photos.length > 0
            ? { status: 'ok', photos: j.photos }
            : { status: 'error', photos: [] },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setStayPhoto({ status: 'error', photos: [] });
      });
    // VREME+ZRAK pri prenočišču (Open-Meteo/wttr.in — odločitev o nočitvi)
    fetch(`/api/open-data/weather?lat=${stay.lat.toFixed(4)}&lng=${stay.lng.toFixed(4)}`, { signal: weatherController.signal })
      .then((r) => r.json() as Promise<{ ok: boolean; weather?: WeatherPayload }>)
      .then((j) => {
        if (!weatherController.signal.aborted) setStayWeather(j.ok && j.weather ? j.weather : null);
      })
      .catch(() => {
        if (!weatherController.signal.aborted) setStayWeather(null);
      });
    // TEČAJI (enkrat na sejo; nato pretvorba sinhr.)
    if (!ratesRef.current) {
      fetch('/api/open-data/rates', { signal: weatherController.signal })
        .then((r) => r.json() as Promise<{ ok: boolean; rates?: Record<string, number> }>)
        .then((j) => {
          if (weatherController.signal.aborted || !j.ok || !j.rates) return;
          ratesRef.current = j.rates;
          setStayRatesLine(balkanCurrencyLines(stay.priceFrom, j.rates));
        })
        .catch(() => {
          /* tečaji so prijetnost — cena v EUR je že vidna */
        });
    }
  };

  /**
   * »Rezerviraj« — izrazita želja uporabnika: en klik SAMODEJNO shrani
   * prenočišče v »Mojo pot« in OPOZORI (toast + glas). Zapis tudi v bazi
   * (idempotentno); pravo plačilo pri objektu/uradni strani.
   */
  const reserveStay = (stay: StayResult) => {
    if (reserving || isStayReserved(guide, stay.id)) return;
    setReserving(true);
    const city = staySearch.status === 'ok' ? staySearch.place.name : '';
    fetch('/api/reservations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stayId: stay.id, name: stay.name, city, lat: stay.lat, lng: stay.lng, priceFrom: stay.priceFrom }),
    })
      .then((r) => r.json() as Promise<{ ok: boolean; already?: boolean; error?: string }>)
      .then((j) => {
        if (!j.ok) {
          toast({ title: 'Rezervacija ni uspela', description: j.error ?? 'Poskusi znova.', variant: 'destructive' });
          return;
        }
        try {
          const storage: GuideStorage = {
            getItem: (k) => window.localStorage.getItem(k),
            setItem: (k, v) => window.localStorage.setItem(k, v),
            removeItem: (k) => window.localStorage.removeItem(k),
          };
          const base = loadGuideState(storage) ?? emptyGuideState();
          saveGuideState(storage, addStayStop(base, { id: stay.id, name: stay.name, city, lat: stay.lat, lng: stay.lng, priceFrom: stay.priceFrom }));
          window.dispatchEvent(new CustomEvent(GUIDE_EVENT));
        } catch {
          /* shramba je prijetnost — rezervacija je že varna v bazi */
        }
        setPlanDismissed(false);  // plošča »Tvoja pot« se sama odpre — rezultat je VIDEN
        setStayPanelClosed(true); // rezultate pospravimo, pot je v ospredju
        toast({
          title: j.already ? 'Že shranjeno v tvojo pot' : 'Rezervirano — dodano v tvojo pot',
          description: `${stay.name} · od ${stay.priceFrom} €/noč (indikativno) · shranjeno v »Mojo pot«.`,
        });
        speak(`Rezervacija shranjena v tvojo pot: ${stay.name}.`, guide?.voiceEnabled ?? false);
        setSelectedStay(null);
      })
      .catch(() => toast({ title: 'Rezervacija ni uspela', description: 'Strežnik ni dosegljiv — poskusi znova.', variant: 'destructive' }))
      .finally(() => setReserving(false));
  };

  // nova regija v vodiču → plošča se znova pokaže (uporabnik vidi rezultat)
  useEffect(() => {
    setPlanDismissed(false);
  }, [planKey]);

  // ————— NAVIGACIJA PO POTI (postanek-po-postanku do destinacije) —————
  const [navIndex, setNavIndex] = useState<number | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ legs: OsrmLegInfo[]; totalKm: number } | null>(null);
  const [routeFailed, setRouteFailed] = useState(false);
  const routeAbortRef = useRef<AbortController | null>(null);
  const routeLayerRef = useRef<unknown>(null);
  const planRef = useRef<readonly TripStop[] | null>(null);
  planRef.current = plan;
  const navActive = navIndex !== null;

  // ————— VODIČ PO ZEMLJEVIDU (cel Balkan: mesta · vasi · kmečki · narava) —————
  // EN gumb vklopi/izklopi; ko je vklopljen, zemljevid SAMA pelje uporabnika
  // od kraja do kraja (poleti + pojavno okno + govor), s filtri kategorij.
  const [tourOn, setTourOn] = useState(false);
  const [tourPaused, setTourPaused] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [tourCats, setTourCats] = useState<readonly MapGuideCategory[]>(['mesto', 'vas', 'kmecki', 'narava']);
  const tourLayerRef = useRef<unknown>(null);
  const tourMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const tourPlaces = useMemo(() => placesForCategories(tourCats), [tourCats]);
  const catCounts = useMemo(() => {
    const m: Record<MapGuideCategory, number> = { mesto: 0, vas: 0, kmecki: 0, narava: 0 };
    for (const p of MAP_GUIDE_PLACES) m[p.category] += 1;
    return m;
  }, []);
  const voiceOn = guide?.voiceEnabled ?? false;

  const startTour = () => {
    setTourOn(true);
    setTourPaused(false);
    setTourIndex(0);
  };
  const stopTour = () => {
    setTourOn(false);
    setTourPaused(false);
    setTourIndex(0);
  };
  const tourNext = () => setTourIndex((i) => (tourPlaces.length ? (i + 1) % tourPlaces.length : 0));
  const tourPrev = () => setTourIndex((i) => (tourPlaces.length ? (i - 1 + tourPlaces.length) % tourPlaces.length : 0));
  const toggleTourCat = (c: MapGuideCategory) => {
    setTourCats((prev) => {
      if (prev.includes(c)) return prev.length === 1 ? prev : prev.filter((x) => x !== c);
      return [...prev, c];
    });
    setTourIndex(0);
  };

  /** Poleti na postanko + odpre opis + izgovor napredek (glasovno vodenje). */
  const gotoStop = (i: number) => {
    if (!plan || i < 0 || i >= plan.length) return;
    const stop = plan[i];
    mapRef.current?.flyTo([stop.lat, stop.lng], 11, { duration: 1.2 });
    planMarkersRef.current.get(stop.name)?.openPopup();
    speak(navProgressLabel(plan, i), guide?.voiceEnabled ?? false);
  };

  const removeRouteLayer = () => {
    const L = LeafletRef.current;
    if (routeLayerRef.current && L) (routeLayerRef.current as L.Polyline).remove();
    routeLayerRef.current = null;
  };

  /** Zaključi navigacijo — nazaj na ploščo postankov. */
  const endNavigation = () => {
    setNavIndex(null);
    setRouteInfo(null);
    setRouteFailed(false);
    routeAbortRef.current?.abort();
    removeRouteLayer();
  };

  // nova regija → navigacija se resetira (nova pot, nov začetek)
  useEffect(() => {
    setNavIndex(null);
    setRouteInfo(null);
    setRouteFailed(false);
    routeAbortRef.current?.abort();
  }, [planKey]);

  // pot na karti: prava cestna (OSRM posrednik) ali premočrtna rezerva
  const routeKey = plan ? plan.map((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`).join(';') : null;
  useEffect(() => {
    const L = LeafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    // vsaka sprememba poti/navigacije počisti prejšnjo linijo
    if (routeLayerRef.current) (routeLayerRef.current as L.Polyline).remove();
    routeLayerRef.current = null;
    if (!navActive || !plan || !routeKey) return;

    const stopsParam = plan.map((s) => `${s.lat},${s.lng}`).join(';');
    const controller = new AbortController();
    routeAbortRef.current = controller;

    const drawStraight = () => {
      if (routeLayerRef.current) (routeLayerRef.current as L.Polyline).remove();
      routeLayerRef.current = L.polyline(
        plan.map((s) => [s.lat, s.lng] as [number, number]),
        { color: '#059669', weight: 4, opacity: 0.7, dashArray: '6 8' },
      ).addTo(map);
    };

    fetch(`/api/osrm/route?stops=${encodeURIComponent(stopsParam)}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<{ ok: boolean; coords?: [number, number][]; legs?: OsrmLegInfo[]; totalKm?: number }>)
      .then((j) => {
        if (controller.signal.aborted) return;
        const coords = j.ok && Array.isArray(j.coords) && j.coords.length > 1 ? j.coords : null;
        if (coords && j.legs) {
          setRouteInfo({ legs: j.legs, totalKm: j.totalKm ?? 0 });
          setRouteFailed(false);
        } else {
          setRouteFailed(true);
        }
        routeLayerRef.current = L.polyline(coords ?? plan.map((s) => [s.lat, s.lng] as [number, number]), {
          color: '#059669',
          weight: 4,
          opacity: 0.8,
          dashArray: coords ? undefined : '6 8',
        }).addTo(map);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setRouteFailed(true);
        drawStraight();
      });
    return () => controller.abort();
  }, [routeKey, navActive, mapReady]);

  // čiščenje plana ob odstranitvi mape
  useEffect(() => {
    return () => {
      planLayerRef.current = null;
      planMarkersRef.current = new Map();
      routeLayerRef.current = null;
    };
  }, []);

  // označevalci plana — vsaka sprememba regije osveži plast
  useEffect(() => {
    const L = LeafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (planLayerRef.current) {
      (planLayerRef.current as L.LayerGroup).remove();
      planLayerRef.current = null;
      planMarkersRef.current = new Map();
    }
    if (!plan) return;
    const group = L.layerGroup();
    const icon = L.divIcon({
      className: 'dsa-pin-plan',
      html: PinSvg(),
      iconSize: [24, 32],
      iconAnchor: [12, 32],
    });
    plan.forEach((stop) => {
      const m = L.marker([stop.lat, stop.lng], { icon, title: stop.name, zIndexOffset: 500 })
        .addTo(group)
        .bindPopup(`<strong>${stop.name}</strong><br/>${stop.note}`);
      planMarkersRef.current.set(stop.name, m);
    });
    planLayerRef.current = group.addTo(map);
  }, [plan, mapReady]);

  // VODIČ PO ZEMLJEVIDU: oznake turneje — barvne točke po kategorijah
  // (samo ko je vodič vklopljen; izklop jih pospravi).
  useEffect(() => {
    const L = LeafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (tourLayerRef.current) {
      (tourLayerRef.current as L.LayerGroup).remove();
      tourLayerRef.current = null;
      tourMarkersRef.current = new Map();
    }
    if (!tourOn || tourPlaces.length === 0) return;
    const group = L.layerGroup();
    tourPlaces.forEach((p, i) => {
      const icon = L.divIcon({
        className: 'dsa-pin-tour',
        html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${TOUR_COLORS[p.category]};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></span>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const m = L.marker([p.lat, p.lng], {
        icon,
        title: `${p.name} — ${mapGuideCategoryNoun(p.category)}`,
        zIndexOffset: 300,
      })
        .addTo(group)
        .bindPopup(`<strong>${p.name}</strong><br/>${mapGuideCategoryNoun(p.category)} · ${p.note}`);
      m.on('click', () => setTourIndex(i));
      tourMarkersRef.current.set(p.id, m);
    });
    tourLayerRef.current = group.addTo(map);
  }, [tourOn, tourPlaces, mapReady]);

  // izbor kategorij se skrči → indeks varno nazaj na začetek
  useEffect(() => {
    if (tourIndex >= tourPlaces.length) setTourIndex(0);
  }, [tourIndex, tourPlaces.length]);

  // polet na trenutni kraj + pojavno okno + govor (isti glas kot navigacija)
  useEffect(() => {
    if (!tourOn || tourPlaces.length === 0 || !mapReady) return;
    const i = Math.max(0, Math.min(tourIndex, tourPlaces.length - 1));
    const p = tourPlaces[i];
    mapRef.current?.flyTo([p.lat, p.lng], p.category === 'mesto' ? 10 : 11, { duration: 1.2 });
    tourMarkersRef.current.get(p.id)?.openPopup();
    speak(mapGuideSpeakText(p), voiceOn);
  }, [tourOn, tourIndex, tourPlaces, voiceOn, mapReady]);

  // samodejni napredek — 7 s na kraj; premor ustavi, ▶ nadaljuje
  useEffect(() => {
    if (!tourOn || tourPaused || tourPlaces.length === 0) return;
    const t = window.setInterval(() => {
      setTourIndex((i) => (i + 1) % tourPlaces.length);
    }, 7000);
    return () => window.clearInterval(t);
  }, [tourOn, tourPaused, tourPlaces.length]);

  // ŽIVI ODPRTI PODATKI kraja turneje: vreme+zrak (Open-Meteo/wttr.in) +
  // Wikipedia povzetek (če naslov obstaja) — ena vrstica v kontrolnem traku.
  useEffect(() => {
    if (!tourOn || tourPlaces.length === 0) return;
    const i = Math.max(0, Math.min(tourIndex, tourPlaces.length - 1));
    const p = tourPlaces[i];
    tourInfoAbortRef.current?.abort();
    const controller = new AbortController();
    tourInfoAbortRef.current = controller;
    setTourWeather('loading');
    setTourWiki(p.wikiTitle ? 'loading' : null);
    fetch(`/api/open-data/weather?lat=${p.lat.toFixed(4)}&lng=${p.lng.toFixed(4)}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<{ ok: boolean; weather?: WeatherPayload }>)
      .then((j) => {
        if (!controller.signal.aborted) setTourWeather(j.ok && j.weather ? j.weather : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setTourWeather(null);
      });
    if (p.wikiTitle) {
      fetch(`/api/open-data/wiki?title=${encodeURIComponent(p.wikiTitle)}`, { signal: controller.signal })
        .then((r) => r.json() as Promise<{ ok: boolean; wiki?: WikiSummary | null }>)
        .then((j) => {
          if (!controller.signal.aborted) setTourWiki(j.ok ? (j.wiki ?? null) : null);
        })
        .catch(() => {
          if (!controller.signal.aborted) setTourWiki(null);
        });
    }
    return () => controller.abort();
  }, [tourOn, tourIndex, tourPlaces]);

  // nova rezervacija → plošča »Tvoja pot« se sama odpre (uporabnik VIDI zapis)
  useEffect(() => {
    if (reservedStays.length > 0) setPlanDismissed(false);
  }, [reservedStays.length]);

  // oznake REZERVIRANIH prenočišč — trajne (iz shrambe, ob vrnitvi spet vidne)
  useEffect(() => {
    const L = LeafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (reservedLayerRef.current) {
      (reservedLayerRef.current as L.LayerGroup).remove();
      reservedLayerRef.current = null;
      reservedMarkersRef.current = new Map();
    }
    if (reservedStays.length === 0) return;
    const group = L.layerGroup();
    const icon = L.divIcon({ className: 'dsa-pin-stay', html: StayPinSvg(), iconSize: [24, 32], iconAnchor: [12, 32] });
    reservedStays.forEach((s) => {
      const price = s.priceFrom != null ? ` · od ${s.priceFrom} €/noč` : '';
      const m = L.marker([s.lat, s.lng], { icon, title: s.name, zIndexOffset: 700 })
        .addTo(group)
        .bindPopup(`<strong>${s.name}</strong><br/>Rezervirano v tvoji poti · ${s.city}${price}`);
      reservedMarkersRef.current.set(s.id, m);
    });
    reservedLayerRef.current = group.addTo(map);
  }, [reservedStays, mapReady]);

  // oznake ZADETKOV iskanja — začasne (novo iskanje jih počisti)
  useEffect(() => {
    const L = LeafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (stayLayerRef.current) {
      (stayLayerRef.current as L.LayerGroup).remove();
      stayLayerRef.current = null;
      stayMarkersRef.current = new Map();
    }
    if (staySearch.status !== 'ok' || staySearch.stays.length === 0) return;
    const group = L.layerGroup();
    const icon = L.divIcon({ className: 'dsa-pin-stay', html: StayPinSvg(), iconSize: [24, 32], iconAnchor: [12, 32] });
    staySearch.stays.forEach((s) => {
      const stars = s.stars != null ? ` · ${'★'.repeat(s.stars)}` : '';
      const m = L.marker([s.lat, s.lng], { icon, title: s.name, zIndexOffset: 600 })
        .addTo(group)
        .bindPopup(`<strong>${s.name}</strong><br/>${STAY_KIND_LABELS[s.kind]}${stars} · od ${s.priceFrom} €/noč (indikativno)`);
      stayMarkersRef.current.set(s.id, m);
    });
    stayLayerRef.current = group.addTo(map);
  }, [staySearch, mapReady]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current || mapRef.current) return;
      LeafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: [46.12, 14.82],
        zoom: 8,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      tiles.on('load', () => setMapReady(true));
      // varovalka: če strežnik s ploščicami ne odgovori, skeleton vseeno sprosti
      const fallback = window.setTimeout(() => setMapReady(true), 3000);

      const icon = L.divIcon({ className: 'dsa-pin', html: PinSvg(), iconSize: [24, 32], iconAnchor: [12, 32] });
      DESTINATIONS.forEach((d) =>
        L.marker([d.pos[0], d.pos[1]], { icon, title: d.name })
          .addTo(map)
          .bindTooltip(`${d.name} — ${d.region}`),
      );

      // VODENI TOK: regija iz shranjenih odgovorov → mapa lepo pripotuje.
      const flyToGuideRegion = () => {
        try {
          const st = loadGuideState(window.localStorage as unknown as Parameters<typeof loadGuideState>[0]);
          const region = st ? GUIDE_REGIONS.find((g) => g.id === st.region) : null;
          if (region) map.flyTo([region.lat, region.lng], 10, { duration: 1.2 });
        } catch {
          /* vodenje je prijetnost — mapa deluje brez njega */
        }
      };
      flyToGuideRegion();
      window.addEventListener(GUIDE_EVENT, flyToGuideRegion);

      // "Pokaži tvojo pot" iz vodiča → SAMODEJNO odpre navigacijo na prvi postanki
      // (izrazita želja uporabnika: "ko konča z vnašanjem, se odpre navigacija")
      const onShowTrip = () => {
        const stops = planRef.current;
        if (!stops || stops.length === 0) return;
        setNavIndex(0);
        const first = stops[0];
        map.flyTo([first.lat, first.lng], 11, { duration: 1.2 });
        planMarkersRef.current.get(first.name)?.openPopup();
      };
      window.addEventListener(SHOW_TRIP_EVENT, onShowTrip);

      // VIŠINA NA TOČKO (ARSO DMR/LiDAR, 1 m) + OBRATNO GEOCODIRANJE
      // (Nominatim — "kaj je tukaj?"): klik → posrednika /api/arso/elevation in
      // /api/open-data/reverse (oba fair-use: predpomnilnik na strežniku;
      // brskalnik ne kliče virov direktno — CORS/User-Agent pravila).
      map.on({
        click: (e: { latlng: { lat: number; lng: number } }) => {
          const { lat, lng } = e.latlng;
          elevAbortRef.current?.abort();
          const controller = new AbortController();
          elevAbortRef.current = controller;
          setElevation({ status: 'loading', lat, lng });

          if (elevMarkerRef.current) elevMarkerRef.current.remove();
          const marker = L.circleMarker([lat, lng], {
            radius: 6,
            color: '#059669',
            fillColor: '#059669',
            fillOpacity: 0.85,
          }).addTo(map);
          marker.bindPopup('Višina …').openPopup();
          elevMarkerRef.current = marker;

          // pojavno okno združi ime (reverse) + višino (ARSO/Copernicus) —
          // vsak prispe: kdo pride prej, dopiše; nikoli ne prepiše drugega
          let revText: string | null = null;
          let elevText: string | null = null;
          const updatePopup = () => {
            const parts = [revText, elevText].filter(Boolean);
            marker.setPopupContent(parts.length > 0 ? parts.join(' · ') : 'Višina …');
          };

          fetch(`/api/open-data/reverse?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`, {
            signal: controller.signal,
          })
            .then((r) => r.json() as Promise<{ ok: boolean; place?: ReversePlace | null }>)
            .then((j) => {
              if (controller.signal.aborted) return;
              if (j.ok && j.place) {
                const type = reverseTypeLabel(j.place.type);
                revText = `${j.place.name}${type ? ` (${type})` : ''}`;
                updatePopup();
              }
            })
            .catch(() => {
              /* obratno geokodiranje je prijetnost — višina je glavni odgovor */
            });

          fetch(`/api/arso/elevation?lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}`, {
            signal: controller.signal,
          })
            .then((r) => r.json() as Promise<{ ok: boolean; elevationM?: number; label?: string; license?: string }>)
            .then((j) => {
              if (controller.signal.aborted) return;
              if (j.ok && typeof j.elevationM === 'number') {
                setElevation({
                  status: 'ok',
                  meters: j.elevationM,
                  label: j.label ?? 'DEM',
                  license: j.license ?? '',
                });
                elevText = `Višina: ${formatElevation(j.elevationM)} — ${j.label ?? 'DEM'}${j.license ? ` · ${j.license}` : ''}`;
                updatePopup();
              } else {
                setElevation({ status: 'error' });
                elevText = 'Višina trenutno ni na voljo';
                updatePopup();
              }
            })
            .catch(() => {
              if (controller.signal.aborted) return;
              setElevation({ status: 'error' });
              elevText = 'Višina trenutno ni na voljo';
              updatePopup();
            });
        },
      });

      map.on('unload', () => {
        window.clearTimeout(fallback);
        window.removeEventListener(GUIDE_EVENT, flyToGuideRegion);
        window.removeEventListener(SHOW_TRIP_EVENT, onShowTrip);
      });
    })();

    return () => {
      cancelled = true;
      elevAbortRef.current?.abort();
      mapRef.current?.remove();
      mapRef.current = null;
      reliefLayerRef.current = null;
      elevMarkerRef.current = null;
    };
  }, []);

  // LiDAR relief sloj — dinamični izvoz ARSO (ena zahteva na ploščico, fair-use)
  useEffect(() => {
    const L = LeafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    if (relief && !reliefLayerRef.current) {
      const ReliefLayer = (L.GridLayer as unknown as {
        extend(def: {
          options?: object;
          createTile: (coords: { x: number; y: number; z: number }) => HTMLElement;
        }): new (options?: object) => L.GridLayer;
      }).extend({
        options: {
          attribution: ARSO_LIDAR_ATTRIBUTION,
          tileSize: 256,
          updateWhenIdle: true,
          keepBuffer: 1,
        },
        createTile(coords: { x: number; y: number; z: number }) {
          const tile = document.createElement('img');
          tile.src = arsoLidarTileUrl(coords.x, coords.y, coords.z);
          tile.alt = '';
          tile.style.opacity = '0.85';
          return tile;
        },
      });
      const layer = new ReliefLayer();
      layer.setZIndex(50);
      reliefLayerRef.current = layer.addTo(map);
    } else if (!relief && reliefLayerRef.current) {
      (reliefLayerRef.current as L.GridLayer).remove();
      reliefLayerRef.current = null;
    }
  }, [relief, mapReady]);

  // čiščenje plana + prenočišč + odprtih podatkov ob odstranitvi mape
  useEffect(() => {
    return () => {
      planLayerRef.current = null;
      planMarkersRef.current = new Map();
      stayLayerRef.current = null;
      reservedLayerRef.current = null;
      tourLayerRef.current = null;
      tourMarkersRef.current = new Map();
      photoAbortRef.current?.abort();
      searchAbortRef.current?.abort();
      tourInfoAbortRef.current?.abort();
      stayWeatherAbortRef.current?.abort();
    };
  }, []);

  return (
    <section id="zemljevid" aria-labelledby="map-heading" className="mx-auto w-full scroll-mt-20 max-w-6xl px-4 sm:px-6">
      <h2 id="map-heading" className="sr-only">
        Zemljevid destinacij s preklopilem pogledom
      </h2>

      {/* POLIR15-a: sticky preklop — leži NAD izolirano mapo (z-30 > kontekst z-0) */}
      <div className="sticky top-14 z-30 -mx-2 mt-6 mb-4 rounded-xl border bg-background/90 px-3 py-2.5 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapIcon className="size-4 text-emerald-600" aria-hidden />
            <Label htmlFor="view-toggle" className="text-sm font-medium">
              Zemljevid / seznam
            </Label>
          </div>
          {/* višina na točko — izrečena tudi bralcem zaslona (aria-live) */}
          <span aria-live="polite" className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            {elevation.status === 'loading' && (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Višina …
              </>
            )}
            {elevation.status === 'ok' && (
              <>
                <Mountain className="size-3.5 text-stone-600" aria-hidden />
                {formatElevation(elevation.meters)}
                <span className="hidden md:inline">· {elevation.label}</span>
              </>
            )}
            {elevation.status === 'error' && (
              <>
                <Mountain className="size-3.5 text-stone-400" aria-hidden />
                višina ni na voljo
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">
              {mode === 'map' ? 'Zemljevid' : 'Seznam'} · CLS 0
            </Badge>
            <div className="flex items-center gap-1.5">
              <Mountain className="size-3.5 text-stone-600" aria-hidden />
              <Label htmlFor="lidar-toggle" className="text-xs text-muted-foreground">
                LiDAR relief
              </Label>
              <Switch
                id="lidar-toggle"
                checked={relief}
                onCheckedChange={setLidarPref}
                aria-label={relief ? 'Izklopi LiDAR relief (ARSO)' : 'Vklopi LiDAR relief (ARSO, CC BY 4.0)'}
              />
            </div>
            <Switch
              id="view-toggle"
              checked={mode === 'map'}
              onCheckedChange={(v) => setMode(v ? 'map' : 'list')}
              aria-label={mode === 'map' ? 'Preklopi na seznam' : 'Preklopi na zemljevid'}
            />
          </div>
        </div>
      </div>

      {/* PRENOČIŠČA — iskalna vrstica: aplikacija VODI (vzorci + izrečeno stanje).
          Klik na vzorec = en klik do zadetkov; dela povsod (Skopje, Zagreb …). */}
      <div className="mt-4 rounded-xl border bg-background/90 px-3 py-2.5 shadow-sm">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            runStaySearch(stayQuery);
          }}
        >
          <div className="flex flex-1 items-center gap-2">
            <BedDouble className="size-4 shrink-0 text-amber-600" aria-hidden />
            <Input
              id="stay-search-input"
              value={stayQuery}
              onChange={(e) => setStayQuery(e.target.value)}
              placeholder="Išči prenočišča — npr. Skopje, Bled, Zagreb"
              aria-label="Iskanje prenočišč po imenu kraja"
              className="h-11 sm:h-9"
              autoComplete="off"
            />
          </div>
          <Button type="submit" size="sm" className="h-11 sm:h-9" disabled={staySearch.status === 'loading'}>
            {staySearch.status === 'loading' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Search className="size-4" aria-hidden />
            )}
            Išči prenočišča
          </Button>
        </form>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Ne veš, kje? Poskusi:</span>
          {['Skopje', 'Bled', 'Zagreb'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => runStaySearch(c)}
              className="rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-muted"
              aria-label={`Išči prenočišča v ${c}`}
            >
              {c}
            </button>
          ))}
          <span aria-live="polite" className="ml-auto min-w-0 truncate text-xs text-muted-foreground">
            {staySearch.status === 'ok'
              ? staySearch.stays.length > 0
                ? `${staySearch.stays.length} prenočišč · ${staySearch.place.name}`
                : `Ni zadetkov za “${staySearch.place.name}” — poskusi širše ime`
              : staySearch.status === 'error'
                ? staySearch.message
                : ''}
          </span>
        </div>
        {/* VRSTA PRENOČIŠČA — apartmaji za cel Balkan, hoteli, gostišča …
            Strežniški filter (Overpass + Photon dobita samo izbrane vrste,
            zato meja 24 zadetkov ne pogrešne izbranih). Klik na aktivni
            čip vrne nazaj na vse vrste. */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2">
          <span className="text-xs text-muted-foreground">Vrsta:</span>
          <button
            type="button"
            aria-pressed={stayKinds.length === STAY_KINDS.length}
            onClick={() => clickStayKind('all')}
            className={`inline-flex min-h-11 items-center rounded-full border px-3 py-1 text-xs transition-colors sm:min-h-8 sm:px-2.5 sm:py-0.5 ${
              stayKinds.length === STAY_KINDS.length
                ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-800'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Vse
          </button>
          {STAY_KINDS.map((k) => {
            const active = stayKinds.length === 1 && stayKinds[0] === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={active}
                onClick={() => clickStayKind(k)}
                className={`inline-flex min-h-11 items-center rounded-full border px-3 py-1 text-xs transition-colors sm:min-h-8 sm:px-2.5 sm:py-0.5 ${
                  active ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-800' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {STAY_KIND_LABELS[k]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Enoten vir višine: skeleton, mapa in seznam so absolutni znotraj te škatle */}
      <div className={`relative w-full overflow-hidden rounded-xl border bg-muted ${MAP_H}`}>
        {/* POLIR15-a: izolacija — vse Leaflet z-index pane ostanejo tu znotraj */}
        <div className={`absolute inset-0 z-0 isolate ${mode === 'map' ? '' : 'pointer-events-none opacity-0'}`}>
          <div ref={containerRef} className="h-full w-full" aria-label="Interaktivni zemljevid Slovenije" role="application" />
        </div>

        {/* MOJA POT: rezultat vodenega toka + rezervacij — vidna plošča nad kartou.
            Klik na postanko → mapa pripotuje + odpre opis (aplikacija vodi).
            Plošča se pokaže TUDI samo z rezerviranimi prenočišči (uporabnik,
            ki izpusti vodnik, ni puščen brez vidnega rezultata). */}
        {mode === 'map' && !planDismissed && (guideRegion || reservedStays.length > 0) && (
          <aside
            aria-label="Tvoja pot — postanke in prenočišča"
            className="absolute left-3 top-3 z-20 w-[min(280px,calc(100%-1.5rem))] overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur"
          >
            <div className="flex items-center gap-2 border-b bg-emerald-600/5 px-3 py-2">
              <Route className="size-4 shrink-0 text-emerald-600" aria-hidden />
              <p className="min-w-0 truncate text-sm font-semibold">Tvoja pot</p>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto size-6"
                onClick={() => setPlanDismissed(true)}
                aria-label="Skrij ploščo Tvoja pot"
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </div>
            {/* NAVIGACIJA PO POTI: postanek-po-postanku vodstvo (aria-live).
                Naprej/Nazaj vodita skozi postanke; zadnja = "Destinacija dosežena". */}
            {navIndex !== null && plan && (
              <div className="border-b bg-emerald-600/10 px-3 py-2" role="status" aria-live="polite">
                <div className="flex items-center gap-2">
                  <Navigation className="size-4 shrink-0 text-emerald-700" aria-hidden />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{navChipText(plan, navIndex)}</p>
                  <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={endNavigation}>
                    Končaj
                  </Button>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{navProgressLabel(plan, navIndex)}</p>
                {!navIsLast(plan, navIndex) && (
                  <p className="mt-0.5 text-xs font-medium text-emerald-800">
                    {routeInfo?.legs[navIndex] != null
                      ? `→ naslednja postanka: ${routeInfo.legs[navIndex].distanceKm} km · ${routeInfo.legs[navIndex].durationMin} min`
                      : routeFailed
                        ? '→ premočrtna linija (cesta trenutno ni na voljo)'
                        : '→ pot se išče …'}
                  </p>
                )}
                <div className="mt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1"
                    disabled={navIndex === 0}
                    onClick={() => {
                      const i = navPrev(plan, navIndex) ?? 0;
                      setNavIndex(i);
                      gotoStop(i);
                    }}
                  >
                    ← Nazaj
                  </Button>
                  {!navIsLast(plan, navIndex) ? (
                    <Button
                      size="sm"
                      className="h-7 flex-1"
                      onClick={() => {
                        const i = navNext(plan, navIndex) ?? navIndex;
                        setNavIndex(i);
                        gotoStop(i);
                      }}
                    >
                      Naprej →
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 flex-1" onClick={endNavigation}>
                      <Flag className="size-3.5" aria-hidden />
                      Zaključi obisk
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="max-h-[220px] overflow-y-auto nice-scroll p-2">
              {navIndex === null ? (
                <>
                  {guideRegion && (
                    <p className="px-1 pb-1.5 text-xs text-muted-foreground">{guideRegion.label}</p>
                  )}
                  {plan && (
                    <>
                      <Button
                        size="sm"
                        className="mb-1.5 w-full"
                        onClick={() => {
                          setNavIndex(0);
                          gotoStop(0);
                        }}
                      >
                        <Navigation className="size-3.5" aria-hidden />
                        Začni navigacijo po poti
                      </Button>
                      <div className="space-y-1">
                        {plan.map((stop) => (
                          <Button
                            key={stop.name}
                            size="sm"
                            variant="ghost"
                            className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-left"
                            onClick={() => focusStop(stop)}
                            aria-label={`Prikaži ${stop.name} na zemljevidu`}
                          >
                            <MapPin className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium leading-tight">{stop.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{stop.note}</span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                  {/* REZERVIRANA PRENOČIŠČA — del »Moje poti« (trajno shranjeno). */}
                  {reservedStays.length > 0 && (
                    <div className="mt-2 border-t pt-2">
                      <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">Tvoja rezervirana prenočišča</p>
                      <div className="space-y-1">
                        {reservedStays.map((s) => (
                          <Button
                            key={s.id}
                            size="sm"
                            variant="ghost"
                            className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-left"
                            onClick={() => {
                              mapRef.current?.flyTo([s.lat, s.lng], 14, { duration: 1.2 });
                              reservedMarkersRef.current.get(s.id)?.openPopup();
                            }}
                            aria-label={`Prikaži ${s.name} na zemljevidu`}
                          >
                            <BedDouble className="size-3.5 shrink-0 text-amber-600" aria-hidden />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium leading-tight">{s.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {s.city}
                                {s.priceFrom != null ? ` · od ${s.priceFrom} €/noč` : ''}
                              </span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {guideRegion && (
                    <p className="px-1 pt-1.5 text-[11px] text-muted-foreground">
                      {guide?.days ? `${guide.days} dni · ` : ''}tempo: {guide?.pace ?? '—'} · klikni destinacijo
                    </p>
                  )}
                </>
              ) : (
                <p className="px-1 text-[11px] text-muted-foreground">
                  {guideRegion ? `${guideRegion.label} · sledi zeleni črti na karti` : 'Sledi oznakam tvoje poti na karti'}
                </p>
              )}
            </div>
          </aside>
        )}

        {/* PRENOČIŠČA — rezultati + podrobnosti (slike, cena, rezervacija).
            Klik na zadetek → polet na karti + podrobnosti; »Rezerviraj«
            SAMODEJNO shrani v »Mojo pot« + OPOZORI (toast + glas). */}
        {mode === 'map' && staySearch.status === 'ok' && !stayPanelClosed && (
          <aside
            aria-label="Prenočišča — rezultati iskanja"
            className="absolute right-3 top-3 z-[25] w-[min(300px,calc(100%-1.5rem))] overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur"
          >
            <div className="flex items-center gap-2 border-b bg-amber-600/10 px-3 py-2">
              <BedDouble className="size-4 shrink-0 text-amber-600" aria-hidden />
              <p className="min-w-0 truncate text-sm font-semibold">Prenočišča · {staySearch.place.name}</p>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto size-6"
                onClick={() => setStayPanelClosed(true)}
                aria-label="Skrij rezultate iskanja prenočišč"
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </div>
            <div className="nice-scroll max-h-[320px] overflow-y-auto p-2">
              {selectedStay ? (
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mb-1.5 h-7 px-2 text-xs"
                    onClick={() => setSelectedStay(null)}
                  >
                    ← Vsi rezultati
                  </Button>
                  <div className="relative mb-1 aspect-video overflow-hidden rounded-lg border bg-muted">
                    {stayPhoto.status === 'ok' ? (
                      <img
                        src={stayPhoto.photos[0]}
                        alt={`${selectedStay.name} — zastopna fotografija s spleta`}
                        className="size-full object-cover"
                      />
                    ) : stayPhoto.status === 'loading' ? (
                      <div className="flex size-full items-center justify-center">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                        <span className="ml-2 text-xs text-muted-foreground">Fotografija se išče …</span>
                      </div>
                    ) : (
                      <div className="flex size-full items-center justify-center text-2xl font-bold text-muted-foreground/50">
                        {selectedStay.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    Zastopna fotografija s spleta — ni uradna slika objekta.
                  </p>
                  <h3 className="mt-1 text-sm font-semibold">{selectedStay.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {STAY_KIND_LABELS[selectedStay.kind]}
                    {selectedStay.stars ? ` · ${'★'.repeat(selectedStay.stars)}` : ''}
                    {selectedStay.address ? ` · ${selectedStay.address}` : ''}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold">
                    od {selectedStay.priceFrom} € / noč{' '}
                    <span className="text-xs font-normal text-muted-foreground">(indikativna ocena, ne uradni cenik)</span>
                  </p>
                  {stayRatesLine && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{stayRatesLine} — referenčni tečaji</p>
                  )}
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <CloudSun className="size-3.5 shrink-0 text-teal-700" aria-hidden />
                    {stayWeather === 'loading'
                      ? 'Vreme se išče …'
                      : weatherOneLiner(stayWeather) || 'Vreme trenutno ni na voljo'}
                  </p>
                  {selectedStay.website && (
                    <a
                      href={stayWebsiteUrl(selectedStay.website)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-xs text-emerald-700 underline"
                    >
                      Uradna stran ↗ (pravo plačilo)
                    </a>
                  )}
                  {selectedStay.phone && <p className="text-xs text-muted-foreground">Tel.: {selectedStay.phone}</p>}
                  {isStayReserved(guide, selectedStay.id) ? (
                    <Button className="mt-2 w-full" variant="outline" disabled>
                      <Check className="size-4" aria-hidden />
                      Rezervirano v tvoji poti
                    </Button>
                  ) : (
                    <Button className="mt-2 w-full" disabled={reserving} onClick={() => reserveStay(selectedStay)}>
                      {reserving ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          Shranjujem …
                        </>
                      ) : (
                        'Rezerviraj'
                      )}
                    </Button>
                  )}
                  <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
                    Rezervacija shrani objekt v »Mojo pot« + opozori; plačilo pri objektu ali uradni strani.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="px-1 pb-1.5 text-xs text-muted-foreground">
                    {staySearch.stays.length} zadetkov · klikni za slike in ceno
                  </p>
                  <div className="space-y-1">
                    {staySearch.stays.map((s) => {
                      const reserved = isStayReserved(guide, s.id);
                      return (
                        <Button
                          key={s.id}
                          size="sm"
                          variant="ghost"
                          className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-left"
                          onClick={() => openStayDetail(s)}
                          aria-label={`Odpri ${s.name} — slike, cena, rezervacija`}
                        >
                          <BedDouble className={`size-3.5 shrink-0 ${reserved ? 'text-emerald-600' : 'text-amber-600'}`} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium leading-tight">
                              {s.name}
                              {reserved ? ' · ✓' : ''}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {STAY_KIND_LABELS[s.kind]}
                              {s.stars ? ` · ${'★'.repeat(s.stars)}` : ''} · od {s.priceFrom} €/noč
                            </span>
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                  {stayHolidays && (
                    <p className="flex items-start gap-1 px-1 pt-1.5 text-[11px] leading-tight text-muted-foreground">
                      <Landmark className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span>
                        Naslednji prazniki ({stayHolidays.country}): {stayHolidays.line}
                      </span>
                    </p>
                  )}
                  <p className="px-1 pt-1.5 text-[11px] text-muted-foreground">
                    cena = indikativna ocena · podatki © OpenStreetMap
                  </p>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* VODIČ PO ZEMLJEVIDU — EN gumb vklopi/izklopi turnejo po celem
            Balkanu (mesta · vasi · kmečki turizem · narava). Ko je vklopljen,
            zemljevid SAMA pelje od kraja do kraja; uporabnik lahko prevzame
            nadzor (Nazaj/Premor/Naprej) ali preklopi kategorije. */}
        {mode === 'map' && mapReady && !tourOn && (
          <div className="absolute bottom-3 left-3 z-20">
            <Button
              size="sm"
              className="h-11 shadow-lg sm:h-8"
              onClick={startTour}
              aria-label="Vklopi vodiča po zemljevidu — potovanje po mestih, vaseh, kmečkem turizmu in naravi celotnega Balkana"
            >
              <Compass className="size-4" aria-hidden />
              Vklopi vodiča po zemljevidu
            </Button>
          </div>
        )}
        {mode === 'map' && mapReady && tourOn && tourPlaces.length > 0 && (
          <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl border bg-background/95 p-2 shadow-lg backdrop-blur sm:inset-x-auto sm:right-3 sm:w-[min(520px,calc(100%-1.5rem))]">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-11 shrink-0 sm:h-8" onClick={stopTour} aria-label="Izklopi vodiča po zemljevidu">
                <Compass className="size-4 text-emerald-600" aria-hidden />
                Izklopi vodiča
              </Button>
              <Button size="icon" variant="outline" className="size-11 shrink-0 sm:size-8" disabled={tourIndex === 0} onClick={tourPrev} aria-label="Nazaj — prejšnji kraj">
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button size="icon" variant="outline" className="size-11 shrink-0 sm:size-8" onClick={() => setTourPaused((v) => !v)} aria-label={tourPaused ? 'Nadaljuj vodiča' : 'Premor vodiča'}>
                {tourPaused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
              </Button>
              <Button size="icon" variant="outline" className="size-11 shrink-0 sm:size-8" onClick={tourNext} aria-label="Naprej — naslednji kraj">
                <ChevronRight className="size-4" aria-hidden />
              </Button>
              <p role="status" aria-live="polite" className="ml-1 min-w-0 flex-1 truncate text-xs font-medium">
                {mapGuideProgressLabel(tourPlaces, tourIndex)}
              </p>
              <span className="hidden truncate text-[11px] text-muted-foreground md:inline">izbor krajev · polna baza sledi</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t pt-1.5">
              {MAP_GUIDE_CATEGORIES.map((c) => {
                const active = tourCats.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTourCat(c.id)}
                    className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors sm:min-h-8 sm:px-2.5 sm:py-0.5 ${
                      active ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-800' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: TOUR_COLORS[c.id] }} />
                    {c.label} · {catCounts[c.id]}
                  </button>
                );
              })}
            </div>
            {/* ŽIVI ODPRTI PODATKI (brez poverilnic): vreme+zrak trenutnega kraja
                (Open-Meteo/wttr.in + AQI) in Wikipedia povzetek (CC BY-SA). */}
            <div className="mt-1.5 flex items-start gap-1.5 border-t pt-1.5">
              <CloudSun className="mt-0.5 size-3.5 shrink-0 text-teal-700" aria-hidden />
              <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
                {tourWeather === 'loading'
                  ? 'Vreme se išče …'
                  : weatherOneLiner(tourWeather) || 'Vreme trenutno ni na voljo'}
                {tourWiki && tourWiki !== 'loading' ? ` — Wikipedia: ${wikiShort(tourWiki.extract, 100)}` : ''}
              </p>
            </div>
          </div>
        )}

        {mode === 'map' && !mapReady && (
          <Skeleton className="absolute inset-0 z-10 rounded-none" aria-hidden />
        )}

        {mode === 'list' && (
          <div className="nice-scroll absolute inset-0 z-10 overflow-y-auto bg-background" role="list" aria-label="Seznam destinacij">
            <ul className="divide-y">
              {DESTINATIONS.map((d) => (
                <li key={d.name} role="listitem">
                  <Card className="rounded-none border-0 shadow-none">
                    <CardContent className="flex items-center gap-4 py-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700">
                        <d.icon className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium leading-tight">{d.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{d.note}</p>
                      </div>
                      <Badge variant="secondary" className="ml-auto shrink-0">
                        {d.region}
                      </Badge>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* VIRI PODATKOV (ponudniki) — pošteno vidno: kaj poganja zemljevid,
          kaj je odprti podatki in kaj NE (Booking.com ni integriran). */}
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Viri: © OpenStreetMap — zemljevid + prenočišča (Nominatim, Overpass, Photon; ves svet, torej cel Balkan) · OSRM — cestne poti · ARSO DMR 1 m — višine (CC BY 4.0) · vreme + zrak — Open-Meteo / wttr.in · opisi — Wikipedia (CC BY-SA) · tečaji — open.er-api.com · prazniki — Nager.Date · z-ai iskalnica — zastopne fotografije · cene indikativne; Booking.com ni integriran — prava rezervacija pri objektu ali uradni strani.
      </p>
    </section>
  );
}
