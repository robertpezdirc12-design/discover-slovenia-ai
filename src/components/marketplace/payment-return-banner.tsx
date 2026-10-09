"use client";

/**
 * PAYMENT-RETURN-BANNER — pasica ob vrnitvi s plačila na /trznica.
 *
 * Izrise se SAMO ob parametru ?placilo= v URL (kanon izvirnika):
 *  - ?placilo=uspeh&order={id} → zelena potrditev s številko naročila;
 *  - ?placilo=preklic → nevtralno sporočilo (naročilo NI opravljeno).
 *
 * Brez parametra ne zavzema prostora. Gumb za umik počisti tudi
 * parameter iz URL (čist naslov za deljenje).
 */

import { CheckCircle2, X, XCircle } from "lucide-react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { pick } from "@/lib/i18n-pick";

const L = {
  successTitle: { sl: "Hvala za nakup!", en: "Thank you for your purchase!" },
  successLead: {
    // P0 AUDIT (iskrenost): ta pasica izhaja iz URL parametra, ki ga je mogoče
    // podtakniti — NE trdimo potrjenega naročila, ker potrditev pomeni
    // preverjen webhook (podpis + znesek). Iskreno: plačilo oddano, stanje
    // se osveži po potrditvi ponudnika plačil.
    sl: "Plačilo je bilo uspešno oddano. Naročilo uradno potrdimo, ko prejmemo potrdilo plačila (običajno v nekaj trenutkih) — stanje vidiš v svojih naročilih.",
    en: "Your payment was submitted successfully. We officially confirm the order once the payment confirmation arrives (usually within moments) — see your orders for the status.",
  },
  orderNo: { sl: "Številka naročila", en: "Order number" },
  cancelledTitle: { sl: "Plačilo je bilo preklicano", en: "Payment was cancelled" },
  cancelledLead: {
    sl: "Naročilo ni bilo opravljeno in nič ni bilo zaračunano. Lahko poskusite znova kadarkoli.",
    en: "The order was not placed and nothing was charged. You can try again at any time.",
  },
  dismiss: { sl: "Zapri pasico", en: "Dismiss banner" },
} as const;

export function PaymentReturnBanner() {
  const params = useSearchParams();
  const l = useLocale();
  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  const placilo = params.get("placilo");
  const order = params.get("order");
  const [visible, setVisible] = React.useState(true);

  if (!placilo || !visible) return null;

  const dismiss = () => {
    setVisible(false);
    // Parameter počistimo tudi iz URL (zgodovina ostane čista).
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("placilo");
      url.searchParams.delete("order");
      window.history.replaceState(null, "", url.toString());
    }
  };

  if (placilo === "uspeh") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mb-6 flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4"
      >
        <CheckCircle2
          className="mt-0.5 size-6 shrink-0 text-primary"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground">{t("successTitle")}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            {t("successLead")}
          </p>
          {order && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {t("orderNo")}:
              </span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
                {order}
              </code>
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 text-muted-foreground"
          onClick={dismiss}
          aria-label={t("dismiss")}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  if (placilo === "preklic") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mb-6 flex items-start gap-3 rounded-xl border bg-card p-4"
      >
        <XCircle
          className="mt-0.5 size-6 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{t("cancelledTitle")}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            {t("cancelledLead")}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 text-muted-foreground"
          onClick={dismiss}
          aria-label={t("dismiss")}
        >
          <XCircle className="size-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return null;
}
