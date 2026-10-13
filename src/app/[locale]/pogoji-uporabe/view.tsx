"use client";

import { useLocale } from "next-intl";

import { LegalPage, type LegalSection } from "@/components/layout/legal-page";
import { pick } from "@/lib/i18n-pick";

/**
 * Besedilo iz produkcije (production-mirror/pogoji-uporabe, 2025) + lektorat
 * 2.46.0 (2026-10-13, issue #38 P2): seznam affiliate partnerjev usklajen
 * s kanonom registra (src/lib/affiliate-providers.ts — dodana Kiwi.com in
 * Rentalcars.com, točna imena; Kiwitaxi izrecno kot prevozi), slike in
 * zemljevidni podatki ločeno (Unsplash ≠ OpenStreetMap, ODbL atribucija),
 * cene „€/mesec“ + glagol „obračunava“. Datum posodobljen, ker je bila
 * vsebina dejansko pregledana in popravljena (kanon #38).
 */
const SL: LegalSection[] = [
  {
    id: "sprejem",
    heading: "Sprejem pogojev",
    paragraphs: ["Z uporabo platforme Discover Slovenia AI sprejemate te pogoje uporabe."],
  },
  {
    id: "storitev",
    heading: "Storitev",
    paragraphs: [
      "Platforma ponuja informacije o slovenskih turističnih destinacijah, AI načrtovanje potovanj in povezave do lokalnih ponudnikov. Platforma ne posreduje rezervacij — uporabniki rezervirajo neposredno pri ponudnikih.",
    ],
  },
  {
    id: "itinererji",
    heading: "Itinererji",
    paragraphs: [
      "Generirani itinererji so informativne narave. Platforma ne prevzema odgovornosti za točnost cen, razpoložljivost ali kakovost storitev tretjih oseb.",
    ],
  },
  {
    id: "affiliate",
    heading: "Affiliate povezave",
    paragraphs: [
      "Platforma vsebuje partnerske (affiliate) povezave (Booking.com, GetYourGuide, Viator (Tripadvisor), Tiqets, Kiwi.com, Skyscanner, Rentalcars.com, DiscoverCars, Omio, Airalo, World Nomads, SafetyWing) ter povezave za prevoze Kiwitaxi. Če prek teh povezav opravite rezervacijo, lahko Discover Slovenia prejme partnersko provizijo. Cena za vas se zaradi tega ne poveča.",
    ],
  },
  {
    id: "ponudniki",
    heading: "Ponudniki (B2B)",
    paragraphs: [
      "Registrirani ponudniki so odgovorni za točnost svojih podatkov. Pavšalna naročnina (Premium €149/mesec, Enterprise €499/mesec) se obračunava mesečno. Odjava je možna kadarkoli s 30-dnevnim odpovednim rokom.",
    ],
  },
  {
    id: "beta",
    heading: "Beta obdobje",
    paragraphs: [
      "Med beta obdobjem (do 30 aktivnih lokalov) so vsi paketi brezplačni. Po vklopu monetizacije imajo beta uporabniki 6 mesecev brezplačnega dostopa.",
    ],
  },
  {
    id: "intelektualna",
    heading: "Intelektualna lastnina",
    paragraphs: [
      "Vsebina platforme je objavljena pod licenco MIT; spletna koda je odprtokodna. Slike destinacij so pridobljene iz odprtih virov (Unsplash). Zemljevidi in točke interesa izhajajo iz odprtih podatkov OpenStreetMap — © prispevavalci OpenStreetMap (licenca ODbL).",
    ],
  },
  {
    id: "odgovornost",
    heading: "Omejitev odgovornosti",
    paragraphs: [
      "Platforma ne prevzema odgovornosti za škodo, ki bi izhajala iz uporabe informacij ali povezav do tretjih oseb.",
    ],
  },
  {
    id: "spremembe",
    heading: "Spremembe pogojev",
    paragraphs: [
      "Pogoji se lahko posodobijo. O pomembnih spremembah bomo obvestili registrirane uporabnike po e-pošti.",
    ],
  },
  {
    id: "kontakt",
    heading: "Kontakt",
    paragraphs: [
      "Vprašanja o pogojih pošljite prek obrazca na kontaktni strani.",
    ],
    links: [{ href: "/kontakt", label: "Kontakt" }],
  },
];

