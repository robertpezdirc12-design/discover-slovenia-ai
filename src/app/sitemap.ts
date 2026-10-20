import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

const BASE = SITE_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
