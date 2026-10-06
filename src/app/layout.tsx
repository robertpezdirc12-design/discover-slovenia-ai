import type { ReactNode } from "react";

/**
 * KORENSKA POSTAVITEV — minimalen prehod (kanon next-intl z [locale] segmentom).
 *
 * Oznaki <html> in <body> nosi [locale]/layout.tsx, ker sta odvisni od
 * aktivnega jezika (lang, dir). Ta datoteka NE sme izrisovati oznak —
 * podvojena <html> bi povzročila hydration napake.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
