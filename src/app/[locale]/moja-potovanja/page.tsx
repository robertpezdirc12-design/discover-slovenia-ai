import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import MyTripsView from "./view";

/**
 * /moja-potovanja — potovanja uporabnika (strežniški ovoj).
 *
 * Vsebino (lokalna + oblačna potovanja) nosi odjemalski MyTripsView
 * (./view.tsx); ta ovoj razglasi hreflang alternates za vseh
 * 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/moja-potovanja") };
}

export default function MyTripsPage() {
  return <MyTripsView />;
}
