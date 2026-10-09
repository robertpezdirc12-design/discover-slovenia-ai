"use client";

import { Check, Loader2, LogIn, Send, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

/**
 * /za-ponudnike — 1:1 po produkciji (kako deluje, paketi, beta ugodnosti)
 * + DEJANSKA prijavnica partnerja (P0-H §22): prijavljeni uporabnik pošlje
 * prijavo → Lead (status "new") → skrbniška odločitev na /admin (approve →
 * vloga "partner"). Partner NIKOLI ne objavi sam — vsak vnos gre skozi
 * moderacijo (draft → pending → published).
 */
export default function ForProvidersPage() {
  const l = useLocale();

  const L = {
    kicker: { sl: "Brezplačno v beta fazi", en: "Free during beta", it: "Gratis in fase beta", de: "Kostenlos in der Beta-Phase", fr: "Gratuit pendant la bêta", es: "Gratis en fase beta" },
    title: { sl: "Za ponudnike", en: "For providers", it: "Per i fornitori", de: "Für Anbieter", fr: "Pour les prestataires", es: "Para proveedores" },
    lead: {
      sl: "Ko turist vpraša AI, najde vas. Discover Slovenia AI je med prvimi AI-poganjanimi turističnimi platformami za Slovenijo — turist napiše, kaj želi, AI sestavi dan in priporoči vaš lokal. Rezervacijo opravi turist direktno pri vas.",
      en: "When a traveller asks the AI, it finds you. Discover Slovenia AI is among the first AI-powered tourism platforms for Slovenia — the traveller writes what they want, the AI builds the day and recommends your venue. The booking is made directly with you.",
      it: "Quando un turista chiede all'AI, ti trova. Discover Slovenia AI è tra le prime piattaforme turistiche basate sull'AI per la Slovenia — il turista scrive cosa desidera, l'AI costruisce la giornata e consiglia il tuo locale. La prenotazione avviene direttamente con te.",
      de: "Wenn ein Reisender die KI fragt, findet sie dich. Discover Slovenia AI gehört zu den ersten KI-gestützten Tourismusplattformen für Slowenien — der Reisende schreibt, was er möchte, die KI baut den Tag und empfiehlt dein Lokal. Gebucht wird direkt bei dir.",
      fr: "Quand un voyageur interroge l'IA, elle te trouve. Discover Slovenia AI est parmi les premières plateformes touristiques propulsées par l'IA pour la Slovénie — le voyageur écrit ce qu'il veut, l'IA construit la journée et recommande ton établissement. La réservation se fait directement avec toi.",
      es: "Cuando un viajero pregunta a la IA, te encuentra. Discover Slovenia AI está entre las primeras plataformas turísticas con IA para Eslovenia — el viajero escribe qué quiere, la IA construye el día y recomienda tu local. La reserva se hace directamente contigo.",
    },
    howTitle: { sl: "Kako AI prinese goste", en: "How the AI brings guests", it: "Come l'AI porta ospiti", de: "Wie die KI Gäste bringt", fr: "Comment l'IA amène des clients", es: "Cómo la IA trae clientes" },
    steps: {
      sl: [
        "Turist vpraša — napiše, kaj želi doživeti v Sloveniji.",
        "AI najde vas — ranking engine primerja in priporoči.",
        "Turist klikne — vidi vaš profil, zgodbo, kontakt.",
        "Kontakt — turist vas pokliče ali obišče spletno stran; rezervacija pri vas.",
      ],
      en: [
        "The traveller asks — writes what they want to experience in Slovenia.",
        "The AI finds you — the ranking engine compares and recommends.",
        "The traveller clicks — sees your profile, story, contact.",
        "Contact — the traveller calls or visits your website; the booking is yours.",
      ],
      it: [
        "Il turista chiede — scrive cosa vuole vivere in Slovenia.",
        "L'AI ti trova — il ranking engine confronta e consiglia.",
        "Il turista clicca — vede il tuo profilo, la tua storia, i contatti.",
        "Contatto — il turista ti chiama o visita il sito web; la prenotazione è tua.",
      ],
      de: [
        "Der Reisende fragt — schreibt, was er in Slowenien erleben will.",
        "Die KI findet dich — die Ranking-Engine vergleicht und empfiehlt.",
        "Der Reisende klickt — sieht dein Profil, deine Geschichte, den Kontakt.",
        "Kontakt — der Reisende ruft an oder besucht die Website; die Buchung ist deine.",
      ],
      fr: [
        "Le voyageur demande — il écrit ce qu'il veut vivre en Slovénie.",
        "L'IA te trouve — le moteur de classement compare et recommande.",
        "Le voyageur clique — il voit ton profil, ton histoire, ton contact.",
        "Contact — le voyageur t'appelle ou visite ton site ; la réservation est pour toi.",
      ],
      es: [
        "El viajero pregunta — escribe qué quiere vivir en Eslovenia.",
        "La IA te encuentra — el motor de ranking compara y recomienda.",
        "El viajero hace clic — ve tu perfil, tu historia, tu contacto.",
        "Contacto — el viajero te llama o visita tu web; la reserva es tuya.",
      ],
    },
    packagesTitle: { sl: "Paketi", en: "Packages", it: "Pacchetti", de: "Pakete", fr: "Formules", es: "Paquetes" },
    packagesLead: {
      sl: "Registracija in osnovni paket sta brezplačna — turisti nikoli ne plačujejo. Med beta obdobjem so vsi paketi brezplačni.",
      en: "Registration and the basic package are free — travellers never pay. During the beta period all packages are free.",
      it: "Registrazione e pacchetto base sono gratuiti — i turisti non pagano mai. Durante il periodo beta tutti i pacchetti sono gratuiti.",
      de: "Registrierung und Basispaket sind kostenlos — Reisende zahlen nie. Während der Beta-Phase sind alle Pakete kostenlos.",
      fr: "L'inscription et la formule de base sont gratuites — les voyageurs ne paient jamais. Pendant la période bêta, toutes les formules sont gratuites.",
      es: "El registro y el paquete básico son gratuitos — los viajeros nunca pagan. Durante el período beta todos los paquetes son gratuitos.",
    },
    contactCta: { sl: "Prijavi svoj lokal", en: "Register your venue", it: "Registra il tuo locale", de: "Melde dein Lokal an", fr: "Enregistre ton établissement", es: "Registra tu local" },
    benefitsTitle: { sl: "Kaj dobite kot partner", en: "What you get as a partner", it: "Cosa ottieni come partner", de: "Was du als Partner bekommst", fr: "Ce que tu obtiens en tant que partenaire", es: "Qué obtienes como socio" },
    benefits: {
      sl: [
        "Verified Badge — znak „Preverjen partner“, ki ga podelijo uredniki po pregledu",
        "AI optimizacija — avtomatski SEO meta, ključne besede in tagi",
        "Statistika — ogledi, kliki, AI priporočila, kontakti, ROI",
        "Povpraševanja gostov — obrazec na vašem profilu, viden v statistiki",
        "Atribucija rezervacij — rezervacije iz AI konzultacij se zapišejo vam",
        "AI zgodba — čustvena zgodba o vašem podjetju",
      ],
      en: [
        "Verified Badge — the “Verified partner” badge awarded by our editors after review",
        "AI optimisation — automatic SEO meta, keywords and tags",
        "Analytics — views, clicks, AI recommendations, contacts, ROI",
        "Guest enquiries — a form on your profile, visible in your statistics",
        "Booking attribution — bookings from AI consultations are attributed to you",
        "AI story — an emotive story about your business",
      ],
      it: [
        "Verified Badge — il badge «Partner verificato» assegnato dai nostri redattori dopo la revisione",
        "Ottimizzazione AI — meta SEO automatici, parole chiave e tag",
        "Statistiche — visualizzazioni, clic, raccomandazioni AI, contatti, ROI",
        "Richieste degli ospiti — un modulo sul tuo profilo, visibile nelle statistiche",
        "Attribuzione delle prenotazioni — le prenotazioni dalle consulenze AI sono attribuite a te",
        "Storia AI — una storia emotiva sulla tua attività",
      ],
      de: [
        "Verified Badge — das Abzeichen „Verifizierter Partner“, verliehen von unserer Redaktion nach Prüfung",
        "KI-Optimierung — automatische SEO-Metas, Keywords und Tags",
        "Statistik — Aufrufe, Klicks, KI-Empfehlungen, Kontakte, ROI",
        "Gastanfragen — ein Formular auf deinem Profil, sichtbar in deiner Statistik",
        "Buchungszuordnung — Buchungen aus KI-Beratungen werden dir zugeordnet",
        "KI-Geschichte — eine emotionale Geschichte über dein Unternehmen",
      ],
      fr: [
        "Verified Badge — le badge « Partenaire vérifié » décerné par notre rédaction après examen",
        "Optimisation IA — métadonnées SEO automatiques, mots-clés et tags",
        "Statistiques — vues, clics, recommandations IA, contacts, ROI",
        "Demandes des clients — un formulaire sur ton profil, visible dans tes statistiques",
        "Attribution des réservations — les réservations issues des consultations IA te sont attribuées",
        "Histoire IA — une histoire émouvante sur ton entreprise",
      ],
      es: [
        "Verified Badge — la insignia «Socio verificado» que otorgan nuestros editores tras la revisión",
        "Optimización con IA — metadatos SEO automáticos, palabras clave y etiquetas",
        "Estadísticas — visualizaciones, clics, recomendaciones de IA, contactos, ROI",
        "Consultas de huéspedes — un formulario en tu perfil, visible en tus estadísticas",
        "Atribución de reservas — las reservas de consultas de IA se te atribuyen",
        "Historia con IA — una historia emotiva sobre tu negocio",
      ],
    },
    betaTitle: { sl: "Postani ustanovni partner", en: "Become a founding partner", it: "Diventa partner fondatore", de: "Werde Gründungspartner", fr: "Deviens partenaire fondateur", es: "Conviértete en socio fundador" },
    betaLead: {
      sl: "Med beta obdobjem je platforma brezplačna — prvih 30 lokalov gradi temelje in obdrži ugodnosti (brezplačen premium paket, vrednost €149/mes, brez obveznosti).",
      en: "During the beta period the platform is free — the first 30 venues build the foundations and keep the benefits (a free premium package worth €149/mo, no obligation).",
      it: "Durante il periodo beta la piattaforma è gratuita — i primi 30 locali costruiscono le fondamenta e mantengono i vantaggi (pacchetto premium gratuito del valore di €149/mese, senza obblighi).",
      de: "Während der Beta-Phase ist die Plattform kostenlos — die ersten 30 Lokale legen die Grundlagen und behalten die Vorteile (ein kostenloses Premium-Paket im Wert von €149/Monat, ohne Verpflichtung).",
      fr: "Pendant la période bêta, la plateforme est gratuite — les 30 premiers établissements posent les fondations et gardent les avantages (une formule premium gratuite d'une valeur de €149/mois, sans obligation).",
      es: "Durante el período beta la plataforma es gratuita — los primeros 30 locales construyen los cimientos y conservan las ventajas (un paquete premium gratuito por valor de €149/mes, sin compromiso).",
    },
    ruleTitle: { sl: "Naša obljuba", en: "Our promise", it: "La nostra promessa", de: "Unser Versprechen", fr: "Notre promesse", es: "Nuestra promesa" },
    ruleBody: {
      sl: "Zaupanje gradimo z dejstvi, ne z izmišljenimi pričevanji: mnenja gostov bomo objavili samo z dokazano rezervacijo. 0 % provizije na direktnih rezervacijah; 12 % samo na AI-generiranih — vsak obračun vsebuje podrobnosti posamezne rezervacije.",
      en: "We build trust with facts, not invented testimonials: guest reviews are published only with a proven booking. 0% commission on direct bookings; 12% only on AI-generated ones — every statement lists the details of each booking.",
      it: "Costruiamo la fiducia con i fatti, non con testimonianze inventate: le recensioni degli ospiti vengono pubblicate solo con una prenotazione dimostrata. 0 % di provvigione sulle prenotazioni dirette; 12 % solo su quelle generate dall'AI — ogni estratto conto riporta i dettagli di ciascuna prenotazione.",
      de: "Vertrauen bauen wir mit Fakten, nicht mit erfundenen Testimonials: Gästebewertungen veröffentlichen wir nur mit nachgewiesener Buchung. 0 % Provision auf Direktbuchungen; 12 % nur auf KI-generierten — jede Abrechnung listet die Details der einzelnen Buchung.",
      fr: "Nous construisons la confiance avec des faits, pas avec des témoignages inventés : les avis clients ne sont publiés qu'avec une réservation prouvée. 0 % de commission sur les réservations directes ; 12 % uniquement sur celles générées par l'IA — chaque relevé détaille chaque réservation.",
      es: "Construimos confianza con hechos, no con testimonios inventados: las reseñas de huéspedes se publican solo con una reserva demostrada. 0 % de comisión en las reservas directas; 12 % solo en las generadas por la IA — cada extracto detalla cada reserva.",
    },
  } as const;

  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);
  const S = pick(l, L.steps);
  const B = pick(l, L.benefits);

  const packages = [
    {
      name: { sl: "Osnovni", en: "Basic", it: "Base", de: "Basis", fr: "Basique", es: "Básico" },
      price: "€0",
      note: { sl: "za vedno brezplačno", en: "free forever", it: "gratis per sempre", de: "für immer kostenlos", fr: "gratuit pour toujours", es: "gratis para siempre" },
      features: {
        sl: ["Osnovni profil lokala", "Prikaz v AI konzultacijah", "12 % provizija na AI rezervacije", "Mesečni račun (PDF)"],
        en: ["Basic venue profile", "Listed in AI consultations", "12% commission on AI bookings", "Monthly statement (PDF)"],
        it: ["Profilo base del locale", "Presenza nelle consulenze AI", "12 % di provvigione sulle prenotazioni AI", "Estratto conto mensile (PDF)"],
        de: ["Basisprofil des Lokals", "In KI-Beratungen gelistet", "12 % Provision auf KI-Buchungen", "Monatsabrechnung (PDF)"],
        fr: ["Profil de base de l'établissement", "Listé dans les consultations IA", "12 % de commission sur les réservations IA", "Relevé mensuel (PDF)"],
        es: ["Perfil básico del local", "Aparece en consultas de IA", "12 % de comisión en reservas de IA", "Extracto mensual (PDF)"],
      },
      featured: false,
    },
    {
      name: { sl: "Premium", en: "Premium", it: "Premium", de: "Premium", fr: "Premium", es: "Premium" },
      price: "€149",
      note: { sl: "/mesec — brezplačno med beto", en: "/mo — free during beta", it: "/mese — gratis durante la beta", de: "/Monat — kostenlos während der Beta", fr: "/mois — gratuit pendant la bêta", es: "/mes — gratis durante la beta" },
      features: {
        sl: ["0 % provizija — vključeno", "5 % rangirni boost", "Premium znak", "Citiranje v AI konzultacijah", "Polna statistika", "AI vpogledi"],
        en: ["0% commission — included", "5% ranking boost", "Premium badge", "Quoted in AI consultations", "Full statistics", "AI insights"],
        it: ["0 % provvigione — inclusa", "5 % di boost nel ranking", "Badge premium", "Citazione nelle consulenze AI", "Statistiche complete", "Insight AI"],
        de: ["0 % Provision — inklusive", "5 % Ranking-Boost", "Premium-Abzeichen", "Zitiert in KI-Beratungen", "Vollständige Statistik", "KI-Insights"],
        fr: ["0 % de commission — incluse", "5 % de boost de classement", "Badge premium", "Cité dans les consultations IA", "Statistiques complètes", "Analyses IA"],
        es: ["0 % de comisión — incluida", "5 % de boost en el ranking", "Insignia premium", "Citado en consultas de IA", "Estadísticas completas", "Insights de IA"],
      },
      featured: true,
    },
    {
      name: { sl: "Enterprise", en: "Enterprise", it: "Enterprise", de: "Enterprise", fr: "Enterprise", es: "Enterprise" },
      price: "€499",
      note: { sl: "/mesec — brezplačno med beto", en: "/mo — free during beta", it: "/mese — gratis durante la beta", de: "/Monat — kostenlos während der Beta", fr: "/mois — gratuit pendant la bêta", es: "/mes — gratis durante la beta" },
      features: {
        sl: ["Vse iz Premium", "0 % provizija", "Več lokalov na enem računu", "Namenska podpora", "API dostop"],
        en: ["Everything from Premium", "0% commission", "Multiple venues on one account", "Dedicated support", "API access"],
        it: ["Tutto di Premium", "0 % provvigione", "Più locali su un unico account", "Supporto dedicato", "Accesso API"],
        de: ["Alles aus Premium", "0 % Provision", "Mehrere Lokale auf einem Konto", "Dedizierter Support", "API-Zugang"],
        fr: ["Tout de Premium", "0 % de commission", "Plusieurs établissements sur un compte", "Support dédié", "Accès API"],
        es: ["Todo lo de Premium", "0 % de comisión", "Varios locales en una cuenta", "Soporte dedicado", "Acceso a la API"],
      },
      featured: false,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        kicker={t("kicker")}
        title={t("title")}
        lead={t("lead")}
      />

      <div className="mt-8">
        <Button asChild size="lg" className="tap-target font-semibold">
          <a href="#prijavnica">{t("contactCta")}</a>
        </Button>
      </div>

      {/* Kako deluje */}
      <h2 className="mt-12 text-xl font-bold tracking-tight">{t("howTitle")}</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {S.map((step, i) => (
          <li key={i} className="rounded-xl border bg-card p-4">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {i + 1}
            </span>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step}</p>
          </li>
        ))}
      </ol>

      {/* Paketi */}
      <h2 className="mt-12 text-xl font-bold tracking-tight">{t("packagesTitle")}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("packagesLead")}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {packages.map((p) => (
          <Card
            key={pick(l, p.name)}
            className={p.featured ? "border-primary shadow-md ring-1 ring-primary/30" : undefined}
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{pick(l, p.name)}</CardTitle>
                {p.featured && (
                  <Badge className="bg-primary text-primary-foreground">
                    <Sparkles className="mr-1 size-3" aria-hidden="true" />
                    {pick(l, { sl: "Priljubljen", en: "Popular", it: "Popolare", de: "Beliebt", fr: "Populaire", es: "Popular" })}
                  </Badge>
                )}
              </div>
              <p className="mt-2">
                <span className="text-3xl font-bold">{p.price}</span>{" "}
                <span className="text-xs text-muted-foreground">{pick(l, p.note)}</span>
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {pick(l, p.features).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Koristi */}
      <h2 className="mt-12 text-xl font-bold tracking-tight">{t("benefitsTitle")}</h2>
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {B.map((b) => (
          <li key={b} className="flex items-start gap-2 rounded-lg border bg-card p-3.5 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-muted-foreground">{b}</span>
          </li>
        ))}
      </ul>

      {/* Prijavnica partnerja (P0-H §22) */}
      <div id="prijavnica" className="scroll-mt-24">
        <PartnerApplyForm />
      </div>

      {/* Beta + obljuba */}
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <Card className="border-primary/25 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">{t("betaTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("betaLead")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("ruleTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("ruleBody")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── PRIJAVNICA PARTNERJA ────────────────────────────────────────────────────

function PartnerApplyForm() {
  const l = useLocale();
  const { toast } = useToast();
  const { status: sessionStatus } = useSession();

  const [note, setNote] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [applied, setApplied] = React.useState(false);

  const L = {
    title: { sl: "Prijavnica partnerja", en: "Partner application", it: "Modulo di candidatura partner", de: "Partner-Bewerbung", fr: "Formulaire de candidature partenaire", es: "Formulario de solicitud de socio" },
    lead: {
      sl: "Pošlji prijavo — skrbnik jo pregleda na skrbniškem portalu. Po odobritvi dobi tvoj račun vlogo partnerja in dostop do partnerjevega portala (vnosi v tržnico, statistika, naročila).",
      en: "Send an application — an admin reviews it in the admin portal. Upon approval your account receives the partner role and access to the partner portal (marketplace listings, statistics, orders).",
      it: "Invia una candidatura — un amministratore la esamina nel portale di amministrazione. Dopo l'approvazione il tuo account riceve il ruolo di partner e l'accesso al portale partner (annunci del marketplace, statistiche, ordini).",
      de: "Sende eine Bewerbung — ein Admin prüft sie im Admin-Portal. Nach der Freigabe erhält dein Konto die Partnerrolle und Zugang zum Partner-Portal (Marktplatz-Einträge, Statistik, Bestellungen).",
      fr: "Envoie une candidature — un admin l'examine dans le portail d'administration. Après approbation, ton compte reçoit le rôle de partenaire et l'accès au portail partenaire (annonces du marketplace, statistiques, commandes).",
      es: "Envía una solicitud — un administrador la revisa en el portal de administración. Tras la aprobación, tu cuenta recibe el rol de socio y acceso al portal de socios (anuncios del marketplace, estadísticas, pedidos).",
    },
    howTitle: { sl: "Kaj se zgodi po prijavi", en: "What happens after you apply", it: "Cosa succede dopo la candidatura", de: "Was nach der Bewerbung passiert", fr: "Ce qui se passe après ta candidature", es: "Qué ocurre después de solicitarlo" },
    howBody: {
      sl: "Prijava je iskreno ROČNA odločitev skrbnika (kanon DSA_ADMIN_EMAILS) — brez samodejnih obljub in brez takojšnje objave. Vsak vnos v tržnico gre skozi moderacijo: ti ustvariš osnutek, mi ga pregledamo in objavimo.",
      en: "The application is an honest MANUAL admin decision (the DSA_ADMIN_EMAILS canon) — no automated promises, no instant publishing. Every marketplace listing goes through moderation: you create a draft, we review and publish it.",
      it: "La candidatura è un'onesta decisione MANUALE dell'amministratore (canone DSA_ADMIN_EMAILS) — nessuna promessa automatica e nessuna pubblicazione immediata. Ogni annuncio del marketplace passa dalla moderazione: crei tu la bozza, la esaminiamo e la pubblichiamo noi.",
      de: "Die Bewerbung ist eine ehrliche MANUELLE Admin-Entscheidung (der DSA_ADMIN_EMAILS-Kanon) — keine automatischen Versprechen, keine sofortige Veröffentlichung. Jeder Marktplatz-Eintrag geht durch die Moderation: du erstellst den Entwurf, wir prüfen und veröffentlichen ihn.",
      fr: "La candidature est une décision MANUELLE honnête de l'admin (le canon DSA_ADMIN_EMAILS) — aucune promesse automatisées, aucune publication instantanée. Chaque annonce du marketplace passe par la modération : tu crées le brouillon, nous le révisons et le publions.",
      es: "La solicitud es una decisión MANUAL honesta del administrador (el canon DSA_ADMIN_EMAILS) — sin promesas automáticas y sin publicación inmediata. Cada anuncio del marketplace pasa por moderación: tú creas el borrador, nosotros lo revisamos y lo publicamos.",
    },
    note: { sl: "Sporočilo (neobvezno)", en: "Message (optional)", it: "Messaggio (facoltativo)", de: "Notiz (optional)", fr: "Message (facultatif)", es: "Mensaje (opcional)" },
    notePh: {
      sl: "Napiši nekaj o svoji ponudbi: kaj nudite, kje ste, zakaj bi bili dober partner … (do 500 znakov)",
      en: "Write about your offer: what you provide, where you are, why you would be a good partner … (up to 500 characters)",
      it: "Scrivi qualcosa della tua offerta: cosa offrite, dove siete, perché sareste un buon partner … (fino a 500 caratteri)",
      de: "Schreibe etwas über dein Angebot: Was du anbietest, wo du bist, warum du ein guter Partner wärst … (bis zu 500 Zeichen)",
      fr: "Écris quelque chose sur ton offre : ce que tu proposes, où tu es, pourquoi tu serais un bon partenaire … (jusqu'à 500 caractères)",
      es: "Escribe algo sobre tu oferta: qué ofrecéis, dónde estáis, por qué seríais un buen socio … (hasta 500 caracteres)",
    },
    submit: { sl: "Pošlji prijavo", en: "Send application", it: "Invia candidatura", de: "Bewerbung senden", fr: "Envoyer la candidature", es: "Enviar solicitud" },
    sending: { sl: "Pošiljanje …", en: "Sending …", it: "Invio …", de: "Wird gesendet …", fr: "Envoi …", es: "Enviando …" },
    unauthTitle: { sl: "Najprej se prijavi", en: "Sign in first", it: "Prima accedi", de: "Melde dich zuerst an", fr: "Connecte-toi d'abord", es: "Primero inicia sesión" },
    unauthBody: {
      sl: "Prijavnica je za registrirane račune (varnost in sledljivost). Prijavi se ali ustvari račun — vrnil se boš sem.",
      en: "The application is for registered accounts (security and traceability). Sign in or create an account — you will return here.",
      it: "Il modulo è per account registrati (sicurezza e tracciabilità). Accedi o crea un account — tornerai qui.",
      de: "Das Formular ist für registrierte Konten (Sicherheit und Nachvollziehbarkeit). Melde dich an oder erstelle ein Konto — du kehrst hierher zurück.",
      fr: "Le formulaire est réservé aux comptes enregistrés (sécurité et traçabilité). Connecte-toi ou crée un compte — tu reviendras ici.",
      es: "El formulario es para cuentas registradas (seguridad y trazabilidad). Inicia sesión o crea una cuenta — volverás aquí.",
    },
    login: { sl: "Prijava / registracija", en: "Sign in / register", it: "Accedi / registrati", de: "Anmelden / registrieren", fr: "Connexion / inscription", es: "Iniciar sesión / registrarse" },
    doneTitle: { sl: "Prijava poslana!", en: "Application sent!", it: "Candidatura inviata!", de: "Bewerbung gesendet!", fr: "Candidature envoyée !", es: "¡Solicitud enviada!" },
    doneBody: {
      sl: "Tvoja prijava čaka na skrbniški pregled. Po odobritvi dobiš vlogo partnerja — portal partnerja se ti odpre na /partner.",
      en: "Your application awaits admin review. Upon approval you receive the partner role — the partner portal opens for you at /partner.",
      it: "La tua candidatura attende la revisione dell'amministratore. Dopo l'approvazione ricevi il ruolo di partner — il portale partner si apre per te su /partner.",
      de: "Deine Bewerbung wartet auf die Admin-Prüfung. Nach der Freigabe erhältst du die Partnerrolle — das Partner-Portal öffnet sich für dich unter /partner.",
      fr: "Ta candidature attend la revue de l'admin. Après approbation, tu reçois le rôle de partenaire — le portail partenaire s'ouvre pour toi sur /partner.",
      es: "Tu solicitud espera la revisión del administrador. Tras la aprobación recibes el rol de socio — el portal de socios se abre para ti en /partner.",
    },
    openPortal: { sl: "Portal partnerja", en: "Partner portal", it: "Portale partner", de: "Partner-Portal", fr: "Portail partenaire", es: "Portal de socios" },
    alreadyPartner: {
      sl: "Že partner? Portal najdeš tukaj.",
      en: "Already a partner? The portal is here.",
      it: "Già partner? Il portale è qui.",
      de: "Schon Partner? Das Portal findest du hier.",
      fr: "Déjà partenaire ? Le portail est ici.",
      es: "¿Ya eres socio? El portal está aquí.",
    },
    err: { sl: "Prijava trenutno ni mogoča.", en: "The application is currently unavailable.", it: "La candidatura non è al momento possibile.", de: "Die Bewerbung ist derzeit nicht möglich.", fr: "La candidature est momentanément impossible.", es: "La solicitud no es posible en este momento." },
    errNetwork: { sl: "Omrežna napaka — poskusi znova.", en: "Network error — try again.", it: "Errore di rete — riprova.", de: "Netzwerkfehler — versuche es erneut.", fr: "Erreur réseau — réessaie.", es: "Error de red — reintenta." },
  } as const;

  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/partner/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: string }
        | null;
      if (res.ok && body?.ok) {
        setApplied(true);
        window.scrollTo({ top: document.getElementById("prijavnica")?.offsetTop, behavior: "smooth" });
        return;
      }
      toast({ title: body?.error ?? t("err"), variant: "destructive" });
    } catch {
      toast({ title: t("errNetwork"), variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="mt-12 border-primary/25">
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t("lead")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            {t("howTitle")}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("howBody")}</p>
        </div>

        {/* Uspeh: prijava poslana */}
        {applied ? (
          <div className="rounded-lg border border-emerald-600/50 bg-emerald-600/10 p-4">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {t("doneTitle")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("doneBody")}</p>
          </div>
        ) : sessionStatus === "unauthenticated" ? (
          /* Brez seje: iskren poziv k prijavi */
          <div className="rounded-lg border border-amber-600/50 bg-amber-600/10 p-4">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {t("unauthTitle")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("unauthBody")}</p>
            <Button asChild className="mt-3 tap-target font-semibold">
              <Link href="/prijava?next=/za-ponudnike">
                <LogIn className="size-4" aria-hidden="true" />
                {t("login")}
              </Link>
            </Button>
          </div>
        ) : (
          /* Obrazec (prijavljen) */
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="partner-note">{t("note")}</Label>
              <Textarea
                id="partner-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                placeholder={t("notePh")}
                rows={4}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={sending || sessionStatus !== "authenticated"}
                className="tap-target font-semibold"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UserPlus className="size-4" aria-hidden="true" />
                )}
                {sending ? t("sending") : t("submit")}
              </Button>
              <Button asChild variant="ghost" className="tap-target">
                <Link href="/partner">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  {t("openPortal")}
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("alreadyPartner")}</p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
