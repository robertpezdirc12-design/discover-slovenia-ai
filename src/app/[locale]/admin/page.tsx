import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import AdminView from "./view";

/**
 * /admin — skrbniški portal (strežniški ovoj).
 *
 * Vsebino (razdelke leadi/ponudbe/konzultacije) nosi odjemalski
 * AdminView (./view.tsx); ta ovoj razglasi hreflang alternates za
 * vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/admin") };
}

export default function AdminPage() {
  return <AdminView />;
}
