"use client";

/**
 * /owner/izplacila — SKRBNIŠKA nadzorna plošča "Izplačila lastne tržnice"
 * (P0-E, issue #1 §11 „marketplace payout + customer state").
 *
 * Življenjski cikel izplačila: not_due → due (izpeljava: plačano + 7 dni
 * zadrževalne dobe) → processing → paid (skrbniški dejanji z AuditLog).
 * Zahtevki kupca po preklicu so VIDNI (povratek teče pri plačilnem
 * ponudniku — zahtevek sam ni povratek).
 *
 * Dostop varuje DSA_ADMIN_EMAILS na API-ju (fail-closed): brez nastavitve
 * ali brez prijave plošča iskreno pove, da je dostop omejen na skrbnike
 * (isti vzorec kot /owner/provizije).
 */

import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pick } from "@/lib/i18n-pick";
import { payoutStatusLabel, type PayoutStatus } from "@/lib/marketplace-types";

const L = {
  kicker: { sl: "Za ponudnike", en: "For providers" },
  title: { sl: "Izplačila lastne tržnice", en: "Own marketplace payouts" },
  lead: {
    sl: "Življenjski cikel izplačil naročil: še ne zapadlo → zapadlo (7 dni po plačilu, izpeljava) → v teku → izplačano. Vsak prehod je zapisan v revizijski dnevnik.",
    en: "Order payout lifecycle: not yet due → due (7 days after payment, derived) → processing → paid. Every transition is written to the audit log.",
  },
  forbidden: {
    sl: "Dostop omejen na skrbnike (DSA_ADMIN_EMAILS). Prijavi se z dovoljenim računom.",
    en: "Access restricted to administrators (DSA_ADMIN_EMAILS). Sign in with an allowed account.",
  },
  loading: { sl: "Nalagam izplačila …", en: "Loading payouts …" },
  errGeneric: { sl: "Nalaganje ni uspelo.", en: "Loading failed." },
  refresh: { sl: "Osveži", en: "Refresh" },
  totals: { sl: "Seštevki (plačana naročila)", en: "Totals (paid orders)" },
  orders: { sl: "Naročila", en: "Orders" },
  empty: {
    sl: "Ni še nobenih naročil — ko kupec kaj kupi, se bodo pojavila tukaj.",
    en: "No orders yet — when a customer buys something, they will appear here.",
  },
  demo: { sl: "DEMO", en: "DEMO" },
  paidAt: { sl: "Plačano", en: "Paid" },
  dueAt: { sl: "Zapade", en: "Due" },
  startProcessing: { sl: "Začni izplačilo", en: "Start payout" },
  markPaid: { sl: "Označi izplačano", en: "Mark paid" },
  cancellation: {
    sl: "Zahtevek kupca po preklicu — obravnavaj pri plačilnem ponudniku (povratek NE steče sam).",
    en: "Customer cancellation request — handle at the payment provider (refund does NOT happen automatically).",
  },
  audit: { sl: "Revizijski dnevnik (zadnjih dejanj)", en: "Audit log (recent actions)" },
  auditEmpty: { sl: "Ni še zabeleženih dejanj.", en: "No actions recorded yet." },
  errAction: { sl: "Dejanje ni uspelo.", en: "Action failed." },
} as const;

interface PayoutRow {
  id: string;
  status: string;
  demo: boolean;
  totalCents: number;
  paidAt: string | null;
  storedPayout: PayoutStatus;
  effectivePayout: PayoutStatus;
  payoutDueAt: string | null;
  cancellationRequestedAt: string | null;
  createdAt: string;
  items: { name: string; qty: number; priceCents: number }[];
}

interface PayoutsDto {
  orders: PayoutRow[];
  totals: Record<PayoutStatus, { count: number; cents: number }>;
  cancellationRequests: number;
  audit: {
    id: string;
    actorType: string;
    actorId: string | null;
    action: string;
    entityId: string;
    meta: string;
    createdAt: string;
  }[];
}

const PAYOUT_BADGE: Record<PayoutStatus, string> = {
  not_due: "border-muted-foreground/30 bg-muted text-muted-foreground",
  due: "border-amber-600/50 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  processing: "border-primary/40 bg-primary/10 text-primary",
  paid: "border-emerald-600/50 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
};

