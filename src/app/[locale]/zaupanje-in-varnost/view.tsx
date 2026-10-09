"use client";

import { useLocale } from "next-intl";

import { LegalPage, type LegalSection } from "@/components/layout/legal-page";
import { pick } from "@/lib/i18n-pick";

/** Besedilo 1:1 iz produkcije (production-mirror/zaupanje-in-varnost). */
const SL: LegalSection[] = [
  {
    id: "partnerji",
    heading: "Kako preverjamo partnerje",
    paragraphs: [
      "Admin odobritev: vsak lokal mora biti ročno odobren s strani naše ekipe, preden je objavljen. Preverjamo pravilnost kontaktov, ustreznost kategorije, kakovost slik in opisa. Nepotrjeni lokalci niso vidni uporabnikom in AI jih ne more priporočati.",
      "Partner Quality Score (0–100): vsak lokal ima avtomatsko izračunan oceni profil iz 7 signalov — popolnost profila (30 %), kakovost fotografij (15 %), kakovost opisa (15 %), AI tagi (10 %), admin verifikacija (10 %), ocene (10 %), svežina podatkov (10 %). Znaki: Verified (Q > 40), Premium (plačnik), Featured (Q > 90 + Premium + Verified).",
      "VLM preverba slik: vse slike na platformi so preverjene z Vision Language Modelom — ujemanje z imenom lokalca, odsotnost vodnih žigov, kakovost in ustreznost vsebine.",
    ],
  },
  {
    id: "ranking",
    heading: "Kako deluje AI ranking",
    paragraphs: [
      "AI priporočila temeljijo na 5 dimenzijah z jasnimi utežmi. Plačilo ne more kupiti prvega mesta:",
      "① Ujemanje z uporabnikovim iskanjem (destinacija, interesi, kategorija) — 60 %. ② Kakovost profila lokalca (0–100). ③ Ocene uporabnikov (0–5 zvezdic). ④ Geografska bližina drugim lokacijam v itinererju. ⑤ Maksimalno 5 % boost za plačane partnerje — ne more preseči relevantnosti.",
      "Pravilo: AI nikoli ne priporoča slabega lokalca samo zato, ker plača. Lokalci z oceno pod 3,5 ne dobijo premium boost-a. Relevantnost (60 %) vedno dominira nad Premium (5 %).",
    ],
  },
  {
    id: "transparentnost",
    heading: "Transparentnost priporočil",
    paragraphs: [
      "Vsako AI priporočilo je jasno označeno — uporabnik ve, kaj je oglas in kaj organsko:",
      "Featured — preverjen partner z visoko kakovostjo profila in Premium članstvom (Quality Score > 90). Premium — partner podpira razvoj platforme in ima razširjen profil (boost max 5 %). Preverjeno — podatke je preverila ekipa Discover Slovenia AI. Affiliate — povezava, prek katere lahko Discover Slovenia AI prejme provizijo (vedno jasno označeno). Organsko — brezplačno priporočilo glede na relevantnost.",
    ],
  },
  {
    id: "podatki",
    heading: "Varstvo podatkov",
    paragraphs: [
      "GDPR skladnost: politika zasebnosti, piškotki, pravica do pozabe; DPA za premium partnerje.",
      "Brezplačno za uporabnike: uporabnik nikoli ne plača za AI funkcije — monetizacija samo prek ponudnikov.",
      "Brez posrednikov: AI poveže turista s ponudnikom; rezervacijo opravi turist direktno pri ponudniku.",
      "Audit log: vse admin akcije (odobritev, zavrnitev, sponzorstvo) so zabeležene in sledljive.",
    ],
  },
];

