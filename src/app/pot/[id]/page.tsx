import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { db } from '@/lib/db';
import { GUIDE_REGIONS } from '@/lib/guide-store';
import {
  parseSharedTrip,
  sharedStays,
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

async function loadSharedTrip(id: string) {
  // Koda mora biti iz našega abecede — a priori zaščita pred čudnimi vhodi.
  if (!/^[2-9A-Z]{6,16}$/.test(id)) return null;
  const row = await db.sharedTrip.findUnique({ where: { id } });
  if (!row) return null;
  const state = parseSharedTrip(row.data);
  if (!state) return null;
  return state;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const state = await loadSharedTrip(id).catch(() => null);
  if (!state) return { title: 'Deljena pot · Odkrij Slovenijo' };
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

export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const state = await loadSharedTrip(id).catch(() => null);
  if (!state) notFound();

  const region = GUIDE_REGIONS.find((g) => g.id === state.region);
  const stays = sharedStays(state);
  const payload = JSON.stringify({
    interests: state.interests,
    region: state.region,
    days: state.days,
    pace: state.pace,
    stays: state.stays,
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
                {state.days ? `${state.days} ${state.days === 1 ? 'dan' : 'dni'}` : 'dolžina: prosti tok'}
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
    </main>
  );
}
