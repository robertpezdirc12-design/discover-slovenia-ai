import Image from 'next/image';
import { ArrowRight, Map, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import type { SeasonalHeroVariant, MicroEvent } from '@/lib/seasonal-hero';

/**
 * Sezonski hero (server rendered).
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
          className="object-cover scale-[1.01]"
        />
        {/* bralni gradient — zagotavlja kontrast besedila nad sliko */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/15"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent sm:h-16"
        />

        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 sm:pb-10">
            <p className="mb-3 text-sm font-semibold tracking-wide text-white/90 drop-shadow-sm sm:text-base">
              Discover Slovenia <span className="text-emerald-300">AI</span>
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-white/35 bg-black/40 text-white backdrop-blur-md"
              >
                {variant.eyebrow}
              </Badge>
              {microEvent && (
                <Badge className="bg-amber-400/95 text-stone-900 hover:bg-amber-400/95 shadow-sm">
                  <Sparkles className="size-3" aria-hidden />
                  mikro-dogodek
                </Badge>
              )}
            </div>

            <h1
              id="hero-title"
              className="font-display mt-3 max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              {variant.title}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">
              {variant.subtitle}
            </p>
            <p className="mt-2 text-xs font-medium tracking-[0.14em] text-white/65">
              {variant.badge}
            </p>

            {/* UPORABNIK NIKOLI NI ZGUBLJEN: primarni CTA vodi direktno na
                zemljevid (anchor, deluje tudi brez JS-a). */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#zemljevid"
                className={buttonVariants({
                  size: 'lg',
                  className:
                    'h-11 rounded-lg bg-primary px-5 text-primary-foreground shadow-md shadow-emerald-950/20 hover:bg-primary/90',
                })}
              >
                {variant.ctaLabel}
                <ArrowRight className="ml-1 size-4" aria-hidden />
              </a>
              <a
                href="#zemljevid"
                className={buttonVariants({
                  variant: 'outline',
                  size: 'lg',
                  className:
                    'h-11 rounded-lg border-white/45 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 hover:text-white',
                })}
              >
                <Map className="mr-1 size-4" aria-hidden />
                {variant.secondaryCtaLabel}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
