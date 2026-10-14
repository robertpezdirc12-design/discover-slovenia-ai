import type { Metadata } from "next";
import { headers } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { DestinationCard } from "@/components/destination-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  ALL_COUNTRY_CODES,
  COUNTRIES,
  countryName,
} from "@/lib/countries-data";
import { type CountryCode } from "@/lib/slovenia-data";
import { COUNTRY_SEO, COUNTRY_UI, countryGeoCenter } from "@/lib/countries-seo";
import { EVENTS, eventCountry } from "@/lib/content-data";
import { alternatesFor } from "@/lib/hreflang";
import { asPickLocale, pick } from "@/lib/i18n-pick";
import {
  countryTouristDestinationJsonLd,
  jsonldScriptHtml,
} from "@/lib/jsonld";
import { LOKALI } from "@/lib/lokali-data";
import { DESTINATIONS } from "@/lib/slovenia-data";

/**
 * /drzava/[code] — državna landing stran (#41 Faza 3, 2.57.0).
 *
 * Per-country hub: hero z zastavo + imenom v AKTIVNEM jeziku, praktične
 * informacije (valuta, klicna, številka v sili, jezik — meta iz F0
 * countries-data), kurirane destinacije države, dogodki in lokali z
 * iskrenimi praznimi stanji (#38: registru ni vnosa → rečemo, ne ugibamo).
 *
 * SEO (kanon page-metadata/destinacija): unikaten 6-jezičen naslov + opis
 * iz countries-seo, hreflang alternates prek alternatesFor, JSON-LD
 * TouristDestination z geo središčem IZPELJANIM iz kuriranih destinacij
 * (brez izmišljenih koordinat; image izpuščen — emoji zastave, brez
 * binarnih sredstev). Inline skripta nosi CSP nonce (enak mehanizem kot
 * destinacija/[slug]).
 *
 * SSG: generateStaticParams = ALL_COUNTRY_CODES (10 držav kanona F0).
 * Neznana koda → notFound() → [locale]/not-found.tsx.
 */

interface Props {
  params: Promise<{ locale: string; code: string }>;
}

export function generateStaticParams() {
  return ALL_COUNTRY_CODES.map((code) => ({ code }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, code } = await params;
  if (!ALL_COUNTRY_CODES.includes(code as CountryCode)) return {};
  const c = code as CountryCode;
  const lang = asPickLocale(locale);
  const name = countryName(locale, c);
  return {
    title: pick(locale, COUNTRY_SEO[c].title) as string,
    description: pick(locale, COUNTRY_SEO[c].description) as string,
    openGraph: {
      title: `${name} · Discover Slovenia AI`,
      description: (pick(locale, COUNTRY_SEO[c].description) as string).slice(0, 155),
      type: "website",
    },
    alternates: alternatesFor(locale, `/drzava/${c}`),
    keywords: [name, "Discover Slovenia AI", COUNTRIES[c].currency],
  };
}

export default async function CountryPage({ params }: Props) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  if (!ALL_COUNTRY_CODES.includes(code as CountryCode)) notFound();
  const c = code as CountryCode;
  const meta = COUNTRIES[c];
  const lang = asPickLocale(locale);

  const dests = DESTINATIONS.filter((d) => d.country === c);
  const events = EVENTS.filter((e) => eventCountry(e) === c);
  const lokalList = LOKALI.filter((l) => l.country === c);
  const center = countryGeoCenter(dests);
  const ui = (k: keyof typeof COUNTRY_UI) => pick(locale, COUNTRY_UI[k]) as string;
  // CSP nonce (middleware → x-nonce) — enak mehanizem kot destinacija/[slug].
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <PageHeader
        kicker={meta.flag}
        title={countryName(locale, c)}
        lead={pick(locale, COUNTRY_SEO[c].description) as string}
      />

      {/* ── Praktične informacije (meta F0) ─────────────────────────────── */}
      <section aria-label={ui("prakticno")} className="space-y-3">
        <h2 className="text-lg font-semibold">{ui("prakticno")}</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {ui("valuta")}: {meta.currency}
          </Badge>
          <Badge variant="outline">
            {ui("klicna")}: +{meta.phoneCode}
          </Badge>
          <Badge variant="outline">
            {ui("sili")}: {meta.emergency}
          </Badge>
          <Badge variant="outline">
            {ui("jezik")}: {meta.primaryLanguage}
          </Badge>
        </div>
      </section>

      {/* ── Destinacije države (kurirano, DestinationCard reuse) ────────── */}
      <section aria-label={ui("destinacije")} className="space-y-4">
        <h2 className="text-lg font-semibold">
          {ui("destinacije")}{" "}
          <span className="text-muted-foreground">({dests.length})</span>
        </h2>
        {dests.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dests.map((d, i) => (
                <DestinationCard key={d.id} d={d} priority={i < 3} />
              ))}
            </div>
            <Button asChild variant="outline">
              <Link href={{ pathname: "/destinacije", query: { country: c } }}>
                {ui("ctaDestinacije")}
              </Link>
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{ui("brezDestinacij")}</p>
        )}
      </section>

      {/* ── Dogodki države (iskreno prazno stanje, kanon #38) ───────────── */}
      <section aria-label={ui("dogodki")} className="space-y-4">
        <h2 className="text-lg font-semibold">
          {ui("dogodki")}{" "}
          <span className="text-muted-foreground">({events.length})</span>
        </h2>
        {events.length > 0 ? (
          <>
            <ul className="divide-y rounded-xl border">
              {events.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {e.venue} · {e.dateLabel}
                    </p>
                  </div>
                  <Badge variant="secondary">{e.category}</Badge>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline">
              <Link href={{ pathname: "/dogodki", query: { country: c } }}>
                {ui("ctaDogodki")}
              </Link>
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{ui("brezDogodkov")}</p>
        )}
      </section>

      {/* ── Lokali države (iskreno prazno stanje) ───────────────────────── */}
      <section aria-label={ui("lokali")} className="space-y-4">
        <h2 className="text-lg font-semibold">
          {ui("lokali")}{" "}
          <span className="text-muted-foreground">({lokalList.length})</span>
        </h2>
        {lokalList.length > 0 ? (
          <ul className="divide-y rounded-xl border">
            {lokalList.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{l.name}</p>
                  <p className="text-sm text-muted-foreground">{l.town}</p>
                </div>
                <Badge variant="secondary">{l.category}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{ui("brezLokalov")}</p>
        )}
      </section>

      {/* ── JSON-LD (CSP nonce; geo izpeljano iz kuriranih destinacij) ──── */}
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: jsonldScriptHtml(
            countryTouristDestinationJsonLd(
              c,
              locale,
              countryName(locale, c),
              pick(locale, COUNTRY_SEO[c].description) as string,
              center,
            ),
          ),
        }}
      />
    </div>
  );
}
