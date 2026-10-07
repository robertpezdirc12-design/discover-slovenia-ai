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

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useSession } from "next-auth/react";
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
  FlaskConical,
  CalendarDays,
  Users,
  ChevronDown,
  ExternalLink,
  Navigation,
  Route as RouteIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { osmDirectionsUrl } from "@/lib/itinerary-engine";
import { getDestination } from "@/lib/slovenia-data";
import { pick } from "@/lib/i18n-pick";
import type { SharedPlan } from "@/lib/shared-plan";
import {
  noteTextOf,
  parseAttestationNote,
  statusLabel,
} from "@/lib/journey/booking";
import {
  RESERVATION_CHANNEL_LABELS,
  isValidBookingDate,
  parseDemoNote,
  reservationChannelOf,
  searchDemoOffers,
  type DemoOffer,
} from "@/lib/journey/booking-provider";

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

// ── Demo simulator (issue #1 področje 2 — REAL BOOKING VERIGA) ─────────────
// Iskanje ponudbe → izbor → rezervacija → potrditev, IZRECNO označeno kot
// SIMULIRANO (kanal demo je strogo ločen od realnega ponudnika, ki v
// peskovniku ni aktiven — fail-closed 503 na strežniku).
const DEMO_L = {
  bookDemo: { sl: "Rezerviraj (demo)", en: "Book (demo)" },
  modalTitle: { sl: "Išči ponudbo — demo simulator", en: "Search an offer — demo simulator" },
  modalDesc: {
    sl: "Izberi dan, postanek in ponudbo iz našega kanonskega nabora — simulator takoj izstavi demo potrditev.",
    en: "Pick a day, stop and an offer from our canonical set — the simulator issues a demo confirmation instantly.",
  },
  honesty: {
    sl: "DEMO SIMULATOR — rezervacija je simulirana, ni realna potrditev ponudnika.",
    en: "DEMO SIMULATOR — the booking is simulated, not a real provider confirmation.",
  },
  realNote: {
    sl: "Realnega ponudniškega kanala ni mogoče uporabiti (ni poverilnic) — nikoli ne lažemo.",
    en: "The real provider channel cannot be used (no credentials) — we never lie.",
  },
  day: { sl: "Dan", en: "Day" },
  stop: { sl: "Postanek", en: "Stop" },
  customStopLabel: { sl: "Ime postanka (ročni vnos)", en: "Stop name (manual entry)" },
  offerLabel: { sl: "Ponudba", en: "Offer" },
  perPerson: { sl: "/osebo", en: "/person" },
  matchExact: { sl: "ta postanek", en: "this stop" },
  matchRegion: { sl: "ista regija", en: "same region" },
  matchSuggested: { sl: "predlog", en: "suggested" },
  offerEmpty: { sl: "Ni ponudb — izberi drug postanek", en: "No offers — pick another stop" },
  dateLabel: { sl: "Datum", en: "Date" },
  peopleLabel: { sl: "Število ljudi (1–12)", en: "People (1–12)" },
  nameLabel: { sl: "Ime na rezervaciji (neobvezno)", en: "Name on the booking (optional)" },
  submit: { sl: "Rezerviraj (demo)", en: "Book (demo)" },
  successTitle: { sl: "Demo rezervacija potrjena", en: "Demo booking confirmed" },
  successBody: {
    sl: (id: string) => `Številka ${id} je SIMULIRANA potrditev demo simulatorja — ni je mogoče unovčiti pri ponudniku.`,
    en: (id: string) => `Number ${id} is a SIMULATED confirmation of the demo simulator — it cannot be redeemed with a provider.`,
  },
  peopleWord: {
    sl: (n: number) => `${n} ${n === 1 ? "oseba" : n === 2 ? "osebi" : n === 3 || n === 4 ? "osebe" : "oseb"}`,
    en: (n: number) => `${n} ${n === 1 ? "person" : "people"}`,
  },
  editTitle: { sl: "Spremeni demo rezervacijo", en: "Modify demo booking" },
  editDesc: {
    sl: "Spremeni datum, število ljudi ali ime — prehod teče skozi življenjski cikel rezervacije.",
    en: "Change the date, people or name — the change goes through the booking lifecycle.",
  },
  editSubmit: { sl: "Shrani spremembo (demo)", en: "Save change (demo)" },
  modify: { sl: "Spremeni", en: "Modify" },
  cancelDemo: { sl: "Odpovej", en: "Cancel booking" },
  demoProof: { sl: "Demo potrditev", en: "Demo confirmation" },
  channelWord: { sl: "kanal", en: "channel" },
  errOffer: { sl: "Izberi ponudbo iz iskanja.", en: "Pick an offer from the search." },
  errDate: { sl: "Vpiši veljaven datum (YYYY-MM-DD).", en: "Enter a valid date (YYYY-MM-DD)." },
  errPeople: {
    sl: "Število ljudi mora biti celo število med 1 in 12.",
    en: "People must be a whole number between 1 and 12.",
  },
} as const;

