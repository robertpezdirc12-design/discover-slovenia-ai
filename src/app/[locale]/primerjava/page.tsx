import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import PrimerjavaView from "./view";

/**
 * /primerjava — iskrena primerjava AI načrtovalcev (strežniški ovoj).
 *
 * Besedilo (1:1 vsebina produkcije) nosi odjemalski PrimerjavaView
 * (./view.tsx); ta ovoj razglasi hreflang alternates za vseh
 * 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/primerjava") };
}

export default function PrimerjavaPage() {
  return <PrimerjavaView />;
}
