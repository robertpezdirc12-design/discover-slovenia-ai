/**
 * E-POŠTA — tanek, iskren sloj nad Resend REST API (P3, kanon 2.26.0).
 * ============================================================================
 * Kanoni (isti duh kot STRIPE_/AFFILIATE_ vrata):
 *  - 0 odvisnosti: čisti fetch na https://api.resend.com/emails (brez SDK);
 *  - FAIL-CLOSED / ISKRENO: brez RESEND_API_KEY NOBENO mesto ne pošilja in
 *    NE trdi, da je poslalo — klicatelj dobi { sent:false, reason:
 *    "not_configured" } in to iskreno pokaže uporabniku (npr. „povezavo
 *    kopiraj in deli ročno"). Nikoli ne ponaredimo uspeha;
 *  - NIKOLI ne meče izjem: vsak klic vrne SendResult; napaka je v razlogu;
 *  - TIMEOUT 8 s (Hobby-varno): e-pošta ne sme zadržati glavne zahteve;
 *  - ZASEBNOST: naslovi prejemnikov gredo SAMO na Resend; v AuditLog/piškotke
 *    ne zapisujemo vsebine pošte; URL-ji v e-pošti so javne povezave
 *    (vabilo žeton / žeton konzultacije — lastnik povezave = poznalec);
 *  - VSEBINA: preprost HTML z inline stili (odjemalci ne nalagajo CSS);
 *    besedilna (text) različica je vedno priložena (dostopnost);
 *  - From: RESEND_FROM (privzeto Resendov testni pošiljatelj — lastnik ga
 *    nastavi na lastno domeno, ko domeno potrdi pri Resend).
 *
 * Testiranje: fetchImpl je injiciran (0 omrežja v testih).
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult =
  | { sent: true; id?: string }
  | {
      sent: false;
      reason: "not_configured" | "invalid_recipient" | "http_error" | "network_error" | "timeout";
      detail?: string;
    };

/** Ali je pošiljanje sploh konfigurirano (iskreni indikator za UI/cron). */
export function isEmailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  return typeof key === "string" && key.trim().length >= 10;
}

/** Enostavna veljavnost naslova (dobra za vrata pred pošiljanjem). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email) && email.length <= 160;
}

/** Pošiljatelj (privzeto Resendov testni — iskren začetek brez domene). */
export function emailFrom(): string {
  const custom = process.env.RESEND_FROM;
  if (custom && custom.includes("@") && custom.length <= 160) return custom;
  return "Discover Slovenia AI <onboarding@resend.dev>";
}

/**
 * Pošlje e-pošto prek Resend REST API. NIKOLI ne vrže izjeme.
 * fetchImpl je injiciran za teste (privzeto globalni fetch).
 */
export async function sendEmail(
  input: SendEmailInput,
  fetchImpl: typeof fetch = fetch
): Promise<SendResult> {
  if (!isEmailConfigured()) {
    return { sent: false, reason: "not_configured" };
  }
  if (!isValidEmail(input.to)) {
    return { sent: false, reason: "invalid_recipient", detail: input.to.slice(0, 60) };
  }
  try {
    const r = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [input.to],
        subject: input.subject.slice(0, 200),
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) {
      const detail = (await r.text().catch(() => "")).slice(0, 200);
      return { sent: false, reason: "http_error", detail: `HTTP ${r.status} ${detail}` };
    }
    const data = (await r.json().catch(() => null)) as { id?: string } | null;
    return { sent: true, id: data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    if (/abort|timeout/i.test(msg)) {
      return { sent: false, reason: "timeout", detail: msg.slice(0, 200) };
    }
    return { sent: false, reason: "network_error", detail: msg.slice(0, 200) };
  }
}

/**
 * Javni izvor strani za povezave v e-pošti (serverlese-varno):
 * NEXT_PUBLIC_SITE_URL (env) → x-forwarded-host → host → URL zahteve.
 */
export function publicOrigin(req: Request): string {
  const envSite = process.env.NEXT_PUBLIC_SITE_URL;
  if (envSite && /^https:\/\//.test(envSite)) return envSite.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  try {
    return new URL(req.url).origin;
  } catch {
    return "https://i-feel-slovenia.vercel.app";
  }
}

// ---------------------------------------------------------------------------
// Predloge (preprost inline-stil HTML; brez zunanje CSS/SLIK — vsebine
// ne spreminjamo glede na sledenje; samo javne povezave).
// ---------------------------------------------------------------------------

const WRAP_STYLE =
  "margin:0;padding:0;background:#f6f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
const CARD_STYLE =
  "max-width:560px;margin:24px auto;background:#ffffff;border-radius:12px;border:1px solid #e4e7e4;padding:28px;";
const H_STYLE = "margin:0 0 12px;font-size:20px;line-height:1.3;color:#14532d;";
const P_STYLE = "margin:0 0 14px;font-size:15px;line-height:1.6;color:#1f2937;";
const A_STYLE =
  "display:inline-block;margin:8px 0 16px;padding:12px 22px;background:#166534;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;";
const SMALL_STYLE = "margin:0;font-size:12px;line-height:1.5;color:#6b7280;";

