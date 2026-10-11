"use client";

import {
  ArrowRight,
  CalendarDays,
  Clock,
  CloudUpload,
  FileDown,
  Globe,
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
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import QRCode from "qrcode";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatDuration } from "@/lib/itinerary-engine";
import { myTrip } from "@/lib/my-trip";
// POLIR6 A (2.33.0): čisti pomoži IZMERJENIH dni (EN izvor resnice — isti
// kot na /nacrtuj; ocena dneva = ISTA hevristika kot LegRow, km pa nosijo
// 1 decimalko po jeziku, EN pika / ostali vejica — determinizem brez Intl).
import {
  dayEstimate,
  fmtKm1,
  summarizeMeasured,
  type MeasuredDay,
} from "@/lib/plan-map-data";
import { getDestination } from "@/lib/slovenia-data";
import { type SharedPlan, sharedPlans } from "@/lib/shared-plan";
import { buildTripPdf, fromSharedPlan } from "@/lib/pdf/trip-pdf-doc";
import { downloadTripPdf } from "@/lib/pdf/trip-pdf-render";
import { addDaysIso, eachTripDay, type TripDates } from "@/lib/trip-dates";
import { buildTripIcs, downloadTripIcs } from "@/lib/trip-ics";
import type { TripStop } from "@/lib/types";

