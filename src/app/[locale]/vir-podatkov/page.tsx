import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import DataSourceView from "./view";

/**
 * /vir-podatkov — vir podatkov in iskrenost (strežniški ovoj).
 *
 * Vsebino (provenance vsebin, STO iskanje) nosi odjemalski
 * DataSourceView (./view.tsx); ta ovoj razglasi hreflang alternates
 * za vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "/vir-podatkov");
}

export default function DataSourcePage() {
  return <DataSourceView />;
}
