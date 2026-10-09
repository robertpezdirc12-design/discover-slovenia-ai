import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import OwnerPrijavaView from "./view";

/**
 * /owner/prijava — prijava v portal lastnikov (strežniški ovoj).
 *
 * Obrazec (ogrodje 1:1 po produkciji) nosi odjemalski OwnerPrijavaView
 * (./view.tsx); ta ovoj razglasi hreflang alternates za vseh
 * 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/owner/prijava") };
}

export default function OwnerPrijavaPage() {
  return <OwnerPrijavaView />;
}
