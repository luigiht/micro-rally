'use client';

import { useId, useState, useSyncExternalStore } from 'react';
import { CATALOG_IDS, type CatalogCarId } from '@/game/economy/cars';
import { SESSION_STAGE_TYPES } from '@/game/multiplayer/Session';
import type { StageTypeId } from '@/game/stage/regions';
import { fill } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { DEV_AUTOPILOT_KMH } from '@/lib/autopilotFlag';
import { MAX_AUTOPILOT_KMH, useAutopilotStore } from '@/state/autopilotStore';

/** Speeds the launcher offers, km/h; the `?autopilot=<km/h>` one joins them if it isn't listed. */
const SPEEDS = Array.from({ length: (MAX_AUTOPILOT_KMH - 60) / 20 + 1 }, (_, i) => 60 + i * 20);

/** Over the start screen it sits in the corner; while driving, clear of the progress bar on the left edge. */
const WINDOW =
  'pixel-box pointer-events-auto fixed top-4 z-30 w-80 max-w-[calc(100vw-2rem)] p-4 coarse:top-16';

/** Car, stage type and top speed, then Start: the launcher's form, also used to change a running demo. */
function AutopilotForm({ onCancel }: { onCancel?: () => void }) {
  const m = useMessages();
  const id = useId();
  const carId = useAutopilotStore((s) => s.carId);
  const stageType = useAutopilotStore((s) => s.stageType);
  const kmh = useAutopilotStore((s) => s.kmh);
  const running = useAutopilotStore((s) => s.running);
  const { pick, start } = useAutopilotStore.getState();
  const speeds = SPEEDS.includes(kmh) ? SPEEDS : [...SPEEDS, kmh].sort((a, b) => a - b);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start();
        onCancel?.();
      }}
    >
      <p className="mt-1 text-xs text-ink/70">{m.autopilot.hint}</p>
      <label htmlFor={`${id}-car`} className="mt-3 block font-pixel text-[10px]">
        {m.autopilot.car}
      </label>
      <select
        id={`${id}-car`}
        value={carId}
        onChange={(e) => pick({ carId: e.target.value as CatalogCarId })}
        className="pixel-select mt-2 w-full"
      >
        {CATALOG_IDS.map((c) => (
          <option key={c} value={c}>
            {m.cars[c].name}
          </option>
        ))}
      </select>
      <label htmlFor={`${id}-type`} className="mt-3 block font-pixel text-[10px]">
        {m.autopilot.stageType}
      </label>
      <select
        id={`${id}-type`}
        value={stageType}
        onChange={(e) => pick({ stageType: e.target.value as StageTypeId })}
        className="pixel-select mt-2 w-full"
      >
        {SESSION_STAGE_TYPES.map((t) => (
          <option key={t} value={t}>
            {m.stageTypes[t]}
          </option>
        ))}
      </select>
      <label htmlFor={`${id}-speed`} className="mt-3 block font-pixel text-[10px]">
        {m.autopilot.speed}
      </label>
      <select
        id={`${id}-speed`}
        value={kmh}
        onChange={(e) => pick({ kmh: Number(e.target.value) })}
        className="pixel-select mt-2 w-full"
      >
        {speeds.map((v) => (
          <option key={v} value={v}>
            {fill(m.autopilot.kmh, { n: v })}
          </option>
        ))}
      </select>
      <div className="mt-4 flex gap-2">
        {onCancel && (
          <button type="button" className="pixel-btn-ghost flex-1" onClick={onCancel}>
            {m.autopilot.cancel}
          </button>
        )}
        <button type="submit" className="pixel-btn flex-1">
          {running ? m.autopilot.restart : m.autopilot.start}
        </button>
      </div>
    </form>
  );
}

/**
 * The `?autopilot` window. Over the start screen it is the launcher: pick a
 * car, a stage type and a top speed, and Start drives an unsaved demo. While
 * the demo runs it folds to a one-line summary with Change (the form again;
 * Restart draws new roads), Stop (back to the start screen) and Hide (P
 * brings it back), which leaves the rest of the HUD on screen for recordings.
 */
export function AutopilotWindow() {
  const m = useMessages();
  const running = useAutopilotStore((s) => s.running);
  const carId = useAutopilotStore((s) => s.carId);
  const stageType = useAutopilotStore((s) => s.stageType);
  const kmh = useAutopilotStore((s) => s.kmh);
  const [changing, setChanging] = useState(false);
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={`${WINDOW} ${running ? 'left-12' : 'left-4'}`}
      data-testid="autopilot-window"
    >
      <h2 id={titleId} className="font-pixel text-xs">
        {m.autopilot.title}
      </h2>
      {!running || changing ? (
        <AutopilotForm {...(running ? { onCancel: () => setChanging(false) } : {})} />
      ) : (
        <>
          <p className="mt-2 truncate text-sm">
            {fill(m.autopilot.summary, {
              car: m.cars[carId].name,
              type: m.stageTypes[stageType],
              kmh,
            })}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="pixel-btn-ghost flex-1 px-3 py-2 text-[10px]"
              onClick={() => setChanging(true)}
            >
              {m.autopilot.change}
            </button>
            <button
              type="button"
              className="pixel-btn-ghost flex-1 px-3 py-2 text-[10px]"
              onClick={() => useAutopilotStore.getState().stop()}
            >
              {m.autopilot.stop}
            </button>
            <button
              type="button"
              aria-keyshortcuts="P"
              title={m.autopilot.hideHint}
              className="pixel-btn-ghost flex-1 px-3 py-2 text-[10px]"
              onClick={(e) => {
                // Blurred so Space or Enter can't press it again once it's hidden.
                e.currentTarget.blur();
                useAutopilotStore.getState().toggleWindow();
              }}
            >
              {m.autopilot.hide}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-ink/70 coarse:hidden">{m.autopilot.hideHint}</p>
        </>
      )}
    </section>
  );
}

function subscribeNoop(): () => void {
  return () => {};
}

/**
 * The launcher over the start screen, with `?autopilot` only. The server
 * can't see the flag, so it mounts once the client owns the tree.
 */
export function AutopilotLauncher() {
  const enabled = useSyncExternalStore(
    subscribeNoop,
    () => DEV_AUTOPILOT_KMH !== null,
    () => false,
  );
  return enabled ? <AutopilotWindow /> : null;
}
