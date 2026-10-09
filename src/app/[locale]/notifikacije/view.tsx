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
  kicker: { sl: "Obvestila", en: "Notifications", it: "Notifiche", de: "Benachrichtigungen", fr: "Notifications", es: "Notificaciones" },
  title: { sl: "Notifikacijski center", en: "Notification center", it: "Centro notifiche", de: "Benachrichtigungs-Zentrum", fr: "Centre de notifications", es: "Centro de notificaciones" },
  lead: {
    sl: "Opozorila tvojih spremljanj in spremembe na tvojih potovanjih — vse na enem mestu, samo za tvoj račun.",
    en: "Alerts from your watches and changes on your trips — in one place, for your account only.",
    it: "Avvisi dai tuoi monitoraggi e cambiamenti sui tuoi viaggi — tutto in un posto, solo per il tuo account.",
    de: "Warnungen deiner Beobachtungen und Änderungen auf deinen Reisen — an einem Ort, nur für dein Konto.",
    fr: "Alertes de tes suivis et changements sur tes voyages — au même endroit, pour ton compte uniquement.",
    es: "Alertas de tus seguimientos y cambios en tus viajes — en un solo lugar, solo para tu cuenta.",
  },
  signInNeeded: { sl: "Za obvestila se prijavi", en: "Sign in for notifications", it: "Accedi per le notifiche", de: "Melde dich für Benachrichtigungen an", fr: "Connecte-toi pour les notifications", es: "Inicia sesión para las notificaciones" },
  signInLead: {
    sl: "Obvestila in spremljanja so vezana na tvoj račun — sledijo ti, ne napravi.",
    en: "Notifications and watches belong to your account — they follow you, not the device.",
    it: "Notifiche e monitoraggi appartengono al tuo account — ti seguono, non al dispositivo.",
    de: "Benachrichtigungen und Beobachtungen gehören zu deinem Konto — sie folgen dir, nicht dem Gerät.",
    fr: "Notifications et suivis appartiennent à ton compte — ils te suivent, pas l’appareil.",
    es: "Notificaciones y seguimientos pertenecen a tu cuenta — te siguen a ti, no al dispositivo.",
  },
  signInCta: { sl: "Pojdi na prijavo", en: "Go to sign in", it: "Vai all’accesso", de: "Zur Anmeldung", fr: "Aller à la connexion", es: "Ir al inicio de sesión" },
  loading: { sl: "Nalaganje …", en: "Loading …", it: "Caricamento …", de: "Lädt …", fr: "Chargement …", es: "Cargando …" },
  loadError: { sl: "Nalaganje ni uspelo.", en: "Failed to load.", it: "Caricamento non riuscito.", de: "Laden fehlgeschlagen.", fr: "Échec du chargement.", es: "Error al cargar." },
  retry: { sl: "Poskusi znova", en: "Try again", it: "Riprova", de: "Erneut versuchen", fr: "Réessayer", es: "Reintentar" },
  cancel: { sl: "Prekliči", en: "Cancel", it: "Annulla", de: "Abbrechen", fr: "Annuler", es: "Cancelar" },

  // obvestila
  inboxTitle: { sl: "Obvestila", en: "Inbox", it: "Posta in arrivo", de: "Posteingang", fr: "Boîte de réception", es: "Bandeja de entrada" },
  inboxDesc: {
    sl: "Največ 100 najnovejših. Neprebrana so poudarjena.",
    en: "Up to 100 latest. Unread entries are highlighted.",
    it: "Fino alle 100 più recenti. Le voci non lette sono evidenziate.",
    de: "Bis zu 100 der neuesten. Ungelesene Einträge sind hervorgehoben.",
    fr: "Jusqu’aux 100 plus récentes. Les entrées non lues sont mises en évidence.",
    es: "Hasta las 100 más recientes. Las entradas sin leer están resaltadas.",
  },
  markAllRead: { sl: "Označi vse prebrano", en: "Mark all read", it: "Segna tutte come lette", de: "Alle als gelesen markieren", fr: "Tout marquer comme lu", es: "Marcar todo como leído" },
  clearRead: { sl: "Počisti prebrana", en: "Clear read", it: "Cancella le lette", de: "Gelesene löschen", fr: "Effacer les lues", es: "Borrar leídas" },
  clearAll: { sl: "Počisti vse", en: "Clear all", it: "Cancella tutte", de: "Alle löschen", fr: "Tout effacer", es: "Borrar todas" },
  empty: {
    sl: "Ni obvestil — ko se kaj zgodi, se pokažejo tu.",
    en: "No notifications yet — they will appear here.",
    it: "Nessuna notifica — compariranno qui.",
    de: "Noch keine Benachrichtigungen — sie erscheinen hier.",
    fr: "Pas encore de notifications — elles apparaîtront ici.",
    es: "Aún no hay notificaciones — aparecerán aquí.",
  },
  unread: { sl: "neprebranih", en: "unread", it: "non lette", de: "ungelesen", fr: "non lues", es: "sin leer" },
  markRead: { sl: "Označi prebrano", en: "Mark read", it: "Segna come letta", de: "Als gelesen markieren", fr: "Marquer comme lue", es: "Marcar como leída" },
  clearConfirmTitle: { sl: "Počistim vsa obvestila?", en: "Clear all notifications?", it: "Cancellare tutte le notifiche?", de: "Alle Benachrichtigungen löschen?", fr: "Effacer toutes les notifications ?", es: "¿Borrar todas las notificaciones?" },
  clearConfirmDesc: {
    sl: "Vsa obvestila (prebrana in neprebrana) se trajno izbrišejo. Dejanja ni mogoče razveljaviti.",
    en: "All notifications (read and unread) are permanently deleted. This cannot be undone.",
    it: "Tutte le notifiche (lette e non lette) vengono eliminate definitivamente. L’azione non è reversibile.",
    de: "Alle Benachrichtigungen (gelesen und ungelesen) werden dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.",
    fr: "Toutes les notifications (lues et non lues) sont définitivement supprimées. Cela ne peut pas être annulé.",
    es: "Todas las notificaciones (leídas y sin leer) se borran definitivamente. Esto no se puede deshacer.",
  },
  clearConfirmCta: { sl: "Da, počisti", en: "Yes, clear", it: "Sì, cancella", de: "Ja, löschen", fr: "Oui, effacer", es: "Sí, borrar" },

  // spremljanja
  watchTitle: { sl: "Spremljanja", en: "Watches", it: "Monitoraggi", de: "Beobachtungen", fr: "Suivis", es: "Seguimientos" },
  watchDesc: {
    sl: "Stvari, ki jih opazujejo deterministična pravila (0-AI): cena izdelka, vreme na poti, dnevi do poti, rezervacije pred odhodom. Opozorilo nastane samo iz preverljivih podatkov.",
    en: "Things watched by deterministic rules (0-AI): product price, trip weather, trip countdown, bookings before departure. Alerts only come from verifiable data.",
    it: "Cose osservate da regole deterministiche (0-IA): prezzo del prodotto, meteo del viaggio, conto alla rovescia del viaggio, prenotazioni prima della partenza. Gli avvisi nascono solo da dati verificabili.",
    de: "Dinge, die von deterministischen Regeln beobachtet werden (0-KI): Produktpreis, Reisewetter, Reise-Countdown, Buchungen vor der Abreise. Warnungen kommen nur aus überprüfbaren Daten.",
    fr: "Choses surveillées par des règles déterministes (0-IA) : prix du produit, météo du voyage, compte à rebours du voyage, réservations avant le départ. Les alertes ne viennent que de données vérifiables.",
    es: "Cosas vigiladas por reglas deterministas (0-IA): precio del producto, tiempo del viaje, cuenta atrás del viaje, reservas antes de la salida. Las alertas solo provienen de datos verificables.",
  },
  watchEmpty: {
    sl: "Ni spremljanj. Dodaj jih tam, kjer si: gumb »Spremljaj ceno« na tržnici ali »Spremljaj« na svoji poti.",
    en: "No watches yet. Add them where you are: “Watch price” in the marketplace or “Watch” on your trip.",
    it: "Ancora nessun monitoraggio. Aggiungili dove sei: «Osserva prezzo» nel marketplace oppure «Osserva» sul tuo viaggio.",
    de: "Noch keine Beobachtungen. Füge sie dort hinzu, wo du bist: „Preis beobachten“ im Marktplatz oder „Beobachten“ auf deiner Reise.",
    fr: "Pas encore de suivis. Ajoute-les là où tu es : « Surveiller le prix » sur la marketplace ou « Surveiller » sur ton voyage.",
    es: "Aún no hay seguimientos. Añádelos donde estés: «Vigilar precio» en el mercado o «Vigilar» en tu viaje.",
  },
  active: { sl: "Aktivno", en: "Active", it: "Attivo", de: "Aktiv", fr: "Actif", es: "Activo" },
  paused: { sl: "V pavzi", en: "Paused", it: "In pausa", de: "Pausiert", fr: "En pause", es: "En pausa" },
  pause: { sl: "Zaustavi", en: "Pause", it: "Metti in pausa", de: "Pausieren", fr: "Mettre en pause", es: "Pausar" },
  resume: { sl: "Nadaljuj", en: "Resume", it: "Riprendi", de: "Fortsetzen", fr: "Reprendre", es: "Reanudar" },
  delete: { sl: "Izbriši", en: "Delete", it: "Elimina", de: "Löschen", fr: "Supprimer", es: "Borrar" },
  watchDeleteTitle: { sl: "Izbrišem spremljanje?", en: "Delete this watch?", it: "Eliminare questo monitoraggio?", de: "Diese Beobachtung löschen?", fr: "Supprimer ce suivi ?", es: "¿Borrar este seguimiento?" },
  watchDeleteDesc: {
    sl: "Spremljanje se trajno izbriše (v dnevniku dejanj ostane zapis o izbrisu).",
    en: "The watch is permanently deleted (an audit record of the deletion remains).",
    it: "Il monitoraggio viene eliminato definitivamente (resta un record di audit dell’eliminazione).",
    de: "Die Beobachtung wird dauerhaft gelöscht (ein Audit-Eintrag zur Löschung bleibt erhalten).",
    fr: "Le suivi est définitivement supprimé (un enregistrement d’audit de la suppression reste).",
    es: "El seguimiento se borra definitivamente (queda un registro de auditoría de la eliminación).",
  },
  lastChecked: { sl: "Zadnje preverjanje", en: "Last checked", it: "Ultimo controllo", de: "Zuletzt geprüft", fr: "Dernière vérification", es: "Última comprobación" },
  lastTriggered: { sl: "Zadnje opozorilo", en: "Last alert", it: "Ultimo avviso", de: "Letzte Warnung", fr: "Dernière alerte", es: "Última alerta" },
  never: { sl: "še ne", en: "not yet", it: "ancora no", de: "noch nicht", fr: "pas encore", es: "aún no" },
  priceKind: { sl: "Cena izdelka", en: "Product price", it: "Prezzo del prodotto", de: "Produktpreis", fr: "Prix du produit", es: "Precio del producto" },
  weatherKind: { sl: "Vreme na poti", en: "Trip weather", it: "Meteo del viaggio", de: "Reisewetter", fr: "Météo du voyage", es: "Tiempo del viaje" },
  tripDayKind: { sl: "Dnevi do poti", en: "Trip countdown", it: "Conto alla rovescia del viaggio", de: "Reise-Countdown", fr: "Compte à rebours du voyage", es: "Cuenta atrás del viaje" },
  bookingKind: { sl: "Rezervacije pred potjo", en: "Bookings before trip", it: "Prenotazioni prima del viaggio", de: "Buchungen vor der Reise", fr: "Réservations avant le voyage", es: "Reservas antes del viaje" },

  // iskrenost
  honestyTitle: { sl: "Kako deluje (iskreno)", en: "How it works (honestly)", it: "Come funziona (con onestà)", de: "Wie es funktioniert (ehrlich)", fr: "Comment ça marche (honnêtement)", es: "Cómo funciona (con honestidad)" },
  honesty1: {
    sl: "Preverjanja tečejo samodejno približno vsaki 2 uri (cron). Opozorila so čista pravila — 0 AI modelov, 0 ugibanj.",
    en: "Checks run automatically about every 2 hours (cron). Alerts are pure rules — 0 AI models, 0 guessing.",
    it: "I controlli girano automaticamente circa ogni 2 ore (cron). Gli avvisi sono regole pure — 0 modelli di IA, 0 congetture.",
    de: "Prüfungen laufen automatisch etwa alle 2 Stunden (Cron). Warnungen sind reine Regeln — 0 KI-Modelle, 0 Rätselraten.",
    fr: "Les vérifications tournent automatiquement environ toutes les 2 heures (cron). Les alertes sont de pures règles — 0 modèle d’IA, 0 supposition.",
    es: "Las comprobaciones se ejecutan automáticamente cada ~2 horas (cron). Las alertas son reglas puras — 0 modelos de IA, 0 conjeturas.",
  },
  honesty2: {
    sl: "PWA potisk NI implementiran — obvestila so in-app (zvonček v glavi se osvežuje vsako minuto). Nikoli ne pošiljamo tvojih podatkov tretjim osebam.",
    en: "PWA push is NOT implemented — notifications are in-app (the header bell refreshes every minute). We never send your data to third parties.",
    it: "Il push PWA NON è implementato — le notifiche sono in-app (la campanella nell’intestazione si aggiorna ogni minuto). Non inviamo mai i tuoi dati a terzi.",
    de: "PWA-Push ist NICHT implementiert — Benachrichtigungen sind In-App (die Glocke im Header aktualisiert sich jede Minute). Wir senden deine Daten nie an Dritte.",
    fr: "Le push PWA n’est PAS implémenté — les notifications sont in-app (la cloche de l’en-tête s’actualise chaque minute). Nous n’envoyons jamais tes données à des tiers.",
    es: "El push PWA NO está implementado — las notificaciones son in-app (la campana del encabezado se actualiza cada minuto). Nunca enviamos tus datos a terceros.",
  },
  honesty3: {
    sl: "Razpoložljivosti lokalk in sprememb letov NE spremljamo — vira tega ne potrjujeta prek naše plasti, zato odklanjamo namesto da bi izmišljevali.",
    en: "Restaurant availability and flight changes are NOT watched — the sources do not confirm them through our layer, so we refuse instead of inventing.",
    it: "La disponibilità dei ristoranti e i cambi di volo NON sono monitorati — le fonti non li confermano attraverso il nostro livello, quindi rifiutiamo invece di inventare.",
    de: "Restaurant-Verfügbarkeit und Flugänderungen werden NICHT beobachtet — die Quellen bestätigen sie nicht über unsere Schicht, daher lehnen wir ab, statt zu erfinden.",
    fr: "La disponibilité des restaurants et les changements de vols ne sont PAS surveillés — les sources ne les confirment pas via notre couche, donc nous refusons au lieu d’inventer.",
    es: "La disponibilidad de restaurantes y los cambios de vuelo NO se vigilan — las fuentes no los confirman a través de nuestra capa, así que rechazamos en lugar de inventar.",
  },
  auditNote: {
    sl: "Revizija: vsako dejanje (dodaj/pavza/izbris/opozorilo) se zapiše v dnevnik — append-only, brez skrivnosti v zapisih.",
    en: "Audit: every action (add/pause/delete/alert) is written to an append-only log — no secrets in the records.",
    it: "Audit: ogni azione (aggiungi/pausa/elimina/avviso) viene scritta in un registro append-only — nessun segreto nei record.",
    de: "Audit: jede Aktion (hinzufügen/pausieren/löschen/warnen) wird in ein Append-only-Log geschrieben — keine Geheimnisse in den Einträgen.",
    fr: "Audit : chaque action (ajout/pause/suppression/alerte) est écrite dans un journal en ajout seul — aucun secret dans les enregistrements.",
    es: "Auditoría: cada acción (añadir/pausar/borrar/alerta) se escribe en un registro de solo adición — sin secretos en los registros.",
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
    pick(locale, KIND_LABELS[kind] ?? { sl: kind, en: kind, it: kind, de: kind, fr: kind, es: kind });

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
