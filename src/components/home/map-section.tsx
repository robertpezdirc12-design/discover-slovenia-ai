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
  addSavedPoi,
  addStayStop,
  emptyGuideState,
  isStayReserved,
  loadGuideState,
  saveGuideState,
  type GuideRegionId,
  type GuideStorage,
  type GuideStayStop,
  type SavedPoi,
} from '@/lib/guide-store';
import { useGuideState } from '@/components/home/use-guide-state';
import { ShareTripButton } from '@/components/home/share-trip-button';
import { ExportTripButton } from '@/components/home/export-trip-button';
import { PrintTripModal } from '@/components/home/print-trip-modal';
import { SortableStops } from '@/components/home/sortable-stops';
import {
  TRIP_ORDER_EVENT,
  TRIP_ORDER_KEY,
  applyStopOrder,
  differsFromOrder,
  regionStopOrder,
  stopRouteKey,
  withRegionStopOrder,
} from '@/lib/trip-order';
import { escapeXml, type GpxPoint } from '@/lib/gpx-export';
import { POI_CATEGORY_LABELS, poiDistanceLabel, type PoiCategory, type RoutePoi } from '@/lib/route-poi';
import { CATALOG_ATTRIBUTION } from '@/lib/poi-catalog';
import { clusterRkd, filterRkd, filterRkdInBounds, parseRkdData, type RkdDataset } from '@/lib/rkd';
import { buildRkdLayer } from '@/lib/rkd-layer';
import { BALKAN_COUNTRY_VIEWS } from '@/lib/countries';
import { DESTINATIONS as BALKAN_DESTINATIONS } from '@/lib/destinations';
import { PLACE_CATEGORIES, placeCategoryById, type PlaceResult } from '@/lib/place-categories';
import {
  TRANSIT_ATTRIBUTION,
  TRANSIT_DEFAULT_ORIGIN,
  formatTransitTime,
  transitLegSummary,
  transitModeEmoji,
  transitPlanSummary,
  type TransitPlan,
} from '@/lib/public-transport';
import { destinationBySlug } from '@/lib/destinations';
import { TRIP_PLAN, tripPlanFor, type TripStop } from '@/lib/trip-plan';
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
import { buildDayTrack, driveLabel } from '@/lib/day-track';
import { buildTripBudget, formatEur, nightsNoun, personsNoun, unpricedNote } from '@/lib/trip-budget';
import {
  REGION_CURRENCY,
  isNonEuro,
  localCurrencyNote,
} from '@/lib/currency';
import { ImportPlacesDialog } from '@/components/home/import-places-dialog';
import { PackingDialog } from '@/components/home/packing-dialog';
import { CUSTOM_STOPS_EVENT, CUSTOM_STOPS_KEY, parseCustomStops } from '@/lib/import-places';
import type { OsrmLegInfo } from '@/lib/osrm-route';
import { SHOW_TRIP_EVENT, speak } from '@/lib/speech';

/**
 * Lepljiv (sticky) preklop brez z-index nasprotja z Leafletom:
 *   • mapa je zaprta v lasten stacking context (wrapper: `relative z-0 isolate`),
 *     tako da Leafletove interne vrednosti (pane ≈ 400, kontrole ≈ 1000)
 *     ne morejo prekriti sticky vrstice (`z-30`); Leaflet CSS NI spreminjan.
 *   • vrstica je `sticky top-14 z-30` — top-14 se ujema z višino lepljive glave.
 *
 * CLS skeleta zemljevida = 0:
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

/**
 * VRSTNI RED POSTANKOV: ista zunanja shramba kot LiDAR preferenca.
 * useSyncExternalStore bere SUROV niz (stabilna identiteta → brez zanke
 * ponovnih renderov); razčlenitev in uveljavitev reda sta v čisti plasti
 * trip-order.ts. `storage` poskrbi še za ujemanje med več zavihki.
 */
function subscribeTripOrder(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(TRIP_ORDER_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(TRIP_ORDER_EVENT, onChange);
  };
}

function getTripOrderSnapshot(): string | null {
  try {
    return window.localStorage.getItem(TRIP_ORDER_KEY);
  } catch {
    return null;
  }
}

