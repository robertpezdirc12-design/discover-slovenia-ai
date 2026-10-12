import type { Metadata } from "next";

import { LokaliExplorer } from "@/components/lokali-explorer";
import { pageMetadata } from "@/lib/page-metadata";

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
  return pageMetadata(locale, "/lokali");
}

export default function LokaliPage() {
  return <LokaliExplorer />;
}
