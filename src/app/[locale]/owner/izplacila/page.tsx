import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import OwnerIzplacilaView from "./view";

/**
 * /owner/izplacila — nadzorna plošča izplačil (strežniški ovoj).
 *
 * Vsebino (življenjski cikel izplačil, AuditLog) nosi odjemalski
 * OwnerIzplacilaView (./view.tsx); ta ovoj razglasi hreflang alternates
 * za vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/owner/izplacila") };
}

export default function OwnerPayoutsPage() {
  return <OwnerIzplacilaView />;
}
