"use client";

import * as React from "react";
import { useLocale } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

/**
 * LANGUAGE SWITCHER — sl | en (kanon izvirnika: preklopi ISTO pot,
 * /destinacije ↔ /en/destinacije; 308 nikoli 404).
 */
export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const label = pick(locale, {
    sl: "Izbira jezika — trenutno slovenščina",
    en: "Language selection — currently English",
  });

  const switchTo = React.useCallback(
    (next: "sl" | "en") => {
      if (next === locale) return;
      // Locale-zavedajoči router obdrži pot: /destinacije ↔ /en/destinacije.
      router.replace(pathname, { locale: next });
    },
    [locale, pathname, router]
  );

  const options = [
    { code: "sl", name: "SL", full: "Slovenščina" },
    { code: "en", name: "EN", full: "English" },
  ] as const;

  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center rounded-full border bg-background/60 p-0.5"
    >
      {options.map((opt) => {
        const active = locale === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => switchTo(opt.code)}
            aria-pressed={active}
            aria-label={opt.full}
            title={opt.full}
            className={
              "flex h-8 min-w-9 items-center justify-center rounded-full px-2 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none " +
              (active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {opt.name}
          </button>
        );
      })}
    </div>
  );
}
