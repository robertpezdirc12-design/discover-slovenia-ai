import { NextResponse } from "next/server";

import { providersPublicDTO } from "@/lib/affiliate-providers";

export const dynamic = "force-dynamic";

/**
 * /api/affiliate/providers — javni seznam rezervacijskih partnerjev.
 *
 * Namen: Booking hub (domača stran) in kontekstualne kartice destinacij
 * NARIŠUJEJO kategorije in imena partnerjev iz tega seznama — brez
 * predlog povezav in BREZ žetonov (ti živijo samo v /api/affiliate/go
 * na strežniku).
 *
 * Iskrenost: odgovor vsebuje commissionable zastavico (gorivo = false)
 * in opombo o razkritju — „ko rezerviraš prek naše povezave, partner
 * nam plača provizijo; cena zate je enaka".
 */
export async function GET() {
  return NextResponse.json({
    providers: providersPublicDTO(),
    disclosure: {
      sl: "Ko rezerviraš prek povezav naših partnerjev, partner nama izplača provizijo — cena zate ostane enaka.",
      en: "When you book through our partner links, the partner pays us a commission — your price stays the same.",
      it: "Quando prenoti tramite i link dei nostri partner, il partner ci paga una commissione — per te il prezzo resta invariato.",
      de: "Wenn du über die Links unserer Partner buchst, zahlt uns der Partner eine Provision — für dich bleibt der Preis gleich.",
      fr: "Quand tu réserves via les liens de nos partenaires, le partenaire nous verse une commission — ton prix reste le même.",
      es: "Cuando reservas a través de los enlaces de nuestros socios, el socio nos paga una comisión — tu precio sigue siendo el mismo.",
    },
  });
}
