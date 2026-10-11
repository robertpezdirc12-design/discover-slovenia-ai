"use client";

import { HandCoins } from "lucide-react";
import { useLocale } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { cn } from "@/lib/utils";

/**
 * AFFILIATE ČIP „Podprta povezava" (POLIR B, FTC compliance) — majhen,
 * diskreten razkrivni čip, ki stoji ob vsakem affiliate CTA
 * (/api/affiliate/go). Objava na /zaupanje-in-varnost obljublja, da je
 * affiliate povezava „vedno jasno označeno" — ta čip uresničuje obljubo
 * tudi tam, kjer razkritje prej ni bilo vidno ob sami povezavi.
 *
 * · celotni čip je POVEZAVA na /zaupanje-in-varnost (celotno razkritje);
 * · aria-label/title pove dlje: morebitna provizija partnerja, zunanji
 *   ponudnik, načrtovanje vedno brezplačno;
 * · višina ≥24 px (min-h-6), usklajeno s shadcn Badge (variant outline).
 */

/** Besedilo čipa in daljša razlaga — 6 jezikov (kanon i18n-pick). */
const CHIP_TEXT = {
  label: {
    sl: "Podprta povezava",
    en: "Supported link",
    it: "Link sponsorizzato",
    de: "Gesponserter Link",
    fr: "Lien sponsorisé",
    es: "Enlace patrocinado",
  },
  aria: {
    sl: "Povezava podprta z morebitno provizijo — zunanji ponudnik; načrtovanje je vedno brezplačno.",
    en: "Link supported by a possible commission — external provider; planning is always free.",
    it: "Link sostenuto da una possibile commissione — fornitore esterno; la pianificazione è sempre gratuita.",
    de: "Durch eine mögliche Provision unterstützter Link — externer Anbieter; die Planung ist immer kostenlos.",
    fr: "Lien soutenu par une éventuelle commission — fournisseur externe ; la planification est toujours gratuite.",
    es: "Enlace respaldado por una posible comisión — proveedor externo; planificar es siempre gratis.",
  },
} as const;

export function AffiliateChip({ className }: { className?: string }) {
  const l = useLocale();
  return (
    <Badge
      asChild
      variant="outline"
      className={cn(
        "min-h-6 border-dashed bg-muted/40 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <Link
        href="/zaupanje-in-varnost"
        aria-label={pick(l, CHIP_TEXT.aria)}
        title={pick(l, CHIP_TEXT.aria)}
      >
        <HandCoins className="size-3" aria-hidden="true" />
        {pick(l, CHIP_TEXT.label)}
      </Link>
    </Badge>
  );
}
