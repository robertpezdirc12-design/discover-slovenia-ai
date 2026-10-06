import type { Metadata } from "next";

import { EventsView } from "@/components/content/events-view";

/**
 * /dogodki — koledar 30 dogodkov 1:1 iz produkcije (mirror /dogodki).
 */
export const metadata: Metadata = {
  title: "Dogodki",
  description:
    "Dogodki in prireditve v Sloveniji — od festivalov in sejemov do športa in kulture, z datumi, lokacijami in kategorijami.",
  alternates: { canonical: "/dogodki" },
  keywords: ["dogodki", "festivali", "koledar", "Slovenija", "prireditve"],
};

export default function DogodkiPage() {
  return <EventsView />;
}