/** Kanalne značke vrstic (issue #1: demo/uporabniška/realna — razkritje ob statusu). */
const CHANNEL_BADGES: Record<
  "demo" | "user" | "real",
  { label: { sl: string; en: string }; cls: string }
> = {
  demo: {
    label: RESERVATION_CHANNEL_LABELS.demo,
    // Demo jakost = ORANŽNA (nikoli zelena — simulator ni ponudnik).
    cls: "border-orange-500/50 text-orange-700 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  },
  user: {
    label: RESERVATION_CHANNEL_LABELS.user,
    // Uporabniška atestacija = VIJOLIČNA (kanon 51-c).
    cls: "border-violet-500/50 text-violet-700 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
  },
  real: {
    label: RESERVATION_CHANNEL_LABELS.real,
    // Realni kanal bi bil smaragno „provider potrjen" — v peskovniku se
    // NIKOLI ne izriše (fail-closed 503 na strežniku).
    cls: "border-primary/50 text-primary bg-primary/5",
  },
};

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

// ── MOST REZERVACIJA → NAVIGACIJA (issue #1 področje 5) ───────────────────────
// Vsaka vrstica z ZNANIM destSlug dobi most v navigacijski flow: primarna
// akcija odpri zunanjo navigacijo (OSM) do koordinat destinacije, sekundarna
// pa aplikacijski flow „Na poti" (živi GPS, ETA, napredek). Brez znanega
// sluga/koordinat gumba NI — do neznane lokacije ne navigiramo (iskrenost).
const NAV_L = {
  navigate: { sl: "Navigiraj", en: "Navigate" },
  navigateTo: {
    sl: (name: string) => `Navigiraj do ${name}`,
    en: (name: string) => `Navigate to ${name}`,
  },
  navOptions: {
    sl: "Več možnosti navigacije",
    en: "More navigation options",
  },
  openInGoMode: { sl: "Odpri v Na poti", en: "Open in On the way" },
  goModeHint: {
    sl: "Navigacijski potek aplikacije z živim GPS in ETA",
    en: "The app's navigation flow with live GPS and ETA",
  },
} as const;

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

  // ── Demo simulator (issue #1 področje 2): modal „Išči ponudbo" ──────
  const { data: session } = useSession();
  const myUserId = session?.user?.id ?? null;

  const [demoOpen, setDemoOpen] = useState(false);
  const [demoDay, setDemoDay] = useState("1");
  const [demoStop, setDemoStop] = useState("");
  const [demoCustomStop, setDemoCustomStop] = useState("");
  const [demoOfferId, setDemoOfferId] = useState("");
  const [demoDate, setDemoDate] = useState("");
  const [demoPeople, setDemoPeople] = useState("2");
  const [demoName, setDemoName] = useState("");
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoDone, setDemoDone] = useState<{
    providerBookingId: string;
    price: number;
    stopName: string;
    people: number;
    date: string;
  } | null>(null);

  // Demo „Spremeni" modal (PATCH modify — življenjski cikel)
  const [demoEdit, setDemoEdit] = useState<ReservationRow | null>(null);
  const [demoEditDate, setDemoEditDate] = useState("");
  const [demoEditPeople, setDemoEditPeople] = useState("");
  const [demoEditName, setDemoEditName] = useState("");
  const [demoEditError, setDemoEditError] = useState<string | null>(null);

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

  // Demo izpeljave: dan → postanek → slug destinacije (čisto iskanje).
  const demoDayNumber = Math.min(Number(demoDay) || 1, Math.max(days.length, 1));
  const demoSelectedDay = days.find((d) => d.day === demoDayNumber) ?? days[0];
  const demoStops = demoSelectedDay?.locations ?? [];
  const demoPeopleNum = Math.min(
    Math.max(Math.round(Number(demoPeople) || 0), 1),
    12
  );
  const demoStopSlug =
    demoStop === CUSTOM_STOP
      ? null
      : demoStops[Number(demoStop)]?.destSlug ?? null;
  const demoOffers = useMemo<DemoOffer[]>(
    () => searchDemoOffers(demoStopSlug, demoPeopleNum),
    [demoStopSlug, demoPeopleNum]
  );
  const selectedDemoOffer =
    demoOffers.find((o) => o.offerId === demoOfferId) ?? null;

  // Ob spremenjenem dnevu/odpiranju ponastavi izbiro demo postanka.
  useEffect(() => {
    setDemoStop(demoStops.length > 0 ? String(0) : CUSTOM_STOP);
  }, [demoDay, demoStops.length]);

  // Ponudba izven seznama (spremenjen postanek) → pošteno izberi prvo.
  useEffect(() => {
    if (demoOffers.length > 0 && !demoOffers.some((o) => o.offerId === demoOfferId)) {
      setDemoOfferId(demoOffers[0].offerId);
    }
  }, [demoOffers, demoOfferId]);

  const closeDemoModal = useCallback(() => {
    setDemoOpen(false);
    setDemoError(null);
    setDemoDone(null);
  }, []);

  /** Odpri modal „Išči ponudbo" s čistim stanjem. */
  const openDemoModal = useCallback(() => {
    setDemoDay("1");
    setDemoCustomStop("");
    setDemoOfferId("");
    setDemoDate("");
    setDemoPeople("2");
    setDemoName("");
    setDemoError(null);
    setDemoDone(null);
    setDemoOpen(true);
  }, []);

  /** POST /api/journey/bookings — demo rezervacija (server kuje DSA-DEMO-XXXX). */
  const submitDemoBooking = useCallback(async () => {
    const offer = demoOffers.find((o) => o.offerId === demoOfferId) ?? null;
    if (!offer) {
      setDemoError(pick(l, DEMO_L.errOffer));
      return;
    }
    if (!isValidBookingDate(demoDate)) {
      setDemoError(pick(l, DEMO_L.errDate));
      return;
    }
    const people = Math.round(Number(demoPeople));
    if (!Number.isInteger(people) || people < 1 || people > 12) {
      setDemoError(pick(l, DEMO_L.errPeople));
      return;
    }
    const customStopName =
      demoStop === CUSTOM_STOP
        ? demoCustomStop.trim()
        : demoStops[Number(demoStop)]?.name ?? "";
    const stopName = customStopName.length >= 2
      ? customStopName
      : `${offer.title.sl} (${offer.destinationName})`;
    const stopSlug =
      demoStop === CUSTOM_STOP ? null : demoStops[Number(demoStop)]?.destSlug ?? null;

    setBusy(true);
    setDemoError(null);
    try {
      const r = await fetch("/api/journey/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shareId,
          dayIndex: demoDayNumber,
          stopSlug,
          stopName,
          offerId: offer.offerId,
          date: demoDate,
          people,
          name: demoName.trim() || null,
        }),
      });
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        providerBookingId?: string;
        price?: number;
        reservation?: { stopName?: string };
      } | null;
      if (!r.ok || !data?.success) {
        // Iskrena napaka strežnika (401/403/404/503 „realni kanal ni aktiven").
        setDemoError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      setDemoDone({
        providerBookingId: data.providerBookingId ?? "",
        price: typeof data.price === "number" ? data.price : offer.totalPrice,
        stopName: data.reservation?.stopName ?? stopName,
        people,
        date: demoDate,
      });
      setActionError(null);
      await load();
    } catch (e) {
      setDemoError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [shareId, l, demoOffers, demoOfferId, demoDate, demoPeople, demoStop, demoCustomStop, demoStops, demoName, demoDayNumber, load]);

  /** PATCH action:"cancel" — preklic DEMO rezervacije (CANCELLED terminalen). */
  const cancelDemoReservation = useCallback(
    async (id: string) => {
      setBusy(true);
      setActionError(null);
      try {
        const r = await fetch("/api/journey/bookings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reservationId: id, action: "cancel" }),
        });
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
    [load]
  );

  /** Odpri modal „Spremeni demo rezervacijo" (predhodno polnjenje iz note). */
  const openDemoEdit = useCallback((row: ReservationRow) => {
    const record = parseDemoNote(row.note);
    setDemoEdit(row);
    setDemoEditDate(record?.date ?? "");
    setDemoEditPeople(record ? String(record.people) : "");
    setDemoEditName(record?.name ?? "");
    setDemoEditError(null);
  }, []);

  /** PATCH action:"modify" — sprememba DEMO rezervacije (CONFIRMED→MODIFIED). */
  const submitDemoModify = useCallback(async () => {
    if (!demoEdit) return;
    if (!isValidBookingDate(demoEditDate)) {
      setDemoEditError(pick(l, DEMO_L.errDate));
      return;
    }
    const people = Math.round(Number(demoEditPeople));
    if (!Number.isInteger(people) || people < 1 || people > 12) {
      setDemoEditError(pick(l, DEMO_L.errPeople));
      return;
    }
    setBusy(true);
    setDemoEditError(null);
    try {
      const r = await fetch("/api/journey/bookings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reservationId: demoEdit.id,
          action: "modify",
          date: demoEditDate,
          people,
          name: demoEditName.trim() || null,
        }),
      });
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!r.ok || !data?.success) {
        setDemoEditError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      setDemoEdit(null);
      setActionError(null);
      await load();
    } catch (e) {
      setDemoEditError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [demoEdit, demoEditDate, demoEditPeople, demoEditName, l, load]);

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
              // Kanal zapisa (issue #1): demo simulator / uporabniška
              // atestacija / realni ponudnik — razkritje ob statusnem žetonu.
              const channel = reservationChannelOf(b.note);
              const channelBadge = channel ? CHANNEL_BADGES[channel] : null;
              const demoRecord = channel === "demo" ? parseDemoNote(b.note) : null;
              // Demo rezervacijo spreminja SAMO njen lastnik (strežnik
              // preverja createdBy; UI le pošteno skrije tuje akcije).
              const demoMine = channel === "demo" && b.createdBy === myUserId;
              // MOST v navigacijo (issue #1 področje 5): postanek z znanim
              // destSlug → destinacija s koordinatami; ročni vnosi (brez
              // sluga) ostanejo brez navigacije — do neznane lokacije ne
              // ponujamo poti (iskrenost).
              const navDest = b.stopSlug ? getDestination(b.stopSlug) : null;
              return (
                <li key={b.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Dan {b.dayIndex}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold break-words">
                      {b.stopName}
                    </span>
                    <Badge variant="outline" className={badge?.cls ?? "border-border"}>
                      {badgeLabel}
                    </Badge>
                    {channelBadge ? (
                      <Badge
                        variant="outline"
                        className={`gap-1 ${channelBadge.cls}`}
                        title={`${pick(l, DEMO_L.channelWord)}: ${channel}`}
                      >
                        {channel === "demo" ? (
                          <FlaskConical className="size-3" aria-hidden="true" />
                        ) : null}
                        {pick(l, channelBadge.label)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {/* DEMO razkritje: št. simulirane potrditve + cena + */}
                    {/* datum/ljudje — izrecno „demo", nikoli provider. */}
                    {demoRecord ? (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-foreground/80">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <FlaskConical
                            className="size-3.5 shrink-0 text-orange-600 dark:text-orange-400"
                            aria-hidden="true"
                          />
                          {pick(l, DEMO_L.demoProof)}: {demoRecord.providerBookingId}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatPriceEUR(demoRecord.price, lang)}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {DEMO_L.peopleWord[lang](demoRecord.people)} · {demoRecord.date}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          kanal: demo (simulator)
                        </span>
                      </div>
                    ) : attestation ? (
                      /* Razkritje izvora: št. rezervacije + cena + source — */
                      /* vedno uporabniška atestacija, nikoli provider kanal. */
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

                  {/* ── MOST REZERVACIJA → NAVIGACIJA (issue #1 §5) ──────────
                      Na voljo VSEM (tudi ne-urednikom) — navigacija ni
                      mutacija. Primarno: zunanja navigacija do koordinat
                      destinacije (OSM, nov zavihek, rel=noopener). */}
                  {navDest ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="min-h-11 gap-1.5 border-primary/40 font-semibold text-primary"
                      >
                        <a
                          href={osmDirectionsUrl(navDest.coords)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={pick(l, NAV_L.navigateTo)(b.stopName)}
                          title={pick(l, NAV_L.navigateTo)(b.stopName)}
                        >
                          <Navigation className="size-4" aria-hidden="true" />
                          {pick(l, NAV_L.navigate)}
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                      </Button>
                      {/* Sekundarno: aplikacijski navigacijski flow (Na poti —
                          živi GPS, ETA, napredek po poti). */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-11 gap-1 px-3"
                            aria-label={pick(l, NAV_L.navOptions)}
                          >
                            <RouteIcon className="size-4" aria-hidden="true" />
                            <ChevronDown className="size-3.5" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem asChild>
                            <Link
                              href="/na-poti"
                              title={pick(l, NAV_L.goModeHint)}
                              className="gap-2"
                            >
                              <RouteIcon className="size-4" aria-hidden="true" />
                              {pick(l, NAV_L.openInGoMode)}
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}
                  {canEdit ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {/* ── Demo akcije (PATCH /api/journey/bookings) ── */}
                      {demoMine ? (
                        <>
                          {b.status === "CONFIRMED" || b.status === "MODIFIED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDemoEdit(b)}
                              disabled={busy}
                              className="min-h-11 gap-1.5"
                            >
                              <PenLine className="size-4" aria-hidden="true" />
                              {pick(l, DEMO_L.modify)}
                            </Button>
                          ) : null}
                          {b.status !== "CANCELLED" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void cancelDemoReservation(b.id)}
                              disabled={busy}
                              className="min-h-11 gap-1.5"
                            >
                              <Ban className="size-4" aria-hidden="true" />
                              {pick(l, DEMO_L.cancelDemo)}
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      {/* ── S1 atestacijske akcije (kanon 51-c ostaja) ── */}
                      {!demoRecord && b.status === "IDEA" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openConfirmModal({ kind: "confirm", row: b })}
                          disabled={busy}
                          className="min-h-11 gap-1.5"
                        >
                          <CircleCheck className="size-4" aria-hidden="true" />
                          {pick(l, L.confirmReservation)}
                        </Button>
                      ) : null}
                      {!demoRecord && (b.status === "CONFIRMED" || b.status === "MODIFIED") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openConfirmModal({ kind: "update", row: b })}
                          disabled={busy}
                          className="min-h-11 gap-1.5"
                        >
                          <PenLine className="size-4" aria-hidden="true" />
                          {pick(l, L.updateProof)}
                        </Button>
                      ) : null}
                      {!demoRecord && b.status !== "CANCELLED" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void cancelReservation(b.id)}
                          disabled={busy}
                          className="min-h-11 gap-1.5"
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
                        className="min-h-11 gap-1.5 text-destructive hover:text-destructive"
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
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormOpen(true)}
                className="min-h-11 gap-1.5"
              >
                <Plus className="size-4" aria-hidden="true" />
                Dodaj rezervacijo
              </Button>
              {/* Demo simulator (issue #1): celotna veriga iskanje → izbor →
                  rezervacija → potrditev — IZRECNO označena kot demo. */}
              <Button
                variant="outline"
                size="sm"
                onClick={openDemoModal}
                className="min-h-11 gap-1.5 border-orange-500/50 text-orange-700 hover:text-orange-800 dark:border-orange-700 dark:text-orange-300"
              >
                <FlaskConical className="size-4" aria-hidden="true" />
                {pick(l, DEMO_L.bookDemo)}
              </Button>
            </div>
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

        {/* ── Modal: Išči ponudbo — DEMO SIMULATOR (issue #1) ─────────── */}
        <Dialog
          open={demoOpen}
          onOpenChange={(open) => {
            if (!open) closeDemoModal();
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FlaskConical
                  className="size-5 text-orange-600 dark:text-orange-400"
                  aria-hidden="true"
                />
                {pick(l, DEMO_L.modalTitle)}
              </DialogTitle>
              <DialogDescription>{pick(l, DEMO_L.modalDesc)}</DialogDescription>
            </DialogHeader>

            {/* IZRECNA pasica — oranžna jakost, NIKOLI zelena */}
            <p
              role="note"
              className="flex items-start gap-2 rounded-md border border-orange-500/50 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
            >
              <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {pick(l, DEMO_L.honesty)}
            </p>

            {demoDone ? (
              <div className="space-y-3" role="status">
                <div className="flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-50/60 p-3 dark:border-orange-700/60 dark:bg-orange-950/30">
                  <CircleCheck
                    className="mt-0.5 size-5 shrink-0 text-orange-600 dark:text-orange-400"
                    aria-hidden="true"
                  />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">{pick(l, DEMO_L.successTitle)}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {demoDone.stopName}
                      </span>{" "}
                      · {formatPriceEUR(demoDone.price, lang)} ·{" "}
                      {DEMO_L.peopleWord[lang](demoDone.people)} · {demoDone.date}
                    </p>
                    <p className="font-mono text-xs">{demoDone.providerBookingId}</p>
                    <p className="text-xs text-muted-foreground">
                      {DEMO_L.successBody[lang](demoDone.providerBookingId)}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {pick(l, DEMO_L.realNote)}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-day">{pick(l, DEMO_L.day)}</Label>
                    <Select value={String(demoDayNumber)} onValueChange={setDemoDay}>
                      <SelectTrigger id="demo-day" className="w-full">
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
                    <Label htmlFor="demo-stop">{pick(l, DEMO_L.stop)}</Label>
                    <Select value={demoStop} onValueChange={setDemoStop}>
                      <SelectTrigger id="demo-stop" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {demoStops.map((s, i) => (
                          <SelectItem key={`demo-${s.name}-${i}`} value={String(i)}>
                            {s.name}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_STOP}>
                          Drugo (ročni vnos)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {demoStop === CUSTOM_STOP ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-custom-stop">{pick(l, DEMO_L.customStopLabel)}</Label>
                    <Input
                      id="demo-custom-stop"
                      value={demoCustomStop}
                      maxLength={200}
                      onChange={(e) => setDemoCustomStop(e.target.value)}
                      placeholder="npr. Gostilna Pri Lovcu"
                    />
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="demo-offer">{pick(l, DEMO_L.offerLabel)}</Label>
                  {demoOffers.length > 0 ? (
                    <Select value={demoOfferId} onValueChange={setDemoOfferId}>
                      <SelectTrigger id="demo-offer" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {demoOffers.map((o) => (
                          <SelectItem key={o.offerId} value={o.offerId}>
                            {pick(l, o.title)} ({o.destinationName}) —{" "}
                            {formatPriceEUR(o.pricePerPerson, lang)}
                            {pick(l, DEMO_L.perPerson)} ·{" "}
                            {o.match === "exact"
                              ? pick(l, DEMO_L.matchExact)
                              : o.match === "region"
                                ? pick(l, DEMO_L.matchRegion)
                                : pick(l, DEMO_L.matchSuggested)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {pick(l, DEMO_L.offerEmpty)}
                    </p>
                  )}
                  {selectedDemoOffer ? (
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      {pick(l, selectedDemoOffer.title)} ·{" "}
                      {formatPriceEUR(selectedDemoOffer.pricePerPerson, lang)}
                      {pick(l, DEMO_L.perPerson)} →{" "}
                      <span className="font-medium text-foreground">
                        {formatPriceEUR(selectedDemoOffer.totalPrice, lang)}
                      </span>{" "}
                      ({DEMO_L.peopleWord[lang](demoPeopleNum)})
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-date" className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                      {pick(l, DEMO_L.dateLabel)} *
                    </Label>
                    <Input
                      id="demo-date"
                      type="date"
                      value={demoDate}
                      onChange={(e) => setDemoDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-people" className="flex items-center gap-1.5">
                      <Users className="size-3.5" aria-hidden="true" />
                      {pick(l, DEMO_L.peopleLabel)} *
                    </Label>
                    <Input
                      id="demo-people"
                      inputMode="numeric"
                      value={demoPeople}
                      onChange={(e) => setDemoPeople(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-name">{pick(l, DEMO_L.nameLabel)}</Label>
                    <Input
                      id="demo-name"
                      value={demoName}
                      maxLength={120}
                      onChange={(e) => setDemoName(e.target.value)}
                      placeholder={session?.user?.name ?? ""}
                      autoComplete="off"
                    />
                  </div>
                </div>

                {demoError ? (
                  <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {demoError}
                  </p>
                ) : null}
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {pick(l, DEMO_L.realNote)}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={closeDemoModal} disabled={busy}>
                {pick(l, L.close)}
              </Button>
              {demoDone ? null : (
                <Button
                  size="sm"
                  onClick={() => void submitDemoBooking()}
                  disabled={busy || demoOffers.length === 0}
                  className="gap-1.5"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <FlaskConical className="size-4" aria-hidden="true" />
                  )}
                  {pick(l, DEMO_L.submit)}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Modal: Spremeni demo rezervacijo (PATCH modify) ─────────── */}
        <Dialog
          open={demoEdit !== null}
          onOpenChange={(open) => {
            if (!open) setDemoEdit(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FlaskConical
                  className="size-5 text-orange-600 dark:text-orange-400"
                  aria-hidden="true"
                />
                {pick(l, DEMO_L.editTitle)}
              </DialogTitle>
              <DialogDescription>{pick(l, DEMO_L.editDesc)}</DialogDescription>
            </DialogHeader>

            <p
              role="note"
              className="flex items-start gap-2 rounded-md border border-orange-500/50 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
            >
              <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {pick(l, DEMO_L.honesty)}
            </p>

            {demoEdit ? (
              <p className="text-xs text-muted-foreground">
                {demoEdit.stopName} ·{" "}
                <span className="font-mono">
                  {parseDemoNote(demoEdit.note)?.providerBookingId ?? ""}
                </span>
              </p>
            ) : null}

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="demo-edit-date" className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {pick(l, DEMO_L.dateLabel)} *
                </Label>
                <Input
                  id="demo-edit-date"
                  type="date"
                  value={demoEditDate}
                  onChange={(e) => setDemoEditDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-edit-people" className="flex items-center gap-1.5">
                  <Users className="size-3.5" aria-hidden="true" />
                  {pick(l, DEMO_L.peopleLabel)} *
                </Label>
                <Input
                  id="demo-edit-people"
                  inputMode="numeric"
                  value={demoEditPeople}
                  onChange={(e) => setDemoEditPeople(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-edit-name">{pick(l, DEMO_L.nameLabel)}</Label>
                <Input
                  id="demo-edit-name"
                  value={demoEditName}
                  maxLength={120}
                  onChange={(e) => setDemoEditName(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            {demoEditError ? (
              <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {demoEditError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDemoEdit(null)}
                disabled={busy}
              >
                {pick(l, L.close)}
              </Button>
              <Button
                size="sm"
                onClick={() => void submitDemoModify()}
                disabled={busy}
                className="gap-1.5"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FlaskConical className="size-4" aria-hidden="true" />
                )}
                {pick(l, DEMO_L.editSubmit)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
