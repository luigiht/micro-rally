'use client';

import { useEffect, useState } from 'react';
import { useMessages } from '@/i18n/useMessages';
import { detectInstallPlatform, installPromptDue, type InstallPlatform } from '@/lib/installPrompt';
import { PixelIcon } from '@/components/hud/PixelIcon';

const DISMISSED_KEY = 'micro-rally.install-dismissed';

/** Chromium's install event; not in lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<unknown>;
}

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    /* private mode or blocked storage: the banner simply returns next visit */
  }
}

/** Already running from the home screen, in Chromium's or Safari's words. */
function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Whether this visit is one where offering an install makes sense at all. */
function eligiblePlatform(): InstallPlatform | null {
  if (isStandalone()) return null;
  if (!window.matchMedia('(pointer: coarse)').matches) return null;
  if (!installPromptDue(readDismissed(), Date.now())) return null;
  const platform = detectInstallPlatform({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
  return platform === 'other' ? null : platform;
}

/**
 * A strip under the splash card inviting phone and tablet browsers to add
 * the game to the home screen. On Android it holds Chromium's deferred
 * install event and opens the sheet on tap; on iOS, where no such event
 * exists, it spells out Share → Add to Home Screen. Dismissing it keeps it
 * away for a fortnight; installing, or already being installed, hides it.
 * Mounted only after hydration, so the platform can be read on first render.
 */
export function InstallPrompt() {
  const m = useMessages();
  const [platform] = useState(eligiblePlatform);
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (platform !== 'android') return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [platform]);

  if (hidden || platform === null) return null;
  // Android waits for the browser to say the game is installable.
  if (platform === 'android' && event === null) return null;

  const dismiss = () => {
    writeDismissed();
    setHidden(true);
  };

  const install = async () => {
    if (event === null) return;
    setHidden(true);
    try {
      await event.prompt();
    } catch {
      /* the sheet was refused or already shown; the browser menu can still install */
    }
  };

  return (
    <aside
      aria-labelledby="install-title"
      data-testid="install-prompt"
      data-platform={platform}
      className="pixel-box-dark mt-6 w-full max-w-md p-4"
    >
      <h2 id="install-title" className="font-pixel text-xs">
        {m.install.title}
      </h2>
      <p className="mt-2 text-sm">{platform === 'ios' ? m.install.ios : m.install.android}</p>
      <div className="mt-3 flex flex-wrap justify-end gap-x-3 gap-y-2">
        <button type="button" onClick={dismiss} className="pixel-btn-ghost px-3 py-2 text-xs">
          {m.install.dismiss}
        </button>
        {platform === 'android' && (
          <button
            type="button"
            onClick={install}
            className="pixel-btn inline-flex items-center gap-2 px-3 py-2 text-xs"
          >
            <PixelIcon name="down" className="size-4" />
            {m.install.install}
          </button>
        )}
      </div>
    </aside>
  );
}
