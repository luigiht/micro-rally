import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { en } from '@/i18n/messages/en';
import { AUTHOR, SITE_URL } from '@/lib/site';
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
  'play in browser',
  'arcade rally',
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: en.meta.title, template: `%s · ${en.meta.title}` },
  description: en.meta.description,
  applicationName: en.meta.title,
  keywords: KEYWORDS,
  category: 'games',
  classification: 'Game',
  authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
  creator: AUTHOR.name,
  publisher: AUTHOR.name,
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
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

/**
 * Structured data: the site and the game it hosts, so search engines list
 * Micro Rally as a free browser game with its artwork and author.
 */
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: en.meta.title,
      description: en.meta.description,
      inLanguage: ['en', 'es', 'it'],
      publisher: { '@id': `${SITE_URL}/#author` },
    },
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#author`,
      name: AUTHOR.name,
      url: AUTHOR.url,
    },
    {
      '@type': 'VideoGame',
      '@id': `${SITE_URL}/#game`,
      name: en.meta.title,
      alternateName: 'MicroRally',
      description: en.meta.description,
      url: SITE_URL,
      image: `${SITE_URL}/opengraph-image.png`,
      genre: ['Racing', 'Rally', 'Arcade'],
      keywords: KEYWORDS.join(', '),
      gamePlatform: 'Web browser',
      playMode: 'SinglePlayer',
      applicationCategory: 'GameApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a browser with WebGL 2',
      inLanguage: ['en', 'es', 'it'],
      isAccessibleForFree: true,
      author: { '@id': `${SITE_URL}/#author` },
      publisher: { '@id': `${SITE_URL}/#author` },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      mainEntityOfPage: { '@id': `${SITE_URL}/#website` },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Analytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </body>
    </html>
  );
}
