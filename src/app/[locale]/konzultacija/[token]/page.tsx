import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import KonzultacijaTokenView from "./view";

/**
 * /konzultacija/[token] — zasebna stran odgovora (strežniški ovoj).
 *
 * Vsebino (odgovor po žetonu, iskrenost fallback/manual) nosi
 * odjemalski KonzultacijaTokenView (./view.tsx); ta ovoj razglasi
 * hreflang alternates za vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}): Promise<Metadata> {
  const { locale, token } = await params;
  return { alternates: alternatesFor(locale, `/konzultacija/${token}`) };
}

export default function KonzultacijaTokenPage() {
  return <KonzultacijaTokenView />;
}
