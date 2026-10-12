import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import ContactView from "./view";

/**
 * /kontakt — kontakt (strežniški ovoj).
 *
 * Obrazec (POST /api/contact) nosi odjemalski ContactView
 * (./view.tsx); ta ovoj razglasi hreflang alternates za vseh
 * 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "/kontakt");
}

export default function ContactPage() {
  return <ContactView />;
}
