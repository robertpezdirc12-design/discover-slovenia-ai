"use client";

/**
 * SKUPNI KOŠČKI NAČRTOVALNIŠKE PLASTI (45-d) — ikone vrst postankov,
 * značke tipov in leg (vožnja med postanki). Uporabljaajo jih /nacrtuj,
 * /potovanje, /na-poti in /moja-potovanja (en prikaz — ena resnica).
 */

import {
  Banknote,
  Building2,
  Castle,
  Clock,
  Gem,
  Landmark,
  MapPin,
  Mountain,
  MountainSnow,
  Palmtree,
  Route as RouteIcon,
  Trees,
  Waves,
  type LucideIcon,
} from "lucide-react";

import type { TripStopKind } from "@/lib/types";

/** Ikona po vrsti postanka (kanonskih 9 tipov + splošni). */
const KIND_ICONS: Record<TripStopKind, LucideIcon> = {
  castle: Castle,
  cave: Gem,
  city: Building2,
  coast: Palmtree,
  gorge: Mountain,
  lake: Waves,
  mountain: MountainSnow,
  river: Waves,
  spa: Trees,
  food: Landmark,
  activity: RouteIcon,
  custom: MapPin,
};

export function StopKindIcon({ kind, className }: { kind: TripStopKind; className?: string }) {
  const Icon = KIND_ICONS[kind] ?? MapPin;
  return <Icon className={className} aria-hidden="true" />;
}

/** Kompakten vrstični podatek: ikona + besedilo (čas/trajanje/cena). */
export function StopFact({
  icon: Icon,
  children,
  srLabel,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  srLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <span>
        <span className="sr-only">{srLabel}: </span>
        {children}
      </span>
    </span>
  );
}

export const FACT_ICONS = { Clock, Banknote, MapPin, RouteIcon } as const;
