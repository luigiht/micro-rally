'use client';

import Link from 'next/link';
import { LOCALES, type Locale } from '@/i18n';
import { fill } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { AUTHOR } from '@/lib/site';
import { useSettingsStore } from '@/state/settingsStore';

const LINK = 'underline underline-offset-4 hover:text-rally focus-visible:text-rally';

/** Copyright, privacy link, author credit and a compact language picker over the dark backdrop. */
export function SplashFooter() {
  const m = useMessages();
  const locale = useSettingsStore((s) => s.locale);
  return (
    <footer className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs text-paper">
      <span>{fill(m.footer.copyright, { year: new Date().getFullYear() })}</span>
      <Link href="/privacy" className={LINK}>
        {m.footer.privacy}
      </Link>
      <span>
        {m.footer.createdBy}{' '}
        <a href={AUTHOR.url} target="_blank" rel="noopener noreferrer" className={LINK}>
          {AUTHOR.name}
        </a>
      </span>
      <label className="flex items-center gap-2">
        <span className="sr-only">{m.footer.language}</span>
        <select
          value={locale}
          onChange={(e) => useSettingsStore.getState().setLocale(e.target.value as Locale)}
          className="pixel-select-sm"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l} lang={l}>
              {m.settings.languages[l]}
            </option>
          ))}
        </select>
      </label>
    </footer>
  );
}