const EN: LegalSection[] = [
  {
    id: "acceptance",
    heading: "Acceptance of terms",
    paragraphs: ["By using the Discover Slovenia AI platform you accept these terms of use."],
  },
  {
    id: "service",
    heading: "The service",
    paragraphs: [
      "The platform provides information about Slovenian tourist destinations, AI trip planning and links to local providers. The platform does not broker reservations — users book directly with providers.",
    ],
  },
  {
    id: "itineraries",
    heading: "Itineraries",
    paragraphs: [
      "Generated itineraries are informational. The platform is not responsible for the accuracy of prices, availability or quality of third-party services.",
    ],
  },
  {
    id: "affiliate",
    heading: "Affiliate links",
    paragraphs: [
      "The platform contains affiliate links (Booking.com, GetYourGuide, Viator (Tripadvisor), Tiqets, Kiwi.com, Skyscanner, Rentalcars.com, DiscoverCars, Omio, Airalo, World Nomads, SafetyWing) as well as Kiwitaxi transfer links. If you book through these links, Discover Slovenia may receive a partner commission. Your price does not increase because of this.",
    ],
  },
  {
    id: "providers",
    heading: "Providers (B2B)",
    paragraphs: [
      "Registered providers are responsible for the accuracy of their data. Flat subscriptions (Premium €149/mo, Enterprise €499/mo) are billed monthly. Cancellation is possible at any time with a 30-day notice period.",
    ],
  },
  {
    id: "beta",
    heading: "Beta period",
    paragraphs: [
      "During the beta period (up to 30 active local spots) all packages are free. Once monetization is switched on, beta users get 6 months of free access.",
    ],
  },
  {
    id: "ip",
    heading: "Intellectual property",
    paragraphs: [
      "Platform content is published under the MIT licence and the web code is open source. Destination images come from open sources (Unsplash). Maps and points of interest use open data from OpenStreetMap — © OpenStreetMap contributors (ODbL licence).",
    ],
  },
  {
    id: "liability",
    heading: "Limitation of liability",
    paragraphs: [
      "The platform is not liable for damages arising from the use of information or links to third parties.",
    ],
  },
  {
    id: "changes",
    heading: "Changes to the terms",
    paragraphs: [
      "The terms may be updated. We will notify registered users about important changes by email.",
    ],
  },
  {
    id: "contact",
    heading: "Contact",
    paragraphs: ["Questions about the terms can be sent via the contact form."],
    links: [{ href: "/kontakt", label: "Contact" }],
  },
];

