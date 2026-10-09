"use client";

import { useLocale } from "next-intl";

import { LegalPage, type LegalSection } from "@/components/layout/legal-page";
import { pick } from "@/lib/i18n-pick";

/** Besedilo 1:1 iz produkcije (production-mirror/politika-zasebnosti, 2025). */
const SL: LegalSection[] = [
  {
    id: "splosno",
    heading: "Splošno",
    paragraphs: [
      "Discover Slovenia AI („platforma“) spoštuje vašo zasebnost. Ta politika opisuje, katere podatke zbiramo, kako jih uporabljamo in katere pravice imate.",
    ],
  },
  {
    id: "obiskovalci",
    heading: "Podatki obiskovalcev",
    paragraphs: [
      "Ne zbiramo osebnih podatkov obiskovalcev brez izrecne privolitve. Spremljamo samo anonimne analitične podatke (ogledi strani, kliki) za izboljšanje platforme.",
    ],
  },
  {
    id: "newsletter",
    heading: "Newsletter",
    paragraphs: [
      "Če se prijavite na newsletter, shranimo vaš e-poštni naslov. Uporabimo ga izključno za pošiljanje turističnih vodnikov in nasvetov. Kadarkoli se lahko odjavite.",
    ],
  },
  {
    id: "ponudniki",
    heading: "Ponudniki (B2B)",
    paragraphs: [
      "Registrirani ponudniki zagotovijo: ime, e-pošto, ime podjetja in geslo. Gesla so shranjena z bcrypt zgoščevanjem (12 rund). Poslovni podatki (naslov, telefon, spletna stran) so javno prikazani na platformi.",
    ],
  },
  {
    id: "leadi",
    heading: "Leadi (obrazec Pridruži se)",
    paragraphs: [
      "Ko izpolnite obrazec „Pridruži se“, shranimo: ime, e-pošto, telefon, ime podjetja, tip, kraj in želen paket. Te podatke uporabimo izključno za kontaktiranje v zvezi z vašo prijavo.",
    ],
  },
  {
    id: "piskotki",
    heading: "Piškotki",
    paragraphs: [
      "Platforma uporablja nujno potrebne piškotke za delovanje (avtentikacija, jezikovne nastavitve). Ne uporabljamo marketinških ali sledilnih piškotkov.",
    ],
  },
  {
    id: "placila",
    heading: "Plačila (Stripe)",
    paragraphs: [
      "Plačila se obdelujejo prek Stripe. Ne shranjujemo podatkov o kreditnih karticah. Stripe je PCI-DSS certificiran.",
    ],
  },
  {
    id: "pravice",
    heading: "Vaše pravice",
    paragraphs: [
      "V skladu s GDPR imate pravico do: vpogleda, popravka, izbrisa in prenosa svojih podatkov. Pravice uveljavljate prek obrazca na kontaktni strani.",
    ],
    links: [{ href: "/kontakt", label: "Kontakt" }],
  },
  {
    id: "kontakt",
    heading: "Kontakt",
    paragraphs: [
      "Za vprašanja o zasebnosti pišite prek obrazca na kontaktni strani. Sporočila obrazca (ime, e-pošta, besedilo) obdelujemo izključno za odgovor vam in jih hranimo največ 12 mesecev.",
    ],
    links: [{ href: "/kontakt", label: "Kontakt" }],
  },
];

const EN: LegalSection[] = [
  {
    id: "general",
    heading: "General",
    paragraphs: [
      "Discover Slovenia AI (the “platform”) respects your privacy. This policy describes what data we collect, how we use it and what rights you have.",
    ],
  },
  {
    id: "visitors",
    heading: "Visitor data",
    paragraphs: [
      "We do not collect personal data from visitors without explicit consent. We track only anonymous analytics (page views, clicks) to improve the platform.",
    ],
  },
  {
    id: "newsletter",
    heading: "Newsletter",
    paragraphs: [
      "If you subscribe to the newsletter, we store your email address. We use it exclusively to send travel guides and tips. You can unsubscribe at any time.",
    ],
  },
  {
    id: "providers",
    heading: "Providers (B2B)",
    paragraphs: [
      "Registered providers supply: name, email, company name and password. Passwords are stored with bcrypt hashing (12 rounds). Business data (address, phone, website) is publicly displayed on the platform.",
    ],
  },
  {
    id: "leads",
    heading: "Leads (Join us form)",
    paragraphs: [
      "When you fill in the “Join us” form, we store: name, email, phone, company name, type, town and desired package. We use this data solely to contact you about your application.",
    ],
  },
  {
    id: "cookies",
    heading: "Cookies",
    paragraphs: [
      "The platform uses strictly necessary cookies for operation (authentication, language settings). We do not use marketing or tracking cookies.",
    ],
  },
  {
    id: "payments",
    heading: "Payments (Stripe)",
    paragraphs: [
      "Payments are processed via Stripe. We do not store credit card data. Stripe is PCI-DSS certified.",
    ],
  },
  {
    id: "rights",
    heading: "Your rights",
    paragraphs: [
      "Under the GDPR you have the right to access, rectification, erasure and portability of your data. You can exercise your rights via the contact form.",
    ],
    links: [{ href: "/kontakt", label: "Contact" }],
  },
  {
    id: "contact",
    heading: "Contact",
    paragraphs: [
      "For privacy questions, write via the contact form. Form messages (name, email, text) are processed solely to reply to you and are kept for at most 12 months.",
    ],
    links: [{ href: "/kontakt", label: "Contact" }],
  },
];

