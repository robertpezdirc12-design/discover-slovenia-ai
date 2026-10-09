import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import SloveniaPassView from "./view";

/**
 * /slovenia-pass — predstavitev pasa (strežniški ovoj).
 *
 * Vsebino (hero, koristi, regije značk) nosi odjemalski
 * SloveniaPassView (./view.tsx); ta ovoj razglasi hreflang alternates
 * za vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/slovenia-pass") };
}

export default function SloveniaPassPage() {
  return <SloveniaPassView />;
}
