/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from 'bun:test';
import { sendMagicLinkEmail } from '../src/lib/email';

const URL = 'https://example.com/prijava/potrdi?token=test-token';

function setEnv(values: { key?: string; from?: string; nodeEnv?: string }) {
  const env = process.env as Record<string, string | undefined>;
  if (values.key === undefined) delete env.RESEND_API_KEY;
  else env.RESEND_API_KEY = values.key;

  if (values.from === undefined) delete env.AUTH_EMAIL_FROM;
  else env.AUTH_EMAIL_FROM = values.from;

  if (values.nodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = values.nodeEnv;
}

const env = process.env as Record<string, string | undefined>;
const originalEnv = {
  key: env.RESEND_API_KEY,
  from: env.AUTH_EMAIL_FROM,
  nodeEnv: env.NODE_ENV,
};
const originalFetch = globalThis.fetch;

afterEach(() => {
  setEnv(originalEnv);
  globalThis.fetch = originalFetch;
});

describe('email — magic link prek Resenda', () => {
  test('v razvoju brez ključa vrne devLink in ne pošilja', async () => {
    setEnv({ nodeEnv: 'development' });
    const info = console.info;
    console.info = () => {};
    try {
      const result = await sendMagicLinkEmail({ to: 'ana@example.com', url: URL });
      expect(result).toEqual({ ok: true, devLink: URL });
    } finally {
      console.info = info;
    }
  });

  test('v produkciji brez konfiguracije ne izda povezave', async () => {
    setEnv({ nodeEnv: 'production' });
    const result = await sendMagicLinkEmail({ to: 'ana@example.com', url: URL });
    expect(result).toEqual({ ok: false, reason: 'not-configured' });
  });

  test('pošlje pravilno zahtevo na Resend in ne vrne povezave', async () => {
    setEnv({ nodeEnv: 'production', key: 're_test', from: 'Discover <prijava@example.com>' });
    let captured: { url: string; init?: RequestInit } | null = null;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), init };
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const result = await sendMagicLinkEmail({ to: 'ana@example.com', url: URL });
    expect(result).toEqual({ ok: true });
    expect(captured).not.toBeNull();
    expect(captured!.url).toBe('https://api.resend.com/emails');
    expect(captured!.init?.method).toBe('POST');
    expect(captured!.init?.headers).toMatchObject({
      authorization: 'Bearer re_test',
      'content-type': 'application/json',
    });

    const body = JSON.parse(String(captured!.init?.body));
    expect(body.from).toBe('Discover <prijava@example.com>');
    expect(body.to).toEqual(['ana@example.com']);
    expect(body.subject).toContain('Discover Slovenia AI');
    expect(body.text).toContain(URL);
    expect(body.html).toContain(URL);
    expect(body).not.toHaveProperty('devLink');
  });

  test('napaka ponudnika je fail-closed in ne razkrije povezave', async () => {
    setEnv({ nodeEnv: 'production', key: 're_test', from: 'Discover <prijava@example.com>' });
    globalThis.fetch = (async () => new Response('napaka', { status: 500 })) as unknown as typeof fetch;
    const error = console.error;
    console.error = () => {};
    try {
      const result = await sendMagicLinkEmail({ to: 'ana@example.com', url: URL });
      expect(result).toEqual({ ok: false, reason: 'send-failed' });
    } finally {
      console.error = error;
    }
  });
});