function eur(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

export default function OwnerPayoutsPage() {
  const l = useLocale();
  const lang: "sl" | "en" = l === "en" ? "en" : "sl";
  const [data, setData] = React.useState<PayoutsDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [forbidden, setForbidden] = React.useState(false);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [actionErr, setActionErr] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (opts?: { initial?: boolean }) => {
      if (opts?.initial) setLoading(true);
      else setRefreshing(true);
      setLoadErr(null);
      try {
        const r = await fetch("/api/marketplace/payouts", { cache: "no-store" });
        if (r.status === 403) {
          setForbidden(true);
          return;
        }
        setForbidden(false);
        if (!r.ok) {
          setLoadErr(pick(l, L.errGeneric));
          return;
        }
        const dto = (await r.json()) as PayoutsDto;
        setData(dto);
      } catch {
        setLoadErr(pick(l, L.errGeneric));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [l]
  );

  React.useEffect(() => {
    void load({ initial: true });
  }, [load]);

  const act = async (orderId: string, action: "start_processing" | "mark_paid") => {
    setActionErr(null);
    setBusyId(orderId);
    try {
      const r = await fetch("/api/marketplace/payouts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => null)) as { error?: string } | null;
        setActionErr(d?.error ?? pick(l, L.errAction));
        return;
      }
      await load();
    } catch {
      setActionErr(pick(l, L.errAction));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)} />

      <div className="mt-6">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {pick(l, L.loading)}
          </p>
        ) : forbidden ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 p-6">
              <p className="flex items-center gap-2 font-semibold">
                <Lock className="size-5 text-amber-600" aria-hidden="true" />
                {pick(l, L.forbidden)}
              </p>
            </CardContent>
          </Card>
        ) : loadErr ? (
          <div className="flex items-center gap-3">
            <p role="alert" className="text-sm text-destructive">
              {loadErr}
            </p>
            <Button onClick={() => void load()} variant="outline" className="tap-target h-11">
              <RefreshCw className="size-4" aria-hidden="true" /> {pick(l, L.refresh)}
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Seštevki */}
            <Card>
              <CardContent className="p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <Wallet className="size-4 text-primary" aria-hidden="true" />
                  {pick(l, L.totals)}
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(Object.keys(data.totals) as PayoutStatus[]).map((s) => (
                    <div key={s} className="rounded-lg border p-3">
                      <Badge variant="outline" className={`border ${PAYOUT_BADGE[s]}`}>
                        {payoutStatusLabel(s, lang)}
                      </Badge>
                      <p className="mt-2 text-lg font-bold">{eur(data.totals[s].cents)}</p>
                      <p className="text-xs text-muted-foreground">{data.totals[s].count}×</p>
                    </div>
                  ))}
                </div>
                {data.cancellationRequests > 0 && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {pick(l, L.cancellation)} ({data.cancellationRequests}×)
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Naročila */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-bold">
                    <Banknote className="size-4 text-primary" aria-hidden="true" />
                    {pick(l, L.orders)}
                  </h2>
                  <Button
                    onClick={() => void load()}
                    variant="ghost"
                    className="tap-target h-11"
                    disabled={refreshing}
                  >
                    {refreshing ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="size-4" aria-hidden="true" />
                    )}
                    {pick(l, L.refresh)}
                  </Button>
                </div>

                {data.orders.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    {pick(l, L.empty)}
                  </p>
                ) : (
                  <ul className="mt-4 max-h-96 space-y-3 overflow-y-auto scrollbar-slim">
                    {data.orders.map((o) => (
                      <li key={o.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {o.id.slice(0, 12)}…
                          </span>
                          {o.demo && (
                            <Badge
                              variant="outline"
                              className="border-amber-600/50 bg-amber-600/10 text-amber-700 dark:text-amber-400"
                            >
                              {pick(l, L.demo)}
                            </Badge>
                          )}
                          <Badge variant="outline" className={`border ${PAYOUT_BADGE[o.effectivePayout]}`}>
                            {payoutStatusLabel(o.effectivePayout, lang)}
                          </Badge>
                          <span className="ml-auto font-bold">{eur(o.totalCents)}</span>
                        </div>
                        <p className="mt-1 text-sm">{o.items.map((i) => `${i.qty}× ${i.name}`).join(" · ")}</p>
                        <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          {o.paidAt && (
                            <span>
                              <Clock className="mr-1 inline size-3" aria-hidden="true" />
                              {pick(l, L.paidAt)}: {new Date(o.paidAt).toLocaleDateString(lang === "en" ? "en-GB" : "sl-SI")}
                            </span>
                          )}
                          {o.payoutDueAt && (
                            <span>
                              {pick(l, L.dueAt)}: {new Date(o.payoutDueAt).toLocaleDateString(lang === "en" ? "en-GB" : "sl-SI")}
                            </span>
                          )}
                        </p>
                        {o.cancellationRequestedAt && (
                          <p className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                            {pick(l, L.cancellation)}
                          </p>
                        )}
                        {o.status === "paid" && (o.effectivePayout === "due" || o.effectivePayout === "processing") && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {o.effectivePayout === "due" && (
                              <Button
                                onClick={() => void act(o.id, "start_processing")}
                                disabled={busyId === o.id}
                                className="tap-target h-9 text-xs font-semibold"
                              >
                                {busyId === o.id ? (
                                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                ) : null}
                                {pick(l, L.startProcessing)}
                              </Button>
                            )}
                            <Button
                              onClick={() => void act(o.id, "mark_paid")}
                              disabled={busyId === o.id}
                              variant="outline"
                              className="tap-target h-9 text-xs font-semibold"
                            >
                              <CheckCircle2 className="size-3.5" aria-hidden="true" />
                              {pick(l, L.markPaid)}
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {actionErr && (
                  <p role="alert" className="mt-3 text-sm text-destructive">
                    {actionErr}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Revizijski dnevnik */}
            <Card>
              <CardContent className="p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                  {pick(l, L.audit)}
                </h2>
                {data.audit.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">{pick(l, L.auditEmpty)}</p>
                ) : (
                  <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto font-mono text-xs scrollbar-slim">
                    {data.audit.map((a) => (
                      <li key={a.id} className="flex flex-wrap gap-2 rounded-md bg-muted px-2 py-1.5">
                        <span className="text-muted-foreground">
                          {new Date(a.createdAt).toLocaleString(lang === "en" ? "en-GB" : "sl-SI")}
                        </span>
                        <span className="font-bold">{a.action}</span>
                        <span className="text-muted-foreground">{a.actorType}</span>
                        <span className="ml-auto truncate">{a.entityId.slice(0, 12)}…</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
