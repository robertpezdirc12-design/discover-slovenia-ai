import type { Metadata } from "next";

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

export default function TrznicaPage() {
  return <TrznicaExplorer />;
}
