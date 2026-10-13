import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import TrustSafetyView from "./view";

/**
 * /zaupanje-in-varnost — pravna stran (strežniški ovoj).
 *
 * Besedilo (1:1 iz produkcije) nosi odjemalski TrustSafetyView
 * (./view.tsx); ta ovoj razglasi hreflang alternates za vseh
 * 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "/zaupanje-in-varnost");
}

export default function TrustSafetyPage() {
  return <TrustSafetyView />;
}
