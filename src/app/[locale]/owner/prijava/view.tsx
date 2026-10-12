"use client";

import { ArrowLeft, Building2, Lock, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

/**
 * /owner/prijava — prijava v portal za lastnike lokalov (1:1 ogrodje
 * produkcije: Prijava/Registracija, e-pošta + geslo, pozabljeno geslo,
 * zasebnostna opomba, povratek na spletno stran).
 *
 * Iskrena rekonstrukcija: avtentikacijski strežnik v sandboxu ni (še)
 * del rekonstrukcije — obrazec se izriše, ne prijavlja pa zoper bazo.
 * Resnične povezave: nazaj na stran, za ponudnike.
 */
export default function OwnerPrijavaPage() {
  const l = useLocale();
  const { toast } = useToast();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [form, setForm] = React.useState({ email: "", password: "" });

  const L = {
    back: { sl: "← Nazaj na spletno stran", en: "← Back to the website", it: "← Torna al sito", de: "← Zurück zur Website", fr: "← Retour au site", es: "← Volver al sitio web" },
    title: { sl: "Portal za lastnike lokalov", en: "Venue owner portal", it: "Portale per i proprietari di locali", de: "Portal für Lokalbesitzer", fr: "Portail des propriétaires d'établissements", es: "Portal para propietarios de locales" },
    lead: {
      sl: "Upravljajte svoje lokale, spremljajte statistiko in bodite vidni obiskovalcem, ki načrtujejo potovanje z AI.",
      en: "Manage your venues, track statistics and be visible to travellers planning trips with AI.",
      it: "Gestisci i tuoi locali, monitora le statistiche e sii visibile ai viaggiatori che pianificano il loro viaggio con l'AI.",
      de: "Verwalte deine Lokale, verfolge Statistiken und sei für Reisende sichtbar, die mit KI Reisen planen.",
      fr: "Gère tes établissements, suis les statistiques et sois visible auprès des voyageurs qui planifient leur voyage avec l'IA.",
      es: "Gestiona tus locales, sigue las estadísticas y sé visible para los viajeros que planifican su viaje con IA.",
    },
    loginTab: { sl: "Prijava", en: "Sign in", it: "Accedi", de: "Anmelden", fr: "Connexion", es: "Iniciar sesión" },
    registerTab: { sl: "Registracija", en: "Register", it: "Registrati", de: "Registrieren", fr: "S'inscrire", es: "Registrarse" },
    loginTitle: { sl: "Prijava v portal", en: "Sign in to the portal", it: "Accedi al portale", de: "Im Portal anmelden", fr: "Connexion au portail", es: "Iniciar sesión en el portal" },
    loginLead: { sl: "Vnesite svoje podatke za dostop do portala.", en: "Enter your credentials to access the portal.", it: "Inserisci le tue credenziali per accedere al portale.", de: "Gib deine Zugangsdaten ein, um auf das Portal zuzugreifen.", fr: "Saisis tes identifiants pour accéder au portail.", es: "Introduce tus credenciales para acceder al portal." },
    registerTitle: { sl: "Registracija računa", en: "Create an account", it: "Crea un account", de: "Konto erstellen", fr: "Créer un compte", es: "Crear una cuenta" },
    registerLead: {
      sl: "Ustvarite račun za upravljanje svojih lokalov.",
      en: "Create an account to manage your venues.",
      it: "Crea un account per gestire i tuoi locali.",
      de: "Erstelle ein Konto, um deine Lokale zu verwalten.",
      fr: "Crée un compte pour gérer tes établissements.",
      es: "Crea una cuenta para gestionar tus locales.",
    },
    email: { sl: "E-pošta", en: "Email", it: "E-mail", de: "E-Mail", fr: "E-mail", es: "Correo electrónico" },
    password: { sl: "Geslo", en: "Password", it: "Password", de: "Passwort", fr: "Mot de passe", es: "Contraseña" },
    submitLogin: { sl: "Prijava", en: "Sign in", it: "Accedi", de: "Anmelden", fr: "Connexion", es: "Iniciar sesión" },
    submitRegister: { sl: "Ustvari račun", en: "Create account", it: "Crea account", de: "Konto erstellen", fr: "Créer un compte", es: "Crear cuenta" },
    forgot: { sl: "Pozabljeno geslo?", en: "Forgot password?", it: "Password dimenticata?", de: "Passwort vergessen?", fr: "Mot de passe oublié ?", es: "¿Olvidaste tu contraseña?" },
    privacy: {
      sl: "Vaši podatki so zaščiteni in se uporabljajo izključno za portal.",
      en: "Your data is protected and used exclusively for the portal.",
      it: "I tuoi dati sono protetti e utilizzati esclusivamente per il portale.",
      de: "Deine Daten sind geschützt und werden ausschließlich für das Portal verwendet.",
      fr: "Tes données sont protégées et utilisées exclusivement pour le portail.",
      es: "Tus datos están protegidos y se usan exclusivamente para el portal.",
    },
    demoTitle: { sl: "Prikaz, ne prijava", en: "A display, not a sign-in", it: "Una dimostrazione, non un accesso", de: "Eine Darstellung, keine Anmeldung", fr: "Une maquette, pas une connexion", es: "Una demostración, no un inicio de sesión" },
    demoBody: {
      sl: "Ta obrazec je zvesta rekonstrukcija produkcije. Avtentikacija (gesla, seje) v tej fazi še ni priključena — klik gumba ti bo iskreno povedal isto. Za sodelovanje z nami uporabite prijavnico na strani za ponudnike.",
      en: "This form is a faithful production reconstruction. Authentication (passwords, sessions) is not connected in this phase — the button will honestly tell you the same. To work with us, use the application form on the providers page.",
      it: "Questo modulo è una fedele ricostruzione della produzione. L'autenticazione (password, sessioni) in questa fase non è ancora collegata — il pulsante ti dirà onestamente la stessa cosa. Per collaborare con noi usa il modulo di candidatura nella pagina per i fornitori.",
      de: "Dieses Formular ist eine getreue Rekonstruktion der Produktion. Die Authentifizierung (Passwörter, Sitzungen) ist in dieser Phase noch nicht angeschlossen — der Button sagt dir ehrlich dasselbe. Um mit uns zusammenzuarbeiten, nutze das Bewerbungsformular auf der Anbieter-Seite.",
      fr: "Ce formulaire est une reconstitution fidèle de la production. L'authentification (mots de passe, sessions) n'est pas encore raccordée à cette étape — le bouton te dira honnêtement la même chose. Pour travailler avec nous, utilise le formulaire de candidature sur la page des prestataires.",
      es: "Este formulario es una reconstrucción fiel de la producción. La autenticación (contraseñas, sesiones) aún no está conectada en esta fase — el botón te dirá honestamente lo mismo. Para colaborar con nosotros, usa el formulario de solicitud en la página para proveedores.",
    },
    demoOk: { sl: "Rekonstrukcija: prijava bi tukaj zagnala sejo.", en: "Reconstruction: sign-in would start a session here.", it: "Ricostruzione: l'accesso avvierebbe qui una sessione.", de: "Rekonstruktion: Die Anmeldung würde hier eine Sitzung starten.", fr: "Reconstitution : la connexion lancerait ici une session.", es: "Reconstrucción: el inicio de sesión iniciaría aquí una sesión." },
    providersCta: { sl: "Prijavnica za ponudnike", en: "Provider application form", it: "Modulo di candidatura per fornitori", de: "Bewerbungsformular für Anbieter", fr: "Formulaire de candidature prestataire", es: "Formulario de solicitud para proveedores" },
  } as const;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: pick(l, L.demoTitle), description: pick(l, L.demoOk) });
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10 sm:px-6">
      <Link
        href="/owner"
        className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {pick(l, L.back).replace("← ", "")}
      </Link>

      <div className="mt-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10">
          <Building2 className="size-6 text-primary" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          {pick(l, L.title)}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pick(l, L.lead)}</p>
      </div>

      {/* Zavihki Prijava / Registracija */}
      <div className="mt-8 grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => setMode("login")}
          className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-green ${
            mode === "login" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LogIn className="size-4" aria-hidden="true" />
          {pick(l, L.loginTab)}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          onClick={() => setMode("register")}
          className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-green ${
            mode === "register" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserPlus className="size-4" aria-hidden="true" />
          {pick(l, L.registerTab)}
        </button>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">
            {mode === "login" ? pick(l, L.loginTitle) : pick(l, L.registerTitle)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-5 text-sm text-muted-foreground">
            {mode === "login" ? pick(l, L.loginLead) : pick(l, L.registerLead)}
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="owner-email">{pick(l, L.email)}</Label>
              <Input
                id="owner-email"
                type="email"
                required
                maxLength={160}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-password">{pick(l, L.password)}</Label>
              <Input
                id="owner-password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" className="tap-target w-full font-semibold">
              <Lock className="size-4" aria-hidden="true" />
              {mode === "login" ? pick(l, L.submitLogin) : pick(l, L.submitRegister)}
            </Button>
            {mode === "login" && (
              <button
                type="button"
                onClick={() =>
                  toast({ title: pick(l, L.demoTitle), description: pick(l, L.demoOk) })
                }
                className="block w-full text-center text-sm font-medium text-primary hover:underline"
              >
                {pick(l, L.forgot)}
              </button>
            )}
          </form>
        </CardContent>
      </Card>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
        {pick(l, L.privacy)}
      </p>

      <Card className="mt-8 border-primary/25 bg-primary/5">
        <CardContent className="p-5">
          <p className="text-sm font-semibold">{pick(l, L.demoTitle)}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {pick(l, L.demoBody)}
          </p>
          {/* POLIR11: whitespace-normal text-left — dolg prevod (es „Formulario
              de solicitud para proveedores“) se ovije namesto preliva @320/360
              (kanon POLIR7). Gumb leži v BLOČNEM vsebniku (p-5), kjer
              fit-content samodejno ovije besedilo — osnovni shrink-0 Buttona
              tu ni v igri (velja samo za fleksibilne vrstice). */}
          <Button asChild variant="outline" size="sm" className="mt-4 font-semibold whitespace-normal text-left">
            <Link href="/za-ponudnike">{pick(l, L.providersCta)}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
