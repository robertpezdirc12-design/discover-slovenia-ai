import type { Metadata } from "next";

import { ExperiencesView } from "@/components/content/experiences-view";

/**
 * /dozivetja — tipi doživetij 1:1 iz produkcije (mirror /dozivetja).
 */
export const metadata: Metadata = {
  title: "Doživetja",
  description:
    "Pohodništvo, vodne avanture, kultura, kulinarika in skriti biseri — doživetja neposredno pri preverjenih lokalnih ponudnikih.",
  alternates: { canonical: "/dozivetja" },
  keywords: ["doživetja", "izkušnje", "pohodništvo", "rafting", "Slovenija"],
};

export default function DozivetjaPage() {
  return <ExperiencesView />;
}
