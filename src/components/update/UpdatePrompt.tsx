'use client';

import { useEffect, useState } from 'react';
import { useMessages } from '@/i18n/useMessages';
import { newVersionAvailable } from '@/lib/updateCheck';

const CHECK_MS = 5 * 60_000;

/**
 * Asks for a reload once the site has been deployed since this page opened:
 * checked when the page comes back into view or focus, and every few minutes.
 * Matters most for the installed app, whose window can stay open for days.
 * As wide as the splash's mode card (`max-w-md`), with the same side gutters on phones.
 */
export function UpdatePrompt() {
  const m = useMessages();
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (available) return;
    let live = true;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      void newVersionAvailable().then((yes) => {
        if (live && yes) setAvailable(true);
      });
    };
    const interval = setInterval(check, CHECK_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      live = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [available]);

  if (!available || dismissed) return null;
  return (
    <div
      role="status"
      className="pixel-box fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-3 p-3 text-sm"
    >
      <p className="min-w-0 flex-1">{m.update.available}</p>
      <div className="flex gap-4">
        <button
          type="button"
          className="pixel-btn-ghost px-3 text-[10px]"
          onClick={() => setDismissed(true)}
        >
          {m.update.later}
        </button>
        <button
          type="button"
          className="pixel-btn px-3 text-[10px]"
          onClick={() => window.location.reload()}
        >
          {m.update.reload}
        </button>
      </div>
    </div>
  );
}
