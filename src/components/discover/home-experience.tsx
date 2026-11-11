'use client';

/**
 * DOMAČA IZKUŠNJA — zemljevid + spustno okence (države, apartmaji) + seznam.
 *
 * Tok (po uporabnikovi zahtevi — brez zelenih krogec / pinov držav):
 *  1) čist regijski zemljevid (Slovenija + Balkan),
 *  2) v SPUSTNEM OKENCU izbereš državo (Slovenija, Hrvaška, Bosna …)
 *     → zemljevid se TAKOJ približa izbrani državi (to je prvi korak),
 *  3) v istem okencu klikneš »Apartmaji« (ob izbrani Sloveniji) → naložijo
 *     se VSI apartmaji v Sloveniji (GET /api/apartments — podatki s spleta,
 *     OpenStreetMap) in se pokažejo kot pini + pregleden seznam s filtri.
 *
 * Stanja so izpeljana (brez setState v efektih); nalaganje ima ločeno
 * stanje (idle/loading/ready/error) z iskrenimi sporočili.
 */

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Home,
  MapPin,
  RotateCcw,
  Search,
  RefreshCw,
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { COUNTRIES, countryById } from '@/lib/countries-view';
import {
  formatUpdatedAt,
  type ApartmentApiItem,
  type ApartmentsResponse,
  type SyncResponse,
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

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/č/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z');
}

