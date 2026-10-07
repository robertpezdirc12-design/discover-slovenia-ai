"use client";

// ============================================================================
// TRIP RESERVATIONS — rekonstrukcija Issue #4 §4 (val 3) iz PRISTNE izvorne
// kode (read_1790957761726), mostovno prirejena modelu 48-a: rezervacijske
// VRSTICE NA POTI (postanek + dan + stanje + opomba).
// ============================================================================
// ISKRENOST (kanon izvirnika, ohranjen):
//  · zamisel (IDEA) je izrecno označena — nikoli kar „potrjeno";
//  · potrjena vrstica je UPORABNIŠKI VNOS — nikoli „providerjeva potrditev
//    prek naše integracije" (zapisano pod opombo);
//  · vsaka napaka API-ja se izpiše (brez tihih padcev).
//
// Mutacije (POST/PATCH/DELETE) so EDITOR+ — vlogo je izračunal strežnik,
// komponenta samo pošteno skrije obrazec, če pravice ni (canEdit prop).
// Površina je SL-only (enako kot ostale /pot komponente izvirnika).
// ============================================================================

import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import type { SharedPlan } from "@/lib/shared-plan";

interface ReservationRow {
  id: string;
  dayIndex: number;
  stopSlug: string | null;
  stopName: string;
  status: string; // IDEA | CONFIRMED | CANCELLED
  note: string | null;
  createdBy: string;
  createdAt: string;
}

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  IDEA: {
    label: "Zamisel — ni še potrjena",
    cls: "border-amber-500/50 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700",
  },
  CONFIRMED: {
    label: "Potrjeno (lastni vnos)",
    cls:
      "border-emerald-500/50 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-700",
  },
  CANCELLED: {
    label: "Preklicano",
    cls: "border-border text-muted-foreground",
  },
};

const CUSTOM_STOP = "__custom__";

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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
  const [rows, setRows] = useState<ReservationRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Obrazec
  const [dayValue, setDayValue] = useState<string>("1");
  const [stopValue, setStopValue] = useState<string>("");
  const [customStop, setCustomStop] = useState<string>("");
  const [status, setStatus] = useState<string>("IDEA");
  const [note, setNote] = useState<string>("");

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

  const saveReservation = useCallback(
    async (saveAs: "IDEA" | "CONFIRMED") => {
      const stopName =
        stopValue === CUSTOM_STOP
          ? customStop.trim()
          : stops[Number(stopValue)]?.name ?? "";
      if (stopName.length < 2) {
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
              stopSlug:
                stopValue === CUSTOM_STOP
                  ? null
                  : stops[Number(stopValue)]?.destSlug ?? null,
              stopName,
              status: saveAs,
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
    },
    [shareId, stopValue, customStop, stops, dayNumber, note, load]
  );

  const transition = useCallback(
    async (id: string, next: "CONFIRMED" | "CANCELLED" | "IDEA") => {
      setBusy(true);
      setActionError(null);
      try {
        const r = await fetch(
          `/api/trips/${encodeURIComponent(shareId)}/reservations`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id, status: next }),
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
              const badge =
                STATUS_BADGES[b.status] ??
                ({ label: b.status, cls: "border-border" } as const);
              return (
                <li key={b.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Dan {b.dayIndex}
                    </span>
                    <span className="text-sm font-semibold">{b.stopName}</span>
                    <Badge variant="outline" className={badge.cls}>
                      {badge.label}
                    </Badge>
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {b.note ? <div className="whitespace-pre-line">Opomba: {b.note}</div> : null}
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
                          onClick={() => void transition(b.id, "CONFIRMED")}
                          disabled={busy}
                          className="gap-1.5"
                        >
                          <CircleCheck className="size-4" aria-hidden="true" />
                          Potrdi rezervacijo
                        </Button>
                      ) : null}
                      {b.status !== "CANCELLED" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void transition(b.id, "CANCELLED")}
                          disabled={busy}
                          className="gap-1.5"
                        >
                          <Ban className="size-4" aria-hidden="true" />
                          Prekliči
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void transition(b.id, "IDEA")}
                          disabled={busy}
                        >
                          Znova kot zamisel
                        </Button>
                      )}
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
                <div className="space-y-1.5">
                  <Label htmlFor="res-status">Stanje</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="res-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IDEA">
                        Zamisel (osnutek — čaka potrditev)
                      </SelectItem>
                      <SelectItem value="CONFIRMED">
                        Potrjeno (lastni vnos)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                  onClick={() =>
                    void saveReservation(status === "CONFIRMED" ? "CONFIRMED" : "IDEA")
                  }
                  disabled={busy}
                  className="gap-1.5"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CircleCheck className="size-4" aria-hidden="true" />
                  )}
                  {status === "CONFIRMED"
                    ? "Potrdi in shrani rezervacijo"
                    : "Shrani kot zamisel"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void saveReservation("IDEA")}
                  disabled={busy}
                >
                  Shrani kot zamisel
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
                S shranjevanjem potrjuješ, da so podatki iz tvojih dogovorov.
                Zapis je vedno označen z izvorom (zamisel / potrjeno) — nikoli
                kot ponudnikova potrditev prek naše integracije.
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
      </CardContent>
    </Card>
  );
}