const IT: LegalSection[] = [
  {
    id: "general",
    heading: "Generalità",
    paragraphs: [
      "Discover Slovenia AI (la «piattaforma») rispetta la tua privacy. Questa politica descrive quali dati raccogliamo, come li utilizziamo e quali diritti hai.",
    ],
  },
  {
    id: "visitors",
    heading: "Dati dei visitatori",
    paragraphs: [
      "Non raccogliamo dati personali dei visitatori senza consenso esplicito. Monitoriamo solo analisi anonime (visualizzazioni di pagina, clic) per migliorare la piattaforma.",
    ],
  },
  {
    id: "newsletter",
    heading: "Newsletter",
    paragraphs: [
      "Se ti iscrivi alla newsletter, conserviamo il tuo indirizzo e-mail. Lo utilizziamo esclusivamente per l'invio di guide turistiche e consigli. Puoi disiscriverti in qualsiasi momento.",
    ],
  },
  {
    id: "providers",
    heading: "Fornitori (B2B)",
    paragraphs: [
      "I fornitori registrati forniscono: nome, e-mail, nome dell'azienda e password. Le password sono conservate con hash bcrypt (12 round). I dati aziendali (indirizzo, telefono, sito web) sono mostrati pubblicamente sulla piattaforma.",
    ],
  },
  {
    id: "leads",
    heading: "Lead (modulo «Unisciti»)",
    paragraphs: [
      "Quando compili il modulo «Unisciti», conserviamo: nome, e-mail, telefono, nome dell'azienda, tipo, località e pacchetto desiderato. Utilizziamo questi dati esclusivamente per contattarti in merito alla tua candidatura.",
    ],
  },
  {
    id: "cookies",
    heading: "Cookie",
    paragraphs: [
      "La piattaforma utilizza cookie strettamente necessari al funzionamento (autenticazione, impostazioni linguistiche). Non utilizziamo cookie di marketing o di tracciamento.",
    ],
  },
  {
    id: "payments",
    heading: "Pagamenti (Stripe)",
    paragraphs: [
      "I pagamenti sono elaborati tramite Stripe. Non conserviamo dati delle carte di credito. Stripe è certificato PCI-DSS.",
    ],
  },
  {
    id: "rights",
    heading: "I tuoi diritti",
    paragraphs: [
      "Ai sensi del GDPR hai diritto di: accesso, rettifica, cancellazione e portabilità dei tuoi dati. I diritti si esercitano tramite il modulo sulla pagina dei contatti.",
    ],
    links: [{ href: "/kontakt", label: "Contatto" }],
  },
  {
    id: "contact",
    heading: "Contatto",
    paragraphs: [
      "Per domande sulla privacy scrivi tramite il modulo sulla pagina dei contatti. I messaggi del modulo (nome, e-mail, testo) sono trattati esclusivamente per risponderti e conservati al massimo 12 mesi.",
    ],
    links: [{ href: "/kontakt", label: "Contatto" }],
  },
];

