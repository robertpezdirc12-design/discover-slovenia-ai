import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GuidesView } from "@/components/content/guides-view";

/**
 * /vodici — vodiči in nasveti (22 road-trip vodnikov + 16 člankov).
 * Vsebina 1:1 iz produkcije (mirror /vodici + rss.xml).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ namespace: "meta" });
  return {
    title: "Vodiči",
    description:
      "Vodiči in nasveti za Slovenijo — zimski vodniki, krožna potovanja, jadranski road tripovi in zgodbe urednikov.",
    alternates: { canonical: "/vodici" },
    keywords: ["vodiči", "road trip", "Slovenija", "itinererji", t("title")],
  };
}

export default function VodiciPage() {
  return <GuidesView />;
}
