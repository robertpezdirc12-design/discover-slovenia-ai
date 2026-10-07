import { NextResponse } from "next/server";

import {
  affiliateActivationStatus,
  affiliateStats,
  isAdminSession,
} from "@/lib/affiliate-server";

export const dynamic = "force-dynamic";

/**
 * /api/affiliate/stats — statistika klikov in provizij ZA SKRBNIKE.
 *
 * Varovanje: DSA_ADMIN_EMAILS (vejica ločen seznam e-pošt). Brez nastavitve
 * ali brez prijave → 403 s slovenskim sporočilom — fail-closed, enako
 * kot tržniški Stripe ključi.
 *
 * Odgovor NIKOLI ne vsebuje vrednosti AFFILIATE_*_ID žetonov — samo
 * zastavico active, ali je program aktiviran.
 */
export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { error: "Dostop samo za skrbnike (DSA_ADMIN_EMAILS)." },
      { status: 403 },
    );
  }

  const [stats, activation] = await Promise.all([
    affiliateStats(),
    Promise.resolve(affiliateActivationStatus()),
  ]);

  return NextResponse.json({
    ...stats,
    activation,
  });
}