const DE: LegalSection[] = [
  {
    id: "general",
    heading: "Allgemeines",
    paragraphs: [
      "Discover Slovenia AI (die „Plattform“) respektiert Ihre Privatsphäre. Diese Richtlinie beschreibt, welche Daten wir erheben, wie wir sie verwenden und welche Rechte Sie haben.",
    ],
  },
  {
    id: "visitors",
    heading: "Besucherdaten",
    paragraphs: [
      "Wir erheben keine personenbezogenen Daten von Besuchern ohne ausdrückliche Einwilligung. Wir erfassen nur anonyme Analysen (Seitenaufrufe, Klicks), um die Plattform zu verbessern.",
    ],
  },
  {
    id: "newsletter",
    heading: "Newsletter",
    paragraphs: [
      "Wenn Sie den Newsletter abonnieren, speichern wir Ihre E-Mail-Adresse. Wir verwenden sie ausschließlich zum Versand von Reiseführern und Tipps. Sie können sich jederzeit abmelden.",
    ],
  },
  {
    id: "providers",
    heading: "Anbieter (B2B)",
    paragraphs: [
      "Registrierte Anbieter geben an: Name, E-Mail, Firmenname und Passwort. Passwörter werden mit bcrypt-Hashing (12 Runden) gespeichert. Geschäftsdaten (Adresse, Telefon, Website) werden öffentlich auf der Plattform angezeigt.",
    ],
  },
  {
    id: "leads",
    heading: "Leads („Mach mit“-Formular)",
    paragraphs: [
      "Wenn Sie das „Mach mit“-Formular ausfüllen, speichern wir: Name, E-Mail, Telefon, Firmenname, Typ, Ort und gewünschtes Paket. Wir verwenden diese Daten ausschließlich, um Sie zu Ihrer Bewerbung zu kontaktieren.",
    ],
  },
  {
    id: "cookies",
    heading: "Cookies",
    paragraphs: [
      "Die Plattform verwendet ausschließlich für den Betrieb notwendige Cookies (Authentifizierung, Spracheinstellungen). Wir verwenden keine Marketing- oder Tracking-Cookies.",
    ],
  },
  {
    id: "payments",
    heading: "Zahlungen (Stripe)",
    paragraphs: [
      "Zahlungen werden über Stripe abgewickelt. Wir speichern keine Kreditkartendaten. Stripe ist PCI-DSS-zertifiziert.",
    ],
  },
  {
    id: "rights",
    heading: "Ihre Rechte",
    paragraphs: [
      "Nach der DSGVO haben Sie das Recht auf: Auskunft, Berichtigung, Löschung und Übertragbarkeit Ihrer Daten. Die Rechte können Sie über das Formular auf der Kontaktseite ausüben.",
    ],
    links: [{ href: "/kontakt", label: "Kontakt" }],
  },
  {
    id: "contact",
    heading: "Kontakt",
    paragraphs: [
      "Fragen zum Datenschutz können Sie über das Formular auf der Kontaktseite stellen. Formularnachrichten (Name, E-Mail, Text) werden ausschließlich zur Beantwortung verarbeitet und höchstens 12 Monate aufbewahrt.",
    ],
    links: [{ href: "/kontakt", label: "Kontakt" }],
  },
];

const FR: LegalSection[] = [
  {
    id: "general",
    heading: "Généralités",
    paragraphs: [
      "Discover Slovenia AI (la « plateforme ») respecte votre vie privée. Cette politique décrit les données que nous collectons, la manière dont nous les utilisons et les droits dont vous disposez.",
    ],
  },
  {
    id: "visitors",
    heading: "Données des visiteurs",
    paragraphs: [
      "Nous ne collectons pas de données personnelles des visiteurs sans consentement explicite. Nous suivons uniquement des statistiques anonymes (pages vues, clics) pour améliorer la plateforme.",
    ],
  },
  {
    id: "newsletter",
    heading: "Newsletter",
    paragraphs: [
      "Si vous vous inscrivez à la newsletter, nous conservons votre adresse e-mail. Nous l'utilisons exclusivement pour envoyer des guides et des conseils de voyage. Vous pouvez vous désinscrire à tout moment.",
    ],
  },
  {
    id: "providers",
    heading: "Prestataires (B2B)",
    paragraphs: [
      "Les prestataires enregistrés fournissent : nom, e-mail, nom de l'entreprise et mot de passe. Les mots de passe sont stockés avec un hachage bcrypt (12 tours). Les données professionnelles (adresse, téléphone, site web) sont affichées publiquement sur la plateforme.",
    ],
  },
  {
    id: "leads",
    heading: "Leads (formulaire « Rejoignez-nous »)",
    paragraphs: [
      "Lorsque vous remplissez le formulaire « Rejoignez-nous », nous conservons : nom, e-mail, téléphone, nom de l'entreprise, type, ville et offre souhaitée. Nous utilisons ces données uniquement pour vous contacter au sujet de votre candidature.",
    ],
  },
  {
    id: "cookies",
    heading: "Cookies",
    paragraphs: [
      "La plateforme utilise des cookies strictement nécessaires à son fonctionnement (authentification, paramètres de langue). Nous n'utilisons pas de cookies publicitaires ou de suivi.",
    ],
  },
  {
    id: "payments",
    heading: "Paiements (Stripe)",
    paragraphs: [
      "Les paiements sont traités via Stripe. Nous ne stockons aucune donnée de carte bancaire. Stripe est certifié PCI-DSS.",
    ],
  },
  {
    id: "rights",
    heading: "Vos droits",
    paragraphs: [
      "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données. Vous pouvez exercer vos droits via le formulaire de la page contact.",
    ],
    links: [{ href: "/kontakt", label: "Contact" }],
  },
  {
    id: "contact",
    heading: "Contact",
    paragraphs: [
      "Pour toute question relative à la vie privée, écrivez-nous via le formulaire de la page contact. Les messages du formulaire (nom, e-mail, texte) sont traités uniquement pour vous répondre et conservés au maximum 12 mois.",
    ],
    links: [{ href: "/kontakt", label: "Contact" }],
  },
];

