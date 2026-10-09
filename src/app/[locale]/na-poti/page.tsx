import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import GoModeView from "./view";

/**
 * /na-poti — Go Mode (živi GPS vodič) (strežniški ovoj).
 *
 * Vsebino (živi GPS, vreme, off-route preusmeritve) nosi odjemalski
 * GoModeView (./view.tsx); ta ovoj razglasi hreflang alternates za
 * vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/na-poti") };
}

export default function GoModePage() {
  return <GoModeView />;
}
