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
    title: { sl: "Račun popotnika", en: "Traveller account" },
    lead: {
      sl: "Shranjujte pote v oblak, sodelujte na skupinskih poteh (vabila, ankete, rezervacije, klepet z @AI) in nadaljujte, kjer ste ostali.",
      en: "Save trips to the cloud, collaborate on shared trips (invites, polls, reservations, the @AI chat) and continue where you left off.",
    },
    privacy: {
      sl: "Vaši podatki so zaščiteni in se uporabljajo izključno za ta portal. Gesla hranimo izključno kot scrypt-hash.",
      en: "Your data is protected and used exclusively for this portal. Passwords are stored only as scrypt hashes.",
    },
    signInTab: { sl: "Prijava", en: "Sign in" },
    registerTab: { sl: "Registracija", en: "Create account" },
    emailLabel: { sl: "E-poštni naslov", en: "Email address" },
    passwordLabel: { sl: "Geslo", en: "Password" },
    submit: { sl: "Prijavi me", en: "Sign me in" },
    sending: { sl: "Prijavljam …", en: "Signing in …" },
    errTitle: { sl: "Prijava ni uspela", en: "Sign-in failed" },
    errCredentials: {
      sl: "Napačen e-poštni naslov ali geslo. Preveri podatke in poskusi znova.",
      en: "Wrong email or password. Check your details and try again.",
    },
    okTitle: { sl: "Prijava uspešna", en: "Signed in" },
    okBody: { sl: "Preusmerjam …", en: "Redirecting …" },
    regName: { sl: "Ime", en: "Name" },
    regSubmit: { sl: "Ustvari račun", en: "Create account" },
    regSubmitting: { sl: "Ustvarjam …", en: "Creating …" },
    regOkTitle: { sl: "Račun je ustvarjen", en: "Account created" },
    regOkBody: {
      sl: "Prijava je samodejna — preusmerjam na Moja potovanja.",
      en: "You are signed in automatically — redirecting to My trips.",
    },
    regErrTitle: { sl: "Registracija ni uspela", en: "Registration failed" },
    demoTitle: { sl: "Demo račun za preizkus", en: "Demo account to try it" },
    demoBody: {
      sl: "Predstavitveni račun (ni zasebni): demo@discover-slovenia.ai z geslom slovenija2026 — namenjen hiteremu preizkusu skupnostnih funkcij.",
      en: "A demo account (not private): demo@discover-slovenia.ai with password slovenija2026 — meant for a quick try of the collaboration features.",
    },
    demoFill: { sl: "Vnesi demo podatke", en: "Fill in the demo credentials" },
    myTripsCta: { sl: "Odpri Moja potovanja", en: "Open My trips" },
    providersTitle: { sl: "Si ponudnik?", en: "Are you a provider?" },
    providersBody: {
      sl: "Lastniki lokalov imajo svoj portal — prijava za partnerje.",
      en: "Venue owners have their own portal — partner sign-in.",
    },
    providersCta: { sl: "Portal za lastnike", en: "Owner portal" },
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
        <Card className="mt-8 border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <CheckCircle2 className="size-8 text-primary" aria-hidden="true" />
            <p className="text-base font-semibold">
              {pick(l, { sl: "Si prijavljen.", en: "You are signed in." })}
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
          <Card className="mt-6 border-amber-300/70 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
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

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LogIn className="size-5 text-primary" aria-hidden="true" />
                {pick(l, { sl: "Prijava z geslom", en: "Sign in with a password" })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin">
                <TabsList className="mb-4">
                  <TabsTrigger value="signin" className="gap-1.5">
                    <LogIn className="size-3.5" aria-hidden="true" />
                    {pick(l, L.signInTab)}
                  </TabsTrigger>
                  <TabsTrigger value="register" className="gap-1.5">
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
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        {pick(l, {
                          sl: "Geslo se shrani izključno kot scrypt-hash (sol + izpeljek) — niti mi ga ne vidimo.",
                          en: "The password is stored only as a scrypt hash (salt + digest) — not even we can see it.",
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
      <Card className="mt-6">
        <CardContent className="flex items-start gap-3 p-5">
          <HardDrive className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">
              {pick(l, { sl: "Zbirka „Moja pot“ ostaja lokalna", en: "The “My trip” collection stays local" })}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {pick(l, {
                sl: "Zbirka „Moja pot“ deluje brez računa (localStorage) kot prej. Račun odklene poti v oblaku: sodelovanje, ankete, rezervacije in klepet z @AI.",
                en: "The “My trip” collection works without an account (localStorage) as before. An account unlocks cloud trips: collaboration, polls, reservations and the @AI chat.",
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
      <Card className="mt-6">
        <CardContent className="flex items-start justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold">{pick(l, L.providersTitle)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{pick(l, L.providersBody)}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="min-h-11 shrink-0 font-semibold">
            <Link href="/owner/prijava">{pick(l, L.providersCta)}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