const EN: LegalSection[] = [
  {
    id: "partners",
    heading: "How we verify partners",
    paragraphs: [
      "Admin approval: every local spot must be manually approved by our team before publication. We check contact accuracy, category fit, image and description quality. Unapproved spots are invisible to users and cannot be recommended by the AI.",
      "Partner Quality Score (0–100): each spot gets an automatically computed score from 7 signals — profile completeness (30%), photo quality (15%), description quality (15%), AI tags (10%), admin verification (10%), ratings (10%), data freshness (10%). Badges: Verified (Q > 40), Premium (payer), Featured (Q > 90 + Premium + Verified).",
      "VLM image checks: all images are checked with a Vision Language Model — name matching, absence of watermarks, content quality and relevance.",
    ],
  },
  {
    id: "ranking",
    heading: "How AI ranking works",
    paragraphs: [
      "AI recommendations are based on 5 dimensions with clear weights. Payment cannot buy the top spot:",
      "① Match with the user's search (destination, interests, category) — 60%. ② Provider profile quality (0–100). ③ User ratings (0–5 stars). ④ Geographic proximity to other stops in the itinerary. ⑤ A maximum 5% boost for paying partners — it cannot outweigh relevance.",
      "Rule: the AI never recommends a bad spot just because it pays. Spots rated below 3.5 get no premium boost. Relevance (60%) always dominates Premium (5%).",
    ],
  },
  {
    id: "transparency",
    heading: "Recommendation transparency",
    paragraphs: [
      "Every AI recommendation is clearly labelled — users know what is an ad and what is organic:",
      "Featured — a verified partner with a high-quality profile and Premium membership (Quality Score > 90). Premium — a partner supporting the platform with an extended profile (max 5% boost). Verified — data checked by the Discover Slovenia AI team. Affiliate — a link through which Discover Slovenia AI may receive a commission (always clearly marked). Organic — a free recommendation based on relevance.",
    ],
  },
  {
    id: "data",
    heading: "Data protection",
    paragraphs: [
      "GDPR compliance: privacy policy, cookies, right to be forgotten; DPA for premium partners.",
      "Free for users: users never pay for AI features — monetization comes only from providers.",
      "No middlemen: the AI connects a traveller with a provider; the booking is made directly with the provider.",
      "Audit log: all admin actions (approval, rejection, sponsorship) are recorded and traceable.",
    ],
  },
];

const IT: LegalSection[] = [
  {
    id: "partners",
    heading: "Come verifichiamo i partner",
    paragraphs: [
      "Approvazione admin: ogni locale deve essere approvato manualmente dal nostro team prima della pubblicazione. Verifichiamo la correttezza dei contatti, l'adeguatezza della categoria, la qualità delle immagini e della descrizione. I locali non approvati non sono visibili agli utenti e l'AI non può raccomandarli.",
      "Partner Quality Score (0–100): ogni locale ha un punteggio calcolato automaticamente da 7 segnali — completezza del profilo (30 %), qualità delle foto (15 %), qualità della descrizione (15 %), tag AI (10 %), verifica admin (10 %), valutazioni (10 %), freschezza dei dati (10 %). Badge: Verified (Q > 40), Premium (pagante), Featured (Q > 90 + Premium + Verified).",
      "Controlli VLM delle immagini: tutte le immagini sulla piattaforma sono verificate con un Vision Language Model — corrispondenza con il nome del locale, assenza di watermark, qualità e pertinenza dei contenuti.",
    ],
  },
  {
    id: "ranking",
    heading: "Come funziona il ranking AI",
    paragraphs: [
      "Le raccomandazioni AI si basano su 5 dimensioni con pesi chiari. Il pagamento non può comprare il primo posto:",
      "① Corrispondenza con la ricerca dell'utente (destinazione, interessi, categoria) — 60 %. ② Qualità del profilo del fornitore (0–100). ③ Valutazioni degli utenti (0–5 stelle). ④ Vicinanza geografica alle altre tappe dell'itinerario. ⑤ Massimo 5 % di boost per i partner paganti — non può prevalere sulla pertinenza.",
      "Regola: l'AI non raccomanda mai un locale scadente solo perché paga. I locali con valutazione sotto 3,5 non ricevono il boost premium. La pertinenza (60 %) domina sempre sul Premium (5 %).",
    ],
  },
  {
    id: "transparency",
    heading: "Trasparenza delle raccomandazioni",
    paragraphs: [
      "Ogni raccomandazione AI è chiaramente etichettata — l'utente sa cosa è pubblicità e cosa è organico:",
      "Featured — partner verificato con profilo di alta qualità e abbonamento Premium (Quality Score > 90). Premium — un partner che sostiene lo sviluppo della piattaforma con profilo esteso (boost max 5 %). Verificato — dati controllati dal team Discover Slovenia AI. Affiliate — un link attraverso cui Discover Slovenia AI può ricevere una provvigione (sempre chiaramente indicato). Organico — raccomandazione gratuita basata sulla pertinenza.",
    ],
  },
  {
    id: "data",
    heading: "Protezione dei dati",
    paragraphs: [
      "Conformità GDPR: politica sulla privacy, cookie, diritto all'oblio; DPA per i partner premium.",
      "Gratuito per gli utenti: l'utente non paga mai per le funzioni AI — monetizzazione solo tramite i fornitori.",
      "Senza intermediari: l'AI collega il turista al fornitore; la prenotazione avviene direttamente presso il fornitore.",
      "Audit log: tutte le azioni admin (approvazione, rifiuto, sponsorizzazione) sono registrate e tracciabili.",
    ],
  },
];

