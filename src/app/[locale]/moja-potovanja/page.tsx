"use client";

import {
  ArrowRight,
  Ban,
  CircleCheck,
  CloudUpload,
  FlaskConical,
  Footprints,
  HardDrive,
  Info,
  MapPin,
  Route as RouteIcon,
  TicketCheck,
  Trash2,
  Wand2,
  X,
  Handshake,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import React, { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { StopKindIcon } from "@/components/plan/plan-bits";
import { CloudTripsSection } from "@/components/trips/cloud-trips-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { buildPlanFromMyTrip, formatMoney, type PlannerLang } from "@/lib/itinerary-engine";
import { myTrip, useMyTripList } from "@/lib/my-trip";
import { useGoTrip, useLastPlan } from "@/lib/plan-store";
import { DESTINATIONS, regionLabel, typeLabel } from "@/lib/slovenia-data";
import type { MyTripItem } from "@/lib/types";

/**
 * /moja-potovanja — HUB potovanj: zbirka „Moja pot“ (dai:my-trip) z
 * odstranjevanjem in skupno ceno, zadnji shranjeni načrt (dai:last-plan),
 * NA POTI badge (dai:go-trip), CTA izhodi in iskreno gostovanje brez
 * prijavnega zida („potovanja se shranjujejo lokalno na tej napravi“).
 */

const L = {
  kicker: { sl: "Zbirka", en: "Collection" },
  title: { sl: "Moja potovanja", en: "My trips" },
  lead: {
    sl: "Vse na enem mestu: zbirka postankov „Moja pot“, zadnji deterministični načrt in živi napredek Na poti.",
    en: "Everything in one place: your “My trip” stop collection, the last deterministic plan and live On-the-road progress.",
  },
  onTheRoad: { sl: "NA POTI", en: "ON THE ROAD" },
  onTheRoadDesc: {
    sl: (day: number, done: number, total: number) =>
      `Dan ${day} · ${done}/${total} opravljenih postankov`,
    en: (day: number, done: number, total: number) =>
      `Day ${day} · ${done}/${total} stops completed`,
  },
  continueGo: { sl: "Nadaljuj na poti", en: "Continue on the road" },
  collectionTitle: { sl: "Moja pot", en: "My trip" },
  collectionLead: {
    sl: "Postanki, ki jih dodajaš po straneh destinacij in načrtovalniku.",
    en: "Stops you add across destination pages and the planner.",
  },
  remove: { sl: "Odstrani", en: "Remove" },
  clearAll: { sl: "Počisti zbirko", en: "Clear collection" },
  clearConfirm: {
    sl: "Pobrišem vse postanke iz zbirke? Dejanja ni mogoče razveljaviti.",
    en: "Remove all stops from the collection? This cannot be undone.",
  },
  total: { sl: "Skupaj (ocena na osebo)", en: "Total (estimate per person)" },
  emptyCollection: {
    sl: "Zbirka je prazna — dodaj postanke z gumbom „Dodaj v mojo pot“ na straneh destinacij.",
    en: "The collection is empty — add stops with the “Add to my trip” button on destination pages.",
  },
  clearedMsg: {
    sl: "Zbirka je pobrisana — nove postanke dodaš kadar koli.",
    en: "The collection has been cleared — you can add new stops anytime.",
  },
  explore: { sl: "Razišči destinacije", en: "Explore destinations" },
  plansTitle: { sl: "Zadnji načrt", en: "Latest plan" },
  plansLead: {
    sl: "Deterministični načrt, shranjen z /nacrtuj (gumb „Shrani v Moja pot“).",
    en: "The deterministic plan saved from /nacrtuj (the “Save to My trip” button).",
  },
  openJourney: { sl: "Odpri potovanje", en: "Open the journey" },
  noPlan: {
    sl: "Ni shranjenega načrta — sestavi ga na /nacrtuj.",
    en: "No saved plan yet — build one at /nacrtuj.",
  },
  ctaPlan: { sl: "Načrtuj novo", en: "Plan a new one" },
  guestTitle: { sl: "Brez prijave — lokalno shranjevanje", en: "No sign-in — local storage" },
  guestBody: {
    sl: "Potovanja se shranjujejo lokalno na tej napravi (spletna shramba brskalnika) in niso povezana z računom. Z menjavo naprave se ne prenesejo.",
    en: "Trips are stored locally on this device (browser storage) and are not tied to an account. They do not transfer across devices.",
  },
  savedAt: { sl: "Shranjeno", en: "Saved" },
  daysWord: {
    sl: (n: number) => `${n} ${n === 1 ? "dan" : n === 2 ? "dneva" : "dni"}`,
    en: (n: number) => `${n} ${n === 1 ? "day" : n === 2 ? "days" : "days"}`,
  },
  stopsWord: {
    sl: (n: number) => `${n} ${n === 1 ? "postanek" : n === 2 ? "postanka" : "postankov"}`,
    en: (n: number) => `${n} ${n === 1 ? "stop" : "stops"}`,
  },
  unknown: { sl: "podatek neznan", en: "data unknown" },
} as const;

// ── REZERVACIJE NA POTEH (issue #1 področje 2 — My Trips statusi) ────────────
// Števec rezervacij po poteh v oblaku + kanalno razkritje (demo/user/partner).
// ISKRENOST: demo rezervacije so IZRECNO označene (simulator, nikoli
// ponudnik); partner rezervacije so REALNE pri partnerju (status PENDING
// dokler partner ne pošlje potrdila); direktni ponudniški API je
// fail-closed in razkrit v nogi.
const BK_L = {
  title: { sl: "Rezervacije na tvojih poteh", en: "Bookings on your trips" },
  lead: {
    sl: "Števci rezervacij po poteh v oblaku — z razkritjem kanala (partner, demo simulator ali uporabniška atestacija).",
    en: "Booking counters per cloud trip — with channel disclosure (partner, demo simulator or user attestation).",
  },
  loading: { sl: "Nalagam rezervacije …", en: "Loading bookings …" },
  empty: {
    sl: "Nimaš še rezervacij na poteh v oblaku.",
    en: "You have no bookings on cloud trips yet.",
  },
  emptyHint: {
    sl: "Rezerviraš jih v zavihku „Rezervacije“ na posamezni poti (gumb „Išči ponudbo“ — pri partnerju ali demo).",
    en: "Book them in the “Reservations” tab of a trip (the “Search an offer” button — partner or demo).",
  },
  bookingsWord: {
    sl: (n: number) =>
      `${n} ${n === 1 ? "rezervacija" : n === 2 ? "rezervaciji" : n === 3 || n === 4 ? "rezervacije" : "rezervacij"}`,
    en: (n: number) => `${n} ${n === 1 ? "booking" : "bookings"}`,
  },
  confirmedWord: {
    sl: (n: number) =>
      `${n} ${n === 1 ? "potrjena" : n === 2 ? "potrjeni" : n === 3 || n === 4 ? "potrjene" : "potrjenih"}`,
    en: (n: number) => `${n} confirmed`,
  },
  pendingWord: {
    sl: (n: number) =>
      `${n} ${n === 1 ? "čaka potrditev" : n === 2 ? "čakata potrditev" : n === 3 || n === 4 ? "čakajo potrditev" : "čaka potrditve"}`,
    en: (n: number) => `${n} awaiting partner confirmation`,
  },
  cancelledWord: { sl: "preklicanih", en: "cancelled" },
  demoChip: { sl: "demo", en: "demo" },
  userChip: { sl: "uporabniška", en: "user" },
  realChip: { sl: "realna", en: "real" },
  partnerChip: { sl: "partner", en: "partner" },
  unknownChip: { sl: "brez razkritja", en: "undisclosed" },
  demoFootnote: {
    sl: "Partner rezervacije so REALNE pri partnerju (Booking.com, GetYourGuide, Kiwi, Rentalcars, Omio) — status čaka potrditev, dokler ne vneseš številke iz partnerjevega potrdila. Demo rezervacije so SIMULIRANE (izrecno označene). Direktni ponudniški API ni aktiven — nikoli ne lažemo.",
    en: "Partner bookings are REAL at the partner (Booking.com, GetYourGuide, Kiwi, Rentalcars, Omio) — the status awaits confirmation until you enter the partner’s reference. Demo bookings are SIMULATED (explicitly labelled). The direct provider API is not active — we never lie.",
  },
  openTrip: { sl: "Odpri pot", en: "Open trip" },
} as const;

interface TripBookingsSummaryRow {
  shareId: string;
  title: string;
  total: number;
  confirmed: number;
  modified: number;
  cancelled: number;
  idea: number;
  /** Partner rezervacije, ki čakajo na partnerjevo potrditev (PENDING). */
  pending: number;
  demo: number;
  user: number;
  real: number;
  partner: number;
  unknownChannel: number;
  latestAt: string;
}

/**
 * Zbirnik rezervacij prijavljenega uporabnika po poteh (GET
 * /api/journey/bookings — moje rezervacije, zbrane po poteh, z razkritjem
 * kanalov). Gostu se sekcecija sploh ne izriše (iskreno — rezervacije so
 * vezane na račun).
 */
function TripBookingsSummary() {
  const l = useLocale();
  const lang: "sl" | "en" = l === "en" ? "en" : "sl";
  const { status: sessionStatus } = useSession();
  const [trips, setTrips] = useState<TripBookingsSummaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    let cancelled = false;
    // Stanje se posodablja SAMO asinhrono po odzivu (brez sinhronega
    // setState v telesu efekta — hišni lint kanon).
    fetch("/api/journey/bookings", { cache: "no-store" }).then(
      async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(`Napaka ${r.status}`);
          return;
        }
        const data = (await r.json()) as { trips?: TripBookingsSummaryRow[] };
        if (!cancelled) setTrips(data.trips ?? []);
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [sessionStatus]);

  if (sessionStatus !== "authenticated") return null;

  return (
    <section className="mt-10" aria-labelledby="rezervacije-na-poteh">
      <h2
        id="rezervacije-na-poteh"
        className="flex items-center gap-2 text-xl font-bold tracking-tight"
      >
        <TicketCheck className="size-5 text-primary" aria-hidden="true" />
        {pick(l, BK_L.title)}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{pick(l, BK_L.lead)}</p>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : trips === null ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          {pick(l, BK_L.loading)}
        </p>
      ) : trips.length === 0 ? (
        <Card className="mt-4 border-dashed">
          <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
            <TicketCheck className="size-7 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{pick(l, BK_L.empty)}</p>
            <p className="text-xs text-muted-foreground">{pick(l, BK_L.emptyHint)}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {trips.map((t) => (
            <li key={t.shareId}>
              <Card className="h-full">
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-semibold">{t.title}</p>
                    <Button asChild variant="ghost" size="sm" className="min-h-9 shrink-0 gap-1.5">
                      <Link href={`/pot/${t.shareId}`}>
                        <ArrowRight className="size-4" aria-hidden="true" />
                        <span className="sr-only">{pick(l, BK_L.openTrip)}: {t.title}</span>
                        {pick(l, BK_L.openTrip)}
                      </Link>
                    </Button>
                  </div>
                  {/* Števec: „2 rezervaciji · 1 potrjena“ */}
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium">{BK_L.bookingsWord[lang](t.total)}</span>
                    {t.confirmed > 0 ? (
                      <span className="text-muted-foreground">
                        · {BK_L.confirmedWord[lang](t.confirmed)}
                      </span>
                    ) : null}
                    {t.pending > 0 ? (
                      <span className="text-muted-foreground">
                        · {BK_L.pendingWord[lang](t.pending)}
                      </span>
                    ) : null}
                    {t.cancelled > 0 ? (
                      <span className="text-muted-foreground">
                        · {t.cancelled} × {pick(l, BK_L.cancelledWord)}
                      </span>
                    ) : null}
                  </p>
                  {/* Kanalno razkritje — partner smaragdno, demo IZRECNO oranžno, nikoli mešano */}
                  <p className="flex flex-wrap items-center gap-1.5">
                    {t.partner > 0 ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-emerald-600/50 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        <Handshake className="size-3" aria-hidden="true" />
                        {t.partner} × {pick(l, BK_L.partnerChip)}
                      </Badge>
                    ) : null}
                    {t.demo > 0 ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-orange-500/50 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                      >
                        <FlaskConical className="size-3" aria-hidden="true" />
                        {t.demo} × {pick(l, BK_L.demoChip)}
                      </Badge>
                    ) : null}
                    {t.user > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-violet-500/50 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
                      >
                        {t.user} × {pick(l, BK_L.userChip)}
                      </Badge>
                    ) : null}
                    {t.real > 0 ? (
                      <Badge variant="outline" className="border-primary/50 bg-primary/5 text-primary">
                        {t.real} × {pick(l, BK_L.realChip)}
                      </Badge>
                    ) : null}
                    {t.unknownChannel > 0 ? (
                      <Badge variant="outline" className="border-border text-muted-foreground">
                        {t.unknownChannel} × {pick(l, BK_L.unknownChip)}
                      </Badge>
                    ) : null}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        {pick(l, BK_L.demoFootnote)}
      </p>
    </section>
  );
}

export default function MyTripsPage() {
  const l = useLocale();
  const lang: PlannerLang = l === "en" ? "en" : "sl";
  const { status: sessionStatus } = useSession();
  const items = useMyTripList();
  const { saved: lastPlan, ready: planReady } = useLastPlan();
  const { go: goTrip, ready: goReady } = useGoTrip();
  const [cleared, setCleared] = useState(false);

  const enriched = useMemo(
    () =>
      items.map((item) => ({
        item,
        dest: DESTINATIONS.find((d) => d.slug === item.refId || d.id === item.refId),
      })),
    [items]
  );

  const totalKnown = useMemo(
    () =>
      enriched.reduce(
        (sum, x) => sum + (x.dest ? x.dest.costPerPerson : 0),
        0
      ),
    [enriched]
  );
  const unknownCount = enriched.filter((x) => !x.dest).length;

  // NA POTI kontekst (če je go-trip aktiven — za oba vira: zadnji načrt
  // ali osnutek iz Moje pot, da je značka iskrena v obeh primerih).
  const goContext = useMemo(() => {
    if (!goTrip) return null;
    const plan =
      goTrip.planRef === "last-plan"
        ? lastPlan?.plan
        : buildPlanFromMyTrip(items, lang).plan;
    if (!plan) return null;
    const day = plan.days[goTrip.dayIndex] ?? [];
    const done = day.filter((s) => goTrip.completed.includes(s.id)).length;
    return { day: goTrip.dayIndex + 1, done, total: day.length };
  }, [goTrip, lastPlan, items, lang]);

  // Hidracija localStorage: dokler nista hydratana načrt in Go Mode,
  // kažemo skelet (brez utripanja praznih stanj pred prvim renderom).
  const ready = planReady && goReady;

  const removeItem = (item: MyTripItem) => {
    myTrip.remove(item.refId);
  };

  const clearCollection = () => {
    if (window.confirm(pick(l, L.clearConfirm))) {
      myTrip.clear();
      setCleared(true);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)} />

      {/* CTA vrstica */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg" className="min-h-12">
          <Link href="/nacrtuj">
            <Wand2 className="size-5" aria-hidden="true" />
            {pick(l, L.ctaPlan)}
          </Link>
        </Button>
        {goContext && (
          <Button asChild size="lg" variant="secondary" className="min-h-12">
            <Link href="/na-poti">
              <Footprints className="size-5" aria-hidden="true" />
              {pick(l, L.continueGo)}
            </Link>
          </Button>
        )}
      </div>

      {/* NA POTI badge */}
      {goContext && (
        <Card className="mt-4 border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Footprints className="size-4" aria-hidden="true" />
              </span>
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
                {pick(l, L.onTheRoad)}
              </span>
              <span className="text-muted-foreground">
                {L.onTheRoadDesc[lang](goContext.day, goContext.done, goContext.total)}
              </span>
            </p>
            <Button asChild size="sm" variant="outline" className="min-h-11">
              <Link href="/na-poti">
                <ArrowRight className="size-4" aria-hidden="true" />
                {pick(l, L.continueGo)}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* POTI V OBLAKU (48-a) — sekcecija se izriše SAMO prijavljenemu;
          gostu ostane iskrena kartica o lokalni shrambi spodaj. */}
      <CloudTripsSection />

      {/* REZERVACIJE NA POTEH (issue #1 področje 2) — števci + kanalno
          razkritje; samo za prijavljene (demo rezervacije so izrecno
          označene). */}
      <TripBookingsSummary />

      {/* ZBIRKA MOJA POT */}
      <section className="mt-10" aria-labelledby="moja-pot-zbirka">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="moja-pot-zbirka" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <RouteIcon className="size-5 text-primary" aria-hidden="true" />
            {pick(l, L.collectionTitle)}
          </h2>
          {items.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 text-destructive hover:text-destructive"
              onClick={clearCollection}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {pick(l, L.clearAll)}
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{pick(l, L.collectionLead)}</p>

        {!ready ? (
          <Skeleton className="mt-4 h-40 w-full rounded-xl" />
        ) : items.length === 0 ? (
          <Card className="mt-4 border-dashed">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <MapPin className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {cleared ? pick(l, L.clearedMsg) : pick(l, L.emptyCollection)}
              </p>
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/destinacije">{pick(l, L.explore)}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {enriched.map(({ item, dest }) => (
                <li key={item.refId}>
                  <Card className="h-full">
                    <CardContent className="flex items-start gap-3 p-4">
                      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card text-primary">
                        <StopKindIcon kind={dest?.type ?? "custom"} className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{item.name}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {dest ? (
                            <>
                              <span>{typeLabel(dest.type, lang)}</span>
                              <span>{regionLabel(dest.region, lang)}</span>
                              <span className="font-semibold text-foreground/80">
                                {formatMoney(dest.costPerPerson, lang)}
                              </span>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Ban className="size-3" aria-hidden="true" />
                              {pick(l, L.unknown)}
                            </span>
                          )}
                        </p>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {pick(l, L.savedAt)}:{" "}
                          {new Date(item.addedAt).toLocaleDateString(
                            lang === "en" ? "en-GB" : "sl-SI"
                          )}
                          {item.source ? ` · ${item.source}` : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item)}
                      >
                        <X className="size-4" aria-hidden="true" />
                        <span className="sr-only">
                          {pick(l, L.remove)}: {item.name}
                        </span>
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
            <Card className="mt-4">
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span className="font-semibold">{pick(l, L.total)}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge className="gap-1 bg-primary text-primary-foreground">
                    {formatMoney(totalKnown, lang)}
                  </Badge>
                  {unknownCount > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <Ban className="size-3" aria-hidden="true" />
                      {unknownCount} × {pick(l, L.unknown)}
                    </Badge>
                  )}
                </span>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      {/* ZADNJI NAČRT */}
      <section className="mt-10" aria-labelledby="zadnji-nacrt">
        <h2 id="zadnji-nacrt" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <CircleCheck className="size-5 text-primary" aria-hidden="true" />
          {pick(l, L.plansTitle)}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{pick(l, L.plansLead)}</p>

        {!lastPlan ? (
          <Card className="mt-4 border-dashed">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <RouteIcon className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{pick(l, L.noPlan)}</p>
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/nacrtuj">
                  <Wand2 className="size-4" aria-hidden="true" />
                  {pick(l, L.ctaPlan)}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-4">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{lastPlan.plan.title}</p>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {lastPlan.plan.summary}
                  </p>
                </div>
                <Badge className="gap-1 bg-primary text-primary-foreground">
                  {formatMoney(lastPlan.plan.totalCost, lang)}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{L.daysWord[lang](lastPlan.plan.days.length)}</Badge>
                <Badge variant="secondary">
                  {L.stopsWord[lang](lastPlan.plan.days.flat().length)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {pick(l, L.savedAt)}:{" "}
                  {new Date(lastPlan.savedAt).toLocaleString(lang === "en" ? "en-GB" : "sl-SI")}
                </span>
              </div>
              <Separator className="my-4" />
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="secondary" className="min-h-11">
                  <Link href="/potovanje">
                    <RouteIcon className="size-4" aria-hidden="true" />
                    {pick(l, L.openJourney)}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-11">
                  <Link href="/na-poti?start=1">
                    <Footprints className="size-4" aria-hidden="true" />
                    {pick(l, { sl: "Zaženi na poti", en: "Start on the road" })}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ISKRENO GOSTOVANJE — samo za neprijavljene (prijavljeni imajo
          poti v oblaku zgoraj; zbirka Moja pot je lokalna za vse) */}
      {sessionStatus !== "authenticated" ? (
        <Card className="mt-10 border-dashed">
          <CardContent className="flex items-start gap-3 p-4">
            <HardDrive className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                {pick(l, L.guestTitle)}
                <Info className="size-3.5 text-muted-foreground" aria-hidden="true" />
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {pick(l, L.guestBody)}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3 min-h-11 gap-1.5 font-semibold">
                <Link href="/prijava">
                  <CloudUpload className="size-4" aria-hidden="true" />
                  {pick(l, { sl: "Prijavi se za pote v oblaku", en: "Sign in for cloud trips" })}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
