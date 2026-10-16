"use client";

import { useLocale } from "next-intl";

import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/hooks/use-toast";
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

const ADDED = {
  sl: "Dodano v mojo pot",
  en: "Added to my trip",
  it: "Aggiunto al mio viaggio",
  de: "Zu meiner Reise hinzugefügt",
  fr: "Ajouté à mon voyage",
  es: "Añadido a mi viaje",
} as const;

const LOCAL_STORAGE_NOTE = {
  sl: "Shranjeno samo v tem brskalniku; ni povezano z računom.",
  en: "Saved in this browser only; not linked to an account.",
  it: "Salvato solo in questo browser; non collegato a un account.",
  de: "Nur in diesem Browser gespeichert; nicht mit einem Konto verknüpft.",
  fr: "Enregistré uniquement dans ce navigateur ; non lié à un compte.",
  es: "Guardado solo en este navegador; no está vinculado a una cuenta.",
} as const;

/** Emit the same localized success confirmation from every add-to-trip surface. */
export function notifyMyTripAdded(locale: string): void {
  toast({ title: pick(locale, ADDED), description: pick(locale, LOCAL_STORAGE_NOTE), action: <MyTripToastAction /> });
}
