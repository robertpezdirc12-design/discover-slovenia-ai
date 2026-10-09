import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import MojProfilView from "./view";

/**
 * /moj-profil — profil uporabnika (strežniški ovoj).
 *
 * Vsebino (preference, spomin, zasebnost) nosi odjemalski
 * MojProfilView (./view.tsx); ta ovoj razglasi hreflang alternates
 * za vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/moj-profil") };
}

export default function MojProfilPage() {
  return <MojProfilView />;
}
