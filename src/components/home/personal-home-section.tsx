"use client";

/**
 * PERSONAL-HOME-SECTION — P1-D (issue #3 §9): PERSONALIZIRANA DOMAČA STRAN.
 * ============================================================================
 * Po prijavi domov ni več samo katalog — pokaže osebni nadzorni pult:
 *  1. NADALJUJ POT (najnovejša pot v oblaku z dnevi/postanki/datumi);
 *  2. NEPREBRANA OBVESTILA (števec + zadnja 3 naslovi → /notifikacije);
 *  3. SPREMLJANJA (čipi vrst s stanji → /notifikacije);
 *  4. VREME NASLEDNJE POTE (prvi razpoznavni postanek + datum znotraj
 *     horizonta 16 dni → /api/weather daily; vir nedosegljiv → ISKRENO
 *     stanje napake, nikoli izmišljena napoved);
 *  5. IDEJE ZATE (iz P1-A preferenc — ISTI reason slovar kot priporočila
 *     @AI/načrtovalnika: proračun/sezona/interesi; personalizacija OFF →
 *     iskrena ploščica z linkom na /moj-profil);
 *  6. V BLIŽINI (enkratna GPS fiksacija → haversine do registra 38
 *     destinacij — 100 % klient, 0 strežniških klicev; zavrnjeno/neznano →
 *     iskrena stanja);
 *  7. ODPRTE NALOGE (deterministične: poti brez datumov, profil brez
 *     preferenc, brez spremljanj — vse iz že naloženih podatkov).
 *
 * GOSTE: sekca se NE izriše (javni Discover ostaja nedotaknjen — §9).
 * ZASEBNOST: vse poizvedbe so lastniške (session), GPS živi SAMO v
 * pomnilniku komponente (nikoli ne gre na strežnik).
 *
 * 0-AI: vse ploščice so čiste deterministične skripte nad obstoječimi API-ji
 * (/api/trips, /api/watch, /api/notifications, /api/preferences, /api/weather).
 */