function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="sl"><body style="${WRAP_STYLE}"><div style="${CARD_STYLE}">
<h1 style="${H_STYLE}">${title}</h1>
${bodyHtml}
<p style="${SMALL_STYLE}">Sporočilo je poslal Discover Slovenia AI — i-feel-slovenia.vercel.app. Odjavo lahko kadar koli sporočiš na odgovor tega sporočila.</p>
</div></body></html>`;
}

/** Vabilo na skupinsko pot (lastnik izda žeton; prejemnik = kdorkoli z e-pošto). */
export function tripInviteEmail(args: {
  tripTitle: string;
  inviteUrl: string;
  role: "EDITOR" | "VIEWER";
  inviterName: string;
}): { subject: string; html: string; text: string } {
  const roleText = args.role === "EDITOR" ? "sooblikovalec" : "opazovalec";
  const link = args.inviteUrl.startsWith("http") ? args.inviteUrl : `https://i-feel-slovenia.vercel.app${args.inviteUrl}`;
  return {
    subject: `Vabilo na skupinsko pot: ${args.tripTitle}`,
    html: emailShell(
      `Vabilo na pot „${args.tripTitle}“`,
      `<p style="${P_STYLE}">${args.inviterName} te vabi na skupinsko potovanje <strong>${args.tripTitle}</strong> — kot ${roleText}.</p>
<p style="${P_STYLE}">Skupna pot pomeni: skupen načrt, ankete za odločitve, rezervacije in klepet z @AI svetovalcem, ki odgovarja SAMO iz preverjenih slovenskih podatkov.</p>
<a href="${link}" style="${A_STYLE}">Odpri potovanje</a>
<p style="${SMALL_STYLE}">Povezava je osebna (žeton). Če je ne prepoznaš kot svojo, sporočilo ignoriraj.</p>`
    ),
    text: `${args.inviterName} te vabi na skupinsko potovanje "${args.tripTitle}" (vloga: ${roleText}).\n\nOdpri: ${link}\n\nPovezava je osebna (žeton). Discover Slovenia AI — i-feel-slovenia.vercel.app`,
  };
}

/** Odgovor na konzultacijo (zasebna stran z žetonom). */
export function consultationAnswerEmail(args: {
  question: string;
  answerUrl: string;
}): { subject: string; html: string; text: string } {
  const link = args.answerUrl.startsWith("http") ? args.answerUrl : `https://i-feel-slovenia.vercel.app${args.answerUrl}`;
  const q = args.question
    .slice(0, 140)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return {
    subject: "Tvoj potovalni nasvet je pripravljen",
    html: emailShell(
      "Tvoj potovalni nasvet je pripravljen",
      `<p style="${P_STYLE}">Odgovor na tvoje vprašanje je pripravljen:</p>
<p style="${P_STYLE}"><em>„${q}${args.question.length > 140 ? "…" : ""}“</em></p>
<a href="${link}" style="${A_STYLE}">Preberi odgovor</a>
<p style="${SMALL_STYLE}">Povezava je zasebna (žeton) — kdorkoli jo ima, lahko prebere odgovor, zato je ne deli naprej.</p>`
    ),
    text: `Odgovor na tvoje potovalno vprašanje je pripravljen.\n\nVprašanje: "${args.question.slice(0, 140)}"\n\nPreberi (zasebna povezava): ${link}\n\nDiscover Slovenia AI — i-feel-slovenia.vercel.app`,
  };
}

/** Opomnik partnerju o zamujenem osnutku (dnevni cron). */
export function draftReminderEmail(args: {
  productName: string;
  daysOld: number;
  partnerUrl: string;
}): { subject: string; html: string; text: string } {
  const link = args.partnerUrl.startsWith("http") ? args.partnerUrl : `https://i-feel-slovenia.vercel.app${args.partnerUrl}`;
  return {
    subject: `Osnutek „${args.productName}“ čaka (${args.daysOld} dni)`,
    html: emailShell(
      "Tvoj osnutek čaka na dokončanje",
      `<p style="${P_STYLE}">Osnutek <strong>${args.productName}</strong> je zadnjič spremenjen pred ${args.daysOld} dnevi in še ni objavljen.</p>
<p style="${P_STYLE}">Objavljeni izdelki in doživetja so vidni v tržnici — obiskovalci jih lahko rezervirajo.</p>
<a href="${link}" style="${A_STYLE}">Odpri osnutek</a>
<p style="${SMALL_STYLE}">To je samodejni dnevni opomnik; največ en na osnutek v 7 dneh.</p>`
    ),
    text: `Osnutek "${args.productName}" čaka na dokončanje (zadnja sprememba pred ${args.daysOld} dnevi).\n\nOdpri: ${link}\n\nSamodejni opomnik Discover Slovenia AI (največ 1× na 7 dni).`,
  };
}

/** Pozdrav ob prijavi na novice (samo NOVI naročniki). */
export function newsletterWelcomeEmail(): { subject: string; html: string; text: string } {
  return {
    subject: "Dobrodošel med popotniki",
    html: emailShell(
      "Dobrodošel med popotniki",
      `<p style="${P_STYLE}">Hvala za prijavo na novice Discover Slovenia AI.</p>
<p style="${P_STYLE}">Pošiljamo samo preverjene popotniške vsebine: ideje za izlete po Sloveniji, iskene opombe o sezonah in nove prednastavitve načrtov. Brez kupljenih seznamov, brez izmišljenih „izključnih ponudb“.</p>
<a href="https://i-feel-slovenia.vercel.app/nacrtuj" style="${A_STYLE}">Načrtuj prvo pot</a>`
    ),
    text: "Hvala za prijavo na novice Discover Slovenia AI.\n\nPošiljamo samo preverjene popotniške vsebine.\n\nZačni tukaj: https://i-feel-slovenia.vercel.app/nacrtuj",
  };
}
