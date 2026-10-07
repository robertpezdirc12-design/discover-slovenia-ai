"use client";

import { ClipboardPaste, FileSearch, Loader2, ShieldCheck } from "lucide-react";
import { useLocale } from "next-intl";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { pick } from "@/lib/i18n-pick";
import { parseReservationText, type ParsedReservation } from "@/lib/journey/reservation-import";
import { type SharedPlan } from "@/lib/shared-plan";

/**
 * RESERVATION-IMPORT-DIALOG — uvoz rezervacije iz potrdila
 * (P0-E, issue #1 §10 „reservation import parse → review → confirm").
 *
 * Tok: PRILEPI besedilo potrdila → DETERMINISTIČNA razčlenitev (pravila,
 * brez AI — reservation-import.ts) → PREGLED vseh polj (uporabnik popravi
 * in potrdi vsako) → S1 pot POST /api/trips/[shareId]/reservations z
 * izvorom IMPORTED (CONFIRMED z atestacijo, če sta številka in cena
 * prisotna; sicer iskren osnutek IDEA).
 */

const L = {
  trigger: { sl: "Uvozi rezervacijo", en: "Import a reservation" },
  title: { sl: "Uvozi rezervacijo iz potrdila", en: "Import a reservation from a confirmation" },
  desc: {
    sl: "Prilepi besedilo potrdila (e-pošta, SMS, PDF kopija). Razčlenitev je deterministična — pravila, brez AI; vsako polje pregledaš in potrdiš TI.",
    en: "Paste the confirmation text (e-mail, SMS, a PDF copy). Parsing is deterministic — rules, no AI; YOU review and confirm every field.",
  },
  paste: { sl: "Besedilo potrdila", en: "Confirmation text" },
  pastePh: {
    sl: "Prilepi sem celotno potrdilo …\n\nPrimer:\nBooking.com — potrditev rezervacije\nŠtevilka rezervacije: 4829104758\nPrenočišče Vila Bled, 2 osebi\nPrihod: 17.10.2026, odhod: 20.10.2026\nSkupaj: 495,00 €",
    en: "Paste the whole confirmation here …",
  },
  parse: { sl: "Razčleni", en: "Parse" },
  parseAgain: { sl: "Razčleni znova", en: "Parse again" },
  review: { sl: "Preglej in potrdi", en: "Review and confirm" },
  reviewLead: {
    sl: "Prepoznana polja so SAMO PREDLOGI — popravi, kar ni pravilno. Neprepoznana polja so prazna (iskrenost, brez ugibanj).",
    en: "Recognized fields are ONLY SUGGESTIONS — fix what is wrong. Unrecognized fields are empty (honesty, no guessing).",
  },
  provider: { sl: "Ponudnik", en: "Provider" },
  providerNone: { sl: "— brez ponudnika —", en: "— no provider —" },
  bookingRef: { sl: "Številka rezervacije", en: "Booking reference" },
  price: { sl: "Cena (EUR)", en: "Price (EUR)" },
  dateStart: { sl: "Prihod / začetek", en: "Check-in / start" },
  dateEnd: { sl: "Odhod / konec", en: "Check-out / end" },
  guests: { sl: "Število oseb", en: "Guests" },
  stopName: { sl: "Ime na poti (postanek)", en: "Name on the trip (stop)" },
  dayIndex: { sl: "Dan poti", en: "Trip day" },
  note: { sl: "Opomba (izbirno)", en: "Note (optional)" },
  submitConfirmed: { sl: "Potrdi rezervacijo", en: "Confirm reservation" },
  submitDraft: {
    sl: "Shrani kot osnutek (manjka številka ali cena)",
    en: "Save as draft (reference or price missing)",
  },
  cancel: { sl: "Prekliči", en: "Cancel" },
  close: { sl: "Zapri", en: "Close" },
  done: {
    sl: "Rezervacija uvožena ✓ — vidiš jo na seznamu rezervacij te poti.",
    en: "Reservation imported ✓ — see it in this trip's reservation list.",
  },
  errGeneric: { sl: "Uvoz ni uspel. Poskusi znova.", en: "Import failed. Try again." },
  attestationNote: {
    sl: "S shranjevanjem potrjuješ, da je to TVOJA prava rezervacija (uporabniška atestacija) — potrditev ponudnika živi pri ponudniku, ne pri nas.",
    en: "By saving you attest this is YOUR real reservation (user attestation) — the provider's confirmation lives with the provider, not with us.",
  },
} as const;

