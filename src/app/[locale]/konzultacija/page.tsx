import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import KonzultacijaView from "./view";

/**
 * /konzultacija — javni obrazec konzultacije (strežniški ovoj).
 *
 * Obrazec (POST /api/consultation) nosi odjemalski KonzultacijaView
 * (./view.tsx); ta ovoj razglasi hreflang alternates za vseh
 * 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/konzultacija") };
}

export default function KonzultacijaPage() {
  return <KonzultacijaView />;
}
