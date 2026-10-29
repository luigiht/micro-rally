import type { Metadata, Viewport } from 'next';
import { en } from '@/i18n/messages/en';
import { SITE_URL } from '@/lib/site';
import '@fontsource/press-start-2p/400.css';
import './globals.css';

const KEYWORDS = [
  'rally game',
  'browser game',
  'racing game',
  'low poly',
  'free game',
  'no ads',
  'procedural stages',
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: en.meta.title, template: `%s · ${en.meta.title}` },
  description: en.meta.description,
  applicationName: en.meta.title,
  keywords: KEYWORDS,
  category: 'games',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: en.meta.title, statusBarStyle: 'black-translucent' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: en.meta.title,
    title: en.meta.title,
    description: en.meta.description,
    locale: 'en_US',
    alternateLocale: ['es_ES', 'it_IT'],
  },
  twitter: {
    card: 'summary_large_image',
    title: en.meta.title,
    description: en.meta.description,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f4ecd8',
};

/** Structured data so search engines list the app as a free browser game. */
const GAME_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: en.meta.title,
  description: en.meta.description,
  url: SITE_URL,
  genre: 'Racing',
  gamePlatform: 'Web browser',
  applicationCategory: 'Game',
  operatingSystem: 'Any',
  inLanguage: ['en', 'es', 'it'],
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(GAME_JSON_LD) }}
        />
      </body>
    </html>
  );
}
