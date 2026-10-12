import { cache } from "react";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

/**
 * SESSION GATE — POLIR15-c (issue #34): strežniška vrata za osebno domov.
 * ============================================================================
 * Prej je PersonalHomeSection sam odločal z useSession() na klientu: status
 * je bil ob hidraciji „loading“ (sekca NIČ), nato „authenticated“ (sekca se
 * vstavi) — dva premika vsebine pod vložiščem (web.dev kanon: „the root
 * cause is the addition of the new element above“).
 *
 * Zdaj strežnik (page.tsx) razreši vrata ENKRAT na zahtevo in jih posreduje
 * kot prop — sekca je ŽE v SSR HTML (prijavljeni) oziroma trajno odsotna
 * (gostje, 0 klientne vode). React `cache()` dedupira getServerSession
 * znotraj ene zahteve (če jo bere več strežniških staršev, se JWT dekodira
 * samo enkrat — brez waterfalla).
 *
 * FAIL-CLOSED: napaka dekodiranja/baze = gost (nikoli lažna prijava).
 * JWT strategija (brez Session tabel) ⇒ 0 db klicev za vrata.
 */
export const getSessionGate = cache(
  async (): Promise<{ authed: boolean }> => {
    try {
      const session = await getServerSession(authOptions);
      return { authed: Boolean(session?.user?.id) };
    } catch {
      // Nedosledna seja/okolje → iskreno gost (fail-closed).
      return { authed: false };
    }
  }
);