const DE: LegalSection[] = [
  {
    id: "partners",
    heading: "So prüfen wir Partner",
    paragraphs: [
      "Admin-Freigabe: Jeder Lokal muss vor der Veröffentlichung manuell von unserem Team freigegeben werden. Wir prüfen die Richtigkeit der Kontakte, die Passung der Kategorie sowie die Qualität von Bildern und Beschreibung. Nicht freigegebene Lokale sind für Nutzer unsichtbar und können von der KI nicht empfohlen werden.",
      "Partner Quality Score (0–100): Jeder Lokal erhält eine automatisch berechnete Bewertung aus 7 Signalen — Profilvollständigkeit (30 %), Fotoqualität (15 %), Beschreibungsqualität (15 %), KI-Tags (10 %), Admin-Verifizierung (10 %), Bewertungen (10 %), Datenfrische (10 %). Abzeichen: Verified (Q > 40), Premium (Zahlender), Featured (Q > 90 + Premium + Verified).",
      "VLM-Bildprüfung: Alle Bilder auf der Plattform werden mit einem Vision Language Model geprüft — Übereinstimmung mit dem Namen des Lokals, Abwesenheit von Wasserzeichen, Qualität und Relevanz der Inhalte.",
    ],
  },
  {
    id: "ranking",
    heading: "So funktioniert das KI-Ranking",
    paragraphs: [
      "KI-Empfehlungen beruhen auf 5 Dimensionen mit klaren Gewichten. Zahlungen können den Spitzenplatz nicht kaufen:",
      "① Übereinstimmung mit der Suche des Nutzers (Destination, Interessen, Kategorie) — 60 %. ② Qualität des Anbieterprofils (0–100). ③ Nutzerbewertungen (0–5 Sterne). ④ Geografische Nähe zu anderen Stationen der Reiseroute. ⑤ Maximal 5 % Boost für zahlende Partner — er kann die Relevanz nicht aufwiegen.",
      "Regel: Die KI empfiehlt nie einen schlechten Lokal nur, weil er zahlt. Lokale mit einer Bewertung unter 3,5 erhalten keinen Premium-Boost. Relevanz (60 %) dominiert immer über Premium (5 %).",
    ],
  },
  {
    id: "transparency",
    heading: "Transparenz der Empfehlungen",
    paragraphs: [
      "Jede KI-Empfehlung ist klar gekennzeichnet — Nutzer wissen, was Werbung ist und was organisch:",
      "Featured — ein verifizierter Partner mit hochwertigem Profil und Premium-Mitgliedschaft (Quality Score > 90). Premium — ein Partner, der die Plattform unterstützt, mit erweitertem Profil (Boost max. 5 %). Verifiziert — Daten vom Discover-Slovenia-AI-Team geprüft. Affiliate — ein Link, über den Discover Slovenia AI eine Provision erhalten kann (immer klar gekennzeichnet). Organisch — eine kostenlose Empfehlung auf Basis der Relevanz.",
    ],
  },
  {
    id: "data",
    heading: "Datenschutz",
    paragraphs: [
      "DSGVO-Konformität: Datenschutzerklärung, Cookies, Recht auf Vergessenwerden; DPA für Premium-Partner.",
      "Kostenlos für Nutzer: Nutzer zahlen nie für KI-Funktionen — Monetarisierung erfolgt ausschließlich über Anbieter.",
      "Ohne Zwischenhändler: Die KI verbindet Reisende mit Anbietern; die Buchung erfolgt direkt beim Anbieter.",
      "Audit-Log: Alle Admin-Aktionen (Freigabe, Ablehnung, Sponsoring) werden aufgezeichnet und sind nachvollziehbar.",
    ],
  },
];

