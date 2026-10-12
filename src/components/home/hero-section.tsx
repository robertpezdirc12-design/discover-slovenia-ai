import Image from 'next/image';
import { ArrowRight, Map, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SeasonalHeroVariant, MicroEvent } from '@/lib/seasonal-hero';

/**
 * POLIR15-b — sezonski hero (server rendered).
 * Fiksno razmerje strani (aspect-*) na wrapperju + absolute Image fill
 * → višina hero-ja je znana pred nalaganjem slike (CLS = 0).
 * Sezona je rešena na strežniku — brez flickerja ob hydrataciji.
 */
export function HeroSection({
  variant,
  microEvent,
}: {
  variant: SeasonalHeroVariant;
  microEvent: MicroEvent;
}) {
  return (
    <section aria-labelledby="hero-title" className="w-full">
      <div className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-[21/9]">
        <Image
          src={variant.image}
          alt={`${variant.title} — sezonska vizualizacija (${variant.eyebrow})`}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* bralni gradient — zagotavlja kontrast besedila nad sliko */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/5"
        />

        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 sm:pb-12">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-white/40 bg-black/35 text-white backdrop-blur"
              >
                {variant.eyebrow}
              </Badge>
              {microEvent && (
                <Badge className="bg-amber-500/90 text-black hover:bg-amber-500/90">
                  <Sparkles className="size-3" aria-hidden />
                  mikro-dogodek
                </Badge>
              )}
            </div>

            <h1
              id="hero-title"
              className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
            >
              {variant.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/85 sm:text-base">
              {variant.subtitle}
            </p>
            <p className="mt-2 text-xs font-medium uppercase tracking-wider text-white/60">
              {variant.badge}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                {variant.ctaLabel}
                <ArrowRight className="ml-1 size-4" aria-hidden />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/50 bg-black/30 text-white backdrop-blur hover:bg-black/45 hover:text-white"
              >
                <Map className="mr-1 size-4" aria-hidden />
                {variant.secondaryCtaLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
