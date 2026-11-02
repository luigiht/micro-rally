'use client';

import { fill, formatMoney, formatTime } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { useGameStore, type StageResult } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useStageHudStore } from '@/state/stageHudStore';
import { useUiStore } from '@/state/uiStore';
import { PixelIcon } from './PixelIcon';

function Countdown() {
  const m = useMessages();
  const phase = useStageHudStore((s) => s.phase);
  const countdown = useStageHudStore((s) => s.countdown);
  const time = useStageHudStore((s) => s.time);
  let label: string | null = null;
  if (phase === 'countdown') label = String(Math.max(1, Math.ceil(countdown)));
  else if (phase === 'running' && time < 1) label = m.stage.go;
  if (!label) return null;
  return (
    <p
      role="status"
      aria-live="assertive"
      className="pointer-events-none absolute inset-x-0 top-1/3 text-center font-pixel text-6xl text-paper drop-shadow-[0_4px_0_rgba(43,42,51,0.6)] md:text-8xl"
    >
      {label}
    </p>
  );
}

function ResultPanel({ result }: { result: StageResult }) {
  const m = useMessages();
  const locale = useSettingsStore((s) => s.locale);
  const rows: [string, string][] = [
    [m.stage.time, formatTime(result.time)],
    [m.stage.par, formatTime(result.parTime)],
    [m.stage.prize, formatMoney(result.prize, locale)],
  ];
  if (result.previousBest !== null)
    rows.splice(2, 0, [m.stage.best, formatTime(result.previousBest)]);
  if (result.repairCost > 0)
    rows.push([m.stage.repairs, `−${formatMoney(result.repairCost, locale)}`]);
  return (
    <div className="pixel-scrim pointer-events-auto absolute inset-0 grid place-items-center p-4 md:p-6">
      <section
        role="dialog"
        aria-labelledby="result-title"
        className="pixel-box w-96 max-w-full p-6"
      >
        <h2 id="result-title" className="font-pixel text-lg leading-snug">
          {m.stage.resultTitle}
        </h2>
        {result.newRecord && (
          <p className="mt-2 font-pixel text-[10px] leading-snug text-rally">{m.stage.newRecord}</p>
        )}
        <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt>{k}</dt>
              <dd className="text-right font-pixel text-xs leading-6">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            className="pixel-btn-ghost flex-1"
            onClick={() => useGameStore.getState().retry()}
          >
            {m.stage.retry}
          </button>
          <button
            type="button"
            className="pixel-btn-ghost flex-1"
            onClick={() => useUiStore.getState().startReplay()}
          >
            {m.stage.replay}
          </button>
          <button
            type="button"
            autoFocus
            className="pixel-btn flex-1"
            onClick={() => useGameStore.getState().nextStage()}
          >
            {m.stage.next}
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Shown under the clock while the finished run plays back: the car follows the
 * recording and only the camera (C, or Settings) and leaving are the player's.
 */
function ReplayBar() {
  const m = useMessages();
  return (
    <div
      className="pointer-events-auto mt-3 flex flex-col items-center gap-2"
      data-testid="replay-bar"
    >
      <div className="flex items-center gap-2">
        <p role="status" className="pixel-tag bg-ink px-2 py-1 text-[10px] text-paper">
          {m.stage.replayTag}
        </p>
        <button
          type="button"
          className="pixel-btn-ghost px-3 py-2 text-[10px]"
          onClick={(e) => {
            e.currentTarget.blur();
            useUiStore.getState().stopReplay();
          }}
        >
          {m.stage.exitReplay}
        </button>
      </div>
      <p className="pixel-tag px-2 py-1 text-[10px] coarse:hidden">{m.stage.replayHint}</p>
    </div>
  );
}

/** Desktop Garage button beside Money; on touch devices the toolbar carries it instead. */
function GarageButton() {
  const m = useMessages();
  const open = useUiStore((s) => s.panel === 'garage');
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      title={m.garage.button}
      onClick={(e) => {
        e.currentTarget.blur();
        useUiStore.getState().togglePanel('garage');
      }}
      className="pixel-btn-ghost pointer-events-auto inline-flex items-center gap-2 p-3 md:px-4 md:py-3 coarse:hidden"
    >
      <PixelIcon name="garage" />
      <span className="max-md:sr-only">{m.garage.button}</span>
    </button>
  );
}

export function StageHud() {
  const m = useMessages();
  const locale = useSettingsStore((s) => s.locale);
  const time = useStageHudStore((s) => s.time);
  const gatesPassed = useStageHudStore((s) => s.gatesPassed);
  const gateCount = useStageHudStore((s) => s.gateCount);
  const penalties = useStageHudStore((s) => s.penalties);
  const result = useStageHudStore((s) => s.result);
  const replay = useUiStore((s) => s.replay);
  const hidden = useUiStore((s) => s.hudHidden);
  const money = useGameStore((s) => s.money);
  if (gateCount === 0) return null;
  // With the HUD hidden (H) only what the player must see stays: the start signal and the result.
  if (hidden)
    return (
      <>
        <Countdown />
        {result && !replay && <ResultPanel result={result} />}
      </>
    );
  return (
    <>
      {/* Centred on desktop; on touch devices the stack hugs the top-left and money joins it. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center p-4 font-pixel text-ink coarse:items-start coarse:pl-14">
        <p
          className="pixel-box px-4 py-2 text-xl leading-none md:text-2xl coarse:flex coarse:h-14 coarse:items-center coarse:px-3 coarse:text-2xl"
          data-testid="stage-timer"
        >
          {formatTime(time)}
        </p>
        <p className="pixel-tag mt-4 px-2 py-1 text-[10px]">
          {fill(m.stage.checkpoint, { n: gatesPassed, total: gateCount })}
        </p>
        {penalties > 0 && (
          <p className="pixel-tag mt-3 bg-rally px-2 py-1 text-[10px] text-paper">
            {fill(m.stage.penalties, { s: penalties })}
          </p>
        )}
        {replay && <ReplayBar />}
        <div className="absolute bottom-6 left-6 flex items-center gap-2 coarse:static coarse:mt-3">
          <p
            className="pixel-box px-4 py-3 text-sm coarse:px-2 coarse:py-1 coarse:text-[10px]"
            data-testid="money"
          >
            {m.stage.money} {formatMoney(money, locale)}
          </p>
          <GarageButton />
        </div>
      </div>
      <Countdown />
      {result && !replay && <ResultPanel result={result} />}
    </>
  );
}
