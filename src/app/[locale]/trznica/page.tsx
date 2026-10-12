import type { Metadata } from "next";
import { cookies } from "next/headers";

import { TrznicaExplorer } from "@/components/trznica-explorer";
import { alternatesFor } from "@/lib/hreflang";

/**
 * /trznica — tržnica lokalnih izdelkov in doživetij. Vsebuje:
 *  - LASTNA TRŽNICA (48-c): živi izdelki iz baze (GET /api/products) z
 *    lastnim B2C checkoutom (Stripe / demo plačila) in pasico ob
 *    vrnitvi s plačila (?placilo=uspeh|preklic);
 *  - zavihke izdelkov/izkušenj/ponudnikov (supply registry).
 * Vso interakcijo nosi odjemalski del.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/trznica") };
}

export default async function TrznicaPage() {
  // POLIR13 (2.40.0): sejni piškotek dai:next-step-dismissed (zrcal
  // sessionStorage ob dismissu) preberemo na strežniku in next-step kartico
  // izpustimo ŽE v SSR — po ponovnem nalaganju v isti seji je ni (0 px
  // premika, CLS ≈ 0 tudi po dismissu).
  const nextStepDismissed =
    (await cookies()).get("dai:next-step-dismissed")?.value === "1";
  return <TrznicaExplorer nextStepDismissed={nextStepDismissed} />;
}
