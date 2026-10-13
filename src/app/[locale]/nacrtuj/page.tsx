import type { Metadata } from "next";
import { cookies } from "next/headers";

import { pageMetadata } from "@/lib/page-metadata";
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
  return pageMetadata(locale, "/nacrtuj");
}

export default async function PlanPage() {
  // POLIR13 (2.40.0): sejni piškotek dai:next-step-dismissed (zrcal
  // sessionStorage ob dismissu) preberemo na strežniku in next-step kartico
  // izpustimo ŽE v SSR — po ponovnem nalaganju v isti seji je ni (0 px
  // premika, CLS ≈ 0 tudi po dismissu).
  const nextStepDismissed =
    (await cookies()).get("dai:next-step-dismissed")?.value === "1";
  return <PlanView nextStepDismissed={nextStepDismissed} />;
}
