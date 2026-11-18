'use client';

import { useMessages } from '@/i18n/useMessages';

/**
 * Questions and answers, after the final call to play: two for visitors
 * (cost, what you need) and then the game's own FAQs from the About page,
 * so both pages answer the same way. Native disclosures: keyboard and
 * screen readers work with no script.
 */
export function LandingFaq() {
  const m = useMessages();
  const t = m.landing.faq;
  const items = [...t.items, ...m.about.faqs];

  return (
    <section id="faq" className="faq">
      <div className="content-section">
        <div className="section-heading">
          <h2>
            <span>{t.top}</span>
            <strong>{t.bottom}</strong>
          </h2>
          <p>{t.body}</p>
        </div>
        <div className="faq-list">
          {items.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
