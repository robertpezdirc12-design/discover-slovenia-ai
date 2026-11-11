import type { MetadataRoute } from 'next';
import { DESTINATIONS } from '@/lib/destinations';

const BASE = 'https://i-feel-slovenia.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...DESTINATIONS.map((d) => ({
      url: `${BASE}/kraj/${d.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