const IT: LegalSection[] = [
  {
    id: "acceptance",
    heading: "Accettazione delle condizioni",
    paragraphs: [
      "Utilizzando la piattaforma Discover Slovenia AI accetti le presenti condizioni d'uso.",
    ],
  },
  {
    id: "service",
    heading: "Il servizio",
    paragraphs: [
      "La piattaforma offre informazioni sulle destinazioni turistiche slovene, pianificazione di viaggio con IA e collegamenti ai fornitori locali. La piattaforma non intermedia prenotazioni — gli utenti prenotano direttamente presso i fornitori.",
    ],
  },
  {
    id: "itineraries",
    heading: "Itinerari",
    paragraphs: [
      "Gli itinerari generati hanno finalità informativa. La piattaforma non si assume alcuna responsabilità per l'accuratezza di prezzi, disponibilità o qualità dei servizi di terze parti.",
    ],
  },
  {
    id: "affiliate",
    heading: "Link di affiliazione",
    paragraphs: [
      "La piattaforma contiene link di affiliazione (Booking.com, GetYourGuide, Viator (Tripadvisor), Tiqets, Kiwi.com, Skyscanner, Rentalcars.com, DiscoverCars, Omio, Airalo, World Nomads, SafetyWing) oltre ai link per i trasferimenti Kiwitaxi. Se prenoti tramite questi link, Discover Slovenia può ricevere una provvigione partner. Per te il prezzo non aumenta.",
    ],
  },
  {
    id: "providers",
    heading: "Fornitori (B2B)",
    paragraphs: [
      "I fornitori registrati sono responsabili dell'accuratezza dei propri dati. Gli abbonamenti a tariffa fissa (Premium €149/mese, Enterprise €499/mese) vengono fatturati mensilmente. La disdetta è possibile in qualsiasi momento con un preavviso di 30 giorni.",
    ],
  },
  {
    id: "beta",
    heading: "Periodo beta",
    paragraphs: [
      "Durante il periodo beta (fino a 30 locali attivi) tutti i pacchetti sono gratuiti. All'attivazione della monetizzazione gli utenti beta ricevono 6 mesi di accesso gratuito.",
    ],
  },
  {
    id: "ip",
    heading: "Proprietà intellettuale",
    paragraphs: [
      "I contenuti della piattaforma sono pubblicati con licenza MIT e il codice web è open source. Le immagini delle destinazioni provengono da fonti aperte (Unsplash). Le mappe e i punti di interesse utilizzano dati aperti di OpenStreetMap — © contributori OpenStreetMap (licenza ODbL).",
    ],
  },
  {
    id: "liability",
    heading: "Limitazione di responsabilità",
    paragraphs: [
      "La piattaforma non risponde di danni derivanti dall'uso delle informazioni o dei collegamenti a terze parti.",
    ],
  },
  {
    id: "changes",
    heading: "Modifiche alle condizioni",
    paragraphs: [
      "Le condizioni possono essere aggiornate. Informeremo gli utenti registrati delle modifiche importanti via e-mail.",
    ],
  },
  {
    id: "contact",
    heading: "Contatto",
    paragraphs: [
      "Le domande sulle condizioni possono essere inviate tramite il modulo sulla pagina dei contatti.",
    ],
    links: [{ href: "/kontakt", label: "Contatto" }],
  },
];

const DE: LegalSection[] = [
  {
    id: "acceptance",
    heading: "Annahme der Bedingungen",
    paragraphs: [
      "Mit der Nutzung der Plattform Discover Slovenia AI akzeptieren Sie diese Nutzungsbedingungen.",
    ],
  },
  {
    id: "service",
    heading: "Der Service",
    paragraphs: [
      "Die Plattform bietet Informationen zu slowenischen Reisezielen, KI-Reiseplanung und Links zu lokalen Anbietern. Die Plattform vermittelt keine Buchungen — Nutzer buchen direkt bei den Anbietern.",
    ],
  },
  {
    id: "itineraries",
    heading: "Reiserouten",
    paragraphs: [
      "Generierte Reiserouten dienen der Information. Die Plattform übernimmt keine Verantwortung für die Richtigkeit von Preisen, Verfügbarkeit oder Qualität von Dienstleistungen Dritter.",
    ],
  },
  {
    id: "affiliate",
    heading: "Affiliate-Links",
    paragraphs: [
      "Die Plattform enthält Affiliate-Links (Booking.com, GetYourGuide, Viator (Tripadvisor), Tiqets, Kiwi.com, Skyscanner, Rentalcars.com, DiscoverCars, Omio, Airalo, World Nomads, SafetyWing) sowie Kiwitaxi-Transferlinks. Wenn Sie über diese Links buchen, kann Discover Slovenia eine Partnerprovision erhalten. Für Sie wird der Preis dadurch nicht höher.",
    ],
  },
  {
    id: "providers",
    heading: "Anbieter (B2B)",
    paragraphs: [
      "Registrierte Anbieter sind für die Richtigkeit ihrer Daten verantwortlich. Pauschalabonnements (Premium €149/Monat, Enterprise €499/Monat) werden monatlich abgerechnet. Eine Kündigung ist jederzeit mit einer Frist von 30 Tagen möglich.",
    ],
  },
  {
    id: "beta",
    heading: "Beta-Phase",
    paragraphs: [
      "Während der Beta-Phase (bis zu 30 aktive Lokale) sind alle Pakete kostenlos. Nach Aktivierung der Monetarisierung erhalten Beta-Nutzer 6 Monate kostenlosen Zugang.",
    ],
  },
  {
    id: "ip",
    heading: "Geistiges Eigentum",
    paragraphs: [
      "Die Inhalte der Plattform stehen unter der MIT-Lizenz, der Web-Code ist Open Source. Bilder der Reiseziele stammen aus offenen Quellen (Unsplash). Karten und Points of Interest nutzen offene Daten von OpenStreetMap — © OpenStreetMap-Mitwirkende (ODbL-Lizenz).",
    ],
  },
  {
    id: "liability",
    heading: "Haftungsbeschränkung",
    paragraphs: [
      "Die Plattform haftet nicht für Schäden, die aus der Nutzung von Informationen oder Links zu Drittanbietern entstehen.",
    ],
  },
  {
    id: "changes",
    heading: "Änderungen der Bedingungen",
    paragraphs: [
      "Die Bedingungen können aktualisiert werden. Über wichtige Änderungen informieren wir registrierte Nutzer per E-Mail.",
    ],
  },
  {
    id: "contact",
    heading: "Kontakt",
    paragraphs: [
      "Fragen zu den Bedingungen können Sie über das Formular auf der Kontaktseite senden.",
    ],
    links: [{ href: "/kontakt", label: "Kontakt" }],
  },
];

