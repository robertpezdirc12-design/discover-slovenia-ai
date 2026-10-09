import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import PrivacyView from "./view";

/**
 * /politika-zasebnosti — pravna stran (strežniški ovoj).
 *
 * Besedilo (1:1 iz produkcije) nosi odjemalski PrivacyView (./view.tsx);
 * ta ovoj razglasi hreflang alternates za vseh 6 jezikov
 * (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/politika-zasebnosti") };
}

export default function PrivacyPage() {
  return <PrivacyView />;
}
