'use client';

/**
 * DOMAČA IZKUŠNJA — zemljevid + spustni okenci (država, prenočišča).
 *
 * Tok (po uporabnikovi zahtevi — preprosto, brez seznamov):
 *  1) čist regijski zemljevid (Slovenija + Balkan),
 *  2) okence »Izberi državo« → zemljevid se TAKOJ približa izbrani državi,
 *  3) okence »Prenočišča« → Apartmaji → pini VSEH apartmajev v Sloveniji
 *     na zemljevidu; klik na pin pokaže popup z vsemi podatki
 *     (ime, naslov, cena, zvezdice, spletna stran, telefon — OpenStreetMap).
 *
 * Stanja so izpeljana (brez setState v efektih); nalaganje ima ločeno
 * stanje (idle/loading/ready/error) z iskrenimi sporočili.
 */

import dynamic from 'next/dynamic';
import { useCallback, useRef, useState } from 'react';
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

  // ── Klik na apartma pin → poudarjen pin (popup se odpre samodejno) ────
  const handleSelectApartment = useCallback((id: string) => {
    setActiveApartmentId(id);
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
          <h1 className="sr-only">
            Discover Slovenia AI — zemljevid, države in apartmaji
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
                    {sloveniaSelected ? 'vsi v Sloveniji' : 'izberi Slovenijo'}
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
            <div className="relative h-[72vh] min-h-[480px] w-full">
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
