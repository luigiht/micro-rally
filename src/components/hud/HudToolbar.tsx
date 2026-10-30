'use client';

import type { MouseEvent } from 'react';
import { useMessages } from '@/i18n/useMessages';
import { useUiStore, type HudPanel } from '@/state/uiStore';
import { GamePanel } from './GameMenu';
import { GaragePanel } from './GaragePanel';
import { PixelIcon, type PixelIconName } from './PixelIcon';
import { SettingsPanel } from './SettingsPanel';

interface ToolbarButtonProps {
  icon: PixelIconName;
  label: string;
  panel: HudPanel;
  open: boolean;
  /** Display classes; lets a button show only on some devices. */
  display?: string;
}

function ToolbarButton({ icon, label, panel, open, display = 'inline-flex' }: ToolbarButtonProps) {
  const handle = (e: MouseEvent<HTMLButtonElement>) => {
    // Drop focus so Space (handbrake) can't re-trigger the button.
    e.currentTarget.blur();
    useUiStore.getState().togglePanel(panel);
  };
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={handle}
      title={label}
      className={`pixel-btn-ghost items-center gap-2 p-3 md:px-4 md:py-3 ${display}`}
    >
      <PixelIcon name={icon} />
      <span className="max-md:sr-only">{label}</span>
    </button>
  );
}

/**
 * Top-right toolbar and the panels it opens. On touch devices the Garage
 * joins it (beside Settings), since the bottom-left corner is under the
 * steering pad there; on desktop the Garage button sits next to Money.
 */
export function HudToolbar() {
  const m = useMessages();
  const panel = useUiStore((s) => s.panel);
  return (
    <>
      <nav
        aria-label={m.toolbar.label}
        className="pointer-events-auto absolute top-4 right-4 flex gap-2 md:top-6 md:right-6 md:gap-3"
      >
        <ToolbarButton
          icon="garage"
          label={m.garage.button}
          panel="garage"
          open={panel === 'garage'}
          display="hidden coarse:inline-flex"
        />
        <ToolbarButton
          icon="settings"
          label={m.toolbar.settings}
          panel="settings"
          open={panel === 'settings'}
        />
        <ToolbarButton icon="game" label={m.toolbar.game} panel="game" open={panel === 'game'} />
      </nav>
      {panel === 'game' && <GamePanel />}
      {panel === 'settings' && <SettingsPanel />}
      {panel === 'garage' && <GaragePanel />}
    </>
  );
}
