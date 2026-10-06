"use client";

import { Compass } from "lucide-react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

/** 404 znotraj locale veje (npr. /neznana-pot oz. /en/unknown) — dvojezično. */
export default function LocaleNotFound() {
  const l = useLocale();
  const L = {
    code: { sl: "404", en: "404" },
    title: { sl: "Te strani (še) ni na zemljevidu", en: "This page is not on the map yet" },
    lead: {
      sl: "Pot, ki si jo odprl, ne obstaja — ali pa je še nismo rekonstruirali. Vrni se na raziskovanje Slovenije.",
      en: "The path you opened doesn't exist — or we haven't reconstructed it yet. Return to exploring Slovenia.",
    },
    home: { sl: "Nazaj na domov", en: "Back to home" },
    destinations: { sl: "Odkrij destinacije", en: "Discover destinations" },
  } as const;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass className="size-7" aria-hidden="true" />
      </span>
      <p className="mt-6 font-mono text-sm font-bold text-primary">{pick(l, L.code)}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        {pick(l, L.title)}
      </h1>
      <p className="mt-3 max-w-lg text-muted-foreground">{pick(l, L.lead)}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="tap-target">
          <Link href="/">{pick(l, L.home)}</Link>
        </Button>
        <Button asChild variant="outline" className="tap-target">
          <Link href="/destinacije">{pick(l, L.destinations)}</Link>
        </Button>
      </div>
    </div>
  );
}