const FR: LegalSection[] = [
  {
    id: "partners",
    heading: "Comment nous vérifions les partenaires",
    paragraphs: [
      "Validation admin : chaque établissement doit être validé manuellement par notre équipe avant publication. Nous vérifions l'exactitude des contacts, la pertinence de la catégorie, la qualité des photos et de la description. Les établissements non validés sont invisibles pour les utilisateurs et ne peuvent pas être recommandés par l'IA.",
      "Partner Quality Score (0–100) : chaque établissement reçoit un score calculé automatiquement à partir de 7 signaux — complétude du profil (30 %), qualité des photos (15 %), qualité de la description (15 %), tags IA (10 %), vérification admin (10 %), évaluations (10 %), fraîcheur des données (10 %). Badges : Verified (Q > 40), Premium (payeur), Featured (Q > 90 + Premium + Verified).",
      "Contrôles d'images par VLM : toutes les images de la plateforme sont vérifiées avec un Vision Language Model — correspondance avec le nom de l'établissement, absence de filigranes, qualité et pertinence du contenu.",
    ],
  },
  {
    id: "ranking",
    heading: "Comment fonctionne le classement IA",
    paragraphs: [
      "Les recommandations IA reposent sur 5 dimensions aux pondérations claires. Le paiement ne peut pas acheter la première place :",
      "① Correspondance avec la recherche de l'utilisateur (destination, centres d'intérêt, catégorie) — 60 %. ② Qualité du profil du prestataire (0–100). ③ Évaluations des utilisateurs (0 à 5 étoiles). ④ Proximité géographique aux autres étapes de l'itinéraire. ⑤ Boost de 5 % maximum pour les partenaires payants — il ne peut pas l'emporter sur la pertinence.",
      "Règle : l'IA ne recommande jamais un mauvais établissement uniquement parce qu'il paie. Les établissements notés sous 3,5 ne reçoivent pas de boost premium. La pertinence (60 %) domine toujours sur le Premium (5 %).",
    ],
  },
  {
    id: "transparency",
    heading: "Transparence des recommandations",
    paragraphs: [
      "Chaque recommandation IA est clairement étiquetée — l'utilisateur sait ce qui est publicitaire et ce qui est organique :",
      "Featured — un partenaire vérifié avec un profil de haute qualité et un abonnement Premium (Quality Score > 90). Premium — un partenaire qui soutient la plateforme avec un profil étendu (boost max 5 %). Vérifié — données contrôlées par l'équipe Discover Slovenia AI. Affiliation — un lien via lequel Discover Slovenia AI peut recevoir une commission (toujours clairement indiqué). Organique — une recommandation gratuite fondée sur la pertinence.",
    ],
  },
  {
    id: "data",
    heading: "Protection des données",
    paragraphs: [
      "Conformité RGPD : politique de confidentialité, cookies, droit à l'effacement ; DPA pour les partenaires premium.",
      "Gratuit pour les utilisateurs : l'utilisateur ne paie jamais pour les fonctions IA — la monétisation passe uniquement par les prestataires.",
      "Sans intermédiaires : l'IA met en relation le voyageur et le prestataire ; la réservation se fait directement auprès du prestataire.",
      "Journal d'audit : toutes les actions admin (validation, rejet, sponsoring) sont enregistrées et traçables.",
    ],
  },
];