/**
 * /pot/[shareId] — deljena pot (rekonstrukcija D7 + 48-a skupnostne funkcije).
 *
 * POLIR3 B (2.30.0): + ZEMLJEVID POTI (zavihek Pot / lokalna pota) —
 * koordinate IZKLJUČNO iz registra prek destSlug, pariteta z /potovanje
 * in /nacrtuj (odjemalec deljene povezave vidi pot na zemljevidu).
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

// POLIR3 B (2.30.0): ZEMLJEVID POTI — klientanski dinamični uvoz (Leaflet
// dostopa do window že ob uvozu modula → ssr: false je OBVEZEN; Skeleton
// prepreči layout shift med nalaganjem). Imenovani export PlanMap iz
// @/components/plan/plan-map — ISTA komponenta kot na /nacrtuj in
// /potovanje (zemljevid ni podvojen; pariteta: odjemalec deljene
// povezave vidi pot na zemljevidu, ne samo sezname dni).
const PlanMap = dynamic(
  () => import("@/components/plan/plan-map").then((m) => m.PlanMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-72 w-full rounded-xl sm:h-80" />,
  }
);

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
  // QA U6: opozorilo po kopiranju zasebne povezave ("private" = pot v oblaku,
  // a javna povezava IZKLOPLJENA; "local" = pot živi samo lokalno) + kratka
  // potrditev uspešnega kopiranja (prej tiho dejanje).
  const [copyNote, setCopyNote] = React.useState<"private" | "local" | null>(null);
  const [copiedFlash, setCopiedFlash] = React.useState(false);
  const [publicBusy, setPublicBusy] = React.useState(false);
  const [publicError, setPublicError] = React.useState<string | null>(null);

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
    // QA U10 (2026-10-11): POENOTENE oznake izvozov na vseh treh pogledih
    // (/nacrtuj, /potovanje, /pot/[shareId]): Natisni / Izvozi PDF /
    // Koledar (.ics) / QR koda — prej trije različni napisi za isto dejanje.
    print: { sl: "Natisni", en: "Print", it: "Stampa", de: "Drucken", fr: "Imprimer", es: "Imprimir" },
    pdfBtn: { sl: "Izvozi PDF", en: "Export PDF", it: "Esporta PDF", de: "PDF exportieren", fr: "Exporter en PDF", es: "Exportar PDF" },
    pdfBusy: { sl: "Pripravljam PDF …", en: "Preparing PDF …", it: "Preparo il PDF …", de: "PDF wird vorbereitet …", fr: "Préparation du PDF …", es: "Preparando PDF …" },
    pdfErr: { sl: "PDF izvoz ni uspel — poskusi znova.", en: "PDF export failed — try again.", it: "Esportazione PDF non riuscita — riprova.", de: "PDF-Export fehlgeschlagen — bitte erneut versuchen.", fr: "Échec de l'export PDF — réessaie.", es: "Fallo al exportar PDF — reinténtalo." },
    printFooter: { sl: "Izvoženo z Discover Slovenia AI", en: "Exported with Discover Slovenia AI", it: "Esportato con Discover Slovenia AI", de: "Exportiert mit Discover Slovenia AI", fr: "Exporté avec Discover Slovenia AI", es: "Exportado con Discover Slovenia AI" },
    qrTitle: { sl: "QR koda", en: "QR code", it: "Codice QR", de: "QR-Code", fr: "Code QR", es: "Código QR" },
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
    // QA U6 (2026-10-11): kopiranje ZASEBNE povezave brez opozorila je
    // ustvarjalo lažno zaupanje (prijatelji → 404). Opozorilo + en klik za
    // vklop javnega deljenja (samo lastnik — API kanon); gostje in
    // sodelujoči dobijo iskreno razlago.
    copyPrivate: {
      sl: "Povezava je zasebna — vidijo jo samo povabljeni. Vklopi javno deljenje ali pošlji vabila?",
      en: "This link is private — only invited collaborators can see it. Enable public sharing or send invites?",
      it: "Questo link è privato — possono vederlo solo gli invitati. Attivi la condivisione pubblica o invii degli inviti?",
      de: "Dieser Link ist privat — nur Eingeladene können ihn sehen. Öffentliche Freigabe aktivieren oder Einladungen senden?",
      fr: "Ce lien est privé — seules les personnes invitées peuvent le voir. Activer le partage public ou envoyer des invitations ?",
      es: "Este enlace es privado — solo pueden verlo los invitados. ¿Activar el enlace público o enviar invitaciones?",
    },
    copyGuest: {
      sl: "Prosi lastnika za vabilo ali za vklop javne povezave.",
      en: "Ask the owner for an invitation or to enable the public link.",
      it: "Chiedi al proprietario un invito o di attivare il link pubblico.",
      de: "Bitte den Besitzer um eine Einladung oder darum, den öffentlichen Link zu aktivieren.",
      fr: "Demande au propriétaire une invitation ou d’activer le lien public.",
      es: "Pide al propietario una invitación o que active el enlace público.",
    },
    copyEnable: { sl: "Vklopi javno deljenje", en: "Enable public sharing", it: "Attiva la condivisione pubblica", de: "Öffentliche Freigabe aktivieren", fr: "Activer le partage public", es: "Activar el enlace público" },
    copyEnabling: { sl: "Vklapljam …", en: "Enabling …", it: "Attivo …", de: "Aktiviere …", fr: "Activation …", es: "Activando …" },
    copyPublicErr: {
      sl: "Vklop javne povezave ni uspel — poskusi znova.",
      en: "Enabling the public link failed — try again.",
      it: "Attivazione del link pubblico non riuscita — riprova.",
      de: "Aktivieren des öffentlichen Links fehlgeschlagen — bitte erneut versuchen.",
      fr: "Échec de l’activation du lien public — réessaie.",
      es: "No se pudo activar el enlace público — reinténtalo.",
    },
    copyLocal: {
      sl: "Ta pot živi samo na tej napravi — povezava za prijatelje ne bo delovala. Shrani jo v oblak (zgoraj), da odkleneš deljenje.",
      en: "This trip lives only on this device — the link will not work for friends. Save it to the cloud (above) to unlock sharing.",
      it: "Questo viaggio vive solo su questo dispositivo — il link non funzionerà per gli amici. Salvalo nel cloud (sopra) per sbloccare la condivisione.",
      de: "Diese Reise lebt nur auf diesem Gerät — der Link funktioniert für Freunde nicht. Speichere sie in der Cloud (oben), um die Freigabe freizuschalten.",
      fr: "Ce voyage ne vit que sur cet appareil — le lien ne fonctionnera pas pour tes amis. Enregistre-le dans le cloud (ci-dessus) pour débloquer le partage.",
      es: "Este viaje vive solo en este dispositivo — el enlace no funcionará para tus amigos. Guárdalo en la nube (arriba) para desbloquear el uso compartido.",
    },
    qrPrivate: {
      sl: "Opozorilo: povezava je trenutno ZASEBNA — QR koda bo delovala samo povabljenim sodelujočim.",
      en: "Warning: the link is currently PRIVATE — the QR code will work only for invited collaborators.",
      it: "Attenzione: il link è attualmente PRIVATO — il codice QR funzionerà solo per i collaboratori invitati.",
      de: "Achtung: Der Link ist derzeit PRIVAT — der QR-Code funktioniert nur für eingeladene Mitwirkende.",
      fr: "Attention : le lien est actuellement PRIVÉ — le code QR ne fonctionnera que pour les collaborateurs invités.",
      es: "Aviso: el enlace es actualmente PRIVADO — el código QR funcionará solo para los colaboradores invitados.",
    },
    qrLocal: {
      sl: "Ta povezava deluje samo na tej napravi (lokalna shramba) — prijateljem QR koda ne bo odprla poti.",
      en: "This link works only on this device (local storage) — the QR code will not open the trip for friends.",
      it: "Questo link funziona solo su questo dispositivo (memoria locale) — il codice QR non aprirà il viaggio agli amici.",
      de: "Dieser Link funktioniert nur auf diesem Gerät (lokaler Speicher) — der QR-Code öffnet Freunden die Reise nicht.",
      fr: "Ce lien ne fonctionne que sur cet appareil (stockage local) — le code QR n’ouvrira pas le voyage aux amis.",
      es: "Este enlace funciona solo en este dispositivo (almacenamiento local) — el código QR no abrirá el viaje a tus amigos.",
    },
    // P0-G (issue §17): ICS izvoz v koledar (QA U10: poenoten napis)
    icsBtn: { sl: "Koledar (.ics)", en: "Calendar (.ics)", it: "Calendario (.ics)", de: "Kalender (.ics)", fr: "Calendrier (.ics)", es: "Calendario (.ics)" },
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
      sl: "Zasebnost: deljeno pot vidijo povabljeni sodelujoči, razen če lastnik vklopi javno povezavo. Če ti je nekdo poslal to povezavo, prosi lastnika za vabilo ali za vklop javne povezave.",
      en: "Privacy: a shared trip is visible to invited collaborators unless the owner enables the public link. If someone sent you this link, ask the owner for an invitation or to enable the public link.",
      it: "Privacy: un viaggio condiviso è visibile ai collaboratori invitati, a meno che il proprietario non attivi il link pubblico. Se qualcuno ti ha inviato questo link, chiedi al proprietario un invito o di attivare il link pubblico.",
      de: "Privatsphäre: Eine geteilte Reise ist nur für eingeladene Mitwirkende sichtbar, sofern der Besitzer den öffentlichen Link nicht aktiviert. Wenn dir jemand diesen Link geschickt hat, bitte den Besitzer um eine Einladung oder darum, den öffentlichen Link zu aktivieren.",
      fr: "Confidentialité : un voyage partagé n’est visible que par les collaborateurs invités, sauf si le propriétaire active le lien public. Si quelqu’un t’a envoyé ce lien, demande au propriétaire une invitation ou d’activer le lien public.",
      es: "Privacidad: un viaje compartido solo es visible para los colaboradores invitados, a menos que el propietario active el enlace público. Si alguien te envió este enlace, pide al propietario una invitación o que active el enlace público.",
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
    // POLIR3 B (2.30.0): zemljevid poti — naslov in legenda kartice (isti
    // ključi kot na /potovanje: pot je skupna obema pogledoma).
    mapTitle: { sl: "Zemljevid poti", en: "Trip map", it: "Mappa del viaggio", de: "Reisekarte", fr: "Carte du voyage", es: "Mapa del viaje" },
    mapDesc: {
      sl: "Položaji postankov po dnevih — barva in številka pomenita dan.",
      en: "Stop positions by day — colour and number stand for the day.",
      it: "Posizioni delle tappe per giorno — colore e numero indicano il giorno.",
      de: "Positionen der Stopps nach Tag — Farbe und Nummer stehen für den Tag.",
      fr: "Positions des arrêts par jour — couleur et numéro désignent le jour.",
      es: "Posiciones de las paradas por día — color y número indican el día.",
    },
    // POLIR6 A (2.33.0): IZMERJENE razdalje v skupnem pogledu (pariteta
    // /nacrtuj 2.32.0 — besedila DOBESEEDNO iz nacrtuj/view.tsx; vsaka
    // številka nosi razložljiv vir: izmerjeno OSRM ali izrecno ocena;
    // vsota združuje SAMO izmerjene dneve — Roadtrippersova past).
    measuredDay: {
      sl: (km: string, min: number) => `${km} km · ${min} min vožnje — izmerjeno (OSRM/OpenStreetMap)`,
      en: (km: string, min: number) => `${km} km · ${min} min of driving — measured (OSRM/OpenStreetMap)`,
      it: (km: string, min: number) => `${km} km · ${min} min di guida — misurato (OSRM/OpenStreetMap)`,
      de: (km: string, min: number) => `${km} km · ${min} Min. Fahrt — gemessen (OSRM/OpenStreetMap)`,
      fr: (km: string, min: number) => `${km} km · ${min} min de conduite — mesuré (OSRM/OpenStreetMap)`,
      es: (km: string, min: number) => `${km} km · ${min} min de conducción — medido (OSRM/OpenStreetMap)`,
    },
    estimatedDay: {
      sl: (km: number, min: number) => `~ ${km} km · ~ ${min} min — ocena (premočna ×1,3 @ ~60 km/h)`,
      en: (km: number, min: number) => `~ ${km} km · ~ ${min} min — estimate (straight-line ×1.3 @ ~60 km/h)`,
      it: (km: number, min: number) => `~ ${km} km · ~ ${min} min — stima (linea d'aria ×1,3 a ~60 km/h)`,
      de: (km: number, min: number) => `~ ${km} km · ~ ${min} Min. — Schätzung (Luftlinie ×1,3 bei ~60 km/h)`,
      fr: (km: number, min: number) => `~ ${km} km · ~ ${min} min — estimation (à vol d'oiseau ×1,3 à ~60 km/h)`,
      es: (km: number, min: number) => `~ ${km} km · ~ ${min} min — estimación (línea recta ×1,3 a ~60 km/h)`,
    },
    measuredTotal: {
      sl: (km: string, dur: string) => `Skupaj izmerjeno: ${km} km · ${dur} vožnje (OSRM/OpenStreetMap)`,
      en: (km: string, dur: string) => `Measured in total: ${km} km · ${dur} of driving (OSRM/OpenStreetMap)`,
      it: (km: string, dur: string) => `Totale misurato: ${km} km · ${dur} di guida (OSRM/OpenStreetMap)`,
      de: (km: string, dur: string) => `Insgesamt gemessen: ${km} km · ${dur} Fahrt (OSRM/OpenStreetMap)`,
      fr: (km: string, dur: string) => `Total mesuré : ${km} km · ${dur} de conduite (OSRM/OpenStreetMap)`,
      es: (km: string, dur: string) => `Total medido: ${km} km · ${dur} de conducción (OSRM/OpenStreetMap)`,
    },
    measuredMissing: {
      sl: (n: number) => `za ${n} ${n === 1 ? "dan" : "dni"} ni izmerjenih podatkov — prikazana je ocena`,
      en: (n: number) => `for ${n} ${n === 1 ? "day" : "days"} no measured data is available — an estimate is shown`,
      it: (n: number) => `per ${n} ${n === 1 ? "giorno" : "giorni"} non ci sono dati misurati — viene mostrata una stima`,
      de: (n: number) => `für ${n} ${n === 1 ? "Tag" : "Tage"} liegen keine gemessenen Daten vor — eine Schätzung wird angezeigt`,
      fr: (n: number) => `pour ${n} ${n === 1 ? "jour" : "jours"} aucune donnée mesurée n'est disponible — une estimation est affichée`,
      es: (n: number) => `para ${n} ${n === 1 ? "día" : "días"} no hay datos medidos — se muestra una estimación`,
    },
    measuredSrPrefix: {
      sl: "Vožnja tega dne: ",
      en: "Driving this day: ",
      it: "Guida di questo giorno: ",
      de: "Fahrt an diesem Tag: ",
      fr: "Conduite de ce jour : ",
      es: "Conducción de este día: ",
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
    // QA U6: kopiranje mora biti GLASNO — potrditev + opozorilo, če
    // povezava ni javna (prijatelji bi sicer videli 404).
    setCopiedFlash(true);
    window.setTimeout(() => setCopiedFlash(false), 2500);
    if (db === null) {
      setCopyNote("local");
    } else if (db && !db.isPublic) {
      setCopyNote("private");
    } else {
      setCopyNote(null);
    }
  }, [pageUrl, db]);

  /**
   * QA U6: EN KLIK za vklop javnega deljenja iz opozorila (samo lastnik —
   * enak PATCH kot stikalo v zavihku Sodelovanje; API dovoli isPublic
   * izključno OWNERju, urednik/gledalec dobi iskreno napako strežnika).
   */
  const enablePublicSharing = React.useCallback(async () => {
    if (publicBusy) return;
    setPublicBusy(true);
    setPublicError(null);
    try {
      const r = await fetch(`/api/trips/${encodeURIComponent(shareId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPublic: true }),
      });
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!r.ok || !data?.success) {
        setPublicError(data?.error ?? pick(l, L.copyPublicErr));
        return;
      }
      setCopyNote(null);
      await loadDb();
    } catch {
      setPublicError(pick(l, L.copyPublicErr));
    } finally {
      setPublicBusy(false);
    }
  }, [shareId, publicBusy, loadDb, l]);

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

  // POLIR6 A (2.33.0): IZMERJENE RAZDALJE v skupnem pogledu (poročevalna
  // pariteta /nacrtuj ↔ /potovanje ↔ /pot/[shareId]). Dnevi za PlanMap se
  // MEMOIZIRAJO: sharedPlanMapDays bi ob vsakem re-renderju naredil NOVO
  // tabelo dni → PlanMap efekt bi znova in znova poklical proxy, izmere pa
  // nikoli ne bi »prisedela«. Deps so STABILNI referenci stanja (db /
  // localPlan — nikoli izpeljanke), kar je tudi POGOJ za kanon vezave
  // stanja izmer na referenco dni.
  const cloudMapDays = React.useMemo(
    () => (db?.plan ? sharedPlanMapDays(db.plan, shareId) : NO_MAP_DAYS),
    [db, shareId]
  );
  const localMapDays = React.useMemo(
    () => (localPlan ? sharedPlanMapDays(localPlan, shareId) : NO_MAP_DAYS),
    [localPlan, shareId]
  );

  // Stanje izmer VEZANO NA REFERENCO dni (kanon 2.32.0): velja samo za
  // dneve, ob katerih je nastalo — sprememba vira (reload baze, preklop
  // oblak ↔ lokalno) da NOVO referenco → pošteno ponovno vezanje in nova
  // izmera (nikoli številke tujega vrstnega reda). Baza ima prednost pred
  // lokalno poto in zavihki niso hkrati montirani → ENO stanje zadošča.
  const [measuredState, setMeasuredState] = React.useState<{
    forDays: TripStop[][];
    stats: MeasuredDay[];
  } | null>(null);
  const activeMapDays = db ? cloudMapDays : localMapDays;
  const handleMeasured = React.useCallback(
    (stats: MeasuredDay[]) => setMeasuredState({ forDays: activeMapDays, stats }),
    [activeMapDays]
  );
  const measured =
    measuredState?.forDays === activeMapDays ? measuredState.stats : null;

  // Čista presodba povzetka (vrstica pod glavo dneva + skupna vrstica) —
  // SAMO nad izmerjenimi dnevi (Roadtrippersova past: mešana vsota bi
  // tiho lagala; padli dnevi se izrecno preštejejo v opombo).
  const measuredSummary = React.useMemo(
    () =>
      measured && activeMapDays !== NO_MAP_DAYS
        ? summarizeMeasured(activeMapDays.length, measured)
        : null,
    [measured, activeMapDays]
  );

  // Vrstica izmere/ocene enega dneva (ISTA semantika kot /nacrtuj 2.32.0):
  // izmerjen dan → izmerjeno (OSRM); padel dan z oceno → ISTA hevristika
  // kot LegRow (dayEstimate nad dnevi zemljevida — koordinate registra);
  // dan brez skoka (manj kot 2 postanka s coords) → BREZ vrstice (iskrena
  // odsotnost). Neodvisna od zemljevida: deluje tudi, ko zemljevid NI
  // izrisan (< 2 točki skupaj).
  const travelRow = (dayIdx: number): string | null => {
    const row = measuredSummary?.rows[dayIdx];
    if (row?.kind === "measured") {
      return pick(l, L.measuredDay)(fmtKm1(l, row.km), row.min);
    }
    if (row?.kind === "estimate") {
      const est =
        activeMapDays === NO_MAP_DAYS
          ? null
          : dayEstimate(activeMapDays[dayIdx] ?? []);
      if (est) return pick(l, L.estimatedDay)(est.km, est.min);
    }
    return null;
  };
  // Skupna vrstica SAMO nad izmerjenimi dnevi + iskrena opomba o padlih
  // (dvojina 1 dan/dni je v ključu measuredMissing pravilna ×6).
  const travelTotals =
    measuredSummary &&
    measuredSummary.totalKm !== null &&
    measuredSummary.totalMin !== null
      ? {
          total: pick(l, L.measuredTotal)(
            fmtKm1(l, measuredSummary.totalKm),
            formatDuration(measuredSummary.totalMin)
          ),
          missing:
            measuredSummary.failedCount > 0
              ? pick(l, L.measuredMissing)(measuredSummary.failedCount)
              : null,
        }
      : null;

  const loggedIn = sessionStatus === "authenticated" && Boolean(session?.user);

  // QA U6 (2026-10-11): opozorilo ob kopiranju zasebne povezave (skupno
  // obema poglavjema — baza in lokalna pota). Lastnik dobi EN KLIK za vklop
  // javnega deljenja; gostje/uredniki/gledalci iskreno razlago; lokalna
  // pota napotilo na shranjevanje v oblak.
  const copyWarningNode =
    copyNote === "private" ? (
      <div
        role="alert"
        className="w-full rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <p className="font-semibold leading-relaxed">{pick(l, L.copyPrivate)}</p>
        {db?.role === "OWNER" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => void enablePublicSharing()}
              disabled={publicBusy}
              className="tap-target min-h-9 font-semibold"
            >
              {publicBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Globe className="size-4" aria-hidden="true" />
              )}
              {publicBusy ? pick(l, L.copyEnabling) : pick(l, L.copyEnable)}
            </Button>
            {publicError && (
              <span role="alert" className="text-xs text-red-600 dark:text-red-400">
                {publicError}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-1 text-xs">{pick(l, L.copyGuest)}</p>
        )}
      </div>
    ) : copyNote === "local" ? (
      <div
        role="alert"
        className="w-full rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <p className="font-semibold leading-relaxed">{pick(l, L.copyLocal)}</p>
      </div>
    ) : null;

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
              {/* QA U6: glasna potrditev kopiranja + opozorilo o zasebnosti. */}
              {copiedFlash && (
                <Badge variant="secondary" className="self-center" role="status">
                  {pick(l, L.copied)}
                </Badge>
              )}
              {copyWarningNode}
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

            <PlanDays plan={plan} shareId={shareId} dayLabel={pick(l, L.dayLabel)} addLabel={pick(l, L.addTrip)} addedLabel={pick(l, L.added)} exploreLabel={pick(l, L.exploreDest)} travelRows={travelRow} travelSrPrefix={pick(l, L.measuredSrPrefix)} travelTotals={travelTotals} />

            {/* POLIR3 B (2.30.0): ZEMLJEVID POTI — pariteta z /potovanje in
                /nacrtuj (odjemalec deljene povezave vidi pot na zemljevidu,
                ne samo sezname dni). Koordinate IZKLJUČNO iz registra prek
                destSlug (neujemanja iskreno brez markerjev + števec v
                komponenti). Pogojna izrisava: vsaj 2 točki skupaj (prazno
                stanje brez zemljevida). V natisu se izpusti (print:hidden)
                — obstoječi natis (dnevi + noga) ostaja nedotaknjen. */}
            {totalStops >= 2 && (
              <div className="print:hidden">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{pick(l, L.mapTitle)}</CardTitle>
                    <p className="text-xs text-muted-foreground">{pick(l, L.mapDesc)}</p>
                  </CardHeader>
                  <CardContent>
                    <PlanMap days={cloudMapDays} onMeasured={handleMeasured} />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* POLIR7 (2.34.0): min-w-0 na predmetih mreže — truncate URL drugače
                nowrap (min-vsebina) raznese stolpec (defensivecss „Minimum Content
                Size In CSS grid" / css-tricks „Preventing a Grid Blowout"): predmet
                mreže ima privzeto min-width:auto, zato nowrap URL (min-vsebina
                369 px → kartica 411 px) preliva ekran 390 px. QR razdelek ostaja
                v DOM pod VSEMI zavihki (Pot/Sodelovanje/Ankete/Klepet/
                Rezervacije), zato ena napaka povzroča preliv povsod. */}
            <div className="grid gap-4 sm:grid-cols-2 print:hidden">
              <Card className="min-w-0">
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
                  {/* QA U6: iskrena opomba ob zasebni povezavi — QR drugače
                      ustvarja lažno zaupanje (prijatelji → 404). */}
                  {db && !db.isPublic && (
                    <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                      {pick(l, L.qrPrivate)}
                    </p>
                  )}
                  <p className="mt-2 truncate rounded-md bg-muted px-2 py-1 font-mono text-xs">
                    {pageUrl}
                  </p>
                </CardContent>
              </Card>
              {/* POLIR7: min-w-0 tudi na kartici vira — isti predmet mreže. */}
              <Card className="min-w-0 border-primary/25 bg-primary/5">
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
            {/* QA U6: glasna potrditev kopiranja + opozorilo (lokalna pota). */}
            {copiedFlash && (
              <Badge variant="secondary" className="self-center" role="status">
                {pick(l, L.copied)}
              </Badge>
            )}
            {copyWarningNode}
            {pdfError && (
              <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
                {pdfError}
              </p>
            )}
          </div>

          <PlanDays plan={localPlan} shareId={shareId} dayLabel={pick(l, L.dayLabel)} addLabel={pick(l, L.addTrip)} addedLabel={pick(l, L.added)} exploreLabel={pick(l, L.exploreDest)} travelRows={travelRow} travelSrPrefix={pick(l, L.measuredSrPrefix)} travelTotals={travelTotals} />

          {/* POLIR3 B (2.30.0): ZEMLJEVID POTI — enaka kartica kot v zavihku
              Pot oblačne pote (pariteta lokalna pota ↔ baza ↔ /potovanje);
              pogoj vsaj 2 točki skupaj, v natisu se izpusti (print:hidden). */}
          {localPlan.days.reduce((n, d) => n + d.locations.length, 0) >= 2 && (
            <div className="mt-10 print:hidden">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{pick(l, L.mapTitle)}</CardTitle>
                  <p className="text-xs text-muted-foreground">{pick(l, L.mapDesc)}</p>
                </CardHeader>
                <CardContent>
                  <PlanMap days={localMapDays} onMeasured={handleMeasured} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* QR izris + opomba (ne tiska) — P0-G: pravi izris */}
          {/* POLIR7 (2.34.0): min-w-0 na predmetih mreže — ISTA past kot v oblačni
              veji (defensivecss „Minimum Content Size In CSS grid"): nowrap URL
              pod QR kodo raznese stolpec mreže na ozkih ekranih. */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 print:hidden">
            <Card className="min-w-0">
              <CardContent className="p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <QrCode className="size-4 text-primary" aria-hidden="true" />
                  {pick(l, L.qrTitle)}
                </h3>
                <QrCanvas url={pageUrl} label={pick(l, L.qrTitle)} />
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {pick(l, L.qrNote)}
                </p>
                {/* QA U6: lokalna pota — QR odpre pot SAMO na tej napravi. */}
                <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  {pick(l, L.qrLocal)}
                </p>
                <p className="mt-2 truncate rounded-md bg-muted px-2 py-1 font-mono text-xs">
                  {pageUrl}
                </p>
              </CardContent>
            </Card>
            {/* POLIR7: min-w-0 tudi na kartici vira — isti predmet mreže. */}
            <Card className="min-w-0 border-primary/25 bg-primary/5">
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
 * POLIR3 B (2.30.0): DNEVI DELJENE POTE → POSTANKI ZA ZEMLJEVID.
 *
 * SharedPlanLocation koordinat NE nosi (iskrena odsotnost) — koordinate
 * pridejo IZKLJUČNO iz registra destinacij prek destSlug
 * (getDestination = DESTINATIONS.find(d => d.slug === …)). Lokacija brez
 * ujemanja v registru ostane BREZ coords: PlanMap je ne izriše, planMapData
 * pa jo iskreno prešteje v opombo „N postankov brez znanih koordinat ni
 * prikazan“. Koordinate se NIKOLI ne izmišljujejo.
 *
 * durationMin/cost/kind ta načrt ne nosi (shared zapis jih nima) — za
 * zemljevid so neutralni (0 / „custom“) in se nikjer ne prikažejo
 * (PlanMap bere izključno id/name/time/coords). Id je enolično izpeljan
 * iz shareId + številke dneva + zaporedja lokacije.
 */
function sharedPlanMapDays(plan: SharedPlan, shareId: string): TripStop[][] {
  return plan.days.map((day) =>
    day.locations.map((loc, i): TripStop => {
      const dest = loc.destSlug ? getDestination(loc.destSlug) : undefined;
      return {
        id: `${shareId}-d${day.day}-${i}`,
        name: loc.name,
        time: loc.time ?? null,
        durationMin: 0,
        cost: 0,
        kind: "custom",
        // Iskrenost: coords SAMO iz ujemanja destSlug v registru.
        ...(dest ? { coords: dest.coords } : {}),
      };
    })
  );
}

/**
 * POLIR6 A (2.33.0): stabilna PRAZNA referenca dni (kanon NO_ROUTES iz
 * plan-map.tsx) — memoizirana tabela dni v pogledu brez pote (nalaganje /
 * 404) ostane VEDNO ista referenca, zato kanon vezave stanja izmer
 * (forDays === days) nikoli ne more lažno zadeti.
 */
const NO_MAP_DAYS: TripStop[][] = [];

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

/**
 * Skupna vrstica izmer za PlanDays (POLIR6 A, 2.33.0) — čista podatkovna
 * struktura: `total` je oblikovana vrstica „Skupaj izmerjeno: …", `missing`
 * pa iskrena opomba o padlih dnevih (null, če jih ni).
 */
interface TravelTotals {
  total: string;
  missing: string | null;
}

/** Dnevi pote (skupno za oblak in lokalno pot — enak izris kot prej). */
function PlanDays({
  plan,
  shareId,
  dayLabel,
  addLabel,
  addedLabel,
  exploreLabel,
  travelRows,
  travelSrPrefix,
  travelTotals,
}: {
  plan: SharedPlan;
  shareId: string;
  dayLabel: (n: number) => string;
  addLabel: string;
  addedLabel: string;
  exploreLabel: string;
  /**
   * POLIR6 A (2.33.0): vrstica izmere/ocene POD glavo dneva (pariteta
   * /nacrtuj): izmerjen dan → izmerjeno (OSRM); padel dan z oceno →
   * ISTA hevristika kot LegRow; dan brez skoka → null (brez vrstice).
   */
  travelRows: (dayIdx: number) => string | null;
  /** sr-only predpona bralcem zaslonov („Vožnja tega dne: "). */
  travelSrPrefix: string;
  /** Skupna vrstica + opomba o padlih (null → iskrena odsotnost). */
  travelTotals: TravelTotals | null;
}) {
  return (
    <>
      <ol className="mt-10 space-y-6">
        {plan.days.map((day, dayIdx) => {
          const travelText = travelRows(dayIdx);
          return (
            <li key={day.day}>
              <Card>
                <CardContent className="p-5">
                  <h2 className="text-lg font-bold tracking-tight">
                    {dayLabel(day.day)}
                    {day.title ? ` — ${day.title}` : ""}
                  </h2>
                  {/* POLIR6 A (2.33.0): vrstica izmere/ocene POD glavo dneva
                      (pariteta /nacrtuj 2.32.0 — vsaka številka nosi vir:
                      izmerjeno OSRM ali izrecno označena ocena). Print-VIDNA
                      (del povzetka dneva, ne zemljevida — zemljevid se v
                      natisu izpusti, ta vrstica pa NE) in neodvisna od
                      zemljevida (deluje tudi, ko ta ni izrisan < 2 točki). */}
                  {travelText && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      <span className="sr-only">{travelSrPrefix}</span>
                      {travelText}
                    </p>
                  )}
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
          );
        })}
      </ol>
      {/* POLIR6 A (2.33.0): SKUPNA IZMERJENA vrstica POD seznamom dni, PRED
          kartico zemljevida — SAMO nad izmerjenimi dnevi (Roadtrippersova
          past: mešana vsota bi tiho lagala; padli dnevi prispevajo nič k
          vsoti in se izrecno preštejejo v opombo). Print-VIDNA — del
          natisa, kanon /nacrtuj (izmera je del povzetka, ne zemljevida). */}
      {travelTotals && (
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          {travelTotals.total}
        </p>
      )}
      {travelTotals?.missing && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {travelTotals.missing}
        </p>
      )}
    </>
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
