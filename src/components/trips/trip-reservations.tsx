"use client";

// ============================================================================
// TRIP RESERVATIONS — rekonstrukcija Issue #4 §4 (val 3) iz PRISTNE izvorne
// kode (read_1790957761726), mostovno prirejena modelu 48-a + S1 UTRDITEV
// 51-c: rezervacijske VRSTICE NA POTI (postanek + dan + stanje + opomba).
// ============================================================================
// ISKRENOST (kanon izvirnika, ohranjen in okrepljen z 51-c):
//  · zamisel (IDEA) je izrecno označena — nikoli kar „potrjeno";
//  · POTRJEVANJE je vedno UPORABNIŠKA ATESTACIJA: modal „Potrdi rezervacijo"
//    zahteva številko rezervacije + ceno IZ POTRDILA PONUDNIKA (source:
//    USER) — izrecno „ni naša integracija"; nikoli „providerjeva potrditev
//    prek naše integracije" (vijolični žeton, ne smaragdno „provider");
//  · potrjena vrstica pokaže številko rezervacije + ceno + izvor
//    (source: USER) — razkritje izvora je del zapisa;
//  · preklicana vrstica je DOKONČNA (terminalno stanje življenjskega
//    cikla — brez povratkov v zamisel);
//  · poskus provider kanala (source: "PROVIDER") na strežniku propade
//    zaprto (503) — kanal v peskovniku ne obstaja; napaka se izpiše;
//  · vsaka napaka API-ja se izpiše (brez tihih padcev).
//
// Mutacije (POST/PATCH/DELETE) so EDITOR+ — vlogo je izračunal strežnik,
// komponenta samo pošteno skrije obrazec, če pravice ni (canEdit prop).
// Nove površine (modal + razkritje izvora) so dvojezične (L={sl,en}+pick);
// ostala besedila ostajajo SL-only kot v ostalih /pot komponentah izvirnika.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TicketCheck,
  Plus,
  Loader2,
  CircleAlert,
  CircleCheck,
  Ban,
  Trash2,
  PenLine,
  BadgeCheck,
} from "lucide-react";
import { pick } from "@/lib/i18n-pick";
import type { SharedPlan } from "@/lib/shared-plan";
import {
  noteTextOf,
  parseAttestationNote,
  statusLabel,
} from "@/lib/journey/booking";

interface ReservationRow {
  id: string;
  dayIndex: number;
  stopSlug: string | null;
  stopName: string;
  status: string; // IDEA | CONFIRMED | MODIFIED | CANCELLED (mostovni nabor)
  note: string | null;
  createdBy: string;
  createdAt: string;
}

/** Cilj potrditvenega modala (51-c). */
type ConfirmTarget =
  | { kind: "create" } // nov potrjen vnos iz obrazca → POST + atestacija
  | { kind: "confirm"; row: ReservationRow } // IDEA → CONFIRMED (PATCH)
  | { kind: "update"; row: ReservationRow }; // CONFIRMED/MODIFIED → MODIFIED (PATCH)

// Dvojezične oznake novih površin (SL je resnica, EN je prevod — kanon L).
const L = {
  statusIdea: { sl: "Zamisel — ni še potrjena", en: "Idea — not confirmed yet" },
  statusConfirmed: { sl: "Potrjeno (uporabniški vnos)", en: "Confirmed (user entry)" },
  statusModified: { sl: "Spremenjeno (uporabniški vnos)", en: "Modified (user entry)" },
  statusCancelled: { sl: "Preklicano", en: "Cancelled" },
  confirmReservation: { sl: "Potrdi rezervacijo", en: "Confirm reservation" },
  updateProof: { sl: "Posodobi potrdilo", en: "Update proof" },
  cancelReservation: { sl: "Prekliči", en: "Cancel" },
  saveIdea: { sl: "Shrani kot zamisel", en: "Save as idea" },
  confirmWithProof: {
    sl: "Potrdi s potrdilom ponudnika …",
    en: "Confirm with provider proof …",
  },
  close: { sl: "Zapri", en: "Close" },
  modalTitleConfirm: { sl: "Potrdi rezervacijo", en: "Confirm reservation" },
  modalTitleUpdate: { sl: "Posodobi potrdilo rezervacije", en: "Update reservation proof" },
  modalHonesty: {
    sl: "To je tvoj vnos iz potrdila ponudnika — ni naša integracija. Podatki se shranijo kot uporabniška atestacija (source: USER).",
    en: "This is your entry from the provider's confirmation — not our integration. The data is saved as a user attestation (source: USER).",
  },
  forStop: { sl: "Postanek", en: "Stop" },
  bookingIdLabel: {
    sl: "Številka rezervacije (potrdilo ponudnika)",
    en: "Booking number (provider confirmation)",
  },
  bookingIdPlaceholder: { sl: "npr. BLED-2026-114", en: "e.g. BLED-2026-114" },
  priceLabel: { sl: "Cena (EUR)", en: "Price (EUR)" },
  pricePlaceholder: { sl: "npr. 49,50", en: "e.g. 49.50" },
  noteLabel: { sl: "Opomba", en: "Note" },
  submitConfirm: { sl: "Shrani kot potrjeno", en: "Save as confirmed" },
  submitUpdate: { sl: "Shrani spremembo", en: "Save change" },
  proofLine: { sl: "Potrdilo", en: "Proof" },
  errBookingId: {
    sl: "Vpiši številko rezervacije iz potrdila ponudnika.",
    en: "Enter the booking number from the provider's confirmation.",
  },
  errPrice: {
    sl: "Vpiši ceno iz potrdila ponudnika (število, večje od 0).",
    en: "Enter the price from the provider's confirmation (a number greater than 0).",
  },
  errStop: {
    sl: "Izberi postanek s seznama ali vpiši ime (vsaj 2 znaka).",
    en: "Pick a stop from the list or enter a name (at least 2 characters).",
  },
} as const;

