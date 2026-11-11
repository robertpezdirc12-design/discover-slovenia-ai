'use client';

/**
 * DOMAČA IZKUŠNJA — zemljevid + spustni okenci (država, prenočišča).
 *
 * Tok (po uporabnikovi zahtevi — preprosto, brez seznamov):
 *  1) čist regijski zemljevid (Slovenija + Balkan),
 *  2) okence »Izberi državo« → zemljevid se TAKOJ približa izbrani državi,
 *  3) okence »Prenočišča« → Apartmaji → pini VSEH uradno registriranih
 *     ponudnikov prenočitve v Sloveniji (vir: AJPES — Poslovni register RS);
 *     klik na pin pokaže popup z uradnim naslovom in statusom registracije.
 *
 * Usklajevanje z uradnim virom poteka V OZADJU (geokodiranje naslovov
 * ≤ 1 zahteva/s — lahko traja do eno uro); napredek se prikazuje na
 * zemljevidu (anker z anketo /api/apartments/sync).
 */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BedDouble,
  Building2,
  Check,
  ChevronDown,
  Home,
  MapPin,
  RotateCcw,
  Tent,
  RefreshCw,
  Search,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { COUNTRIES, countryById } from '@/lib/countries-view';
import { PLACE_CATEGORIES, placeCategoryById, type PlaceResult } from '@/lib/place-categories';
import {
  formatUpdatedAt,
  sourceLabel,
  type ApartmentApiItem,
  type ApartmentsResponse,
  type SyncProgressResponse,
  type SyncProgressView,
  type SyncStartResponse,
} from '@/lib/apartments-view';
import type { MapViewHandle } from '@/components/discover/map-view';

/** Leaflet ne more biti SSR — dinamični uvoz samo na odjemalcu. */
const MapView = dynamic(() => import('@/components/discover/map-view'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm">Zemljevid se nalaga …</p>
      </div>
    </div>
  ),
});

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

const SYNC_POLL_MS = 3000;

