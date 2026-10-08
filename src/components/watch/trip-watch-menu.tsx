"use client";

/**
 * TRIP-WATCH-MENU — P1-C (issue #3 §4): meni »Spremljaj« na pote
 * (/pot/[shareId]) za lastnike in sodelujoče (vloga ≥ VIEWER).
 * ============================================================================
 * Tri DETERMINISTIČNE vrste (0-AI):
 *  - weather  → padavine/nevihta na dnevih poti (lokacija postanka);
 *  - trip_day → mejnika 7 dni in 1 dan pred začetkom;
 *  - booking  → opomnik za nepotrjene (IDEA) rezervacije pred odhodom.
 *
 * Zavrnjene vrste (razpoložljivost lokala, leta) se NE ponujajo — vir
 * ne potrjuje (iskrena odločitev §4 CRITICAL). Opozorila pripnejo v
 * notifikacijski center (/notifikacije); preverjanje teče z zavoro
 * (cron vsaki 2 uri) — brez lažnega »v živo«.
 */

import { Bell, CalendarCheck, CloudRain, ListChecks, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { pick } from "@/lib/i18n-pick";

const L = {
  trigger: { sl: "Spremljaj", en: "Watch" },
  triggerOn: { sl: "Spremljam", en: "Watching" },
  label: { sl: "Kaj naj opazujem na tej poti?", en: "What should I watch on this trip?" },
  weather: { sl: "Vreme na poti", en: "Trip weather" },
  weatherDesc: {
    sl: "Opozorilo, če napoved za dan poti obeta padavine ali nevihto.",
    en: "Alert when the forecast for a trip day brings rain or storms.",
  },
  tripDay: { sl: "Dnevi do poti", en: "Trip countdown" },
  tripDayDesc: {
    sl: "Mejnika 7 dni in 1 dan pred začetkom pote.",
    en: "Milestones 7 days and 1 day before the trip starts.",
  },
  booking: { sl: "Rezervacije pred potjo", en: "Bookings before trip" },
  bookingDesc: {
    sl: "Opomnik za rezervacije brez potrditve (IDEA) v zadnjem tednu.",
    en: "Reminder for unconfirmed (IDEA) reservations in the final week.",
  },
  addedWeather: {
    sl: "Vreme poti spremljam — opozorila pridejo v obvestila (preverjanje vsaki ~2 uri).",
    en: "Watching trip weather — alerts arrive in notifications (checks every ~2h).",
  },
  addedTripDay: {
    sl: "Odštev dni spremljam — opomnim te 7 dni in 1 dan pred začetkom.",
    en: "Watching the countdown — you will be reminded 7 days and 1 day before.",
  },
  addedBooking: {
    sl: "Rezervacije spremljam — opomnim te, če kakšna ostane brez potrditve pred odhodom.",
    en: "Watching bookings — you will be reminded if any stays unconfirmed before departure.",
  },
  exists: { sl: "To na tej poti že spremljaš.", en: "You already watch this on this trip." },
  needDates: {
    sl: "Dodano — a pot še nima datumov: opazovanje se aktivira, ko določiš datume poti.",
    en: "Added — but the trip has no dates yet: watching activates once you set trip dates.",
  },
  error: { sl: "Dodajanje spremljanja ni uspelo.", en: "Could not add the watch." },
} as const;

type TripWatchKind = "weather" | "trip_day" | "booking";

const KIND_TOAST: Record<TripWatchKind, { sl: string; en: string }> = {
  weather: L.addedWeather,
  trip_day: L.addedTripDay,
  booking: L.addedBooking,
};

export function TripWatchMenu({
  shareId,
  hasDates,
}: {
  shareId: string;
  /** Ali pot že ima določene datume (za iskreno opombo ob dodajanju). */
  hasDates: boolean;
}) {
  const l = useLocale();
  const { status } = useSession();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<TripWatchKind | null>(null);
  const [addedKinds, setAddedKinds] = React.useState<Set<TripWatchKind>>(
    new Set()
  );

  const add = async (kind: TripWatchKind) => {
    if (busy) return;
    setBusy(kind);
    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          targetKind: "journey",
          targetId: shareId,
        }),
      });
      if (res.status === 409) {
        setAddedKinds((prev) => new Set(prev).add(kind));
        toast({ title: pick(l, L.exists) });
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast({
          title: data.error ?? pick(l, L.error),
          variant: "destructive",
        });
        return;
      }
      setAddedKinds((prev) => new Set(prev).add(kind));
      toast({
        title: hasDates
          ? pick(l, KIND_TOAST[kind])
          : `${pick(l, KIND_TOAST[kind])} ${pick(l, L.needDates)}`,
      });
    } catch {
      toast({ title: pick(l, L.error), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const items: {
    kind: TripWatchKind;
    icon: React.ReactNode;
    label: string;
    desc: string;
  }[] = [
    {
      kind: "weather",
      icon: <CloudRain className="size-4 text-primary" aria-hidden="true" />,
      label: pick(l, L.weather),
      desc: pick(l, L.weatherDesc),
    },
    {
      kind: "trip_day",
      icon: <CalendarCheck className="size-4 text-primary" aria-hidden="true" />,
      label: pick(l, L.tripDay),
      desc: pick(l, L.tripDayDesc),
    },
    {
      kind: "booking",
      icon: <ListChecks className="size-4 text-primary" aria-hidden="true" />,
      label: pick(l, L.booking),
      desc: pick(l, L.bookingDesc),
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="tap-target gap-1.5 font-semibold"
          aria-label={pick(l, L.trigger)}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Bell className="size-4" aria-hidden="true" />
          )}
          {addedKinds.size > 0 ? pick(l, L.triggerOn) : pick(l, L.trigger)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel className="text-muted-foreground">
          {pick(l, L.label)}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item, i) => (
          <React.Fragment key={item.kind}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={busy !== null || addedKinds.has(item.kind)}
              onClick={() => void add(item.kind)}
              className="flex flex-col items-start gap-0.5 py-2.5"
              aria-label={`${item.label}: ${item.desc}`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {item.icon}
                {item.label}
                {addedKinds.has(item.kind) && (
                  <span className="text-xs font-normal text-emerald-600">
                    ✓
                  </span>
                )}
              </span>
              <span className="pl-6 text-xs leading-relaxed text-muted-foreground">
                {item.desc}
              </span>
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
