'use client';

import { useState, useSyncExternalStore } from 'react';
import { PixelIcon, type PixelIconName } from '@/components/hud/PixelIcon';
import { useMessages } from '@/i18n/useMessages';

type Device = 'desktop' | 'mobile';

/** Arrow characters in the control lists, drawn as the game's own pad icons. */
const ARROW_ICONS: Readonly<Record<string, PixelIconName>> = {
  '↑': 'up',
  '↓': 'down',
  '←': 'left',
  '→': 'right',
  '▲': 'up',
  '▼': 'down',
  '◀': 'left',
  '▶': 'right',
};
const ARROWS = /([↑↓←→▲▼◀▶])/;

/**
 * A control's keys, with each arrow character swapped for the game's pad
 * icon (all one size, centred in the key box); the character stays for
 * screen readers.
 */
function Keys({ keys }: { keys: string }) {
  const parts = keys.split(ARROWS).filter((p) => p !== '');
  if (parts.length === 1 && !ARROW_ICONS[keys]) return <kbd>{keys}</kbd>;
  return (
    <kbd className="control-icons">
      {parts.map((part, i) => {
        const icon = ARROW_ICONS[part];
        return icon ? (
          <span key={i} className="control-icon">
            <PixelIcon name={icon} />
            <span className="sr-only">{part}</span>
          </span>
        ) : (
          <span key={i} className="control-text">
            {part}
          </span>
        );
      })}
    </kbd>
  );
}

const COARSE = '(pointer: coarse)';

function subscribeCoarse(onChange: () => void): () => void {
  const mq = window.matchMedia(COARSE);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** The device the visitor is on: touchscreens start on the mobile controls. Desktop on the server. */
function useDetectedDevice(): Device {
  return useSyncExternalStore(
    subscribeCoarse,
    () => (window.matchMedia(COARSE).matches ? 'mobile' : 'desktop'),
    () => 'desktop',
  );
}

/**
 * The controls section's opening: what driving takes, then every control, from the same lists the game's Settings panel shows
 * (`controls`, `controlsTouch`), with a Desktop / Mobile toggle that starts
 * on the visitor's own device.
 */
export function LandingControls() {
  const m = useMessages();
  const t = m.landing.controls;
  const detected = useDetectedDevice();
  const [picked, setPicked] = useState<Device | null>(null);
  const device = picked ?? detected;
  const rows = device === 'desktop' ? m.controls : m.controlsTouch;

  return (
    <div className="content-section controls-panel">
      <div className="section-heading">
        <h2>
          <span>{t.top}</span>
          <strong>{t.bottom}</strong>
        </h2>
        <p>{t.body}</p>
      </div>
      <div className="controls-head">
        <h3>{t.title}</h3>
        <div className="controls-toggle" role="group" aria-label={t.label}>
          {(['desktop', 'mobile'] as const).map((d) => (
            <button
              type="button"
              key={d}
              aria-pressed={device === d}
              className={device === d ? 'active' : ''}
              onClick={() => setPicked(d)}
            >
              {t[d]}
            </button>
          ))}
        </div>
      </div>
      <dl className="controls-list">
        {rows.map((r) => (
          <div className="control-row" key={r.keys}>
            <dt>
              <Keys keys={r.keys} />
            </dt>
            <dd>{r.action}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
