/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { isSameOriginRequest } from '../src/lib/request-origin';

function requestWithSite(site?: string): Request {
  return new Request('https://example.com/api/account', {
    headers: site ? { 'sec-fetch-site': site } : {},
  });
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
});
