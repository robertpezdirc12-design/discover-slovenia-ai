import type { Metadata } from "next";

import { LokaliExplorer } from "@/components/lokali-explorer";
import { alternatesFor } from "@/lib/hreflang";

/**
 * /lokali — B2B imenik lokalnih ponudnikov (hoteli, restavracije,
 * aktivnosti). Vso interakcijo nosi odjemalski raziskovalec.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/lokali") };
}

export default function LokaliPage() {
  return <LokaliExplorer />;
}
