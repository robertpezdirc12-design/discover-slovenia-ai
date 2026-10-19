import { ImageResponse } from 'next/og';

export const alt =
  'Discover Slovenia AI — vodič po zemljevidu, prenočišča, vreme in pot';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Dinamična OG slika — predogled ob deljenju povezave (sl_SI). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 28,
          padding: 80,
          background: 'linear-gradient(135deg, #052e16 0%, #14532d 55%, #166534 100%)',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, color: '#86efac', letterSpacing: 4 }}>
          SLOVENIJA IN BALKAN
        </div>
        <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
          Discover Slovenia AI
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: '#d1fae5' }}>
          Vodič po zemljevidu · Prenočišča · Vreme · Pot v enem mestu
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: '#a7f3d0' }}>
          Na odprtih podatkih (OpenStreetMap, ARSO)
        </div>
      </div>
    ),
    size
  );
}
