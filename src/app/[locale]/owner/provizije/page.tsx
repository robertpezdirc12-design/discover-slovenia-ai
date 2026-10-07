"use client";

/**
 * /owner/provizije — SKRBNIŠKA nadzorna plošča "Provizije in klikanja".
 *
 * Trije odseki: povzetek (na čakanju / potrjeno / izplačano / klikanja),
 * klikanja po partnerjih in provizijski dnevnik iz poročil partnerjev.
 * Dostop varuje DSA_ADMIN_EMAILS na API-ju (fail-closed): brez nastavitve
 * ali brez prijave plošča iskreno pove, da je dostop omejen na skrbnike.
 *
 * ISKRENOSTNI KANON (2.5.0, vzorec MindTrip):
 *  · klikanja so NAŠA lastna meritev (klik ni rezervacija);
 *  · provizijski vnosi izhajajo IZKLJUČNO iz poročil partnerjev;
 *  · provizija brez vnosa je OCENA iz registra (pogodbena, ne obljuba);
 *  · izplačilo: 28. v mesecu, 3 mesece po zaključku bivanja.
 */

import {
  ArrowRight,
  Banknote,
  BedDouble,
  Car,
  CheckCircle2,
  ClipboardList,
  Clock,
  Fuel,
  Loader2,
  Lock,
  MousePointerClick,
  Percent,
  Plane,
  Plus,
  RefreshCw,
  Ticket,
  TrainFront,
  type LucideIcon,
} from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/navigation";
import {
  AFFILIATE_CATEGORIES,
  getProvider,
  providersPublicDTO,
  type AffiliateCategory,
} from "@/lib/affiliate-providers";
import { pick } from "@/lib/i18n-pick";

// ── Oblike odgovorov /api/affiliate/* (drift ulovi strogi tsc) ─────────────

interface ProviderClickStat {
  providerId: string;
  total: number;
  active: number;
  last7: number;
  last30: number;
  estimatedEur: number;
}

interface AffiliateStatsDTO {
  providers: ProviderClickStat[];
  commissions: {
    pendingCount: number;
    confirmedCount: number;
    paidCount: number;
    pendingEur: number;
    confirmedEur: number;
    paidEur: number;
  };
  totalClicks: number;
  generatedAt: string;
  activation: { id: string; category: string; active: boolean }[];
}

interface CommissionEntryDTO {
  id: string;
  providerId: string;
  bookingRef: string;
  bookedFor: string | null;
  amountEur: number;
  commissionEur: number;
  status: string;
  stayCompletedAt: string | null;
  payoutDueAt: string | null;
  source: string;
  note: string | null;
  createdAt: string;
}

/** Ikona po kategoriji partnerja (register je vir resnice). */
const CATEGORY_ICONS: Record<AffiliateCategory, LucideIcon> = {
  stays: BedDouble,
  experiences: Ticket,
  flights: Plane,
  car: Car,
  transfers: TrainFront,
  fuel: Fuel,
};

const EMPTY_FORM = {
  providerId: "",
  bookingRef: "",
  bookedFor: "",
  amountEur: "",
  commissionEur: "",
  stayCompletedAt: "",
  note: "",
};

