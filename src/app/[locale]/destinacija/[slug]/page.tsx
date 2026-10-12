import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { DestinationDetail } from "@/components/destination-detail";
import { DESTINATIONS, getDestination } from "@/lib/slovenia-data";
import { alternatesFor } from "@/lib/hreflang";
import { jsonldScriptHtml, touristDestinationJsonLd } from "@/lib/jsonld";

/**
 * /destinacija/[slug] — podrobnost destinacije (SSG po slug-u).
 * Neznan slug → notFound() → [locale]/not-found.tsx.
 *
 * SEO JSON-LD (POLIR C, 2.28.0): schema.org TouristDestination — samo
 * polja, ki res obstajajo v kanonskih podatkih (name/description = SL
 * kanon, geo = realne koordinate, image = realna fotografija). Inline
 * skripta nosi CSP nonce z zahteve (middleware → x-nonce; brez nonca bi
 * jo produkcjska CSP blokirala — enak kanon kot layout/next-themes).
 *
 * POLIR10 (2.37.0): suppressHydrationWarning na ld+json skripti utiša
 * hidracijsko primerjavo PER-ZAHTEVNEGA atributa nonce (odjemalec ima v
 * flight podatkih prazen niz; vsebina skripte je deterministična in se
 * ne razlikuje) — enak kanon kot <html> za next-themes v layoutu;
 * nonce atribut OSTANE v izpisanem HTML (produkcjska CSP zahteva ga).
 */

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return DESTINATIONS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const d = getDestination(slug);
  if (!d) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: `${d.name} — ${d.tagline}`,
    description: d.description.slice(0, 155),
    openGraph: {
      title: `${d.name} · Discover Slovenia AI`,
      description: d.tagline,
      images: [{ url: d.image }],
      type: "article",
    },
    alternates: alternatesFor(locale, `/destinacija/${d.slug}`),
    other: { "format-detection": "telephone=no" },
    keywords: [d.name, d.tagline, t("title")],
  };
}

export default async function DestinationPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const d = getDestination(slug);
  if (!d) notFound();
  // CSP nonce (middleware → x-nonce) — enak mehanizem kot v layoutu.
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <DestinationDetail d={d} />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: jsonldScriptHtml(touristDestinationJsonLd(d, locale)),
        }}
      />
    </>
  );
}
