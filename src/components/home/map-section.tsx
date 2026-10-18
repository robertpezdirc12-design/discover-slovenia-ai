'use client';

import 'leaflet/dist/leaflet.css';
import type { CircleMarker as LeafletCircleMarker, Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CalendarDays, Flag, List, Loader2, Map as MapIcon, MapPin, Mountain, Navigation, Palmtree, Route, Waves, Wine, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ARSO_LIDAR_ATTRIBUTION, arsoLidarTileUrl, formatElevation } from '@/lib/arso-lidar';
import { GUIDE_EVENT, GUIDE_REGIONS, loadGuideState } from '@/lib/guide-store';
import { useGuideState } from '@/components/home/use-guide-state';
import { tripPlanFor, type TripStop } from '@/lib/trip-plan';
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

      // VIŠINA NA TOČKO (ARSO DMR/LiDAR, 1 m): klik → posrednik /api/arso/elevation
      // (fair-use: predpomnilnik na strežniku; brskalnik ne kliče ARSO direktno —
      // odgovor nima CORS glav, izmerjeno). Preklic prejšnje zahteve ob novem kliku.
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
                marker.setPopupContent(
                  `Višina: ${formatElevation(j.elevationM)} — ${j.label ?? 'DEM'} · ${j.license ?? ''}`,
                );
              } else {
                setElevation({ status: 'error' });
                marker.setPopupContent('Višina trenutno ni na voljo');
              }
            })
            .catch(() => {
              if (controller.signal.aborted) return;
              setElevation({ status: 'error' });
              marker.setPopupContent('Višina trenutno ni na voljo');
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

  // čiščenje plana ob odstranitvi mape
  useEffect(() => {
    return () => {
      planLayerRef.current = null;
      planMarkersRef.current = new Map();
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

      {/* Enoten vir višine: skeleton, mapa in seznam so absolutni znotraj te škatle */}
      <div className={`relative w-full overflow-hidden rounded-xl border bg-muted ${MAP_H}`}>
        {/* POLIR15-a: izolacija — vse Leaflet z-index pane ostanejo tu znotraj */}
        <div className={`absolute inset-0 z-0 isolate ${mode === 'map' ? '' : 'pointer-events-none opacity-0'}`}>
          <div ref={containerRef} className="h-full w-full" aria-label="Interaktivni zemljevid Slovenije" role="application" />
        </div>

        {/* MOJA POT: rezultat vodenega toka — vidna plošča nad kartou.
            Klik na postanko → mapa pripotuje + odpre opis (aplikacija vodi). */}
        {mode === 'map' && plan && guideRegion && !planDismissed && (
          <aside
            aria-label={`Tvoja pot — ${guideRegion.label}`}
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
                  <p className="px-1 pb-1.5 text-xs text-muted-foreground">{guideRegion.label}</p>
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
                  <p className="px-1 pt-1.5 text-[11px] text-muted-foreground">
                    {guide?.days ? `${guide.days} dni · ` : ''}tempo: {guide?.pace ?? '—'} · klikni destinacijo
                  </p>
                </>
              ) : (
                <p className="px-1 text-[11px] text-muted-foreground">{guideRegion.label} · sledi zeleni črti na karti</p>
              )}
            </div>
          </aside>
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
    </section>
  );
}
