import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import OwnerView from "./view";

/**
 * /owner — portal za lastnike lokalov (strežniški ovoj).
 *
 * Vsebino (vstop v portal, iskreno stanje) nosi odjemalski OwnerView
 * (./view.tsx); ta ovoj razglasi hreflang alternates za vseh
 * 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/owner") };
}

export default function OwnerPage() {
  return <OwnerView />;
}
