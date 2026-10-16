"use client";

import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  Compass,
  Map as MapIcon,
  SearchCheck,
} from "lucide-react";
import { useLocale } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

/**
 * /primerjava — iskrena primerjava AI načrtovalcev za Slovenijo
 * (1:1 vsebina produkcije: Mindtrip/Layla/Google preverbe, močne strani
 * generalistov, pasti, tabela, praksa, FAQ). Ni marketinška brošura —
 * priznamo, kje so generalisti boljši (kanon iskrenosti).
 */
export default function PrimerjavaPage() {
  const l = useLocale();

  const L = {
    kicker: {
      sl: "Iskrena primerjava · brez prijave",
      en: "An honest comparison · no sign-up",
      it: "Un confronto onesto · senza registrazione",
      de: "Ein ehrlicher Vergleich · ohne Anmeldung",
      fr: "Une comparaison honnête · sans inscription",
      es: "Una comparación honesta · sin registro",
    },
    title: {
      sl: "Kateri AI načrtovalec potovanj je pravi za Slovenijo?",
      en: "Which AI travel planner is right for Slovenia?",
      it: "Quale pianificatore di viaggio AI è giusto per la Slovenia?",
      de: "Welcher KI-Reiseplaner ist der richtige für Slowenien?",
      fr: "Quel planificateur de voyage IA convient pour la Slovénie ?",
      es: "¿Qué planificador de viajes con IA es el adecuado para Eslovenia?",
    },
    lead: {
      sl: "Ta primerjava ni marketinška brošura. Naše uredniško načelo je iskrenost — zato priznamo, kje so splošni načrtovalci boljši od nas, in pokažemo, kje specialist za Slovenijo vrne več. Odločitev prepustimo tebi.",
      en: "This comparison is not a marketing brochure. Our editorial principle is honesty — so we admit where general planners beat us, and show where a Slovenia specialist returns more. The decision is yours.",
      it: "Questo confronto non è un dépliant marketing. Il nostro principio editoriale è l'onestà — per questo ammettiamo dove i pianificatori generalisti ci battono e mostriamo dove uno specialista della Slovenia rende di più. La decisione la lasciamo a te.",
      de: "Dieser Vergleich ist keine Werbebroschüre. Unser redaktionelles Prinzip ist Ehrlichkeit — deshalb geben wir zu, wo uns allgemeine Planer schlagen, und zeigen, wo ein Slowenien-Spezialist mehr liefert. Die Entscheidung überlassen wir dir.",
      fr: "Cette comparaison n'est pas une brochure marketing. Notre principe éditorial est l'honnêteté — nous admettons donc où les planificateurs généralistes nous battent et montrons où un spécialiste de la Slovénie rend davantage. La décision t'appartient.",
      es: "Esta comparación no es un folleto de marketing. Nuestro principio editorial es la honestidad — por eso admitimos dónde nos superan los planificadores generalistas y mostramos dónde un especialista en Eslovenia da más. La decisión te la dejamos a ti.",
    },
    updated: {
      sl: "Posodobljeno: 28. september 2026. Primerjave staréjo — preveri datum pred odločitvijo.",
      en: "Updated: 28 September 2026. Comparisons age — check the date before deciding.",
      it: "Aggiornato: 28 settembre 2026. I confronti invecchiano — controlla la data prima di decidere.",
      de: "Aktualisiert: 28. September 2026. Vergleiche altern — prüfe das Datum vor der Entscheidung.",
      fr: "Mis à jour : 28 septembre 2026. Les comparaisons vieillissent — vérifie la date avant de décider.",
      es: "Actualizado: 28 de septiembre de 2026. Las comparaciones envejecen — comprueba la fecha antes de decidir.",
    },
    terenKicker: {
      sl: "Teren · preverjeno 28. 9. 2026",
      en: "Field · verified 28 Sep 2026",
      it: "Campo · verificato 28 set 2026",
      de: "Feld · verifiziert 28.09.2026",
      fr: "Terrain · vérifié 28 sept. 2026",
      es: "Terreno · verificado 28 sep 2026",
    },
    terenTitle: {
      sl: "Teren se je premaknil — kaj smo živo preverili 28. septembra 2026",
      en: "The field has moved — what we verified live on 28 September 2026",
      it: "Il campo si è mosso — cosa abbiamo verificato dal vivo il 28 settembre 2026",
      de: "Das Feld hat sich bewegt — was wir am 28. September 2026 live geprüft haben",
      fr: "Le terrain a bougé — ce que nous avons vérifié en direct le 28 septembre 2026",
      es: "El terreno ha cambiado — lo que verificamos en directo el 28 de septiembre de 2026",
    },
    terenLead: {
      sl: "Iskrena primerjava zahteva datirane preverbe, ne večne trditve. To so točkovne ugotovitve naših preverb (javni dostop do strani, uradni viri) — ko se teren spremeni, posodobimo to sekcijo.",
      en: "An honest comparison requires dated checks, not eternal claims. These are the point findings of our verifications (public page access, official sources) — when the field changes, we update this section.",
      it: "Un confronto onesto richiede verifiche datate, non affermazioni eterne. Questi sono i risultati puntuali delle nostre verifiche (accesso pubblico alle pagine, fonti ufficiali) — quando il campo cambia, aggiorniamo questa sezione.",
      de: "Ein ehrlicher Vergleich erfordert datierte Prüfungen, keine ewigen Behauptungen. Das sind die punktuellen Ergebnisse unserer Prüfungen (öffentlicher Seitenzugriff, offizielle Quellen) — ändert sich das Feld, aktualisieren wir diesen Abschnitt.",
      fr: "Une comparaison honnête exige des vérifications datées, pas des affirmations éternelles. Voici les résultats ponctuels de nos vérifications (accès public aux pages, sources officielles) — quand le terrain change, nous mettons cette section à jour.",
      es: "Una comparación honesta exige comprobaciones con fecha, no afirmaciones eternas. Estos son los hallazgos puntuales de nuestras verificaciones (acceso público a las páginas, fuentes oficiales) — cuando el terreno cambia, actualizamos esta sección.",
    },
    teren: {
      sl: [
        {
          h: "Mindtrip: celoten spletni orodnik nedosegljiv",
          b: "Ob preverbi 28. 9. 2026 so mindtrip.ai, prijava in API prikazovali stran „Under Construction“ (preusmeritev vodi na njihov CDN za slike). O izpadu nismo zasledili medijske pokritosti, recenzije iz 22.–23. 9. pa Mindtrip še navajajo med najboljšimi orodji — recenzijski cikel zaostaja za realnostjo. O vzroku ne ugibamo; trenutno stanje preveri pri njih.",
        },
        {
          h: "Layla: za marsikaterega obiskovalca za zidom",
          b: "layla.ai je ob naših preverbah vračal napako 429 in varnostno preverjanje brskalnika; nekdanja tržna domena itslayla.com je danes nepovezana modna trgovina. Laylo je 31. 7. 2026 prevzela skupina Expedia — klepet-prvi lijaki v tej kategoriji zdaj stojijo na OTA denarju, kar še ne pomeni boljše izkušnje za vsakega obiskovalca.",
        },
        {
          h: "Google: generični AI itinerarji so zdaj brezplačni",
          b: "Po uradni časovnici blogov Google (november 2025 → avgust 2026) znata AI Mode in Gemini sestaviti itinerer brezplačno. „AI ti napiše načrt“ torej ni več razlika med orodji — globina podatkov, preverljivost virov in uporaba brez povezave so.",
        },
      ],
      en: [
        {
          h: "Mindtrip: the entire web toolkit unreachable",
          b: "At our check on 28 Sep 2026, mindtrip.ai, its sign-in and API showed an “Under Construction” page (the redirect leads to their image CDN). We found no media coverage of the outage, while reviews from 22–23 Sep still list Mindtrip among the best tools — the review cycle lags reality. We do not guess about the cause; check the current state with them.",
        },
        {
          h: "Layla: behind a wall for many visitors",
          b: "layla.ai returned error 429 and a browser security check during our verifications; the former marketing domain itslayla.com is today an unrelated fashion shop. Expedia Group acquired Layla on 31 Jul 2026 — chat-first tools in this category now run on OTA money, which does not automatically mean a better experience for every visitor.",
        },
        {
          h: "Google: generic AI itineraries are now free",
          b: "Per Google's official blog timeline (November 2025 → August 2026), AI Mode and Gemini can build an itinerary for free. “AI writes your plan” is therefore no longer a differentiator — data depth, source verifiability and offline use are.",
        },
      ],
      it: [
        {
          h: "Mindtrip: l'intero toolkit web irraggiungibile",
          b: "Alla nostra verifica del 28 set 2026, mindtrip.ai, l'accesso e l'API mostravano una pagina «Under Construction» (il reindirizzamento porta al loro CDN per le immagini). Non abbiamo trovato copertura media dell'interruzione, mentre le recensioni del 22–23 set elencano ancora Mindtrip tra i migliori strumenti — il ciclo delle recensioni è in ritardo sulla realtà. Non speculiamo sulla causa; verifica lo stato attuale direttamente con loro.",
        },
        {
          h: "Layla: dietro un muro per molti visitatori",
          b: "layla.ai durante le nostre verifiche restituiva l'errore 429 e un controllo di sicurezza del browser; l'ex dominio di marketing itslayla.com è oggi un negozio di moda senza alcun legame. Expedia Group ha acquisito Layla il 31 lug 2026 — gli strumenti chat-first di questa categoria oggi vivono di denaro OTA, il che non significa automaticamente un'esperienza migliore per ogni visitatore.",
        },
        {
          h: "Google: gli itinerari AI generici ora sono gratuiti",
          b: "Secondo la timeline ufficiale dei blog di Google (novembre 2025 → agosto 2026), AI Mode e Gemini possono creare un itinerario gratuitamente. «L'AI ti scrive il piano» quindi non è più un elemento di distinzione — la profondità dei dati, la verificabilità delle fonti e l'uso offline lo sono.",
        },
      ],
      de: [
        {
          h: "Mindtrip: das gesamte Web-Toolkit unerreichbar",
          b: "Bei unserer Prüfung am 28.09.2026 zeigten mindtrip.ai, Anmeldung und API eine „Under Construction“-Seite (die Weiterleitung führt zu ihrem Bild-CDN). Wir fanden keine Medienberichte über den Ausfall, während Bewertungen vom 22.–23.09. Mindtrip noch unter die besten Werkzeuge reihen — der Bewertungszyklus hinkt der Realität hinterher. Über die Ursache raten wir nicht; prüfe den aktuellen Stand direkt bei ihnen.",
        },
        {
          h: "Layla: für viele Besucher hinter einer Mauer",
          b: "layla.ai meldete bei unseren Prüfungen Fehler 429 und eine Browser-Sicherheitsprüfung; die frühere Marketing-Domain itslayla.com ist heute ein unverbundener Modeshop. Die Expedia Group hat Layla am 31.07.2026 übernommen — chat-first-Werkzeuge dieser Kategorie laufen inzwischen auf OTA-Geld, was nicht automatisch ein besseres Erlebnis für jeden Besucher bedeutet.",
        },
        {
          h: "Google: generische KI-Itinerare sind jetzt kostenlos",
          b: "Laut der offiziellen Zeitlinie der Google-Blogs (November 2025 → August 2026) können AI Mode und Gemini kostenlos ein Itinerar erstellen. „Die KI schreibt deinen Plan“ ist also kein Unterscheidungsmerkmal mehr — Datentiefe, Quellenprüfbarkeit und Offline-Nutzung sind es.",
        },
      ],
      fr: [
        {
          h: "Mindtrip : toute la boîte à outils web injoignable",
          b: "Lors de notre vérification du 28 sept. 2026, mindtrip.ai, sa connexion et son API affichaient une page « Under Construction » (la redirection mène à leur CDN d'images). Nous n'avons trouvé aucune couverture médiatique de la panne, tandis que les avis des 22–23 sept. classent encore Mindtrip parmi les meilleurs outils — le cycle des avis est en retard sur la réalité. Nous ne spéculons pas sur la cause ; vérifie l'état actuel directement auprès d'eux.",
        },
        {
          h: "Layla : derrière un mur pour beaucoup de visiteurs",
          b: "layla.ai renvoyait l'erreur 429 et un contrôle de sécurité du navigateur pendant nos vérifications ; l'ancien domaine marketing itslayla.com est aujourd'hui une boutique de mode sans rapport. Expedia Group a racheté Layla le 31 juil. 2026 — les outils chat-first de cette catégorie vivent désormais d'argent OTA, ce qui ne signifie pas automatiquement une meilleure expérience pour chaque visiteur.",
        },
        {
          h: "Google : les itinéraires IA génériques sont désormais gratuits",
          b: "Selon la chronologie officielle des blogs de Google (novembre 2025 → août 2026), AI Mode et Gemini peuvent créer un itinéraire gratuitement. « L'IA écrit ton plan » n'est donc plus un différenciateur — la profondeur des données, la vérifiabilité des sources et l'usage hors ligne le sont.",
        },
      ],
      es: [
        {
          h: "Mindtrip: todo el conjunto web inaccesible",
          b: "En nuestra comprobación del 28 sep 2026, mindtrip.ai, su inicio de sesión y su API mostraban una página «Under Construction» (la redirección lleva a su CDN de imágenes). No encontramos cobertura mediática de la caída, mientras que las reseñas del 22–23 sep aún sitúan a Mindtrip entre las mejores herramientas — el ciclo de reseñas va por detrás de la realidad. No especulamos sobre la causa; comprueba el estado actual directamente con ellos.",
        },
        {
          h: "Layla: tras un muro para muchos visitantes",
          b: "layla.ai devolvía el error 429 y una comprobación de seguridad del navegador durante nuestras verificaciones; el antiguo dominio de marketing itslayla.com es hoy una tienda de moda sin relación. Expedia Group adquirió Layla el 31 jul 2026 — las herramientas chat-first de esta categoría hoy viven de dinero OTA, lo que no significa automáticamente una mejor experiencia para cada visitante.",
        },
        {
          h: "Google: los itinerarios genéricos con IA ya son gratis",
          b: "Según la cronología oficial de los blogs de Google (noviembre 2025 → agosto 2026), AI Mode y Gemini pueden crear un itinerario gratis. «La IA te escribe el plan» ya no es un factor diferencial — la profundidad de los datos, la verificabilidad de las fuentes y el uso sin conexión sí lo son.",
        },
      ],
    },
    terenFoot: {
      sl: "To so točkovne preverbe z datumom — ne stalne trditve. Če se Mindtrip vrne (in upamo, da se), to sekcijo posodobimo; primerjava ostaja poštena v obeh smerih.",
      en: "These are dated point checks — not permanent claims. If Mindtrip returns (and we hope it does), we update this section; the comparison stays fair in both directions.",
      it: "Sono verifiche puntuali datate — non affermazioni permanenti. Se Mindtrip torna (e lo speriamo), aggiorniamo questa sezione; il confronto resta corretto in entrambe le direzioni.",
      de: "Das sind datierte Punktprüfungen — keine dauerhaften Behauptungen. Wenn Mindtrip zurückkommt (und das hoffen wir), aktualisieren wir diesen Abschnitt; der Vergleich bleibt in beide Richtungen fair.",
      fr: "Ce sont des vérifications ponctuelles datées — pas des affirmations permanentes. Si Mindtrip revient (et nous l'espérons), nous mettons cette section à jour ; la comparaison reste équitable dans les deux sens.",
      es: "Son comprobaciones puntuales con fecha — no afirmaciones permanentes. Si Mindtrip vuelve (y lo esperamos), actualizamos esta sección; la comparación sigue siendo justa en ambas direcciones.",
    },
    goodTitle: {
      sl: "Kaj splošni AI načrtovalci delajo odlično",
      en: "What general AI planners do excellently",
      it: "Cosa fanno benissimo i pianificatori AI generalisti",
      de: "Was allgemeine KI-Planer hervorragend können",
      fr: "Ce que les planificateurs IA généralistes font excellemment",
      es: "Lo que los planificadores de IA generalistas hacen de maravilla",
    },
    goodLead: {
      sl: "Mindtrip, Layla, Wanderlog, ChatGPT in sorodniki so dobri izdelki (za trenutno dosegljivost glej terensko sekcijo zgoraj). Za naslednje primere je generalist pravilna izbira:",
      en: "Mindtrip, Layla, Wanderlog, ChatGPT and relatives are good products (for current availability see the field section above). For the following cases a generalist is the right choice:",
      it: "Mindtrip, Layla, Wanderlog, ChatGPT e simili sono buoni prodotti (per la disponibilità attuale vedi la sezione campo sopra). Per i seguenti casi un generalista è la scelta giusta:",
      de: "Mindtrip, Layla, Wanderlog, ChatGPT und Verwandte sind gute Produkte (zur aktuellen Erreichbarkeit siehe den Feld-Abschnitt oben). In den folgenden Fällen ist ein Generalist die richtige Wahl:",
      fr: "Mindtrip, Layla, Wanderlog, ChatGPT et consorts sont de bons produits (pour la disponibilité actuelle, voir la section terrain ci-dessus). Dans les cas suivants, un généraliste est le bon choix :",
      es: "Mindtrip, Layla, Wanderlog, ChatGPT y similares son buenos productos (para la disponibilidad actual consulta la sección de terreno arriba). Para los siguientes casos un generalista es la elección correcta:",
    },
    good: {
      sl: [
        { h: "Globalna pokritost", b: "Načrt za Tokio, Lizbono in Patagonijo v istem klepetu. Mi pokrivamo samo Slovenijo." },
        { h: "Letalske karte in hoteli", b: "Integracije z velikimi rezervacijskimi sistemi po celem svetu. Pri nas rezervirate lokalna doživetja in izdelke, ne lete." },
        { h: "Skupinsko načrtovanje", b: "Sodelovanje v realnem času z družino ali prijatelji. Mi ponujamo deljenje načrta z anketo, ne skupinsko urejanje." },
        { h: "Zrelost in obseg", b: "Milijoni uporabnikov in velike baze recenzij. Mi smo mlada platforma z ozkim, a globokim fokusom." },
      ],
      en: [
        { h: "Global coverage", b: "A plan for Tokyo, Lisbon and Patagonia in the same chat. We cover only Slovenia." },
        { h: "Flights and hotels", b: "Integrations with the big global booking systems. With us you book local experiences and products, not flights." },
        { h: "Group planning", b: "Real-time collaboration with family or friends. We offer sharing a plan with a poll, not group editing." },
        { h: "Maturity and scale", b: "Millions of users and large review bases. We are a young platform with a narrow but deep focus." },
      ],
      it: [
        { h: "Copertura globale", b: "Un piano per Tokyo, Lisbona e Patagonia nella stessa chat. Noi copriamo solo la Slovenia." },
        { h: "Voli e hotel", b: "Integrazioni con i grandi sistemi di prenotazione globali. Con noi prenoti esperienze e prodotti locali, non voli." },
        { h: "Pianificazione di gruppo", b: "Collaborazione in tempo reale con famiglia o amici. Noi offriamo la condivisione del piano con sondaggio, non la modifica di gruppo." },
        { h: "Maturità e scala", b: "Milioni di utenti e grandi basi di recensioni. Noi siamo una piattaforma giovane con un focus ristretto ma profondo." },
      ],
      de: [
        { h: "Globale Abdeckung", b: "Ein Plan für Tokio, Lissabon und Patagonien im selben Chat. Wir decken nur Slowenien ab." },
        { h: "Flüge und Hotels", b: "Integrationen mit den großen globalen Buchungssystemen. Bei uns buchst du lokale Erlebnisse und Produkte, keine Flüge." },
        { h: "Gruppenplanung", b: "Echtzeit-Zusammenarbeit mit Familie oder Freunden. Wir bieten das Teilen eines Plans mit Umfrage, kein Gruppenbearbeiten." },
        { h: "Reife und Größenordnung", b: "Millionen Nutzer und große Bewertungsbasen. Wir sind eine junge Plattform mit engem, aber tiefem Fokus." },
      ],
      fr: [
        { h: "Couverture mondiale", b: "Un plan pour Tokyo, Lisbonne et la Patagonie dans le même chat. Nous ne couvrons que la Slovénie." },
        { h: "Vols et hôtels", b: "Intégrations aux grands systèmes de réservation mondiaux. Chez nous, tu réserves des expériences et produits locaux, pas des vols." },
        { h: "Planification de groupe", b: "Collaboration en temps réel avec la famille ou des amis. Nous proposons le partage d'un plan avec sondage, pas l'édition en groupe." },
        { h: "Maturité et échelle", b: "Des millions d'utilisateurs et de vastes bases d'avis. Nous sommes une jeune plateforme au focus étroit mais profond." },
      ],
      es: [
        { h: "Cobertura global", b: "Un plan para Tokio, Lisboa y la Patagonia en el mismo chat. Nosotros cubrimos solo Eslovenia." },
        { h: "Vuelos y hoteles", b: "Integraciones con los grandes sistemas de reserva mundiales. Con nosotros reservas experiencias y productos locales, no vuelos." },
        { h: "Planificación en grupo", b: "Colaboración en tiempo real con familia o amigos. Nosotros ofrecemos compartir un plan con encuesta, no la edición en grupo." },
        { h: "Madurez y escala", b: "Millones de usuarios y grandes bases de reseñas. Nosotros somos una plataforma joven con un enfoque estrecho pero profundo." },
      ],
    },
    badTitle: {
      sl: "Kje generalisti pri slovenskih potovanjih razočarajo",
      en: "Where generalists disappoint on Slovenian trips",
      it: "Dove i generalisti deludono sui viaggi in Slovenia",
      de: "Wo Generalisten bei Slowenien-Reisen enttäuschen",
      fr: "Où les généralistes déçoivent pour les voyages en Slovénie",
      es: "Dónde defraudan los generalistas en viajes por Eslovenia",
    },
    badLead: {
      sl: "To niso izmišljene pasti — dokumentirane so v recenzijah AI načrtovalcev (2025–2026) in v naših lastnih testiranjih:",
      en: "These are not invented traps — they are documented in AI planner reviews (2025–2026) and in our own testing:",
      it: "Non sono trappole inventate — sono documentate nelle recensioni dei pianificatori AI (2025–2026) e nei nostri test:",
      de: "Das sind keine erfundenen Fallen — sie sind dokumentiert in Bewertungen von KI-Planern (2025–2026) und in unseren eigenen Tests:",
      fr: "Ce ne sont pas des pièges inventés — ils sont documentés dans les avis sur les planificateurs IA (2025–2026) et dans nos propres tests :",
      es: "No son trampas inventadas — están documentadas en reseñas de planificadores con IA (2025–2026) y en nuestras propias pruebas:",
    },
    bad: {
      sl: [
        { h: "Cene oddaljene od realnosti", b: "Recenzenti Mindtripa poročajo o cenovnih odstopanjih do 20–30 %. Za mestni oddih je to nadležnost; za vikend s proračunom 300 € je to razlika med dvema dnevoma." },
        { h: "Zaprti objekti v načrtu", b: "Klasična past: AI vključi atrakcijo v dan, ko je ta zaprta (znan primer: „Louvre je zaprt ob torkih“). Brez preverjanja odpiralnih časov tega ne more vedeti." },
        { h: "Generični seznami znamenitosti", b: "Isti seznam top-10 za vsakogar. Slovenija je majhna, a lokalna globina — kdaj na Vintgar brez vrste, kje je kremšnita res tista — zahteva specializirane, urejene podatke." },
      ],
      en: [
        { h: "Prices far from reality", b: "Mindtrip reviewers report price deviations of up to 20–30%. For a city break that is a nuisance; for a €300-budget weekend it is the difference between two days." },
        { h: "Closed venues in the plan", b: "A classic trap: the AI includes an attraction on a day it is closed (famous example: “the Louvre is closed on Tuesdays”). Without checking opening hours it cannot know." },
        { h: "Generic sight lists", b: "The same top-10 list for everyone. Slovenia is small, but local depth — when to visit Vintgar without a queue, where the cream cake is really the one — requires specialised, curated data." },
      ],
      it: [
        { h: "Prezzi lontani dalla realtà", b: "I recensori di Mindtrip segnalano scostamenti di prezzo fino al 20–30 %. Per una fuga in città è un fastidio; per un weekend con budget di 300 € è la differenza tra due giorni." },
        { h: "Attrazioni chiuse nel piano", b: "La trappola classica: l'AI inserisce un'attrazione in un giorno in cui è chiusa (esempio famoso: «il Louvre il martedì è chiuso»). Senza controllare gli orari di apertura non può saperlo." },
        { h: "Liste generiche di attrazioni", b: "La stessa top-10 per tutti. La Slovenia è piccola, ma la profondità locale — quando visitare la gola di Vintgar senza fila, dove la kremšnita è davvero quella giusta — richiede dati specializzati e curati." },
      ],
      de: [
        { h: "Preise weit weg von der Realität", b: "Mindtrip-Bewerter berichten von Preisabweichungen bis zu 20–30 %. Für einen Städtetrip ist das ärgerlich; für ein Wochenende mit 300-€-Budget der Unterschied zwischen zwei Tagen." },
        { h: "Geschlossene Orte im Plan", b: "Die klassische Falle: Die KI legt eine Attraktion auf einen Tag, an dem sie geschlossen ist (berühmtes Beispiel: „Der Louvre ist dienstags geschlossen“). Ohne Prüfung der Öffnungszeiten kann sie das nicht wissen." },
        { h: "Generische Sehenswürdigkeitenlisten", b: "Dieselbe Top-10-Liste für alle. Slowenien ist klein, aber lokale Tiefe — wann zur Vintgar-Schlucht ohne Schlange, wo die Cremeschnitte wirklich die richtige ist — erfordert spezialisierte, kuratierte Daten." },
      ],
      fr: [
        { h: "Prix loin de la réalité", b: "Les auteurs d'avis sur Mindtrip signalent des écarts de prix allant jusqu'à 20–30 %. Pour un city-break, c'est agaçant ; pour un week-end avec un budget de 300 €, c'est la différence entre deux jours." },
        { h: "Lieux fermés dans le plan", b: "Le piège classique : l'IA place une attraction un jour de fermeture (exemple célèbre : « le Louvre est fermé le mardi »). Sans vérifier les horaires d'ouverture, elle ne peut pas le savoir." },
        { h: "Listes d'attractions génériques", b: "La même liste top 10 pour tout le monde. La Slovénie est petite, mais la profondeur locale — quand visiter les gorges de Vintgar sans queue, où la kremšnita est vraiment la bonne — exige des données spécialisées et curatées." },
      ],
      es: [
        { h: "Precios lejos de la realidad", b: "Quienes reseñan Mindtrip informan de desviaciones de precio de hasta el 20–30 %. Para una escapada urbana es una molestia; para un fin de semana con presupuesto de 300 € es la diferencia entre dos días." },
        { h: "Lugares cerrados en el plan", b: "La trampa clásica: la IA incluye una atracción un día en que está cerrada (ejemplo famoso: «el Louvre cierra los martes»). Sin comprobar los horarios de apertura no puede saberlo." },
        { h: "Listas genéricas de atracciones", b: "La misma lista top-10 para todos. Eslovenia es pequeña, pero la profundidad local — cuándo ir al desfiladero de Vintgar sin cola, dónde está de verdad la buena kremšnita — exige datos especializados y curados." },
      ],
    },
    tableTitle: {
      sl: "Primerjava na dlani",
      en: "Comparison at a glance",
      it: "Il confronto in breve",
      de: "Der Vergleich auf einen Blick",
      fr: "La comparaison en un coup d'œil",
      es: "La comparación de un vistazo",
    },
    tableCaption: {
      sl: "Primerjava splošnih AI načrtovalcev potovanj s platformo Discover Slovenia AI",
      en: "Comparison of general AI travel planners with the Discover Slovenia AI platform",
      it: "Confronto tra i pianificatori di viaggio AI generalisti e la piattaforma Discover Slovenia AI",
      de: "Vergleich allgemeiner KI-Reiseplaner mit der Plattform Discover Slovenia AI",
      fr: "Comparaison des planificateurs de voyage IA généralistes avec la plateforme Discover Slovenia AI",
      es: "Comparación de los planificadores de viajes con IA generalistas con la plataforma Discover Slovenia AI",
    },
    tableWhat: { sl: "Kaj primerjamo", en: "What we compare", it: "Cosa confrontiamo", de: "Was wir vergleichen", fr: "Ce que nous comparons", es: "Qué comparamos" },
    tableGeneralists: { sl: "Splošni načrtovalci", en: "General planners", it: "Pianificatori generalisti", de: "Allgemeine Planer", fr: "Planificateurs généralistes", es: "Planificadores generalistas" },
    tableUs: { sl: "Discover Slovenia AI", en: "Discover Slovenia AI", it: "Discover Slovenia AI", de: "Discover Slovenia AI", fr: "Discover Slovenia AI", es: "Discover Slovenia AI" },
    table: {
      sl: [
        ["Fokus", "Cel svet", "Samo Slovenija — globoko in preverjeno"],
        ["Račun za shranjevanje načrta", "Pogosto zahtevan (Google/Apple)", "Ni potreben — anonimno shranjevanje in deljenje"],
        ["Preverjanje časov in cen", "Ni sistematično", "Viri + opozorila „preveri pred obiskom“ + geo-validacija"],
        ["Izvedljivost dneva (razdalje, časi)", "Redko preverjena", "Pravi km in minute iz cestnega usmerjanja, opozorilo ob pretesnem dnevu"],
        ["Slovenščina", "Angleščina ali strojni prevod", "4 jeziki kot jedro izdelka (SL/EN/IT/DE)"],
        ["Rezervacije", "Globalni leti in hoteli", "Lokalna doživetja in tržnica s slovenskimi ponudniki"],
        ["Načrt brez povezave", "Pogosto le v aplikacijah", "Da — namesti kot aplikacijo (PWA)"],
        ["Potovanja izven Slovenije", "Da — cel svet", "Ne — odkrito priporočimo generalista"],
      ],
      en: [
        ["Focus", "The whole world", "Only Slovenia — deep and verified"],
        ["Account to save a plan", "Often required (Google/Apple)", "Not needed — anonymous saving and sharing"],
        ["Checking times and prices", "Not systematic", "Sources + “check before visiting” warnings + geo-validation"],
        ["Day feasibility (distances, times)", "Rarely checked", "Real km and minutes from road routing, warning on over-tight days"],
        ["Slovenian language", "English or machine translation", "4 languages as a core product feature (SL/EN/IT/DE)"],
        ["Bookings", "Global flights and hotels", "Local experiences and a marketplace with Slovenian providers"],
        ["Offline plan", "Often apps only", "Yes — install as an app (PWA)"],
        ["Trips outside Slovenia", "Yes — the whole world", "No — we honestly recommend a generalist"],
      ],
      it: [
        ["Focus", "Tutto il mondo", "Solo la Slovenia — in profondità e verificata"],
        ["Account per salvare un piano", "Spesso richiesto (Google/Apple)", "Non serve — salvataggio e condivisione anonimi"],
        ["Verifica di orari e prezzi", "Non sistematica", "Fonti + avvisi «verifica prima di visitare» + validazione geografica"],
        ["Fattibilità della giornata (distanze, tempi)", "Raramente verificata", "Km e minuti reali dal routing stradale, avviso se la giornata è troppo serrata"],
        ["Lingua slovena", "Inglese o traduzione automatica", "4 lingue come parte integrante del prodotto (SL/EN/IT/DE)"],
        ["Prenotazioni", "Voli e hotel globali", "Esperienze locali e un marketplace con fornitori sloveni"],
        ["Piano offline", "Spesso solo nelle app", "Sì — installa come app (PWA)"],
        ["Viaggi fuori dalla Slovenia", "Sì — tutto il mondo", "No — consigliamo onestamente un generalista"],
      ],
      de: [
        ["Fokus", "Die ganze Welt", "Nur Slowenien — tiefgehend und geprüft"],
        ["Konto zum Speichern eines Plans", "Oft erforderlich (Google/Apple)", "Nicht nötig — anonymes Speichern und Teilen"],
        ["Prüfung von Zeiten und Preisen", "Nicht systematisch", "Quellen + „vor dem Besuch prüfen“-Hinweise + Geo-Validierung"],
        ["Tagesmachbarkeit (Distanzen, Zeiten)", "Selten geprüft", "Echte km und Minuten aus dem Routing auf echten Straßen, Warnung bei zu engen Tagen"],
        ["Slowenische Sprache", "Englisch oder Maschinenübersetzung", "4 Sprachen als Kernprodukt (SL/EN/IT/DE)"],
        ["Buchungen", "Globale Flüge und Hotels", "Lokale Erlebnisse und ein Marktplatz mit slowenischen Anbietern"],
        ["Plan offline", "Oft nur in Apps", "Ja — als App installieren (PWA)"],
        ["Reisen außerhalb Sloweniens", "Ja — die ganze Welt", "Nein — wir empfehlen ehrlich einen Generalisten"],
      ],
      fr: [
        ["Focalisation", "Le monde entier", "Seulement la Slovénie — en profondeur et vérifié"],
        ["Compte pour enregistrer un plan", "Souvent requis (Google/Apple)", "Inutile — enregistrement et partage anonymes"],
        ["Vérification des horaires et prix", "Pas systématique", "Sources + avertissements « vérifie avant de visiter » + validation géographique"],
        ["Faisabilité de la journée (distances, temps)", "Rarement vérifiée", "Vrais km et minutes issus du routage routier, alerte en cas de journée trop serrée"],
        ["Langue slovène", "Anglais ou traduction automatique", "4 langues au cœur du produit (SL/EN/IT/DE)"],
        ["Réservations", "Vols et hôtels mondiaux", "Expériences locales et une marketplace avec des prestataires slovènes"],
        ["Plan hors ligne", "Souvent apps uniquement", "Oui — installe comme app (PWA)"],
        ["Voyages hors de Slovénie", "Oui — le monde entier", "Non — nous recommandons honnêtement un généraliste"],
      ],
      es: [
        ["Enfoque", "Todo el mundo", "Solo Eslovenia — en profundidad y verificado"],
        ["Cuenta para guardar un plan", "A menudo requerida (Google/Apple)", "No hace falta — guardado y compartir anónimos"],
        ["Comprobación de horarios y precios", "No sistemática", "Fuentes + avisos «comprueba antes de visitar» + validación geográfica"],
        ["Viabilidad del día (distancias, tiempos)", "Rara vez comprobada", "Km y minutos reales del enrutamiento por carretera, aviso si el día es demasiado ajustado"],
        ["Idioma esloveno", "Inglés o traducción automática", "4 idiomas como núcleo del producto (SL/EN/IT/DE)"],
        ["Reservas", "Vuelos y hoteles globales", "Experiencias locales y un marketplace con proveedores eslovenos"],
        ["Plan sin conexión", "A menudo solo en apps", "Sí — instálalo como app (PWA)"],
        ["Viajes fuera de Eslovenia", "Sí — todo el mundo", "No — recomendamos honestamente un generalista"],
      ],
    },
    tableFoot: {
      sl: "Tabela je poštena do obeh strani: zadnja vrstica je priznanje, ne pomanjkljivost, ki bi jo skrivali.",
      en: "The table is fair to both sides: the last row is an admission, not a flaw we would hide.",
      it: "La tabella è corretta con entrambe le parti: l'ultima riga è un'ammissione, non un difetto da nascondere.",
      de: "Die Tabelle ist fair zu beiden Seiten: Die letzte Zeile ist ein Eingeständnis, kein Mangel, den wir verstecken würden.",
      fr: "Le tableau est équitable envers les deux parties : la dernière ligne est un aveu, pas un défaut que nous cacherions.",
      es: "La tabla es justa con ambas partes: la última fila es una admisión, no un defecto que esconderíamos.",
    },
    practiceTitle: { sl: "Kaj to pomeni v praksi", en: "What this means in practice", it: "Cosa significa nella pratica", de: "Was das in der Praxis bedeutet", fr: "Ce que cela signifie en pratique", es: "Qué significa en la práctica" },
    practice: {
      sl: [
        {
          n: 1,
          h: "December, 15:40, Vintgarska soteska",
          b: "Generalist lahko sotesko mirno vključi v pozno popoldanski načrt. Naš načrtovalec ve, da pozimi ob 16:00 zapira, in te opozori, naj jo prestaviš dopoldan — z virom podatka.",
        },
        {
          n: 2,
          h: "Bled → Bohinj „približno 30 minut“?",
          b: "Ocene časa „iz spomina modela“ znajo odstopati. Povezovalniki med postanki pri nas nosijo dejanske kilometre in minute iz usmerjanja po pravih cestah — vključno z zimskimi odseki.",
        },
        {
          n: 3,
          h: "Koliko te bo dan res stal?",
          b: "Cene vstopnic in lokalnih specialitet črpamo iz urejenega dataseta z viri — vsota na dnevni kartici nekaj pomeni. Kadar podatka ni, to povemo in dodamo opozorilo.",
        },
      ],
      en: [
        {
          n: 1,
          h: "December, 15:40, Vintar Gorge",
          b: "A generalist may calmly slot the gorge into a late-afternoon plan. Our planner knows it closes at 16:00 in winter and warns you to move it to the morning — with the data source.",
        },
        {
          n: 2,
          h: "Bled → Bohinj “about 30 minutes”?",
          b: "Time estimates “from model memory” can drift. Our connectors between stops carry actual kilometres and minutes from routing on real roads — including winter sections.",
        },
        {
          n: 3,
          h: "What will the day really cost you?",
          b: "Ticket and local-speciality prices are drawn from a curated dataset with sources — the sum on the day card means something. When data is missing, we say so and add a warning.",
        },
      ],
      it: [
        {
          n: 1,
          h: "Dicembre, 15:40, gola di Vintgar",
          b: "Un generalista può infilare con calma la gola in un piano tardo-pomeriggiano. Il nostro pianificatore sa che d'inverno chiude alle 16:00 e ti avverte di spostarla al mattino — con la fonte del dato.",
        },
        {
          n: 2,
          h: "Bled → Bohinj «circa 30 minuti»?",
          b: "Le stime dei tempi «dalla memoria del modello» possono discostarsi. I connettori tra le tappe da noi riportano chilometri e minuti effettivi dal routing su strade reali — inclusi i tratti invernali.",
        },
        {
          n: 3,
          h: "Quanto ti costerà davvero la giornata?",
          b: "I prezzi di biglietti e specialità locali provengono da un dataset curato con fonti — la somma sulla scheda del giorno significa qualcosa. Quando manca un dato, lo diciamo e aggiungiamo un avviso.",
        },
      ],
      de: [
        {
          n: 1,
          h: "Dezember, 15:40 Uhr, Vintgar-Schlucht",
          b: "Ein Generalist kann die Schlucht ruhig in einen spätnachmittäglichen Plan einbauen. Unser Planer weiß, dass sie im Winter um 16:00 Uhr schließt, und warnt dich, sie auf den Vormittag zu legen — mit der Datenquelle.",
        },
        {
          n: 2,
          h: "Bled → Bohinj „etwa 30 Minuten“?",
          b: "Zeitschätzungen „aus dem Modellgedächtnis“ können abweichen. Unsere Verbindungen zwischen Stopps tragen echte Kilometer und Minuten aus dem Routing auf echten Straßen — inklusive Winterabschnitten.",
        },
        {
          n: 3,
          h: "Was kostet dich der Tag wirklich?",
          b: "Ticket- und Preise lokaler Spezialitäten stammen aus einem kuratierten Datensatz mit Quellen — die Summe auf der Tageskarte bedeutet etwas. Fehlt ein Datum, sagen wir das und fügen eine Warnung hinzu.",
        },
      ],
      fr: [
        {
          n: 1,
          h: "Décembre, 15 h 40, gorges de Vintgar",
          b: "Un généraliste peut tranquillement caser les gorges dans un plan de fin d'après-midi. Notre planificateur sait qu'elles ferment à 16 h en hiver et te prévient de les déplacer au matin — avec la source de la donnée.",
        },
        {
          n: 2,
          h: "Bled → Bohinj « environ 30 minutes » ?",
          b: "Les estimations de temps « tirées de la mémoire du modèle » peuvent dériver. Nos connecteurs entre étapes affichent les kilomètres et minutes réels du calcul d'itinéraire sur de vraies routes — tronçons hivernaux compris.",
        },
        {
          n: 3,
          h: "Combien te coûtera réellement la journée ?",
          b: "Les prix des billets et des spécialités locales proviennent d'un jeu de données curaté avec sources — le total sur la fiche du jour a un sens. Quand une donnée manque, nous le disons et ajoutons un avertissement.",
        },
      ],
      es: [
        {
          n: 1,
          h: "Diciembre, 15:40, desfiladero de Vintgar",
          b: "Un generalista puede colar el desfiladero sin más en un plan de última hora de la tarde. Nuestro planificador sabe que en invierno cierra a las 16:00 y te avisa de que lo muevas a la mañana — con la fuente del dato.",
        },
        {
          n: 2,
          h: "Bled → Bohinj «unos 30 minutos»?",
          b: "Las estimaciones de tiempo «de la memoria del modelo» pueden desviarse. Nuestros conectores entre paradas muestran kilómetros y minutos reales del enrutamiento por carreteras de verdad — incluidos los tramos de invierno.",
        },
        {
          n: 3,
          h: "¿Cuánto te costará de verdad el día?",
          b: "Los precios de entradas y especialidades locales salen de un conjunto de datos curado con fuentes — la suma en la tarjeta del día significa algo. Cuando falta un dato, lo decimos y añadimos un aviso.",
        },
      ],
    },
    notTitle: {
      sl: "Kdaj Discover Slovenia AI NI pravi zate",
      en: "When Discover Slovenia AI is NOT right for you",
      it: "Quando Discover Slovenia AI NON fa per te",
      de: "Wann Discover Slovenia AI NICHT das Richtige für dich ist",
      fr: "Quand Discover Slovenia AI N'est PAS fait pour toi",
      es: "Cuándo Discover Slovenia AI NO es para ti",
    },
    notBody: {
      sl: "Če načrtuješ potovanje čez mejo, potrebuješ letalske karte ali hotel v tujini — izberi generalista (Layla, Wanderlog ali klepet s ChatGPT/Gemini). To je v redu; tudi mi njih uporabljamo za tuja potovanja. Radi pa te vidimo na slovenskem delu poti.",
      en: "If you are planning a cross-border trip, need flights or a hotel abroad — pick a generalist (Layla, Wanderlog or a chat with ChatGPT/Gemini). That is fine; we use them for foreign trips too. But we would love to see you on the Slovenian leg of your journey.",
      it: "Se progetti un viaggio oltre confine, ti servono voli o un hotel all'estero — scegli un generalista (Layla, Wanderlog o una chat con ChatGPT/Gemini). Va benissimo; anche noi li usiamo per i viaggi all'estero. Ma ci piacerebbe vederti sul tratto sloveno del tuo viaggio.",
      de: "Wenn du eine grenzüberschreitende Reise planst, Flüge oder ein Hotel im Ausland brauchst — wähle einen Generalisten (Layla, Wanderlog oder ein Chat mit ChatGPT/Gemini). Das ist okay; auch wir nutzen sie für Auslandsreisen. Auf dem slowenischen Teil deiner Reise sehen wir dich aber gern.",
      fr: "Si tu planifies un voyage transfrontalier, que tu as besoin de vols ou d'un hôtel à l'étranger — choisis un généraliste (Layla, Wanderlog ou un chat avec ChatGPT/Gemini). C'est très bien ; nous les utilisons aussi pour les voyages à l'étranger. Mais nous serions ravis de te voir sur la partie slovène de ton parcours.",
      es: "Si planificas un viaje transfronterizo, necesitas vuelos u hotel en el extranjero — elige un generalista (Layla, Wanderlog o un chat con ChatGPT/Gemini). Está bien; nosotros también los usamos para viajes al extranjero. Pero nos encantaría verte en el tramo esloveno de tu viaje.",
    },
    tryTitle: { sl: "Poskusi brez prijave", en: "Try it without signing up", it: "Provalo senza registrazione", de: "Probier es ohne Anmeldung", fr: "Essaie sans inscription", es: "Pruébalo sin registro" },
    tryBody: {
      sl: "Od vprašanja do načrta: 30 sekund. Zahtevan račun: nič. Jezik: slovenščina, angleščina, italijanščina ali nemščina.",
      en: "From question to plan: 30 seconds. Account required: none. Language: Slovenian, English, Italian or German.",
      it: "Dalla domanda al piano: 30 secondi. Account richiesto: nessuno. Lingua: sloveno, inglese, italiano o tedesco.",
      de: "Von der Frage zum Plan: 30 Sekunden. Konto nötig: keins. Sprache: Slowenisch, Englisch, Italienisch oder Deutsch.",
      fr: "De la question au plan : 30 secondes. Compte requis : aucun. Langue : slovène, anglais, italien ou allemand.",
      es: "De la pregunta al plan: 30 segundos. Cuenta requerida: ninguna. Idioma: esloveno, inglés, italiano o alemán.",
    },
    ctaPlan: { sl: "Sestavi moj načrt", en: "Build my plan", it: "Crea il mio piano", de: "Meinen Plan erstellen", fr: "Créer mon plan", es: "Crea mi plan" },
    ctaDest: { sl: "Razišči destinacije", en: "Explore destinations", it: "Esplora le destinazioni", de: "Destinationen entdecken", fr: "Explorer les destinations", es: "Explora los destinos" },
    ctaMap: { sl: "Odpri zemljevid", en: "Open the map", it: "Apri la mappa", de: "Karte öffnen", fr: "Ouvrir la carte", es: "Abre el mapa" },
    faqTitle: { sl: "Pogosta vprašanja", en: "Frequently asked questions", it: "Domande frequenti", de: "Häufige Fragen", fr: "Questions fréquentes", es: "Preguntas frecuentes" },
    faq: {
      sl: [
        {
          h: "Ali potrebujem račun, da načrtujem potovanje?",
          b: "Ne. Načrt ustvariš, shraniš in deliš povsem brez prijave — deluje anonimno. Prosti račun je neobvezen in doda le zgodovino potovanj na strani Moja potovanja.",
        },
        {
          h: "Koliko stane uporaba?",
          b: "Načrtovalec, itinererji, vodiči in deljenje so brezplačni. Platforma zasluži z rezervacijami lokalnih doživetij in prodajo na tržnici — ne s tvojimi podatki.",
        },
        {
          h: "Kaj če potujem izven Slovenije?",
          b: "Iskreno: za čezmejna potovanja uporabi generalista (na primer Layla, Wanderlog, Mindtrip) ali klepet z AI. Mi pokrivamo samo Slovenijo — a jo pokrivamo globoko, s preverjenimi lokalnimi podatki.",
        },
        {
          h: "Kako zanesljivi so tvoji podatki?",
          b: "Podatke za destinacije urejamo uredniško, cene in odpiralni časi imajo vire, vsak načrt pa gre skozi geo-validacijo z opozorili. Kadar nismo prepričani, piše „preveri pred obiskom“. Metodologija je javna na strani Vir podatkov.",
        },
        {
          h: "Do zdaj sem uporabljal(a) Mindtrip — zakaj preklopiti?",
          b: "Mindtrip je bil dober generalist; ob preverbi 28. 9. 2026 je bilo celo njihovo spletno okolje (stran, prijava, API) nedosegljivo, o vzroku pa ne moremo soditi. Za slovenska potovanja pri nas dobiš: načrtovanje brez prijave, štiri jezike, preverjene lokalne podatke in rezervacije pri lokalnih ponudnikih. Presodi sam — poskus brez prijave traja 30 sekund.",
        },
        {
          h: "Kaj se je zgodilo z Mindtripom?",
          b: "Iskreno: vemo le, kar smo preverili. 28. septembra 2026 je celoten njihov spletni orodnik (mindtrip.ai, prijava, API) prikazoval stran „Under Construction“; o izpadu nismo našli medijske pokritosti, recenzije iz 22.–23. septembra pa jih medtem še uvrščajo med najboljša brezplačna AI orodja za načrtovanje. Ne ugibamo o vzrokih ali prihodnosti — trenutno stanje preveri neposredno pri njih.",
        },
      ],
      en: [
        {
          h: "Do I need an account to plan a trip?",
          b: "No. You create, save and share a plan entirely without signing in — it works anonymously. A free account is optional and only adds trip history on the My trips page.",
        },
        {
          h: "How much does it cost?",
          b: "The planner, itineraries, guides and sharing are free. The platform earns from local experience bookings and marketplace sales — not from your data.",
        },
        {
          h: "What if I travel outside Slovenia?",
          b: "Honestly: for cross-border trips use a generalist (e.g. Layla, Wanderlog, Mindtrip) or an AI chat. We cover only Slovenia — but we cover it deeply, with verified local data.",
        },
        {
          h: "How reliable is your data?",
          b: "Destination data is editorially curated, prices and opening hours carry sources, and every plan goes through geo-validation with warnings. When we are not sure, it says “check before visiting”. The methodology is public on the Data sources page.",
        },
        {
          h: "I have been using Mindtrip — why switch?",
          b: "Mindtrip was a good generalist; at our 28 Sep 2026 check their entire web environment (site, sign-in, API) was unreachable, and we cannot judge the cause. For Slovenian trips you get here: no-sign-up planning, four languages, verified local data and bookings with local providers. Judge for yourself — a no-sign-up trial takes 30 seconds.",
        },
        {
          h: "What happened to Mindtrip?",
          b: "Honestly: we only know what we verified. On 28 September 2026 their entire web toolkit (mindtrip.ai, sign-in, API) showed an “Under Construction” page; we found no media coverage of the outage, while reviews from 22–23 September still rank them among the best free AI planning tools. We do not guess about causes or the future — check the current state directly with them.",
        },
      ],
      it: [
        {
          h: "Serve un account per pianificare un viaggio?",
          b: "No. Crei, salvi e condividi un piano del tutto senza registrazione — funziona in forma anonima. L'account gratuito è facoltativo e aggiunge solo la cronologia dei viaggi nella pagina I miei viaggi.",
        },
        {
          h: "Quanto costa l'uso?",
          b: "Pianificatore, itinerari, guide e condivisione sono gratuiti. La piattaforma guadagna dalle prenotazioni di esperienze locali e dalle vendite nel marketplace — non dai tuoi dati.",
        },
        {
          h: "E se viaggio fuori dalla Slovenia?",
          b: "Onestamente: per i viaggi oltre confine usa un generalista (per esempio Layla, Wanderlog, Mindtrip) o una chat con l'AI. Noi copriamo solo la Slovenia — ma la copriamo in profondità, con dati locali verificati.",
        },
        {
          h: "Quanto sono affidabili i vostri dati?",
          b: "I dati delle destinazioni sono curati editorialmente, prezzi e orari di apertura hanno fonti e ogni piano passa da una validazione geografica con avvisi. Quando non siamo sicuri, c'è scritto «verifica prima di visitare». La metodologia è pubblica sulla pagina Fonte dei dati.",
        },
        {
          h: "Finora ho usato Mindtrip — perché passare?",
          b: "Mindtrip era un buon generalista; alla verifica del 28 set 2026 l'intero loro ambiente web (sito, accesso, API) era irraggiungibile e non possiamo giudicarne la causa. Per i viaggi in Slovenia qui trovi: pianificazione senza registrazione, quattro lingue, dati locali verificati e prenotazioni presso fornitori locali. Giudica tu — una prova senza registrazione richiede 30 secondi.",
        },
        {
          h: "Cosa è successo a Mindtrip?",
          b: "Onestamente: sappiamo solo ciò che abbiamo verificato. Il 28 settembre 2026 l'intero loro toolkit web (mindtrip.ai, accesso, API) mostrava una pagina «Under Construction»; non abbiamo trovato copertura mediatica dell'interruzione, mentre le recensioni del 22–23 settembre li collocano ancora tra i migliori strumenti AI gratuiti di pianificazione. Non speculiamo su cause o futuro — verifica lo stato attuale direttamente con loro.",
        },
      ],
      de: [
        {
          h: "Brauche ich ein Konto, um eine Reise zu planen?",
          b: "Nein. Du erstellst, speicherst und teilst einen Plan ganz ohne Anmeldung — es funktioniert anonym. Ein kostenloses Konto ist optional und ergänzt nur den Reiseverlauf auf der Seite Meine Reisen.",
        },
        {
          h: "Was kostet die Nutzung?",
          b: "Planer, Itinerare, Guides und Teilen sind kostenlos. Die Plattform verdient an Buchungen lokaler Erlebnisse und Verkäufen im Marktplatz — nicht an deinen Daten.",
        },
        {
          h: "Was, wenn ich außerhalb Sloweniens reise?",
          b: "Ehrlich: Nutze für grenzüberschreitende Reisen einen Generalisten (etwa Layla, Wanderlog, Mindtrip) oder einen KI-Chat. Wir decken nur Slowenien ab — aber tief, mit geprüften lokalen Daten.",
        },
        {
          h: "Wie zuverlässig sind eure Daten?",
          b: "Destinationsdaten sind redaktionell kuratiert, Preise und Öffnungszeiten tragen Quellen, und jeder Plan durchläuft eine Geo-Validierung mit Warnungen. Wo wir uns nicht sicher sind, steht „vor dem Besuch prüfen“. Die Methodik ist auf der Seite Datenquellen öffentlich.",
        },
        {
          h: "Ich habe bisher Mindtrip genutzt — warum wechseln?",
          b: "Mindtrip war ein guter Generalist; bei unserer Prüfung am 28.09.2026 war ihre gesamte Web-Umgebung (Seite, Anmeldung, API) unerreichbar, und über die Ursache können wir nicht urteilen. Für Slowenien-Reisen bekommst du hier: Planung ohne Anmeldung, vier Sprachen, geprüfte lokale Daten und Buchungen bei lokalen Anbietern. Urteile selbst — ein Test ohne Anmeldung dauert 30 Sekunden.",
        },
        {
          h: "Was ist mit Mindtrip passiert?",
          b: "Ehrlich: Wir wissen nur, was wir geprüft haben. Am 28. September 2026 zeigte ihr gesamtes Web-Toolkit (mindtrip.ai, Anmeldung, API) eine „Under Construction“-Seite; wir fanden keine Medienberichte über den Ausfall, während Bewertungen vom 22.–23. September sie weiterhin unter die besten kostenlosen KI-Planungswerkzeuge reihen. Wir spekulieren nicht über Ursachen oder Zukunft — prüfe den aktuellen Stand direkt bei ihnen.",
        },
      ],
      fr: [
        {
          h: "Faut-il un compte pour planifier un voyage ?",
          b: "Non. Tu crées, enregistres et partages un plan entièrement sans connexion — cela fonctionne anonymement. Un compte gratuit est facultatif et ajoute seulement l'historique des voyages sur la page Mes voyages.",
        },
        {
          h: "Combien coûte l'utilisation ?",
          b: "Le planificateur, les itinéraires, les guides et le partage sont gratuits. La plateforme gagne de l'argent grâce aux réservations d'expériences locales et aux ventes sur la marketplace — pas grâce à tes données.",
        },
        {
          h: "Et si je voyage hors de Slovénie ?",
          b: "Honnêtement : pour les voyages transfrontaliers, utilise un généraliste (par exemple Layla, Wanderlog, Mindtrip) ou un chat IA. Nous ne couvrons que la Slovénie — mais en profondeur, avec des données locales vérifiées.",
        },
        {
          h: "Vos données sont-elles fiables ?",
          b: "Les données des destinations sont curatées par la rédaction, les prix et horaires d'ouverture portent leurs sources, et chaque plan passe par une validation géographique avec avertissements. Quand nous ne sommes pas sûrs, il est écrit « vérifie avant de visiter ». La méthodologie est publique sur la page Sources des données.",
        },
        {
          h: "J'utilise Mindtrip jusqu'ici — pourquoi changer ?",
          b: "Mindtrip était un bon généraliste ; lors de notre vérification du 28 sept. 2026, tout leur environnement web (site, connexion, API) était injoignable et nous ne pouvons pas juger la cause. Pour les voyages en Slovénie, tu trouves ici : planification sans inscription, quatre langues, données locales vérifiées et réservations chez des prestataires locaux. Juge par toi-même — un essai sans inscription prend 30 secondes.",
        },
        {
          h: "Qu'est-il arrivé à Mindtrip ?",
          b: "Honnêtement : nous ne savons que ce que nous avons vérifié. Le 28 septembre 2026, toute leur boîte à outils web (mindtrip.ai, connexion, API) affichait une page « Under Construction » ; nous n'avons trouvé aucune couverture médiatique de la panne, tandis que les avis des 22–23 septembre les classent encore parmi les meilleurs outils gratuits de planification IA. Nous ne spéculons ni sur les causes ni sur l'avenir — vérifie l'état actuel directement auprès d'eux.",
        },
      ],
      es: [
        {
          h: "¿Necesito una cuenta para planificar un viaje?",
          b: "No. Creas, guardas y compartes un plan totalmente sin registro — funciona de forma anónima. Una cuenta gratuita es opcional y solo añade el historial de viajes en la página Mis viajes.",
        },
        {
          h: "¿Cuánto cuesta usarlo?",
          b: "El planificador, los itinerarios, las guías y el compartir son gratuitos. La plataforma gana con las reservas de experiencias locales y las ventas del marketplace — no con tus datos.",
        },
        {
          h: "¿Y si viajo fuera de Eslovenia?",
          b: "Honestamente: para viajes transfronterizados usa un generalista (por ejemplo Layla, Wanderlog, Mindtrip) o un chat con IA. Nosotros cubrimos solo Eslovenia — pero la cubrimos en profundidad, con datos locales verificados.",
        },
        {
          h: "¿Cómo de fiables son vuestros datos?",
          b: "Los datos de los destinos los cura la redacción, los precios y horarios de apertura llevan fuentes, y cada plan pasa por una validación geográfica con avisos. Cuando no estamos seguros, pone «comprueba antes de visitar». La metodología es pública en la página Fuente de datos.",
        },
        {
          h: "Hasta ahora usaba Mindtrip — ¿por qué cambiar?",
          b: "Mindtrip era un buen generalista; en nuestra comprobación del 28 sep 2026 todo su entorno web (sitio, inicio de sesión, API) estaba inaccesible y no podemos juzgar la causa. Para viajes por Eslovenia aquí tienes: planificación sin registro, cuatro idiomas, datos locales verificados y reservas con proveedores locales. Juzga tú — una prueba sin registro tarda 30 segundos.",
        },
        {
          h: "¿Qué le ha pasado a Mindtrip?",
          b: "Honestamente: solo sabemos lo que verificamos. El 28 de septiembre de 2026 todo su conjunto web (mindtrip.ai, inicio de sesión, API) mostraba una página «Under Construction»; no encontramos cobertura mediática de la caída, mientras que las reseñas del 22–23 de septiembre aún los situaban entre las mejores herramientas gratuitas de planificación con IA. No especulamos sobre causas ni futuro — comprueba el estado actual directamente con ellos.",
        },
      ],
    },
    footNote: {
      sl: "Primerjava temelji na javno dostopnih recenzijah (2025–2026) in uredniški analizi platforme (september 2026).",
      en: "The comparison draws on publicly available reviews (2025–2026) and editorial analysis of the platform (September 2026).",
      it: "Il confronto si basa su recensioni pubblicamente disponibili (2025–2026) e sull'analisi editoriale della piattaforma (settembre 2026).",
      de: "Der Vergleich beruht auf öffentlich verfügbaren Bewertungen (2025–2026) und redaktioneller Analyse der Plattform (September 2026).",
      fr: "La comparaison s'appuie sur des avis publiquement disponibles (2025–2026) et sur l'analyse éditoriale de la plateforme (septembre 2026).",
      es: "La comparación se basa en reseñas disponibles públicamente (2025–2026) y en el análisis editorial de la plataforma (septiembre de 2026).",
    },
    footLinks: { sl: "Vir podatkov · zaupanje in varnost", en: "Data sources · trust and safety", it: "Fonte dei dati · fiducia e sicurezza", de: "Datenquellen · Vertrauen und Sicherheit", fr: "Sources des données · confiance et sécurité", es: "Fuente de datos · confianza y seguridad" },
  } as const;

  const rows = pick(l, L.table);
  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={t("kicker")} title={t("title")} lead={t("lead")} />
      <p className="mt-3 text-sm text-muted-foreground">{t("updated")}</p>

      {/* Teren — datirane preverbe */}
      <section aria-labelledby="teren-h" className="mt-12 scroll-mt-24">
        <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">
          {t("terenKicker")}
        </p>
        <h2 id="teren-h" className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">
          {t("terenTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("terenLead")}
        </p>
        <div className="mt-5 space-y-3">
          {pick(l, L.teren).map((item) => (
            <Card key={item.h} className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="flex items-start gap-3 p-5">
                <SearchCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-bold sm:text-base">{item.h}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.b}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-4 rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] to-card p-4 text-sm leading-relaxed text-muted-foreground">
          {t("terenFoot")}
        </p>
      </section>

      {/* Kaj generalisti delajo odlično */}
      <section aria-labelledby="good-h" className="mt-12 scroll-mt-24">
        <h2 id="good-h" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("goodTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("goodLead")}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {pick(l, L.good).map((item) => (
            <Card key={item.h} className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <BadgeCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {item.h}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.b}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Kje generalisti razočarajo */}
      <section aria-labelledby="bad-h" className="mt-12 scroll-mt-24">
        <h2 id="bad-h" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("badTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("badLead")}
        </p>
        <div className="mt-5 space-y-3">
          {pick(l, L.bad).map((item) => (
            <Card key={item.h} className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="flex items-start gap-3 p-5">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-bold sm:text-base">{item.h}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.b}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tabela primerjave */}
      <section aria-labelledby="table-h" className="mt-12 scroll-mt-24">
        <h2 id="table-h" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("tableTitle")}
        </h2>
        <div className="mt-5 overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("tableCaption")}</caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="p-3 font-semibold sm:p-4">
                  {t("tableWhat")}
                </th>
                <th scope="col" className="p-3 font-semibold sm:p-4">
                  {t("tableGeneralists")}
                </th>
                <th scope="col" className="p-3 font-semibold text-primary sm:p-4">
                  {t("tableUs")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([what, them, us]) => (
                <tr key={what} className="border-t">
                  <th scope="row" className="p-3 text-left font-medium sm:p-4">
                    {what}
                  </th>
                  <td className="p-3 text-muted-foreground sm:p-4">{them}</td>
                  <td className="p-3 font-medium sm:p-4">{us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("tableFoot")}</p>
      </section>

      {/* Praksa */}
      <section aria-labelledby="practice-h" className="mt-12 scroll-mt-24">
        <h2 id="practice-h" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("practiceTitle")}
        </h2>
        <ol className="mt-5 space-y-3">
          {pick(l, L.practice).map((item) => (
            <li key={item.n}>
              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardContent className="flex items-start gap-4 p-5">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                  >
                    {item.n}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold sm:text-base">{item.h}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {item.b}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Kdaj NI pravi zate + CTA */}
      <section
        aria-labelledby="not-h"
        className="mt-12 scroll-mt-24 rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-primary/5 p-6 sm:p-10"
      >
        <h2 id="not-h" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("notTitle")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("notBody")}
        </p>
        <h3 className="mt-8 text-lg font-bold">{t("tryTitle")}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("tryBody")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="tap-target font-semibold">
            <Link href="/nacrtuj">
              {t("ctaPlan")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="tap-target font-semibold">
            <Link href="/destinacije">{t("ctaDest")}</Link>
          </Button>
          <Button asChild variant="ghost" className="tap-target font-semibold">
            <Link href="/zemljevid">
              <MapIcon className="size-4" aria-hidden="true" />
              {t("ctaMap")}
            </Link>
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-h" className="mt-12 scroll-mt-24">
        <h2 id="faq-h" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("faqTitle")}
        </h2>
        <div className="mt-5 space-y-3">
          {pick(l, L.faq).map((item) => (
            <Card key={item.h} className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-balance sm:text-base">
                  {item.h}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.b}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="mt-12 border-t pt-6 text-sm text-muted-foreground">
        <p>{t("footNote")}</p>
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <Compass className="size-4 text-primary" aria-hidden="true" />
          <Link href="/vir-podatkov" className="font-medium text-primary hover:underline">
            {t("footLinks")}
          </Link>
        </p>
      </footer>
    </div>
  );
}
