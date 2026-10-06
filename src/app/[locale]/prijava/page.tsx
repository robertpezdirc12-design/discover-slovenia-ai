"use client";

import { ArrowRight, CheckCircle2, HardDrive, Mail, Send, ShieldCheck } from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

/**
 * /prijava — račun popotnika (1:1 naslov/opis produkcije).
 *
 * Rekonstrukcija pošteno: polna avtentikacija (geslo, seje) še ni del
 * sandboxa — namesto nje deluje FUNKCIONALNA prijava z e-pošto prek
 * obstoječega /api/newsletter/subscribe (NewsletterSubscriber, idempotentno).
 * Načrti ostanejo shranjeni lokalno na napravi (Moja potovanja).
 */
export default function PrijavaPage() {
  const l = useLocale();
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [already, setAlready] = React.useState(false);

  const L = {
    title: { sl: "Račun popotnika", en: "Traveller account" },
    lead: {
      sl: "Shranjujte načrte potovanj, dostopajte do zgodovine AI konzultacij in nadaljujte, kjer ste ostali.",
      en: "Save travel plans, access your AI consultation history and continue where you left off.",
    },
    privacy: {
      sl: "Vaši podatki so zaščiteni in se uporabljajo izključno za ta portal.",
      en: "Your data is protected and used exclusively for this portal.",
    },
    formTitle: { sl: "Prijava z e-pošto", en: "Sign in with email" },
    formLead: {
      sl: "Vnesi e-poštni naslov — prijava deluje takoj (shranimo jo v tabelo naročnikov; dvojnikov ne ustvarimo).",
      en: "Enter your email address — the sign-in works instantly (stored in the subscribers table; no duplicates).",
    },
    emailLabel: { sl: "E-poštni naslov", en: "Email address" },
    submit: { sl: "Prijavi me", en: "Sign me in" },
    sending: { sl: "Prijavljanje …", en: "Signing in …" },
    doneTitle: { sl: "Prijava sprejeta!", en: "Sign-in accepted!" },
    doneBody: {
      sl: (a: boolean) =>
        a
          ? "Ta naslov je že prijavljen — nisi dvojnik, vse je v redu."
          : "Naslov smo zabeležili. Obvestila o računu in načrtovanju ti pošiljamo na ta naslov.",
    },
    errTitle: { sl: "Prijava ni uspela", en: "Sign-in failed" },
    errBody: { sl: "Preveri e-poštni naslov ali poskusi kasneje.", en: "Check the email address or try again later." },
    localTitle: { sl: "Načrti ostajajo na tvoji napravi", en: "Plans stay on your device" },
    localBody: {
      sl: "V tej rekonstrukciji so shranjeni načrti in zbirka „Moja pot“ shranjeni lokalno (localStorage) — delujejo brez računa in brez prijave, kot v izvirniku pred prijavo.",
      en: "In this reconstruction, saved plans and the “My trip” collection live in localStorage — they work without an account and without signing in, as in the original before sign-in.",
    },
    myTripsCta: { sl: "Odpri Moja potovanja", en: "Open My trips" },
    statusTitle: { sl: "Stanje rekonstrukcije", en: "Reconstruction status" },
    statusBody: {
      sl: "Polna avtentikacija (geslo, seje, sinhronizacija med napravami) je del kasnejše faze. Ta stran je poštena rekonstrukcija: e-poštna prijava res deluje, geslo (še) ne obstaja in noben podatek ni izmišljen.",
      en: "Full authentication (password, sessions, cross-device sync) belongs to a later phase. This page is an honest reconstruction: the email sign-in really works, a password does not (yet) exist and no data is invented.",
    },
    newsletterNote: {
      sl: "Z e-poštno prijavo se strinjaš, da ti lahko pošiljamo obvestila o platformi (odjava možna kadarkoli).",
      en: "By signing in with email you agree that we may send you platform updates (unsubscribe anytime).",
    },
    providersTitle: { sl: "Si ponudnik?", en: "Are you a provider?" },
    providersBody: {
      sl: "Lastniki lokalov imajo svoj portal — prijava za partnerje.",
      en: "Venue owners have their own portal — partner sign-in.",
    },
    providersCta: { sl: "Portal za lastnike", en: "Owner portal" },
  } as const;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    try {
      setSending(true);
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; already?: boolean; error?: string }
        | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setAlready(Boolean(body.already));
      setDone(true);
      toast({ title: pick(l, L.doneTitle), description: pick(l, L.doneBody)(Boolean(body.already)) });
      setEmail("");
    } catch (err) {
      toast({
        title: pick(l, L.errTitle),
        description: err instanceof Error ? err.message : pick(l, L.errBody),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={pick(l, L.title)} lead={pick(l, L.lead)}>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          {pick(l, L.privacy)}
        </p>
      </PageHeader>

      {/* Funkcionalna prijava z e-pošto */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="size-5 text-primary" aria-hidden="true" />
            {pick(l, L.formTitle)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
            {pick(l, L.formLead)}
          </p>
          {done ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
              <CheckCircle2 className="mx-auto size-6 text-primary" aria-hidden="true" />
              <p className="mt-2 text-base font-semibold">{pick(l, L.doneTitle)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{pick(l, L.doneBody)(already)}</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
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
              <Button type="submit" disabled={sending} className="tap-target font-semibold">
                {sending ? (
                  pick(l, L.sending)
                ) : (
                  <>
                    <Send className="size-4" aria-hidden="true" />
                    {pick(l, L.submit)}
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">{pick(l, L.newsletterNote)}</p>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Načrti ostanejo lokalni */}
      <Card className="mt-6">
        <CardContent className="flex items-start gap-3 p-5">
          <HardDrive className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{pick(l, L.localTitle)}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {pick(l, L.localBody)}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3 font-semibold">
              <Link href="/moja-potovanja">
                {pick(l, L.myTripsCta)}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Iskreno stanje */}
      <Card className="mt-6 border-primary/25 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-primary">
            {pick(l, L.statusTitle)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          {pick(l, L.statusBody)}
        </CardContent>
      </Card>

      {/* Ponudniki */}
      <Card className="mt-6">
        <CardContent className="flex items-start justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold">{pick(l, L.providersTitle)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{pick(l, L.providersBody)}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 font-semibold">
            <Link href="/owner/prijava">{pick(l, L.providersCta)}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
