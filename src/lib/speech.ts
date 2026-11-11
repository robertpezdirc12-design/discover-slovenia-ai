/**
 * Govorni nasveti (Web Speech API, sl-SI) — prijetnost, nikoli ne ustavi toka.
 * Uporablja ga vodeni tok IN navigacija po poti (isti glas = isti vodič).
 */
export function speak(text: string, enabled: boolean): void {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'sl-SI';
    u.rate = 1.05;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    // govorna sinteza je prijetnost — napaka nikoli ne sme prekiniti vodenja
  }
}

/** Dogodek: uporabnik je zaključil vnašanje in zahteval pot na karto. */
export const SHOW_TRIP_EVENT = 'dsa:guide-show-trip';
