import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import JourneyView from "./view";

/**
 * /potovanje — časovnica potovanja (strežniški ovoj).
 *
 * Vsebino (dnevi, segmenti, rezervacije) nosi odjemalski JourneyView
 * (./view.tsx); ta ovoj razglasi hreflang alternates za vseh
 * 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "/potovanje");
}

export default function JourneyPage() {
  return <JourneyView />;
}
