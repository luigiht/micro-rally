'use client';

import { useSettingsStore } from '@/state/settingsStore';
import { getMessages, type Messages } from '@/i18n';

export function useMessages(): Messages {
  const locale = useSettingsStore((s) => s.locale);
  return getMessages(locale);
}