import {
  Bell,
  CalendarDays,
  CheckCircle2,
  CloudRain,
  Compass,
  Lightbulb,
  ListChecks,
  Loader2,
  MapPin,
  Route,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import {
  buildCandidateReasons,
  formatReasonsInline,
  type ReasonContext,
} from "@/lib/recommendation-reasons";
import {
  DESTINATIONS,
  getDestination,
  type Budget,
} from "@/lib/slovenia-data";
import { todayIso } from "@/lib/trip-dates";
import { fetchDailyWeather, weatherLabel } from "@/lib/weather";

// ── Slovar ──────────────────────────────────────────────────────────────────

const L = {
  kicker: { sl: "Tvoja plošča", en: "Your board", it: "Il tuo pannello", de: "Deine Übersicht", fr: "Ton espace", es: "Tu panel" },
  title: { sl: "Dobrodošel nazaj", en: "Welcome back", it: "Bentornato", de: "Willkommen zurück", fr: "Bon retour", es: "Bienvenido de nuevo" },
  lead: {
    sl: "Tvoje poti, obvestila, spremljanja in osebne ideje — vse na enem mestu (gostjev Discover ostaja spodaj nedotaknjen).",
    en: "Your trips, notifications, watches and personal ideas — all in one place (the public Discover continues below).",
    it: "I tuoi viaggi, le notifiche, le osservazioni e le idee personali — tutto in un solo posto (il Discover pubblico continua qui sotto).",
    de: "Deine Reisen, Benachrichtigungen, Beobachtungen und persönlichen Ideen — alles an einem Ort (der öffentliche Discover läuft unten weiter).",
    fr: "Tes voyages, notifications, suivis et idées personnelles — tout au même endroit (le Discover public continue ci-dessous).",
    es: "Tus viajes, notificaciones, seguimientos e ideas personales — todo en un solo lugar (el Discover público sigue abajo).",
  },

  // nadaljuj pot
  continueTitle: { sl: "Nadaljuj pot", en: "Continue your trip", it: "Continua il tuo viaggio", de: "Setze deine Reise fort", fr: "Continue ton voyage", es: "Continúa tu viaje" },
  continueNone: {
    sl: "Nimaš še poti v oblaku — sestavi prvo na načrtovalniku.",
    en: "No cloud trips yet — build your first one in the planner.",
    it: "Non hai ancora viaggi nel cloud — crea il primo nel pianificatore.",
    de: "Noch keine Reisen in der Cloud — baue deine erste im Planer.",
    fr: "Tu n’as pas encore de voyage dans le cloud — crée le premier dans le planificateur.",
    es: "Aún no tienes viajes en la nube — crea el primero en el planificador.",
  },
  continueCta: { sl: "Odpri pot", en: "Open trip", it: "Apri viaggio", de: "Reise öffnen", fr: "Ouvrir le voyage", es: "Abrir viaje" },
  planCta: { sl: "Načrtuj pot", en: "Plan a trip", it: "Pianifica un viaggio", de: "Reise planen", fr: "Planifier un voyage", es: "Planifica un viaje" },
  days: { sl: (n: number) => `${n} ${n === 1 ? "dan" : n === 2 ? "dneva" : "dni"}`, en: (n: number) => `${n} ${n === 1 ? "day" : "days"}`, it: (n: number) => `${n} ${n === 1 ? "giorno" : "giorni"}`, de: (n: number) => `${n} ${n === 1 ? "Tag" : "Tage"}`, fr: (n: number) => `${n} ${n === 1 ? "jour" : "jours"}`, es: (n: number) => `${n} ${n === 1 ? "día" : "días"}` },
  stops: { sl: (n: number) => `${n} ${n === 1 ? "postanek" : n < 4 ? "postanki" : "postankov"}`, en: (n: number) => `${n} ${n === 1 ? "stop" : "stops"}`, it: (n: number) => `${n} ${n === 1 ? "tappa" : "tappe"}`, de: (n: number) => `${n} ${n === 1 ? "Stopp" : "Stopps"}`, fr: (n: number) => `${n} ${n === 1 ? "étape" : "étapes"}`, es: (n: number) => `${n} ${n === 1 ? "parada" : "paradas"}` },
  noDates: { sl: "brez datumov", en: "no dates", it: "senza date", de: "ohne Datum", fr: "sans dates", es: "sin fechas" },

  // obvestila
  alertsTitle: { sl: "Obvestila", en: "Notifications", it: "Notifiche", de: "Benachrichtigungen", fr: "Notifications", es: "Notificaciones" },
  alertsNone: { sl: "Ni novih obvestil — vse prebrano.", en: "No new notifications — all read.", it: "Nessuna nuova notifica — tutto letto.", de: "Keine neuen Benachrichtigungen — alles gelesen.", fr: "Pas de nouvelles notifications — tout est lu.", es: "No hay notificaciones nuevas — todo leído." },
  alertsUnread: { sl: (n: number) => `${n} ${n === 1 ? "neprebrano" : n === 2 ? "neprebrani" : "neprebranih"}`, en: (n: number) => `${n} unread`, it: (n: number) => `${n} da leggere`, de: (n: number) => `${n} ungelesen`, fr: (n: number) => `${n} non ${n === 1 ? "lu" : "lues"}`, es: (n: number) => `${n} sin leer` },
  alertsCta: { sl: "Odpri center", en: "Open center", it: "Apri il centro", de: "Zentrum öffnen", fr: "Ouvrir le centre", es: "Abrir el centro" },

  // spremljanja
  watchTitle: { sl: "Spremljanja", en: "Watches", it: "Osservazioni", de: "Beobachtungen", fr: "Suivis", es: "Seguimientos" },
  watchNone: {
    sl: "Ni spremljanj — dodaj »Spremljaj ceno« na tržnici ali »Spremljaj« na svoji poti.",
    en: "No watches — add “Watch price” in the marketplace or “Watch” on your trip.",
    it: "Nessuna osservazione — aggiungi «Osserva prezzo» nel mercato oppure «Osserva» sul tuo viaggio.",
    de: "Keine Beobachtungen — füge „Preis beobachten“ auf dem Marktplatz oder „Beobachten“ auf deiner Reise hinzu.",
    fr: "Aucun suivi — ajoute « Suivre le prix » sur le marché ou « Suivre » sur ton voyage.",
    es: "Sin seguimientos — añade «Vigilar precio» en el mercado o «Vigilar» en tu viaje.",
  },
  pausedLabel: { sl: "v pavzi", en: "paused", it: "in pausa", de: "pausiert", fr: "en pause", es: "en pausa" },
  priceKind: { sl: "cena", en: "price", it: "prezzo", de: "Preis", fr: "prix", es: "precio" },
  weatherKind: { sl: "vreme", en: "weather", it: "meteo", de: "Wetter", fr: "météo", es: "tiempo" },
  tripDayKind: { sl: "dnevi", en: "countdown", it: "conto alla rovescia", de: "Countdown", fr: "compte à rebours", es: "cuenta atrás" },
  bookingKind: { sl: "rezervacije", en: "bookings", it: "prenotazioni", de: "Buchungen", fr: "réservations", es: "reservas" },

  // vreme
  weatherTitle: { sl: "Vreme naslednje pote", en: "Next trip weather", it: "Meteo del prossimo viaggio", de: "Wetter der nächsten Reise", fr: "Météo du prochain voyage", es: "Tiempo del próximo viaje" },
  weatherNoTrip: {
    sl: "Nimaš prihajajoče pote z datumi — določi datume na svoji poti.",
    en: "No upcoming trip with dates — set dates on your trip.",
    it: "Non hai un viaggio in arrivo con date — imposta le date del tuo viaggio.",
    de: "Keine anstehende Reise mit Daten — lege die Daten für deine Reise fest.",
    fr: "Pas de voyage à venir avec des dates — définis les dates de ton voyage.",
    es: "No hay viaje próximo con fechas — define las fechas de tu viaje.",
  },
  weatherFar: {
    sl: "Napoved še ne pokriva datumov pote (horizont 16 dni) — preveri bližje odhodu.",
    en: "The forecast does not cover your trip dates yet (16-day horizon) — check closer to departure.",
    it: "Le previsioni non coprono ancora le date del viaggio (orizzonte 16 giorni) — controlla più vicino alla partenza.",
    de: "Die Vorhersage deckt deine Reisedaten noch nicht ab (16-Tage-Horizont) — prüfe es kurz vor der Abreise.",
    fr: "Les prévisions ne couvrent pas encore les dates de ton voyage (horizon 16 jours) — vérifie plus près du départ.",
    es: "La predicción aún no cubre las fechas de tu viaje (horizonte de 16 días) — comprueba más cerca de la salida.",
  },
  weatherUnreachable: {
    sl: "Vremenski vir trenutno ni dosegljivo — napoved NE izmišljujemo.",
    en: "The weather source is unreachable — we do not invent forecasts.",
    it: "La fonte meteo non è raggiungibile — non inventiamo previsioni.",
    de: "Die Wetterquelle ist derzeit nicht erreichbar — wir erfinden keine Vorhersagen.",
    fr: "La source météo est injoignable — nous n’inventons pas de prévisions.",
    es: "La fuente del tiempo no está accesible — no inventamos predicciones.",
  },

  // ideje
  ideasTitle: { sl: "Ideje zate", en: "Ideas for you", it: "Idee per te", de: "Ideen für dich", fr: "Idées pour toi", es: "Ideas para ti" },
  ideasOff: {
    sl: "Personalizacija je izklopljena — ideje iz preferenc niso prikazane. Vklopi jo v profilu.",
    en: "Personalization is off — ideas from preferences are hidden. Enable it in your profile.",
    it: "La personalizzazione è disattivata — le idee dalle preferenze non sono mostrate. Attivala nel profilo.",
    de: "Die Personalisierung ist aus — Ideen aus Präferenzen werden nicht angezeigt. Aktiviere sie im Profil.",
    fr: "La personnalisation est désactivée — les idées issues des préférences sont masquées. Active-la dans ton profil.",
    es: "La personalización está desactivada — las ideas de las preferencias no se muestran. Actívala en tu perfil.",
  },
  ideasNoPrefs: {
    sl: "Dopolni profil (proračun, interesi) za osebne ideje.",
    en: "Complete your profile (budget, interests) for personal ideas.",
    it: "Completa il profilo (budget, interessi) per idee personali.",
    de: "Vervollständige dein Profil (Budget, Interessen) für persönliche Ideen.",
    fr: "Complète ton profil (budget, centres d’intérêt) pour des idées personnelles.",
    es: "Completa tu perfil (presupuesto, intereses) para ideas personales.",
  },
  ideasWhy: { sl: "Zakaj:", en: "Why:", it: "Perché:", de: "Warum:", fr: "Pourquoi :", es: "Por qué:" },
  profileCta: { sl: "Moj profil", en: "My profile", it: "Il mio profilo", de: "Mein Profil", fr: "Mon profil", es: "Mi perfil" },

  // v bližini
  nearbyTitle: { sl: "V bližini", en: "Nearby", it: "Nelle vicinanze", de: "In der Nähe", fr: "À proximité", es: "Cerca de ti" },
  nearbyCta: { sl: "Poišči blizu mene", en: "Find near me", it: "Cerca vicino a me", de: "In der Nähe suchen", fr: "Chercher près de moi", es: "Buscar cerca de mí" },
  nearbyDenied: {
    sl: "Dovoljenje za lokacijo je zavrnjeno — najbližjih ne morem izračunati.",
    en: "Location permission denied — cannot compute nearest spots.",
    it: "Permesso di localizzazione negato — impossibile calcolare i più vicini.",
    de: "Standortberechtigung abgelehnt — die nächsten Orte lassen sich nicht berechnen.",
    fr: "Autorisation de localisation refusée — impossible de calculer les plus proches.",
    es: "Permiso de ubicación denegado — no se pueden calcular los más cercanos.",
  },
  nearbyUnsupported: {
    sl: "Naprava ali brskalnik ne podpira geolokacije.",
    en: "Device or browser does not support geolocation.",
    it: "Dispositivo o browser non supporta la geolocalizzazione.",
    de: "Gerät oder Browser unterstützt keine Geolokalisierung.",
    fr: "L’appareil ou le navigateur ne prend pas en charge la géolocalisation.",
    es: "El dispositivo o el navegador no admite la geolocalización.",
  },
  nearbyPrivacy: {
    sl: "Lokacija živi samo v tem pomnilniku — nikoli ne gre na strežnik.",
    en: "Your location lives only in this page’s memory — it never reaches the server.",
    it: "La posizione vive solo nella memoria di questa pagina — non arriva mai al server.",
    de: "Der Standort lebt nur im Speicher dieser Seite — er erreicht nie den Server.",
    fr: "Ta position ne vit que dans la mémoire de cette page — elle n’atteint jamais le serveur.",
    es: "Tu ubicación vive solo en la memoria de esta página — nunca llega al servidor.",
  },

  // naloge
  tasksTitle: { sl: "Odprte naloge", en: "Open tasks", it: "Attività aperte", de: "Offene Aufgaben", fr: "Tâches en cours", es: "Tareas pendientes" },
  tasksNone: { sl: "Vse je urejeno — nimam odprtih nalog.", en: "All set — no open tasks.", it: "Tutto a posto — nessuna attività aperta.", de: "Alles erledigt — keine offenen Aufgaben.", fr: "Tout est en ordre — aucune tâche en cours.", es: "Todo en orden — sin tareas pendientes." },
  taskDates: { sl: (t: string) => `Določi datume poti „${t}“`, en: (t: string) => `Set dates for trip “${t}”`, it: (t: string) => `Imposta le date del viaggio «${t}»`, de: (t: string) => `Lege die Daten für die Reise „${t}“ fest`, fr: (t: string) => `Définis les dates du voyage « ${t} »`, es: (t: string) => `Define las fechas del viaje «${t}»` },
  taskProfile: { sl: "Dopolni potovalni profil (proračun/interesi)", en: "Complete your travel profile (budget/interests)", it: "Completa il profilo di viaggio (budget/interessi)", de: "Vervollständige dein Reiseprofil (Budget/Interessen)", fr: "Complète ton profil de voyage (budget/centres d’intérêt)", es: "Completa tu perfil de viaje (presupuesto/intereses)" },
  taskWatch: { sl: "Dodaj prvo spremljanje (cena/vreme/dnevi)", en: "Add your first watch (price/weather/countdown)", it: "Aggiungi la prima osservazione (prezzo/meteo/conto alla rovescia)", de: "Füge die erste Beobachtung hinzu (Preis/Wetter/Countdown)", fr: "Ajoute ton premier suivi (prix/météo/compte à rebours)", es: "Añade tu primer seguimiento (precio/tiempo/cuenta atrás)" },
} as const;

// ── Tipi (oblike odgovorov) ─────────────────────────────────────────────────

interface TripDto {
  shareId: string;
  title: string;
  dateStart: string | null;
  dateEnd: string | null;
  firstStop: { name: string; lat: number; lng: number } | null;
  dayCount: number;
  stopCount: number;
}

interface WatchDto {
  id: string;
  kind: string;
  targetName: string;
  state: string;
}

interface NotificationDto {
  id: string;
  severity: string;
  title: string;
  readAt: string | null;
}

interface PreferencesDto {
  preferences: { key: string; value: string }[];
  personalization: "on" | "off";
}

// Samo ključi z objektnimi vrednostmi (sl/en) — funkcijske oznake
// (days/stops/alertsUnread/taskDates) se kličejo prek pick(l, L.x).
type LabelKey = {
  [K in keyof typeof L]: (typeof L)[K] extends { sl: string; en: string } ? K : never;
}[keyof typeof L];

type Lang = "sl" | "en";

// ── Sekcija ─────────────────────────────────────────────────────────────────

export function PersonalHomeSection() {
  const { status } = useSession();
  if (status !== "authenticated") return null;
  return <PersonalBoard />;
}

function PersonalBoard() {
  const l = useLocale();
  const t = useCallback(
    <K extends LabelKey>(k: K): string => pick(l, L[k]),
    [l]
  );

  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<TripDto[]>([]);
  const [watches, setWatches] = useState<WatchDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [prefs, setPrefs] = useState<PreferencesDto | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [tripsRes, watchRes, notifRes, prefRes] = await Promise.all([
          fetch("/api/trips"),
          fetch("/api/watch"),
          fetch("/api/notifications"),
          fetch("/api/preferences"),
        ]);
        // Vsaka potej je lastniška (401 → prazen prikaz, ne napaka celote).
        if (tripsRes.ok && alive) setTrips(((await tripsRes.json()) as { trips: TripDto[] }).trips);
        if (watchRes.ok && alive) setWatches(((await watchRes.json()) as { watches: WatchDto[] }).watches);
        if (notifRes.ok && alive) {
          setNotifications(
            ((await notifRes.json()) as { notifications: NotificationDto[] }).notifications
          );
        }
        if (prefRes.ok && alive) setPrefs((await prefRes.json()) as PreferencesDto);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const unread = useMemo(
    () => notifications.filter((n) => n.readAt === null),
    [notifications]
  );

  // Najnovejša pot (API ureja po updatedAt DESC — prva je najnovejša).
  const latestTrip = trips[0] ?? null;

  // Prihajajoča pota z datumi znotraj 16-dnevnega horizonta (deterministično:
  // najbližji prihodnji dateStart; danes šteje).
  const today = todayIso();
  const upcoming = useMemo(() => {
    const withDates = trips.filter(
      (tr) => tr.dateStart && tr.dateStart >= today
    );
    return withDates.length > 0 ? withDates[0] : null;
  }, [trips, today]);

  if (loading) {
    return (
      <section
        aria-busy="true"
        aria-label={t("title")}
        className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="personal-home-title"
      className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8"
    >
      <div className="mb-4">
        <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">
          {t("kicker")}
        </p>
        <h2 id="personal-home-title" className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title")}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{t("lead")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ContinueTripCard latestTrip={latestTrip} t={t} l={l} />
        <AlertsCard unread={unread} t={t} l={l} />
        <WatchesCard watches={watches} t={t} l={l} />
        <WeatherCard upcoming={upcoming} t={t} l={l} />
        <IdeasCard prefs={prefs} t={t} l={l} />
        <NearbyCard t={t} l={l} />
      </div>

      <TasksCard
        trips={trips}
        watches={watches}
        prefs={prefs}
        t={t}
        l={l}
      />
    </section>
  );
}

// ── 1) NADALJUJ POT ─────────────────────────────────────────────────────────

function ContinueTripCard({
  latestTrip,
  t,
  l,
}: {
  latestTrip: TripDto | null;
  t: (k: LabelKey) => string;
  l: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="size-5 text-primary" aria-hidden="true" />
          {t("continueTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {latestTrip ? (
          <div className="space-y-2.5">
            <p className="font-bold">{latestTrip.title}</p>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {pick(l, L.days)(latestTrip.dayCount)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden="true" />
                {pick(l, L.stops)(latestTrip.stopCount)}
              </span>
              {latestTrip.dateStart ? (
                <span className="font-mono text-xs">
                  {latestTrip.dateStart}
                  {latestTrip.dateEnd && latestTrip.dateEnd !== latestTrip.dateStart
                    ? ` → ${latestTrip.dateEnd}`
                    : ""}
                </span>
              ) : (
                <Badge variant="outline">{t("noDates")}</Badge>
              )}
            </p>
            <Button asChild size="sm" className="h-10">
              <Link href={`/pot/${latestTrip.shareId}`}>{t("continueCta")}</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("continueNone")}
            </p>
            <Button asChild size="sm" variant="outline" className="h-10">
              <Link href="/nacrtuj">{t("planCta")}</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 2) OBVESTILA ────────────────────────────────────────────────────────────

function AlertsCard({
  unread,
  t,
  l,
}: {
  unread: NotificationDto[];
  t: (k: LabelKey) => string;
  l: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-5 text-primary" aria-hidden="true" />
          {t("alertsTitle")}
          {unread.length > 0 && (
            <Badge className="bg-primary text-primary-foreground">{unread.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {unread.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("alertsNone")}
          </p>
        ) : (
          <div className="space-y-2.5">
            <ul className="max-h-24 list-none space-y-1 overflow-y-auto pr-1 text-sm">
              {unread.slice(0, 3).map((n) => (
                <li key={n.id} className="flex items-start gap-1.5">
                  {n.severity === "warning" ? (
                    <TriangleAlert
                      className="mt-0.5 size-3.5 shrink-0 text-amber-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <Bell className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  )}
                  <span className="leading-snug">{n.title}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="sm" variant="outline" className="h-10">
              <Link href="/notifikacije">
                {t("alertsCta")} · {pick(l, L.alertsUnread)(unread.length)}
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 3) SPREMLJANJA ──────────────────────────────────────────────────────────

const KIND_SHORT: Record<string, { sl: string; en: string }> = {
  price: L.priceKind,
  weather: L.weatherKind,
  trip_day: L.tripDayKind,
  booking: L.bookingKind,
};

function WatchesCard({
  watches,
  t,
  l,
}: {
  watches: WatchDto[];
  t: (k: LabelKey) => string;
  l: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-5 text-primary" aria-hidden="true" />
          {t("watchTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {watches.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("watchNone")}
          </p>
        ) : (
          <div className="space-y-2.5">
            <ul className="max-h-24 list-none space-y-1 overflow-y-auto pr-1">
              {watches.slice(0, 4).map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-1.5 text-sm">
                  <Badge variant="secondary" className="text-[11px]">
                    {pick(l, KIND_SHORT[w.kind] ?? { sl: w.kind, en: w.kind })}
                  </Badge>
                  <span className="min-w-0 truncate">{w.targetName}</span>
                  {w.state === "paused" && (
                    <span className="text-xs text-muted-foreground">
                      ({t("pausedLabel")})
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <Button asChild size="sm" variant="outline" className="h-10">
              <Link href="/notifikacije">{t("alertsCta")}</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 4) VREME NASLEDNJE POTE ─────────────────────────────────────────────────

function WeatherCard({
  upcoming,
  t,
  l,
}: {
  upcoming: TripDto | null;
  t: (k: LabelKey) => string;
  l: string;
}) {
  const [state, setState] = useState<"loading" | "unreachable" | "ok">("loading");
  const [day, setDay] = useState<{
    code: number;
    tMaxC: number;
    tMinC: number;
    precipMm: number;
    date: string;
  } | null>(null);

  const stopName = upcoming?.firstStop?.name ?? null;
  const dateStart = upcoming?.dateStart ?? null;

  // Faza se IZPELJE iz podatkov (brez sinhronega setState v efektu — kanon
  // react-hooks): brez pote/postanka → idle; datum izven horizonta → far;
  // sicer se pridobi napoved (istanje loading → ok/unreachable ASINHRONO).
  const horizonIso = useMemo(() => {
    const horizon = new Date(todayIso());
    horizon.setDate(horizon.getDate() + 15); // 16-dnevni horizont vira
    return `${horizon.getFullYear()}-${String(horizon.getMonth() + 1).padStart(2, "0")}-${String(horizon.getDate()).padStart(2, "0")}`;
  }, []);
  const phase: "idle" | "far" | "fetch" =
    !upcoming?.firstStop || !dateStart
      ? "idle"
      : dateStart > horizonIso
        ? "far"
        : "fetch";

  useEffect(() => {
    if (phase !== "fetch" || !upcoming?.firstStop || !dateStart) return;
    let alive = true;
    fetchDailyWeather(upcoming.firstStop.lat, upcoming.firstStop.lng)
      .then((res) => {
        if (!alive) return;
        const entry = res?.daily.find((d) => d.date === dateStart) ?? null;
        if (!res || !entry) {
          setState("unreachable"); // vir nedosegljiv ALI dan brez vnosa — iskreno
          return;
        }
        setDay(entry);
        setState("ok");
      })
      .catch(() => {
        if (alive) setState("unreachable");
      });
    return () => {
      alive = false;
    };
  }, [phase, upcoming, dateStart]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {state === "ok" && day && (day.precipMm >= 5 || day.code >= 95) ? (
            <CloudRain className="size-5 text-primary" aria-hidden="true" />
          ) : (
            <Sun className="size-5 text-primary" aria-hidden="true" />
          )}
          {t("weatherTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {phase === "idle" && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("weatherNoTrip")}
          </p>
        )}
        {phase === "far" && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("weatherFar")}
          </p>
        )}
        {state === "loading" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            …
          </p>
        )}
        {state === "unreachable" && (
          <p className="text-sm leading-relaxed text-muted-foreground" role="status">
            {t("weatherUnreachable")}
          </p>
        )}
        {state === "ok" && day && stopName && (
          <div className="space-y-1.5">
            <p className="font-bold">
              {stopName} · <span className="font-mono text-sm">{day.date}</span>
            </p>
            <p className="text-2xl font-bold">
              {Math.round(day.tMaxC)}°C
              <span className="ml-2 text-base font-medium text-muted-foreground">
                / {Math.round(day.tMinC)}°C
              </span>
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Compass className="size-4" aria-hidden="true" />
              {weatherLabel(day.code, l === "en" ? "en" : "sl")}
              {day.precipMm > 0 &&
                ` · ${day.precipMm.toFixed(1).replace(".", ",")} mm`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 5) IDEJE ZATE (iz preferenc — isti reason slovar kot priporočila) ───────

function IdeasCard({
  prefs,
  t,
  l,
}: {
  prefs: PreferencesDto | null;
  t: (k: LabelKey) => string;
  l: string;
}) {
  const lang = l === "en" ? "en" : "sl";

  const ideas = useMemo(() => {
    if (!prefs || prefs.personalization === "off") return null;
    const byKey = new Map(
      prefs.preferences.map((p) => [p.key, p.value])
    );
    const budgetRaw = byKey.get("budget");
    let budget: Budget | null = null;
    try {
      const parsed = budgetRaw ? (JSON.parse(budgetRaw) as string) : null;
      if (parsed === "€" || parsed === "€€" || parsed === "€€€") budget = parsed;
    } catch {
      budget = null; // pokvarjen zapis → iskreno brez (fail-closed)
    }
    let interests: string[] = [];
    const interestsRaw = byKey.get("interests");
    try {
      const parsed = interestsRaw ? (JSON.parse(interestsRaw) as unknown) : null;
      if (Array.isArray(parsed)) {
        interests = parsed.filter((w): w is string => typeof w === "string").slice(0, 12);
      }
    } catch {
      interests = [];
    }
    if (!budget && interests.length === 0) return { list: [], budget, interests };

    // ISTI reason kontekst kot @AI priporočila (brez sidra — domača stran).
    const ctx: ReasonContext = { anchor: null, budget, season: null, interests };
    const scored = DESTINATIONS.map((dest) => {
      const reasons = buildCandidateReasons(dest, ctx, lang);
      const budgetFit = budget
        ? reasons.some((r) => r.kind === "budgetFit" && !r.label.includes("NAD") && !r.label.includes("above"))
        : false;
      const interestHit = reasons.some((r) => r.kind === "interestMatch");
      // Deterministično rangiranje: ujemanje interesov > proračun > ocena > ime.
      const score =
        (interestHit ? 2 : 0) + (budgetFit ? 1 : 0) + dest.rating / 10;
      return { dest, reasons, score, interestHit, budgetFit };
    })
      // Samo uporabne ideje: vsaj enež ujemanje (interesi ALI proračun).
      .filter((s) => s.interestHit || s.budgetFit)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (a.dest.name < b.dest.name ? -1 : a.dest.name > b.dest.name ? 1 : 0)
      )
      .slice(0, 3);
    return { list: scored, budget, interests };
  }, [prefs, lang]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-5 text-primary" aria-hidden="true" />
          {t("ideasTitle")}
        </CardTitle>
        <CardDescription>
          {pick(l, {
            sl: "Deterministično iz tvojih preferenc (0-AI) — z razlogom.",
            en: "Deterministic from your preferences (0-AI) — with reasons.",
            it: "Deterministico dalle tue preferenze (0-AI) — con i motivi.",
            de: "Deterministisch aus deinen Präferenzen (0-AI) — mit Begründung.",
            fr: "Déterministe à partir de tes préférences (0-AI) — avec les raisons.",
            es: "Determinista a partir de tus preferencias (0-AI) — con los motivos.",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {ideas === null ? (
          <div className="space-y-2.5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("ideasOff")}
            </p>
            <Button asChild size="sm" variant="outline" className="h-10">
              <Link href="/moj-profil">{t("profileCta")}</Link>
            </Button>
          </div>
        ) : ideas.list.length === 0 ? (
          <div className="space-y-2.5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("ideasNoPrefs")}
            </p>
            <Button asChild size="sm" variant="outline" className="h-10">
              <Link href="/moj-profil">{t("profileCta")}</Link>
            </Button>
          </div>
        ) : (
          <ul className="max-h-40 list-none space-y-2.5 overflow-y-auto pr-1">
            {ideas.list.map((s) => (
              <li key={s.dest.slug} className="text-sm">
                <Link
                  href={`/destinacija/${s.dest.slug}`}
                  className="font-bold hover:text-primary hover:underline"
                >
                  {s.dest.name}
                </Link>
                <p className="mt-0.5 leading-snug text-muted-foreground">
                  <span className="font-medium">{t("ideasWhy")} </span>
                  {formatReasonsInline(s.reasons.filter((r) =>
                    r.kind === "budgetFit" || r.kind === "interestMatch" || r.kind === "price"
                  ), 2)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── 6) V BLIŽINI (enkratna GPS fiksacija, 100 % klient) ─────────────────────

type NearbyState =
  | "idle"
  | "loading"
  | "ok"
  | "denied"
  | "error"
  | "unsupported";

function NearbyCard({
  t,
  l,
}: {
  t: (k: LabelKey) => string;
  l: string;
}) {
  const [state, setState] = useState<NearbyState>("idle");
  const [nearest, setNearest] = useState<
    { slug: string; name: string; km: number }[] | null
  >(null);

  // Enkratna fiksacija (getCurrentPosition — lažja od watchPosition Go Mode).
  // ZASEBNOST: položaj živi samo v tem stanju; haversine teče klientno nad
  // registrom 38 destinacij — 0 strežniških klicev z lego.
  const onFind = useCallback(() => {
    if (state === "loading") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unsupported");
      return;
    }
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setState("error");
          return;
        }
        const R = 6371; // km — isti izvor kot haversineKm (itinerary-engine)
        const toRad = (v: number) => (v * Math.PI) / 180;
        const ranked = DESTINATIONS.filter((d) => d.coords)
          .map((d) => {
            const dLat = toRad(d.coords.lat - lat);
            const dLng = toRad(d.coords.lng - lng);
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat)) * Math.cos(toRad(d.coords.lat)) * Math.sin(dLng / 2) ** 2;
            const km = 2 * R * Math.asin(Math.sqrt(a));
            return { slug: d.slug, name: d.name, km };
          })
          .sort((a, b) => a.km - b.km || (a.name < b.name ? -1 : 1))
          .slice(0, 3);
        setNearest(ranked);
        setState("ok");
      },
      (err) => {
        setState(err?.code === 1 ? "denied" : "error");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-5 text-primary" aria-hidden="true" />
          {t("nearbyTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {state === "idle" && (
          <div className="space-y-2.5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("nearbyPrivacy")}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-10"
              onClick={onFind}
            >
              <Compass className="size-4" aria-hidden="true" />
              {t("nearbyCta")}
            </Button>
          </div>
        )}
        {state === "loading" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> …
          </p>
        )}
        {(state === "denied" || state === "unsupported") && (
          <p className="text-sm leading-relaxed text-muted-foreground" role="status">
            {state === "denied" ? t("nearbyDenied") : t("nearbyUnsupported")}
          </p>
        )}
        {state === "error" && (
          <p className="text-sm leading-relaxed text-muted-foreground" role="status">
            {pick(l, {
              sl: "Lokacije ni bilo mogoče dobiti — poskusi znova.",
              en: "Could not get your location — try again.",
              it: "Impossibile ottenere la posizione — riprova.",
              de: "Standort konnte nicht ermittelt werden — versuche es erneut.",
              fr: "Impossible d’obtenir ta position — réessaie.",
              es: "No se pudo obtener tu ubicación — inténtalo de nuevo.",
            })}
          </p>
        )}
        {state === "ok" && nearest && (
          <ul className="list-none space-y-1.5 text-sm">
            {nearest.map((n) => (
              <li key={n.slug} className="flex items-center justify-between gap-2">
                <Link
                  href={`/destinacija/${n.slug}`}
                  className="font-medium hover:text-primary hover:underline"
                >
                  {n.name}
                </Link>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {Math.round(n.km)} km
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── 7) ODPRTE NALOGE (deterministične, iz že naloženih podatkov) ────────────

function TasksCard({
  trips,
  watches,
  prefs,
  t,
  l,
}: {
  trips: TripDto[];
  watches: WatchDto[];
  prefs: PreferencesDto | null;
  t: (k: LabelKey) => string;
  l: string;
}) {
  const tasks = useMemo(() => {
    const out: { label: string; href: string | null }[] = [];
    // 1. Poti brez datumov (max 2 — bounded, deterministično po vrstnem redu).
    for (const tr of trips.filter((x) => !x.dateStart).slice(0, 2)) {
      out.push({
        label: pick(l, L.taskDates)(tr.title),
        href: `/pot/${tr.shareId}`,
      });
    }
    // 2. Profil brez preferenc (brez osebnih podatkov → povabilo).
    if (prefs && prefs.preferences.filter((p) => p.key !== "personalization").length === 0) {
      out.push({ label: t("taskProfile"), href: "/moj-profil" });
    }
    // 3. Brez spremljanj.
    if (watches.length === 0) {
      out.push({ label: t("taskWatch"), href: "/trznica" });
    }
    return out;
  }, [trips, watches, prefs, t, l]);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
          {t("tasksTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("tasksNone")}</p>
        ) : (
          <ul className="list-none space-y-1.5 text-sm">
            {tasks.map((task, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-primary" aria-hidden="true">
                  →
                </span>
                {task.href ? (
                  <Link
                    href={task.href}
                    className="hover:text-primary hover:underline"
                  >
                    {task.label}
                  </Link>
                ) : (
                  <span>{task.label}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
