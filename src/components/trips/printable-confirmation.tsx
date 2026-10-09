"use client";

import { Loader2, Printer, ShieldCheck } from "lucide-react";
import { useLocale } from "next-intl";
import React from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { asPickLocale, pick } from "@/lib/i18n-pick";
import { intlDateLocale } from "@/lib/intl-locale";
import {
  parseAttestationNote,
  statusLabel,
} from "@/lib/journey/booking";
import { reservationChannelOf } from "@/lib/journey/booking-provider";
import { type SharedPlan } from "@/lib/shared-plan";
import {
  eachTripDay,
  formatDateLong,
  weekdayLong,
  type TripDates,
} from "@/lib/trip-dates";

/**
 * PRINTABLE-CONFIRMATION — natisljivo potrdilo poti z rezervacijami
 * (P0-E, issue #1 §10 „printable confirmation document").
 *
 * Kanoni:
 *  - dokument je SESTAVLJEN IZKLJUČNO iz strežniške resnice (GET pot +
 *    GET rezervacije) — nič iz lokalnega stanja brskalnika;
 *  - ISKRENOST: vsak zapis razkrije kanal (demo/partner/uporabnik) in
 *    atestacijo (številka + cena iz potrdila) — nikoli ne trdimo
 *    „potrjeno prek naše integracije" za uporabnikove vnose;
 *  - tehnično: dokument se izriše prek portala na <body> SAMO ob tisku
 *    (pravilo @media print skrije vse ostale otroke body); po tisku se
 *    portal odstrani.
 */

const L = {
  trigger: { sl: "Natisni potrdilo", en: "Print confirmation", it: "Stampa la conferma", de: "Bestätigung drucken", fr: "Imprimer la confirmation", es: "Imprimir la confirmación" },
  title: { sl: "Potrdilo poti in rezervacij", en: "Trip & reservations confirmation", it: "Conferma di viaggio e prenotazioni", de: "Bestätigung von Reise und Reservierungen", fr: "Confirmation de voyage et réservations", es: "Confirmación de viaje y reservas" },
  trip: { sl: "Pot", en: "Trip", it: "Viaggio", de: "Reise", fr: "Voyage", es: "Viaje" },
  dayWord: { sl: "Dan", en: "Day", it: "Giorno", de: "Tag", fr: "Jour", es: "Día" },
  dates: { sl: "Datumi poti", en: "Trip dates", it: "Date del viaggio", de: "Reisedaten", fr: "Dates du voyage", es: "Fechas del viaje" },
  noDates: { sl: "datumi niso določeni", en: "dates not set", it: "date non impostate", de: "Daten nicht festgelegt", fr: "dates non définies", es: "fechas sin definir" },
  day: {
    sl: (n: number) => `Dan ${n}`,
    en: (n: number) => `Day ${n}`,
    it: (n: number) => `Giorno ${n}`,
    de: (n: number) => `Tag ${n}`,
    fr: (n: number) => `Jour ${n}`,
    es: (n: number) => `Día ${n}`,
  },
  stops: { sl: "Postanki", en: "Stops", it: "Tappe", de: "Stopps", fr: "Étapes", es: "Paradas" },
  reservations: { sl: "Rezervacije", en: "Reservations", it: "Prenotazioni", de: "Reservierungen", fr: "Réservations", es: "Reservas" },
  noReservations: {
    sl: "Na tej poti še ni rezervacij — potrdilo vsebuje samo načrt poti.",
    en: "No reservations on this trip yet — the confirmation contains only the itinerary.",
    it: "Ancora nessuna prenotazione su questo viaggio — la conferma contiene solo l'itinerario.",
    de: "Noch keine Reservierungen auf dieser Reise — die Bestätigung enthält nur die Reiseroute.",
    fr: "Pas encore de réservations sur ce voyage — la confirmation ne contient que l'itinéraire.",
    es: "Aún no hay reservas en este viaje — la confirmación contiene solo el itinerario.",
  },
  channel: { sl: "kanal", en: "channel", it: "canale", de: "Kanal", fr: "canal", es: "canal" },
  channelUser: { sl: "uporabniški vnos", en: "user entry", it: "inserimento utente", de: "Benutzereintrag", fr: "saisie utilisateur", es: "entrada de usuario" },
  channelImported: { sl: "uvoženo iz potrdila", en: "imported from confirmation", it: "importato dalla conferma", de: "aus der Bestätigung importiert", fr: "importé de la confirmation", es: "importado de la confirmación" },
  channelPartner: { sl: "partner", en: "partner", it: "partner", de: "Partner", fr: "partenaire", es: "socio" },
  channelDemo: { sl: "demo simulator", en: "demo simulator", it: "simulatore demo", de: "Demo-Simulator", fr: "simulateur démo", es: "simulador demo" },
  channelNone: { sl: "ročni vnos", en: "manual entry", it: "inserimento manuale", de: "manueller Eintrag", fr: "saisie manuelle", es: "entrada manual" },
  attestation: { sl: "Atestacija", en: "Attestation", it: "Attestazione", de: "Attestierung", fr: "Attestation", es: "Atestación" },
  honesty: {
    sl: "Iskrenost: zapisi z izvorom „uporabniški vnos/uvoženo“ so atestacije lastnika poti (številka in cena iz potrdila ponudnika) — potrditev ponudnika živi pri ponudniku. Demo zapisi so eksplicitno označeni in niso prave rezervacije.",
    en: "Honesty: entries sourced as \"user entry/imported\" are the trip owner's attestations (reference and price from the provider's confirmation) — the provider's confirmation lives with the provider. Demo entries are explicitly marked and are not real bookings.",
    it: "Onestà: le voci provenienti da \"inserimento utente/importato\" sono attestazioni del proprietario del viaggio (numero e prezzo dalla conferma del fornitore) — la conferma del fornitore resta presso il fornitore. Le voci demo sono contrassegnate esplicitamente e non sono prenotazioni reali.",
    de: "Ehrlichkeit: Einträge mit der Quelle \"Benutzereintrag/importiert\" sind Attestierungen des Reiseeigentümers (Referenz und Preis aus der Bestätigung des Anbieters) — die Bestätigung des Anbieters bleibt beim Anbieter. Demo-Einträge sind ausdrücklich gekennzeichnet und keine echten Buchungen.",
    fr: "Honnêteté : les entrées dont la source est \"saisie utilisateur/importé\" sont des attestations du propriétaire du voyage (référence et prix issus de la confirmation du prestataire) — la confirmation du prestataire reste chez le prestataire. Les entrées démo sont explicitement signalées et ne sont pas de vraies réservations.",
    es: "Honestidad: las entradas con origen \"entrada de usuario/importado\" son atestaciones del propietario del viaje (número y precio de la confirmación del proveedor) — la confirmación del proveedor vive en el proveedor. Las entradas demo están marcadas explícitamente y no son reservas reales.",
  },
  generated: { sl: "Dokument izdan", en: "Document issued", it: "Documento emesso", de: "Dokument ausgestellt", fr: "Document émis", es: "Documento emitido" },
  source: { sl: "Vir: Discover Slovenia AI", en: "Source: Discover Slovenia AI", it: "Fonte: Discover Slovenia AI", de: "Quelle: Discover Slovenia AI", fr: "Source : Discover Slovenia AI", es: "Fuente: Discover Slovenia AI" },
  errGeneric: { sl: "Priprava dokumenta ni uspela.", en: "Preparing the document failed.", it: "Preparazione del documento non riuscita.", de: "Das Dokument konnte nicht vorbereitet werden.", fr: "La préparation du document a échoué.", es: "La preparación del documento falló." },
} as const;

