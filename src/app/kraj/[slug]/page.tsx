import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { countryInfoForRegion } from '@/lib/countries';
import {
  DESTINATIONS,
  destinationBySlug,
  destinationDescription,
  destinationJsonLd,
  destinationTitle,
  nearbyAttractions,
} from '@/lib/destinations';

/**
 * STATIČNA stran destinacije (/kraj/[slug]) — per-destination SEO.
 *
 * Vsaka destinacija iz kataloga vodiča dobi svojo stran: naslov/opis za
 * iskalnike (metadata + JSON-LD), zanimivosti v bližini in klic k dejanju
 * na zemljevid. Strani so preradane ob gradnji (generateStaticParams) in
 * samodejno v sitemap-u.
 */

const BASE = 'https://i-feel-slovenia.vercel.app';

export function generateStaticParams() {
  return DESTINATIONS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dest = destinationBySlug(slug);
  if (!dest) return { title: 'Destinacija · Odkrij Slovenijo' };
  const description = destinationDescription(dest);
  return {
    title: destinationTitle(dest),
    description,
    alternates: { canonical: `/kraj/${dest.slug}` },
    openGraph: {
      title: dest.name,
      description,
      url: `/kraj/${dest.slug}`,
      type: 'website',
      locale: 'sl_SI',
      siteName: 'Odkrij Slovenijo',
    },
  };
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dest = destinationBySlug(slug);
  if (!dest) notFound();

  const country = countryInfoForRegion(dest.regionId);
  const attractions = nearbyAttractions(dest);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(destinationJsonLd(dest, BASE)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Odkrij Slovenijo', item: `${BASE}/` },
              {
                '@type': 'ListItem',
                position: 2,
                name: dest.regionLabel,
                item: `${BASE}/#zemljevid`,
              },
              { '@type': 'ListItem', position: 3, name: dest.name },
            ],
          }),
        }}
      />

      <p className="text-xs text-muted-foreground">
        <Link href="/" className="underline underline-offset-2 hover:text-foreground">
          Odkrij Slovenijo
        </Link>{' '}
        · {dest.regionLabel}
      </p>

      <div className="mt-4 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
        <Badge className="mb-3 bg-primary/10 text-primary hover:bg-primary/15">Destinacija</Badge>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {dest.name}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {dest.note}. Vodič, zemljevid, prenočišča, javni prevoz in zanimivosti — vse na enem mestu.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Button asChild size="sm" className="h-11 sm:h-9">
            <Link href={`/?dest=${dest.slug}#zemljevid`}>Načrtuj pot · {dest.name}</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-11 sm:h-9">
            <Link href="/">Domov</Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Na pogled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Regija</span>
              <span className="font-medium">{dest.regionLabel}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Koordinate</span>
              <span className="font-mono text-xs">
                {dest.lat.toFixed(4)}, {dest.lng.toFixed(4)}
              </span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Zanimivosti v bližini</span>
              <span className="font-medium">{attractions.length}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kako do tja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm text-muted-foreground">
            <p>🚌 Javni prevoz iz Ljubljane s povezavami v realnem času.</p>
            <p>🚗 OSRM cestna pot med postanki, izvoz GPX za offline navigacijo.</p>
            <p>🏨 Iskanje prenočišč z indikativnimi cenami.</p>
          </CardContent>
        </Card>
      </div>

      {/* MEJE IN PREVOZ — kurirane informacije o državi (zunaj Slovenije). */}
      {country?.name && (
        <section className="mt-8">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {country.name}: meje in prevoz
            </h2>
            <Badge variant="secondary" className="text-xs">
              {country.eu && country.schengen
                ? 'EU · Schengen'
                : country.eu
                  ? 'EU (ni Schengen)'
                  : 'ni EU · mejne kontrole'}
            </Badge>
          </div>
          <ul className="mt-3 space-y-2">
            {country.transport.map((t) => (
              <li key={t} className="rounded-xl border bg-card/60 px-4 py-2.5 text-sm">
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">Praktično</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {country.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
          {country.links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {country.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-border/80 bg-card/70 px-3 py-1.5 text-xs transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  {l.label} ↗
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {attractions.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Zanimivosti v bližini {dest.name}
          </h2>
          <ul className="mt-3 space-y-2">
            {attractions.map((a) => (
              <li
                key={a.name}
                className="flex items-baseline justify-between gap-4 rounded-xl border bg-card/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.categoryLabel}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {a.distanceKm < 1
                    ? `${Math.round(a.distanceKm * 1000)} m`
                    : `${a.distanceKm.toFixed(1).replace('.', ',')} km`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Vir: urejeni izbor znamenitosti (koordinate so informativne).
          </p>
        </section>
      )}
    </main>
  );
}
