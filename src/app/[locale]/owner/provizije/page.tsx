import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import OwnerProvizijeView from "./view";

/**
 * /owner/provizije — provizije in klikanja (strežniški ovoj).
 *
 * Vsebino (klikanja kot lastna meritev, provizije iz poročil) nosi
 * odjemalski OwnerProvizijeView (./view.tsx); ta ovoj razglasi hreflang
 * alternates za vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/owner/provizije") };
}

export default function OwnerProvizijePage() {
  return <OwnerProvizijeView />;
}