interface ReservationRowDto {
  id: string;
  dayIndex: number;
  stopName: string;
  status: string;
  note: string | null;
}

export function PrintableConfirmation({
  shareId,
  tripName,
  tripDates,
  plan,
}: {
  shareId: string;
  tripName: string;
  tripDates: TripDates | null;
  plan: SharedPlan | null;
}) {
  const l = useLocale();
  const lang: "sl" | "en" | "it" | "de" | "fr" | "es" = asPickLocale(l);
  const [state, setState] = React.useState<"idle" | "preparing" | "ready">("idle");
  const [doc, setDoc] = React.useState<{
    reservations: ReservationRowDto[];
    generatedAt: string;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const prepare = async () => {
    setError(null);
    setState("preparing");
    try {
      const r = await fetch(
        `/api/trips/${encodeURIComponent(shareId)}/reservations`,
        { cache: "no-store" }
      );
      if (!r.ok) throw new Error("fetch");
      const data = (await r.json()) as { reservations?: ReservationRowDto[] };
      setDoc({
        reservations: data.reservations ?? [],
        generatedAt: new Date().toISOString(),
      });
      setState("ready");
      // Pusti brskalniku en tikelj za izris portala, nato odpri tisk.
      window.setTimeout(() => {
        window.print();
      }, 120);
    } catch {
      setError(pick(l, L.errGeneric));
      setState("idle");
    }
  };

  const channelLabel = (channel: string | null): string => {
    switch (channel) {
      case "demo":
        return pick(l, L.channelDemo);
      case "partner":
        return pick(l, L.channelPartner);
      case "user":
        return pick(l, L.channelUser);
      case "imported":
        return pick(l, L.channelImported);
      default:
        return pick(l, L.channelNone);
    }
  };

  return (
    <>
      <Button
        onClick={() => void prepare()}
        variant="outline"
        className="tap-target h-11 font-semibold print:hidden"
        disabled={state === "preparing"}
      >
        {state === "preparing" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Printer className="size-4" aria-hidden="true" />
        )}
        {pick(l, L.trigger)}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive print:hidden">
          {error}
        </p>
      )}

      {state === "ready" && doc && (
        <PrintPortal>
          <style>{`@media print { body > *:not([data-print-doc]) { display: none !important; } }`}</style>
          <div data-print-doc className="mx-auto max-w-2xl p-6 text-black">
            <h1 className="text-xl font-bold">{pick(l, L.title)}</h1>
            <p className="mt-1 text-sm">
              <strong>{pick(l, L.trip)}:</strong> {tripName}
            </p>
            <p className="text-sm">
              <strong>{pick(l, L.dates)}:</strong>{" "}
              {tripDates
                ? `${formatDateLong(tripDates.start, lang)} — ${formatDateLong(tripDates.end, lang)}`
                : pick(l, L.noDates)}
            </p>

            {plan?.days?.length ? (
              <section className="mt-4">
                <h2 className="text-sm font-bold uppercase tracking-wide">
                  {pick(l, L.stops)}
                </h2>
                {(tripDates ? eachTripDay(tripDates) : null)?.map((d) => {
                  const locations = plan.days[d.dayIndex - 1]?.locations ?? [];
                  return (
                    <div key={d.dayIndex} className="mt-2">
                      <p className="text-sm font-semibold">
                        {pick(l, L.day)(d.dayIndex)} · {weekdayLong(d.iso, lang)}, {formatDateLong(d.iso, lang)}
                      </p>
                      {locations.length > 0 ? (
                        <ul className="ml-4 list-disc text-xs">
                          {locations.map((loc, i) => (
                            <li key={i}>
                              {loc.name}
                              {loc.time ? ` (${loc.time})` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="ml-4 text-xs">—</p>
                      )}
                    </div>
                  );
                }) ??
                  plan.days.map((day, i) => (
                    <div key={i} className="mt-2">
                      <p className="text-sm font-semibold">{pick(l, L.day)(day.day)}</p>
                      <ul className="ml-4 list-disc text-xs">
                        {day.locations.map((loc, j) => (
                          <li key={j}>
                            {loc.name}
                            {loc.time ? ` (${loc.time})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </section>
            ) : null}

            <section className="mt-4">
              <h2 className="text-sm font-bold uppercase tracking-wide">
                {pick(l, L.reservations)}
              </h2>
              {doc.reservations.length === 0 ? (
                <p className="mt-1 text-xs">{pick(l, L.noReservations)}</p>
              ) : (
                <table className="mt-2 w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black/30 text-left">
                      <th className="py-1 pr-2 font-semibold">{pick(l, L.dayWord)}</th>
                      <th className="py-1 pr-2 font-semibold">{pick(l, L.stops)}</th>
                      <th className="py-1 pr-2 font-semibold">{pick(l, L.reservations)}</th>
                      <th className="py-1 font-semibold">{pick(l, L.channel)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.reservations.map((r) => {
                      const channel = reservationChannelOf(r.note);
                      const att = parseAttestationNote(r.note);
                      return (
                        <tr key={r.id} className="border-b border-black/10 align-top">
                          <td className="py-1 pr-2">{r.dayIndex}</td>
                          <td className="py-1 pr-2">{r.stopName}</td>
                          <td className="py-1 pr-2">
                            {statusLabel(r.status, lang)}
                            {att ? (
                              <span className="block">
                                {pick(l, L.attestation)}: {att.providerBookingId} ·{" "}
                                {att.confirmedPrice.toFixed(2)} €
                              </span>
                            ) : null}
                          </td>
                          <td className="py-1">{channelLabel(channel)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>

            <p className="mt-4 flex items-start gap-2 border-t border-black/20 pt-3 text-[11px] leading-relaxed">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {pick(l, L.honesty)}
            </p>
            <p className="mt-2 text-[11px]">
              {pick(l, L.generated)}: {new Date(doc.generatedAt).toLocaleString(intlDateLocale(l))}{" "}
              · {pick(l, L.source)}
            </p>
          </div>
        </PrintPortal>
      )}
    </>
  );
}

/** Portal na <body> — dokument je NEODVISEN od aplikacijske lupine. */
function PrintPortal({ children }: { children: React.ReactNode }) {
  const [container] = React.useState(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.setAttribute("data-print-doc-root", "");
    el.style.display = "contents";
    return el;
  });

  React.useEffect(() => {
    if (!container) return;
    document.body.appendChild(container);
    return () => {
      container.remove();
    };
  }, [container]);

  if (!container) return null;
  return createPortal(
    <div className="hidden print:block">{children}</div>,
    container
  );
}
