import { NextResponse } from "next/server";

import { getDestination } from "@/lib/slovenia-data";
import { countryUrlName } from "@/lib/affiliate-providers";
import { getSessionUserId } from "@/lib/trip-auth";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import {
  buildRedirectFor,
  recordAffiliateClick,
} from "@/lib/affiliate-server";

export const dynamic = "force-dynamic";

/**
 * /api/affiliate/go — vodeni klik na rezervacijskega partnerja.
 *
 *   GET ?provider=booking&dest=bled  →  302 na partnerjevo povezavo
 *
 * Zapis klika (AffiliateClick) je najboljša mož (best effort): napaka
 * baze NIKOLI ne zavrne preusmeritve — uporabnikova rezervacija je
 * pomembnejša od naše statistike.
 *
 * Varnost/zasebnost (kanon):
 *  · AFFILIATE_*_ID žeton se prilepi SAMO v Location glavo 302 — nikoli
 *    v telo, piškotek ali zapis;
 *  · dsa_aff piškotek je anonimni UUID (vezava klikov seje) — brez IP,
 *    brez razpoznavnih znakov naprave;
 *  · neveljaven provider → 400 s slovenskim sporočilom (nikoli tih padec);
 *  · P0 AUDIT: meja zapisov 30/min na odjemalca — preusmeriteve NIKOLI
 *    ne zavrnemo (rezervacija je pomembnejša od statistike), omejimo SAMO
 *    zapis v bazo (ščiti AffiliateClick pred robotskim napihovanjem).
 */

const AFF_COOKIE = "dsa_aff";
const AFF_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 dni

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const providerId = searchParams.get("provider") ?? "";
  if (!providerId) {
    return NextResponse.json(
      { error: "Manjka parameter provider." },
      { status: 400 },
    );
  }

  // Destinacija (neobvezna) — po slugu kanonskega nabora. Država se
  // razreši za {country} predloge (airalo, discovercars — P0-F).
  const destSlug = searchParams.get("dest")?.trim() || null;
  const dest = destSlug ? getDestination(destSlug) ?? null : null;
  const destName = dest?.name ?? null;
  const destCountryName = countryUrlName(dest?.country ?? null);

  const built = buildRedirectFor(providerId, destName, destCountryName);
  if (!built) {
    return NextResponse.json(
      { error: "Neznan rezervacijski partner." },
      { status: 400 },
    );
  }

  // Anonimni ključ seje — nov, če piškotka (še) ni.
  const existingKey = readCookie(request, AFF_COOKIE);
  const sessionKey =
    existingKey && existingKey.length >= 8 && existingKey.length <= 64
      ? existingKey
      : crypto.randomUUID();

  // Prijava (neobvezna) — če je uporabnik prijavljen, pripnemo userId.
  let userId: string | null = null;
  try {
    userId = await getSessionUserId();
  } catch {
    userId = null;
  }

  // Zapis klika — najboljša mož (neuspeh NE blokira preusmeritve).
  // P0 AUDIT: zapis omejimo na 30/min na odjemalca (preusmeritve NIKOLI ne
  // zavrnemo — rezervacija je pomembnejša od statistike); nad mejo klik še
  // vedno pelje do partnerja, samo zapis v bazo ne raste (ščiti AffiliateClick).
  const mayRecord = allowRequest(`aff-go:${clientKey(request)}`, 30);
  if (mayRecord) {
    await recordAffiliateClick({
      provider: built.provider,
      destinationSlug: dest?.slug ?? null,
      destinationName: destName,
      destinationCountryName: destCountryName,
      link: built.link,
      userId,
      sessionKey,
      referrer: request.headers.get("referer"),
    });
  }

  const res = NextResponse.redirect(built.link.url, 302);
  if (!existingKey) {
    res.cookies.set(AFF_COOKIE, sessionKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: AFF_COOKIE_MAX_AGE,
      path: "/",
    });
  }
  return res;
}
