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
  Landmark,
  Loader2,
  Lock,
  MousePointerClick,
  Percent,
  Plane,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
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
import { intlDateLocale } from "@/lib/intl-locale";

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
  tickets: Landmark,
  esim: Smartphone,
  insurance: ShieldCheck,
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
    kicker: { sl: "Skrbniška plošča", en: "Admin dashboard", it: "Dashboard di amministrazione", de: "Admin-Dashboard", fr: "Tableau de bord admin", es: "Panel de administración" },
    title: { sl: "Provizije in klikanja", en: "Commissions and clicks", it: "Provvigioni e clic", de: "Provisionen und Klicks", fr: "Commissions et clics", es: "Comisiones y clics" },
    lead: {
      sl: "Klikanja na partnerske povezave in provizijski dnevnik iz poročil partnerjev — vidno izključno skrbnikom (DSA_ADMIN_EMAILS).",
      en: "Clicks on partner links and the commission journal from partner reports — visible to administrators only (DSA_ADMIN_EMAILS).",
      it: "Clic sui link partner e registro delle provvigioni dai report dei partner — visibile esclusivamente agli amministratori (DSA_ADMIN_EMAILS).",
      de: "Klicks auf Partner-Links und das Provisionsjournal aus Partnerberichten — sichtbar ausschließlich für Administratoren (DSA_ADMIN_EMAILS).",
      fr: "Clics sur les liens partenaires et journal des commissions issu des rapports des partenaires — visible uniquement par les administrateurs (DSA_ADMIN_EMAILS).",
      es: "Clics en los enlaces de socios y diario de comisiones de los informes de socios — visible exclusivamente para administradores (DSA_ADMIN_EMAILS).",
    },
    refresh: { sl: "Osveži", en: "Refresh", it: "Aggiorna", de: "Aktualisieren", fr: "Actualiser", es: "Actualizar" },
    generatedAt: { sl: "Podatki nastali", en: "Data generated", it: "Dati generati", de: "Daten erstellt", fr: "Données générées", es: "Datos generados" },
    loading: { sl: "Nalagam podatke …", en: "Loading data …", it: "Caricamento dati …", de: "Daten werden geladen …", fr: "Chargement des données …", es: "Cargando datos …" },
    forbiddenTitle: { sl: "Dostop omejen na skrbnike", en: "Access restricted to administrators", it: "Accesso riservato agli amministratori", de: "Zugriff auf Administratoren beschränkt", fr: "Accès réservé aux administrateurs", es: "Acceso restringido a administradores" },
    forbiddenBody: {
      sl: "Dostop omejen na skrbnike. Nastavi DSA_ADMIN_EMAILS (vejico ločen seznam e-poštnih naslovov) v okolju in se prijavi s tem naslovom.",
      en: "Access is restricted to administrators. Set DSA_ADMIN_EMAILS (a comma-separated list of email addresses) in the environment and sign in with that address.",
      it: "L'accesso è riservato agli amministratori. Imposta DSA_ADMIN_EMAILS (un elenco di indirizzi e-mail separati da virgole) nell'ambiente e accedi con quell'indirizzo.",
      de: "Der Zugriff ist auf Administratoren beschränkt. Setze DSA_ADMIN_EMAILS (eine kommagetrennte Liste von E-Mail-Adressen) in der Umgebung und melde dich mit dieser Adresse an.",
      fr: "L'accès est réservé aux administrateurs. Définis DSA_ADMIN_EMAILS (une liste d'adresses e-mail séparées par des virgules) dans l'environnement et connecte-toi avec cette adresse.",
      es: "El acceso está restringido a administradores. Configura DSA_ADMIN_EMAILS (una lista de direcciones de correo separadas por comas) en el entorno e inicia sesión con esa dirección.",
    },
    toLogin: { sl: "K prijavi", en: "Go to sign-in", it: "Vai all'accesso", de: "Zur Anmeldung", fr: "Vers la connexion", es: "Ir al inicio de sesión" },
    loadErrTitle: { sl: "Podatkov ni bilo mogoče naložiti", en: "Failed to load data", it: "Caricamento dei dati non riuscito", de: "Daten konnten nicht geladen werden", fr: "Échec du chargement des données", es: "No se pudieron cargar los datos" },
    retry: { sl: "Poskusi znova", en: "Try again", it: "Riprova", de: "Erneut versuchen", fr: "Réessayer", es: "Reintentar" },
    // Povzetek
    sumPending: { sl: "Na čakanju (PENDING)", en: "Pending (PENDING)", it: "In attesa (PENDING)", de: "Ausstehend (PENDING)", fr: "En attente (PENDING)", es: "Pendiente (PENDING)" },
    sumConfirmed: { sl: "Potrjeno", en: "Confirmed", it: "Confermato", de: "Bestätigt", fr: "Confirmé", es: "Confirmado" },
    sumPaid: { sl: "Izplačano", en: "Paid", it: "Pagato", de: "Ausgezahlt", fr: "Payé", es: "Pagado" },
    sumClicks: { sl: "Skupaj klikanj", en: "Total clicks", it: "Clic totali", de: "Klicks gesamt", fr: "Total des clics", es: "Clics totales" },
    entriesLabel: { sl: "Vnosov", en: "Entries", it: "Voci", de: "Einträge", fr: "Entrées", es: "Entradas" },
    monetizedLabel: { sl: "Moniziranih klikanj", en: "Monetized clicks", it: "Clic monetizzati", de: "Monetarisierte Klicks", fr: "Clics monétisés", es: "Clics monetizados" },
    // Klikanja po partnerjih
    clicksTitle: { sl: "Klikanja po partnerjih", en: "Clicks by partner", it: "Clic per partner", de: "Klicks je Partner", fr: "Clics par partenaire", es: "Clics por socio" },
    clicksNote: {
      sl: "Naša lastna meritev — klik na partnersko povezavo ni (še) rezervacija.",
      en: "Our own measurement — a click on a partner link is not (yet) a booking.",
      it: "Nostra misurazione interna — un clic su un link partner non è (ancora) una prenotazione.",
      de: "Unsere eigene Messung — ein Klick auf einen Partner-Link ist (noch) keine Buchung.",
      fr: "Notre propre mesure — un clic sur un lien partenaire n'est pas (encore) une réservation.",
      es: "Medición propia — un clic en un enlace de socio no es (todavía) una reserva.",
    },
    thPartner: { sl: "Partner", en: "Partner", it: "Partner", de: "Partner", fr: "Partenaire", es: "Socio" },
    thCategory: { sl: "Kategorija", en: "Category", it: "Categoria", de: "Kategorie", fr: "Catégorie", es: "Categoría" },
    thTotal: { sl: "Skupaj", en: "Total", it: "Totale", de: "Gesamt", fr: "Total", es: "Total" },
    th7: { sl: "Zadnjih 7 dni", en: "Last 7 days", it: "Ultimi 7 giorni", de: "Letzte 7 Tage", fr: "7 derniers jours", es: "Últimos 7 días" },
    th30: { sl: "Zadnjih 30 dni", en: "Last 30 days", it: "Ultimi 30 giorni", de: "Letzte 30 Tage", fr: "30 derniers jours", es: "Últimos 30 días" },
    thStatus: { sl: "Stanje", en: "Status", it: "Stato", de: "Status", fr: "Statut", es: "Estado" },
    statusActive: { sl: "Aktiviran", en: "Activated", it: "Attivato", de: "Aktiviert", fr: "Activé", es: "Activado" },
    setEnv: { sl: "Nastavi", en: "Set", it: "Imposta", de: "Setze", fr: "Définis", es: "Configura" },
    noCommission: { sl: "Brez provizije", en: "No commission", it: "Senza provvigione", de: "Keine Provision", fr: "Sans commission", es: "Sin comisión" },
    // Provizijski dnevnik
    journalTitle: { sl: "Provizijski dnevnik", en: "Commission journal", it: "Registro delle provvigioni", de: "Provisionsjournal", fr: "Journal des commissions", es: "Diario de comisiones" },
    journalNote: { sl: "Zadnjih 200 vnosov, padajoče po datumu.", en: "Latest 200 entries, newest first.", it: "Ultime 200 voci, dalle più recenti.", de: "Letzte 200 Einträge, neueste zuerst.", fr: "200 dernières entrées, plus récentes en premier.", es: "Últimas 200 entradas, primero las más recientes." },
    thRef: { sl: "Rez. št.", en: "Booking ref", it: "Rif. prenot.", de: "Buch.-Nr.", fr: "Réf. résa.", es: "Ref. reserva" },
    thFor: { sl: "Za", en: "For", it: "Per", de: "Für", fr: "Pour", es: "Para" },
    thAmount: { sl: "Vrednost €", en: "Value €", it: "Valore €", de: "Wert €", fr: "Valeur €", es: "Valor €" },
    thCommission: { sl: "Provizija €", en: "Commission €", it: "Provvigione €", de: "Provision €", fr: "Commission €", es: "Comisión €" },
    thPayout: { sl: "Izplačilo", en: "Payout", it: "Pagamento", de: "Auszahlung", fr: "Paiement", es: "Pago" },
    thSource: { sl: "Vir", en: "Source", it: "Fonte", de: "Quelle", fr: "Source", es: "Origen" },
    thAction: { sl: "Akcija", en: "Action", it: "Azione", de: "Aktion", fr: "Action", es: "Acción" },
    statusPendingLabel: { sl: "Na čakanju", en: "Pending", it: "In attesa", de: "Ausstehend", fr: "En attente", es: "Pendiente" },
    statusConfirmedLabel: { sl: "Potrjeno", en: "Confirmed", it: "Confermato", de: "Bestätigt", fr: "Confirmé", es: "Confirmado" },
    statusPaidLabel: { sl: "Izplačano", en: "Paid", it: "Pagato", de: "Ausgezahlt", fr: "Payé", es: "Pagado" },
    emptyJournal: {
      sl: "Se ni vnosov — vnosi se dodajajo iz poročil partnerjev.",
      en: "No entries yet — entries are added from partner reports.",
      it: "Ancora nessuna voce — le voci vengono aggiunte dai report dei partner.",
      de: "Noch keine Einträge — Einträge werden aus Partnerberichten hinzugefügt.",
      fr: "Aucune entrée pour l'instant — les entrées sont ajoutées à partir des rapports des partenaires.",
      es: "Aún no hay entradas — las entradas se añaden desde los informes de socios.",
    },
    confirm: { sl: "Potrdi", en: "Confirm", it: "Conferma", de: "Bestätigen", fr: "Confirmer", es: "Confirmar" },
    markPaid: { sl: "Označi izplačano", en: "Mark as paid", it: "Segna come pagato", de: "Als ausgezahlt markieren", fr: "Marquer comme payé", es: "Marcar como pagado" },
    // Forma
    formTitle: { sl: "Nov vnos iz poročila", en: "New entry from a report", it: "Nuova voce da un report", de: "Neuer Eintrag aus einem Bericht", fr: "Nouvelle entrée d'un rapport", es: "Nueva entrada de un informe" },
    formNote: {
      sl: "Vnos iz poročila partnerja: rezervacijska številka in znesek. Provizijo, če je ne vpišeš, ocenimo iz registra — pri partnerjih brez ocene (P0-F: novi partnerji) je vnos provizije obvezen, saj ocene ne izmišljujemo. Poročilo je resnica.",
      en: "An entry from a partner report: booking reference and value. If you leave the commission empty, we estimate it from the registry — for partners without an estimate (P0-F: new partners) the commission input is required, as we do not invent estimates. The report is the truth.",
      it: "Una voce da un report dei partner: riferimento di prenotazione e valore. Se lasci vuota la provvigione, la stimiamo dal registro — per i partner senza stima (P0-F: nuovi partner) l'inserimento della provvigione è obbligatorio, perché non inventiamo stime. Il report è la verità.",
      de: "Ein Eintrag aus einem Partnerbericht: Buchungsreferenz und Wert. Lässt du die Provision leer, schätzen wir sie aus dem Register — bei Partnern ohne Schätzung (P0-F: neue Partner) ist die Eingabe der Provision Pflicht, denn wir erfinden keine Schätzungen. Der Bericht ist die Wahrheit.",
      fr: "Une entrée d'un rapport de partenaire : référence de réservation et valeur. Si tu laisses la commission vide, nous l'estimons à partir du registre — pour les partenaires sans estimation (P0-F : nouveaux partenaires), la saisie de la commission est obligatoire, car nous n'inventons pas d'estimations. Le rapport est la vérité.",
      es: "Una entrada de un informe de socio: referencia de reserva y valor. Si dejas la comisión vacía, la estimamos a partir del registro — para los socios sin estimación (P0-F: socios nuevos), introducir la comisión es obligatorio, porque no inventamos estimaciones. El informe es la verdad.",
    },
    fPartner: { sl: "Partner", en: "Partner", it: "Partner", de: "Partner", fr: "Partenaire", es: "Socio" },
    fPartnerPh: { sl: "Izberi partnerja", en: "Select a partner", it: "Seleziona un partner", de: "Partner auswählen", fr: "Sélectionner un partenaire", es: "Selecciona un socio" },
    fPartnerErr: { sl: "Izberi partnerja iz seznama.", en: "Pick a partner from the list.", it: "Scegli un partner dall'elenco.", de: "Wähle einen Partner aus der Liste.", fr: "Choisis un partenaire dans la liste.", es: "Elige un socio de la lista." },
    fRef: { sl: "Številka rezervacije", en: "Booking reference", it: "Riferimento di prenotazione", de: "Buchungsreferenz", fr: "Référence de réservation", es: "Referencia de reserva" },
    fFor: { sl: "Za (opis)", en: "For (description)", it: "Per (descrizione)", de: "Für (Beschreibung)", fr: "Pour (description)", es: "Para (descripción)" },
    fForPh: { sl: "npr. Hotel Bled", en: "e.g. Hotel Bled", it: "es. Hotel Bled", de: "z. B. Hotel Bled", fr: "ex. Hotel Bled", es: "p. ej. Hotel Bled" },
    fAmount: { sl: "Vrednost rezervacije (EUR)", en: "Booking value (EUR)", it: "Valore della prenotazione (EUR)", de: "Buchungswert (EUR)", fr: "Valeur de la réservation (EUR)", es: "Valor de la reserva (EUR)" },
    fCommission: { sl: "Provizija (EUR)", en: "Commission (EUR)", it: "Provvigione (EUR)", de: "Provision (EUR)", fr: "Commission (EUR)", es: "Comisión (EUR)" },
    fCommissionPh: { sl: "prazno = ocena {pct} %", en: "empty = estimate {pct} %", it: "vuoto = stima {pct} %", de: "leer = Schätzung {pct} %", fr: "vide = estimation {pct} %", es: "vacío = estimación {pct} %" },
    fCommissionPhNoPct: { sl: "prazno = ocena po registru", en: "empty = registry estimate", it: "vuoto = stima dal registro", de: "leer = Schätzung aus dem Register", fr: "vide = estimation du registre", es: "vacío = estimación del registro" },
    fCommissionPhUnknown: {
      sl: "obvezno — register nima ocene",
      en: "required — registry has no estimate",
      it: "obbligatorio — il registro non ha una stima",
      de: "erforderlich — das Register hat keine Schätzung",
      fr: "obligatoire — le registre n'a pas d'estimation",
      es: "obligatorio — el registro no tiene estimación",
    },
    fStay: { sl: "Datum zaključka bivanja", en: "Stay completed on", it: "Soggiorno completato il", de: "Aufenthalt abgeschlossen am", fr: "Séjour terminé le", es: "Estancia finalizada el" },
    fNote: { sl: "Opomba", en: "Note", it: "Nota", de: "Notiz", fr: "Note", es: "Nota" },
    fSubmit: { sl: "Dodaj vnos", en: "Add entry", it: "Aggiungi voce", de: "Eintrag hinzufügen", fr: "Ajouter l'entrée", es: "Añadir entrada" },
    fSubmitting: { sl: "Dodajam …", en: "Adding …", it: "Aggiunta …", de: "Wird hinzugefügt …", fr: "Ajout …", es: "Añadiendo …" },
    okTitle: { sl: "Vnos dodan", en: "Entry added", it: "Voce aggiunta", de: "Eintrag hinzugefügt", fr: "Entrée ajoutée", es: "Entrada añadida" },
    okBody: {
      sl: "Vnos iz poročila je shranjen v provizijski dnevnik.",
      en: "The report entry is saved to the commission journal.",
      it: "La voce del report è salvata nel registro delle provvigioni.",
      de: "Der Berichtseintrag ist im Provisionsjournal gespeichert.",
      fr: "L'entrée du rapport est enregistrée dans le journal des commissions.",
      es: "La entrada del informe se ha guardado en el diario de comisiones.",
    },
    errTitle: { sl: "Vnosa ni bilo mogoče dodati", en: "Could not add the entry", it: "Impossibile aggiungere la voce", de: "Eintrag konnte nicht hinzugefügt werden", fr: "Impossible d'ajouter l'entrée", es: "No se pudo añadir la entrada" },
    statusErrTitle: { sl: "Sprememba statusa ni uspela", en: "Status change failed", it: "Cambio di stato non riuscito", de: "Statusänderung fehlgeschlagen", fr: "Échec du changement de statut", es: "El cambio de estado falló" },
    errNetwork: { sl: "Omrežna napaka — poskusi znova.", en: "Network error — try again.", it: "Errore di rete — riprova.", de: "Netzwerkfehler — versuche es erneut.", fr: "Erreur réseau — réessaie.", es: "Error de red — reintenta." },
    errGeneric: { sl: "Neznana napaka strežnika.", en: "Unknown server error.", it: "Errore sconosciuto del server.", de: "Unbekannter Serverfehler.", fr: "Erreur serveur inconnue.", es: "Error desconocido del servidor." },
    // Iskrenostna opomba (kanon)
    honesty: {
      sl: "Vnosi izhajajo IZKLJUČNO iz poročil partnerjev. Klikanja so naša lastna meritev; provizije se potrdijo v partnerjevem poročilu (izračun izplačila: 28. v mesecu, 3 meseca po bivanju — vzorec MindTrip).",
      en: "Entries come EXCLUSIVELY from partner reports. Clicks are our own measurement; commissions are confirmed in the partner's report (payout calculation: the 28th of the month, 3 months after the stay — the MindTrip pattern).",
      it: "Le voci derivano ESCLUSIVAMENTE dai report dei partner. I clic sono una nostra misurazione interna; le provvigioni vengono confermate nel report del partner (calcolo del pagamento: il 28 del mese, 3 mesi dopo il soggiorno — lo schema MindTrip).",
      de: "Einträge stammen AUSSCHLIESSLICH aus Partnerberichten. Klicks sind unsere eigene Messung; Provisionen werden im Bericht des Partners bestätigt (Auszahlungsberechnung: der 28. des Monats, 3 Monate nach dem Aufenthalt — das MindTrip-Muster).",
      fr: "Les entrées proviennent EXCLUSIVEMENT des rapports des partenaires. Les clics sont notre propre mesure ; les commissions sont confirmées dans le rapport du partenaire (calcul du paiement : le 28 du mois, 3 mois après le séjour — le schéma MindTrip).",
      es: "Las entradas provienen EXCLUSIVAMENTE de los informes de socios. Los clics son una medición propia; las comisiones se confirman en el informe del socio (cálculo del pago: el día 28 del mes, 3 meses después de la estancia — el patrón MindTrip).",
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
    return new Intl.DateTimeFormat(intlDateLocale(l), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  };

  const fmtDateTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(intlDateLocale(l), {
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
    ? selectedDef.commissionPct == null
      ? pick(l, L.fCommissionPhUnknown)
      : pick(l, L.fCommissionPh).replace("{pct}", String(selectedDef.commissionPct))
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
