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

  test('Sec-Fetch-Site ima prednost pred Origin', () => {
    expect(
      isSameOriginRequest(requestWithSite('same-origin', 'https://evil.example')),
    ).toBe(true);
    expect(
      isSameOriginRequest(requestWithSite('cross-site', 'https://example.com')),
    ).toBe(false);
  });
});
