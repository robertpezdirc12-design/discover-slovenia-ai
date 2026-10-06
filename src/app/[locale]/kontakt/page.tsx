"use client";

import { Building2, Languages, Mail, MapPin, Send } from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

/**
 * /kontakt — delujoč obrazec (POST /api/contact → ContactMessage v bazi)
 * + info kartice (1:1 po produkciji, brez izmišljenih e-poštnih naslovov).
 */
export default function ContactPage() {
  const l = useLocale();
  const { toast } = useToast();
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", message: "" });

  const L = {
    title: { sl: "Kontakt", en: "Contact" },
    lead: {
      sl: "Imaš vprašanja o platformi, sodelovanju ali tehničnih zadevah? Piši nam.",
      en: "Questions about the platform, cooperation or technical matters? Write to us.",
    },
    formTitle: { sl: "Pošlji sporočilo", en: "Send a message" },
    formLead: {
      sl: "Obrazec deluje tudi brez e-poštnega strežnika — sporočilo se shrani, odgovorimo ti na e-pošto, ki jo pustiš.",
      en: "The form works even without a mail server — the message is stored and we reply to the email you provide.",
    },
    nameLabel: { sl: "Ime", en: "Name" },
    emailLabel: { sl: "E-pošta", en: "Email" },
    messageLabel: { sl: "Sporočilo", en: "Message" },
    messageHint: { sl: "Vsaj 10 znakov.", en: "At least 10 characters." },
    submit: { sl: "Pošlji sporočilo", en: "Send message" },
    sending: { sl: "Pošiljanje …", en: "Sending …" },
    sentTitle: { sl: "Sporočilo poslano!", en: "Message sent!" },
    sentBody: {
      sl: "Hvala — odgovorili ti bomo na e-pošto, ki si jo pustil.",
      en: "Thank you — we will reply to the email you provided.",
    },
    errTitle: { sl: "Pošiljanje ni uspelo", en: "Sending failed" },
    errBody: {
      sl: "Preveri izpolnjena polja ali poskusi kasneje.",
      en: "Check the fields or try again later.",
    },
    infoLocation: { sl: "Lokacija", en: "Location" },
    infoLocationV: { sl: "Slovenija", en: "Slovenia" },
    infoLangs: { sl: "Jeziki", en: "Languages" },
    infoLangsV: { sl: "Slovenščina, English", en: "Slovenian, English" },
    infoSupport: { sl: "Tehnična podpora", en: "Technical support" },
    infoSupportV: {
      sl: "Prek obrazca — e-poštni kanal se aktivira z lastno domeno.",
      en: "Via the form — the email channel activates with our own domain.",
    },
    providers: { sl: "Za ponudnike", en: "For providers" },
    providersLead: {
      sl: "Želiš postati del platforme? Poglej stran za ponudnike.",
      en: "Want to become part of the platform? See the providers page.",
    },
    providersCta: { sl: "Za ponudnike", en: "For providers" },
    privacyNote: {
      sl: "S podatki (ime, e-pošta, sporočilo) odgovorimo izključno na tvoje povpraševanje; ne shranjujemo ničesar drugega (politika zasebnosti).",
      en: "We use the data (name, email, message) solely to answer your enquiry; nothing else is stored (privacy policy).",
    },
  } as const;

  const t = (k: keyof typeof L) => pick(l, L[k]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    try {
      setSending(true);
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      toast({ title: t("sentTitle"), description: t("sentBody") });
      setSent(true);
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      toast({
        title: t("errTitle"),
        description: err instanceof Error ? err.message : t("errBody"),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const infoCards = [
    { icon: MapPin, label: t("infoLocation"), value: t("infoLocationV") },
    { icon: Languages, label: t("infoLangs"), value: t("infoLangsV") },
    { icon: Mail, label: t("infoSupport"), value: t("infoSupportV") },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={t("title")} lead={t("lead")} />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {infoCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-start gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <c.icon className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {c.label}
                </p>
                <p className="mt-1 text-sm font-medium">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">{t("formTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-5 text-sm text-muted-foreground">{t("formLead")}</p>
          {sent ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
              <Send className="mx-auto size-6 text-primary" aria-hidden="true" />
              <p className="mt-2 text-base font-semibold">{t("sentTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("sentBody")}</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">{t("nameLabel")}</Label>
                  <Input
                    id="contact-name"
                    required
                    minLength={2}
                    maxLength={80}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">{t("emailLabel")}</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    required
                    maxLength={160}
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-message">{t("messageLabel")}</Label>
                <Textarea
                  id="contact-message"
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={6}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  aria-describedby="contact-message-hint"
                />
                <p id="contact-message-hint" className="text-xs text-muted-foreground">
                  {t("messageHint")}
                </p>
              </div>
              <Button type="submit" disabled={sending} className="tap-target font-semibold">
                {sending ? t("sending") : t("submit")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("privacyNote")}</p>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-primary/25 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-5">
          <Building2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{t("providers")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("providersLead")}</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/za-ponudnike">{t("providersCta")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
