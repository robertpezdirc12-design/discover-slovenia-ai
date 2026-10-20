import { describe, expect, test } from 'bun:test';
import { escapeHtml } from '../src/lib/escape-html';

describe('escapeHtml — varnost Leaflet popupov', () => {
  test('nevtralizira HTML značke in atribute', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
    expect(escapeHtml(`"&'`)).toBe('&quot;&amp;&#39;');
  });

  test('ohrani šumnike, številke in običajno besedilo', () => {
    expect(escapeHtml('Bled · 46 €/noč')).toBe('Bled · 46 €/noč');
    expect(escapeHtml(42)).toBe('42');
  });

  test('null in undefined postaneta prazna niza', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
