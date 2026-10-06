import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { GuideDetail } from "@/components/content/guide-detail";
import { GUIDES, getGuide } from "@/lib/content-data";

/**
 * /vodici/[slug] — podrobnost road-trip vodnika (SSG po 22 slugih).
 * Neznan slug → notFound() (iskrena 404).
 */

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.rssDescription.slice(0, 155),
    alternates: {
      canonical: `/vodici/${g.slug}`,
      languages: {
        sl: `/vodici/${g.slug}`,
        en: `/en/vodici/${g.slug}`,
      },
    },
    openGraph: {
      title: `${g.title} · Discover Slovenia AI`,
      description: g.rssDescription.slice(0, 155),
      type: "article",
    },
    other: { "format-detection": "telephone=no" },
  };
}

export default async function GuidePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const guide = getGuide(slug);
  if (!guide) notFound();
  return <GuideDetail guide={guide} />;
}
