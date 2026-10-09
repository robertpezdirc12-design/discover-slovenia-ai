import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import PartnerView from "./view";

/**
 * /partner — portal partnerja (strežniški ovoj).
 *
 * Vsebino (ponudbe, urejevalnik, moderacijska zanka) nosi odjemalski
 * PartnerView (./view.tsx); ta ovoj razglasi hreflang alternates za
 * vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/partner") };
}

export default function PartnerPage() {
  return <PartnerView />;
}