/** Minimalen HTML escape za vsebine iz podatkovnih virov (popup-i). */
function escapeHtml(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

/**
 * SVG čepkinja (brez slike — ni težav z bundler potmi Leafletovih ikon).
 * Številka poveže vrstni red v plošči z oznako na karti; po preureditvi
 * se oznake osvežijo, zato uporabnik vedno ve, katera postanka je prva.
 */
function PinSvg(order?: number): string {
  const badge = typeof order === 'number' && order > 0
    ? `<circle cx="12" cy="12" r="6.5" fill="#ffffff"/><text x="12" y="15" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="#047857">${order}</text>`
    : '<circle cx="12" cy="12" r="4.5" fill="#ffffff"/>';
  return `<svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="#059669"/>${badge}</svg>`;
}

/** Jantarjeva čepkinja s posteljo — prenočišča (iskanje + rezervacije). */
function StayPinSvg() {
  return `<svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="#d97706"/><g stroke="#ffffff" stroke-width="1.6" fill="none" stroke-linecap="round" transform="translate(3.1,3.6) scale(0.75)"><path d="M3 16v-4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/><path d="M3 14h14"/><path d="M5 10V8a1 1 0 0 1 1-1h3v3"/><path d="M9 10V7h3a1 1 0 0 1 1 1v2"/></g></svg>`;
}

/** Vijolična čepkinja z zvezdo — predlogi zanimivosti ob poti. */
function PoiPinSvg() {
  return `<svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="#7c3aed"/><path d="m12 6 1.6 3.5 3.8.4-2.8 2.6.8 3.8-3.4-2-3.4 2 .8-3.8-2.8-2.6 3.8-.4z" fill="#ffffff"/></svg>`;
}

/** Ikona po kategoriji — hitrejša orientacija v seznamu predlogov. */
const POI_ICONS: Record<PoiCategory, typeof Landmark> = {
  razgled: Mountain,
  kultura: Landmark,
  narava: Waves,
  hrana: Wine,
  drugo: MapPin,
};

function PoiIcon({ category }: { category: PoiCategory }) {
  const Icon = POI_ICONS[category] ?? MapPin;
  return <Icon className="size-3.5 shrink-0 text-violet-600" aria-hidden />;
}

type PoiPanelState = {
  routeKey: string | null;
  status: 'idle' | 'loading' | 'ok' | 'error';
  pois: RoutePoi[];
  warning?: string;
  sources?: { osm: number; catalog: number; radiusKm: number };
};

const IDLE_POI_PANEL: Omit<PoiPanelState, 'routeKey'> = { status: 'idle', pois: [] };

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

/** Stabilna prazna vrednost za START ANYWHERE snapshot (server + predpomnilnik). */
const EMPTY_CUSTOM_STOPS: readonly TripStop[] = [];
const customStopsCache: { raw: string | null; stops: readonly TripStop[] } = {
  raw: null,
  stops: EMPTY_CUSTOM_STOPS,
};

/** Barve točk vodiča po kategorijah (označevalci + čipi filtra). */
const TOUR_COLORS: Record<MapGuideCategory, string> = {
  mesto: '#059669',
  vas: '#d97706',
  kmecki: '#ea580c',
  narava: '#0d9488',
};

export function MapSection({ destSlug }: { destSlug?: string | null }) {
  const [mode, setMode] = useState<'map' | 'list'>('map');
  /** Navigacija pogleda: izbrana država → približaj (brez filtriranja). */
  const [countrySel, setCountrySel] = useState('');
  /** »Iščem:« — kategorija krajev okoli izbranega območja (država/center). */
  const [placeSel, setPlaceSel] = useState('');
  const [resultsVisible, setResultsVisible] = useState(true);
  const [placesResult, setPlacesResult] = useState<{
    key: string;
    places: PlaceResult[];
    error?: string;
    curated?: boolean;
  } | null>(null);
  const placesLayerRef = useRef<unknown>(null);
  const placesAbortRef = useRef<AbortController | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const relief = useSyncExternalStore(subscribeLidarPref, getLidarSnapshot, () => false);
  /** Privzeti sloj: vse destinacije Balkana (vidne takoj ob nalaganju). */
  const defaultDestLayerRef = useRef<unknown>(null);

  useEffect(() => {
    const L = LeafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    if (defaultDestLayerRef.current) return;
    const group = L.layerGroup();
    for (const d of BALKAN_DESTINATIONS) {
      const icon = L.divIcon({
        className: 'dsa-pin-dest',
        html: `<div style="width:15px;height:15px;border-radius:50%;background:#059669;border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.45)"></div>`,
        iconSize: [15, 15],
        iconAnchor: [8, 8],
      });
      L.marker([d.lat, d.lng], { icon, title: d.name, zIndexOffset: 500 })
        .addTo(group)
        .bindPopup(
          `<strong>${escapeXml(d.name)}</strong><br/>` +
            `${escapeXml(d.regionLabel)}<br/>` +
            `${escapeXml(d.note)}<br/>` +
            `<button type="button" class="dsa-add-poi-btn" data-kind="destinacija" data-id="dest-${escapeXml(d.slug)}" ` +
            `data-name="${escapeXml(d.name)}" data-lat="${d.lat}" data-lng="${d.lng}" ` +
            `data-category="Destinacija" data-source="izbor" ` +
            `style="margin-top:4px;padding:3px 10px;border-radius:999px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;font-size:12px;cursor:pointer">+ Dodaj v pot</button>`,
        );
    }
    defaultDestLayerRef.current = group.addTo(map);
  }, [mapReady]);

  // »IŠČEM:« — poišči kraje izbrane kategorije okoli območja (država/center).
  useEffect(() => {
    const L = LeafletRef.current;
    const map = mapRef.current;
    if (placesLayerRef.current) {
      if (L) (placesLayerRef.current as L.LayerGroup).remove();
      placesLayerRef.current = null;
    }
    placesAbortRef.current?.abort();
    if (!L || !map || !mapReady || !placeSel) {
      setPlacesResult(null);
      return;
    }
    const category = placeCategoryById(placeSel);
    if (!category) return;
    const key = placeSel; // iskanje po VSEM BALKANU (ne le okolica)
    const controller = new AbortController();
    placesAbortRef.current = controller;
    fetch(`/api/pot/places?cat=${encodeURIComponent(placeSel)}&scope=balkan`, {
      signal: controller.signal,
    })
      .then(
        (r) =>
          r.json() as Promise<{ ok: boolean; places?: PlaceResult[]; error?: string; curated?: boolean }>,
      )
      .then((j) => {
        if (controller.signal.aborted) return;
        if (!j.ok) {
          setPlacesResult({ key, places: [], error: j.error ?? 'Iskanje ni uspelo.' });
          return;
        }
        const places = Array.isArray(j.places) ? j.places : [];
        setPlacesResult({ key, places, curated: j.curated });
        setResultsVisible(true);
        if (places.length === 0) return;
        const group = L.layerGroup();
        for (const p of places) {
          const icon = L.divIcon({
            className: 'dsa-pin-place',
            html: `<div style="width:15px;height:15px;border-radius:50%;background:${category.color};border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.4)"></div>`,
            iconSize: [15, 15],
            iconAnchor: [8, 8],
          });
          L.marker([p.lat, p.lng], { icon, title: p.name, zIndexOffset: 570 })
            .addTo(group)
            .bindPopup(
              `<strong>${escapeXml(p.name)}</strong><br/>` +
                `${category.label}<br/>` +
                (p.curated
                  ? `<small>Urejeni predlog območja (vir OSM trenutno ni dosegljiv).</small><br/>`
                  : '') +
                `<button type="button" class="dsa-add-poi-btn" data-kind="place" data-id="place-${escapeXml(p.id)}" ` +
                `data-name="${escapeXml(p.name)}" data-lat="${p.lat}" data-lng="${p.lng}" ` +
                `data-category="${escapeXml(category.label)}" data-source="${p.curated ? 'izbor' : 'osm'}" ` +
                `style="margin-top:4px;padding:3px 10px;border-radius:999px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;font-size:12px;cursor:pointer">+ Dodaj v pot</button>`,
            );
        }
        placesLayerRef.current = group.addTo(map);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPlacesResult({ key, places: [], error: 'Vir OpenStreetMap ni dosegljiv.' });
      });
    return () => controller.abort();
  }, [placeSel, mapReady]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const reliefLayerRef = useRef<unknown>(null);
  const LeafletRef = useRef<typeof import('leaflet') | null>(null);
  const [elevation, setElevation] = useState<ElevationState>({ status: 'idle' });
  const elevAbortRef = useRef<AbortController | null>(null);
  const elevMarkerRef = useRef<LeafletCircleMarker | null>(null);

  // MOJA POT: vodeni tok → zemljevid (rezultat vodiča je VIDEN na karti)
  const { toast } = useToast();
  const guide = useGuideState();
  const guideRegion =
    guide && guide.region && guide.answered.includes('region')
      ? (GUIDE_REGIONS.find((g) => g.id === guide.region) ?? null)
      : null;
  const planKey = guideRegion?.id ?? null;
  // START ANYWHERE: lastno uvoženi kraji (localStorage, tako kot vrstni red).
  // Snapshot-a morata biti STABILNI (ista referenca ob nespremenjenem
  // surovem nizu), sicer useSyncExternalStore opozori na neskončno zanko.
  const customStops = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CUSTOM_STOPS_EVENT, onChange);
      window.addEventListener('storage', onChange);
      return () => {
        window.removeEventListener(CUSTOM_STOPS_EVENT, onChange);
        window.removeEventListener('storage', onChange);
      };
    },
    () => {
      try {
        const raw = window.localStorage.getItem(CUSTOM_STOPS_KEY);
        if (customStopsCache.raw !== raw) {
          customStopsCache.raw = raw;
          customStopsCache.stops = parseCustomStops(raw);
        }
      } catch {
        if (customStopsCache.raw !== null) {
          customStopsCache.raw = null;
          customStopsCache.stops = EMPTY_CUSTOM_STOPS;
        }
      }
      return customStopsCache.stops;
    },
    () => EMPTY_CUSTOM_STOPS,
  );
  // VEČDRŽAVNA POT: unija destinacij glavne regije + dodatnih regij
  // (Faza E-lite) + uvoženi kraji. Dedupe po imenu; vrstni red: glavna,
  // nato dodatne, nato uvoženi kraji.
  const basePlan = useMemo<readonly TripStop[] | null>(() => {
    const regionIds: readonly GuideRegionId[] = [
      ...(guideRegion ? [guideRegion.id] : []),
      ...(guide?.extraRegions ?? []),
    ];
    const seen = new Set<string>();
    const out: TripStop[] = [];
    for (const rid of regionIds) {
      for (const stop of TRIP_PLAN[rid]) {
        if (seen.has(stop.name)) continue;
        seen.add(stop.name);
        out.push(stop);
      }
    }
    for (const stop of customStops) {
      if (seen.has(stop.name)) continue;
      seen.add(stop.name);
      out.push(stop);
    }
    // »Dodaj v pot« (destinacije, POI, RKD, rezerve) — so del poti.
    for (const p of guide?.savedPois ?? []) {
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      out.push({ name: p.name, note: p.note || p.category || 'Zanimivost', lat: p.lat, lng: p.lng });
    }
    return out.length > 0 ? out : null;
  }, [guideRegion, guide?.extraRegions, guide?.savedPois, customStops]);

  // Uporabnikov vrstni red (localStorage, po regijah) je EDINI vir reda.
  // `plan` je iz njega izpeljan — zato OSRM pot, GPX, dnevni trak, proračun,
  // navigacija in POI SAMODEJNO sledijo preureditvi brez posebnih popravkov.
  const orderRaw = useSyncExternalStore(subscribeTripOrder, getTripOrderSnapshot, () => null);
  const savedOrder = useMemo(() => regionStopOrder(orderRaw, planKey ?? ''), [orderRaw, planKey]);
  const plan = useMemo<readonly TripStop[] | null>(
    () => (basePlan ? applyStopOrder(basePlan, savedOrder) : null),
    [basePlan, savedOrder],
  );
  const isCustomOrder = useMemo(
    () => (basePlan ? differsFromOrder(basePlan, savedOrder) : false),
    [basePlan, savedOrder],
  );

  const saveStopOrder = (names: readonly string[] | null) => {
    if (!planKey) return;
    try {
      const next = withRegionStopOrder(window.localStorage.getItem(TRIP_ORDER_KEY), planKey, names);
      if (next === null) window.localStorage.removeItem(TRIP_ORDER_KEY);
      else window.localStorage.setItem(TRIP_ORDER_KEY, next);
    } catch (error) {
      console.error('trip-order: vrstnega reda ni bilo mogoče shraniti', error);
      toast({
        title: 'Vrstnega reda ni bilo mogoče shraniti',
        description: 'Ta brskalnik ne dovoljuje shranjevanja prilagojenega vrstnega reda.',
      });
      return;
    }
    window.dispatchEvent(new Event(TRIP_ORDER_EVENT));
  };

  /**
   * Plošča »Tvoja pot« — skrita/zaprtost je vezana na KLJUČ poti: ob
   * spremembi regije se samodejno odpre (dismiss je per-route, ne globalen),
   * zato ni potreben noben useEffect z setState.
   */
  const [planPanel, setPlanPanel] = useState<{ key: string | null; dismissed: boolean }>(
    () => ({ key: null, dismissed: false }),
  );
  /** Drseči predel plošče »Tvoja pot« (za kazalo). */
  const planPanelScrollRef = useRef<HTMLDivElement | null>(null);
  const planDismissed = planPanel.key === planKey ? planPanel.dismissed : false;
  const setPlanDismissed = (value: boolean) => setPlanPanel({ key: planKey, dismissed: value });
  const planLayerRef = useRef<unknown>(null);
  const planMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  // Ključ poti vključuje VRSTNI RED: preureditev mora preklicati zastarele
  // zahtevke in znova izračunati OSRM geometrijo ter predloge ob njej.
  const routeKey = stopRouteKey(planKey, plan ?? []);

  /** Klik na postanko v "Tvoji poti" → mapa pripotuje + odpre pojavnno okno. */
  const focusStop = (stop: TripStop) => {
    mapRef.current?.flyTo([stop.lat, stop.lng], 11, { duration: 1.2 });
    planMarkersRef.current.get(stop.name)?.openPopup();
  };

  // ————— RKD — Register kulturne dediščine (sloj): preklop v orodni vrstici,
  // podatki se naložijo LENO ob prvem vklopu (31.107 enot, 7 MB / gzip 2 MB).
  // Gručenje po mreži pri trenutnem zoomu — drobci se izrišejo kot števci,
  // posamezne enote kot pike; klik na gručo približa. —————
  const [rkdEnabled, setRkdEnabled] = useState(false);
  const [rkdType, setRkdType] = useState<number | null>(null);
  const [rkdData, setRkdData] = useState<RkdDataset | null>(null);
  const rkdLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const rkdFetchRef = useRef<Promise<RkdDataset | null> | null>(null);

  const enableRkd = (on: boolean) => {
    setRkdEnabled(on);
    if (!on || rkdData || rkdFetchRef.current) return;
    rkdFetchRef.current = fetch('/data/rkd.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => parseRkdData(raw))
      .finally(() => {
        rkdFetchRef.current = null;
      });
  };

  useEffect(() => {
    if (!rkdEnabled || rkdData) return;
    let alive = true;
    const pending = rkdFetchRef.current ?? Promise.resolve(null);
    pending.then((data) => {
      if (alive && data) setRkdData(data);
    });
    return () => {
      alive = false;
    };
  }, [rkdEnabled, rkdData]);

  const rkdFeatures = useMemo(
    () => (rkdData ? filterRkd(rkdData.features, { type: rkdType }) : []),
    [rkdData, rkdType],
  );

  // Sloj RKD — ob vklopu/podatkih/tipu ter ob premiku ali približavi.
  useEffect(() => {
    const L = LeafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady || !rkdEnabled) return;
    if (rkdFeatures.length === 0) return;
    const render = () => {
      if (rkdLayerRef.current) {
        rkdLayerRef.current.remove();
        rkdLayerRef.current = null;
      }
      // Gruči samo VIDNE značke — omejitev števila gruč je sicer odvrgla
      // posamezne enote v korist velikih gruč izven pogleda.
      const b = map.getBounds();
      const visible = filterRkdInBounds(rkdFeatures, {
        south: b.getSouth(),
        west: b.getWest(),
        east: b.getEast(),
        north: b.getNorth(),
      });
      const clusters = clusterRkd(visible, map.getZoom());
      rkdLayerRef.current = buildRkdLayer(L, clusters, {
        typeLabels: rkdData?.typeLabels,
        map,
      }).addTo(map);
    };
    render();
    map.on('zoomend moveend', render);
    return () => {
      map.off('zoomend moveend', render);
      rkdLayerRef.current?.remove();
      rkdLayerRef.current = null;
    };
  }, [mapReady, rkdEnabled, rkdFeatures, rkdData]);

  // ————— GLOBOKA POVEZAVA ?dest=slug (s strani /kraj/[slug]): —————
  // mapa prileti do destinacije; če je v trenutnem planu vodiča, se odpre
  // njeno pojavno okno, sicer se prikaže začasni marker z opisom.
  useEffect(() => {
    const L = LeafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady || !destSlug) return;
    const dest = destinationBySlug(destSlug);
    if (!dest) return;

    if (focusMarkerRef.current) {
      (focusMarkerRef.current as L.Marker).remove();
      focusMarkerRef.current = null;
    }
    map.flyTo([dest.lat, dest.lng], 12, { duration: 1.5 });

    const openAfterFly = () => {
      const existing = planMarkersRef.current.get(dest.name);
      if (existing) {
        existing.openPopup();
        return;
      }
      const marker = L.marker([dest.lat, dest.lng], {
        icon: L.divIcon({
          className: 'dsa-pin-focus',
          html: PinSvg(1),
          iconSize: [24, 32],
          iconAnchor: [12, 32],
        }),
        title: dest.name,
        zIndexOffset: 600,
      })
        .addTo(map)
        .bindPopup(
          `<strong>${escapeHtml(dest.name)}</strong><br/>${escapeHtml(dest.note)} · ${escapeHtml(dest.regionLabel)}`,
        );
      focusMarkerRef.current = marker;
      marker.openPopup();
    };
    const timer = window.setTimeout(openAfterFly, 1700);
    return () => {
      window.clearTimeout(timer);
      if (focusMarkerRef.current) {
        (focusMarkerRef.current as L.Marker).remove();
        focusMarkerRef.current = null;
      }
    };
  }, [mapReady, destSlug]);

  // ————— »DODAJ V POT« (POI/RKD): en klik shrani v »Mojo pot« —————
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest?.('.dsa-add-poi-btn') as HTMLElement | null;
      if (!btn) return;
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      const lat = Number(btn.dataset.lat);
      const lng = Number(btn.dataset.lng);
      if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const poi: SavedPoi = {
        id,
        name,
        note: '',
        lat,
        lng,
        category: btn.dataset.category || null,
        source: btn.dataset.source || null,
      };
      const storage: GuideStorage = {
        getItem: (k) => window.localStorage.getItem(k),
        setItem: (k, v) => window.localStorage.setItem(k, v),
        removeItem: (k) => window.localStorage.removeItem(k),
      };
      const base = loadGuideState(storage) ?? emptyGuideState();
      const next = addSavedPoi(base, poi);
      if (next === base) {
        toast({ title: `»${name}« je že v tvoji poti` });
        return;
      }
      saveGuideState(storage, next);
      toast({
        title: `Dodano v tvojo pot: ${name}`,
        description: 'Zemljevid in načrt sta posodobljena.',
      });
      // V pojavnem oknu označi shranjeno.
      if (btn.closest('.leaflet-popup-content')) {
        const button = btn as HTMLButtonElement;
        button.textContent = '✓ Shranjeno';
        button.disabled = true;
        button.style.opacity = '0.6';
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [toast]);

  // ————— JAVNI PREVOZ (OJPP / brezavta): gumb v pojavnem oknu postanke → —————
  // poišče naslednje povezave iz Ljubljane in izbrano pot nariše na zemljevid.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest?.('.dsa-transit-btn') as HTMLElement | null;
      if (!btn) return;
      const stopName = decodeURIComponent(btn.dataset.stop ?? '');
      const lat = Number(btn.dataset.lat);
      const lng = Number(btn.dataset.lng);
      const marker = stopName ? planMarkersRef.current.get(stopName) : undefined;
      const L = LeafletRef.current;
      const map = mapRef.current;
      if (!marker || !L || !map) return;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const origin = TRANSIT_DEFAULT_ORIGIN;
      const controller = new AbortController();
      marker
        .setPopupContent('<p style="margin:0">🔎 Iščem povezave z javnim prevozom …</p>')
        .openPopup();

      fetch(
        `/api/pot/transit?from=${origin.lat},${origin.lng}&to=${lat},${lng}&mode=BUS`,
        { signal: controller.signal },
      )
        .then(
          (r) =>
            r.json() as Promise<{
              ok: boolean;
              plans?: TransitPlan[];
              error?: string;
              destName?: string | null;
            }>,
        )
        .then((j) => {
          if (controller.signal.aborted) return;
          if (!j.ok || !j.plans || j.plans.length === 0) {
            marker.setPopupContent(
              `<p style="margin:0">Nisem našel povezav z javnim prevozom do ${escapeHtml(stopName)}. ${escapeHtml(j.error ?? '')}</p>`,
            );
            return;
          }
          const arrivalStop = j.destName || stopName;
          const plans = j.plans.slice(0, 4);
          const items = plans
            .map(
              (plan, idx) =>
                `<div class="dsa-plan-row" data-plan="${idx}" style="border:1px solid ${idx === 0 ? '#c7d2fe' : '#e5e7eb'};border-radius:8px;padding:6px 8px;margin-top:6px">` +
                `<div style="font-size:12px;font-weight:600;color:#3730a3">${escapeHtml(transitPlanSummary(plan))}</div>` +
                plan.legs
                  .map((leg) => {
                    const dep = formatTransitTime(leg.startTime);
                    const arr = formatTransitTime(leg.endTime);
                    return (
                      `<div style="display:flex;gap:6px;align-items:baseline;margin-top:2px">` +
                      `<span>${transitModeEmoji(leg.mode)}</span>` +
                      `<span style="font-size:11px;color:#374151;white-space:nowrap">${dep}–${arr}</span>` +
                      `<span style="color:#53675f;font-size:11px">${escapeHtml(leg.fromPoint.name || '?')} → ${escapeHtml(leg.toPoint.name || '?')} · ${escapeHtml(transitLegSummary(leg))}</span>` +
                      `</div>`
                    );
                  })
                  .join('') +
                `</div>`,
            )
            .join('');
          marker.setPopupContent(
            `<div style="min-width:240px;max-width:300px">` +
              `<strong>Javni prevoz</strong> · <span style="color:#53675f;font-size:11px">Od: ${escapeHtml(origin.name)} · Do: ${escapeHtml(arrivalStop)}</span>` +
              items +
              `<p style="margin:6px 0 0;color:#87978f;font-size:10px">${TRANSIT_ATTRIBUTION}</p>` +
              `</div>`,
          ).openPopup();

          // Nariši geometrijo prve (najhitrejše) povezave.
          if (transitLayerRef.current) {
            (transitLayerRef.current as L.Polyline).remove();
            transitLayerRef.current = null;
          }
          const coords = plans[0].legs
            .flatMap((leg) => leg.geometry ?? [])
            .map(([lon, lat2]) => [lat2, lon] as [number, number]);
          if (coords.length > 1) {
            transitLayerRef.current = L.polyline(coords, {
              color: '#4f46e5',
              weight: 4,
              opacity: 0.85,
            }).addTo(map);
          }
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          marker.setPopupContent('<p style="margin:0">Javni prevoz trenutno ni dosegljiv — poskusi znova.</p>');
        });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // ————— PRENOČIŠČA: iskanje → slike/cena → »Rezerviraj« (samodejno shrani) —————
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

  // ————— NAVIGACIJA PO POTI (postanek-po-postanku do destinacije) —————
  // Stanje je PER-ROUTE: če se pot spremeni, se staro stanje samodejno
  // izniči (routeKey ne ustreza) — brez useEffect-a s setState.
  interface NavState {
    routeKey: string | null;
    index: number | null;
    info: { legs: OsrmLegInfo[]; totalKm: number } | null;
    failed: boolean;
  }
  const [nav, setNav] = useState<NavState>({ routeKey: null, index: null, info: null, failed: false });
  const navActive = nav.routeKey === routeKey && nav.index !== null;
  const navIndex = navActive ? nav.index : null;
  const routeInfo = nav.routeKey === routeKey ? nav.info : null;
  const routeFailed = nav.routeKey === routeKey ? nav.failed : false;
  const setNavIndex = (index: number | null) => setNav((n) => ({ ...n, routeKey, index }));
  const setRouteInfo = (info: NavState['info']) => setNav((n) => ({ ...n, routeKey, info }));
  const setRouteFailed = (failed: boolean) => setNav((n) => ({ ...n, routeKey, failed }));
  const resetNav = () => setNav({ routeKey, index: null, info: null, failed: false });

  const routeAbortRef = useRef<AbortController | null>(null);
  const routeLayerRef = useRef<unknown>(null);
  /** Linija izbrane povezave javnega prevoza (vijolična, ločena od OSRM). */
  const transitLayerRef = useRef<unknown>(null);
  /** Začasni marker za globoko povezavo ?dest=slug (ko destinacija ni v planu). */
  const focusMarkerRef = useRef<unknown>(null);
  const planRef = useRef<readonly TripStop[] | null>(null);
  // Ref z NAJNOVEJŠIM planom za klicatelje (posodobi se po vsakem renderu).
  useEffect(() => {
    planRef.current = plan;
  });

  // ————— DNEVNI TRAK (dnevi + OSRM časi vožnje med postanki) —————
  // postanke poti razdelimo na dneve (po vodiču: days + pace); časi pritečejo
  // iz routeInfo (OSRM nožice) takoj, ko je cestna pot izračunana.
  const dayTrack = useMemo(
    () => buildDayTrack(plan ?? [], guide?.days ?? null, guide?.pace ?? null, routeInfo?.legs ?? null),
    [plan, guide?.days, guide?.pace, routeInfo],
  );

  // Dnevni trak ostane razdeljen na dni, seznam postankov pa je EN sam
  // sortable seznam (vlečenje čez meje dni bi bilo nedosledno). Zato dan in
  // čas vožnje prilepimo posamezni postanki — po preureditvi se preračunata.
  const dayByStop = useMemo(() => {
    const m = new Map<string, number>();
    if (dayTrack.length > 1) {
      for (const d of dayTrack) for (const s of d.stops) m.set(s.name, d.day);
    }
    return m;
  }, [dayTrack]);
  const driveByStop = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of dayTrack) {
      for (const s of d.stops) {
        const label = driveLabel(s);
        if (label) m.set(s.name, label);
      }
    }
    return m;
  }, [dayTrack]);

  // ————— PRORAČUN (ocena stroška prenočišč + delitev med sopotnike) —————
  // Wanderlogov vzorec: uporabnik vidi okvirni skupni znesek in delež na
  // osebo brez kalkulatorja; noči = dnevi iz vodiča (privzeto 1/prenočišče).
  const [budgetPersons, setBudgetPersons] = useState(2);
  const budget = useMemo(
    () => buildTripBudget(reservedStays, guide?.days ?? null, budgetPersons),
    [reservedStays, guide?.days, budgetPersons],
  );

  // VEČVALUTNI PRORAČUN: ko je regija zunaj EUR, prikažemo še približek
  // v lokalni valuti (tečaji iz /api/open-data/rates; predpomnilnik).
  const [rates, setRates] = useState<Readonly<Record<string, number>> | null>(null);
  const ratesFetchRef = useRef<Promise<Readonly<Record<string, number>> | null> | null>(null);
  const regionCurrency = planKey ? REGION_CURRENCY[planKey] : 'EUR';
  useEffect(() => {
    if (!planKey || !isNonEuro(regionCurrency) || rates || ratesFetchRef.current) return;
    ratesFetchRef.current = fetch('/api/open-data/rates')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.ok ? (j.rates as Record<string, number>) : null))
      .finally(() => {
        ratesFetchRef.current = null;
      });
    ratesFetchRef.current.then((r) => {
      if (r) setRates(r);
    });
  }, [planKey, regionCurrency, rates]);
  const localNote = localCurrencyNote(planKey, budget.totalEur, rates);

  // ————— IZVOZ GPX (offline pot) —————
  // Vrstni red: destinacije načrta, nato rezervirana prenočišča; čista
  // podatkovna plast v gpx-export.ts poskrbi za veljavnost koordinat.
  const exportPoints = useMemo<readonly GpxPoint[]>(
    () => [
      ...(plan ?? []).map((s) => ({
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        note: s.note,
        kind: 'destinacija' as const,
      })),
      ...reservedStays.map((s) => ({
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        note: `${s.city} · rezervirano prenočišče`,
        kind: 'prenocisce' as const,
      })),
    ],
    [plan, reservedStays],
  );

  // ————— VREDNE POSTAJE OB POTI (OSM + urejeni izbor ob OSRM geometriji) —————
  // Roadtrippers/Komoot vzorec: ne iščemo "nekje v bližini", ampak
  // znotraj 3 km od DEJANSKE cestne poti in porazdeljeno po celi poti.
  // Regije z enim ciljem dobijo način »v okolici« (12 km) — nobena regija
  // ne ostane brez predlogov.
  const [poiState, setPoiState] = useState<PoiPanelState>({ routeKey, status: 'idle', pois: [] });
  const currentPoiState = poiState.routeKey === routeKey ? poiState : IDLE_POI_PANEL;
  const poiAbortRef = useRef<{ routeKey: string | null; controller: AbortController } | null>(null);
  const poiLayerRef = useRef<unknown>(null);
  const poiMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const poiSectionRef = useRef<HTMLDivElement | null>(null);

  const togglePois = () => {
    if (currentPoiState.status === 'loading') return;
    if (currentPoiState.status === 'ok') {
      const request = poiAbortRef.current;
      if (request?.routeKey === routeKey) {
        request.controller.abort();
        poiAbortRef.current = null;
      }
      setPoiState({ routeKey, status: 'idle', pois: [] });
      return;
    }
    if (!plan || plan.length === 0) {
      setPoiState({ routeKey, status: 'error', pois: [], warning: 'Za predloge najprej izberi regijo v vodiču.' });
      return;
    }
    poiAbortRef.current?.controller.abort();
    const controller = new AbortController();
    poiAbortRef.current = { routeKey, controller };
    setPoiState({ routeKey, status: 'loading', pois: [] });
    // Strežnik ima 6-sekundni proračun za javni OSM vir (+ do 5 s za OSRM);
    // tudi če bi ta ali omrežje odpovedala, vmesnik ne čaka v nedogled.
    let timedOut = false;
    const clientTimeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 14_000);
    const stopsParam = plan.map((s) => `${s.lat},${s.lng}`).join(';');
    const radiusKm = plan.length === 1 ? 12 : 3;
    fetch(`/api/pot/nearby?stops=${encodeURIComponent(stopsParam)}&radius=${radiusKm}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<{
        ok: boolean;
        pois?: RoutePoi[];
        error?: string;
        radiusKm?: number;
        osmCount?: number;
        catalogCount?: number;
      }>)
      .then((j) => {
        clearTimeout(clientTimeout);
        if (controller.signal.aborted || poiAbortRef.current?.controller !== controller) return;
        poiAbortRef.current = null;
        setPoiState({
          routeKey,
          status: j.ok ? 'ok' : 'error',
          pois: Array.isArray(j.pois) ? j.pois : [],
          warning: j.error,
          sources: j.ok
            ? { osm: j.osmCount ?? 0, catalog: j.catalogCount ?? 0, radiusKm: j.radiusKm ?? radiusKm }
            : undefined,
        });
        // Plošča je drseča — po kliku uporabniku pokažemo SAM rezultat,
        // ne da bi moral ugibati, da je seznam spodaj.
        if (j.ok && Array.isArray(j.pois) && j.pois.length > 0) {
          requestAnimationFrame(() => {
            const section = poiSectionRef.current;
            const scroller = section?.closest('.nice-scroll') as HTMLElement | null;
            if (section && scroller) {
              // Premaknemo SAMO notranjo ploščo — stran ne skače, začetek
              // bloka z rezultati pa je poravnan z vrhom vidnega območja.
              scroller.scrollTop = Math.max(0, section.offsetTop - scroller.offsetTop);
            }
          });
        }
      })
      .catch(() => {
        clearTimeout(clientTimeout);
        // Nameren preklic (sprememba regije / nov klik) ne sme prikazati napake;
        // lastna časovna omejitev pa mora uporabniku povedati, kaj se je zgodilo.
        if (timedOut) {
          if (poiAbortRef.current?.controller === controller) {
            poiAbortRef.current = null;
            setPoiState({ routeKey, status: 'error', pois: [], warning: 'Iskanje je trajalo predolgo. Poskusi znova.' });
          }
          return;
        }
        if (!controller.signal.aborted && poiAbortRef.current?.controller === controller) {
          poiAbortRef.current = null;
          setPoiState({ routeKey, status: 'error', pois: [], warning: 'Predlogi trenutno niso na voljo. Poskusi znova.' });
        }
      });
  };

  // ————— VODIČ PO ZEMLJEVIDU (cel Balkan: mesta · vasi · kmečki · narava) —————
  // EN gumb vklopi/izklopi; ko je vklopljen, zemljevid SAMA pelje uporabnika
  // od kraja do kraja (poleti + pojavno okno + govor), s filtri kategorij.
  const [tourOn, setTourOn] = useState(false);
  const [tourPaused, setTourPaused] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [tourCats, setTourCats] = useState<readonly MapGuideCategory[]>(['mesto', 'vas', 'kmecki', 'narava']);

  /**
   * Vreme/Wikipedia trenutnega kraja turneje — stanje je KLJUČANO na indeks:
   * ob spremembi kraja se staro stanje samodejno izniči (pokaže se
   * nalaganje), brez useEffect-a s setState.
   */
  interface TourInfoState {
    key: number | null;
    weather: LiveData<WeatherPayload>;
    wiki: LiveData<WikiSummary>;
  }
  const [tourInfo, setTourInfo] = useState<TourInfoState>({
    key: null,
    weather: 'loading',
    wiki: 'loading',
  });
  const tourLayerRef = useRef<unknown>(null);
  const tourMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const tourPlaces = useMemo(() => placesForCategories(tourCats), [tourCats]);
  const tourIndexSafe =
    tourPlaces.length > 0 ? Math.min(tourIndex, tourPlaces.length - 1) : 0;
  const tourInfoMatches = tourInfo.key === tourIndexSafe;
  const tourWeather = tourInfoMatches ? tourInfo.weather : 'loading';
  const tourWiki = tourInfoMatches ? tourInfo.wiki : 'loading';
  const setTourWeather = (weather: LiveData<WeatherPayload>) =>
    setTourInfo((n) => ({ ...n, key: tourIndexSafe, weather }));
  const setTourWiki = (wiki: LiveData<WikiSummary>) =>
    setTourInfo((n) => ({ ...n, key: tourIndexSafe, wiki }));
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
    resetNav();
    routeAbortRef.current?.abort();
    removeRouteLayer();
  };

  // Sprememba poti → prekini zastarele zahtevke (stanje navigacije se
  // izniči samodejno prek routeKey v `nav`; POI stanje se vodi po routeKey).
  useEffect(() => {
    routeAbortRef.current?.abort();
    const poiRequest = poiAbortRef.current;
    if (poiRequest && poiRequest.routeKey !== routeKey) {
      poiRequest.controller.abort();
      poiAbortRef.current = null;
    }
  }, [routeKey]);

  // pot na karti: prava cestna (OSRM posrednik) ali premočrtna rezerva
  useEffect(() => {
    const L = LeafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    // vsaka sprememba poti/navigacije počisti prejšnjo linijo
    if (routeLayerRef.current) (routeLayerRef.current as L.Polyline).remove();
    routeLayerRef.current = null;
    // Pot se NARIŠE vedno, ko imamo ≥2 postanki (brez čakanja na navigacijo).
    if (!plan || plan.length < 2 || !routeKey) return;

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
  }, [routeKey, plan, mapReady]);

  // čiščenje plana ob odstranitvi mape
  useEffect(() => {
    return () => {
      poiAbortRef.current?.controller.abort();
      planLayerRef.current = null;
      planMarkersRef.current = new Map();
      routeLayerRef.current = null;
      poiLayerRef.current = null;
      poiMarkersRef.current = new Map();
    };
  }, []);

  // Označevalci plana — osvežijo se ob spremembi regije ALI vrstnega reda:
  // številka na čepkinji se ujema z oštevilčenjem v plošči »Tvoja pot«.
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
    plan.forEach((stop, i) => {
      const icon = L.divIcon({
        className: 'dsa-pin-plan',
        html: PinSvg(i + 1),
        iconSize: [24, 32],
        iconAnchor: [12, 32],
      });
      const m = L.marker([stop.lat, stop.lng], { icon, title: `${i + 1}. ${stop.name}`, zIndexOffset: 500 })
        .addTo(group)
        .bindPopup(
          `<strong>${i + 1}. ${escapeHtml(stop.name)}</strong><br/>${escapeHtml(stop.note)}` +
            `<br/><button type="button" class="dsa-transit-btn" data-stop="${encodeURIComponent(stop.name)}" ` +
            `data-lat="${stop.lat}" data-lng="${stop.lng}" style="margin-top:4px;padding:3px 10px;border-radius:999px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;font-size:12px;cursor:pointer">🚌 Javni prevoz</button>`,
        );
      planMarkersRef.current.set(stop.name, m);
    });
    planLayerRef.current = group.addTo(map);
  }, [plan, mapReady]);

  // Linija javnega prevoza se počisti ob spremembi plana/mape (ali unmount).
  useEffect(() => {
    const L = LeafletRef.current;
    return () => {
      if (L && transitLayerRef.current) {
        (transitLayerRef.current as L.Polyline).remove();
        transitLayerRef.current = null;
      }
    };
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

  // Izbor kategorij se skrči → indeks je varno omejen prek `tourIndexSafe`
  // (izpeljano, brez efekta s setState).

  // polet na trenutni kraj + pojavno okno + govor (isti glas kot navigacija)
  useEffect(() => {
    if (!tourOn || tourPlaces.length === 0 || !mapReady) return;
    const i = tourIndexSafe;
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
    const i = tourIndexSafe;
    const p = tourPlaces[i];
    tourInfoAbortRef.current?.abort();
    const controller = new AbortController();
    tourInfoAbortRef.current = controller;
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

  // Nova rezervacija → plošča »Tvoja pot« se sama odpre (setPlanDismissed(false)
  // je v rezervacijskem toku); ob nalaganju z obstoječimi zapisi jo odpre
  // pogoj v JSX (reservedStays.length > 0) — useEffect ni potreben.

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

  // oznake PREDLOGOV OB POTI — začasne (skrij / nova pot jih počisti).
  // Imena iz OSM tagov so tuji vnos → popup VEDNO escapamo.
  useEffect(() => {
    const L = LeafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (poiLayerRef.current) {
      (poiLayerRef.current as L.LayerGroup).remove();
      poiLayerRef.current = null;
      poiMarkersRef.current = new Map();
    }
    if (currentPoiState.pois.length === 0) return;
    const group = L.layerGroup();
    const icon = L.divIcon({ className: 'dsa-pin-poi', html: PoiPinSvg(), iconSize: [24, 32], iconAnchor: [12, 32] });
    currentPoiState.pois.forEach((p) => {
      const m = L.marker([p.lat, p.lng], { icon, title: p.name, zIndexOffset: 550 })
        .addTo(group)
      .bindPopup(
        `<strong>${escapeXml(p.name)}</strong><br/>` +
        `${POI_CATEGORY_LABELS[p.category]} · ${poiDistanceLabel(p.distanceKm)}<br/>` +
        `<small>${p.source === 'osm' ? '© OpenStreetMap' : CATALOG_ATTRIBUTION}</small><br/>` +
        `<button type="button" class="dsa-add-poi-btn" data-kind="poi" data-id="poi-${escapeXml(p.id)}" ` +
        `data-name="${escapeXml(p.name)}" data-lat="${p.lat}" data-lng="${p.lng}" ` +
        `data-category="${escapeXml(p.category)}" data-source="${escapeXml(p.source)}" ` +
        `style="margin-top:4px;padding:3px 10px;border-radius:999px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;font-size:12px;cursor:pointer">+ Dodaj v pot</button>`,
      );
      poiMarkersRef.current.set(p.id, m);
    });
    poiLayerRef.current = group.addTo(map);
  }, [currentPoiState.pois, mapReady]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current || mapRef.current) return;
      LeafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: [46.12, 14.82],
        zoom: 8,
        scrollWheelZoom: true,
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
      transitLayerRef.current = null;
      placesLayerRef.current = null;
      defaultDestLayerRef.current = null;
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
        Zemljevid destinacij
      </h2>

      {/* Lepljiv preklop — leži NAD izolirano mapo (z-30 > kontekst z-0) */}
      <div className="sticky top-14 z-30 -mx-2 mb-3 rounded-2xl border border-border/80 bg-card/90 px-3 py-2.5 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
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
          </div>
          {/* ENOTNA ISKALNA VRSTICA — kategorija »Iščem« + država (v enem okvirju). */}
          <div className="flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 py-1 pl-3 pr-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Razišči:</span>
            <select
              id="place-cat"
              value={placeSel}
              onChange={(e) => {
                setPlaceSel(e.target.value);
                if (e.target.value) setResultsVisible(true);
              }}
              aria-label="Kategorija krajev, ki jih iščem"
              className="h-7 rounded-full border border-border/70 bg-background/80 px-2 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">—</option>
              {PLACE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              id="country-view"
              value={countrySel}
              onChange={(e) => {
                const v = e.target.value;
                setCountrySel(v);
                if (!v) return;
                const c = BALKAN_COUNTRY_VIEWS.find((x) => x.id === v);
                if (c) mapRef.current?.flyTo([c.lat, c.lng], c.zoom, { duration: 1.4 });
              }}
              aria-label="Približaj državo na zemljevidu"
              className="h-7 rounded-full border border-border/70 bg-background/80 px-2 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">Vse</option>
              {BALKAN_COUNTRY_VIEWS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {placesResult && placesResult.error && (
            <span className="text-[11px] text-destructive">{placesResult.error}</span>
          )}
          {placesResult && !placesResult.error && placesResult.places.length > 0 && (
            <button
              type="button"
              onClick={() => setResultsVisible((v) => !v)}
              className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {placesResult.places.length} najdenih · {placeCategoryById(placeSel)?.label ?? ''}
              {placesResult.curated ? ' · kurirano' : ''} {resultsVisible ? '· skrij' : '· pokaži'}
            </button>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1">
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
          {/* RKD — Register kulturne dediščine: ločen sloj (LENO nalaganje), z izbiro tipa. */}
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1">
            <Landmark className="size-3.5 text-amber-800" aria-hidden />
            <Label htmlFor="rkd-toggle" className="text-xs text-muted-foreground">
              Kulturna dediščina
            </Label>
            <Switch
              id="rkd-toggle"
              checked={rkdEnabled}
              onCheckedChange={enableRkd}
              aria-label={
                rkdEnabled
                  ? 'Izklopi sloj kulturne dediščine (RKD)'
                  : 'Vklopi sloj kulturne dediščine (RKD, OPSI CC BY 4.0)'
              }
            />
            {rkdEnabled && (
              <select
                value={rkdType ?? -1}
                onChange={(e) => setRkdType(e.target.value === '-1' ? null : Number(e.target.value))}
                aria-label="Tip kulturne dediščine"
                className="h-7 rounded-md border border-border/70 bg-background/80 px-1.5 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value={-1}>Vsi tipi</option>
                {(rkdData?.typeLabels ?? []).map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            )}
            {rkdEnabled && !rkdData && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Nalaganje RKD podatkov" />
            )}
          </div>
        </div>
        {rkdEnabled && (
          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
            Register nepremične kulturne dediščine (RKD) — MOP/GURS, OPSI (CC BY 4.0). Zbira: podatki.gov.si. Klik na gručo približa pogled.
          </p>
        )}
      </div>

      {/* Enoten vir višine: skeleton, mapa in seznam so absolutni znotraj te škatle */}
      <div className={`relative mt-3 w-full overflow-hidden rounded-2xl border border-border/80 bg-muted shadow-sm ${MAP_H}`}>
        {/* Izolacija — vse Leaflet z-index pane ostanejo tu znotraj */}
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
            <div className="flex items-center gap-2 border-b border-primary/10 bg-primary/5 px-3 py-2">
              <Route className="size-4 shrink-0 text-primary" aria-hidden />
              <p className="min-w-0 truncate text-sm font-semibold">Tvoja pot</p>
              {/* Povzetek proračuna je VIDEN takoj (plošča se sicer drsi). */}
              {budget.totalEur !== null && (
                <span
                  className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary"
                  title="Ocena proračuna prenočišč"
                >
                  ≈ {formatEur(budget.totalEur)}
                </span>
              )}
              {/* Število predlogov je vidno brez drsenja (enako kot proračunski čip). */}
              {currentPoiState.status === 'ok' && currentPoiState.pois.length > 0 && (
                <span
                  className="flex shrink-0 items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300"
                  title="Zanimivosti ob poti"
                >
                  <Compass className="size-3" aria-hidden /> {currentPoiState.pois.length}
                </span>
              )}
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
            {/* KAZALO KNJIGE — hitro listanje po poglavjih poti. */}
            {(plan?.length || reservedStays.length || guide?.savedPois?.length || budget.items.length) > 0 && (
              <nav aria-label="Kazalo poti" className="flex flex-wrap gap-1 border-b border-border/60 px-1 pb-1.5 pt-1">
                {(
                  [
                    ['sec-stops', 'Postanki'],
                    ['sec-stays', 'Prenočišča'],
                    ['sec-pois', 'Zanimivosti'],
                    ['sec-budget', 'Proračun'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      planPanelScrollRef.current?.querySelector(`#${id}`)?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      });
                    }}
                    className="rounded-full border border-border/80 bg-card/70 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                  >
                    {label}
                  </button>
                ))}
              </nav>
            )}
            {/* Ko so predlogi odprti, plošča dobi več prostora — seznam ni odrezan. */}
            {/* Na mobilnem je plošča nižja, da plavajoči gumb »Vklopi vodiča«
                ne prekriva zadnjega predloga; seznam ostane drseč. */}
            <div
              ref={planPanelScrollRef}
              className={`${currentPoiState.status === 'ok' ? 'max-h-[280px] sm:max-h-[340px]' : 'max-h-[220px]'} overflow-y-auto nice-scroll p-2 pb-8 sm:pb-2`}
            >
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
                      {/* POVLECI IN SPUSTI: en sam sortable seznam je vir resnice
                          za vso pot. Dan in čas vožnje sta prilepljena postanki,
                          da preureditev ne trči ob meje dni. */}
                      <div id="sec-stops">
                        <SortableStops
                          stops={plan}
                          dayByStop={dayByStop}
                          driveByStop={driveByStop}
                          onFocus={focusStop}
                          onOrderChange={saveStopOrder}
                          onReset={() => saveStopOrder(null)}
                          isCustomOrder={isCustomOrder}
                        />
                      </div>
                    </>
                  )}
                  {/* SHRANJENE ZANIMIVOSTI/DEDIŠČINA — »Dodaj v pot« (POI/RKD). */}
                  {(guide?.savedPois?.length ?? 0) > 0 && (
                    <div id="sec-pois" className="mt-2 border-t pt-2">
                      <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                        Zanimivosti v tvoji poti ({guide!.savedPois.length})
                      </p>
                      <div className="space-y-1">
                        {guide!.savedPois.map((p) => (
                          <Button
                            key={p.id}
                            size="sm"
                            variant="ghost"
                            className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-left"
                            onClick={() => {
                              mapRef.current?.flyTo([p.lat, p.lng], 14, { duration: 1.2 });
                            }}
                            aria-label={`Prikaži ${p.name} na zemljevidu`}
                          >
                            <Landmark className="size-3.5 shrink-0 text-primary" aria-hidden />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium leading-tight">{p.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {p.category ?? 'Zanimivost'}
                                {p.source ? ` · ${p.source}` : ''}
                              </span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* REZERVIRANA PRENOČIŠČA — del »Moje poti« (trajno shranjeno). */}
                  {reservedStays.length > 0 && (
                    <div id="sec-stays" className="mt-2 border-t pt-2">
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
                  {/* PRORAČUN — okvirni skupni strošek prenočišč + delitev med
                      sopotnike (Wanderlogov vzorec). Cene so indikativne in
                      prenočišča brez cene so iz seštevka izrecno izvzeta. */}
                  {reservedStays.length > 0 && (
                    <div id="sec-budget" className="mt-2 border-t px-1 pt-2" aria-label="Ocena proračuna prenočišč">
                      <p className="pb-1 text-xs font-medium text-muted-foreground">
                        Ocena proračuna · {budget.nights} {nightsNoun(budget.nights)}
                      </p>
                      {budget.totalEur !== null ? (
                        <>
                          <p className="text-sm font-semibold">≈ {formatEur(budget.totalEur)} skupaj</p>
                          <div className="mt-1.5 flex overflow-hidden rounded-md border border-border/80" role="group" aria-label="Število oseb za delitev stroška">
                            {[1, 2, 3, 4].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setBudgetPersons(n)}
                                aria-pressed={budgetPersons === n}
                                aria-label={`${n} ${personsNoun(n)}`}
                                className={`min-h-9 min-w-9 flex-1 px-2 text-xs font-medium transition-colors ${
                                  budgetPersons === n
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-background hover:bg-accent'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {budget.persons} {personsNoun(budget.persons)} · ≈ {formatEur(budget.perPersonEur ?? 0)} na osebo
                          </p>
                          {budget.unpricedCount > 0 && (
                            <p className="mt-1 text-[11px] text-muted-foreground">{unpricedNote(budget.unpricedCount)}</p>
                          )}
                          {localNote && (
                            <p className="mt-1 text-[11px] font-medium text-primary/80">{localNote}</p>
                          )}
                          <p className="mt-1 text-[11px] text-muted-foreground">Indikativne cene od — točen znesek pri ponudniku.</p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Objavljene cene niso na voljo — ocena trenutno ni mogoča.</p>
                      )}
                    </div>
                  )}
                  {guideRegion && (
                    <p className="px-1 pt-1.5 text-[11px] text-muted-foreground">
                      {guide?.days ? `${guide.days} dni · ` : ''}tempo: {guide?.pace ?? '—'} · klikni destinacijo
                    </p>
                  )}
                  {/* DELITEV POTI — kratka povezava /pot/[koda] (sopotniki
                      si načrt ogledajo in ga uvozijo z enim klikom). */}
                  {guide && guide.answered.length > 0 && (
                    <div className="mt-2 border-t pt-2">
                      <ShareTripButton
                        state={guide}
                        stopOrder={isCustomOrder ? plan?.map((stop) => stop.name) : null}
                      />
                      {/* START ANYWHERE — uvoz krajev iz besedila (geokodiranje). */}
                      <ImportPlacesDialog
                        existingNames={new Set((plan ?? []).map((stop) => stop.name.toLowerCase()))}
                      />
                      {/* PAKIRNI SEZNAM — predloge po tipu potovanja. */}
                      {planKey && (
                        <PackingDialog
                          key={planKey}
                          routeKey={planKey}
                          regionId={planKey}
                          interests={guide?.interests ?? []}
                        />
                      )}
                      {/* GPX = pot za offline (navigacija/OsmAnd/Komoot). */}
                      <ExportTripButton points={exportPoints} className="mt-1.5" />
                    </div>
                  )}
                  {((plan?.length ?? 0) > 0 || reservedStays.length > 0) && (
                    <div className="mt-2 border-t pt-2">
                      <PrintTripModal
                        stops={plan}
                        dayTrack={dayTrack}
                        pois={currentPoiState.pois}
                        budget={budget}
                        stays={reservedStays}
                        regionLabel={guideRegion?.label ?? null}
                        localCurrencyNote={localNote}
                      />
                    </div>
                  )}
                  {/* VREDNE POSTAJE OB POTI — OSM + urejeni izbor, znotraj
                      3 km od prave OSRM geometrije, porazdeljeno po celi poti. */}
                  {plan && (
                    <div ref={poiSectionRef} className="mt-2 border-t pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-11 w-full sm:h-8"
                        onClick={togglePois}
                        disabled={currentPoiState.status === 'loading'}
                        aria-expanded={currentPoiState.status === 'ok'}
                        aria-label="Prikaži ali skrij zanimivosti ob poti"
                      >
                        {currentPoiState.status === 'loading' ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Compass className="size-3.5" aria-hidden />
                        )}
                        {currentPoiState.status === 'loading'
                          ? 'Iščem zanimivosti …'
                          : currentPoiState.status === 'ok'
                            ? `Skrij zanimivosti (${currentPoiState.pois.length})`
                            : plan?.length === 1
                              ? 'Zanimivosti v okolici'
                              : 'Zanimivosti ob poti'}
                      </Button>
                      <div aria-live="polite">
                        {currentPoiState.status === 'loading' && (
                          <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                            Preverjam javne podatke OpenStreetMap — lahko traja nekaj sekund …
                          </p>
                        )}
                        {currentPoiState.status === 'ok' && currentPoiState.pois.length === 0 && (
                          <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                            {currentPoiState.warning ?? 'V bližini poti ni najdenih zanimivosti. Poskusi drugo regijo.'}
                          </p>
                        )}
                        {currentPoiState.status === 'error' && (
                          <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                            {currentPoiState.warning ?? 'Predlogi trenutno niso na voljo.'}
                          </p>
                        )}
                        {currentPoiState.status === 'ok' && currentPoiState.pois.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {currentPoiState.warning && (
                              <p className="px-1 text-[11px] text-muted-foreground">{currentPoiState.warning}</p>
                            )}
                            {currentPoiState.pois.map((p) => (
                              <Button
                                key={p.id}
                                size="sm"
                                variant="ghost"
                                className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-left"
                                onClick={() => {
                                  mapRef.current?.flyTo([p.lat, p.lng], 13, { duration: 1.2 });
                                  poiMarkersRef.current.get(p.id)?.openPopup();
                                }}
                                aria-label={`Prikaži zanimivost ${p.name} na zemljevidu`}
                              >
                                <PoiIcon category={p.category} />
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium leading-tight">{p.name}</span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {POI_CATEGORY_LABELS[p.category]} · {poiDistanceLabel(p.distanceKm)}
                                  </span>
                                </span>
                              </Button>
                            ))}
                            <p className="px-1 pt-0.5 text-[11px] text-muted-foreground">
                              Vir: {[
                                currentPoiState.sources?.osm ? '© OpenStreetMap' : null,
                                currentPoiState.sources?.catalog ? CATALOG_ATTRIBUTION : null,
                              ].filter(Boolean).join(' · ') || CATALOG_ATTRIBUTION}
                              {' · odmik ≤ '}{currentPoiState.sources?.radiusKm ?? 3}{' km'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
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

        {/* PLAVAJOČI SEZNAM REZULTATOV (»Iščem«) — mapa + seznam, kot Kayak. */}
        {placesResult && !placesResult.error && placesResult.places.length > 0 && resultsVisible && (
          <div className="absolute inset-y-3 right-3 z-30 flex w-[min(300px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <p className="truncate text-xs font-medium">
                {placeCategoryById(placeSel)?.label ?? 'Rezultati'} · {placesResult.places.length}
              </p>
              <button
                type="button"
                onClick={() => setResultsVisible(false)}
                aria-label="Zapri seznam rezultatov"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
            <ul className="nice-scroll max-h-[52dvh] flex-1 space-y-1 overflow-y-auto p-2">
              {placesResult.places.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-card/60 px-2.5 py-1.5 text-xs"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {p.curated ? 'kurirano območje' : 'OpenStreetMap'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="dsa-add-poi-btn shrink-0 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary transition-colors hover:bg-primary/20"
                    data-kind="place"
                    data-id={`place-${p.id}`}
                    data-name={p.name}
                    data-lat={p.lat}
                    data-lng={p.lng}
                    data-category={placeCategoryById(placeSel)?.label ?? ''}
                    data-source={p.curated ? 'izbor' : 'osm'}
                    aria-label={`Dodaj ${p.name} v pot`}
                  >
                    + Dodaj
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* »VODI ME« — trajno viden, ko pot obstaja (≥2 postanki). */}
        {mapReady && plan && plan.length >= 2 && !navActive && (
          <div className="absolute bottom-3 left-3 z-20">
            <Button
              size="sm"
              className="h-11 shadow-lg sm:h-8"
              onClick={() => {
                setNavIndex(0);
                gotoStop(0);
              }}
              aria-label="Začni navigacijo po poti"
            >
              <Navigation className="size-4" aria-hidden />
              Vodi me
            </Button>
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
