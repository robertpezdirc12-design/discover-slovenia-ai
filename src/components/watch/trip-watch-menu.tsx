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
  trigger: { sl: "Spremljaj", en: "Watch", it: "Segui", de: "Beobachten", fr: "Suivre", es: "Seguir" },
  triggerOn: { sl: "Spremljam", en: "Watching", it: "Stai seguendo", de: "Wird beobachtet", fr: "Tu suis", es: "Siguiendo" },
  label: { sl: "Kaj naj opazujem na tej poti?", en: "What should I watch on this trip?", it: "Cosa dovrei seguire in questo viaggio?", de: "Was soll ich auf dieser Reise beobachten?", fr: "Que dois-je suivre pour ce voyage ?", es: "¿Qué debo seguir en este viaje?" },
  weather: { sl: "Vreme na poti", en: "Trip weather", it: "Meteo del viaggio", de: "Reisewetter", fr: "Météo du voyage", es: "Clima del viaje" },
  weatherDesc: {
    sl: "Opozorilo, če napoved za dan poti obeta padavine ali nevihto.",
    en: "Alert when the forecast for a trip day brings rain or storms.",
    it: "Avviso se le previsioni per un giorno del viaggio annunciano pioggia o temporali.",
    de: "Warnung, wenn die Vorhersage für einen Reisetag Regen oder Gewitter bringt.",
    fr: "Alerte lorsque les prévisions pour un jour du voyage annoncent de la pluie ou des orages.",
    es: "Aviso si el pronóstico para un día del viaje anuncia lluvia o tormentas.",
  },
  tripDay: { sl: "Dnevi do poti", en: "Trip countdown", it: "Conto alla rovescia del viaggio", de: "Countdown zur Reise", fr: "Compte à rebours du voyage", es: "Cuenta atrás del viaje" },
  tripDayDesc: {
    sl: "Mejnika 7 dni in 1 dan pred začetkom pote.",
    en: "Milestones 7 days and 1 day before the trip starts.",
    it: "Tappe a 7 giorni e 1 giorno prima dell'inizio del viaggio.",
    de: "Meilensteine 7 Tage und 1 Tag vor Reisebeginn.",
    fr: "Jalons 7 jours et 1 jour avant le début du voyage.",
    es: "Hitos 7 días y 1 día antes del comienzo del viaje.",
  },
  booking: { sl: "Rezervacije pred potjo", en: "Bookings before trip", it: "Prenotazioni prima del viaggio", de: "Buchungen vor der Reise", fr: "Réservations avant le voyage", es: "Reservas antes del viaje" },
  bookingDesc: {
    sl: "Opomnik za rezervacije brez potrditve (IDEA) v zadnjem tednu.",
    en: "Reminder for unconfirmed (IDEA) reservations in the final week.",
    it: "Promemoria per le prenotazioni non confermate (IDEA) nell'ultima settimana.",
    de: "Erinnerung für unbestätigte (IDEA-)Reservierungen in der letzten Woche.",
    fr: "Rappel pour les réservations non confirmées (IDEA) durant la dernière semaine.",
    es: "Recordatorio para reservas sin confirmar (IDEA) en la última semana.",
  },
  addedWeather: {
    sl: "Vreme poti spremljam — opozorila pridejo v obvestila (preverjanje vsaki ~2 uri).",
    en: "Watching trip weather — alerts arrive in notifications (checks every ~2h).",
    it: "Sto seguendo il meteo del viaggio — gli avvisi arrivano nelle notifiche (verifica ogni ~2h).",
    de: "Reisewetter wird beobachtet — Warnungen kommen in die Benachrichtigungen (Prüfung alle ~2h).",
    fr: "Météo du voyage suivie — les alertes arrivent dans les notifications (vérification toutes les ~2h).",
    es: "Siguiendo el clima del viaje — los avisos llegan a las notificaciones (comprobación cada ~2h).",
  },
  addedTripDay: {
    sl: "Odštev dni spremljam — opomnim te 7 dni in 1 dan pred začetkom.",
    en: "Watching the countdown — you will be reminded 7 days and 1 day before.",
    it: "Sto seguendo il conto alla rovescia — ti ricorderò 7 giorni e 1 giorno prima dell'inizio.",
    de: "Countdown wird beobachtet — du wirst 7 Tage und 1 Tag vor dem Start erinnert.",
    fr: "Compte à rebours suivi — tu recevras un rappel 7 jours et 1 jour avant le début.",
    es: "Siguiendo la cuenta atrás — te recordaremos 7 días y 1 día antes del comienzo.",
  },
  addedBooking: {
    sl: "Rezervacije spremljam — opomnim te, če kakšna ostane brez potrditve pred odhodom.",
    en: "Watching bookings — you will be reminded if any stays unconfirmed before departure.",
    it: "Sto seguendo le prenotazioni — ti ricorderò se qualcuna resta senza conferma prima della partenza.",
    de: "Buchungen werden beobachtet — du wirst erinnert, wenn eine vor der Abreise unbestätigt bleibt.",
    fr: "Réservations suivies — tu recevras un rappel si l'une d'elles reste non confirmée avant le départ.",
    es: "Siguiendo las reservas — te recordaremos si alguna queda sin confirmar antes de la salida.",
  },
  exists: { sl: "To na tej poti že spremljaš.", en: "You already watch this on this trip.", it: "Segui già questo in questo viaggio.", de: "Du beobachtest dies auf dieser Reise bereits.", fr: "Tu suis déjà ceci pour ce voyage.", es: "Ya sigues esto en este viaje." },
  needDates: {
    sl: "Dodano — a pot še nima datumov: opazovanje se aktivira, ko določiš datume poti.",
    en: "Added — but the trip has no dates yet: watching activates once you set trip dates.",
    it: "Aggiunto — ma il viaggio non ha ancora date: l'osservazione si attiva quando imposti le date del viaggio.",
    de: "Hinzugefügt — aber die Reise hat noch keine Daten: Die Beobachtung wird aktiviert, sobald du die Reisedaten festlegst.",
    fr: "Ajouté — mais le voyage n'a pas encore de dates : le suivi s'active dès que tu définis les dates du voyage.",
    es: "Añadido — pero el viaje aún no tiene fechas: el seguimiento se activa cuando establezcas las fechas del viaje.",
  },
  error: { sl: "Dodajanje spremljanja ni uspelo.", en: "Could not add the watch.", it: "Impossibile aggiungere l'osservazione.", de: "Beobachtung konnte nicht hinzugefügt werden.", fr: "Impossible d'ajouter le suivi.", es: "No se pudo añadir el seguimiento." },
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
      <DropdownMenuContent align="start" className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl border-border/70 p-1.5 shadow-xl">
        <DropdownMenuLabel className="rounded-lg px-2.5 py-2 text-muted-foreground">
          {pick(l, L.label)}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item, i) => (
          <React.Fragment key={item.kind}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={busy !== null || addedKinds.has(item.kind)}
              onClick={() => void add(item.kind)}
              className="flex flex-col items-start gap-1 rounded-xl px-3 py-3 transition-colors focus:bg-muted/60"
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
