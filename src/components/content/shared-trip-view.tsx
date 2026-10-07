"use client";

import {
  ArrowRight,
  CalendarDays,
  Clock,
  CloudUpload,
  HardDrive,
  MapPin,
  Plus,
  Printer,
  QrCode,
  Route,
  Share2,
  Users,
  Wallet,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchTripAggregate,
  TripCollaboration,
  TripInviteBanner,
  type TripRoleName,
} from "@/components/trips/trip-collab";
import { TripChat } from "@/components/trips/trip-chat";
import { TripPolls } from "@/components/trips/trip-polls";
import { TripReservations } from "@/components/trips/trip-reservations";
import { TripDatesPanel } from "@/components/trips/trip-dates-panel";
import { ReservationImportDialog } from "@/components/trips/reservation-import-dialog";
import { PrintableConfirmation } from "@/components/trips/printable-confirmation";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { myTrip } from "@/lib/my-trip";
import { getDestination } from "@/lib/slovenia-data";
import { type SharedPlan, sharedPlans } from "@/lib/shared-plan";
import type { TripDates } from "@/lib/trip-dates";

/**
 * /pot/[shareId] — deljena pot (rekonstrukcija D7 + 48-a skupnostne funkcije).
 *
 * VIR RESNICE (mostovna logika 48-a):
 *  1. GET /api/trips/[shareId] — če pot živi v bazi (javna ali sem
 *     sodelujoči) → VSE funkcije žive: zavihki Pot | Sodelovanje |
 *     Rezervacije | Ankete | Klepet (vloga strežniška);
 *  2. sicer → lokalna pote (localStorage) + iskren pasice »Shrani pot v
 *     oblak (prijava) za sodelovanje v živo« (uvoz = POST /api/trips);
 *  3. ničesar → iskreno stanje »ni (več) na tej napravi« (izvirnik: 404).
 *
 * ?invite={token} → trak vabila na vrhu (neprijavljeni → prijava; vloga
 * se razkrije šele ob sprejemu — kanon izvirnika).
 */

interface DbTrip {
  role: TripRoleName;
  isPublic: boolean;
  name: string | null;
  ownerName?: string;
  createdAt: string;
  plan: SharedPlan;
  version: { renameVersion: number; updatedAt: string };
  /** Realni datumi poti (P0-E) — null, če še niso določeni. */
  tripDates: TripDates | null;
}

