import type { Metadata } from "next";

import { GuidesView } from "@/components/content/guides-view";
import { pageMetadata } from "@/lib/page-metadata";

/**
 * /vodici — vodiči in nasveti (22 road-trip vodnikov + 16 člankov).
 * Vsebina 1:1 iz produkcije (mirror /vodici + rss.xml).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "/vodici");
}

export default function VodiciPage() {
  return <GuidesView />;
}
