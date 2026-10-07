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
 */
export function LanguageSwitcher() {
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
          "inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 text-xs font-bold tracking-wide transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none " +
          (locale === "sl" ? "text-primary" : "text-foreground")
        }
      >
        <Languages className="size-4" aria-hidden="true" />
        <span aria-hidden="true">{activeShort}</span>
        <span className="sr-only">{localeName(locale)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-muted-foreground">
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
                "flex min-h-11 items-center justify-between gap-2 text-sm",
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
