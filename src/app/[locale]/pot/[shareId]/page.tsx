import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { SharedTripView } from "@/components/content/shared-trip-view";
import { alternatesFor } from "@/lib/hreflang";

/** Veljavna oblika shareId (kanon izvirnika: kratki mali znaki; 48-a
 *  mostovno dopolnjeno z vezaji — npr. /pot/test-shareid mora biti veljavna
 *  pot, sicer testni URL-ji z vezajem padajo v 404). */
const SHARE_ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * /pot/[shareId] — deljena pot (rekonstrukcija D7, localStorage).
 *
 * Varnostna vrata kanona izvirnika: očitno neveljaven shareId zavrnemo
 * BREZ brskalnikove shrambe (isgrena 404); veljaven shareId izriše
 * odjemalski pogled, ki iskreno pove, če pote ni na tej napravi.
 */

interface Props {
  params: Promise<{ locale: string; shareId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, shareId } = await params;
  return {
    title: "Deljena pot",
    description:
      "Deljen AI načrt potovanja po Sloveniji — dnevi, lokacije in prispevek v zbirko Moja pot.",
    robots: { index: false, follow: false },
    alternates: alternatesFor(locale, `/pot/${shareId}`),
  };
}

export default async function SharedTripPage({ params }: Props) {
  const { locale, shareId } = await params;
  setRequestLocale(locale);
  // Varnostna vrata: neveljavna oblika → 404 (nikoli dostop do shrambe).
  if (!SHARE_ID_RE.test(shareId)) notFound();
  return <SharedTripView shareId={shareId} />;
}
