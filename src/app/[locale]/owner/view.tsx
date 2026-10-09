"use client";

import { ArrowRight, Banknote, Building2, HardDrive, LineChart, Percent, ShieldCheck, Users } from "lucide-react";
import { useLocale } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

/**
 * /owner — vstop v portal za lastnike lokalov (produkcija: /owner/prijava).
 * Povezuje prijavo portala in stran za ponudnike + iskreno stanje.
 */
export default function OwnerPage() {
  const l = useLocale();

  const L = {
    kicker: { sl: "Za lastnike lokalov", en: "For venue owners", it: "Per i proprietari di locali", de: "Für Lokalbesitzer", fr: "Pour les propriétaires d'établissements", es: "Para propietarios de locales" },
    title: { sl: "Portal za lastnike lokalov", en: "Venue owner portal", it: "Portale per i proprietari di locali", de: "Portal für Lokalbesitzer", fr: "Portail des propriétaires d'établissements", es: "Portal para propietarios de locales" },
    lead: {
      sl: "Upravljajte svoje lokale, spremljajte statistiko in bodite vidni obiskovalcem, ki načrtujejo potovanje z AI.",
      en: "Manage your venues, track statistics and be visible to travellers who plan their trips with AI.",
      it: "Gestisci i tuoi locali, monitora le statistiche e sii visibile ai viaggiatori che pianificano il loro viaggio con l'AI.",
      de: "Verwalte deine Lokale, verfolge Statistiken und sei für Reisende sichtbar, die ihre Reisen mit KI planen.",
      fr: "Gère tes établissements, suis les statistiques et sois visible auprès des voyageurs qui planifient leur voyage avec l'IA.",
      es: "Gestiona tus locales, sigue las estadísticas y sé visible para los viajeros que planifican su viaje con IA.",
    },
    login: { sl: "Prijava v portal", en: "Sign in to the portal", it: "Accedi al portale", de: "Im Portal anmelden", fr: "Connexion au portail", es: "Iniciar sesión en el portal" },
    register: { sl: "Registracija", en: "Register", it: "Registrati", de: "Registrieren", fr: "S'inscrire", es: "Registrarse" },
    featuresTitle: { sl: "Kaj portal omogoča", en: "What the portal enables", it: "Cosa consente il portale", de: "Was das Portal ermöglicht", fr: "Ce que le portail permet", es: "Qué permite el portal" },
    features: {
      sl: [
        { h: "Upravljanje lokalov", b: "Urejajte podatke, odpiralne čase in ponudbo svojih lokalov." },
        { h: "Statistika obiskov", b: "Spremljajte, kako vaš lokal nastopa v načrtih in raziskovanju." },
        { h: "Vidnost v načrtih", b: "Bodite vidni obiskovalcem, ki z AI načrtujejo potovanja po Sloveniji." },
      ],
      en: [
        { h: "Venue management", b: "Edit the details, opening hours and offer of your venues." },
        { h: "Visit statistics", b: "Track how your venue performs in plans and exploration." },
        { h: "Visibility in plans", b: "Be visible to travellers planning trips around Slovenia with AI." },
      ],
      it: [
        { h: "Gestione dei locali", b: "Modifica i dati, gli orari di apertura e l'offerta dei tuoi locali." },
        { h: "Statistiche delle visite", b: "Monitora come si comporta il tuo locale nei piani e nell'esplorazione." },
        { h: "Visibilità nei piani", b: "Sii visibile ai viaggiatori che pianificano viaggi in Slovenia con l'AI." },
      ],
      de: [
        { h: "Lokalverwaltung", b: "Bearbeite Daten, Öffnungszeiten und Angebot deiner Lokale." },
        { h: "Besuchsstatistiken", b: "Verfolge, wie dein Lokal in Plänen und bei der Erkundung abschneidet." },
        { h: "Sichtbarkeit in Plänen", b: "Sei sichtbar für Reisende, die mit KI Reisen durch Slowenien planen." },
      ],
      fr: [
        { h: "Gestion des établissements", b: "Modifie les informations, les horaires d'ouverture et l'offre de tes établissements." },
        { h: "Statistiques de visites", b: "Suis les performances de ton établissement dans les plans et l'exploration." },
        { h: "Visibilité dans les plans", b: "Sois visible auprès des voyageurs qui planifient des voyages en Slovénie avec l'IA." },
      ],
      es: [
        { h: "Gestión de locales", b: "Edita los datos, los horarios de apertura y la oferta de tus locales." },
        { h: "Estadísticas de visitas", b: "Sigue el rendimiento de tu local en los planes y la exploración." },
        { h: "Visibilidad en los planes", b: "Sé visible para los viajeros que planifican viajes por Eslovenia con IA." },
      ],
    },
    partnersTitle: { sl: "Za ponudnike", en: "For providers", it: "Per i fornitori", de: "Für Anbieter", fr: "Pour les prestataires", es: "Para proveedores" },
    partnersBody: {
      sl: "Portal je del ponudniške plasti platforme — vse o partnerstvu, paketih in prijavnici najdeš na strani za ponudnike.",
      en: "The portal is part of the platform's provider layer — everything about partnership, packages and the application form is on the providers page.",
      it: "Il portale fa parte dello strato fornitori della piattaforma — tutto su partnership, pacchetti e modulo di candidatura si trova nella pagina per i fornitori.",
      de: "Das Portal ist Teil der Anbieter-Ebene der Plattform — alles zu Partnerschaft, Paketen und dem Bewerbungsformular findest du auf der Anbieter-Seite.",
      fr: "Le portail fait partie de la couche prestataires de la plateforme — tout sur le partenariat, les offres et le formulaire de candidature se trouve sur la page des prestataires.",
      es: "El portal forma parte de la capa de proveedores de la plataforma — todo sobre la asociación, los paquetes y el formulario de solicitud está en la página para proveedores.",
    },
    partnersCta: { sl: "Stran za ponudnike", en: "Providers page", it: "Pagina per i fornitori", de: "Anbieter-Seite", fr: "Page des prestataires", es: "Página para proveedores" },
    provTitle: { sl: "Provizije in klikanja", en: "Commissions and clicks", it: "Provvigioni e clic", de: "Provisionen und Klicks", fr: "Commissions et clics", es: "Comisiones y clics" },
    provBody: {
      sl: "Nadzorna plošča za skrbnike: statistika klikanja na partnerske povezave in provizijski dnevnik iz poročil partnerjev (dostop omejen na DSA_ADMIN_EMAILS).",
      en: "Admin dashboard: click statistics for partner links and the commission journal from partner reports (access limited to DSA_ADMIN_EMAILS).",
      it: "Dashboard per amministratori: statistiche dei clic sui link partner e registro delle provvigioni dai report dei partner (accesso limitato a DSA_ADMIN_EMAILS).",
      de: "Admin-Dashboard: Klickstatistiken für Partner-Links und das Provisionsjournal aus Partnerberichten (Zugriff auf DSA_ADMIN_EMAILS beschränkt).",
      fr: "Tableau de bord admin : statistiques de clics sur les liens partenaires et journal des commissions issu des rapports des partenaires (accès limité à DSA_ADMIN_EMAILS).",
      es: "Panel para administradores: estadísticas de clics en los enlaces de socios y diario de comisiones de los informes de socios (acceso limitado a DSA_ADMIN_EMAILS).",
    },
    provCta: { sl: "Odpri ploščo", en: "Open the dashboard", it: "Apri la dashboard", de: "Dashboard öffnen", fr: "Ouvrir le tableau de bord", es: "Abrir el panel" },
    payoutTitle: { sl: "Izplačila lastne tržnice", en: "Own marketplace payouts", it: "Pagamenti del marketplace interno", de: "Auszahlungen des eigenen Marktplatzes", fr: "Paiements de la marketplace interne", es: "Pagos del marketplace interno" },
    payoutBody: {
      sl: "Življenjski cikel izplačil naročil (še ne zapadlo → zapadlo → v teku → izplačano), zahtevki kupca po preklicu in revizijski dnevnik.",
      en: "Order payout lifecycle (not yet due → due → processing → paid), customer cancellation requests and the audit log.",
      it: "Ciclo di vita dei pagamenti degli ordini (non ancora dovuto → dovuto → in elaborazione → pagato), richieste di annullamento dei clienti e registro di controllo.",
      de: "Zahlungslebenszyklus von Bestellungen (noch nicht fällig → fällig → in Bearbeitung → ausgezahlt), Stornierungsanfragen der Kunden und Prüfprotokoll.",
      fr: "Cycle de vie des paiements de commandes (non encore dû → dû → en cours → payé), demandes d'annulation des clients et journal d'audit.",
      es: "Ciclo de vida de los pagos de pedidos (aún no vencido → vencido → en proceso → pagado), solicitudes de cancelación de los clientes y registro de auditoría.",
    },
    adminTitle: { sl: "Skrbniški portal (P0-H)", en: "Admin portal (P0-H)", it: "Portale di amministrazione (P0-H)", de: "Admin-Portal (P0-H)", fr: "Portail d'administration (P0-H)", es: "Portal de administración (P0-H)" },
    adminBody: {
      sl: "Prijave partnerjev (odobritev vloge partner), moderacija vnosov tržnice (osnutek → predaja → objava/zavrnitev z razlogom) in konzultacije „Vprašaj lokalca“ z ročnimi dopolnitvami — vse v revizijskem dnevniku.",
      en: "Partner applications (partner role approval), marketplace listing moderation (draft → review → publish/reject with reason) and “Ask a local” consultations with manual enrichment — all in the audit log.",
      it: "Candidature dei partner (approvazione del ruolo di partner), moderazione degli annunci del marketplace (bozza → revisione → pubblicazione/rifiuto con motivazione) e consultazioni “Chiedi a un locale” con arricchimenti manuali — tutto nel registro di controllo.",
      de: "Partnerbewerbungen (Freigabe der Partnerrolle), Moderation der Marktplatz-Einträge (Entwurf → Prüfung → Veröffentlichen/Ablehnen mit Begründung) und „Frag einen Einheimischen“-Beratungen mit manuellen Ergänzungen — alles im Prüfprotokoll.",
      fr: "Candidatures de partenaires (approbation du rôle de partenaire), modération des annonces de la marketplace (brouillon → revue → publication/rejet avec motif) et consultations « Demande à un local » avec enrichissement manuel — le tout dans le journal d’audit.",
      es: "Solicitudes de socios (aprobación del rol de socio), moderación de anuncios del marketplace (borrador → revisión → publicación/rechazo con motivo) y consultas «Pregunta a un local» con enriquecimiento manual — todo en el registro de auditoría.",
    },
    adminCta: { sl: "Odpri skrbniški portal", en: "Open the admin portal", it: "Apri il portale di amministrazione", de: "Admin-Portal öffnen", fr: "Ouvrir le portail d'administration", es: "Abrir el portal de administración" },
    statusTitle: { sl: "Stanje v tej rekonstrukciji", en: "Status in this reconstruction", it: "Stato in questa ricostruzione", de: "Status in dieser Rekonstruktion", fr: "Statut dans cette reconstruction", es: "Estado en esta reconstrucción" },
    statusBody: {
      sl: "Prijava v portal (e-pošta + geslo) je v produkciji ločena stran; njeno podlogo smo rekonstruirali 1:1, a brez pravega avtentikacijskega strežnika v sandboxu — obrazec je prikaz, povezave in vsebine pa so resnične.",
      en: "The portal sign-in (email + password) is a separate page in production; we reconstructed its shell 1:1, but without a real authentication server in the sandbox — the form is a display, while links and content are real.",
      it: "L'accesso al portale (e-mail + password) in produzione è una pagina separata; ne abbiamo ricostruito la struttura 1:1, ma senza un vero server di autenticazione nella sandbox — il modulo è espositivo, mentre link e contenuti sono reali.",
      de: "Die Portal-Anmeldung (E-Mail + Passwort) ist in der Produktion eine eigene Seite; ihre Hülle haben wir 1:1 rekonstruiert, aber ohne echten Authentifizierungsserver in der Sandbox — das Formular ist eine Darstellung, Links und Inhalte sind echt.",
      fr: "La connexion au portail (e-mail + mot de passe) est une page distincte en production ; nous en avons reconstruit l'ossature à l'identique, mais sans serveur d'authentification réel dans la sandbox — le formulaire est une maquette, tandis que les liens et contenus sont réels.",
      es: "El inicio de sesión del portal (correo electrónico + contraseña) es una página aparte en producción; reconstruimos su estructura 1:1, pero sin un servidor de autenticación real en la sandbox — el formulario es una demostración, mientras que los enlaces y contenidos son reales.",
    },
  } as const;

  const featureIcons = [Building2, LineChart, Users];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)} />

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild className="tap-target font-semibold">
          <Link href="/owner/prijava">
            {pick(l, L.login)}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="tap-target font-semibold">
          <Link href="/owner/prijava">{pick(l, L.register)}</Link>
        </Button>
      </div>

      <section aria-labelledby="owner-features" className="mt-12">
        <h2 id="owner-features" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.featuresTitle)}
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {pick(l, L.features).map((f, i) => {
            const Icon = featureIcons[i] ?? Building2;
            return (
              <Card key={f.h}>
                <CardContent className="p-5">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-3 text-sm font-bold sm:text-base">{f.h}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.b}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Card className="mt-12 border-primary/25 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-primary">
            {pick(l, L.partnersTitle)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <p>{pick(l, L.partnersBody)}</p>
          <Button asChild variant="outline" size="sm" className="mt-4 font-semibold">
            <Link href="/za-ponudnike">
              {pick(l, L.partnersCta)}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Skrbniška nadzorna plošča: provizije in klikanja (2.5.0) */}
      <Card className="mt-6">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Percent className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{pick(l, L.provTitle)}</p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {pick(l, L.provBody)}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 font-semibold">
            <Link href="/owner/provizije">
              {pick(l, L.provCta)}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="flex items-start gap-3 p-5">
          <Banknote className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{pick(l, L.payoutTitle)}</p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {pick(l, L.payoutBody)}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 font-semibold">
            <Link href="/owner/izplacila">
              {pick(l, L.provCta)}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="flex items-start gap-3 p-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{pick(l, L.adminTitle)}</p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {pick(l, L.adminBody)}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4 font-semibold">
              <Link href="/admin">
                {pick(l, L.adminCta)}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="flex items-start gap-3 p-5">
          <HardDrive className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{pick(l, L.statusTitle)}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {pick(l, L.statusBody)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
