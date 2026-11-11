import HomeExperience from '@/components/discover/home-experience';

/**
 * Domača stran — interaktivni zemljevid z uporabnikovim tokom:
 *   pini držav → klik na državo → odpre se na zemljevidu →
 *   klik na Slovenija → spustni meni → »Apartmaji« → vsi apartmaji v
 *   Sloveniji s podatki s spleta (OpenStreetMap).
 *
 * Stran je strežniška; zemljevid (Leaflet) je dinamično uvožen le na
 * odjemalcu v HomeExperience.
 */
export default function Home() {
  return <HomeExperience />;
}
