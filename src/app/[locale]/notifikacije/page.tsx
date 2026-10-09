import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import NotifikacijeView from "./view";

/**
 * /notifikacije — notifikacijski center (strežniški ovoj).
 *
 * Vsebino (in-app inbox + spremljanja) nosi odjemalski
 * NotifikacijeView (./view.tsx); ta ovoj razglasi hreflang alternates
 * za vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/notifikacije") };
}

export default function NotifikacijePage() {
  return <NotifikacijeView />;
}
