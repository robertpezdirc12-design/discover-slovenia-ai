const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_TIMEOUT_MS = 8_000;

export type SendMagicLinkResult =
  | { ok: true; devLink?: string }
  | { ok: false; reason: 'not-configured' | 'send-failed' };

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Pošlje enkratno prijavno povezavo prek Resenda.
 *
 * V razvoju brez `RESEND_API_KEY` povezave ne pošiljamo, ampak jo izpišemo
 * v terminal in vrnemo UI-ju (`devLink`). V produkciji je odsotna
 * konfiguracija trda napaka — nikoli ne vračamo povezave napadalcu.
 */
export async function sendMagicLinkEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}): Promise<SendMagicLinkResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[auth] Razvojna prijavna povezava za ${to}: ${url}`);
      return { ok: true, devLink: url };
    }
    return { ok: false, reason: 'not-configured' };
  }

  const safeUrl = escapeHtml(url);
  const text = [
    'Pozdravljeni,',
    '',
    'za prijavo v Discover Slovenia AI odprite spodnjo povezavo in potrdite prijavo:',
    url,
    '',
    'Povezava velja 15 minut in jo je mogoče uporabiti samo enkrat.',
    'Če prijave niste zahtevali, sporočilo ignorirajte.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="sl">
  <body style="margin:0;background:#f6f7f5;padding:24px;font-family:Arial,sans-serif;color:#1f2a24">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dfe5df;border-radius:12px;padding:28px">
      <h1 style="margin:0 0 16px;font-size:22px">Prijava v Discover Slovenia AI</h1>
      <p style="margin:0 0 20px;line-height:1.6">Za prijavo v svoj profil odprite spodnjo povezavo.</p>
      <p style="margin:0 0 20px">
        <a href="${safeUrl}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:600">Odpri povezavo za prijavo</a>
      </p>
      <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#52605a">Povezava velja 15 minut in jo je mogoče uporabiti samo enkrat. Če gumb ne deluje, kopirajte naslov:<br><span style="word-break:break-all">${safeUrl}</span></p>
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#52605a">Če prijave niste zahtevali, sporočilo ignorirajte.</p>
    </div>
  </body>
</html>`;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Prijava v Discover Slovenia AI',
        text,
        html,
      }),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error('auth: pošiljanje e-pošte ni uspelo (Resend)', response.status);
      return { ok: false, reason: 'send-failed' };
    }

    return { ok: true };
  } catch (err) {
    console.error(
      'auth: pošiljanje e-pošte ni uspelo',
      err instanceof Error ? err.message : err,
    );
    return { ok: false, reason: 'send-failed' };
  }
}
