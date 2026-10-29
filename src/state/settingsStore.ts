import { create } from 'zustand';
import type { Locale } from '@/i18n';

interface SettingsState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  locale: 'en',
  setLocale: (locale) => set({ locale }),
}));
