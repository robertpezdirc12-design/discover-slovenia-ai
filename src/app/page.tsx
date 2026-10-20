import { Suspense } from 'react';
import { GuidedFlow } from '@/components/home/guided-flow';
import { HeroSection } from '@/components/home/hero-section';
import { MapSection } from '@/components/home/map-section';
import { PersonalHomeSection, PersonalHomeSkeleton } from '@/components/home/personal-home-section';
import { ProfileSync } from '@/components/home/profile-sync';
import { ZmoznostiSection } from '@/components/home/zmoznosti-section';
import { SiteHeader } from '@/components/home/site-header';
import { getHeroVariant } from '@/lib/seasonal-hero';
import { getSession } from '@/lib/session';
import { SITE_URL } from '@/lib/site';

/**
 * Domača stran (discover-slovenia-ai):
 *   a) sticky preklop nad izolirano Leaflet mapo
 *   b) SSR sezonska afiniteta heroja (+ ?season= DEMO override)
 *   c) streamirana PersonalHomeSection z rezerviranim skeletom
 *   d) zemljevid z enotnim virom višine (CLS 0)
 *
 * Seja: `getSession()` (React cache + PostgreSQL, opaque žeton v httpOnly
 * piškotku). Zaradi piškotka je stran dinamična; sezonski hero se izračuna
 * na strežniku ob vsakem requestu (brez ISR).
 */
/** Strukturirani podatki (schema.org) - bogati rezultati iskalnikov. */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "Discover Slovenia AI",
      url: SITE_URL,
      applicationCategory: "TravelApplication",
      inLanguage: "sl",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      description:
        "Vodič po zemljevidu, prenočišča, vreme in pot — Slovenija in Balkan na odprtih podatkih.",
    },
    {
      "@type": "TouristDestination",
      name: "Slovenija",
      url: SITE_URL,
      description:
        "Jezera, gore, mesta in kmečki turizem — od Bleda in Bohinja do doline Soče in Ljubljane.",
    },
  ],
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [sp, session] = await Promise.all([searchParams, getSession()]);

  const { variant, microEvent } = getHeroVariant({
    seasonOverride: typeof sp.season === 'string' ? sp.season : null,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <ProfileSync enabled={Boolean(session)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <SiteHeader loggedIn={Boolean(session)} />

      <main className="flex-1">
        <HeroSection variant={variant} microEvent={microEvent} />

        <div className="mt-10 space-y-10 pb-12">
          {/* VODENI TOK (Komoot onboarding): vpraša le enkrat, odgovore si zapomni,
              vsak korak izreče naslednji predlog (besedilo + glas). */}
          <GuidedFlow />

          <MapSection loggedIn={Boolean(session)} />

          {/* Streamiranje — skeleton rezervira točno toliko prostora,
              kot ga zasede sekcija → ni premika heroja/seznama (CLS 0). */}
          {session && (
            <Suspense fallback={<PersonalHomeSkeleton />}>
              <PersonalHomeSection name={session.name} userId={session.userId} />
            </Suspense>
          )}

          <ZmoznostiSection />
        </div>
      </main>

      {/* Lepljiva noga: pritisnjena na dno na kratkih straneh, odmaknjena na dolgih */}
      <footer className="mt-auto border-t bg-muted/40 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>Discover Slovenia AI — potovanje po Sloveniji in Balkanu</p>
          <p>
            Zemljevid &copy; <a className="underline underline-offset-2" href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> sodelavci
          </p>
        </div>
      </footer>
    </div>
  );
}
