import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { GUIDE_REGIONS, formatDaysCount, type GuideState } from '@/lib/guide-store';
import {
  isSharedTripExpired,
  parseSharedTrip,
  sharedStays,
  sharedTripExpiry,
  tripHeadline,
  tripShareDescription,
} from '@/lib/share-trip';
import { ImportSharedTripButton } from './import-button';

/**
 * Deljena pot (/pot/[id]) — Wanderlogov vzorec "poglej moj načrt".
 *
 * Server component: pot iz baze → povzetek (regija, dnevi, tempo,
 * interesi, rezervirana prenočišča) + uvoz v prejemnikov vodeni tok.
 * OG metapodatki so PER-POT (naslov/opis), slika = blagovna OG slika
 * aplikacije (opengraph-image na korenu velja za vse rute).
 */

type SharedTripResult =
  | { status: 'ok'; state: GuideState; expiresAt: Date }
  | { status: 'missing' }
  | { status: 'error' };

// cache() prepreči dvojno poizvedbo v istem requestu (metadata + page).
// Baze NE pretvarjamo v 404: 404 bi pomenil "pot ne obstaja", zato napako
// vrnemo kot ločeno stanje in stran pokaže jasno sporočilo.
const loadSharedTrip = cache(async (id: string): Promise<SharedTripResult> => {
  // Koda mora biti iz naše abecede — a priori zaščita pred čudnimi vhodi.
  if (!/^[2-9A-Z]{6,16}$/.test(id)) return { status: 'missing' };

  let row;
  try {
    row = await withDbTimeout(db.sharedTrip.findUnique({ where: { id } }));
  } catch (err) {
    console.error('pot: branje deljene poti ni uspelo', err);
    return { status: 'error' };
  }

  if (!row) return { status: 'missing' };
  if (isSharedTripExpired(row.createdAt)) {
    // Ob obisku potekle povezave počistimo zapis (best effort, ne blokira 404).
    void withDbTimeout(db.sharedTrip.deleteMany({ where: { id } }), 2_000).catch(() => {
      /* čiščenje je prijetnost */
    });
    return { status: 'missing' };
  }
  const state = parseSharedTrip(row.data);
  if (!state) return { status: 'missing' };
  return { status: 'ok', state, expiresAt: sharedTripExpiry(row.createdAt) };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const trip = await loadSharedTrip(id);
  if (trip.status !== 'ok') {
    return {
      title: 'Deljena pot · Odkrij Slovenijo',
      robots: { index: false }, // napake in potekle povezave ne sodijo v iskalnike
    };
  }
  const state = trip.state;
  return {
    title: `Pot: ${tripHeadline(state)} · Odkrij Slovenijo`,
    description: tripShareDescription(state),
    alternates: { canonical: `/pot/${id}` },
    openGraph: {
      title: `Moja pot po Sloveniji — ${tripHeadline(state)}`,
      description: tripShareDescription(state),
      url: `/pot/${id}`,
      type: 'website',
      locale: 'sl_SI',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Moja pot po Sloveniji — ${tripHeadline(state)}`,
      description: tripShareDescription(state),
    },
    robots: { index: false }, // osebne poti ne smejo konkurirati vsebini v iskalnikih
  };
}

function SharedTripUnavailable({ id }: { id: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Deljena pot
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Poti trenutno ni mogoče naložiti
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        Povezava je videti veljavna, a se strežnik s podatki ni odzval. Poskusi
        znova; če se napaka ponovi, povezavo odpri nekoliko kasneje.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <a href={`/pot/${id}`}>
            <RefreshCw className="size-4" aria-hidden />
            Poskusi znova
          </a>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Nazaj na začetek</Link>
        </Button>
      </div>
    </main>
  );
}

export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await loadSharedTrip(id);
  if (trip.status === 'missing') notFound();
  if (trip.status === 'error') return <SharedTripUnavailable id={id} />;
  const state = trip.state;

  const region = GUIDE_REGIONS.find((g) => g.id === state.region);
  const stays = sharedStays(state);
  const payload = JSON.stringify({
    interests: state.interests,
    region: state.region,
    days: state.days,
    pace: state.pace,
    // Tudi tu ne prenašajmo datumov rezervacij: prejemnik dobi vsebino poti,
    // ne kdaj si je lastnik kaj rezerviral.
    stays: state.stays.map(({ id, name, city, lat, lng, priceFrom }) => ({
      id,
      name,
      city,
      lat,
      lng,
      priceFrom,
    })),
    completedAt: state.completedAt,
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-10 sm:px-6">
      <Card className="overflow-hidden">
        <div className="border-b bg-emerald-600/10 px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            Deljena pot
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            Moja pot po Sloveniji — {tripHeadline(state)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tripShareDescription(state)}
          </p>
        </div>

        <CardContent className="flex flex-col gap-5 p-6">
          {state.interests.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Interesi</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {state.interests.map((i) => (
                  <Badge key={i} variant="secondary" className="capitalize">
                    {i}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {region && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Regija</p>
                <p className="font-medium">{region.label}</p>
              </div>
            )}
            <div className="rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Podrobnosti</p>
              <p className="font-medium">
                {state.days ? formatDaysCount(state.days) : 'dolžina: prosti tok'}
                {state.pace ? ` · tempo: ${state.pace}` : ''}
              </p>
            </div>
          </div>

          {stays.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Rezervirana prenočišča ({stays.length})
              </p>
              <ul className="nice-scroll mt-1.5 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {stays.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-baseline gap-2 rounded-lg border px-3 py-2"
                  >
                    <span className="text-xs font-semibold text-emerald-700">
                      {i + 1}.
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.city}
                        {s.priceFrom != null ? ` · od ${s.priceFrom} €/noč` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ImportSharedTripButton payload={payload} />
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href="/" className="underline underline-offset-2 hover:text-foreground">
          Odkrij Slovenijo
        </Link>{' '}
        — vodič, zemljevid, prenočišča in odprti podatki.
      </p>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Povezava poteče{' '}
        {trip.expiresAt.toLocaleDateString('sl-SI', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        .
      </p>
    </main>
  );
}
