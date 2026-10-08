"use client";

/**
 * WATCH-ADD-BUTTON — P1-C (issue #3 §4): gumb »Spremljaj ceno« na kartici
 * izdelka tržnice.
 * ============================================================================
 * - POST /api/watch {kind:"price", targetKind:"product", targetId:slug};
 * - gost → ponudba prijave (iskreno — spremljanje je vezano na račun);
 * - 409 (že spremljaš) → prijazno sporočilo; 400 → iskreno sporočilo
 *   strežnika (npr. izdelek ni več na voljo);
 * - uspeh → potrditev s pragom padca (privzeto 10 % — obe ceni preverjeni).
 */

import { Bell, BellRing, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

const L = {
  watch: { sl: "Spremljaj ceno", en: "Watch price" },
  watching: { sl: "Ceno spremljam", en: "Watching price" },
  signIn: {
    sl: "Za spremljanje cene se prijavi.",
    en: "Sign in to watch the price.",
  },
  added: {
    sl: "Ceno spremljam — opozorim te, ko pade za vsaj 10 % (obe ceni preverjeni iz tržnice).",
    en: "Watching the price — you will be alerted when it drops by at least 10% (both prices verified from the marketplace).",
  },
  exists: { sl: "To ceno že spremljaš.", en: "You already watch this price." },
  error: {
    sl: "Dodajanje spremljanja ni uspelo.",
    en: "Could not add the watch.",
  },
} as const;

export function WatchPriceButton({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const l = useLocale();
  const { status } = useSession();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [added, setAdded] = React.useState(false);

  const label = added ? pick(l, L.watching) : pick(l, L.watch);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "price",
          targetKind: "product",
          targetId: slug,
        }),
      });
      if (res.status === 409) {
        setAdded(true);
        toast({ title: pick(l, L.exists) });
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast({ title: data.error ?? pick(l, L.error), variant: "destructive" });
        return;
      }
      setAdded(true);
      toast({ title: pick(l, L.added) });
    } catch {
      toast({ title: pick(l, L.error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (status === "unauthenticated") {
    // Gost → iskreno ponudimo prijavo (spremljanje je vezano na račun).
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={className}
        asChild
      >
        <Link href="/prijava" aria-label={`${label} — ${pick(l, L.signIn)}`}>
          <Bell className="size-4" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={className}
      onClick={() => void onClick()}
      disabled={busy || added}
      aria-pressed={added}
      aria-label={label}
      title={label}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : added ? (
        <BellRing className="size-4 text-emerald-600" aria-hidden="true" />
      ) : (
        <Bell className="size-4" aria-hidden="true" />
      )}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
