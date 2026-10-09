import type { Metadata } from "next";

import { EventsView } from "@/components/content/events-view";
import { alternatesFor } from "@/lib/hreflang";

/**
 * /dogodki — koledar 30 dogodkov 1:1 iz produkcije (mirror /dogodki).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Dogodki",
    description:
      "Dogodki in prireditve v Sloveniji — od festivalov in sejemov do športa in kulture, z datumi, lokacijami in kategorijami.",
    alternates: alternatesFor(locale, "/dogodki"),
    keywords: ["dogodki", "festivali", "koledar", "Slovenija", "prireditve"],
  };
}

export default function DogodkiPage() {
  return <EventsView />;
}
