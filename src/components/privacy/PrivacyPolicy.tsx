'use client';

import Link from 'next/link';
import { useMessages } from '@/i18n/useMessages';
import { AUTHOR } from '@/lib/site';

/** The short privacy policy: what the game stores, where, and how to have it removed. */
export function PrivacyPolicy() {
  const m = useMessages();
  const host = new URL(AUTHOR.url).host;
  return (
    <main className="min-h-dvh bg-ink px-4 py-10">
      <article className="pixel-box mx-auto max-w-2xl p-6 md:p-8">
        <h1 className="font-pixel text-xl leading-snug">{m.privacy.title}</h1>
        <p className="mt-2 text-xs text-ink/60">{m.privacy.updated}</p>
        <p className="mt-5 text-sm">{m.privacy.intro}</p>
        {m.privacy.sections.map((s) => (
          <section key={s.title} className="mt-5">
            <h2 className="font-pixel text-xs">{s.title}</h2>
            <p className="mt-2 text-sm">{s.body}</p>
          </section>
        ))}
        <p className="mt-6 text-sm">
          {m.privacy.contact}{' '}
          <a
            href={AUTHOR.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-rally"
          >
            {host}
          </a>
          .
        </p>
        <Link href="/" className="pixel-btn mt-8 inline-block">
          {m.privacy.back}
        </Link>
      </article>
    </main>
  );
}
