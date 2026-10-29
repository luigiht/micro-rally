import type { Metadata } from 'next';
import { PrivacyPolicy } from '@/components/privacy/PrivacyPolicy';
import { en } from '@/i18n/messages/en';

export const metadata: Metadata = {
  title: en.privacy.title,
  description: en.privacy.intro,
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <PrivacyPolicy />;
}