const ES: LegalSection[] = [
  {
    id: "general",
    heading: "General",
    paragraphs: [
      "Discover Slovenia AI (la «plataforma») respeta su privacidad. Esta política describe qué datos recogemos, cómo los utilizamos y qué derechos tiene.",
    ],
  },
  {
    id: "visitors",
    heading: "Datos de los visitantes",
    paragraphs: [
      "No recogemos datos personales de los visitantes sin consentimiento expreso. Solo realizamos analíticas anónimas (páginas vistas, clics) para mejorar la plataforma.",
    ],
  },
  {
    id: "newsletter",
    heading: "Newsletter",
    paragraphs: [
      "Si se suscribe a la newsletter, guardamos su dirección de correo electrónico. La usamos exclusivamente para enviar guías y consejos de viaje. Puede darse de baja en cualquier momento.",
    ],
  },
  {
    id: "providers",
    heading: "Proveedores (B2B)",
    paragraphs: [
      "Los proveedores registrados facilitan: nombre, correo electrónico, nombre de la empresa y contraseña. Las contraseñas se guardan con hash bcrypt (12 rondas). Los datos comerciales (dirección, teléfono, sitio web) se muestran públicamente en la plataforma.",
    ],
  },
  {
    id: "leads",
    heading: "Leads (formulario «Únete»)",
    paragraphs: [
      "Cuando rellena el formulario «Únete», guardamos: nombre, correo electrónico, teléfono, nombre de la empresa, tipo, ciudad y paquete deseado. Usamos estos datos únicamente para contactarle en relación con su solicitud.",
    ],
  },
  {
    id: "cookies",
    heading: "Cookies",
    paragraphs: [
      "La plataforma utiliza cookies estrictamente necesarias para funcionar (autenticación, preferencias de idioma). No usamos cookies de marketing ni de seguimiento.",
    ],
  },
  {
    id: "payments",
    heading: "Pagos (Stripe)",
    paragraphs: [
      "Los pagos se procesan a través de Stripe. No almacenamos datos de tarjetas de crédito. Stripe está certificado según PCI-DSS.",
    ],
  },
  {
    id: "rights",
    heading: "Sus derechos",
    paragraphs: [
      "Con arreglo al RGPD, tiene derecho al acceso, rectificación, supresión y portabilidad de sus datos. Puede ejercer sus derechos mediante el formulario de la página de contacto.",
    ],
    links: [{ href: "/kontakt", label: "Contacto" }],
  },
  {
    id: "contact",
    heading: "Contacto",
    paragraphs: [
      "Para preguntas sobre privacidad, escríbanos mediante el formulario de la página de contacto. Los mensajes del formulario (nombre, correo electrónico, texto) se tratan únicamente para responderle y se conservan como máximo 12 meses.",
    ],
    links: [{ href: "/kontakt", label: "Contacto" }],
  },
];

const SECTIONS: Record<string, LegalSection[]> = {
  sl: SL,
  en: EN,
  it: IT,
  de: DE,
  fr: FR,
  es: ES,
};

export default function PrivacyPage() {
  const l = useLocale();
  return (
    <LegalPage
      title={pick(l, { sl: "Politika zasebnosti", en: "Privacy policy", it: "Politica sulla privacy", de: "Datenschutzerklärung", fr: "Politique de confidentialité", es: "Política de privacidad" })}
      updated="2025"
      sections={SECTIONS[l] ?? SL}
    />
  );
}
