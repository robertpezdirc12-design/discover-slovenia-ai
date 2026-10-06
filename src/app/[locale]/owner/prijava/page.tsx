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
    back: { sl: "← Nazaj na spletno stran", en: "← Back to the website" },
    title: { sl: "Portal za lastnike lokalov", en: "Venue owner portal" },
    lead: {
      sl: "Upravljajte svoje lokale, spremljajte statistiko in bodite vidni obiskovalcem, ki načrtujejo potovanje z AI.",
      en: "Manage your venues, track statistics and be visible to travellers planning trips with AI.",
    },
    loginTab: { sl: "Prijava", en: "Sign in" },
    registerTab: { sl: "Registracija", en: "Register" },
    loginTitle: { sl: "Prijava v portal", en: "Sign in to the portal" },
    loginLead: { sl: "Vnesite svoje podatke za dostop do portala.", en: "Enter your credentials to access the portal." },
    registerTitle: { sl: "Registracija računa", en: "Create an account" },
    registerLead: {
      sl: "Ustvarite račun za upravljanje svojih lokalov.",
      en: "Create an account to manage your venues.",
    },
    email: { sl: "E-pošta", en: "Email" },
    password: { sl: "Geslo", en: "Password" },
    submitLogin: { sl: "Prijava", en: "Sign in" },
    submitRegister: { sl: "Ustvari račun", en: "Create account" },
    forgot: { sl: "Pozabljeno geslo?", en: "Forgot password?" },
    privacy: {
      sl: "Vaši podatki so zaščiteni in se uporabljajo izključno za portal.",
      en: "Your data is protected and used exclusively for the portal.",
    },
    demoTitle: { sl: "Prikaz, ne prijava", en: "A display, not a sign-in" },
    demoBody: {
      sl: "Ta obrazec je zvesta rekonstrukcija produkcije. Avtentikacija (gesla, seje) v tej fazi še ni priključena — klik gumba ti bo iskreno povedal isto. Za sodelovanje z nami uporabite prijavnico na strani za ponudnike.",
      en: "This form is a faithful production reconstruction. Authentication (passwords, sessions) is not connected in this phase — the button will honestly tell you the same. To work with us, use the application form on the providers page.",
    },
    demoOk: { sl: "Rekonstrukcija: prijava bi tukaj zagnala sejo.", en: "Reconstruction: sign-in would start a session here." },
    providersCta: { sl: "Prijavnica za ponudnike", en: "Provider application form" },
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
          <Button asChild variant="outline" size="sm" className="mt-4 font-semibold">
            <Link href="/za-ponudnike">{pick(l, L.providersCta)}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
