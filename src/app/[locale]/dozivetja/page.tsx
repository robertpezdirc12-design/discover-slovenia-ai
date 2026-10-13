import type { Metadata } from "next";

import { ExperiencesView } from "@/components/content/experiences-view";
import { pageMetadata } from "@/lib/page-metadata";

/**
 * /dozivetja — tipi doživetij 1:1 iz produkcije (mirror /dozivetja).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "/dozivetja");
}

export default function DozivetjaPage() {
  return <ExperiencesView />;
}
