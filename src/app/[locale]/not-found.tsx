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
    code: { sl: "404", en: "404", it: "404", de: "404", fr: "404", es: "404" },
    title: { sl: "Te strani (še) ni na zemljevidu", en: "This page is not on the map yet", it: "Questa pagina non è ancora sulla mappa", de: "Diese Seite ist (noch) nicht auf der Karte", fr: "Cette page n’est pas encore sur la carte", es: "Esta página aún no está en el mapa" },
    lead: {
      sl: "Pot, ki si jo odprl, ne obstaja. Preveri naslov ali nadaljuj z raziskovanjem Slovenije.",
      en: "The path you opened doesn't exist. Check the address or continue exploring Slovenia.",
      it: "Il percorso che hai aperto non esiste. Controlla l'indirizzo o continua a esplorare la Slovenia.",
      de: "Der von dir geöffnete Pfad existiert nicht. Prüfe die Adresse oder entdecke Slowenien weiter.",
      fr: "Le chemin que tu as ouvert n’existe pas. Vérifie l’adresse ou continue d’explorer la Slovénie.",
      es: "La ruta que abriste no existe. Comprueba la dirección o sigue explorando Eslovenia.",
    },
    home: { sl: "Nazaj na domov", en: "Back to home", it: "Torna alla home", de: "Zurück zur Startseite", fr: "Retour à l’accueil", es: "Volver al inicio" },
    destinations: { sl: "Odkrij destinacije", en: "Discover destinations", it: "Scopri le destinazioni", de: "Destinationen entdecken", fr: "Découvrir les destinations", es: "Descubre los destinos" },
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
