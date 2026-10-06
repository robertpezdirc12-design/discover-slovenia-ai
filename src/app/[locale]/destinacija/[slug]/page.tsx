import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { DestinationDetail } from "@/components/destination-detail";
import { DESTINATIONS, getDestination } from "@/lib/slovenia-data";

/**
 * /destinacija/[slug] — podrobnost destinacije (SSG po slug-u).
 * Neznan slug → notFound() → [locale]/not-found.tsx.
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
    alternates: { canonical: `/destinacija/${d.slug}` },
    other: { "format-detection": "telephone=no" },
    keywords: [d.name, d.tagline, t("title")],
  };
}

export default async function DestinationPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const d = getDestination(slug);
  if (!d) notFound();
  return <DestinationDetail d={d} />;
}