const FR: LegalSection[] = [
  {
    id: "acceptance",
    heading: "Acceptation des conditions",
    paragraphs: [
      "En utilisant la plateforme Discover Slovenia AI, vous acceptez les présentes conditions d'utilisation.",
    ],
  },
  {
    id: "service",
    heading: "Le service",
    paragraphs: [
      "La plateforme fournit des informations sur les destinations touristiques slovènes, la planification de voyage par IA et des liens vers les prestataires locaux. La plateforme ne sert pas d'intermédiaire pour les réservations — les utilisateurs réservent directement auprès des prestataires.",
    ],
  },
  {
    id: "itineraries",
    heading: "Itinéraires",
    paragraphs: [
      "Les itinéraires générés ont une valeur informative. La plateforme n'est pas responsable de l'exactitude des prix, de la disponibilité ou de la qualité des services tiers.",
    ],
  },
  {
    id: "affiliate",
    heading: "Liens d'affiliation",
    paragraphs: [
      "La plateforme contient des liens d'affiliation (Booking.com, GetYourGuide, Viator (Tripadvisor), Tiqets, Kiwi.com, Skyscanner, Rentalcars.com, DiscoverCars, Omio, Airalo, World Nomads, SafetyWing) ainsi que des liens de transfert Kiwitaxi. Si vous réservez via ces liens, Discover Slovenia peut recevoir une commission de partenaire. Votre prix n'augmente pas pour autant.",
    ],
  },
  {
    id: "providers",
    heading: "Prestataires (B2B)",
    paragraphs: [
      "Les prestataires enregistrés sont responsables de l'exactitude de leurs données. Les abonnements forfaitaires (Premium €149/mois, Enterprise €499/mois) sont facturés mensuellement. La résiliation est possible à tout moment avec un préavis de 30 jours.",
    ],
  },
  {
    id: "beta",
    heading: "Période bêta",
    paragraphs: [
      "Pendant la période bêta (jusqu'à 30 établissements actifs), tous les packs sont gratuits. Une fois la monétisation activée, les utilisateurs bêta bénéficient de 6 mois d'accès gratuit.",
    ],
  },
  {
    id: "ip",
    heading: "Propriété intellectuelle",
    paragraphs: [
      "Le contenu de la plateforme est publié sous licence MIT et le code web est open source. Les images des destinations proviennent de sources ouvertes (Unsplash). Les cartes et les points d'intérêt utilisent les données ouvertes d'OpenStreetMap — © contributeurs d'OpenStreetMap (licence ODbL).",
    ],
  },
  {
    id: "liability",
    heading: "Limitation de responsabilité",
    paragraphs: [
      "La plateforme n'est pas responsable des dommages résultant de l'utilisation des informations ou des liens vers des tiers.",
    ],
  },
  {
    id: "changes",
    heading: "Modifications des conditions",
    paragraphs: [
      "Les conditions peuvent être mises à jour. Nous informerons les utilisateurs enregistrés des changements importants par e-mail.",
    ],
  },
  {
    id: "contact",
    heading: "Contact",
    paragraphs: [
      "Les questions relatives aux conditions peuvent être envoyées via le formulaire de la page contact.",
    ],
    links: [{ href: "/kontakt", label: "Contact" }],
  },
];

