import type { Metadata } from 'next';
import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { en } from '@/i18n/messages/en';

export const metadata: Metadata = {
  title: en.feedback.title,
  description: en.feedback.intro,
  alternates: { canonical: '/feedback' },
};

export default function FeedbackPage() {
  return <FeedbackForm />;
}
