"use client";

import { Check, Languages } from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { APP_LANGUAGES, localeName, pick, type PickLocale } from "@/lib/i18n-pick";
import { cn } from "@/lib/utils";

/**
 * LANGUAGE SWITCHER — 6 jezikov izvirnika (sl privzet, en/it/de/fr/es s
 * predpono). Preklopi ISTO pot (/destinacije ↔ /en/destinacije ↔ /it/…);
 * sredinska koda aktivnega jezika + domača imena v meniju.
 *
 * Kanon: locale-zavedajoči router iz @/i18n/navigation obdrži pot;
 * DropdownMenu je tipkovnico dostopen in mobili prijazen (≥44px postavke).
 *
 * POLIR9 (WCAG 1.4.3): prop `overHero` — ko glava (domov, @scroll 0)
 * sedi na zelenem heroju, tabletka preklopi na stekleno belo obliko
 * (text-primary na bg-background/60 nad herojem je padel na 3,41:1,
 * izmerjeno s piksli); sicer ostane običajna oblika na svetli podlagi.
 */
export function LanguageSwitcher({ overHero = false }: { overHero?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const label = pick(locale, {
    sl: "Izbira jezika — trenutno slovenščina",
    en: "Language selection — currently English",
    it: "Scelta della lingua — attualmente italiano",
    de: "Sprachauswahl — derzeit Deutsch",
    fr: "Choix de la langue — actuellement français",
    es: "Selección de idioma — actualmente español",
  });

  const switchTo = React.useCallback(
    (next: PickLocale) => {
      if (next === locale) return;
      // Locale-zavedajoči router obdrži pot: /destinacije ↔ /it/destinacije.
      router.replace(pathname, { locale: next });
    },
    [locale, pathname, router]
  );

  const activeShort =
    APP_LANGUAGES.find((o) => o.code === locale)?.short ?? "SL";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none " +
          (overHero
            ? // nad herojem: bela steklena tabletka (≥ 4,5:1 v obeh temah)
              "border-white/40 bg-white/10 text-white hover:bg-white/20"
            : "border-border/70 bg-background/60 hover:bg-accent " +
              (locale === "sl" ? "text-primary" : "text-foreground"))
        }
      >
        <Languages className="size-4" aria-hidden="true" />
        <span aria-hidden="true">{activeShort}</span>
        <span className="sr-only">{localeName(locale)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-2xl border-border/70 p-1.5 shadow-xl">
        <DropdownMenuLabel className="rounded-lg px-2.5 py-2 text-muted-foreground">
          {pick(locale, {
            sl: "Jezik",
            en: "Language",
            it: "Lingua",
            de: "Sprache",
            fr: "Langue",
            es: "Idioma",
          })}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {APP_LANGUAGES.map((opt) => {
          const active = locale === opt.code;
          return (
            <DropdownMenuItem
              key={opt.code}
              onSelect={() => switchTo(opt.code)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-sm transition-colors",
                active && "font-semibold text-primary"
              )}
            >
              <span>{opt.native}</span>
              {active ? (
                <Check className="size-4 text-primary" aria-hidden="true" />
              ) : (
                <span
                  aria-hidden="true"
                  className="text-[10px] font-bold tracking-wide text-muted-foreground"
                >
                  {opt.short}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
