import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import MapView from "./view";

/**
 * /zemljevid — interaktivni zemljevid (strežniški ovoj).
 *
 * Glavo strani + Leaflet (next/dynamic ssr:false — klientno nalaganje)
 * nosi odjemalski MapView (./view.tsx); ta ovoj razglasi hreflang
 * alternates za vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "/zemljevid");
}

export default function MapPage() {
  return <MapView />;
}
