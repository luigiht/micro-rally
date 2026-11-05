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
    // Not locked: the splash and menus read fine upright, and the player turns the phone to drive.
    orientation: 'any',
    background_color: '#f4ecd8',
    theme_color: '#f4ecd8',
    lang: 'en',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icon0.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon1.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon2.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Full-bleed with the mark inside the 80 % safe circle, so Android's launcher masks keep it whole.
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
