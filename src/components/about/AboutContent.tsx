'use client';

import Link from 'next/link';
import { useState, type KeyboardEvent } from 'react';
import { useMessages } from '@/i18n/useMessages';

type AboutTab = 'gameplay' | 'changelog' | 'faqs';

export function AboutContent() {
  const m = useMessages();
  const [activeTab, setActiveTab] = useState<AboutTab>('gameplay');
  const tabs: { id: AboutTab; label: string }[] = [
    { id: 'gameplay', label: m.about.tabs.gameplay },
    { id: 'changelog', label: m.about.tabs.changelog },
    { id: 'faqs', label: m.about.tabs.faqs },
  ];
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    const nextTab = tabs[nextIndex];
    if (!nextTab) return;
    event.preventDefault();
    setActiveTab(nextTab.id);
    event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [nextIndex]?.focus();
  }

  return (
    <main className="min-h-dvh bg-ink px-4 py-10">
      <article className="pixel-box mx-auto max-w-3xl p-5 sm:p-8">
        <h1 className="font-pixel text-lg leading-snug sm:text-xl">{m.about.title}</h1>
        <p className="mt-5 text-sm">{m.about.intro}</p>

        <div
          role="tablist"
          aria-label={m.about.title}
          className="mt-7 grid grid-cols-1 gap-3 min-[360px]:grid-cols-3"
        >
          {tabs.map((tab, index) => {
            const selected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                id={`about-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="about-panel"
                tabIndex={selected ? 0 : -1}
                className={`${selected ? 'pixel-btn' : 'pixel-btn-ghost'} min-h-12 px-1 text-[9px] min-[400px]:px-2 min-[400px]:text-[10px]`}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <section
          id="about-panel"
          role="tabpanel"
          aria-labelledby={`about-tab-${activeTab}`}
          tabIndex={0}
          className="mt-8 min-h-56 focus-visible:outline-2 focus-visible:outline-rally"
        >
          {activeTab === 'gameplay' && (
            <>
              <h2 className="font-pixel text-xs">{m.about.tabs.gameplay}</h2>
              <p className="mt-3 text-sm">{m.about.gameplay.intro}</p>
              <div className="mt-6 space-y-5">
                {m.about.gameplay.highlights.map((item) => (
                  <section key={item.title} className="border-t border-ink/15 pt-4">
                    <h3 className="font-pixel text-[10px] leading-relaxed">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed">{item.body}</p>
                  </section>
                ))}
              </div>
              <section className="mt-6 border-t border-ink/15 pt-4">
                <h3 className="font-pixel text-[10px]">{m.about.gameplay.controlsTitle}</h3>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {m.about.gameplay.controls.map((control) => (
                    <div key={control.keys} className="contents">
                      <dt className="font-semibold">{control.keys}</dt>
                      <dd>{control.action}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm">{m.about.gameplay.touch}</p>
              </section>
            </>
          )}

          {activeTab === 'changelog' && (
            <>
              <h2 className="font-pixel text-xs">{m.about.tabs.changelog}</h2>
              <p className="mt-3 text-sm">{m.about.changelog.intro}</p>
              <div className="mt-6 space-y-6">
                {m.about.changelog.entries.map((entry) => (
                  <article
                    key={`${entry.date}-${entry.title}`}
                    className="border-t border-ink/15 pt-4"
                  >
                    <p className="font-pixel text-[9px] leading-relaxed text-ink/60">
                      {entry.date}
                    </p>
                    <h3 className="mt-2 font-pixel text-[10px] leading-relaxed">{entry.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed">{entry.body}</p>
                  </article>
                ))}
              </div>
            </>
          )}

          {activeTab === 'faqs' && (
            <>
              <h2 className="font-pixel text-xs">{m.about.tabs.faqs}</h2>
              <div className="mt-5 space-y-5">
                {m.about.faqs.map((item) => (
                  <section key={item.question} className="border-t border-ink/15 pt-4">
                    <h3 className="font-pixel text-[10px] leading-relaxed">{item.question}</h3>
                    <p className="mt-2 text-sm leading-relaxed">{item.answer}</p>
                  </section>
                ))}
              </div>
            </>
          )}
        </section>

        <Link href="/" className="pixel-btn mt-8 inline-block">
          {m.about.back}
        </Link>
      </article>
    </main>
  );
}
