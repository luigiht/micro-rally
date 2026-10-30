import type { MetadataRoute } from 'next';
import { en } from '@/i18n/messages/en';

/** Web app manifest: lets browsers install the game and tells crawlers its name and icons. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: en.meta.title,
    short_name: en.meta.title,
    description: en.meta.description,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#f4ecd8',
    theme_color: '#f4ecd8',
    lang: 'en',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icon0.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon1.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon2.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    screenshots: [
      {
        src: '/opengraph-image.png',
        sizes: '1200x630',
        type: 'image/png',
        form_factor: 'wide',
        label: en.meta.ogAlt,
      },
    ],
  };
}