/**
 * Statusni žetoni (mostovni nabor pote). Uporabniško potrjena/spremenjena
 * vrstica je VIJOLIČNA — nikoli smaragdna „provider potrjeno" (kanon
 * izvirnika: izvor je vedno razkrit).
 */
const STATUS_BADGES: Record<string, { label: { sl: string; en: string }; cls: string }> = {
  IDEA: {
    label: { sl: L.statusIdea.sl, en: L.statusIdea.en },
    cls: "border-amber-500/50 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700",
  },
  CONFIRMED: {
    label: { sl: L.statusConfirmed.sl, en: L.statusConfirmed.en },
    cls: "border-violet-500/50 text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-700",
  },
  MODIFIED: {
    label: { sl: L.statusModified.sl, en: L.statusModified.en },
    cls: "border-violet-500/50 text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-700",
  },
  CANCELLED: {
    label: { sl: L.statusCancelled.sl, en: L.statusCancelled.en },
    cls: "border-border text-muted-foreground",
  },
};

const CUSTOM_STOP = "__custom__";

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Znesek v EUR (sl-SI / en-IE oblika) — izključno za prikaz atestacije. */
function formatPriceEUR(value: number, lang: "sl" | "en"): string {
  try {
    return new Intl.NumberFormat(lang === "en" ? "en-IE" : "sl-SI", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  } catch {
    return `${value.toFixed(2)} €`;
  }
}

export function TripReservations({
  shareId,
  plan,
  canEdit,
}: {
  shareId: string;
  plan: SharedPlan;
  canEdit: boolean;
}) {
  const l = useLocale();
  const lang: "sl" | "en" = l === "en" ? "en" : "sl";

  const [rows, setRows] = useState<ReservationRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Obrazec
  const [dayValue, setDayValue] = useState<string>("1");
  const [stopValue, setStopValue] = useState<string>("");
  const [customStop, setCustomStop] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // Modal „Potrdi rezervacijo" (51-c — uporabniška atestacija)
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [confirmBookingId, setConfirmBookingId] = useState("");
  const [confirmPrice, setConfirmPrice] = useState("");
  const [confirmNote, setConfirmNote] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  const days = plan.days ?? [];
  const dayNumber = Math.min(Number(dayValue) || 1, Math.max(days.length, 1));
  const selectedDay = days.find((d) => d.day === dayNumber) ?? days[0];
  const stops = selectedDay?.locations ?? [];

  const load = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/trips/${encodeURIComponent(shareId)}/reservations`,
        { cache: "no-store" }
      );
      if (r.status === 404) {
        setRows([]);
        return;
      }
      if (!r.ok) {
        setLoadError(`Napaka ${r.status}`);
        return;
      }
      const data = (await r.json()) as { reservations?: ReservationRow[] };
      setRows(data.reservations ?? []);
      setLoadError(null);
    } catch (e) {
      setLoadError(errText(e));
    }
  }, [shareId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ob spremenjenem dnevu ponastavi izbiro postanka.
  useEffect(() => {
    setStopValue(stops.length > 0 ? String(0) : CUSTOM_STOP);
  }, [dayValue, shareId, stops.length]);

  /** Reši postanek obrazca (seznam ali ročni vnos) — null, če ni veljaven. */
  const resolveStop = useCallback((): { stopName: string; stopSlug: string | null } | null => {
    const stopName =
      stopValue === CUSTOM_STOP
        ? customStop.trim()
        : stops[Number(stopValue)]?.name ?? "";
    if (stopName.length < 2) return null;
    return {
      stopName,
      stopSlug:
        stopValue === CUSTOM_STOP
          ? null
          : stops[Number(stopValue)]?.destSlug ?? null,
    };
  }, [stopValue, customStop, stops]);

  /** Shrani vrstico kot ZAMISEL (status IDEA — brez atestacije). */
  const saveIdeaReservation = useCallback(async () => {
    const resolved = resolveStop();
    if (!resolved) {
      setActionError("Izberi postanek s seznama ali vpiši ime (vsaj 2 znaka).");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const r = await fetch(
        `/api/trips/${encodeURIComponent(shareId)}/reservations`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dayIndex: dayNumber,
            stopSlug: resolved.stopSlug,
            stopName: resolved.stopName,
            status: "IDEA",
            note: note.trim() || null,
          }),
        }
      );
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!r.ok || !data?.success) {
        setActionError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      setFormOpen(false);
      setCustomStop("");
      setNote("");
      setActionError(null);
      await load();
    } catch (e) {
      setActionError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [shareId, dayNumber, note, resolveStop, load]);

  /** Odpre modal s predhodnim polnjenjem (iz vrstice ali obrazca). */
  const openConfirmModal = useCallback(
    (target: ConfirmTarget) => {
      setConfirmTarget(target);
      setModalError(null);
      if (target.kind === "create") {
        setConfirmBookingId("");
        setConfirmPrice("");
        setConfirmNote(note.trim());
      } else {
        const att = parseAttestationNote(target.row.note);
        setConfirmBookingId(att?.providerBookingId ?? "");
        setConfirmPrice(att ? String(att.confirmedPrice) : "");
        setConfirmNote(noteTextOf(target.row.note) ?? "");
      }
    },
    [note]
  );

  const closeConfirmModal = useCallback(() => {
    setConfirmTarget(null);
    setModalError(null);
  }, []);

  /**
   * Oddaja uporabniške atestacije: POST (nov potrjen vnos) ali PATCH
   * (IDEA → CONFIRMED / CONFIRMED-MODIFIED → MODIFIED). Napaka strežnika
   * (400 atestacija / 503 provider kanal) se izpiše iskreno v modalu.
   */
  const submitConfirmation = useCallback(async () => {
    if (!confirmTarget) return;
    const bookingId = confirmBookingId.trim();
    if (bookingId.length < 1) {
      setModalError(pick(l, L.errBookingId));
      return;
    }
    const price = Number(confirmPrice.trim().replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      setModalError(pick(l, L.errPrice));
      return;
    }
    let payload: Record<string, unknown>;
    if (confirmTarget.kind === "create") {
      const resolved = resolveStop();
      if (!resolved) {
        setModalError(pick(l, L.errStop));
        return;
      }
      payload = {
        dayIndex: dayNumber,
        stopSlug: resolved.stopSlug,
        stopName: resolved.stopName,
        status: "CONFIRMED",
        source: "USER",
        providerBookingId: bookingId,
        confirmedPrice: price,
        note: confirmNote.trim() || null,
      };
    } else {
      payload = {
        id: confirmTarget.row.id,
        status: confirmTarget.kind === "update" ? "MODIFIED" : "CONFIRMED",
        source: "USER",
        providerBookingId: bookingId,
        confirmedPrice: price,
        note: confirmNote.trim() || null,
      };
    }
    setBusy(true);
    setModalError(null);
    try {
      const r = await fetch(
        `/api/trips/${encodeURIComponent(shareId)}/reservations`,
        {
          method: confirmTarget.kind === "create" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!r.ok || !data?.success) {
        // Iskrena napaka strežnika (npr. 503 „Provider kanal ni aktiven").
        setModalError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      if (confirmTarget.kind === "create") {
        setFormOpen(false);
        setCustomStop("");
        setNote("");
      }
      setConfirmTarget(null);
      setActionError(null);
      await load();
    } catch (e) {
      setModalError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [confirmTarget, confirmBookingId, confirmPrice, confirmNote, shareId, dayNumber, resolveStop, load, l]);

  /** Preklic (CANCELLED — terminalen, brez povratkov). */
  const cancelReservation = useCallback(
    async (id: string) => {
      setBusy(true);
      setActionError(null);
      try {
        const r = await fetch(
          `/api/trips/${encodeURIComponent(shareId)}/reservations`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id, status: "CANCELLED" }),
          }
        );
        const data = (await r.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
        } | null;
        if (!r.ok || !data?.success) {
          setActionError(data?.error ?? `Napaka ${r.status}`);
          return;
        }
        await load();
      } catch (e) {
        setActionError(errText(e));
      } finally {
        setBusy(false);
      }
    },
    [shareId, load]
  );

  const remove = useCallback(
    async (id: string) => {
      setBusy(true);
      setActionError(null);
      try {
        const r = await fetch(
          `/api/trips/${encodeURIComponent(shareId)}/reservations`,
          {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id }),
          }
        );
        const data = (await r.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
        } | null;
        if (!r.ok || !data?.success) {
          setActionError(data?.error ?? `Napaka ${r.status}`);
          return;
        }
        await load();
      } catch (e) {
        setActionError(errText(e));
      } finally {
        setBusy(false);
      }
    },
    [shareId, load]
  );

  const modalStopName =
    confirmTarget === null
      ? ""
      : confirmTarget.kind === "create"
        ? (resolveStop()?.stopName ?? "")
        : confirmTarget.row.stopName;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TicketCheck className="size-5 text-primary" aria-hidden="true" />
          Rezervacije
          {rows && rows.length > 0 ? (
            <Badge variant="secondary" className="ml-1 font-normal">
              {rows.length}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : null}
        {actionError ? (
          <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {actionError}
          </p>
        ) : null}

        {/* ── Seznam rezervacij ─────────────────────────────────────── */}
        {rows === null ? (
          <p role="status" className="text-sm text-muted-foreground">
            Nalagam rezervacije …
          </p>
        ) : rows.length > 0 ? (
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {rows.map((b) => {
              const badge = STATUS_BADGES[b.status] ?? null;
              // Neznan status → iskrena oznaka kanonske knjižnice (brez
              // izmišljenega prevoda).
              const badgeLabel = badge ? pick(l, badge.label) : statusLabel(b.status, lang);
              const attestation = parseAttestationNote(b.note);
              const noteText = noteTextOf(b.note);
              return (
                <li key={b.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Dan {b.dayIndex}
                    </span>
                    <span className="text-sm font-semibold">{b.stopName}</span>
                    <Badge variant="outline" className={badge?.cls ?? "border-border"}>
                      {badgeLabel}
                    </Badge>
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {/* Razkritje izvora: št. rezervacije + cena + source — */}
                    {/* vedno uporabniška atestacija, nikoli provider kanal. */}
                    {attestation ? (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-foreground/80">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <BadgeCheck className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                          {pick(l, L.proofLine)}: {attestation.providerBookingId}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatPriceEUR(attestation.confirmedPrice, lang)}</span>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          source: {attestation.source}
                        </span>
                      </div>
                    ) : null}
                    {noteText ? <div className="whitespace-pre-line">Opomba: {noteText}</div> : null}
                    <div>
                      Vpisano {new Date(b.createdAt).toLocaleDateString("sl-SI")}
                    </div>
                  </div>
                  {canEdit ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {b.status === "IDEA" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openConfirmModal({ kind: "confirm", row: b })}
                          disabled={busy}
                          className="gap-1.5"
                        >
                          <CircleCheck className="size-4" aria-hidden="true" />
                          {pick(l, L.confirmReservation)}
                        </Button>
                      ) : null}
                      {b.status === "CONFIRMED" || b.status === "MODIFIED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openConfirmModal({ kind: "update", row: b })}
                          disabled={busy}
                          className="gap-1.5"
                        >
                          <PenLine className="size-4" aria-hidden="true" />
                          {pick(l, L.updateProof)}
                        </Button>
                      ) : null}
                      {b.status !== "CANCELLED" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void cancelReservation(b.id)}
                          disabled={busy}
                          className="gap-1.5"
                        >
                          <Ban className="size-4" aria-hidden="true" />
                          {pick(l, L.cancelReservation)}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void remove(b.id)}
                        disabled={busy}
                        aria-label={`Odstrani rezervacijo: ${b.stopName}`}
                        className="gap-1.5 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Odstrani
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Še ni rezervacij.{" "}
            {canEdit
              ? "Dodaj zamisel ali potrjen vnos za posamezen postanek pote."
              : "Uredniki poti jih lahko dodajo."}
          </p>
        )}

        {/* ── Obrazec: dodaj rezervacijo ───────────────────────────── */}
        {canEdit ? (
          formOpen ? (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                Vpiši dogovor s ponudnikom za posamezen postanek pote.
                Zapis je tvoj vnos (izrecno označen) — nikoli ponudnikova
                potrditev prek naše integracije.
              </p>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="res-day">Dan</Label>
                  <Select value={String(dayNumber)} onValueChange={setDayValue}>
                    <SelectTrigger id="res-day" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((d) => (
                        <SelectItem key={d.day} value={String(d.day)}>
                          Dan {d.day}
                          {d.title ? ` — ${d.title}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="res-stop">Postanek</Label>
                  <Select value={stopValue} onValueChange={setStopValue}>
                    <SelectTrigger id="res-stop" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stops.map((s, i) => (
                        <SelectItem key={`${s.name}-${i}`} value={String(i)}>
                          {s.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_STOP}>
                        Drugo (ročni vnos)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {stopValue === CUSTOM_STOP ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="res-custom-stop">Ime postanka / ponudnika *</Label>
                    <Input
                      id="res-custom-stop"
                      value={customStop}
                      maxLength={200}
                      onChange={(e) => setCustomStop(e.target.value)}
                      placeholder="npr. Gostilna Pri Lovcu"
                    />
                  </div>
                ) : null}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="res-note">Opomba</Label>
                  <Input
                    id="res-note"
                    value={note}
                    maxLength={500}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="npr. rezervirana miza za 4 ob 19:00, odpoved do 24 h prej"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => openConfirmModal({ kind: "create" })}
                  disabled={busy}
                  className="gap-1.5"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CircleCheck className="size-4" aria-hidden="true" />
                  )}
                  {pick(l, L.confirmWithProof)}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void saveIdeaReservation()}
                  disabled={busy}
                  className="gap-1.5"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {pick(l, L.saveIdea)}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFormOpen(false);
                    setActionError(null);
                  }}
                  disabled={busy}
                >
                  Prekliči
                </Button>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                „{pick(l, L.confirmWithProof).replace(" …", "")}" zahteva številko
                rezervacije in ceno iz potrdila ponudnika — shranita se kot tvoja
                atestacija (source: USER), nikoli kot naša integracija s ponudnikom.
              </p>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFormOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" aria-hidden="true" />
              Dodaj rezervacijo
            </Button>
          )
        ) : null}

        {/* ── Modal: Potrdi rezervacijo (uporabniška atestacija, 51-c) ── */}
        <Dialog
          open={confirmTarget !== null}
          onOpenChange={(open) => {
            if (!open) closeConfirmModal();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TicketCheck className="size-5 text-primary" aria-hidden="true" />
                {confirmTarget?.kind === "update"
                  ? pick(l, L.modalTitleUpdate)
                  : pick(l, L.modalTitleConfirm)}
              </DialogTitle>
              <DialogDescription>{pick(l, L.modalHonesty)}</DialogDescription>
            </DialogHeader>

            {modalStopName ? (
              <p className="text-xs text-muted-foreground">
                {pick(l, L.forStop)}:{" "}
                <span className="font-medium text-foreground">{modalStopName}</span>
              </p>
            ) : null}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="res-confirm-booking-id">
                  {pick(l, L.bookingIdLabel)}{" "}
                  <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                <Input
                  id="res-confirm-booking-id"
                  value={confirmBookingId}
                  maxLength={200}
                  onChange={(e) => setConfirmBookingId(e.target.value)}
                  placeholder={pick(l, L.bookingIdPlaceholder)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="res-confirm-price">
                  {pick(l, L.priceLabel)}{" "}
                  <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                <Input
                  id="res-confirm-price"
                  inputMode="decimal"
                  value={confirmPrice}
                  onChange={(e) => setConfirmPrice(e.target.value)}
                  placeholder={pick(l, L.pricePlaceholder)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="res-confirm-note">{pick(l, L.noteLabel)}</Label>
                <Input
                  id="res-confirm-note"
                  value={confirmNote}
                  maxLength={500}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  placeholder="npr. rezervirana miza za 4 ob 19:00, odpoved do 24 h prej"
                />
              </div>
              {modalError ? (
                <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {modalError}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={closeConfirmModal} disabled={busy}>
                {pick(l, L.close)}
              </Button>
              <Button
                size="sm"
                onClick={() => void submitConfirmation()}
                disabled={busy}
                className="gap-1.5"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CircleCheck className="size-4" aria-hidden="true" />
                )}
                {confirmTarget?.kind === "update"
                  ? pick(l, L.submitUpdate)
                  : pick(l, L.submitConfirm)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
