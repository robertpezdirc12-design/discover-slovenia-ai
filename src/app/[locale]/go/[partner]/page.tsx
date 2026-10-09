import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import GoPartnerView from "./view";

/**
 * /go/[partner] — partnerska podstran (strežniški ovoj).
 *
 * Vsebino (vodene povezave P0-F, iskreni stub-i izven registra)
 * nosi odjemalski GoPartnerView (./view.tsx); ta ovoj razglasi
 * hreflang alternates za vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; partner: string }>;
}): Promise<Metadata> {
  const { locale, partner } = await params;
  return { alternates: alternatesFor(locale, `/go/${partner}`) };
}

export default function GoPartnerPage() {
  return <GoPartnerView />;
}
