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
 * raziskovalco /destinacije. Zmeraj izpisuje: slika, ime, tagline,
 * regija, ocena; badge za izpostavljene.
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
        "group flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {d.featured && (
          <Badge className="absolute top-2.5 left-2.5 bg-primary text-primary-foreground shadow-sm">
            {pick(l, L.featured)}
          </Badge>
        )}
        <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur">
          <Star className="size-3 fill-primary text-primary" aria-hidden="true" />
          {d.rating.toFixed(1)}
          <span className="sr-only">{pick(l, L.rating)(d.rating)}</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>{regionLabel(d.region, l)}</span>
          <span aria-hidden="true">·</span>
          <span>{typeLabel(d.type, l)}</span>
        </div>
        <h3 className="text-base font-bold leading-tight group-hover:text-primary">
          {d.name}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{d.tagline}</p>
      </div>
    </Link>
  );
}
