"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CloudUpload,
  HardDrive,
  Loader2,
  LogOut,
  Search,
  ShieldCheck,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useLocale } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { sharedPlans } from "@/lib/shared-plan";

/**
 * POTI V OBLAKU — sekcecija huba /moja-potovanja (48-a): poti prijavljenega
 * uporabnika v bazi (iskanje po shareId + odpiranje) + iskren uvoz lokalnih
 * „deljenih poti" (localStorage → POST /api/trips).
 *
 * Gost brez prijave → sekcecija se NE izriše (ostane obstoječa iskrena
 * kartica o lokalnem shranjevanju na tej napravi).
 */

interface CloudTrip {
  shareId: string;
  title: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  dayCount: number;
  stopCount: number;
  collaboratorCount: number;
}

const L = {
  heading: { sl: "Poti v oblaku", en: "Trips in the cloud" },
  lead: {
    sl: "Pote, shranjene s tvojim računom — sodelovanje, ankete, rezervacije in klepet z @AI delujejo v živo.",
    en: "Trips saved with your account — collaboration, polls, reservations and the @AI chat work live.",
  },
  signIn: { sl: "Prijavi se", en: "Sign in" },
  signOut: { sl: "Odjavi se", en: "Sign out" },
  hello: { sl: "Pozdravljeni,", en: "Welcome," },
  searchLabel: { sl: "Išči po shareID ali imenu", en: "Search by shareId or name" },
  public: { sl: "javna povezava", en: "public link" },
  private: { sl: "zasebna", en: "private" },
  open: { sl: "Odpri", en: "Open" },
  days: {
    sl: (n: number) => `${n} ${n === 1 ? "dan" : n === 2 ? "dneva" : "dni"}`,
    en: (n: number) => `${n} ${n === 1 ? "day" : "days"}`,
  },
  stops: {
    sl: (n: number) => `${n} ${n === 1 ? "postanek" : n === 2 ? "postanka" : "postankov"}`,
    en: (n: number) => `${n} stops`,
  },
  collaborators: { sl: "sodelujoči", en: "collaborators" },
  savedAt: { sl: "posodobljeno", en: "updated" },
  empty: {
    sl: "V oblaku še ni poti — shrani jih s stranju poti (gumb Shrani v oblak).",
    en: "No cloud trips yet — save them from a trip page (the Save to cloud button).",
  },
  importLocal: { sl: "Naloži lokalne pote v oblak", en: "Upload local trips to the cloud" },
  importing: { sl: "Nalagam …", en: "Uploading …" },
  importDone: {
    sl: (n: number) => `V oblak naloženih poti: ${n}.`,
    en: (n: number) => `Trips uploaded to the cloud: ${n}.`,
  },
  importNone: {
    sl: "Na tej napravi ni novih lokalnih poti za nalaganje.",
    en: "No new local trips on this device to upload.",
  },
  importError: { sl: "Nalaganje ni uspelo", en: "Upload failed" },
} as const;

