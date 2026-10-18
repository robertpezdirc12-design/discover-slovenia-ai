import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { GuidedFlow } from '@/components/home/guided-flow';
import { HeroSection } from '@/components/home/hero-section';
import { MapSection } from '@/components/home/map-section';
import { PersonalHomeSection, PersonalHomeSkeleton } from '@/components/home/personal-home-section';
import { ProofSection } from '@/components/home/proof-section';
import { SiteHeader } from '@/components/home/site-header';
import { getHeroVariant } from '@/lib/seasonal-hero';

const SESSION_COOKIE = 'dsa_demo_user';

/**
 * Referenčna stran cikla POLIR15 (issue #34, discover-slovenia-ai):
 *   a) sticky preklop nad izolirano Leaflet mapo
 *   b) SSR sezonska afiniteta heroja (+ ?season= DEMO override)
 *   c) streamirana PersonalHomeSection z rezerviranim skeletom
 *   d) zemljevid z enotnim virom višine (CLS 0)
 *
 * V produkciji: `getSession()` (next-auth + React cache) namesto cookie,
 * `export const revalidate = 3600` za sezonski hero (ISR).
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [sp, cookieStore] = await Promise.all([searchParams, cookies()]);

  const userName = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  const { variant, microEvent } = getHeroVariant({
    seasonOverride: typeof sp.season === 'string' ? sp.season : null,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader loggedIn={Boolean(userName)} />

      <main className="flex-1">
        <HeroSection variant={variant} microEvent={microEvent} />

        <div className="mt-10 space-y-10 pb-12">
          {/* VODENI TOK (Komoot onboarding): vpraša le enkrat, odgovore si zapomni,
              vsak korak izreče naslednji predlog (besedilo + glas). */}
          <GuidedFlow />

          <MapSection />

          {/* POLIR15-c: streamiranje — skeleton rezervira točno toliko prostora,
              kot ga zasede sekcija → ni premika heroja/seznama (CLS 0). */}
          {userName && (
            <Suspense fallback={<PersonalHomeSkeleton />}>
              <PersonalHomeSection name={userName} />
            </Suspense>
          )}

          <ProofSection />
        </div>
      </main>

      {/* Lepljiva noga: pritisnjena na dno na kratkih straneh, odmaknjena na dolgih */}
      <footer className="mt-auto border-t bg-muted/40 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>Discover Slovenia AI — referenčna implementacija cikla POLIR15</p>
          <p>
            Zemljevid &copy; <a className="underline underline-offset-2" href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> sodelavci
          </p>
        </div>
      </footer>
    </div>
  );
}
