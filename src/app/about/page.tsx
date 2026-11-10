import type { Metadata } from 'next';
import { en } from '@/i18n/messages/en';
import { AboutContent } from '@/components/about/AboutContent';

export const metadata: Metadata = {
  title: en.about.title,
  description: en.about.intro,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return <AboutContent />;
}
