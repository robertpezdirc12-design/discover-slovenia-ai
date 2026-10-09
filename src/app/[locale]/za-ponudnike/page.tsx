import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import ForProvidersView from "./view";

/**
 * /za-ponudnike — stran za ponudnike + prijavnica (strežniški ovoj).
 *
 * Vsebino (paketi, beta ugodnosti, prijavnica P0-H) nosi odjemalski
 * ForProvidersView (./view.tsx); ta ovoj razglasi hreflang alternates
 * za vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/za-ponudnike") };
}

export default function ForProvidersPage() {
  return <ForProvidersView />;
}
