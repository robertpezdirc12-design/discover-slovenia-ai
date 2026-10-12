import type { Metadata } from "next";

import { EventsView } from "@/components/content/events-view";
import { pageMetadata } from "@/lib/page-metadata";

/**
 * /dogodki — koledar 31 dogodkov (30 iz produkcije + razdvojen zapis P0 2. serije).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "/dogodki");
}

export default function DogodkiPage() {
  return <EventsView />;
}
