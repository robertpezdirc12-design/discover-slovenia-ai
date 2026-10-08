"use client";

/**
 * /notifikacije — P1-C (issue #3 §10 + §4): NOTIFIKACIJSKI CENTER.
 * ============================================================================
 *  - obvestila (in-app inbox): vir, resnost, čas, prebrano/neprebrano,
 *    označi (eno/vse) prebrano, počisti (prebrana/vse);
 *  - spremljanja (watch): seznam z vrsto, ciljem, stanjem (aktivno/pavza),
 *    zadnjim preverjanjem, pauza/nadaljuj, izbriši (AlertDialog);
 *  - ISKRENOST: PWA push NI implementiran (brez lažnih obljub — plast je
 *    in-app inbox, zvonček v glavi osvežuje vsako minuto); preverjanja tečejo
 *    z zavoro vsaki 2 uri (cron) — opozorila so deterministična (0-AI);
 *  - zasebnost (§11): vse poizvedbe so vezane na sejo — tuji računi niso
 *    dosegljivi (IDOR 404 strežniško).
 */

import {
  Bell,
  BellOff,
  CalendarCheck,
  CloudRain,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  PartyPopper,
  Pause,
  Play,
  ShoppingCart,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import React, { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

// ── Slovar (SL privzet, EN prek locale — ostali iskreno na SL kanonu) ──────

const L = {
  kicker: { sl: "Obvestila", en: "Notifications" },
  title: { sl: "Notifikacijski center", en: "Notification center" },
  lead: {
    sl: "Opozorila tvojih spremljanj in spremembe na tvojih potovanjih — vse na enem mestu, samo za tvoj račun.",
    en: "Alerts from your watches and changes on your trips — in one place, for your account only.",
  },
  signInNeeded: { sl: "Za obvestila se prijavi", en: "Sign in for notifications" },
  signInLead: {
    sl: "Obvestila in spremljanja so vezana na tvoj račun — sledijo ti, ne napravi.",
    en: "Notifications and watches belong to your account — they follow you, not the device.",
  },
  signInCta: { sl: "Pojdi na prijavo", en: "Go to sign in" },
  loading: { sl: "Nalaganje …", en: "Loading …" },
  loadError: { sl: "Nalaganje ni uspelo.", en: "Failed to load." },
  retry: { sl: "Poskusi znova", en: "Try again" },
  cancel: { sl: "Prekliči", en: "Cancel" },

  // obvestila
  inboxTitle: { sl: "Obvestila", en: "Inbox" },
  inboxDesc: {
    sl: "Največ 100 najnovejših. Neprebrana so poudarjena.",
    en: "Up to 100 latest. Unread entries are highlighted.",
  },
  markAllRead: { sl: "Označi vse prebrano", en: "Mark all read" },
  clearRead: { sl: "Počisti prebrana", en: "Clear read" },
  clearAll: { sl: "Počisti vse", en: "Clear all" },
  empty: {
    sl: "Ni obvestil — ko se kaj zgodi, se pokažejo tu.",
    en: "No notifications yet — they will appear here.",
  },
  unread: { sl: "neprebranih", en: "unread" },
  markRead: { sl: "Označi prebrano", en: "Mark read" },
  clearConfirmTitle: { sl: "Počistim vsa obvestila?", en: "Clear all notifications?" },
  clearConfirmDesc: {
    sl: "Vsa obvestila (prebrana in neprebrana) se trajno izbrišejo. Dejanja ni mogoče razveljaviti.",
    en: "All notifications (read and unread) are permanently deleted. This cannot be undone.",
  },
  clearConfirmCta: { sl: "Da, počisti", en: "Yes, clear" },

  // spremljanja
  watchTitle: { sl: "Spremljanja", en: "Watches" },
  watchDesc: {
    sl: "Stvari, ki jih opazujejo deterministična pravila (0-AI): cena izdelka, vreme na poti, dnevi do poti, rezervacije pred odhodom. Opozorilo nastane samo iz preverljivih podatkov.",
    en: "Things watched by deterministic rules (0-AI): product price, trip weather, trip countdown, bookings before departure. Alerts only come from verifiable data.",
  },
  watchEmpty: {
    sl: "Ni spremljanj. Dodaj jih tam, kjer si: gumb »Spremljaj ceno« na tržnici ali »Spremljaj« na svoji poti.",
    en: "No watches yet. Add them where you are: “Watch price” in the marketplace or “Watch” on your trip.",
  },
  active: { sl: "Aktivno", en: "Active" },
  paused: { sl: "V pavzi", en: "Paused" },
  pause: { sl: "Zaustavi", en: "Pause" },
  resume: { sl: "Nadaljuj", en: "Resume" },
  delete: { sl: "Izbriši", en: "Delete" },
  watchDeleteTitle: { sl: "Izbrišem spremljanje?", en: "Delete this watch?" },
  watchDeleteDesc: {
    sl: "Spremljanje se trajno izbriše (v dnevniku dejanj ostane zapis o izbrisu).",
    en: "The watch is permanently deleted (an audit record of the deletion remains).",
  },
  lastChecked: { sl: "Zadnje preverjanje", en: "Last checked" },
  lastTriggered: { sl: "Zadnje opozorilo", en: "Last alert" },
  never: { sl: "še ne", en: "not yet" },
  priceKind: { sl: "Cena izdelka", en: "Product price" },
  weatherKind: { sl: "Vreme na poti", en: "Trip weather" },
  tripDayKind: { sl: "Dnevi do poti", en: "Trip countdown" },
  bookingKind: { sl: "Rezervacije pred potjo", en: "Bookings before trip" },

  // iskrenost
  honestyTitle: { sl: "Kako deluje (iskreno)", en: "How it works (honestly)" },
  honesty1: {
    sl: "Preverjanja tečejo samodejno približno vsaki 2 uri (cron). Opozorila so čista pravila — 0 AI modelov, 0 ugibanj.",
    en: "Checks run automatically about every 2 hours (cron). Alerts are pure rules — 0 AI models, 0 guessing.",
  },
  honesty2: {
    sl: "PWA potisk NI implementiran — obvestila so in-app (zvonček v glavi se osvežuje vsako minuto). Nikoli ne pošiljamo tvojih podatkov tretjim osebam.",
    en: "PWA push is NOT implemented — notifications are in-app (the header bell refreshes every minute). We never send your data to third parties.",
  },
  honesty3: {
    sl: "Razpoložljivosti lokalk in sprememb letov NE spremljamo — vira tega ne potrjujeta prek naše plasti, zato odklanjamo namesto da bi izmišljevali.",
    en: "Restaurant availability and flight changes are NOT watched — the sources do not confirm them through our layer, so we refuse instead of inventing.",
  },
  auditNote: {
    sl: "Revizija: vsako dejanje (dodaj/pavza/izbris/opozorilo) se zapiše v dnevnik — append-only, brez skrivnosti v zapisih.",
    en: "Audit: every action (add/pause/delete/alert) is written to an append-only log — no secrets in the records.",
  },
} as const;

type Dict = typeof L;

// ── Tipi (odgovori API-jev) ─────────────────────────────────────────────────

interface NotificationDto {
  id: string;
  source: string;
  severity: string;
  title: string;
  body: string;
  data: string;
  readAt: string | null;
  dedupeKey: string;
  createdAt: string;
}

interface WatchDto {
  id: string;
  kind: string;
  targetKind: string;
  targetId: string;
  targetName: string;
  condition: string;
  state: string;
  lastObservation: string | null;
  lastCheckedAt: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
}

// ── Stran ───────────────────────────────────────────────────────────────────

export default function NotifikacijePage() {
  const locale = useLocale();
  const t = useCallback(
    <K extends keyof Dict>(key: K): string => pick(locale, L[key]),
    [locale]
  );
  const { status } = useSession();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <PageHeader kicker={t("kicker")} title={t("title")} lead={t("lead")} />

      <div className="mt-8">
        {status === "loading" ? (
          <CenterSkeleton />
        ) : status === "unauthenticated" ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-4 p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="h-5 w-5" aria-hidden="true" />
                <p className="font-medium">{t("signInNeeded")}</p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("signInLead")}
              </p>
              <Button asChild>
                <Link href="/prijava">{t("signInCta")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <NotificationCenter />
        )}
      </div>
    </main>
  );
}

function CenterSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

// ── Center (prijavljeni) ────────────────────────────────────────────────────

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  info: <Info className="size-4 text-primary" aria-hidden="true" />,
  warning: (
    <TriangleAlert className="size-4 text-amber-600" aria-hidden="true" />
  ),
  success: (
    <PartyPopper className="size-4 text-emerald-600" aria-hidden="true" />
  ),
};

const KIND_ICON: Record<string, React.ReactNode> = {
  price: <ShoppingCart className="size-4 text-primary" aria-hidden="true" />,
  weather: <CloudRain className="size-4 text-primary" aria-hidden="true" />,
  trip_day: <CalendarCheck className="size-4 text-primary" aria-hidden="true" />,
  booking: <CalendarCheck className="size-4 text-primary" aria-hidden="true" />,
};

const KIND_LABELS: Record<string, { sl: string; en: string }> = {
  price: L.priceKind,
  weather: L.weatherKind,
  trip_day: L.tripDayKind,
  booking: L.bookingKind,
};

function NotificationCenter() {
  const locale = useLocale();
  const { toast } = useToast();
  const t = useCallback(
    <K extends keyof Dict>(key: K): string => pick(locale, L[key]),
    [locale]
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [watches, setWatches] = useState<WatchDto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [notifRes, watchRes] = await Promise.all([
        fetch("/api/notifications"),
        fetch("/api/watch"),
      ]);
      if (!notifRes.ok || !watchRes.ok) throw new Error("load failed");
      const notifData = (await notifRes.json()) as {
        notifications: NotificationDto[];
        unreadCount: number;
      };
      const watchData = (await watchRes.json()) as { watches: WatchDto[] };
      setNotifications(notifData.notifications);
      setUnreadCount(notifData.unreadCount);
      setWatches(watchData.watches);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fmtDate = useCallback(
    (iso: string) => {
      const d = new Date(iso);
      return d.toLocaleString(locale === "en" ? "en-GB" : "sl-SI", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    [locale]
  );

  const markRead = useCallback(
    async (id: string) => {
      setBusy(`notif:${id}`);
      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error();
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, readAt: new Date().toISOString() } : n
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        toast({ title: t("loadError"), variant: "destructive" });
      } finally {
        setBusy(null);
      }
    },
    [t, toast]
  );

  const markAllRead = useCallback(async () => {
    setBusy("notif:all");
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      toast({ title: t("loadError"), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }, [t, toast]);

  const clearNotifications = useCallback(
    async (scope: "read" | "all") => {
      setBusy(`notif:clear:${scope}`);
      try {
        const res = await fetch(
          scope === "read" ? "/api/notifications?read=1" : "/api/notifications",
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error();
        await load();
      } catch {
        toast({ title: t("loadError"), variant: "destructive" });
      } finally {
        setBusy(null);
      }
    },
    [load, t, toast]
  );

  const toggleWatch = useCallback(
    async (w: WatchDto, nextState: "active" | "paused") => {
      setBusy(`watch:${w.id}`);
      try {
        const res = await fetch(`/api/watch/${encodeURIComponent(w.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: nextState }),
        });
        if (!res.ok) throw new Error();
        setWatches((prev) =>
          prev.map((x) => (x.id === w.id ? { ...x, state: nextState } : x))
        );
      } catch {
        toast({ title: t("loadError"), variant: "destructive" });
      } finally {
        setBusy(null);
      }
    },
    [t, toast]
  );

  const deleteWatch = useCallback(
    async (id: string) => {
      setBusy(`watch:del:${id}`);
      try {
        const res = await fetch(`/api/watch/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error();
        setWatches((prev) => prev.filter((w) => w.id !== id));
      } catch {
        toast({ title: t("loadError"), variant: "destructive" });
      } finally {
        setBusy(null);
      }
    },
    [t, toast]
  );

  if (loading) return <CenterSkeleton />;

  if (loadError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6">
          <p className="font-medium text-destructive" role="alert">
            {t("loadError")}
          </p>
          <Button variant="outline" className="h-11" onClick={() => void load()}>
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const kindLabel = (kind: string) =>
    pick(locale, KIND_LABELS[kind] ?? { sl: kind, en: kind });

  const hasRead = notifications.some((n) => n.readAt !== null);

  return (
    <div className="space-y-6">
      {/* ── INBOX ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Bell className="size-5 text-primary" aria-hidden="true" />
                {t("inboxTitle")}
                {unreadCount > 0 && (
                  <Badge className="bg-primary text-primary-foreground">
                    {unreadCount} {t("unread")}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1.5">
                {t("inboxDesc")}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-10"
                onClick={() => void markAllRead()}
                disabled={unreadCount === 0 || busy === "notif:all"}
              >
                {busy === "notif:all" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
                {t("markAllRead")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-10"
                onClick={() => void clearNotifications("read")}
                disabled={!hasRead || busy === "notif:clear:read"}
              >
                <EyeOff className="size-4" aria-hidden="true" />
                {t("clearRead")}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 text-destructive hover:text-destructive"
                    disabled={notifications.length === 0}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t("clearAll")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("clearConfirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("clearConfirmDesc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void clearNotifications("all")}
                    >
                      {t("clearConfirmCta")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <ul className="max-h-96 list-none space-y-2 overflow-y-auto pr-1">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={
                    "rounded-lg border p-3.5 transition-colors " +
                    (n.readAt === null
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-background")
                  }
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0" aria-hidden="true">
                      {SEVERITY_ICON[n.severity] ?? SEVERITY_ICON.info}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          "text-sm leading-snug " +
                          (n.readAt === null ? "font-bold" : "font-medium")
                        }
                      >
                        {n.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {n.body}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {fmtDate(n.createdAt)} · {n.dedupeKey.split(":")[0]}
                      </p>
                    </div>
                    {n.readAt === null && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 shrink-0"
                        onClick={() => void markRead(n.id)}
                        disabled={busy === `notif:${n.id}`}
                        aria-label={t("markRead")}
                      >
                        {busy === `notif:${n.id}` ? (
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Eye className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── SPREMLJANJA ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="size-5 text-primary" aria-hidden="true" />
            {t("watchTitle")}
          </CardTitle>
          <CardDescription className="mt-1.5 max-w-2xl leading-relaxed">
            {t("watchDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {watches.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("watchEmpty")}
            </p>
          ) : (
            <ul className="max-h-96 list-none space-y-2 overflow-y-auto pr-1">
              {watches.map((w) => (
                <li
                  key={w.id}
                  className="rounded-lg border border-border bg-background p-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                        <span aria-hidden="true">
                          {KIND_ICON[w.kind] ?? KIND_ICON.booking}
                        </span>
                        {kindLabel(w.kind)}: {w.targetName}
                        <Badge
                          variant={w.state === "active" ? "default" : "secondary"}
                        >
                          {w.state === "active" ? t("active") : t("paused")}
                        </Badge>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("lastChecked")}:{" "}
                        {w.lastCheckedAt ? fmtDate(w.lastCheckedAt) : t("never")}
                        {w.lastTriggeredAt
                          ? ` · ${t("lastTriggered")}: ${fmtDate(w.lastTriggeredAt)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9"
                        onClick={() =>
                          void toggleWatch(
                            w,
                            w.state === "active" ? "paused" : "active"
                          )
                        }
                        disabled={busy === `watch:${w.id}`}
                      >
                        {busy === `watch:${w.id}` ? (
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : w.state === "active" ? (
                          <Pause className="size-4" aria-hidden="true" />
                        ) : (
                          <Play className="size-4" aria-hidden="true" />
                        )}
                        {w.state === "active" ? t("pause") : t("resume")}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 text-destructive hover:text-destructive"
                            disabled={busy === `watch:del:${w.id}`}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                            <span className="sr-only sm:not-sr-only">
                              {t("delete")}
                            </span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("watchDeleteTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("watchDeleteDesc")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t("cancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => void deleteWatch(w.id)}
                            >
                              {t("delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── ISKRENOST ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="size-5 text-primary" aria-hidden="true" />
            {t("honestyTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
          <p>· {t("honesty1")}</p>
          <p>· {t("honesty2")}</p>
          <p>· {t("honesty3")}</p>
          <Separator className="my-2" />
          <p className="text-xs">{t("auditNote")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
