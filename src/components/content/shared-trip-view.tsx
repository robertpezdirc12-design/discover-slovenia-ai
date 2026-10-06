"use client";

import {
  ArrowRight,
  CalendarDays,
  Clock,
  HardDrive,
  MapPin,
  Plus,
  Printer,
  QrCode,
  Route,
  Share2,
  Wallet,
} from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { myTrip } from "@/lib/my-trip";
import { getDestination } from "@/lib/slovenia-data";
import { type SharedPlan, sharedPlans } from "@/lib/shared-plan";

/**
 * /pot/[shareId] — deljena pot (poenostavljena rekonstrukcija izvirnikove
 * strani D7): dnevi z lokacijami, „Dodaj v mojo pot", tisk (window.print)
 * in QR placeholder. Vir: localStorage (dai:shared-plans) — iskreno
 * označeno; brez izmišljenih URL-jev in stanj.
 */
export function SharedTripView({ shareId }: { shareId: string }) {
  const l = useLocale();
  const [plan, setPlan] = React.useState<SharedPlan | null | undefined>(undefined); // undefined = nalagam
  const [pageUrl, setPageUrl] = React.useState("");
  const [addedCount, setAddedCount] = React.useState(0);

  React.useEffect(() => {
    setPlan(sharedPlans.get(shareId) ?? null);
    setPageUrl(window.location.href);
  }, [shareId]);

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
      sl: "Deljene pote v tej rekonstrukciji živijo v lokalni shrambi brskalnika (localStorage) — povezava deluje na napravi, kjer je bila ustvarjena. Če ti je nekdo poslal to povezavo, prosi za nov izvoz (natis ali besedilni načrt).",
      en: "Shared trips in this reconstruction live in the browser's local storage (localStorage) — the link works on the device where it was created. If someone sent you this link, ask them for a new export (print or a text plan).",
    },
    planCta: { sl: "Sestavi svoj načrt", en: "Build your own plan" },
    localNote: {
      sl: "Rekonstrukcija: izvirnik hrani deljene pote v bazi z javnimi povezavami; tukaj je vir lokalna shramba (iskrenost — brez baze v tej fazi).",
      en: "Reconstruction: the original stores shared trips in a database with public links; here the source is local storage (honest — no database in this phase).",
    },
    exploreDest: { sl: "Odpri destinacijo", en: "Open destination" },
    createdAt: { sl: "Ustvarjeno", en: "Created" },
  } as const;

  const onAddAll = React.useCallback(() => {
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
  }, [plan, shareId]);

  const onCopy = React.useCallback(() => {
    if (!pageUrl) return;
    void navigator.clipboard?.writeText(pageUrl).catch(() => undefined);
  }, [pageUrl]);

  // Nalaganje (prvi klic ni šel skozi localStorage)
  if (plan === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p role="status" className="text-sm text-muted-foreground">
          {pick(l, L.loading)}
        </p>
      </div>
    );
  }

  // Ni na tej napravi — iskreno stanje (izvirnik: 404)
  if (plan === null) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
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
      </div>
    );
  }

  const totalStops = plan.days.reduce((n, d) => n + d.locations.length, 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Glava pote */}
      <PageHeader kicker={pick(l, L.kicker)} title={plan.name || pick(l, L.nameFallback)}>
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
          <span className="font-mono text-xs">
            /pot/{shareId} · {pick(l, L.createdAt)} {new Date(plan.createdAt).toLocaleDateString(l === "en" ? "en-GB" : "sl-SI")}
          </span>
        </div>
      </PageHeader>

      {/* Akcije (ne tiskajo) */}
      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        <Button onClick={onAddAll} className="tap-target font-semibold">
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

      {/* Dnevi */}
      <ol className="mt-10 space-y-6">
        {plan.days.map((day) => (
          <li key={day.day}>
            <Card>
              <CardContent className="p-5">
                <h2 className="text-lg font-bold tracking-tight">
                  {pick(l, L.dayLabel)(day.day)}
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
                                {pick(l, L.exploreDest)}
                              </Link>
                            )}
                            <AddOne
                              refId={refId}
                              name={loc.name}
                              labels={{ add: pick(l, L.addTrip), added: pick(l, L.added) }}
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
    </div>
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
