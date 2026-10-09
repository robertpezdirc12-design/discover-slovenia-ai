import type { Metadata } from "next";

import { ExperiencesView } from "@/components/content/experiences-view";
import { alternatesFor } from "@/lib/hreflang";

/**
 * /dozivetja — tipi doživetij 1:1 iz produkcije (mirror /dozivetja).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Doživetja",
    description:
      "Pohodništvo, vodne avanture, kultura, kulinarika in skriti biseri — doživetja neposredno pri preverjenih lokalnih ponudnikih.",
    alternates: alternatesFor(locale, "/dozivetja"),
    keywords: ["doživetja", "izkušnje", "pohodništvo", "rafting", "Slovenija"],
  };
}

export default function DozivetjaPage() {
  return <ExperiencesView />;
}
