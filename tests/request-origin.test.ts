/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { isSameOriginRequest } from '../src/lib/request-origin';

function requestWithSite(site?: string, origin?: string): Request {
  const headers: Record<string, string> = {};
  if (site) headers['sec-fetch-site'] = site;
  if (origin) headers.origin = origin;
  return new Request('https://example.com/api/account', { headers });
}

describe('request-origin — zaščita mutacij', () => {
  test('brez glave dovoli (curl, uptime, starejši brskalniki)', () => {
    expect(isSameOriginRequest(requestWithSite())).toBe(true);
  });

  test('same-origin in none sta dovoljena', () => {
    expect(isSameOriginRequest(requestWithSite('same-origin'))).toBe(true);
    expect(isSameOriginRequest(requestWithSite('none'))).toBe(true);
  });

  test('cross-site in same-site sta zavrnjena', () => {
    expect(isSameOriginRequest(requestWithSite('cross-site'))).toBe(false);
    expect(isSameOriginRequest(requestWithSite('same-site'))).toBe(false);
  });

  test('brez Sec-Fetch-Site uporabi Origin kot rezervo', () => {
    expect(isSameOriginRequest(requestWithSite(undefined, 'https://example.com'))).toBe(true);
    expect(isSameOriginRequest(requestWithSite(undefined, 'https://evil.example'))).toBe(false);
    expect(isSameOriginRequest(requestWithSite(undefined, 'ni-url'))).toBe(false);
  });

  test('za proxyjem primerja Origin z javnim Host, ne z internim URL', () => {
    const request = new Request('http://localhost:3000/api/account', {
      headers: {
        origin: 'https://example.com',
        host: 'example.com',
        'x-forwarded-proto': 'https',
      },
    });
    expect(isSameOriginRequest(request)).toBe(true);

    const wrongHost = new Request('http://localhost:3000/api/account', {
      headers: { origin: 'https://evil.example', host: 'example.com' },
    });
    expect(isSameOriginRequest(wrongHost)).toBe(false);

    const defaultPort = new Request('http://localhost:3000/api/account', {
      headers: {
        origin: 'https://example.com',
        host: 'example.com:443',
        'x-forwarded-host': 'example.com:443',
        'x-forwarded-proto': 'https',
      },
    });
    expect(isSameOriginRequest(defaultPort)).toBe(true);

    const wrongProtocol = new Request('http://localhost:3000/api/account', {
      headers: {
        origin: 'https://example.com',
        host: 'example.com',
        'x-forwarded-proto': 'http',
      },
    });
    expect(isSameOriginRequest(wrongProtocol)).toBe(false);
  });

  test('Sec-Fetch-Site ima prednost pred Origin', () => {
    expect(
      isSameOriginRequest(requestWithSite('same-origin', 'https://evil.example')),
    ).toBe(true);
    expect(
      isSameOriginRequest(requestWithSite('cross-site', 'https://example.com')),
    ).toBe(false);
  });
});