export default function OwnerProvizijePage() {
  const l = useLocale();
  const { toast } = useToast();

  const [stats, setStats] = React.useState<AffiliateStatsDTO | null>(null);
  const [entries, setEntries] = React.useState<CommissionEntryDTO[]>([]);
  const [forbidden, setForbidden] = React.useState(false);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const [form, setForm] = React.useState({ ...EMPTY_FORM });
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const L = {
    kicker: { sl: "Skrbniška plošča", en: "Admin dashboard" },
    title: { sl: "Provizije in klikanja", en: "Commissions and clicks" },
    lead: {
      sl: "Klikanja na partnerske povezave in provizijski dnevnik iz poročil partnerjev — vidno izključno skrbnikom (DSA_ADMIN_EMAILS).",
      en: "Clicks on partner links and the commission journal from partner reports — visible to administrators only (DSA_ADMIN_EMAILS).",
    },
    refresh: { sl: "Osveži", en: "Refresh" },
    generatedAt: { sl: "Podatki nastali", en: "Data generated" },
    loading: { sl: "Nalagam podatke …", en: "Loading data …" },
    forbiddenTitle: { sl: "Dostop omejen na skrbnike", en: "Access restricted to administrators" },
    forbiddenBody: {
      sl: "Dostop omejen na skrbnike. Nastavi DSA_ADMIN_EMAILS (vejico ločen seznam e-poštnih naslovov) v okolju in se prijavi s tem naslovom.",
      en: "Access is restricted to administrators. Set DSA_ADMIN_EMAILS (a comma-separated list of email addresses) in the environment and sign in with that address.",
    },
    toLogin: { sl: "K prijavi", en: "Go to sign-in" },
    loadErrTitle: { sl: "Podatkov ni bilo mogoče naložiti", en: "Failed to load data" },
    retry: { sl: "Poskusi znova", en: "Try again" },
    // Povzetek
    sumPending: { sl: "Na čakanju (PENDING)", en: "Pending (PENDING)" },
    sumConfirmed: { sl: "Potrjeno", en: "Confirmed" },
    sumPaid: { sl: "Izplačano", en: "Paid" },
    sumClicks: { sl: "Skupaj klikanj", en: "Total clicks" },
    entriesLabel: { sl: "Vnosov", en: "Entries" },
    monetizedLabel: { sl: "Moniziranih klikanj", en: "Monetized clicks" },
    // Klikanja po partnerjih
    clicksTitle: { sl: "Klikanja po partnerjih", en: "Clicks by partner" },
    clicksNote: {
      sl: "Naša lastna meritev — klik na partnersko povezavo ni (še) rezervacija.",
      en: "Our own measurement — a click on a partner link is not (yet) a booking.",
    },
    thPartner: { sl: "Partner", en: "Partner" },
    thCategory: { sl: "Kategorija", en: "Category" },
    thTotal: { sl: "Skupaj", en: "Total" },
    th7: { sl: "Zadnjih 7 dni", en: "Last 7 days" },
    th30: { sl: "Zadnjih 30 dni", en: "Last 30 days" },
    thStatus: { sl: "Stanje", en: "Status" },
    statusActive: { sl: "Aktiviran", en: "Activated" },
    setEnv: { sl: "Nastavi", en: "Set" },
    noCommission: { sl: "Brez provizije", en: "No commission" },
    // Provizijski dnevnik
    journalTitle: { sl: "Provizijski dnevnik", en: "Commission journal" },
    journalNote: { sl: "Zadnjih 200 vnosov, padajoče po datumu.", en: "Latest 200 entries, newest first." },
    thRef: { sl: "Rez. št.", en: "Booking ref" },
    thFor: { sl: "Za", en: "For" },
    thAmount: { sl: "Vrednost €", en: "Value €" },
    thCommission: { sl: "Provizija €", en: "Commission €" },
    thPayout: { sl: "Izplačilo", en: "Payout" },
    thSource: { sl: "Vir", en: "Source" },
    thAction: { sl: "Akcija", en: "Action" },
    statusPendingLabel: { sl: "Na čakanju", en: "Pending" },
    statusConfirmedLabel: { sl: "Potrjeno", en: "Confirmed" },
    statusPaidLabel: { sl: "Izplačano", en: "Paid" },
    emptyJournal: {
      sl: "Se ni vnosov — vnosi se dodajajo iz poročil partnerjev.",
      en: "No entries yet — entries are added from partner reports.",
    },
    confirm: { sl: "Potrdi", en: "Confirm" },
    markPaid: { sl: "Označi izplačano", en: "Mark as paid" },
    // Forma
    formTitle: { sl: "Nov vnos iz poročila", en: "New entry from a report" },
    formNote: {
      sl: "Vnos iz poročila partnerja: rezervacijska številka in znesek. Provizijo, če je ne vpišeš, ocenimo iz registra — poročilo je resnica.",
      en: "An entry from a partner report: booking reference and value. If you leave the commission empty, we estimate it from the registry — the report is the truth.",
    },
    fPartner: { sl: "Partner", en: "Partner" },
    fPartnerPh: { sl: "Izberi partnerja", en: "Select a partner" },
    fPartnerErr: { sl: "Izberi partnerja iz seznama.", en: "Pick a partner from the list." },
    fRef: { sl: "Številka rezervacije", en: "Booking reference" },
    fFor: { sl: "Za (opis)", en: "For (description)" },
    fForPh: { sl: "npr. Hotel Bled", en: "e.g. Hotel Bled" },
    fAmount: { sl: "Vrednost rezervacije (EUR)", en: "Booking value (EUR)" },
    fCommission: { sl: "Provizija (EUR)", en: "Commission (EUR)" },
    fCommissionPh: { sl: "prazno = ocena {pct} %", en: "empty = estimate {pct} %" },
    fCommissionPhNoPct: { sl: "prazno = ocena po registru", en: "empty = registry estimate" },
    fStay: { sl: "Datum zaključka bivanja", en: "Stay completed on" },
    fNote: { sl: "Opomba", en: "Note" },
    fSubmit: { sl: "Dodaj vnos", en: "Add entry" },
    fSubmitting: { sl: "Dodajam …", en: "Adding …" },
    okTitle: { sl: "Vnos dodan", en: "Entry added" },
    okBody: {
      sl: "Vnos iz poročila je shranjen v provizijski dnevnik.",
      en: "The report entry is saved to the commission journal.",
    },
    errTitle: { sl: "Vnosa ni bilo mogoče dodati", en: "Could not add the entry" },
    statusErrTitle: { sl: "Sprememba statusa ni uspela", en: "Status change failed" },
    errNetwork: { sl: "Omrežna napaka — poskusi znova.", en: "Network error — try again." },
    errGeneric: { sl: "Neznana napaka strežnika.", en: "Unknown server error." },
    // Iskrenostna opomba (kanon)
    honesty: {
      sl: "Vnosi izhajajo IZKLJUČNO iz poročil partnerjev. Klikanja so naša lastna meritev; provizije se potrdijo v partnerjevem poročilu (izračun izplačila: 28. v mesecu, 3 meseca po bivanju — vzorec MindTrip).",
      en: "Entries come EXCLUSIVELY from partner reports. Clicks are our own measurement; commissions are confirmed in the partner's report (payout calculation: the 28th of the month, 3 months after the stay — the MindTrip pattern).",
    },
  } as const;

  // ── Nalaganje (oba skrbniška endpointa skupaj) ──────────────────────────

  const loadAll = React.useCallback(
    async (opts?: { initial?: boolean }) => {
      if (opts?.initial) setLoading(true);
      else setRefreshing(true);
      setLoadErr(null);
      try {
        const [statsRes, entriesRes] = await Promise.all([
          fetch("/api/affiliate/stats", { cache: "no-store" }),
          fetch("/api/affiliate/commissions", { cache: "no-store" }),
        ]);
        // Fail-closed vrata: 403 = ni skrbnika (brez env nastavitve ali prijave).
        if (statsRes.status === 403 || entriesRes.status === 403) {
          setForbidden(true);
          return;
        }
        setForbidden(false);
        const statsData =
          (await statsRes.json().catch(() => null)) as AffiliateStatsDTO | null;
        const entriesData =
          (await entriesRes.json().catch(() => null)) as {
            entries?: CommissionEntryDTO[];
          } | null;
        if (!statsRes.ok || !statsData || !entriesRes.ok || !entriesData) {
          setLoadErr(pick(l, L.errGeneric));
          return;
        }
        setStats(statsData);
        setEntries(entriesData.entries ?? []);
      } catch {
        setLoadErr(pick(l, L.errNetwork));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [l],
  );

  React.useEffect(() => {
    void loadAll({ initial: true });
  }, [loadAll]);

  // ── Pomočniki za prikaz ──────────────────────────────────────────────────

  const fmtEur = (n: number) =>
    l === "en" ? `${n.toFixed(2)} €` : `${n.toFixed(2).replace(".", ",")} €`;

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(l === "en" ? "en-GB" : "sl-SI", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  };

  const fmtDateTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(l === "en" ? "en-GB" : "sl-SI", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const providerName = (id: string) => getProvider(id)?.name ?? id;

  const categoryIcon = (providerId: string): LucideIcon => {
    const def = getProvider(providerId);
    return def ? CATEGORY_ICONS[def.category] : ClipboardList;
  };

  // Aktiviranost partnerja: true → aktiviran, false → manjka AFFILIATE_*_ID.
  const activationById = React.useMemo(
    () => new Map((stats?.activation ?? []).map((a) => [a.id, a])),
    [stats],
  );

  const renderActivation = (providerId: string) => {
    const act = activationById.get(providerId);
    if (!act) {
      // Gorivo (odprti podatki) ni provizijski program — iskreno označimo.
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {pick(l, L.noCommission)}
        </Badge>
      );
    }
    if (act.active) {
      return (
        <Badge className="border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {pick(l, L.statusActive)}
        </Badge>
      );
    }
    const envId =
      getProvider(providerId)?.envId ??
      `AFFILIATE_${providerId.toUpperCase()}_ID`;
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      >
        {pick(l, L.setEnv)} {envId}
      </Badge>
    );
  };

  const renderStatus = (status: string) => {
    if (status === "PAID") {
      return (
        <Badge className="border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {pick(l, L.statusPaidLabel)}
        </Badge>
      );
    }
    if (status === "CONFIRMED") {
      return (
        <Badge
          variant="outline"
          className="border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
        >
          {pick(l, L.statusConfirmedLabel)}
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      >
        {pick(l, L.statusPendingLabel)}
      </Badge>
    );
  };

  // ── Nov vnos iz poročila (POST) ──────────────────────────────────────────

  const providers = providersPublicDTO().filter((p) => p.commissionable);
  const selectedDef = form.providerId ? getProvider(form.providerId) : null;
  const commissionPlaceholder = selectedDef
    ? pick(l, L.fCommissionPh).replace("{pct}", String(selectedDef.commissionPct))
    : pick(l, L.fCommissionPhNoPct);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.providerId) {
      setFormError(pick(l, L.fPartnerErr));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliate/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: form.providerId,
          bookingRef: form.bookingRef.trim(),
          bookedFor: form.bookedFor.trim() || null,
          amountEur: Number(form.amountEur.replace(",", ".")),
          commissionEur:
            form.commissionEur.trim() === ""
              ? null
              : Number(form.commissionEur.replace(",", ".")),
          stayCompletedAt: form.stayCompletedAt || null,
          note: form.note.trim() || null,
        }),
      });
      const data =
        (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 201) {
        toast({ title: pick(l, L.okTitle), description: pick(l, L.okBody) });
        setForm({ ...EMPTY_FORM });
        await loadAll();
      } else {
        const msg = data?.error ?? pick(l, L.errGeneric);
        setFormError(msg);
        toast({
          title: pick(l, L.errTitle),
          description: msg,
          variant: "destructive",
        });
      }
    } catch {
      const msg = pick(l, L.errNetwork);
      setFormError(msg);
      toast({ title: pick(l, L.errTitle), description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Sprememba statusa (PATCH: PENDING → CONFIRMED → PAID) ───────────────

  const onStatus = async (id: string, status: "CONFIRMED" | "PAID") => {
    setBusyId(id);
    try {
      const res = await fetch("/api/affiliate/commissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        await loadAll();
      } else {
        const data =
          (await res.json().catch(() => null)) as { error?: string } | null;
        toast({
          title: pick(l, L.statusErrTitle),
          description: data?.error ?? pick(l, L.errGeneric),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: pick(l, L.statusErrTitle),
        description: pick(l, L.errNetwork),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const monetizedClicks = (stats?.providers ?? []).reduce(
    (acc, p) => acc + p.active,
    0,
  );

  // ── Izris ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)}>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="tap-target font-semibold"
            onClick={() => void loadAll()}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {pick(l, L.refresh)}
          </Button>
          {stats && (
            <span className="text-xs text-muted-foreground">
              {pick(l, L.generatedAt)}: {fmtDateTime(stats.generatedAt)}
            </span>
          )}
        </div>
      </PageHeader>

      {/* Prvo nalaganje */}
      {loading && (
        <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground" role="status">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm">{pick(l, L.loading)}</p>
        </div>
      )}

      {/* 403 — iskrena vrata skrbnika (DSA_ADMIN_EMAILS) */}
      {!loading && forbidden && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Lock className="size-5 text-primary" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <p className="font-bold">{pick(l, L.forbiddenTitle)}</p>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {pick(l, L.forbiddenBody)}
              </p>
            </div>
            <Button asChild className="tap-target shrink-0 font-semibold">
              <Link href="/prijava">
                {pick(l, L.toLogin)}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Napaka (ne 403) — iskren poziv k ponovnemu poskusu */}
      {!loading && !forbidden && loadErr && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-bold">{pick(l, L.loadErrTitle)}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{loadErr}</p>
            </div>
            <Button
              variant="outline"
              className="tap-target shrink-0 font-semibold"
              onClick={() => void loadAll()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {pick(l, L.retry)}
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !forbidden && !loadErr && stats && (
        <>
          {/* Povzetek: zneski po statusih + klikanja */}
          <dl className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border bg-card px-4 py-3.5">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                {pick(l, L.sumPending)}
              </dt>
              <dd className="mt-1 text-2xl font-bold text-primary">
                {fmtEur(stats.commissions.pendingEur)}
              </dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">
                {pick(l, L.entriesLabel)}: {stats.commissions.pendingCount}
              </dd>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3.5">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                {pick(l, L.sumConfirmed)}
              </dt>
              <dd className="mt-1 text-2xl font-bold text-primary">
                {fmtEur(stats.commissions.confirmedEur)}
              </dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">
                {pick(l, L.entriesLabel)}: {stats.commissions.confirmedCount}
              </dd>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3.5">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Banknote className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                {pick(l, L.sumPaid)}
              </dt>
              <dd className="mt-1 text-2xl font-bold text-primary">
                {fmtEur(stats.commissions.paidEur)}
              </dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">
                {pick(l, L.entriesLabel)}: {stats.commissions.paidCount}
              </dd>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3.5">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MousePointerClick className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                {pick(l, L.sumClicks)}
              </dt>
              <dd className="mt-1 text-2xl font-bold text-primary">{stats.totalClicks}</dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">
                {pick(l, L.monetizedLabel)}: {monetizedClicks}
              </dd>
            </div>
          </dl>

          {/* a) Klikanja po partnerjih */}
          <section className="mt-10" aria-labelledby="provizije-clicks">
            <h2 id="provizije-clicks" className="text-xl font-bold tracking-tight sm:text-2xl">
              {pick(l, L.clicksTitle)}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {pick(l, L.clicksNote)}
            </p>
            <Card className="mt-4">
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{pick(l, L.thPartner)}</TableHead>
                        <TableHead>{pick(l, L.thCategory)}</TableHead>
                        <TableHead className="text-right">{pick(l, L.thTotal)}</TableHead>
                        <TableHead className="text-right">{pick(l, L.th7)}</TableHead>
                        <TableHead className="text-right">{pick(l, L.th30)}</TableHead>
                        <TableHead>{pick(l, L.thStatus)}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...stats.providers]
                        .sort((a, b) => b.total - a.total)
                        .map((p) => {
                          const Icon = categoryIcon(p.providerId);
                          const def = getProvider(p.providerId);
                          return (
                            <TableRow key={p.providerId}>
                              <TableCell>
                                <span className="flex items-center gap-2 font-medium">
                                  <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                                  {providerName(p.providerId)}
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {def ? pick(l, AFFILIATE_CATEGORIES[def.category]) : "—"}
                              </TableCell>
                              <TableCell className="text-right font-semibold">{p.total}</TableCell>
                              <TableCell className="text-right">{p.last7}</TableCell>
                              <TableCell className="text-right">{p.last30}</TableCell>
                              <TableCell>{renderActivation(p.providerId)}</TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* b) Provizijski dnevnik (zadnjih 200) */}
          <section className="mt-10" aria-labelledby="provizije-journal">
            <h2 id="provizije-journal" className="text-xl font-bold tracking-tight sm:text-2xl">
              {pick(l, L.journalTitle)}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {pick(l, L.journalNote)}
            </p>
            <Card className="mt-4">
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{pick(l, L.thPartner)}</TableHead>
                        <TableHead>{pick(l, L.thRef)}</TableHead>
                        <TableHead>{pick(l, L.thFor)}</TableHead>
                        <TableHead className="text-right">{pick(l, L.thAmount)}</TableHead>
                        <TableHead className="text-right">{pick(l, L.thCommission)}</TableHead>
                        <TableHead>{pick(l, L.thStatus)}</TableHead>
                        <TableHead>{pick(l, L.thPayout)}</TableHead>
                        <TableHead>{pick(l, L.thSource)}</TableHead>
                        <TableHead>{pick(l, L.thAction)}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                            {pick(l, L.emptyJournal)}
                          </TableCell>
                        </TableRow>
                      ) : (
                        entries.map((e) => {
                          const Icon = categoryIcon(e.providerId);
                          return (
                            <TableRow key={e.id}>
                              <TableCell>
                                <span className="flex items-center gap-2 font-medium">
                                  <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                                  {providerName(e.providerId)}
                                </span>
                              </TableCell>
                              <TableCell className="max-w-40 truncate font-mono text-xs" title={e.bookingRef}>
                                {e.bookingRef}
                              </TableCell>
                              <TableCell className="max-w-44">
                                <span className="block truncate" title={e.bookedFor ?? undefined}>
                                  {e.bookedFor ?? "—"}
                                </span>
                                {e.note && (
                                  <span className="block truncate text-xs text-muted-foreground" title={e.note}>
                                    {e.note}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">{fmtEur(e.amountEur)}</TableCell>
                              <TableCell className="text-right font-semibold text-primary">
                                {fmtEur(e.commissionEur)}
                              </TableCell>
                              <TableCell>{renderStatus(e.status)}</TableCell>
                              <TableCell className="text-muted-foreground">{fmtDate(e.payoutDueAt)}</TableCell>
                              <TableCell>
                                <Badge variant={e.source === "CSV_IMPORT" ? "secondary" : "outline"}>
                                  {e.source}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {e.status === "PENDING" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="tap-target font-semibold"
                                    disabled={busyId === e.id}
                                    onClick={() => void onStatus(e.id, "CONFIRMED")}
                                  >
                                    {busyId === e.id ? (
                                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                    ) : (
                                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                    )}
                                    {pick(l, L.confirm)}
                                  </Button>
                                )}
                                {e.status === "CONFIRMED" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="tap-target font-semibold"
                                    disabled={busyId === e.id}
                                    onClick={() => void onStatus(e.id, "PAID")}
                                  >
                                    {busyId === e.id ? (
                                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                    ) : (
                                      <Banknote className="size-3.5" aria-hidden="true" />
                                    )}
                                    {pick(l, L.markPaid)}
                                  </Button>
                                )}
                                {e.status === "PAID" && (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Forma: nov vnos iz poročila partnerja */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">{pick(l, L.formTitle)}</CardTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {pick(l, L.formNote)}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="prov-provider">{pick(l, L.fPartner)}</Label>
                  <Select
                    value={form.providerId}
                    onValueChange={(v) => setForm((f) => ({ ...f, providerId: v }))}
                  >
                    <SelectTrigger id="prov-provider" className="h-11 w-full">
                      <SelectValue placeholder={pick(l, L.fPartnerPh)} />
                    </SelectTrigger>
                    <SelectContent className="max-h-96">
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prov-ref">{pick(l, L.fRef)}</Label>
                  <Input
                    id="prov-ref"
                    required
                    maxLength={120}
                    autoComplete="off"
                    value={form.bookingRef}
                    onChange={(e) => setForm((f) => ({ ...f, bookingRef: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prov-for">{pick(l, L.fFor)}</Label>
                  <Input
                    id="prov-for"
                    maxLength={120}
                    placeholder={pick(l, L.fForPh)}
                    value={form.bookedFor}
                    onChange={(e) => setForm((f) => ({ ...f, bookedFor: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prov-amount">{pick(l, L.fAmount)}</Label>
                  <Input
                    id="prov-amount"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="120.00"
                    value={form.amountEur}
                    onChange={(e) => setForm((f) => ({ ...f, amountEur: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prov-commission">{pick(l, L.fCommission)}</Label>
                  <Input
                    id="prov-commission"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder={commissionPlaceholder}
                    value={form.commissionEur}
                    onChange={(e) => setForm((f) => ({ ...f, commissionEur: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prov-stay">{pick(l, L.fStay)}</Label>
                  <Input
                    id="prov-stay"
                    type="date"
                    value={form.stayCompletedAt}
                    onChange={(e) => setForm((f) => ({ ...f, stayCompletedAt: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="prov-note">{pick(l, L.fNote)}</Label>
                  <Input
                    id="prov-note"
                    maxLength={200}
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  />
                </div>
                {formError && (
                  <p role="alert" className="text-sm text-destructive sm:col-span-2">
                    {formError}
                  </p>
                )}
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={submitting} className="tap-target font-semibold">
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="size-4" aria-hidden="true" />
                    )}
                    {submitting ? pick(l, L.fSubmitting) : pick(l, L.fSubmit)}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Iskrenostna opomba (kanon projekta) */}
          <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Percent className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            {pick(l, L.honesty)}
          </p>
        </>
      )}
    </div>
  );
}