export function SharedTripView({ shareId }: { shareId: string }) {
  const l = useLocale();
  const { data: session, status: sessionStatus } = useSession();

  const [localPlan, setLocalPlan] = React.useState<SharedPlan | null | undefined>(undefined); // undefined = nalagam
  const [db, setDb] = React.useState<DbTrip | null | undefined>(undefined);
  const [inviteToken, setInviteToken] = React.useState<string | null>(null);
  const [pageUrl, setPageUrl] = React.useState("");
  const [addedCount, setAddedCount] = React.useState(0);
  /** Verzija seznama rezervacij — remount TripReservations po uvozu (osvežitev). */
  const [reservationsVersion, setReservationsVersion] = React.useState(0);
  const [savingCloud, setSavingCloud] = React.useState(false);
  const [cloudError, setCloudError] = React.useState<string | null>(null);

  const loadDb = React.useCallback(async () => {
    const agg = await fetchTripAggregate(shareId);
    if (agg) {
      setDb({
        role: agg.role,
        isPublic: agg.isPublic,
        name: agg.name,
        ownerName: agg.ownerName,
        createdAt: agg.createdAt,
        plan: agg.plan,
        version: agg.version,
        tripDates: agg.tripDates ?? null,
      });
    } else {
      setDb(null);
    }
  }, [shareId]);

  React.useEffect(() => {
    setLocalPlan(sharedPlans.get(shareId) ?? null);
    setPageUrl(window.location.href);
    try {
      setInviteToken(new URLSearchParams(window.location.search).get("invite"));
    } catch {
      setInviteToken(null);
    }
    void loadDb();
  }, [shareId, loadDb]);

  const L = {
    kicker: { sl: "Deljena pot", en: "Shared trip" },
    nameFallback: { sl: "AI načrt potovanja po Sloveniji", en: "AI travel plan around Slovenia" },
    dayLabel: { sl: (n: number) => `Dan ${n}`, en: (n: number) => `Day ${n}` },
    budget: { sl: (n: number) => `Skupni proračun ≈ ${n} €`, en: (n: number) => `Total budget ≈ €${n}` },
    daysCount: { sl: (n: number) => (n === 1 ? "1 dan" : `${n} dni`), en: (n: number) => (n === 1 ? "1 day" : `${n} days`) },
    stops: { sl: (n: number) => (n === 1 ? "1 postanek" : `${n} postankov`), en: (n: number) => (n === 1 ? "1 stop" : `${n} stops`) },
    addTrip: { sl: "Dodaj v mojo pot", en: "Add to my trip" },
    added: { sl: "Dodano ✓", en: "Added ✓" },
    addAll: { sl: "Dodaj celo pot v mojo pot", en: "Add the whole trip to my trip" },
    print: { sl: "Natisni / shrani PDF", en: "Print / save PDF" },
    printFooter: { sl: "Izvoženo z Discover Slovenia AI", en: "Exported with Discover Slovenia AI" },
    qrTitle: { sl: "QR koda te povezave", en: "QR code of this link" },
    qrPlaceholder: {
      sl: "Tu se bo izrisala QR koda za to povezavo (v pripravi) — do takrat skopiraj URL spodaj.",
      en: "A QR code for this link will render here (in preparation) — until then, copy the URL below.",
    },
    copy: { sl: "Kopiraj povezavo", en: "Copy link" },
    copied: { sl: "Povezava skopirana!", en: "Link copied!" },
    loading: { sl: "Nalagam deljeno pot …", en: "Loading the shared trip …" },
    notFoundTitle: { sl: "Ta pot ni (več) na tej napravi", en: "This trip is not (anymore) on this device" },
    notFoundBody: {
      sl: "Te pote ni niti v oblaku (ali ni javna in nisi sodelujoči) niti v lokalni shrambi tega brskalnika. Če ti je nekdo poslal povezavo, prosi za vabilo (sodelovanje) ali nov izvoz (natis ali besedilni načrt).",
      en: "This trip is neither in the cloud (or it is private and you are not a collaborator) nor in this browser's local storage. If someone sent you the link, ask for an invite (collaboration) or a new export (print or a text plan).",
    },
    planCta: { sl: "Sestavi svoj načrt", en: "Build your own plan" },
    localNote: {
      sl: "Rekonstrukcija: izvirnik hrani deljene pote v bazi z javnimi povezavami; tukaj je vir lokalna shramba (iskrenost — brez baze v tej fazi).",
      en: "Reconstruction: the original stores shared trips in a database with public links; here the source is local storage (honest — no database in this phase).",
    },
    exploreDest: { sl: "Odpri destinacijo", en: "Open destination" },
    createdAt: { sl: "Ustvarjeno", en: "Created" },
    // 48-a: zavihki skupnostnih funkcij
    tabTrip: { sl: "Pot", en: "Trip" },
    tabCollab: { sl: "Sodelovanje", en: "Collaboration" },
    tabReservations: { sl: "Rezervacije", en: "Reservations" },
    tabPolls: { sl: "Ankete", en: "Polls" },
    tabChat: { sl: "Klepet", en: "Chat" },
    // 48-a: pasica uvoza v oblak
    cloudTitle: { sl: "Sodelovanje v živo — shrani pot v oblak", en: "Live collaboration — save this trip to the cloud" },
    cloudBody: {
      sl: "Ta pot živi samo na tej napravi (lokalna shramba). S shranitvijo v oblak odkleneš vabila, skupinske ankete, rezervacije in klepet z @AI — poti se sinhronizirajo z računom.",
      en: "This trip lives only on this device (local storage). Saving it to the cloud unlocks invites, group polls, reservations and the @AI chat — trips sync with your account.",
    },
    cloudCta: { sl: "Shrani v oblak", en: "Save to the cloud" },
    cloudSaving: { sl: "Shranjujem …", en: "Saving …" },
    cloudLogin: { sl: "Prijavi se za shranjevanje", en: "Sign in to save" },
    cloudNote: {
      sl: "Vir: baza (oblak) — sodelovanje urejeno po vlogah (lastnik/urednik/gledalec).",
      en: "Source: database (cloud) — collaboration managed by roles (owner/editor/viewer).",
    },
  } as const;

  const onAddAll = React.useCallback(
    (plan: SharedPlan | null) => {
      if (!plan) return;
      let added = 0;
      for (const day of plan.days) {
        for (const loc of day.locations) {
          const refId = loc.destSlug ?? `pot/${shareId}/${day.day}/${loc.name}`;
          const res = myTrip.add(refId, loc.name, "destination", `pot/${shareId}`);
          if (res.ok || res.already) added += 1;
        }
      }
      setAddedCount(added);
    },
    [shareId]
  );

  const onCopy = React.useCallback(() => {
    if (!pageUrl) return;
    void navigator.clipboard?.writeText(pageUrl).catch(() => undefined);
  }, [pageUrl]);

  const saveToCloud = React.useCallback(async () => {
    if (!localPlan || savingCloud) return;
    setSavingCloud(true);
    setCloudError(null);
    try {
      const r = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: localPlan,
          shareId,
          title: localPlan.name,
        }),
      });
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!r.ok || !data?.success) {
        setCloudError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      // Pot je zdaj v oblaku — celotna osvežitev pobere svež agregat + zavihke.
      window.location.reload();
    } catch (e) {
      setCloudError(e instanceof Error ? e.message : "Shranjevanje ni uspelo.");
    } finally {
      setSavingCloud(false);
    }
  }, [localPlan, shareId, savingCloud]);

  const loggedIn = sessionStatus === "authenticated" && Boolean(session?.user);

  // Nalaganje (prvi klic ni šel niti skozi localStorage niti skozi API)
  if (localPlan === undefined || db === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p role="status" className="text-sm text-muted-foreground">
          {pick(l, L.loading)}
        </p>
      </div>
    );
  }

  // ── 1. POT V BAZI → zavihki z vsemi skupnostnimi funkcijami ──────────
  if (db) {
    const plan = db.plan;
    const totalStops = plan.days.reduce((n, d) => n + d.locations.length, 0);
    const canEdit = db.role === "OWNER" || db.role === "EDITOR";
    const canParticipate = canEdit || (loggedIn && db.role === "VIEWER");

    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Trak vabila (?invite=…) — vrh strani, kot v izvirniku */}
        {inviteToken ? (
          <div className="mb-6">
            <TripInviteBanner
              shareId={shareId}
              inviteToken={inviteToken}
              onAccepted={() => void loadDb()}
            />
          </div>
        ) : null}

        {/* Glava pote */}
        <PageHeader kicker={pick(l, L.kicker)} title={db.name || pick(l, L.nameFallback)}>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              {pick(l, L.daysCount)(plan.days.length)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Route className="size-4 text-primary" aria-hidden="true" />
              {pick(l, L.stops)(totalStops)}
            </span>
            {typeof plan.totalBudget === "number" && (
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="size-4 text-primary" aria-hidden="true" />
                {pick(l, L.budget)(plan.totalBudget)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4 text-primary" aria-hidden="true" />
              {db.role === "NONE" ? (
                pick(l, { sl: "javna povezava", en: "public link" })
              ) : (
                <strong className="text-foreground">
                  {db.role === "OWNER"
                    ? pick(l, { sl: "ti si lastnik", en: "you are the owner" })
                    : db.role === "EDITOR"
                      ? pick(l, { sl: "ti si urednik", en: "you are an editor" })
                      : pick(l, { sl: "ti si gledalec", en: "you are a viewer" })}
                </strong>
              )}
            </span>
            <span className="font-mono text-xs">
              /pot/{shareId} · {pick(l, L.createdAt)}{" "}
              {new Date(db.createdAt).toLocaleDateString(l === "en" ? "en-GB" : "sl-SI")}
            </span>
          </div>
        </PageHeader>

        {/* Zavihki: Pot | Sodelovanje | Rezervacije | Ankete | Klepet */}
        <Tabs defaultValue="pot" className="mt-6">
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="pot" className="gap-1.5">
              <Route className="size-3.5" aria-hidden="true" />
              {pick(l, L.tabTrip)}
            </TabsTrigger>
            <TabsTrigger value="collab" className="gap-1.5">
              <Users className="size-3.5" aria-hidden="true" />
              {pick(l, L.tabCollab)}
            </TabsTrigger>
            <TabsTrigger value="reservations" className="gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {pick(l, L.tabReservations)}
            </TabsTrigger>
            <TabsTrigger value="polls" className="gap-1.5">
              <MapPin className="size-3.5" aria-hidden="true" />
              {pick(l, L.tabPolls)}
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1.5">
              <QrCode className="size-3.5" aria-hidden="true" />
              {pick(l, L.tabChat)}
            </TabsTrigger>
          </TabsList>

          {/* ── Zavihek POT ─────────────────────────────────────────── */}
          <TabsContent value="pot" className="mt-4 space-y-6">
            <div className="flex flex-wrap gap-3 print:hidden">
              <Button onClick={() => onAddAll(plan)} className="tap-target font-semibold">
                <Plus className="size-4" aria-hidden="true" />
                {pick(l, L.addAll)}
              </Button>
              {addedCount > 0 && (
                <Badge variant="secondary" className="self-center">
                  {pick(l, L.added)} ({addedCount})
                </Badge>
              )}
              <Button onClick={() => window.print()} variant="outline" className="tap-target font-semibold">
                <Printer className="size-4" aria-hidden="true" />
                {pick(l, L.print)}
              </Button>
              <Button onClick={onCopy} variant="ghost" className="tap-target font-semibold">
                <Share2 className="size-4" aria-hidden="true" />
                {pick(l, L.copy)}
              </Button>
            </div>

            <TripDatesPanel
              shareId={shareId}
              canEdit={canEdit}
              tripDates={db.tripDates}
              plan={plan}
              onSaved={() => void loadDb()}
            />

            <PlanDays plan={plan} shareId={shareId} l={l} addLabel={pick(l, L.addTrip)} addedLabel={pick(l, L.added)} exploreLabel={pick(l, L.exploreDest)} />

            <div className="grid gap-4 sm:grid-cols-2 print:hidden">
              <Card>
                <CardContent className="p-5">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <QrCode className="size-4 text-primary" aria-hidden="true" />
                    {pick(l, L.qrTitle)}
                  </h3>
                  <div
                    aria-hidden="true"
                    className="mt-3 flex aspect-square max-w-40 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30"
                  >
                    <QrCode className="size-10 text-muted-foreground/40" />
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {pick(l, L.qrPlaceholder)}
                  </p>
                  <p className="mt-2 truncate rounded-md bg-muted px-2 py-1 font-mono text-xs">
                    {pageUrl}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-primary/25 bg-primary/5">
                <CardContent className="flex flex-col justify-start p-5">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <CloudUpload className="size-4 text-primary" aria-hidden="true" />
                    {pick(l, { sl: "Vir: baza (oblak)", en: "Source: database (cloud)" })}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {pick(l, L.cloudNote)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {db.ownerName ? `Lastnik: ${db.ownerName} · ` : ""}
                    {db.isPublic
                      ? pick(l, { sl: "javna povezava", en: "public link" })
                      : pick(l, { sl: "zasebna povezava (samo sodelujoči)", en: "private link (collaborators only)" })}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Zavihek SODELOVANJE ──────────────────────────────────── */}
          <TabsContent value="collab" className="mt-4">
            <TripCollaboration shareId={shareId} initialName={db.name} />
          </TabsContent>

          {/* ── Zavihek REZERVACIJE ──────────────────────────────────── */}
          <TabsContent value="reservations" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {canEdit && (
                <ReservationImportDialog
                  shareId={shareId}
                  plan={plan}
                  onImported={() => setReservationsVersion((v) => v + 1)}
                />
              )}
              <PrintableConfirmation
                shareId={shareId}
                tripName={db.name ?? plan.name ?? ""}
                tripDates={db.tripDates}
                plan={plan}
              />
            </div>
            <TripReservations
              key={reservationsVersion}
              shareId={shareId}
              plan={plan}
              canEdit={canEdit}
            />
          </TabsContent>

          {/* ── Zavihek ANKETE ───────────────────────────────────────── */}
          <TabsContent value="polls" className="mt-4">
            <TripPolls
              shareId={shareId}
              createdAt={db.createdAt}
              canCreate={canEdit}
              canVote={canParticipate}
            />
          </TabsContent>

          {/* ── Zavihek KLEPET ───────────────────────────────────────── */}
          <TabsContent value="chat" className="mt-4">
            <TripChat
              shareId={shareId}
              createdAt={db.createdAt}
              canPost={canParticipate}
              myName={session?.user?.name ?? session?.user?.email ?? null}
            />
          </TabsContent>
        </Tabs>

        {/* Noga PDF izvoza (vidna SAMO ob tiskanju) */}
        <p className="hidden pt-6 text-center text-xs text-muted-foreground print:block">
          {pick(l, L.printFooter)} · {pageUrl}
        </p>
      </div>
    );
  }

  // ── 2+3. NI V BAZI → lokalna pote ali iskreno „ne najdem" ────────────
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Trak vabila tudi tu (zasebna pot + ne sprejet vloga — vabilo vseeno
          živi; sprejem bo odklenil pot). */}
      {inviteToken ? (
        <div className="mb-6">
          <TripInviteBanner
            shareId={shareId}
            inviteToken={inviteToken}
            onAccepted={() => void loadDb()}
          />
        </div>
      ) : null}

      {localPlan === null ? (
        <>
          <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.notFoundTitle)} />
          <p className="mt-4 rounded-lg border border-dashed p-4 text-sm leading-relaxed text-muted-foreground">
            {pick(l, L.notFoundBody)}
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <HardDrive className="size-3.5 text-primary" aria-hidden="true" />
            {pick(l, L.localNote)}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="tap-target font-semibold">
              <Link href="/nacrtuj">
                {pick(l, L.planCta)}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="tap-target font-semibold">
              <Link href="/moja-potovanja">{pick(l, { sl: "Moja potovanja", en: "My trips" })}</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <PageHeader kicker={pick(l, L.kicker)} title={localPlan.name || pick(l, L.nameFallback)}>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                {pick(l, L.daysCount)(localPlan.days.length)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Route className="size-4 text-primary" aria-hidden="true" />
                {pick(l, L.stops)(localPlan.days.reduce((n, d) => n + d.locations.length, 0))}
              </span>
              {typeof localPlan.totalBudget === "number" && (
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="size-4 text-primary" aria-hidden="true" />
                  {pick(l, L.budget)(localPlan.totalBudget)}
                </span>
              )}
              <span className="font-mono text-xs">
                /pot/{shareId} · {pick(l, L.createdAt)}{" "}
                {new Date(localPlan.createdAt).toLocaleDateString(l === "en" ? "en-GB" : "sl-SI")}
              </span>
            </div>
          </PageHeader>

          {/* Iskren pasice: shrani v oblak za sodelovanje v živo (48-a) */}
          <Card className="mt-6 border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <CloudUpload className="size-4 text-primary" aria-hidden="true" />
                  {pick(l, L.cloudTitle)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {pick(l, L.cloudBody)}
                </p>
                {cloudError ? (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    {cloudError}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0">
                {loggedIn ? (
                  <Button
                    onClick={() => void saveToCloud()}
                    disabled={savingCloud}
                    className="min-h-11 gap-1.5 font-semibold"
                  >
                    <CloudUpload className="size-4" aria-hidden="true" />
                    {savingCloud ? pick(l, L.cloudSaving) : pick(l, L.cloudCta)}
                  </Button>
                ) : (
                  <Button asChild className="min-h-11 gap-1.5 font-semibold">
                    <Link
                      href={{
                        pathname: "/prijava",
                        query: { next: `/pot/${shareId}` },
                      }}
                    >
                      {pick(l, L.cloudLogin)}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Akcije (ne tiskajo) */}
          <div className="mt-6 flex flex-wrap gap-3 print:hidden">
            <Button onClick={() => onAddAll(localPlan)} className="tap-target font-semibold">
              <Plus className="size-4" aria-hidden="true" />
              {pick(l, L.addAll)}
            </Button>
            {addedCount > 0 && (
              <Badge variant="secondary" className="self-center">
                {pick(l, L.added)} ({addedCount})
              </Badge>
            )}
            <Button onClick={() => window.print()} variant="outline" className="tap-target font-semibold">
              <Printer className="size-4" aria-hidden="true" />
              {pick(l, L.print)}
            </Button>
            <Button onClick={onCopy} variant="ghost" className="tap-target font-semibold">
              <Share2 className="size-4" aria-hidden="true" />
              {pick(l, L.copy)}
            </Button>
          </div>

          <PlanDays plan={localPlan} shareId={shareId} l={l} addLabel={pick(l, L.addTrip)} addedLabel={pick(l, L.added)} exploreLabel={pick(l, L.exploreDest)} />

          {/* QR placeholder + opomba (ne tiska) */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 print:hidden">
            <Card>
              <CardContent className="p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <QrCode className="size-4 text-primary" aria-hidden="true" />
                  {pick(l, L.qrTitle)}
                </h3>
                <div
                  aria-hidden="true"
                  className="mt-3 flex aspect-square max-w-40 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30"
                >
                  <QrCode className="size-10 text-muted-foreground/40" />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {pick(l, L.qrPlaceholder)}
                </p>
                <p className="mt-2 truncate rounded-md bg-muted px-2 py-1 font-mono text-xs">
                  {pageUrl}
                </p>
              </CardContent>
            </Card>
            <Card className="border-primary/25 bg-primary/5">
              <CardContent className="flex flex-col justify-start p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <HardDrive className="size-4 text-primary" aria-hidden="true" />
                  {pick(l, { sl: "Vir: lokalna shramba", en: "Source: local storage" })}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {pick(l, L.localNote)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Noga PDF izvoza (vidna SAMO ob tiskanju) */}
          <p className="hidden pt-6 text-center text-xs text-muted-foreground print:block">
            {pick(l, L.printFooter)} · {pageUrl}
          </p>
        </>
      )}
    </div>
  );
}

/** Dnevi pote (skupno za oblak in lokalno pot — enak izris kot prej). */
function PlanDays({
  plan,
  shareId,
  l,
  addLabel,
  addedLabel,
  exploreLabel,
}: {
  plan: SharedPlan;
  shareId: string;
  l: string;
  addLabel: string;
  addedLabel: string;
  exploreLabel: string;
}) {
  return (
    <ol className="mt-10 space-y-6">
      {plan.days.map((day) => (
        <li key={day.day}>
          <Card>
            <CardContent className="p-5">
              <h2 className="text-lg font-bold tracking-tight">
                {l === "en" ? `Day ${day.day}` : `Dan ${day.day}`}
                {day.title ? ` — ${day.title}` : ""}
              </h2>
              {day.locations.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {day.locations.map((loc, i) => {
                    const dest = loc.destSlug ? getDestination(loc.destSlug) : undefined;
                    const refId = loc.destSlug ?? `pot/${shareId}/${day.day}/${loc.name}`;
                    return (
                      <li
                        key={`${day.day}-${i}-${loc.name}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-4 py-3"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          {loc.time ? (
                            <span className="inline-flex items-center gap-1 font-mono text-sm text-muted-foreground">
                              <Clock className="size-3.5 text-primary" aria-hidden="true" />
                              {loc.time}
                            </span>
                          ) : null}
                          <span className="truncate text-sm font-medium">{loc.name}</span>
                        </span>
                        <span className="flex items-center gap-1.5 print:hidden">
                          {dest && (
                            <Link
                              href={`/destinacija/${dest.slug}`}
                              className="inline-flex min-h-9 items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 focus-green"
                            >
                              <MapPin className="size-3.5" aria-hidden="true" />
                              {exploreLabel}
                            </Link>
                          )}
                          <AddOne
                            refId={refId}
                            name={loc.name}
                            labels={{ add: addLabel, added: addedLabel }}
                          />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  );
}

/** Gumb za eno lokacijo (lokalna država, da ne resumeje celega seznama). */
function AddOne({
  refId,
  name,
  labels,
}: {
  refId: string;
  name: string;
  labels: { add: string; added: string };
}) {
  const [added, setAdded] = React.useState(false);
  React.useEffect(() => {
    const refresh = () => setAdded(myTrip.has(refId));
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [refId]);

  return (
    <button
      type="button"
      aria-pressed={added}
      onClick={() => {
        const res = myTrip.add(refId, name, "destination");
        if (res.ok || res.already) setAdded(true);
      }}
      className={`inline-flex min-h-9 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold transition-colors focus-green ${
        added ? "border-primary/30 bg-primary/10 text-primary" : "hover:bg-accent"
      }`}
    >
      <Plus className="size-3.5" aria-hidden="true" />
      {added ? labels.added : labels.add}
    </button>
  );
}
