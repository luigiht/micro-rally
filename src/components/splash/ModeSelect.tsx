'use client';

import { useMessages } from '@/i18n/useMessages';
import { PixelIcon, type PixelIconName } from '@/components/hud/PixelIcon';

export type SplashMode = 'solo' | 'multi';

/** Quiet text button for secondary navigation on the splash card; deliberately not a pixel button. */
export const QUIET_LINK =
  'font-pixel text-[10px] text-ink/70 underline underline-offset-4 hover:text-rally focus-visible:text-rally';

/** First splash step: single player (the career, as before) or a multiplayer session. */
export function ModeSelect({ onPick }: { onPick: (mode: SplashMode) => void }) {
  const m = useMessages();
  const modes: { mode: SplashMode; icon: PixelIconName; label: string; hint: string }[] = [
    {
      mode: 'solo',
      icon: 'player',
      label: m.splash.singlePlayer,
      hint: m.splash.singlePlayerHint,
    },
    {
      mode: 'multi',
      icon: 'players',
      label: m.splash.multiplayer,
      hint: m.splash.multiplayerHint,
    },
  ];
  return (
    <div className="mt-6" role="group" aria-labelledby="mode-title">
      <h2 id="mode-title" className="font-pixel text-xs">
        {m.splash.modeTitle}
      </h2>
      <ul className="mt-4 space-y-5">
        {modes.map(({ mode, icon, label, hint }, i) => (
          <li key={mode}>
            <button
              type="button"
              className={`${i === 0 ? 'pixel-btn' : 'pixel-btn-ghost'} inline-flex w-full items-center justify-center gap-3`}
              aria-describedby={`mode-${mode}-hint`}
              onClick={() => onPick(mode)}
              autoFocus={i === 0}
            >
              <PixelIcon name={icon} className="size-6 shrink-0" />
              {label}
            </button>
            <p id={`mode-${mode}-hint`} className="mt-3 text-sm text-ink/70">
              {hint}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
