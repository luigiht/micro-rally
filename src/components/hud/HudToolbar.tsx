'use client';

import type { MouseEvent } from 'react';
import { useMessages } from '@/i18n/useMessages';
import { useUiStore, type HudPanel } from '@/state/uiStore';
import { GamePanel } from './GameMenu';
import { GaragePanel } from './GaragePanel';
import { HudDialog } from './HudDialog';
import { PixelIcon, type PixelIconName } from './PixelIcon';
import { SettingsPanel } from './SettingsPanel';

interface ToolbarButtonProps {
  icon: PixelIconName;
  label: string;
  panel: HudPanel;
  open: boolean;
  /** Display classes; lets a button show only on some devices. */
  display?: string;
  /** Square pad the size of the touch pedals, icon only (label for assistive tech). */
  pad?: boolean;
}

function ToolbarButton({
  icon,
  label,
  panel,
  open,
  display = 'inline-flex',
  pad = false,
}: ToolbarButtonProps) {
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
      className={
        pad
          ? `pixel-btn-ghost size-14 place-items-center p-0 ${display}`
          : `pixel-btn-ghost items-center gap-2 p-3 md:px-4 md:py-3 ${display}`
      }
    >
      <PixelIcon name={icon} className={pad ? 'size-6' : undefined} />
      <span className={pad ? 'sr-only' : 'max-md:sr-only'}>{label}</span>
    </button>
  );
}

/** Touch-device pause menu: one tap opens it; each entry swaps in the matching panel. */
function PauseMenu() {
  const m = useMessages();
  const entries: { icon: PixelIconName; label: string; panel: HudPanel }[] = [
    { icon: 'game', label: m.toolbar.game, panel: 'game' },
    { icon: 'garage', label: m.garage.button, panel: 'garage' },
    { icon: 'settings', label: m.toolbar.settings, panel: 'settings' },
  ];
  return (
    <HudDialog
      id="pause-menu"
      title={m.toolbar.pauseTitle}
      closeLabel={m.toolbar.resume}
      onClose={() => useUiStore.getState().closePanel()}
    >
      <ul className="mt-5 flex flex-col gap-4" data-testid="pause-menu">
        {entries.map((e) => (
          <li key={e.panel}>
            <button
              type="button"
              onClick={() => useUiStore.getState().openPanel(e.panel)}
              className="pixel-btn-ghost inline-flex w-full items-center justify-center gap-3"
            >
              <PixelIcon name={e.icon} />
              {e.label}
            </button>
          </li>
        ))}
      </ul>
    </HudDialog>
  );
}

/**
 * Top-right toolbar and the panels it opens. On desktop it carries Settings
 * and Game (the Garage button sits next to Money); on touch devices it
 * collapses to a single Pause button that opens a menu of all three.
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
          icon="pause"
          label={m.toolbar.pause}
          panel="menu"
          open={panel !== null}
          display="hidden coarse:grid"
          pad
        />
        <ToolbarButton
          icon="settings"
          label={m.toolbar.settings}
          panel="settings"
          open={panel === 'settings'}
          display="inline-flex coarse:hidden"
        />
        <ToolbarButton
          icon="game"
          label={m.toolbar.game}
          panel="game"
          open={panel === 'game'}
          display="inline-flex coarse:hidden"
        />
      </nav>
      {panel === 'menu' && <PauseMenu />}
      {panel === 'game' && <GamePanel />}
      {panel === 'settings' && <SettingsPanel />}
      {panel === 'garage' && <GaragePanel />}
    </>
  );
}
