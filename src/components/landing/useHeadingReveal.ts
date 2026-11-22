'use client';

import { useEffect, type RefObject } from 'react';

/** A heading counts as in view once this share of it shows, a little above the window's foot. */
const THRESHOLD = 0.35;
const ROOT_MARGIN = '0px 0px -8% 0px';

/**
 * The landing page's section headings rise into place as they scroll into
 * view, once each. Pure DOM: the root takes `reveal-ready` only once this has
 * run (so without script nothing is hidden), each heading `is-revealed` as it
 * arrives; the CSS does the motion, and only where motion is welcome.
 */
export function useHeadingReveal(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const headings = [...el.querySelectorAll<HTMLElement>('h2')];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      },
      { threshold: THRESHOLD, rootMargin: ROOT_MARGIN },
    );
    for (const h of headings) observer.observe(h);
    el.classList.add('reveal-ready');
    return () => {
      observer.disconnect();
      el.classList.remove('reveal-ready');
      for (const h of headings) h.classList.remove('is-revealed');
    };
  }, [root]);
}
