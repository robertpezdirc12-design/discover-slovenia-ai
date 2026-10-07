"use client";

import { Star } from "lucide-react";
import { useLocale } from "next-intl";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import {
  type Destination,
  regionLabel,
  typeLabel,
} from "@/lib/slovenia-data";
import { cn } from "@/lib/utils";

/**
 * KARTICA DESTINACIJE — skupna za domačo stran (priljubljene) in
 * raziskovalco /destinacije. Vizualna hierarhija (issue #1 §4): slika →
 * regija (kicker, zeleni akcent) → naslov → tagline → meta vrstica
 * (tip · ocena) ob dnu kartice. Celotna kartica je povezava z vidnim
 * zelenim focus-obročem; hover dvigne kartico (-translate-y-1) in
 * poveča sliko (scale-105, ~300 ms) — vse ugasnjeno ob reduced-motion.
 */
export function DestinationCard({
  d,
  priority = false,
  className,
}: {
  d: Destination;
  priority?: boolean;
  className?: string;
}) {
  const l = useLocale();
  const L = {
    featured: { sl: "Izpostavljeno", en: "Featured" },
    rating: { sl: (n: number) => `Ocena ${n.toFixed(1)} od 5`, en: (n: number) => `Rated ${n.toFixed(1)} of 5` },
    toDetail: {
      sl: (name: string) => `Odpri destinacijo ${name}`,
      en: (name: string) => `Open destination ${name}`,
    },
  } as const;

  return (
    <Link
      href={`/destinacija/${d.slug}`}
      aria-label={pick(l, L.toDetail)(d.name)}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none",
        // Reduced-motion: brez dviga in senčnih prehodov (slika miruje).
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className
      )}
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-muted">
        <Image
          src={d.image}
          alt={`${d.name} — ${d.tagline}`}
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        {d.featured && (
          <Badge className="absolute top-2.5 left-2.5 bg-primary text-primary-foreground shadow-sm">
            {pick(l, L.featured)}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {/* Regija čisto zgoraj — zeleni kicker (akcent teme #2d6a3e). */}
        <p className="text-[11px] font-bold tracking-[0.1em] text-primary uppercase">
          {regionLabel(d.region, l)}
        </p>
        <h3 className="text-lg leading-tight font-bold tracking-tight transition-colors group-hover:text-primary">
          {d.name}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{d.tagline}</p>
        {/* Meta vrstica: tip destinacije · ocena — ob dnu, za enotno višino. */}
        <p className="mt-auto flex items-center justify-between gap-2 border-t pt-2.5 text-xs font-medium">
          <span className="text-muted-foreground">{typeLabel(d.type, l)}</span>
          <span className="inline-flex items-center gap-1 font-semibold">
            <Star
              className="size-3.5 fill-primary text-primary"
              aria-hidden="true"
            />
            {d.rating.toFixed(1)}
            <span className="sr-only">{pick(l, L.rating)(d.rating)}</span>
          </span>
        </p>
      </div>
    </Link>
  );
}
