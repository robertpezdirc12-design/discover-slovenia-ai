/**
 * Minimalno HTML escapiranje za mesta, kjer vsebino vstavljamo v Leaflet
 * (`bindPopup`, `setPopupContent`) — Leaflet niz obravnava kot HTML.
 *
 * Ne uporabljaj za React markup: JSX že sam escapira vrednosti.
 */
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}
