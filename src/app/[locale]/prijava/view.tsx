"use client";

import {
  ArrowRight,
  CheckCircle2,
  HardDrive,
  Loader2,
  LogIn,
  Send,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

/**
 * /prijava — račun popotnika (48-a: DEJANSKA prijava, NextAuth v4
 * credentials + JWT). Registracija ustvari uporabnika (scrypt hash),
 * prijava preveri geslo in sejo (session.user) uporabljajo skupnostne
 * funkcije poti (vabila, vloge, ankete, klepet).
 *
 * Demo račun je izrecno označen (iskrenostni kanon): demo@discover-slovenia.ai
 * / slovenija2026 — seedan, geslo javno namenjeno preizkusu.
 */
export default function PrijavaPage() {
  const l = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const { status } = useSession();

  const [next, setNext] = React.useState<string | null>(null);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [signingIn, setSigningIn] = React.useState(false);

  const [regName, setRegName] = React.useState("");
  const [regEmail, setRegEmail] = React.useState("");
  const [regPassword, setRegPassword] = React.useState("");
  const [registering, setRegistering] = React.useState(false);

  // ?next= preberemo po mountu (stran je statična — brez useSearchParams,
  // ki bi zahteval Suspensovo mejo; branje je klientno in pošteno).
  React.useEffect(() => {
    try {
      const n = new URLSearchParams(window.location.search).get("next");
      if (n && n.startsWith("/") && !n.startsWith("//")) setNext(n);
    } catch {
      /* ignoriramo */
    }
  }, []);

  const L = {
    title: { sl: "Račun popotnika", en: "Traveller account", it: "Account viaggiatore", de: "Reisenden-Konto", fr: "Compte voyageur", es: "Cuenta de viajero" },
    lead: {
      sl: "Shranjujte pote v oblak, sodelujte na skupinskih poteh (vabila, ankete, rezervacije, klepet z @AI) in nadaljujte, kjer ste ostali.",
      en: "Save trips to the cloud, collaborate on shared trips (invites, polls, reservations, the @AI chat) and continue where you left off.",
      it: "Salva i viaggi nel cloud, collabora sui viaggi condivisi (inviti, sondaggi, prenotazioni, chat con @AI) e continua da dove eri rimasto.",
      de: "Speichere Reisen in der Cloud, arbeite an geteilten Reisen zusammen (Einladungen, Umfragen, Reservierungen, der @AI-Chat) und mach dort weiter, wo du aufgehört hast.",
      fr: "Enregistre tes voyages dans le cloud, collabore sur des voyages partagés (invitations, sondages, réservations, le chat @AI) et reprends là où tu t'étais arrêté.",
      es: "Guarda los viajes en la nube, colabora en viajes compartidos (invitaciones, encuestas, reservas, el chat @AI) y continúa donde lo dejaste.",
    },
    privacy: {
      sl: "Vaši podatki so zaščiteni in se uporabljajo izključno za ta portal. Gesla hranimo izključno kot scrypt-hash.",
      en: "Your data is protected and used exclusively for this portal. Passwords are stored only as scrypt hashes.",
      it: "I tuoi dati sono protetti e utilizzati esclusivamente per questo portale. Le password sono conservate solo come hash scrypt.",
      de: "Deine Daten sind geschützt und werden ausschließlich für dieses Portal verwendet. Passwörter speichern wir nur als scrypt-Hash.",
      fr: "Tes données sont protégées et utilisées exclusivement pour ce portail. Les mots de passe sont stockés uniquement sous forme de hachage scrypt.",
      es: "Tus datos están protegidos y se usan exclusivamente para este portal. Las contraseñas se guardan solo como hash scrypt.",
    },
    signInTab: { sl: "Prijava", en: "Sign in", it: "Accedi", de: "Anmelden", fr: "Connexion", es: "Iniciar sesión" },
    registerTab: { sl: "Registracija", en: "Create account", it: "Crea account", de: "Konto erstellen", fr: "Créer un compte", es: "Crear cuenta" },
    emailLabel: { sl: "E-poštni naslov", en: "Email address", it: "Indirizzo e-mail", de: "E-Mail-Adresse", fr: "Adresse e-mail", es: "Dirección de correo electrónico" },
    passwordLabel: { sl: "Geslo", en: "Password", it: "Password", de: "Passwort", fr: "Mot de passe", es: "Contraseña" },
    submit: { sl: "Prijavi me", en: "Sign me in", it: "Accedi", de: "Anmelden", fr: "Me connecter", es: "Iniciar sesión" },
    sending: { sl: "Prijavljam …", en: "Signing in …", it: "Accesso in corso …", de: "Anmeldung läuft …", fr: "Connexion en cours …", es: "Iniciando sesión …" },
    errTitle: { sl: "Prijava ni uspela", en: "Sign-in failed", it: "Accesso non riuscito", de: "Anmeldung fehlgeschlagen", fr: "Échec de la connexion", es: "Error al iniciar sesión" },
    errCredentials: {
      sl: "Napačen e-poštni naslov ali geslo. Preveri podatke in poskusi znova.",
      en: "Wrong email or password. Check your details and try again.",
      it: "E-mail o password errata. Controlla i dati e riprova.",
      de: "Falsche E-Mail oder falsches Passwort. Prüfe deine Angaben und versuche es erneut.",
      fr: "E-mail ou mot de passe incorrect. Vérifie tes informations et réessaie.",
      es: "Correo electrónico o contraseña incorrectos. Comprueba tus datos y reintenta.",
    },
    okTitle: { sl: "Prijava uspešna", en: "Signed in", it: "Accesso riuscito", de: "Angemeldet", fr: "Connecté", es: "Sesión iniciada" },
    okBody: { sl: "Preusmerjam …", en: "Redirecting …", it: "Reindirizzamento …", de: "Weiterleitung …", fr: "Redirection …", es: "Redirigiendo …" },
    regName: { sl: "Ime", en: "Name", it: "Nome", de: "Name", fr: "Nom", es: "Nombre" },
    regSubmit: { sl: "Ustvari račun", en: "Create account", it: "Crea account", de: "Konto erstellen", fr: "Créer un compte", es: "Crear cuenta" },
    regSubmitting: { sl: "Ustvarjam …", en: "Creating …", it: "Creazione …", de: "Wird erstellt …", fr: "Création …", es: "Creando …" },
    regOkTitle: { sl: "Račun je ustvarjen", en: "Account created", it: "Account creato", de: "Konto erstellt", fr: "Compte créé", es: "Cuenta creada" },
    regOkBody: {
      sl: "Prijava je samodejna — preusmerjam na Moja potovanja.",
      en: "You are signed in automatically — redirecting to My trips.",
      it: "L'accesso è automatico — reindirizzamento a I miei viaggi.",
      de: "Die Anmeldung erfolgt automatisch — Weiterleitung zu Meine Reisen.",
      fr: "La connexion est automatique — redirection vers Mes voyages.",
      es: "El inicio de sesión es automático — redirigiendo a Mis viajes.",
    },
    regErrTitle: { sl: "Registracija ni uspela", en: "Registration failed", it: "Registrazione non riuscita", de: "Registrierung fehlgeschlagen", fr: "Échec de l'inscription", es: "Error al registrarse" },
    demoTitle: { sl: "Demo račun za preizkus", en: "Demo account to try it", it: "Account demo per provarlo", de: "Demo-Konto zum Ausprobieren", fr: "Compte démo pour l'essayer", es: "Cuenta demo para probarlo" },
    demoBody: {
      sl: "Predstavitveni račun (ni zasebni): demo@discover-slovenia.ai z geslom slovenija2026 — namenjen hiteremu preizkusu skupnostnih funkcij.",
      en: "A demo account (not private): demo@discover-slovenia.ai with password slovenija2026 — meant for a quick try of the collaboration features.",
      it: "Un account dimostrativo (non privato): demo@discover-slovenia.ai con password slovenija2026 — pensato per provare al volo le funzioni collaborative.",
      de: "Ein Demo-Konto (nicht privat): demo@discover-slovenia.ai mit Passwort slovenija2026 — für einen schnellen Test der Kollaborationsfunktionen gedacht.",
      fr: "Un compte de démonstration (non privé) : demo@discover-slovenia.ai avec le mot de passe slovenija2026 — conçu pour essayer rapidement les fonctions collaboratives.",
      es: "Una cuenta de demostración (no privada): demo@discover-slovenia.ai con contraseña slovenija2026 — pensada para probar rápidamente las funciones de colaboración.",
    },
    demoFill: { sl: "Vnesi demo podatke", en: "Fill in the demo credentials", it: "Inserisci le credenziali demo", de: "Demo-Zugangsdaten eintragen", fr: "Remplir les identifiants démo", es: "Rellenar las credenciales demo" },
    myTripsCta: { sl: "Odpri Moja potovanja", en: "Open My trips", it: "Apri I miei viaggi", de: "Meine Reisen öffnen", fr: "Ouvrir Mes voyages", es: "Abrir Mis viajes" },
    providersTitle: { sl: "Si ponudnik?", en: "Are you a provider?", it: "Sei un fornitore?", de: "Bist du Anbieter?", fr: "Tu es prestataire ?", es: "¿Eres proveedor?" },
    providersBody: {
      sl: "Lastniki lokalov imajo svoj portal — prijava za partnerje.",
      en: "Venue owners have their own portal — partner sign-in.",
      it: "I proprietari di locali hanno un loro portale — accesso per i partner.",
      de: "Lokalbesitzer haben ein eigenes Portal — Partner-Anmeldung.",
      fr: "Les propriétaires d'établissements ont leur propre portail — connexion partenaire.",
      es: "Los propietarios de locales tienen su propio portal — inicio de sesión de socios.",
    },
    providersCta: { sl: "Portal za lastnike", en: "Owner portal", it: "Portale per i proprietari", de: "Portal für Lokalbesitzer", fr: "Portail des propriétaires", es: "Portal para propietarios" },
  } as const;

  const target = next ?? "/moja-potovanja";

  const doSignIn = React.useCallback(
    async (emailValue: string, passwordValue: string) => {
      setSigningIn(true);
      try {
        const res = await signIn("credentials", {
          redirect: false,
          email: emailValue,
          password: passwordValue,
        });
        if (!res || res.error) {
          toast({
            title: pick(l, L.errTitle),
            description: pick(l, L.errCredentials),
            variant: "destructive",
          });
          return;
        }
        toast({ title: pick(l, L.okTitle), description: pick(l, L.okBody) });
        router.push(target);
        router.refresh();
      } catch (err) {
        toast({
          title: pick(l, L.errTitle),
          description: err instanceof Error ? err.message : pick(l, L.errCredentials),
          variant: "destructive",
        });
      } finally {
        setSigningIn(false);
      }
    },
    [l, toast, router, target]
  );

  const onSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signingIn) return;
    await doSignIn(email, password);
  };

  const onSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registering) return;
    setRegistering(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !body?.success) {
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      toast({ title: pick(l, L.regOkTitle), description: pick(l, L.regOkBody) });
      await doSignIn(regEmail, regPassword);
    } catch (err) {
      toast({
        title: pick(l, L.regErrTitle),
        description: err instanceof Error ? err.message : "Poskusi znova.",
        variant: "destructive",
      });
    } finally {
      setRegistering(false);
    }
  };

  const alreadyIn = status === "authenticated";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14 lg:px-8">
      <PageHeader title={pick(l, L.title)} lead={pick(l, L.lead)}>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          {pick(l, L.privacy)}
        </p>
      </PageHeader>

      {alreadyIn ? (
        <Card className="mt-8 rounded-2xl border-primary/30 bg-gradient-to-br from-primary/[0.07] to-card shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <CheckCircle2 className="size-8 text-primary" aria-hidden="true" />
            <p className="text-base font-semibold">
              {pick(l, { sl: "Si prijavljen.", en: "You are signed in.", it: "Sei connesso.", de: "Du bist angemeldet.", fr: "Tu es connecté.", es: "Has iniciado sesión." })}
            </p>
            <Button asChild className="min-h-11 gap-1.5 font-semibold">
              <Link href="/moja-potovanja">
                {pick(l, L.myTripsCta)}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Demo račun — iskreno označen (javno geslo za preizkus) */}
          <Card className="mt-6 rounded-2xl border-amber-300/70 bg-amber-50 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
            <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{pick(l, L.demoTitle)}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {pick(l, L.demoBody)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 shrink-0 gap-1.5"
                onClick={() => {
                  setEmail("demo@discover-slovenia.ai");
                  setPassword("slovenija2026");
                }}
              >
                <UserPlus className="size-4" aria-hidden="true" />
                {pick(l, L.demoFill)}
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6 rounded-2xl border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LogIn className="size-5 text-primary" aria-hidden="true" />
                {pick(l, { sl: "Prijava z geslom", en: "Sign in with a password", it: "Accedi con password", de: "Mit Passwort anmelden", fr: "Connexion avec mot de passe", es: "Iniciar sesión con contraseña" })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin">
                <TabsList className="mb-5 h-11 w-full rounded-xl border border-border/70 bg-muted/60 p-1">
                  <TabsTrigger value="signin" className="h-9 flex-1 gap-1.5 rounded-lg">
                    <LogIn className="size-3.5" aria-hidden="true" />
                    {pick(l, L.signInTab)}
                  </TabsTrigger>
                  <TabsTrigger value="register" className="h-9 flex-1 gap-1.5 rounded-lg">
                    <UserPlus className="size-3.5" aria-hidden="true" />
                    {pick(l, L.registerTab)}
                  </TabsTrigger>
                </TabsList>

                {/* === PRIJAVA === */}
                <TabsContent value="signin">
                  <form onSubmit={onSubmitLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="prijava-email">{pick(l, L.emailLabel)}</Label>
                      <Input
                        id="prijava-email"
                        type="email"
                        required
                        maxLength={160}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        placeholder="ime@primer.si"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prijava-geslo">{pick(l, L.passwordLabel)}</Label>
                      <Input
                        id="prijava-geslo"
                        type="password"
                        required
                        minLength={8}
                        maxLength={200}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="••••••••"
                      />
                    </div>
                    <Button type="submit" disabled={signingIn} className="min-h-11 gap-1.5 font-semibold">
                      {signingIn ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Send className="size-4" aria-hidden="true" />
                      )}
                      {signingIn ? pick(l, L.sending) : pick(l, L.submit)}
                    </Button>
                  </form>
                </TabsContent>

                {/* === REGISTRACIJA === */}
                <TabsContent value="register">
                  <form onSubmit={onSubmitRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="registracija-ime">{pick(l, L.regName)}</Label>
                      <Input
                        id="registracija-ime"
                        required
                        minLength={2}
                        maxLength={80}
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        autoComplete="name"
                        placeholder="Ana Novak"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registracija-email">{pick(l, L.emailLabel)}</Label>
                      <Input
                        id="registracija-email"
                        type="email"
                        required
                        maxLength={160}
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        autoComplete="email"
                        placeholder="ime@primer.si"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registracija-geslo">{pick(l, L.passwordLabel)}</Label>
                      <Input
                        id="registracija-geslo"
                        type="password"
                        required
                        minLength={8}
                        maxLength={200}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder={pick(l, {
                          sl: "vsaj 8 znakov",
                          en: "at least 8 characters",
                          it: "almeno 8 caratteri",
                          de: "mindestens 8 Zeichen",
                          fr: "au moins 8 caractères",
                          es: "al menos 8 caracteres",
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        {pick(l, {
                          sl: "Geslo se shrani izključno kot scrypt-hash (sol + izpeljek) — niti mi ga ne vidimo.",
                          en: "The password is stored only as a scrypt hash (salt + digest) — not even we can see it.",
                          it: "La password viene conservata solo come hash scrypt (sale + digest) — nemmeno noi possiamo vederla.",
                          de: "Das Passwort wird nur als scrypt-Hash gespeichert (Salt + Digest) — nicht einmal wir können es sehen.",
                          fr: "Le mot de passe est stocké uniquement sous forme de hachage scrypt (sel + condensé) — même nous ne pouvons pas le voir.",
                          es: "La contraseña se guarda solo como hash scrypt (sal + resumen) — ni siquiera nosotros podemos verla.",
                        })}
                      </p>
                    </div>
                    <Button type="submit" disabled={registering} className="min-h-11 gap-1.5 font-semibold">
                      {registering ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <UserPlus className="size-4" aria-hidden="true" />
                      )}
                      {registering ? pick(l, L.regSubmitting) : pick(l, L.regSubmit)}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      {/* Načrti ostanejo lokalni (zbirka Moja pot) — skupnostne pote v oblaku
          so nadgradnja, ne pogoj. */}
      <Card className="mt-6 rounded-2xl border-border/70 shadow-sm">
        <CardContent className="flex items-start gap-3 p-5">
          <HardDrive className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">
              {pick(l, { sl: "Zbirka „Moja pot“ ostaja lokalna", en: "The “My trip” collection stays local", it: "La collezione «Il mio viaggio» resta locale", de: "Die Sammlung „Meine Reise“ bleibt lokal", fr: "La collection « Mon voyage » reste locale", es: "La colección «Mi viaje» sigue siendo local" })}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {pick(l, {
                sl: "Zbirka „Moja pot“ deluje brez računa (localStorage) kot prej. Račun odklene poti v oblaku: sodelovanje, ankete, rezervacije in klepet z @AI.",
                en: "The “My trip” collection works without an account (localStorage) as before. An account unlocks cloud trips: collaboration, polls, reservations and the @AI chat.",
                it: "La collezione «Il mio viaggio» funziona senza account (localStorage) come prima. Un account sblocca i viaggi nel cloud: collaborazione, sondaggi, prenotazioni e chat con @AI.",
                de: "Die Sammlung „Meine Reise“ funktioniert wie zuvor ohne Konto (localStorage). Ein Konto schaltet Cloud-Reisen frei: Zusammenarbeit, Umfragen, Reservierungen und der @AI-Chat.",
                fr: "La collection « Mon voyage » fonctionne sans compte (localStorage) comme avant. Un compte débloque les voyages dans le cloud : collaboration, sondages, réservations et le chat @AI.",
                es: "La colección «Mi viaje» funciona sin cuenta (localStorage) como antes. Una cuenta desbloquea los viajes en la nube: colaboración, encuestas, reservas y el chat @AI.",
              })}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3 min-h-11 font-semibold">
              <Link href="/moja-potovanja">
                {pick(l, L.myTripsCta)}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ponudniki */}
      <Card className="mt-6 rounded-2xl border-border/70 shadow-sm">
        <CardContent className="flex items-start justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold">{pick(l, L.providersTitle)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{pick(l, L.providersBody)}</p>
          </div>
          {/* POLIR11: whitespace-normal text-left + shrink — dolgi prevodi (fr
              „Portail des propriétaires“) se ovijejo namesto da raznesejo
              vrstico @320/360. Osnova Buttona (button.tsx) ima poleg
              whitespace-nowrap TUDI shrink-0 — v fleksibilni vrstici se
              preklop whitespace-normal sam po sebi NE izvede, gumb ostane
              max-content (kanon POLIR8): shrink preglasi osnovni shrink-0. */}
          <Button asChild variant="outline" size="sm" className="min-h-11 font-semibold whitespace-normal text-left shrink">
            <Link href="/owner/prijava">{pick(l, L.providersCta)}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