const ES: LegalSection[] = [
  {
    id: "acceptance",
    heading: "Aceptación de las condiciones",
    paragraphs: [
      "Al usar la plataforma Discover Slovenia AI, usted acepta estas condiciones de uso.",
    ],
  },
  {
    id: "service",
    heading: "El servicio",
    paragraphs: [
      "La plataforma ofrece información sobre destinos turísticos eslovenos, planificación de viajes con IA y enlaces a proveedores locales. La plataforma no intermedia reservas — los usuarios reservan directamente con los proveedores.",
    ],
  },
  {
    id: "itineraries",
    heading: "Itinerarios",
    paragraphs: [
      "Los itinerarios generados son informativos. La plataforma no se hace responsable de la exactitud de los precios, la disponibilidad ni la calidad de los servicios de terceros.",
    ],
  },
  {
    id: "affiliate",
    heading: "Enlaces de afiliación",
    paragraphs: [
      "La plataforma contiene enlaces de afiliación (Booking.com, GetYourGuide, Viator (Tripadvisor), Tiqets, Kiwi.com, Skyscanner, Rentalcars.com, DiscoverCars, Omio, Airalo, World Nomads, SafetyWing) además de enlaces de traslados de Kiwitaxi. Si reserva a través de estos enlaces, Discover Slovenia puede recibir una comisión de socio. Su precio no aumenta por ello.",
    ],
  },
  {
    id: "providers",
    heading: "Proveedores (B2B)",
    paragraphs: [
      "Los proveedores registrados son responsables de la exactitud de sus datos. Las suscripciones de tarifa fija (Premium €149/mes, Enterprise €499/mes) se facturan mensualmente. La cancelación es posible en cualquier momento con un preaviso de 30 días.",
    ],
  },
  {
    id: "beta",
    heading: "Período beta",
    paragraphs: [
      "Durante el período beta (hasta 30 locales activos) todos los paquetes son gratuitos. Al activarse la monetización, los usuarios beta reciben 6 meses de acceso gratuito.",
    ],
  },
  {
    id: "ip",
    heading: "Propiedad intelectual",
    paragraphs: [
      "El contenido de la plataforma está publicado bajo licencia MIT y el código web es de código abierto. Las imágenes de los destinos provienen de fuentes abiertas (Unsplash). Los mapas y los puntos de interés utilizan datos abiertos de OpenStreetMap — © colaboradores de OpenStreetMap (licencia ODbL).",
    ],
  },
  {
    id: "liability",
    heading: "Limitación de responsabilidad",
    paragraphs: [
      "La plataforma no se hace responsable de los daños derivados del uso de la información o de los enlaces a terceros.",
    ],
  },
  {
    id: "changes",
    heading: "Cambios en las condiciones",
    paragraphs: [
      "Las condiciones pueden actualizarse. Informaremos a los usuarios registrados sobre los cambios importantes por correo electrónico.",
    ],
  },
  {
    id: "contact",
    heading: "Contacto",
    paragraphs: [
      "Las preguntas sobre las condiciones pueden enviarse mediante el formulario de la página de contacto.",
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

export default function TermsPage() {
  const l = useLocale();
  const title = pick(l, { sl: "Pogoji uporabe", en: "Terms of use", it: "Condizioni d'uso", de: "Nutzungsbedingungen", fr: "Conditions d'utilisation", es: "Condiciones de uso" });
  return (
    <LegalPage
      title={title}
      updated="2026-10-13"
      sections={SECTIONS[l] ?? SL}
    />
  );
}