export default function HomeExperience() {
  const mapRef = useRef<MapViewHandle>(null);

  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);

  const [status, setStatus] = useState<LoadStatus>('idle');
  const [apartments, setApartments] = useState<ApartmentApiItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeApartmentId, setActiveApartmentId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgressView | null>(null);

  // ── »Iščem« — kategorije krajev (muzeji, restavracije …) za izbrano državo ──
  const [placeSel, setPlaceSel] = useState('');
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [placesStatus, setPlacesStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const placesAbortRef = useRef<AbortController | null>(null);

  const handleSelectPlaceCategory = useCallback(
    (catId: string) => {
      setPlaceSel(catId);
      placesAbortRef.current?.abort();
      if (!catId || !selectedCountryId) {
        setPlaces([]);
        setPlacesStatus('idle');
        return;
      }
      const controller = new AbortController();
      placesAbortRef.current = controller;
      setPlacesStatus('loading');
      fetch(
        `/api/pot/places?cat=${encodeURIComponent(catId)}&scope=country&country=${encodeURIComponent(selectedCountryId)}`,
        { signal: controller.signal },
      )
        .then((r) => r.json() as Promise<{ ok: boolean; places?: PlaceResult[]; error?: string }>)
        .then((j) => {
          if (controller.signal.aborted) return;
          setPlaces(j.ok && Array.isArray(j.places) ? j.places : []);
          setPlacesStatus(j.ok ? 'done' : 'error');
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setPlaces([]);
          setPlacesStatus('error');
        });
    },
    [selectedCountryId],
  );

  const selectedCountry = countryById(selectedCountryId);
  const sloveniaSelected = selectedCountryId === 'slovenija';
  const apartmentsVisible = sloveniaSelected && status === 'ready';
  const apartmentsCount = apartments.length;
  const isUradniVir = dataSource === 'ajpes-prs';

  // ── Anketa o napredku usklajevanja (med tekom v ozadju) ────────────────
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);
  useEffect(() => stopPolling, [stopPolling]);

  // ── Tok: izbira države v spustnem okencu → takojšnje približanje ───────
  const handleSelectCountry = useCallback((id: string) => {
    setSelectedCountryId(id);
    setActiveApartmentId(null);
    // »Iščem« rezultati so vezani na državo — ob spremembi počistimo.
    setPlaceSel('');
    setPlaces([]);
    setPlacesStatus('idle');
    if (id === 'slovenija') {
      mapRef.current?.fitSlovenia();
    } else {
      mapRef.current?.flyToCountry(id);
    }
  }, []);

  // ── Tok: nalaganje prenočišč iz API-ja ────────────────────────────
  /** Vrne { count, source, syncing } ali null ob napaki. */
  const loadApartments = useCallback(
    async (): Promise<{ count: number; source: string | null; syncing: boolean } | null> => {
      setStatus((prev) => (prev === 'ready' ? prev : 'loading'));
      setError(null);
      try {
        const res = await fetch('/api/apartments', { cache: 'no-store' });
        const json = (await res.json()) as ApartmentsResponse;
        if (!res.ok || !json.ok) {
          throw new Error(json.error ?? 'Odgovor strežnika ni uspel.');
        }
        setApartments(json.apartments ?? []);
        setUpdatedAt(json.updatedAt ?? null);
        setDataSource(json.source ?? null);
        setStatus('ready');
        if (json.syncProgress) setSyncProgress(json.syncProgress);
        return {
          count: json.apartments?.length ?? 0,
          source: json.source ?? null,
          syncing: Boolean(json.syncing),
        };
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Nalaganje ni uspelo.');
        return null;
      }
    },
    [],
  );

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          const res = await fetch('/api/apartments/sync', { cache: 'no-store' });
          const json = (await res.json()) as SyncProgressResponse;
          if (!json.ok || !json.progress) return;
          setSyncProgress(json.progress);
          if (!json.progress.running) {
            stopPolling();
            if (json.progress.phase === 'done') {
              toast.success(
                `Uradni register usklajen: ${json.progress.matched} ponudnikov z naslovi`,
                { description: 'Vir: AJPES — Poslovni register RS (uradno).', duration: 8000 },
              );
              const loaded = await loadApartments();
              if (loaded) mapRef.current?.fitSlovenia();
            } else if (json.progress.phase === 'error') {
              toast.error('Usklajevanje uradnega registra ni uspelo.', {
                description: json.progress.error ?? 'Poskusite znova kasneje.',
              });
            }
          }
        } catch {
          // naslednji cikel ankete
        }
      })();
    }, SYNC_POLL_MS);
  }, [stopPolling, loadApartments]);

  const handleChooseApartments = useCallback(() => {
    if (!sloveniaSelected) return;
    mapRef.current?.fitSlovenia();
    if (status === 'ready') return;
    void loadApartments().then((loaded) => {
      if (!loaded) return;
      mapRef.current?.fitSlovenia();
      if (loaded.syncing) {
        startPolling();
        toast.info('Prvo usklajevanje uradnega registra poteka …', {
          description:
            'Uradni naslovi se geokodirajo vljudnostno (≤ 1 zahteva/s) — pini se prikažejo ob koncu.',
          duration: 9000,
        });
      } else if (loaded.count > 0) {
        toast.success(`Prikazanih ${loaded.count} uradnih ponudnikov prenočitve`, {
          description:
            loaded.source === 'ajpes-prs'
              ? 'Vir: AJPES — Poslovni register RS (uradno).'
              : 'Vir: OpenStreetMap (rezervni vir).',
        });
      }
    });
  }, [sloveniaSelected, status, loadApartments, startPolling]);

  // ── Nazaj na regijski pregled ──────────────────────────────────────────
  const handleBack = useCallback(() => {
    setSelectedCountryId(null);
    setActiveApartmentId(null);
    mapRef.current?.resetRegion();
  }, []);

  // ── Klik na pin → poudarjen pin (popup se odpre samodejno) ────────────
  const handleSelectApartment = useCallback((id: string) => {
    setActiveApartmentId(id);
  }, []);

  // ── Ročno osveževanje z uradnim virom (poteka v ozadju) ────────────────
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch('/api/apartments/sync', { method: 'POST' });
      const json = (await res.json()) as SyncStartResponse;
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Začetek usklajevanja ni uspel.');
      if (json.progress) setSyncProgress(json.progress);
      toast.info(
        json.started
          ? 'Usklajevanje z uradnim virom (AJPES) je začeto …'
          : 'Usklajevanje z uradnim virom že poteka …',
        {
          description:
            'Uradni naslovi se geokodirajo vljudnostno (≤ 1 zahteva/s) — napredek je viden na zemljevidu.',
          duration: 9000,
        },
      );
      startPolling();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Usklajevanje ni uspelo.');
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, startPolling]);

  const syncRunning = syncProgress?.running ?? false;
  const syncShown = syncProgress !== null && (syncRunning || syncProgress.phase === 'geocode' || syncProgress.phase === 'download');

  return (
    <div className="flex min-h-screen flex-col">
      {/* Glava */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-lg text-primary-foreground shadow-sm">
              🇸🇮
            </span>
            <div className="leading-tight">
              <p className="font-display text-lg font-semibold tracking-tight">
                Discover Slovenia <span className="text-primary">AI</span>
              </p>
              <p className="text-xs text-muted-foreground">zemljevid · uradni register prenočišč</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedCountry ? (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                <MapPin className="mr-1 h-3.5 w-3.5" /> {selectedCountry.flag} {selectedCountry.name}
              </Badge>
            ) : null}
            <Button variant="outline" size="sm" onClick={handleBack}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Nazaj na pregled
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-4 sm:px-6">
          <h1 className="sr-only">
            Discover Slovenia AI — zemljevid, države in uradna prenočišča
          </h1>

          {/* Nadzorna vrstica: okence za državo + okence prenočišč + status */}
          <section aria-label="Nadzorna vrstica" className="mb-4 flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="lg" className="shadow-sm" title="Izberi državo — zemljevid se približa">
                  <MapPin className="mr-2 h-4.5 w-4.5" />
                  {selectedCountry ? (
                    <span>
                      {selectedCountry.flag} {selectedCountry.name}
                    </span>
                  ) : (
                    'Izberi državo …'
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="dsa-scroll-list max-h-80 w-72 overflow-y-auto">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Izberi državo — zemljevid se približa
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COUNTRIES.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onSelect={() => handleSelectCountry(c.id)}
                    className="gap-2.5 py-2.5"
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="font-medium">{c.name}</span>
                    {selectedCountryId === c.id ? (
                      <Check className="ml-auto h-4 w-4 text-primary" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Okence »IŠČEM« — kategorije krajev (muzeji, restavracije …) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-background shadow-sm"
                  disabled={!selectedCountry}
                  title={selectedCountry ? 'Muzeji, restavracije in druge kategorije v izbrani državi' : 'Najprej izberi državo'}
                >
                  {placesStatus === 'loading' ? (
                    <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4.5 w-4.5" />
                  )}
                  {placeSel
                    ? placeCategoryById(placeSel)?.label ?? 'Iščem'
                    : 'Iščem …'}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="dsa-scroll-list max-h-80 w-72 overflow-y-auto">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {selectedCountry
                    ? `Kaj iščem: ${selectedCountry.flag} ${selectedCountry.name}?`
                    : 'Najprej izberi državo'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {PLACE_CATEGORIES.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onSelect={() => handleSelectPlaceCategory(c.id)}
                    disabled={!selectedCountry}
                    className="gap-2.5 py-2.5"
                  >
                    <span
                      aria-hidden
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="font-medium">{c.label}</span>
                    {placeSel === c.id ? <Check className="ml-auto h-4 w-4 text-primary" /> : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {placesStatus === 'done' && places.length > 0 ? (
              <Badge variant="outline" className="text-xs">
                {places.length} {placeCategoryById(placeSel)?.label.toLowerCase() ?? 'krajev'}
              </Badge>
            ) : null}
            {placesStatus === 'error' ? (
              <span className="text-xs text-destructive">Iskanje ni uspelo — poskusi znova.</span>
            ) : null}

            {/* Okence PRENOČIŠČA — apartmaji, hoteli, kampi */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-background shadow-sm"
                  title="Prenočišča v izbrani državi"
                >
                  <BedDouble className="mr-2 h-4.5 w-4.5" />
                  Prenočišča
                  <ChevronDown className="ml-2 h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {selectedCountry
                    ? `Kaj te zanima: ${selectedCountry.flag} ${selectedCountry.name}?`
                    : 'Najprej izberi državo'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => handleChooseApartments()}
                  disabled={!sloveniaSelected}
                  className="gap-2.5 py-2.5"
                >
                  <Home className="h-4 w-4 text-primary" />
                  <span className="font-medium">Apartmaji</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {sloveniaSelected ? 'uradni register' : 'izberi Slovenijo'}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="gap-2.5 py-2">
                  <Building2 className="h-4 w-4 opacity-50" />
                  <span>Hoteli</span>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    kmalu
                  </Badge>
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="gap-2.5 py-2">
                  <Tent className="h-4 w-4 opacity-50" />
                  <span>Kampi</span>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    kmalu
                  </Badge>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {status === 'ready' ? (
              <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">
                  {apartmentsCount.toLocaleString('sl-SI')} uradnih ponudnikov
                </Badge>
                <span>
                  {sourceLabel(dataSource, dataSource)} · osveženo: {formatUpdatedAt(updatedAt)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => void handleRefresh()}
                  disabled={refreshing || syncRunning}
                >
                  <RefreshCw className={`mr-1 h-3.5 w-3.5 ${refreshing || syncRunning ? 'animate-spin' : ''}`} />
                  Osveži s spleta
                </Button>
              </div>
            ) : null}
          </section>

          {/* Zemljevid (isolate: Leaflet paneji ne prekrijejo spustnega okenc) */}
          <section
            aria-label="Zemljevid Slovenije in Balkana"
            className="isolate overflow-hidden rounded-2xl border border-border/80 shadow-sm"
          >
            <div className="relative h-[72vh] min-h-[480px] w-full">
              <MapView
                ref={mapRef}
                apartments={apartments}
                apartmentsVisible={apartmentsVisible}
                activeApartmentId={activeApartmentId}
                onSelectApartment={handleSelectApartment}
                places={places}
                placesLabel={placeSel ? placeCategoryById(placeSel)?.label ?? null : null}
              />

              {/* Nalaganje prenočišč */}
              {status === 'loading' ? (
                <div className="absolute left-1/2 top-4 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/80 bg-card/95 px-4 py-2 shadow-lg backdrop-blur">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm">Nalaganje uradnega registra …</span>
                </div>
              ) : null}

              {/* Napredek usklajevanja z uradnim virom */}
              {syncShown ? (
                <div className="absolute left-1/2 top-16 z-[500] flex w-[min(92%,30rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-border/80 bg-card/95 px-4 py-2 shadow-lg backdrop-blur">
                  <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate">
                      Usklajevanje uradnega registra (AJPES) …{' '}
                      {syncProgress ? (
                        <span className="font-medium tabular-nums">
                          {syncProgress.done.toLocaleString('sl-SI')} /{' '}
                          {syncProgress.total.toLocaleString('sl-SI')}
                        </span>
                      ) : null}
                    </p>
                    {syncProgress && syncProgress.total > 0 ? (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.round((syncProgress.done / syncProgress.total) * 100)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                  {syncProgress && syncProgress.matched > 0 ? (
                    <Badge variant="secondary" className="shrink-0 text-[10px] tabular-nums">
                      z naslovi: {syncProgress.matched.toLocaleString('sl-SI')}
                    </Badge>
                  ) : null}
                </div>
              ) : null}

              {/* Napaka nalaganja */}
              {status === 'error' ? (
                <div className="absolute left-1/2 top-4 z-[500] flex w-[min(92%,26rem)] -translate-x-1/2 items-start gap-2 rounded-xl border border-destructive/30 bg-card/95 p-3 shadow-lg backdrop-blur">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium">Uradnega registra ni bilo mogoče naložiti.</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7"
                      onClick={() => void loadApartments()}
                    >
                      Poskusi znova
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      {/* Lepljiva noga */}
      <footer className="mt-auto border-t border-border/80 bg-card/60 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p className="font-display text-foreground/80">
            Discover Slovenia <span className="text-primary">AI</span>
            <span className="ml-2 font-sans text-muted-foreground">
              — klikni pin in poglej podrobnosti
            </span>
          </p>
          <p className="text-center sm:text-right">
            Podatki o ponudnikih: AJPES — Poslovni register Slovenije (CC BY 4.0)
            <br className="hidden sm:block" />
            Zemljevid &amp; geokodiranje ©{' '}
            <a
              className="underline underline-offset-2 hover:text-foreground"
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenStreetMap
            </a>{' '}
            sodelavci (ODbL)
          </p>
        </div>
      </footer>
    </div>
  );
}
