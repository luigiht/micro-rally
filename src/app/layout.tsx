import type { Metadata, Viewport } from 'next';
import { en } from '@/i18n/messages/en';
import '@fontsource/press-start-2p/400.css';
import './globals.css';

export const metadata: Metadata = {
  title: en.meta.title,
  description: en.meta.description,
  applicationName: en.meta.title,
  openGraph: {
    title: en.meta.title,
    description: en.meta.description,
    siteName: en.meta.title,
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f4ecd8',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