export function CloudTripsSection() {
  const { data: session, status } = useSession();
  const l = useLocale();
  const { toast } = useToast();

  const [trips, setTrips] = useState<CloudTrip[] | null>(null);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [localPlans, setLocalPlans] = useState<{ shareId: string; name: string | null }[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/trips", { cache: "no-store" });
      if (!r.ok) {
        setTrips([]);
        return;
      }
      const data = (await r.json()) as { trips?: CloudTrip[] };
      setTrips(data.trips ?? []);
    } catch {
      setTrips([]);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  // Lokalne deljene pote (iskren uvoz: samo tiste, ki jih v oblaku še ni)
  useEffect(() => {
    if (status !== "authenticated") return;
    const all = sharedPlans.list();
    setLocalPlans(all.map((p) => ({ shareId: p.shareId, name: p.name })));
  }, [status]);

  const importLocal = useCallback(async () => {
    if (importing) return;
    const all = sharedPlans.list();
    const cloudIds = new Set((trips ?? []).map((t) => t.shareId));
    const toUpload = all.filter((p) => !cloudIds.has(p.shareId));
    if (toUpload.length === 0) {
      toast({ title: pick(l, L.importNone) });
      return;
    }
    setImporting(true);
    let ok = 0;
    try {
      for (const plan of toUpload) {
        const r = await fetch("/api/trips", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan, shareId: plan.shareId, title: plan.name }),
        });
        if (r.ok) ok += 1;
      }
      await load();
      toast({ title: pick(l, L.importDone)(ok) });
    } catch {
      toast({ title: pick(l, L.importError), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }, [importing, trips, l, toast, load]);

  if (status !== "authenticated") return null;

  const user = session?.user;
  const filtered = (trips ?? []).filter((t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.shareId.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q)
    );
  });
  const uploadable =
    localPlans.filter((p) => !(trips ?? []).some((t) => t.shareId === p.shareId)).length;

  return (
    <section className="mt-10" aria-labelledby="poti-v-oblaku">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="poti-v-oblaku" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <CloudUpload className="size-5 text-primary" aria-hidden="true" />
          {pick(l, L.heading)}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {pick(l, L.hello)} <strong>{user?.name ?? user?.email}</strong>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5"
            onClick={() => void signOut({ callbackUrl: "/" })}
          >
            <LogOut className="size-4" aria-hidden="true" />
            {pick(l, L.signOut)}
          </Button>
        </div>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{pick(l, L.lead)}</p>

      {/* Iskanje + uvoz */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={pick(l, L.searchLabel)}
            aria-label={pick(l, L.searchLabel)}
            maxLength={80}
          />
        </div>
        {uploadable > 0 ? (
          <Button
            variant="outline"
            className="min-h-11 gap-1.5"
            onClick={() => void importLocal()}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CloudUpload className="size-4" aria-hidden="true" />
            )}
            {importing ? pick(l, L.importing) : pick(l, L.importLocal)}
          </Button>
        ) : null}
      </div>

      {/* Seznam */}
      {trips === null ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          {pick(l, { sl: "Nalagam pote v oblaku …", en: "Loading cloud trips …" })}
        </p>
      ) : filtered.length === 0 ? (
        <Card className="mt-4 border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <CloudUpload className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{pick(l, L.empty)}</p>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/potovanje">{pick(l, { sl: "Načrtuj potovanje", en: "Plan a trip" })}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {filtered.map((trip) => (
            <li key={trip.shareId}>
              <Card className="h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-semibold">{trip.title}</p>
                    <Badge
                      variant="outline"
                      className={
                        trip.isPublic
                          ? "gap-1 border-emerald-500/50 text-emerald-700 dark:text-emerald-300"
                          : "gap-1 text-muted-foreground"
                      }
                    >
                      {trip.isPublic ? (
                        <ShieldCheck className="size-3" aria-hidden="true" />
                      ) : (
                        <HardDrive className="size-3" aria-hidden="true" />
                      )}
                      {trip.isPublic ? pick(l, L.public) : pick(l, L.private)}
                    </Badge>
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{L.days[l === "en" ? "en" : "sl"](trip.dayCount)}</span>
                    <span>{L.stops[l === "en" ? "en" : "sl"](trip.stopCount)}</span>
                    {trip.collaboratorCount > 0 ? (
                      <span>
                        {trip.collaboratorCount} × {pick(l, L.collaborators)}
                      </span>
                    ) : null}
                    <span className="font-mono">/pot/{trip.shareId}</span>
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {pick(l, L.savedAt)}:{" "}
                      {new Date(trip.updatedAt).toLocaleDateString(
                        l === "en" ? "en-GB" : "sl-SI"
                      )}
                    </span>
                    <Button asChild size="sm" className="min-h-11 gap-1.5">
                      <Link href={`/pot/${trip.shareId}`}>
                        {pick(l, L.open)}
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
