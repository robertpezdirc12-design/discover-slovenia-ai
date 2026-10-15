"use client";

/**
 * CHECKOUT-MODAL — zaključek nakupa izdelka lastne tržnice.
 *
 * Dialog: izdelek → količina (1–10, omejena z zalogo) → skupna cena →
 * gumb "Zaključi nakup" (POST /api/checkout { slug, qty, visitorKey }).
 *
 * Odgovor odloči nadaljevanje (iskrenostni kanon):
 *  - { url }  → PRAVI Stripe Checkout → window.location.href = url;
 *  - { demo: true, orderId, status: "paid" } → DEMO potrditev z
 *    IZRECNO oznako DEMO ("demo plačilo — brez prave bremenitve");
 *  - { error } → napaka (toast + besedilo v dialogu).
 *
 * Gostov visitorKey (UUID) se hrani v localStorage "dai:visitor-key"
 * in strežniku pošlje z zahtevo (dedup nezaključenih naročil).
 */

import {
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { pick } from "@/lib/i18n-pick";
import {
  formatPriceCents,
  isCheckoutDemoResponse,
  isCheckoutUrlResponse,
  type CheckoutErrorResponse,
  type MarketplaceProduct,
} from "@/components/marketplace/types";

const VISITOR_KEY_STORAGE = "dai:visitor-key";
const MIN_QTY = 1;
const MAX_QTY = 10;

const L = {
  title: { sl: "Zaključi nakup", en: "Complete purchase", it: "Completa l'acquisto", de: "Kauf abschließen", fr: "Finaliser l'achat", es: "Completar la compra" },
  description: {
    sl: "Preglejte naročilo in potrdite nakup.",
    en: "Review your order and confirm the purchase.",
    it: "Controlla l'ordine e conferma l'acquisto.",
    de: "Überprüfe deine Bestellung und bestätige den Kauf.",
    fr: "Vérifie ta commande et confirme l'achat.",
    es: "Revisa tu pedido y confirma la compra.",
  },
  qty: { sl: "Količina", en: "Quantity", it: "Quantità", de: "Menge", fr: "Quantité", es: "Cantidad" },
  decreaseQty: { sl: "Zmanjšaj količino", en: "Decrease quantity", it: "Riduci la quantità", de: "Menge verringern", fr: "Diminuer la quantité", es: "Reducir cantidad" },
  increaseQty: { sl: "Povečaj količino", en: "Increase quantity", it: "Aumenta la quantità", de: "Menge erhöhen", fr: "Augmenter la quantité", es: "Aumentar cantidad" },
  unitPrice: { sl: "Cena na kos", en: "Price per unit", it: "Prezzo per unità", de: "Preis pro Stück", fr: "Prix à l'unité", es: "Precio por unidad" },
  total: { sl: "Skupaj", en: "Total", it: "Totale", de: "Gesamt", fr: "Total", es: "Total" },
  stockNote: { sl: "Na zalogi", en: "In stock", it: "In magazzino", de: "Auf Lager", fr: "En stock", es: "En stock" },
  confirm: { sl: "Zaključi nakup", en: "Complete purchase", it: "Completa l'acquisto", de: "Kauf abschließen", fr: "Finaliser l'achat", es: "Completar la compra" },
  processing: { sl: "Obdelava …", en: "Processing …", it: "Elaborazione …", de: "Verarbeitung …", fr: "Traitement …", es: "Procesando …" },
  demoTitle: { sl: "Naročilo je bilo ustvarjeno", en: "Order created", it: "Ordine creato", de: "Bestellung erstellt", fr: "Commande créée", es: "Pedido creado" },
  demoBadge: { sl: "DEMO", en: "DEMO", it: "DEMO", de: "DEMO", fr: "DEMO", es: "DEMO" },
  demoNote: {
    sl: "Demo plačilo — brez prave bremenitve. V peskovniku so prava plačila izklopljena.",
    en: "Demo payment — no real charge. Real payments are disabled in the sandbox.",
    it: "Pagamento demo — nessun addebito reale. I pagamenti reali sono disattivati nella sandbox.",
    de: "Demo-Zahlung — keine echte Belastung. Echte Zahlungen sind in der Sandbox deaktiviert.",
    fr: "Paiement démo — aucun débit réel. Les paiements réels sont désactivés dans la sandbox.",
    es: "Pago demo — sin cargo real. Los pagos reales están desactivados en el sandbox.",
  },
  demoOrderNo: { sl: "Številka naročila", en: "Order number", it: "Numero d'ordine", de: "Bestellnummer", fr: "Numéro de commande", es: "Número de pedido" },
  close: { sl: "Zapri", en: "Close", it: "Chiudi", de: "Schließen", fr: "Fermer", es: "Cerrar" },
  buyAgain: { sl: "Nakupuj naprej", en: "Continue shopping", it: "Continua gli acquisti", de: "Weiter einkaufen", fr: "Continuer les achats", es: "Seguir comprando" },
  requestCancel: { sl: "Zahtevaj preklic", en: "Request cancellation", it: "Richiedi l'annullamento", de: "Stornierung anfordern", fr: "Demander l'annulation", es: "Solicitar cancelación" },
  cancelRequested: {
    sl: "Zahtevek za preklic je podan — povratek NE steče samodejno; obravnava ga lastnik pri plačilnem ponudniku.",
    en: "Cancellation request submitted — the refund does NOT happen automatically; the owner handles it at the payment provider.",
    it: "Richiesta di annullamento inviata — il rimborso NON avviene automaticamente; se ne occupa il titolare presso il fornitore di pagamenti.",
    de: "Stornierungsanfrage eingereicht — die Rückerstattung erfolgt NICHT automatisch; der Inhaber bearbeitet sie beim Zahlungsdienstleister.",
    fr: "Demande d'annulation envoyée — le remboursement ne se fait PAS automatiquement ; le propriétaire la traite auprès du prestataire de paiement.",
    es: "Solicitud de cancelación enviada — el reembolso NO se realiza automáticamente; la gestiona el propietario en el proveedor de pagos.",
  },
  cancelErr: { sl: "Zahtevek ni uspel. Poskusi znova.", en: "The request failed. Try again.", it: "La richiesta non è andata a buon fine. Riprova.", de: "Die Anfrage ist fehlgeschlagen. Versuche es erneut.", fr: "La demande a échoué. Réessaie.", es: "La solicitud falló. Inténtalo de nuevo." },
  errPurchase: { sl: "Nakupa ni bilo mogoče zaključiti.", en: "The purchase could not be completed.", it: "Non è stato possibile completare l'acquisto.", de: "Der Kauf konnte nicht abgeschlossen werden.", fr: "L'achat n'a pas pu être finalisé.", es: "No se pudo completar la compra." },
  errTitle: { sl: "Nakup ni uspel", en: "Purchase failed", it: "Acquisto non riuscito", de: "Kauf fehlgeschlagen", fr: "Échec de l'achat", es: "Error en la compra" },
  errNetwork: { sl: "Omrežna napaka — poskusite znova.", en: "Network error — please try again.", it: "Errore di rete — riprova.", de: "Netzwerkfehler — bitte erneut versuchen.", fr: "Erreur réseau — veuillez réessayer.", es: "Error de red — inténtalo de nuevo." },
  secureNote: {
    // P0 AUDIT (iskrenost): pred oddajo še ne vemo, kateri kanal bo strežnik
    // izbral (Stripe ali demo) — zato NE trdimo, da plačilo poganja Stripe,
    // ampak dejstvo, ki drži v obeh primerih; demo veja svoje stanje razkrije
    // iskreno po odgovoru (demoNote z DEMO znakom).
    sl: "Plačilo obdela plačilni ponudnik — kartice ne vidimo mi.",
    en: "Payment is handled by the payment provider — your card never reaches us.",
    it: "Il pagamento è gestito dal fornitore di pagamenti — la tua carta non arriva mai a noi.",
    de: "Die Zahlung wird vom Zahlungsdienstleister abgewickelt — deine Karte erreicht uns nie.",
    fr: "Le paiement est traité par le prestataire de paiement — ta carte ne nous parvient jamais.",
    es: "El pago lo gestiona el proveedor de pagos — tu tarjeta nunca llega a nosotros.",
  },
} as const;

/** Gostov ključ iz localStorage (ustvari, če še ni). */
function getOrCreateVisitorKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY_STORAGE);
    if (existing && /^[A-Za-z0-9-]{8,64}$/.test(existing)) return existing;
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
            .toString(36)
            .slice(2)}`;
    window.localStorage.setItem(VISITOR_KEY_STORAGE, generated);
    return generated;
  } catch {
    // Zasebno okno brez localStorage — nakup brez visitorKey (samo tok).
    return null;
  }
}

export interface CheckoutModalProps {
  product: MarketplaceProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckoutModal({
  product,
  open,
  onOpenChange,
}: CheckoutModalProps) {
  const l = useLocale();
  const { toast } = useToast();
  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  const [qty, setQty] = React.useState(MIN_QTY);
  const [state, setState] = React.useState<
    "idle" | "submitting" | "demo-done"
  >("idle");
  const [demoOrderId, setDemoOrderId] = React.useState<string | null>(null);
  const [cancelState, setCancelState] = React.useState<"idle" | "sending" | "requested" | "error">(
    "idle"
  );

  /** ZAHTEVEK KUPCA PO PREKLICU (P0-E §11) — PATCH /api/checkout. */
  const requestCancel = React.useCallback(async () => {
    if (!demoOrderId) return;
    setCancelState("sending");
    try {
      const r = await fetch("/api/checkout", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: demoOrderId,
          visitorKey: getOrCreateVisitorKey(),
        }),
      });
      setCancelState(r.ok ? "requested" : "error");
    } catch {
      setCancelState("error");
    }
  }, [demoOrderId]);
  const [error, setError] = React.useState<string | null>(null);

  const maxQty = product ? Math.min(MAX_QTY, Math.max(MIN_QTY, product.stock)) : MIN_QTY;

  // Ob vsakem odprtju novega izdelka ponastavimo notranje stanje.
  React.useEffect(() => {
    if (open) {
      setQty(MIN_QTY);
      setState("idle");
      setDemoOrderId(null);
      setError(null);
    }
  }, [open, product?.slug]);

  if (!product) return null;

  const totalCents = product.priceCents * qty;

  const onSubmit = async () => {
    setState("submitting");
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: product.slug,
          qty,
          visitorKey: getOrCreateVisitorKey(),
        }),
      });
      const body = (await res.json()) as
        | CheckoutErrorResponse
        | { demo: true; orderId: string; visitorKey: string | null; status: string }
        | { url: string; visitorKey: string | null };

      if (!res.ok || (!isCheckoutDemoResponse(body) && !isCheckoutUrlResponse(body))) {
        const message =
          (body as CheckoutErrorResponse)?.error ?? t("errPurchase");
        setError(message);
        setState("idle");
        toast({
          title: t("errTitle"),
          description: message,
          variant: "destructive",
        });
        return;
      }

      // Strežnik (po potrebi) izda novi visitorKey → shranimo za naslednjič.
      if (body.visitorKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(VISITOR_KEY_STORAGE, body.visitorKey);
        } catch {
          /* zasebno okno — preskočimo */
        }
      }

      if (isCheckoutUrlResponse(body)) {
        // PRAVA veja: preusmeritev na Stripe Checkout.
        window.location.href = body.url;
        return;
      }

      // DEMO veja: izrecno označena potrditev (brez prave bremenitve).
      setDemoOrderId(body.orderId);
      setCancelState("idle");
      setState("demo-done");
    } catch {
      const message = t("errNetwork");
      setError(message);
      setState("idle");
      toast({
        title: t("errTitle"),
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* POLIR11: največja višina 85 dvh + notranje drsenje — dolga vsebina
          zaključka nakupa drsi ZNOTRAJ dialoga namesto da se odreže dno
          (shadcn-ui/ui #16); dvh namesto vh — mobilna vrstica brskalnika
          ne ukrade več spodnjega robu (enako vh na namizju). */}
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-2xl border-border/70 shadow-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {state === "demo-done" ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] to-card p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2
                className="size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <p className="font-bold">{t("demoTitle")}</p>
              <Badge className="ml-auto gap-1 border-amber-600/50 bg-amber-600/10 text-amber-700 dark:text-amber-400">
                {t("demoBadge")}
              </Badge>
            </div>
            {demoOrderId && (
              <p className="text-sm text-muted-foreground">
                {t("demoOrderNo")}:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
                  {demoOrderId}
                </code>
              </p>
            )}
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("demoNote")}
            </p>
            {cancelState !== "idle" && (
              <p
                role={cancelState === "requested" ? "status" : "alert"}
                className={
                  cancelState === "requested"
                    ? "rounded-lg border border-amber-500/50 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : "text-xs text-destructive"
                }
                aria-live="polite"
              >
                {cancelState === "requested" ? t("cancelRequested") : t("cancelErr")}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="mt-1 h-11"
                onClick={() => onOpenChange(false)}
              >
                {t("buyAgain")}
              </Button>
              {demoOrderId && cancelState !== "requested" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-1 h-11"
                  disabled={cancelState === "sending"}
                  onClick={() => void requestCancel()}
                >
                  {t("requestCancel")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Izdelek */}
            <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-card to-muted/20 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="leading-tight font-bold">{product.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t("unitPrice")}: {formatPriceCents(product.priceCents, l)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("stockNote")}: {product.stock}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {formatPriceCents(product.priceCents, l)}
                </Badge>
              </div>
            </div>

            {/* Količina 1–10 */}
            <div className="flex items-center justify-between gap-3">
              <span
                id="checkout-qty-label"
                className="text-sm font-medium"
              >
                {t("qty")}
              </span>
              <div
                className="flex items-center gap-1"
                role="group"
                aria-labelledby="checkout-qty-label"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11"
                  onClick={() => setQty((q) => Math.max(MIN_QTY, q - 1))}
                  disabled={qty <= MIN_QTY || state === "submitting"}
                  aria-label={t("decreaseQty")}
                >
                  <Minus className="size-4" aria-hidden="true" />
                </Button>
                <span
                  className="w-12 text-center text-lg font-bold tabular-nums"
                  aria-live="polite"
                >
                  {qty}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11"
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  disabled={qty >= maxQty || state === "submitting"}
                  aria-label={t("increaseQty")}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* Skupna cena */}
            <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
              <span className="text-sm font-medium">{t("total")}</span>
              <span className="text-lg font-bold tabular-nums text-primary">
                {formatPriceCents(totalCents, l)}
              </span>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                type="button"
                size="lg"
                className="h-12 w-full text-base"
                onClick={onSubmit}
                disabled={state === "submitting" || product.stock < MIN_QTY}
              >
                {state === "submitting" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    {t("processing")}
                  </>
                ) : (
                  t("confirm")
                )}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                {t("secureNote")}
              </p>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
