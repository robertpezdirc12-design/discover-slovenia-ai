"use client";

import {
  ArrowRight,
  CalendarDays,
  Clock,
  CloudUpload,
  FileDown,
  HardDrive,
  Loader2,
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
import QRCode from "qrcode";
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
import { TripWatchMenu } from "@/components/watch/trip-watch-menu";
import { TripPolls } from "@/components/trips/trip-polls";
import { TripReservations } from "@/components/trips/trip-reservations";
import { TripDatesPanel } from "@/components/trips/trip-dates-panel";
import { ReservationImportDialog } from "@/components/trips/reservation-import-dialog";
import { PrintableConfirmation } from "@/components/trips/printable-confirmation";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { intlDateLocale } from "@/lib/intl-locale";
import { myTrip } from "@/lib/my-trip";
import { getDestination } from "@/lib/slovenia-data";
import { type SharedPlan, sharedPlans } from "@/lib/shared-plan";
import { buildTripPdf, fromSharedPlan } from "@/lib/pdf/trip-pdf-doc";
import { downloadTripPdf } from "@/lib/pdf/trip-pdf-render";
import { addDaysIso, eachTripDay, type TripDates } from "@/lib/trip-dates";
import { buildTripIcs, downloadTripIcs } from "@/lib/trip-ics";

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
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [pdfError, setPdfError] = React.useState<string | null>(null);

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
    kicker: { sl: "Deljena pot", en: "Shared trip", it: "Viaggio condiviso", de: "Geteilte Reise", fr: "Voyage partagé", es: "Viaje compartido" },
    nameFallback: { sl: "AI načrt potovanja po Sloveniji", en: "AI travel plan around Slovenia", it: "Piano di viaggio AI per la Slovenia", de: "KI-Reiseplan durch Slowenien", fr: "Plan de voyage IA à travers la Slovénie", es: "Plan de viaje IA por Eslovenia" },
    dayLabel: { sl: (n: number) => `Dan ${n}`, en: (n: number) => `Day ${n}`, it: (n: number) => `Giorno ${n}`, de: (n: number) => `Tag ${n}`, fr: (n: number) => `Jour ${n}`, es: (n: number) => `Día ${n}` },
    budget: { sl: (n: number) => `Skupni proračun ≈ ${n} €`, en: (n: number) => `Total budget ≈ €${n}`, it: (n: number) => `Budget totale ≈ ${n} €`, de: (n: number) => `Gesamtbudget ≈ ${n} €`, fr: (n: number) => `Budget total ≈ ${n} €`, es: (n: number) => `Presupuesto total ≈ ${n} €` },
    daysCount: { sl: (n: number) => (n === 1 ? "1 dan" : `${n} dni`), en: (n: number) => (n === 1 ? "1 day" : `${n} days`), it: (n: number) => (n === 1 ? "1 giorno" : `${n} giorni`), de: (n: number) => (n === 1 ? "1 Tag" : `${n} Tage`), fr: (n: number) => (n === 1 ? "1 jour" : `${n} jours`), es: (n: number) => (n === 1 ? "1 día" : `${n} días`) },
    stops: { sl: (n: number) => (n === 1 ? "1 postanek" : `${n} postankov`), en: (n: number) => (n === 1 ? "1 stop" : `${n} stops`), it: (n: number) => (n === 1 ? "1 fermata" : `${n} fermate`), de: (n: number) => (n === 1 ? "1 Stopp" : `${n} Stopps`), fr: (n: number) => (n === 1 ? "1 arrêt" : `${n} arrêts`), es: (n: number) => (n === 1 ? "1 parada" : `${n} paradas`) },
    addTrip: { sl: "Dodaj v mojo pot", en: "Add to my trip", it: "Aggiungi al mio viaggio", de: "Zu meiner Reise hinzufügen", fr: "Ajouter à mon voyage", es: "Añadir a mi viaje" },
    added: { sl: "Dodano ✓", en: "Added ✓", it: "Aggiunto ✓", de: "Hinzugefügt ✓", fr: "Ajouté ✓", es: "Añadido ✓" },
    addAll: { sl: "Dodaj celo pot v mojo pot", en: "Add the whole trip to my trip", it: "Aggiungi l’intero viaggio al mio viaggio", de: "Ganze Reise zu meiner Reise hinzufügen", fr: "Ajouter tout le voyage à mon voyage", es: "Añadir todo el viaje a mi viaje" },
    print: { sl: "Natisni / shrani PDF", en: "Print / save PDF", it: "Stampa / salva PDF", de: "Drucken / als PDF speichern", fr: "Imprimer / enregistrer en PDF", es: "Imprimir / guardar PDF" },
    pdfBtn: { sl: "Izvozi PDF", en: "Export PDF", it: "Esporta PDF", de: "PDF exportieren", fr: "Exporter en PDF", es: "Exportar PDF" },
    pdfBusy: { sl: "Pripravljam PDF …", en: "Preparing PDF …", it: "Preparo il PDF …", de: "PDF wird vorbereitet …", fr: "Préparation du PDF …", es: "Preparando PDF …" },
    pdfErr: { sl: "PDF izvoz ni uspel — poskusi znova.", en: "PDF export failed — try again.", it: "Esportazione PDF non riuscita — riprova.", de: "PDF-Export fehlgeschlagen — bitte erneut versuchen.", fr: "Échec de l'export PDF — réessaie.", es: "Fallo al exportar PDF — reinténtalo." },
    printFooter: { sl: "Izvoženo z Discover Slovenia AI", en: "Exported with Discover Slovenia AI", it: "Esportato con Discover Slovenia AI", de: "Exportiert mit Discover Slovenia AI", fr: "Exporté avec Discover Slovenia AI", es: "Exportado con Discover Slovenia AI" },
    qrTitle: { sl: "QR koda te povezave", en: "QR code of this link", it: "Codice QR di questo link", de: "QR-Code dieses Links", fr: "Code QR de ce lien", es: "Código QR de este enlace" },
    qrNote: {
      sl: "Skeniraj s telefonom in odpri to pot — koda vsebuje samo javno povezavo.",
      en: "Scan with your phone to open this trip — the code contains only the public link.",
      it: "Scansiona con il telefono per aprire questo viaggio — il codice contiene solo il link pubblico.",
      de: "Scanne mit deinem Handy, um diese Reise zu öffnen — der Code enthält nur den öffentlichen Link.",
      fr: "Scanne avec ton téléphone pour ouvrir ce voyage — le code ne contient que le lien public.",
      es: "Escanea con tu móvil para abrir este viaje — el código contiene solo el enlace público.",
    },
    copy: { sl: "Kopiraj povezavo", en: "Copy link", it: "Copia link", de: "Link kopieren", fr: "Copier le lien", es: "Copiar enlace" },
    copied: { sl: "Povezava skopirana!", en: "Link copied!", it: "Link copiato!", de: "Link kopiert!", fr: "Lien copié !", es: "¡Enlace copiado!" },
    // P0-G (issue §17): ICS izvoz v koledar
    icsBtn: { sl: "Dodaj v koledar (.ics)", en: "Add to calendar (.ics)", it: "Aggiungi al calendario (.ics)", de: "Zum Kalender hinzufügen (.ics)", fr: "Ajouter au calendrier (.ics)", es: "Añadir al calendario (.ics)" },
    icsNoDates: {
      sl: "Najprej določi realne datume poti — izvoz v koledar potrebuje dneve.",
      en: "Set the real trip dates first — the calendar export needs the days.",
      it: "Imposta prima le date reali del viaggio — l’esportazione nel calendario richiede i giorni.",
      de: "Lege zuerst die echten Reisedaten fest — der Kalenderexport braucht die Tage.",
      fr: "Définis d’abord les vraies dates du voyage — l’export vers le calendrier a besoin des jours.",
      es: "Establece primero las fechas reales del viaje — la exportación al calendario necesita los días.",
    },
    loading: { sl: "Nalagam deljeno pot …", en: "Loading the shared trip …", it: "Caricamento del viaggio condiviso …", de: "Geteilte Reise wird geladen …", fr: "Chargement du voyage partagé …", es: "Cargando el viaje compartido …" },
    notFoundTitle: { sl: "Ta pot ni (več) na tej napravi", en: "This trip is not (anymore) on this device", it: "Questo viaggio non è (più) su questo dispositivo", de: "Diese Reise ist nicht (mehr) auf diesem Gerät", fr: "Ce voyage n’est pas (plus) sur cet appareil", es: "Este viaje no está (ya) en este dispositivo" },
    notFoundBody: {
      sl: "Te pote ni niti v oblaku (ali ni javna in nisi sodelujoči) niti v lokalni shrambi tega brskalnika. Če ti je nekdo poslal povezavo, prosi za vabilo (sodelovanje) ali nov izvoz (natis ali besedilni načrt).",
      en: "This trip is neither in the cloud (or it is private and you are not a collaborator) nor in this browser's local storage. If someone sent you the link, ask for an invite (collaboration) or a new export (print or a text plan).",
      it: "Questo viaggio non è né nel cloud (oppure è privato e non sei un collaboratore) né nella memoria locale di questo browser. Se qualcuno ti ha inviato il link, chiedi un invito (collaborazione) o una nuova esportazione (stampa o piano testuale).",
      de: "Diese Reise ist weder in der Cloud (oder sie ist privat und du bist kein Mitwirkender) noch im lokalen Speicher dieses Browsers. Wenn dir jemand den Link geschickt hat, bitte um eine Einladung (Kollaboration) oder einen neuen Export (Ausdruck oder Textplan).",
      fr: "Ce voyage n’est ni dans le cloud (ou il est privé et tu n’es pas collaborateur) ni dans le stockage local de ce navigateur. Si quelqu’un t’a envoyé le lien, demande une invitation (collaboration) ou un nouvel export (impression ou plan texte).",
      es: "Este viaje no está ni en la nube (o es privado y no eres colaborador) ni en el almacenamiento local de este navegador. Si alguien te envió el enlace, pide una invitación (colaboración) o una nueva exportación (impresión o plan de texto).",
    },
    planCta: { sl: "Sestavi svoj načrt", en: "Build your own plan", it: "Crea il tuo piano", de: "Baue deinen eigenen Plan", fr: "Crée ton propre plan", es: "Crea tu propio plan" },
    localNote: {
      sl: "Rekonstrukcija: izvirnik hrani deljene pote v bazi z javnimi povezavami; tukaj je vir lokalna shramba (iskrenost — brez baze v tej fazi).",
      en: "Reconstruction: the original stores shared trips in a database with public links; here the source is local storage (honest — no database in this phase).",
      it: "Ricostruzione: l’originale salva i viaggi condivisi in un database con link pubblici; qui la fonte è la memoria locale (onestà — nessun database in questa fase).",
      de: "Rekonstruktion: das Original speichert geteilte Reisen in einer Datenbank mit öffentlichen Links; hier ist die Quelle der lokale Speicher (Ehrlichkeit — keine Datenbank in dieser Phase).",
      fr: "Reconstruction : l’original stocke les voyages partagés dans une base de données avec des liens publics ; ici, la source est le stockage local (honnêteté — pas de base de données dans cette phase).",
      es: "Reconstrucción: el original guarda los viajes compartidos en una base de datos con enlaces públicos; aquí la fuente es el almacenamiento local (honestidad — sin base de datos en esta fase).",
    },
    exploreDest: { sl: "Odpri destinacijo", en: "Open destination", it: "Apri la destinazione", de: "Destination öffnen", fr: "Ouvrir la destination", es: "Abrir el destino" },
    createdAt: { sl: "Ustvarjeno", en: "Created", it: "Creato", de: "Erstellt", fr: "Créé", es: "Creado" },
    // 48-a: zavihki skupnostnih funkcij
    tabTrip: { sl: "Pot", en: "Trip", it: "Viaggio", de: "Reise", fr: "Voyage", es: "Viaje" },
    tabCollab: { sl: "Sodelovanje", en: "Collaboration", it: "Collaborazione", de: "Kollaboration", fr: "Collaboration", es: "Colaboración" },
    tabReservations: { sl: "Rezervacije", en: "Reservations", it: "Prenotazioni", de: "Reservierungen", fr: "Réservations", es: "Reservas" },
    tabPolls: { sl: "Ankete", en: "Polls", it: "Sondaggi", de: "Umfragen", fr: "Sondages", es: "Encuestas" },
    tabChat: { sl: "Klepet", en: "Chat", it: "Chat", de: "Chat", fr: "Chat", es: "Chat" },
    // 48-a: pasica uvoza v oblak
    cloudTitle: { sl: "Sodelovanje v živo — shrani pot v oblak", en: "Live collaboration — save this trip to the cloud", it: "Collaborazione in tempo reale — salva il viaggio nel cloud", de: "Live-Kollaboration — speichere diese Reise in der Cloud", fr: "Collaboration en direct — enregistre ce voyage dans le cloud", es: "Colaboración en vivo — guarda este viaje en la nube" },
    cloudBody: {
      sl: "Ta pot živi samo na tej napravi (lokalna shramba). S shranitvijo v oblak odkleneš vabila, skupinske ankete, rezervacije in klepet z @AI — poti se sinhronizirajo z računom.",
      en: "This trip lives only on this device (local storage). Saving it to the cloud unlocks invites, group polls, reservations and the @AI chat — trips sync with your account.",
      it: "Questo viaggio vive solo su questo dispositivo (memoria locale). Salvarlo nel cloud sblocca inviti, sondaggi di gruppo, prenotazioni e la chat con @AI — i viaggi si sincronizzano con l’account.",
      de: "Diese Reise lebt nur auf diesem Gerät (lokaler Speicher). Wenn du sie in der Cloud speicherst, schaltest du Einladungen, Gruppenumfragen, Reservierungen und den @AI-Chat frei — Reisen synchronisieren sich mit dem Konto.",
      fr: "Ce voyage ne vit que sur cet appareil (stockage local). L’enregistrer dans le cloud déverrouille les invitations, les sondages de groupe, les réservations et le chat avec @AI — les voyages se synchronisent avec le compte.",
      es: "Este viaje vive solo en este dispositivo (almacenamiento local). Guardarlo en la nube desbloquea invitaciones, encuestas de grupo, reservas y el chat con @AI — los viajes se sincronizan con la cuenta.",
    },
    cloudCta: { sl: "Shrani v oblak", en: "Save to the cloud", it: "Salva nel cloud", de: "In der Cloud speichern", fr: "Enregistrer dans le cloud", es: "Guardar en la nube" },
    cloudSaving: { sl: "Shranjujem …", en: "Saving …", it: "Salvataggio …", de: "Speichern …", fr: "Enregistrement …", es: "Guardando …" },
    cloudLogin: { sl: "Prijavi se za shranjevanje", en: "Sign in to save", it: "Accedi per salvare", de: "Zum Speichern anmelden", fr: "Connecte-toi pour enregistrer", es: "Inicia sesión para guardar" },
    cloudNote: {
      sl: "Vir: baza (oblak) — sodelovanje urejeno po vlogah (lastnik/urednik/gledalec).",
      en: "Source: database (cloud) — collaboration managed by roles (owner/editor/viewer).",
      it: "Fonte: database (cloud) — collaborazione gestita per ruoli (proprietario/editor/visualizzatore).",
      de: "Quelle: Datenbank (Cloud) — Kollaboration rollenbasiert verwaltet (Besitzer/Bearbeiter/Betrachter).",
      fr: "Source : base de données (cloud) — collaboration gérée par rôles (propriétaire/éditeur/lecteur).",
      es: "Fuente: base de datos (nube) — colaboración gestionada por roles (propietario/editor/lector).",
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

  // P0-G (issue §17): izvoz .ics — dnevi poti (eachTripDay, DST-varno) +
  // postanki načrta po dnevih; brez realnih datumov gumba sploh ni
  // (iskrena odsotnost, ne izmišljeni "približni" datumi).
  const onIcsExport = React.useCallback(() => {
    if (!db?.tripDates || !db.plan) return;
    const days = eachTripDay(db.tripDates);
    if (!days) return;
    const planDays = db.plan.days;
    const ics = buildTripIcs({
      title: db.name ?? db.plan.name ?? "Pot",
      dateStart: db.tripDates.start,
      dateEnd: db.tripDates.end,
      uidKey: shareId,
      url: pageUrl || undefined,
      now: new Date(),
      days: days.map((d) => {
        const planDay = planDays[d.dayIndex - 1];
        const stops = (planDay?.locations ?? [])
          .map((loc) => loc.name)
          .join(" → ");
        const dayLabel = pick(l, L.dayLabel);
        return {
          date: d.iso,
          summary: stops
            ? `${dayLabel(d.dayIndex)} — ${stops}`
            : dayLabel(d.dayIndex),
        };
      }),
    });
    if (ics) downloadTripIcs(ics, shareId);
  }, [db, shareId, pageUrl, l]);

  /**
   * P5 — IZVOZI PDF: deterministični izpis pote (baza ali lokalna kopija)
   * prek jsPDF + podnaboranega Liberation Sans. Leni chunk (~50 KB) se
   * naloži šele ob kliku; isti načrt + issuedAt → bitno isti PDF.
   */
  const onPdfExport = React.useCallback(async () => {
    const plan = db?.plan ?? localPlan ?? null;
    if (!plan || pdfBusy) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const input = db?.plan
        ? fromSharedPlan(db.plan, db.tripDates ?? null, "cloud")
        : fromSharedPlan(localPlan as SharedPlan, null, "local");
      await downloadTripPdf(buildTripPdf(input, l));
    } catch {
      setPdfError(pick(l, L.pdfErr));
    } finally {
      setPdfBusy(false);
    }
  }, [db, localPlan, pdfBusy, l]);

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
                pick(l, { sl: "javna povezava", en: "public link", it: "link pubblico", de: "öffentlicher Link", fr: "lien public", es: "enlace público" })
              ) : (
                <strong className="text-foreground">
                  {db.role === "OWNER"
                    ? pick(l, { sl: "ti si lastnik", en: "you are the owner", it: "sei il proprietario", de: "du bist der Besitzer", fr: "tu es le propriétaire", es: "eres el propietario" })
                    : db.role === "EDITOR"
                      ? pick(l, { sl: "ti si urednik", en: "you are an editor", it: "sei un editor", de: "du bist ein Bearbeiter", fr: "tu es un éditeur", es: "eres un editor" })
                      : pick(l, { sl: "ti si gledalec", en: "you are a viewer", it: "sei un visualizzatore", de: "du bist ein Betrachter", fr: "tu es un lecteur", es: "eres un lector" })}
                </strong>
              )}
            </span>
            <span className="font-mono text-xs">
              /pot/{shareId} · {pick(l, L.createdAt)}{" "}
              {new Date(db.createdAt).toLocaleDateString(intlDateLocale(l))}
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
              <Button
                onClick={() => void onPdfExport()}
                variant="outline"
                className="tap-target font-semibold"
                disabled={pdfBusy}
              >
                {pdfBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileDown className="size-4" aria-hidden="true" />
                )}
                {pdfBusy ? pick(l, L.pdfBusy) : pick(l, L.pdfBtn)}
              </Button>
              {/* P0-G (issue §17): ICS izvoz — ŽIV samo ob realnih datumih
                  (sicer iskrena odsotnost; datume določa plošča spodaj). */}
              {db.tripDates && (
                <Button onClick={onIcsExport} variant="outline" className="tap-target font-semibold">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {pick(l, L.icsBtn)}
                </Button>
              )}
              <Button onClick={onCopy} variant="ghost" className="tap-target font-semibold">
                <Share2 className="size-4" aria-hidden="true" />
                {pick(l, L.copy)}
              </Button>
              {pdfError && (
                <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
                  {pdfError}
                </p>
              )}
              {/* P1-C (issue #3 §4): spremljanje pote — samo za udeležence
                  (lastnik/urednik/gledalec; javni obiskovalci brez). */}
              {canParticipate && (
                <TripWatchMenu
                  shareId={shareId}
                  hasDates={Boolean(db.tripDates)}
                />
              )}
            </div>

            <TripDatesPanel
              shareId={shareId}
              canEdit={canEdit}
              tripDates={db.tripDates}
              plan={plan}
              onSaved={() => void loadDb()}
            />

            <PlanDays plan={plan} shareId={shareId} dayLabel={pick(l, L.dayLabel)} addLabel={pick(l, L.addTrip)} addedLabel={pick(l, L.added)} exploreLabel={pick(l, L.exploreDest)} />

            <div className="grid gap-4 sm:grid-cols-2 print:hidden">
              <Card>
                <CardContent className="p-5">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <QrCode className="size-4 text-primary" aria-hidden="true" />
                    {pick(l, L.qrTitle)}
                  </h3>
                  {/* P0-G (issue §17): PRAVI izris QR (qrcode, client-only);
                      ob napaki izrisa ostane URL spodaj za ročno kopijo. */}
                  <QrCanvas url={pageUrl} label={pick(l, L.qrTitle)} />
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {pick(l, L.qrNote)}
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
                    {pick(l, { sl: "Vir: baza (oblak)", en: "Source: database (cloud)", it: "Fonte: database (cloud)", de: "Quelle: Datenbank (Cloud)", fr: "Source : base de données (cloud)", es: "Fuente: base de datos (nube)" })}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {pick(l, L.cloudNote)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {db.ownerName ? `Lastnik: ${db.ownerName} · ` : ""}
                    {db.isPublic
                      ? pick(l, { sl: "javna povezava", en: "public link", it: "link pubblico", de: "öffentlicher Link", fr: "lien public", es: "enlace público" })
                      : pick(l, { sl: "zasebna povezava (samo sodelujoči)", en: "private link (collaborators only)", it: "link privato (solo collaboratori)", de: "privater Link (nur Mitwirkende)", fr: "lien privé (collaborateurs uniquement)", es: "enlace privado (solo colaboradores)" })}
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
              <Link href="/moja-potovanja">{pick(l, { sl: "Moja potovanja", en: "My trips", it: "I miei viaggi", de: "Meine Reisen", fr: "Mes voyages", es: "Mis viajes" })}</Link>
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
                {new Date(localPlan.createdAt).toLocaleDateString(intlDateLocale(l))}
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
            <Button
              onClick={() => void onPdfExport()}
              variant="outline"
              className="tap-target font-semibold"
              disabled={pdfBusy}
            >
              {pdfBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileDown className="size-4" aria-hidden="true" />
              )}
              {pdfBusy ? pick(l, L.pdfBusy) : pick(l, L.pdfBtn)}
            </Button>
            <Button onClick={onCopy} variant="ghost" className="tap-target font-semibold">
              <Share2 className="size-4" aria-hidden="true" />
              {pick(l, L.copy)}
            </Button>
            {pdfError && (
              <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
                {pdfError}
              </p>
            )}
          </div>

          <PlanDays plan={localPlan} shareId={shareId} dayLabel={pick(l, L.dayLabel)} addLabel={pick(l, L.addTrip)} addedLabel={pick(l, L.added)} exploreLabel={pick(l, L.exploreDest)} />

          {/* QR izris + opomba (ne tiska) — P0-G: pravi izris */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 print:hidden">
            <Card>
              <CardContent className="p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <QrCode className="size-4 text-primary" aria-hidden="true" />
                  {pick(l, L.qrTitle)}
                </h3>
                <QrCanvas url={pageUrl} label={pick(l, L.qrTitle)} />
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {pick(l, L.qrNote)}
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
                  {pick(l, { sl: "Vir: lokalna shramba", en: "Source: local storage", it: "Fonte: memoria locale", de: "Quelle: lokaler Speicher", fr: "Source : stockage local", es: "Fuente: almacenamiento local" })}
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

/**
 * P0-G (issue #1 §17 „QR sharing“): PRAVI izris QR kode povezave poti
 * (knjižnica qrcode, client-only canvas). Ob napaki izrisa koda čisto
 * izgine — URL pod njo ostane pot za ročno kopiranje (iskrena
 * degradacija, nikoli pokvarjena slika).
 */
function QrCanvas({ url, label }: { url: string; label: string }) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !url) return;
    let cancelled = false;
    QRCode.toCanvas(
      canvas,
      url,
      { width: 160, margin: 2, errorCorrectionLevel: "M" },
      (err: Error | null | undefined) => {
        if (err && !cancelled) canvas.hidden = true;
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <canvas
      ref={ref}
      width={160}
      height={160}
      role="img"
      aria-label={label}
      className="mt-3 rounded-lg border bg-white dark:bg-white"
    />
  );
}

/** Dnevi pote (skupno za oblak in lokalno pot — enak izris kot prej). */
function PlanDays({
  plan,
  shareId,
  dayLabel,
  addLabel,
  addedLabel,
  exploreLabel,
}: {
  plan: SharedPlan;
  shareId: string;
  dayLabel: (n: number) => string;
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
                {dayLabel(day.day)}
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