export default function HomeExperience() {
  const mapRef = useRef<MapViewHandle>(null);

  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);

  const [status, setStatus] = useState<LoadStatus>('idle');
  const [apartments, setApartments] = useState<ApartmentApiItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeApartmentId, setActiveApartmentId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const selectedCountry = countryById(selectedCountryId);
  const sloveniaSelected = selectedCountryId === 'slovenija';
  const apartmentsVisible = sloveniaSelected && status === 'ready';
  const apartmentsCount = apartments.length;

  // ── Tok: izbira države v spustnem okencu → takojšnje približanje ───────
  const handleSelectCountry = useCallback((id: string) => {
    setSelectedCountryId(id);
    setActiveApartmentId(null);
    if (id === 'slovenija') {
      mapRef.current?.fitSlovenia();
    } else {
      mapRef.current?.flyToCountry(id);
    }
  }, []);

  // ── Tok: izbira »Apartmaji« v spustnem okencu ──────────────────────────
  /** Vrne število naloženih apartmajev ali −1 ob napaki. */
  const loadApartments = useCallback(async (): Promise<number> => {
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
      return json.apartments?.length ?? 0;
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Nalaganje ni uspelo.');
      return -1;
    }
  }, []);

  const handleChooseApartments = useCallback(() => {
    if (!sloveniaSelected) return;
    mapRef.current?.fitSlovenia();
    if (status === 'ready') return;
    void loadApartments().then((count) => {
      if (count < 0) return;
      mapRef.current?.fitSlovenia();
      toast.success(`Prikazanih ${count} apartmajev v Sloveniji`, {
        description: 'Vir: OpenStreetMap (odprti podatki).',
      });
    });
  }, [sloveniaSelected, status, loadApartments]);

  // ── Nazaj na regijski pregled ──────────────────────────────────────────
  const handleBack = useCallback(() => {
    setSelectedCountryId(null);
    setActiveApartmentId(null);
    mapRef.current?.resetRegion();
  }, []);

  // ── Klik na apartma pin / seznam ───────────────────────────────────────
  const handleSelectApartment = useCallback((id: string) => {
    setActiveApartmentId(id);
  }, []);

  const handleSelectFromList = useCallback((id: string) => {
    setActiveApartmentId(id);
    mapRef.current?.flyToApartment(id);
  }, []);

  // ── Ročno osveževanje s spleta (Nominatim vljudnost → nekaj minut) ─────
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    toast.info('Usklajevanje s spletnimi viri se je začelo …', {
      description:
        'Če Overpass ni dosegljiv, poteka Nominatim iskanje (vljudnostno ≤ 1 zahteva/s) — lahko traja nekaj minut.',
    });
    try {
      const res = await fetch('/api/apartments/sync', { method: 'POST' });
      const json = (await res.json()) as SyncResponse;
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Usklajevanje ni uspelo.');
      toast.success(`Osveženo: ${json.count} apartmajev (vir: ${json.source})`, {
        description: `Zahtevkov: ${json.requests} · neuspelih: ${json.failures} · trajanje: ${Math.round((json.durationMs ?? 0) / 1000)} s`,
      });
      const count = await loadApartments();
      if (count >= 0) {
        mapRef.current?.fitSlovenia();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Usklajevanje ni uspelo.');
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, loadApartments]);

  // ── Izpeljano: filtri seznama ──────────────────────────────────────────
  const regionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of apartments) map.set(a.region, (map.get(a.region) ?? 0) + 1);
    return Array.from(map.entries()).sort((x, y) => y[1] - x[1]);
  }, [apartments]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return apartments.filter((a) => {
      if (regionFilter && a.region !== regionFilter) return false;
      if (!q) return true;
      const haystack = normalize(`${a.name} ${a.city ?? ''} ${a.street ?? ''}`);
      return haystack.includes(q);
    });
  }, [apartments, query, regionFilter]);

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
              <p className="text-xs text-muted-foreground">zemljevid · spustno okence · apartmaji</p>
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
          {/* Kratek vodnik po korakih */}
          <section aria-label="Vodnik" className="mb-4">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              V spustnem okencu izberi državo
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Klikni <strong className="text-foreground">državo</strong> (Slovenija, Hrvaška, Bosna
              …) v spustnem okencu — zemljevid se takoj približa izbrani državi. Nato izberi{' '}
              <strong className="text-foreground">Apartmaji</strong>: pokaže se vseh{' '}
              {status === 'ready' ? apartmentsCount : ''} apartmajev v Sloveniji z realnimi podatki
              s spleta (OpenStreetMap).
            </p>
          </section>

          {/* Nadzorna vrstica: spustno okence (države + apartmaji) + status */}
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
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => handleChooseApartments()}
                  disabled={!sloveniaSelected}
                  className="gap-2.5 py-2.5"
                >
                  <Home className="h-4 w-4 text-primary" />
                  <span className="font-medium">Apartmaji</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {sloveniaSelected ? 'vsi v Sloveniji' : 'najprej izberi Slovenijo'}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {status === 'ready' ? (
              <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">
                  {apartmentsCount} apartmajev
                </Badge>
                <span>
                  vir: OpenStreetMap ({dataSource ?? '—'}) · osveženo: {formatUpdatedAt(updatedAt)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => void handleRefresh()}
                  disabled={refreshing}
                >
                  <RefreshCw className={`mr-1 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
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
            <div className="relative h-[58vh] min-h-[420px] w-full">
              <MapView
                ref={mapRef}
                apartments={apartments}
                apartmentsVisible={apartmentsVisible}
                activeApartmentId={activeApartmentId}
                onSelectApartment={handleSelectApartment}
              />

              {/* Nalaganje apartmajev */}
              {status === 'loading' ? (
                <div className="absolute left-1/2 top-4 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/80 bg-card/95 px-4 py-2 shadow-lg backdrop-blur">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm">Nalaganje apartmajev s spleta …</span>
                </div>
              ) : null}

              {/* Napaka nalaganja */}
              {status === 'error' ? (
                <div className="absolute left-1/2 top-4 z-[500] flex w-[min(92%,26rem)] -translate-x-1/2 items-start gap-2 rounded-xl border border-destructive/30 bg-card/95 p-3 shadow-lg backdrop-blur">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium">Apartmajev ni bilo mogoče naložiti.</p>
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

          {/* Seznam apartmajev (ko je Slovenija izbrana) */}
          {sloveniaSelected ? (
            <section aria-label="Seznam apartmajev" className="mt-6">
              {status === 'ready' ? (
                <div className="rounded-2xl border border-border/80 bg-card shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Išči po imenu, kraju ali ulici …"
                        className="pl-9"
                        aria-label="Iskanje apartmajev"
                      />
                    </div>
                    <div className="dsa-scroll-list flex max-w-full gap-1.5 overflow-x-auto pb-1 sm:max-w-[60%]">
                      <button
                        type="button"
                        onClick={() => setRegionFilter(null)}
                        className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          regionFilter === null
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background hover:bg-accent'
                        }`}
                      >
                        Vse ({apartmentsCount})
                      </button>
                      {regionCounts.map(([region, count]) => (
                        <button
                          key={region}
                          type="button"
                          onClick={() => setRegionFilter(region === regionFilter ? null : region)}
                          className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            regionFilter === region
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background hover:bg-accent'
                          }`}
                        >
                          {region} ({count})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="dsa-scroll-list max-h-96 overflow-y-auto p-2">
                    <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {filtered.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectFromList(a.id)}
                            className={`w-full rounded-xl border p-3 text-left transition-colors ${
                              activeApartmentId === a.id
                                ? 'border-primary bg-accent'
                                : 'border-transparent hover:border-border hover:bg-accent/60'
                            }`}
                            aria-current={activeApartmentId === a.id}
                          >
                            <p className="line-clamp-1 text-sm font-semibold">{a.name}</p>
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {[a.city ?? a.region, a.street].filter(Boolean).join(' · ')}
                            </p>
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-primary">
                                od ~{a.priceFrom} € / noč
                              </span>
                              <span className="text-[10.5px] text-muted-foreground">
                                {a.stars ? '★'.repeat(a.stars) : 'ocena'}
                              </span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {filtered.length === 0 ? (
                      <p className="p-8 text-center text-sm text-muted-foreground">
                        Ni zadetkov za »{query}«{regionFilter ? ` v regiji ${regionFilter}` : ''}.
                      </p>
                    ) : null}
                  </div>

                  <p className="border-t border-border/70 px-4 py-2.5 text-[11px] text-muted-foreground">
                    Prikazanih {filtered.length} od {apartmentsCount} apartmajev · podatki:
                    OpenStreetMap prek {dataSource === 'overpass' ? 'Overpass API' : 'Nominatim'} ·
                    zadnje usklajevanje: {formatUpdatedAt(updatedAt)} · cene so indikativne ocene.
                  </p>
                </div>
              ) : status === 'loading' ? (
                <div className="space-y-2 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                  <Skeleton className="h-9 w-full" />
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-xl" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {status === 'error'
                      ? 'Nalaganje ni uspelo — poskusi znova (gumb na zemljevidu zgoraj).'
                      : 'V spustnem okencu izberi '}
                    {status !== 'error' ? (
                      <>
                        <strong className="text-foreground">Apartmaji</strong> — tu se pokaže
                        celoten seznam z filtri.
                      </>
                    ) : null}
                  </p>
                </div>
              )}
            </section>
          ) : null}
        </div>
      </main>

      {/* Lepljiva noga */}
      <footer className="mt-auto border-t border-border/80 bg-card/60 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p className="font-display text-foreground/80">
            Discover Slovenia <span className="text-primary">AI</span>
            <span className="ml-2 font-sans text-muted-foreground">
              — spustno okence, države in apartmaji na enem zemljevidu
            </span>
          </p>
          <p>
            Zemljevid &amp; podatki &copy;{' '}
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
