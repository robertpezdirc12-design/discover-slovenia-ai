import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import GoHubView from "./view";

/**
 * /go — osrednja postaja partnerjev (GO hub) (strežniški ovoj).
 *
 * Vsebino (10 partnerskih kategorij z iskrenimi statusi) nosi
 * odjemalski GoHubView (./view.tsx); ta ovoj razglasi hreflang
 * alternates za vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/go") };
}

export default function GoHubPage() {
  return <GoHubView />;
}
