"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { pick } from "@/lib/i18n-pick";
import { useLocale } from "next-intl";

/** Preklop svetla/temna tema (ikona + aria-label po locale). */
export function ThemeToggle() {
  const l = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const label = pick(l, {
    sl: "Preklopi temo (svetla/temna)",
    en: "Toggle theme (light/dark)",
  });

  return (
    <Button
      variant="ghost"
      size="icon"
      className="tap-target rounded-full"
      aria-label={label}
      title={label}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Mounted varovalka: strežnik ne pozna teme (hydration mismatch). */}
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="size-5" aria-hidden="true" />
      ) : (
        <Moon className="size-5" aria-hidden="true" />
      )}
    </Button>
  );
}
