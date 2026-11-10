'use client';

import { useState } from 'react';
import { Loader2, MapPin, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  CUSTOM_STOPS_EVENT,
  CUSTOM_STOPS_KEY,
  MAX_CUSTOM_STOPS,
  placesToStops,
  serializeCustomStops,
  type GeocodedPlace,
} from '@/lib/import-places';
import { useToast } from '@/hooks/use-toast';

/**
 * START ANYWHERE — uvoz krajev iz besedila.
 * Prilepi seznam krajev (npr. iz Google Maps), mi jih geokodiraMo in
 * dodamo v pot — povsem deterministično (brez AI modela).
 */

interface LoadState {
  status: 'idle' | 'loading' | 'done' | 'error';
  results?: GeocodedPlace[];
  error?: string;
}

export function ImportPlacesDialog({ existingNames }: { existingNames: ReadonlySet<string> }) {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());

  const runGeocode = async () => {
    if (!input.trim()) return;
    setLoad({ status: 'loading' });
    try {
      const res = await fetch('/api/pot/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        results?: GeocodedPlace[];
        error?: string;
      };
      if (!data.ok || !data.results) {
        setLoad({ status: 'error', error: data.error ?? 'Ni rezultatov.' });
        return;
      }
      setLoad({ status: 'done', results: data.results });
      setSelected(new Set(data.results.map((_, i) => i).filter((i) => data.results![i].ok)));
    } catch {
      setLoad({ status: 'error', error: 'Strežnik ni dosegljiv.' });
    }
  };

  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const importSelected = () => {
    if (!load.results) return;
    const chosen = load.results.filter((_, i) => selected.has(i));
    const stops = placesToStops(chosen, existingNames);
    if (stops.length === 0) {
      toast({ title: 'Ni izbranih krajev', description: 'Izberi vsaj enega od najdenih krajev.' });
      return;
    }
    try {
      const prev = window.localStorage.getItem(CUSTOM_STOPS_KEY);
      const existing = JSON.parse(prev ?? '[]') as unknown[];
      window.localStorage.setItem(CUSTOM_STOPS_KEY, serializeCustomStops([...existing, ...stops] as never));
    } catch {
      window.localStorage.setItem(CUSTOM_STOPS_KEY, serializeCustomStops(stops));
    }
    window.dispatchEvent(new Event(CUSTOM_STOPS_EVENT));
    toast({
      title: `Dodanih ${stops.length} ${stops.length === 1 ? 'kraj' : 'krajev'}`,
      description: 'Pot in zemljevid sta posodobljena.',
    });
    setInput('');
    setLoad({ status: 'idle' });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-11 w-full sm:h-8">
          <Plus className="size-3.5" aria-hidden />
          Uvozi kraje (Start Anywhere)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" aria-hidden />
            Uvozi kraje
          </DialogTitle>
          <DialogDescription>
            Prilepi seznam krajev (vsak v svojo vrstico ali ločene s podpičjem) — npr. „Zagreb, Sarajevo, Mostar“.
            Kraje geokodiraMo in dodamo v tvojo pot.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Zagreb\nSarajevo\nMostar\n… (največ ${MAX_CUSTOM_STOPS})`}
          rows={5}
          aria-label="Seznam krajev za uvoz"
        />

        {load.status === 'loading' && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Geokodiranje …
          </p>
        )}
        {load.status === 'error' && <p className="text-xs text-destructive">{load.error}</p>}
        {load.status === 'done' && load.results && (
          <ul className="nice-scroll max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {load.results.map((r, i) => (
              <li key={`${r.q}-${i}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                  disabled={!r.ok}
                  className="size-4 shrink-0 accent-primary"
                  aria-label={`Vključi ${r.q}`}
                />
                {r.ok ? (
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.q}
                      {r.country ? ` · ${r.country}` : ''}
                      {r.outsideBalkan ? ' · zunaj Balkan bboxa' : ''}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    „{r.q}“ ni bilo najdeno
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={runGeocode} disabled={load.status === 'loading' || !input.trim()}>
            {load.status === 'loading' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
            Geokodiraj
          </Button>
          <Button type="button" onClick={importSelected} disabled={load.status !== 'done' || selected.size === 0}>
            Dodaj v pot ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
