import type { Metadata } from "next";

import { alternatesFor } from "@/lib/hreflang";
import PlanView from "./view";

/**
 * /nacrtuj — načrtovalnik potovanja (strežniški ovoj).
 *
 * Vsebino (deterministični načrtovalnik + PlanEditPanel) nosi
 * odjemalski PlanView (./view.tsx); ta ovoj razglasi hreflang
 * alternates za vseh 6 jezikov (sl brez predpone = x-default).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/nacrtuj") };
}

export default function PlanPage() {
  return <PlanView />;
}
