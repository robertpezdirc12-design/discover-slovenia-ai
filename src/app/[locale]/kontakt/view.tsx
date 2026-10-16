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
    title: { sl: "Kontakt", en: "Contact", it: "Contatti", de: "Kontakt", fr: "Contact", es: "Contacto" },
    lead: {
      sl: "Imaš vprašanja o platformi, sodelovanju ali tehničnih zadevah? Piši nam.",
      en: "Questions about the platform, cooperation or technical matters? Write to us.",
      it: "Hai domande sulla piattaforma, sulla collaborazione o su questioni tecniche? Scrivici.",
      de: "Fragen zur Plattform, zur Zusammenarbeit oder zu technischen Angelegenheiten? Schreib uns.",
      fr: "Des questions sur la plateforme, la coopération ou des aspects techniques ? Écris-nous.",
      es: "¿Tienes preguntas sobre la plataforma, la colaboración o temas técnicos? Escríbenos.",
    },
    formTitle: { sl: "Pošlji sporočilo", en: "Send a message", it: "Invia un messaggio", de: "Nachricht senden", fr: "Envoyer un message", es: "Enviar un mensaje" },
    formLead: {
      sl: "Obrazec deluje tudi brez e-poštnega strežnika — sporočilo se shrani, odgovorimo ti na e-pošto, ki jo pustiš.",
      en: "The form works even without a mail server — the message is stored and we reply to the email you provide.",
      it: "Il modulo funziona anche senza server di posta — il messaggio viene salvato e rispondiamo all’e-mail che lasci.",
      de: "Das Formular funktioniert auch ohne Mailserver — die Nachricht wird gespeichert und wir antworten auf die hinterlassene E-Mail.",
      fr: "Le formulaire fonctionne même sans serveur de messagerie — le message est enregistré et nous répondons à l’e-mail que tu laisses.",
      es: "El formulario funciona incluso sin servidor de correo — el mensaje se guarda y respondemos al correo que dejes.",
    },
    nameLabel: { sl: "Ime", en: "Name", it: "Nome", de: "Name", fr: "Nom", es: "Nombre" },
    emailLabel: { sl: "E-pošta", en: "Email", it: "E-mail", de: "E-Mail", fr: "E-mail", es: "Correo" },
    messageLabel: { sl: "Sporočilo", en: "Message", it: "Messaggio", de: "Nachricht", fr: "Message", es: "Mensaje" },
    messageHint: { sl: "Vsaj 10 znakov.", en: "At least 10 characters.", it: "Almeno 10 caratteri.", de: "Mindestens 10 Zeichen.", fr: "Au moins 10 caractères.", es: "Al menos 10 caracteres." },
    submit: { sl: "Pošlji sporočilo", en: "Send message", it: "Invia messaggio", de: "Nachricht senden", fr: "Envoyer le message", es: "Enviar mensaje" },
    sending: { sl: "Pošiljanje …", en: "Sending …", it: "Invio …", de: "Senden …", fr: "Envoi …", es: "Enviando …" },
    sentTitle: { sl: "Sporočilo poslano!", en: "Message sent!", it: "Messaggio inviato!", de: "Nachricht gesendet!", fr: "Message envoyé !", es: "¡Mensaje enviado!" },
    sentBody: {
      sl: "Hvala — odgovorili ti bomo na e-pošto, ki si jo pustil.",
      en: "Thank you — we will reply to the email you provided.",
      it: "Grazie — risponderemo all’e-mail che hai lasciato.",
      de: "Danke — wir antworten auf die hinterlassene E-Mail.",
      fr: "Merci — nous répondrons à l’e-mail que tu as laissé.",
      es: "Gracias — responderemos al correo que dejaste.",
    },
    errTitle: { sl: "Pošiljanje ni uspelo", en: "Sending failed", it: "Invio non riuscito", de: "Senden fehlgeschlagen", fr: "Échec de l’envoi", es: "Error al enviar" },
    errBody: {
      sl: "Preveri izpolnjena polja ali poskusi kasneje.",
      en: "Check the fields or try again later.",
      it: "Controlla i campi oppure riprova più tardi.",
      de: "Prüfe die Felder oder versuche es später erneut.",
      fr: "Vérifie les champs ou réessaie plus tard.",
      es: "Revisa los campos o inténtalo más tarde.",
    },
    infoLocation: { sl: "Lokacija", en: "Location", it: "Luogo", de: "Standort", fr: "Lieu", es: "Ubicación" },
    infoLocationV: { sl: "Slovenija", en: "Slovenia", it: "Slovenia", de: "Slowenien", fr: "Slovénie", es: "Eslovenia" },
    infoLangs: { sl: "Jeziki", en: "Languages", it: "Lingue", de: "Sprachen", fr: "Langues", es: "Idiomas" },
    infoLangsV: { sl: "Slovenščina, English", en: "Slovenian, English", it: "Sloveno, inglese", de: "Slowenisch, Englisch", fr: "Slovène, anglais", es: "Esloveno, inglés" },
    infoSupport: { sl: "Tehnična podpora", en: "Technical support", it: "Assistenza tecnica", de: "Technischer Support", fr: "Assistance technique", es: "Soporte técnico" },
    infoSupportV: {
      sl: "Prek obrazca — e-poštni kanal se aktivira z lastno domeno.",
      en: "Via the form — the email channel activates with our own domain.",
      it: "Tramite il modulo — il canale e-mail si attiva con il dominio proprio.",
      de: "Über das Formular — der E-Mail-Kanal wird mit der eigenen Domain aktiviert.",
      fr: "Via le formulaire — le canal e-mail s’active avec notre propre domaine.",
      es: "Mediante el formulario — el canal de correo se activa con dominio propio.",
    },
    providers: { sl: "Za ponudnike", en: "For providers", it: "Per i fornitori", de: "Für Anbieter", fr: "Pour les prestataires", es: "Para proveedores" },
    providersLead: {
      sl: "Želiš postati del platforme? Poglej stran za ponudnike.",
      en: "Want to become part of the platform? See the providers page.",
      it: "Vuoi entrare a far parte della piattaforma? Guarda la pagina per i fornitori.",
      de: "Du willst Teil der Plattform werden? Sieh dir die Seite für Anbieter an.",
      fr: "Tu veux rejoindre la plateforme ? Consulte la page prestataires.",
      es: "¿Quieres formar parte de la plataforma? Mira la página para proveedores.",
    },
    providersCta: { sl: "Za ponudnike", en: "For providers", it: "Per i fornitori", de: "Für Anbieter", fr: "Pour les prestataires", es: "Para proveedores" },
    privacyNote: {
      sl: "S podatki (ime, e-pošta, sporočilo) odgovorimo izključno na tvoje povpraševanje; ne shranjujemo ničesar drugega (politika zasebnosti).",
      en: "We use the data (name, email, message) solely to answer your enquiry; nothing else is stored (privacy policy).",
      it: "Usiamo i dati (nome, e-mail, messaggio) esclusivamente per rispondere alla tua richiesta; non archiviamo altro (informativa sulla privacy).",
      de: "Wir verwenden die Daten (Name, E-Mail, Nachricht) ausschließlich zur Beantwortung deiner Anfrage; sonst wird nichts gespeichert (Datenschutzerklärung).",
      fr: "Nous utilisons les données (nom, e-mail, message) uniquement pour répondre à ta demande ; rien d’autre n’est conservé (politique de confidentialité).",
      es: "Usamos los datos (nombre, correo, mensaje) exclusivamente para responder a tu consulta; no guardamos nada más (política de privacidad).",
    },
  } as const;

  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

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
          <Card key={c.label} className="h-full rounded-2xl border-border/70 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
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

      <Card className="mt-8 rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t("formTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-5 text-sm text-muted-foreground">{t("formLead")}</p>
          {sent ? (
            <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] to-card p-5 text-center shadow-sm">
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

      <Card className="mt-6 rounded-2xl border-primary/25 bg-gradient-to-br from-primary/[0.07] to-card shadow-sm">
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
