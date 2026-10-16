"use client";

import { useLocale } from "next-intl";

import { ToastAction } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

const LABEL = {
  sl: "Odpri mojo pot",
  en: "Open my trip",
  it: "Apri il mio viaggio",
  de: "Meine Reise öffnen",
  fr: "Ouvrir mon voyage",
  es: "Abrir mi viaje",
} as const;

/** A single localized next step after any successful add-to-trip action. */
export function MyTripToastAction() {
  const locale = useLocale();
  const label = pick(locale, LABEL);

  return (
    <ToastAction altText={label} asChild>
      <Link href="/moja-potovanja">{label}</Link>
    </ToastAction>
  );
}
