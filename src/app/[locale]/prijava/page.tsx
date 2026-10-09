import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import PrijavaView from "./view";

/**
 * /prijava — prijava/registracija (strežniški ovoj).
 *
 * Obrazec (NextAuth credentials) nosi odjemalski PrijavaView
 * (./view.tsx); ta ovoj razglasi hreflang alternates za vseh
 * 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/prijava") };
}

export default function PrijavaPage() {
  return <PrijavaView />;
}
