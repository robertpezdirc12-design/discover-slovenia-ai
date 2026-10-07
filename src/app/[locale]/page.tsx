import type { Metadata } from "next";

import { HomeView } from "@/components/home/home-view";

/**
 * / — DOMAČA STRAN (strežniški ovoj).
 *
 * Metadata: hreflang alternates za vseh 6 jezikov izvirnika
 * (sl brez predpone = x-default; en/it/de/fr/es s predpono) —
 * naslov/opis podeduje iz [locale]/layout.tsx (messages meta).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await params;
  return {
    alternates: {
      languages: {
        sl: "/",
        en: "/en",
        it: "/it",
        de: "/de",
        fr: "/fr",
        es: "/es",
        "x-default": "/",
      },
    },
  };
}

export default function HomePage() {
  return <HomeView />;
}
