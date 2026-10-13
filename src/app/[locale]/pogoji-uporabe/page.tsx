import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import TermsView from "./view";

/**
 * /pogoji-uporabe — pravna stran (strežniški ovoj).
 *
 * Besedilo (1:1 iz produkcije) nosi odjemalski TermsView (./view.tsx);
 * ta ovoj razglasi hreflang alternates za vseh 6 jezikov
 * (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "/pogoji-uporabe");
}

export default function TermsPage() {
  return <TermsView />;
}