/** Seznam rezervacijskih ponudnikov za izbiro (register, brez goriva). */
const PROVIDER_CHOICES = [
  { id: "booking", name: "Booking.com" },
  { id: "getyourguide", name: "GetYourGuide" },
  { id: "kiwi", name: "Kiwi.com" },
  { id: "rentalcars", name: "Rentalcars.com" },
  { id: "omio", name: "Omio" },
] as const;

interface FormState {
  providerId: string;
  bookingRef: string;
  priceEur: string;
  dateStart: string;
  dateEnd: string;
  guests: string;
  stopName: string;
  dayIndex: string;
  note: string;
}

export function ReservationImportDialog({
  shareId,
  plan,
  onImported,
}: {
  shareId: string;
  plan: SharedPlan | null;
  onImported?: () => void;
}) {
  const l = useLocale();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"paste" | "review">("paste");
  const [raw, setRaw] = React.useState("");
  const [parsed, setParsed] = React.useState<ParsedReservation | null>(null);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const dayCount = Math.max(plan?.days?.length ?? 0, 1);
  const dayOptions = Array.from({ length: Math.min(dayCount, 30) }, (_, i) => i + 1);

  const runParse = () => {
    const result = parseReservationText(raw);
    setParsed(result);
    setForm({
      providerId: result.providerId ?? "none",
      bookingRef: result.bookingRef ?? "",
      priceEur: result.priceEur != null ? String(result.priceEur) : "",
      dateStart: result.dateStartIso ?? "",
      dateEnd: result.dateEndIso ?? "",
      guests: result.guests != null ? String(result.guests) : "",
      stopName: result.titleCandidate ?? "",
      dayIndex: "1",
      note: "",
    });
    setError(null);
    setStep("review");
  };

  const close = () => {
    setOpen(false);
    // Počisti stanje po zaključku animacije.
    window.setTimeout(() => {
      setStep("paste");
      setRaw("");
      setParsed(null);
      setForm(null);
      setError(null);
      setDone(false);
    }, 250);
  };

  const submit = async () => {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const ref = form.bookingRef.trim();
      const price = Number(form.priceEur.replace(",", "."));
      const hasAttestation = ref.length >= 3 && Number.isFinite(price) && price > 0;
      const body: Record<string, unknown> = {
        dayIndex: Number(form.dayIndex) || 1,
        stopName: form.stopName.trim() || (parsed?.providerName ?? "Uvožena rezervacija"),
        status: hasAttestation ? "CONFIRMED" : "IDEA",
        source: "IMPORTED",
        note:
          form.note.trim() ||
          [
            form.dateStart ? `prihod ${form.dateStart}` : null,
            form.dateEnd ? `odhod ${form.dateEnd}` : null,
            form.guests ? `${form.guests} oseb` : null,
            form.providerId !== "none"
              ? `ponudnik: ${PROVIDER_CHOICES.find((p) => p.id === form.providerId)?.name ?? form.providerId}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") ||
          null,
        ...(hasAttestation ? { providerBookingId: ref, confirmedPrice: price } : {}),
      };
      const r = await fetch(`/api/trips/${encodeURIComponent(shareId)}/reservations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? pick(l, L.errGeneric));
        return;
      }
      setDone(true);
      onImported?.();
    } catch {
      setError(pick(l, L.errGeneric));
    } finally {
      setBusy(false);
    }
  };

  const set = (patch: Partial<FormState>) =>
    setForm((f) => (f ? { ...f, ...patch } : f));

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button variant="outline" className="tap-target h-11 font-semibold">
          <ClipboardPaste className="size-4" aria-hidden="true" />
          {pick(l, L.trigger)}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="size-5 text-primary" aria-hidden="true" />
            {pick(l, L.title)}
          </DialogTitle>
          <DialogDescription>{pick(l, L.desc)}</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
            <p className="flex items-center gap-2 font-bold text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
              {pick(l, L.done)}
            </p>
            <Button onClick={close} className="tap-target h-11 font-semibold">
              {pick(l, L.close)}
            </Button>
          </div>
        ) : step === "paste" ? (
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="reservation-paste" className="text-sm font-medium">
                {pick(l, L.paste)}
              </Label>
              <Textarea
                id="reservation-paste"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={pick(l, L.pastePh)}
                className="mt-1.5 min-h-40 font-mono text-xs"
              />
            </div>
            <DialogFooter>
              <Button onClick={close} variant="ghost" className="tap-target h-11">
                {pick(l, L.cancel)}
              </Button>
              <Button
                onClick={runParse}
                disabled={raw.trim().length < 10}
                className="tap-target h-11 font-semibold"
              >
                <FileSearch className="size-4" aria-hidden="true" />
                {pick(l, L.parse)}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          form && (
            <div className="flex flex-col gap-3">
              {parsed?.notes && parsed.notes.length > 0 && (
                <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground scrollbar-slim">
                  {parsed.notes.map((n, i) => (
                    <li key={i}>· {n}</li>
                  ))}
                </ul>
              )}

              <p className="text-xs text-muted-foreground">{pick(l, L.reviewLead)}</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="imp-provider" className="text-sm">
                    {pick(l, L.provider)}
                  </Label>
                  <Select value={form.providerId} onValueChange={(v) => set({ providerId: v })}>
                    <SelectTrigger id="imp-provider" className="mt-1.5 h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{pick(l, L.providerNone)}</SelectItem>
                      {PROVIDER_CHOICES.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="imp-ref" className="text-sm">
                    {pick(l, L.bookingRef)}
                  </Label>
                  <Input
                    id="imp-ref"
                    value={form.bookingRef}
                    onChange={(e) => set({ bookingRef: e.target.value })}
                    className="mt-1.5 h-11 font-mono"
                    placeholder="ABC-1234"
                  />
                </div>
                <div>
                  <Label htmlFor="imp-price" className="text-sm">
                    {pick(l, L.price)}
                  </Label>
                  <Input
                    id="imp-price"
                    inputMode="decimal"
                    value={form.priceEur}
                    onChange={(e) => set({ priceEur: e.target.value })}
                    className="mt-1.5 h-11"
                    placeholder="49.50"
                  />
                </div>
                <div>
                  <Label htmlFor="imp-guests" className="text-sm">
                    {pick(l, L.guests)}
                  </Label>
                  <Input
                    id="imp-guests"
                    inputMode="numeric"
                    value={form.guests}
                    onChange={(e) => set({ guests: e.target.value })}
                    className="mt-1.5 h-11"
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label htmlFor="imp-start" className="text-sm">
                    {pick(l, L.dateStart)}
                  </Label>
                  <Input
                    id="imp-start"
                    type="date"
                    value={form.dateStart}
                    onChange={(e) => set({ dateStart: e.target.value })}
                    className="mt-1.5 h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="imp-end" className="text-sm">
                    {pick(l, L.dateEnd)}
                  </Label>
                  <Input
                    id="imp-end"
                    type="date"
                    value={form.dateEnd}
                    onChange={(e) => set({ dateEnd: e.target.value })}
                    className="mt-1.5 h-11"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="imp-stop" className="text-sm">
                    {pick(l, L.stopName)}
                  </Label>
                  <Input
                    id="imp-stop"
                    value={form.stopName}
                    onChange={(e) => set({ stopName: e.target.value })}
                    className="mt-1.5 h-11"
                    placeholder="Vila Bled"
                  />
                </div>
                <div>
                  <Label htmlFor="imp-day" className="text-sm">
                    {pick(l, L.dayIndex)}
                  </Label>
                  <Select value={form.dayIndex} onValueChange={(v) => set({ dayIndex: v })}>
                    <SelectTrigger id="imp-day" className="mt-1.5 h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dayOptions.map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {`Dan ${d}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="imp-note" className="text-sm">
                    {pick(l, L.note)}
                  </Label>
                  <Input
                    id="imp-note"
                    value={form.note}
                    onChange={(e) => set({ note: e.target.value })}
                    className="mt-1.5 h-11"
                  />
                </div>
              </div>

              <p className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {pick(l, L.attestationNote)}
              </p>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <DialogFooter className="flex-wrap gap-2">
                <Button onClick={() => setStep("paste")} variant="ghost" className="tap-target h-11">
                  {pick(l, L.parseAgain)}
                </Button>
                <Button
                  onClick={() => void submit()}
                  disabled={busy || form.stopName.trim().length < 2}
                  className="tap-target h-11 font-semibold"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {form.bookingRef.trim().length >= 3 && Number(form.priceEur.replace(",", ".")) > 0
                    ? pick(l, L.submitConfirmed)
                    : pick(l, L.submitDraft)}
                </Button>
              </DialogFooter>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