const ES: LegalSection[] = [
  {
    id: "partners",
    heading: "Cómo verificamos a los socios",
    paragraphs: [
      "Aprobación admin: cada local debe ser aprobado manualmente por nuestro equipo antes de publicarse. Comprobamos la exactitud de los contactos, la adecuación de la categoría y la calidad de las imágenes y la descripción. Los locales no aprobados son invisibles para los usuarios y la IA no puede recomendarlos.",
      "Partner Quality Score (0–100): cada local tiene una puntuación calculada automáticamente a partir de 7 señales — completitud del perfil (30 %), calidad de las fotos (15 %), calidad de la descripción (15 %), etiquetas de IA (10 %), verificación admin (10 %), valoraciones (10 %), frescura de los datos (10 %). Insignias: Verified (Q > 40), Premium (pagador), Featured (Q > 90 + Premium + Verified).",
      "Controles de imágenes con VLM: todas las imágenes de la plataforma se verifican con un Vision Language Model — coincidencia con el nombre del local, ausencia de marcas de agua, calidad y pertinencia del contenido.",
    ],
  },
  {
    id: "ranking",
    heading: "Cómo funciona el ranking de IA",
    paragraphs: [
      "Las recomendaciones de IA se basan en 5 dimensiones con ponderaciones claras. El pago no puede comprar el primer puesto:",
      "① Coincidencia con la búsqueda del usuario (destino, intereses, categoría) — 60 %. ② Calidad del perfil del proveedor (0–100). ③ Valoraciones de los usuarios (0–5 estrellas). ④ Cercanía geográfica a otras paradas del itinerario. ⑤ Máximo 5 % de boost para los socios de pago — no puede imponerse a la relevancia.",
      "Regla: la IA nunca recomienda un local malo solo porque paga. Los locales con valoración inferior a 3,5 no reciben boost premium. La relevancia (60 %) siempre domina sobre el Premium (5 %).",
    ],
  },
  {
    id: "transparency",
    heading: "Transparencia de las recomendaciones",
    paragraphs: [
      "Cada recomendación de IA está claramente etiquetada — el usuario sabe qué es publicidad y qué es orgánico:",
      "Featured — socio verificado con un perfil de alta calidad y suscripción Premium (Quality Score > 90). Premium — socio que apoya el desarrollo de la plataforma con un perfil ampliado (boost máx. 5 %). Verificado — datos comprobados por el equipo de Discover Slovenia AI. Afiliación — un enlace a través del cual Discover Slovenia AI puede recibir una comisión (siempre claramente señalado). Orgánico — recomendación gratuita basada en la relevancia.",
    ],
  },
  {
    id: "data",
    heading: "Protección de datos",
    paragraphs: [
      "Cumplimiento del RGPD: política de privacidad, cookies, derecho al olvido; DPA para socios premium.",
      "Gratis para los usuarios: el usuario nunca paga por las funciones de IA — la monetización llega solo de los proveedores.",
      "Sin intermediarios: la IA conecta al viajero con el proveedor; la reserva se hace directamente con el proveedor.",
      "Registro de auditoría: todas las acciones admin (aprobación, rechazo, patrocinio) quedan registradas y son trazables.",
    ],
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

export default function TrustSafetyPage() {
  const l = useLocale();
  return (
    <LegalPage
      title={pick(l, {
        sl: "Zaupanje in varnost",
        en: "Trust & safety",
        it: "Fiducia e sicurezza",
        de: "Vertrauen & Sicherheit",
        fr: "Confiance et sécurité",
        es: "Confianza y seguridad",
      })}
      updated="2025"
      intro={pick(l, {
        sl: "Kako preverjamo partnerje, kako deluje AI ranking in kako varujemo tvoje podatke.",
        en: "How we verify partners, how AI ranking works and how we protect your data.",
        it: "Come verifichiamo i partner, come funziona il ranking AI e come proteggiamo i tuoi dati.",
        de: "Wie wir Partner prüfen, wie das KI-Ranking funktioniert und wie wir deine Daten schützen.",
        fr: "Comment nous vérifions les partenaires, comment fonctionne le classement IA et comment nous protégeons tes données.",
        es: "Cómo verificamos a los socios, cómo funciona el ranking de IA y cómo protegemos tus datos.",
      })}
      sections={SECTIONS[l] ?? SL}
    />
  );
}
