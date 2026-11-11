'use client';

import { fill, formatMoney, formatTime } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { useGameStore, type StageResult } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useStageHudStore } from '@/state/stageHudStore';
import { useUiStore } from '@/state/uiStore';
import { SessionResultPanel } from '@/components/multiplayer/SessionResultPanel';
import { PaceNoteCallout } from './PaceNoteCallout';
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
  const laps = useStageHudStore((s) => s.lapTimes);
  const bestLap = useStageHudStore((s) => s.bestLap);
  const rows: [string, string][] = [
    [m.stage.time, formatTime(result.time)],
    [m.stage.par, formatTime(result.parTime)],
    [m.stage.prize, formatMoney(result.prize, locale)],
  ];
  if (result.previousBest !== null)
    rows.splice(2, 0, [m.stage.best, formatTime(result.previousBest)]);
  // A circuit race lists each lap under the total, then the fastest.
  if (laps.length > 0) {
    const lapRows: [string, string][] = laps.map((t, i) => [
      fill(m.stage.lapTime, { n: i + 1 }),
      formatTime(t),
    ]);
    if (bestLap !== null) lapRows.push([m.stage.bestLap, formatTime(bestLap)]);
    rows.splice(1, 0, ...lapRows);
  }
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
          {laps.length > 0 ? m.stage.raceTitle : m.stage.resultTitle}
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

interface StageHudProps {
  /** Multiplayer: no money or garage, and the session's result panel. */
  session?: boolean;
}

export function StageHud({ session = false }: StageHudProps) {
  const m = useMessages();
  const locale = useSettingsStore((s) => s.locale);
  const time = useStageHudStore((s) => s.time);
  const gatesPassed = useStageHudStore((s) => s.gatesPassed);
  const gateCount = useStageHudStore((s) => s.gateCount);
  const penalties = useStageHudStore((s) => s.penalties);
  const result = useStageHudStore((s) => s.result);
  const lap = useStageHudStore((s) => s.lap);
  const laps = useStageHudStore((s) => s.stage?.laps ?? 0);
  const bestLap = useStageHudStore((s) => s.bestLap);
  const replay = useUiStore((s) => s.replay);
  const hidden = useUiStore((s) => s.hudHidden);
  const money = useGameStore((s) => s.money);
  if (gateCount === 0) return null;
  // With the HUD hidden (H) only what the player must see stays: the start signal and the result.
  if (hidden)
    return (
      <>
        <Countdown />
        {result &&
          !replay &&
          (session ? <SessionResultPanel result={result} /> : <ResultPanel result={result} />)}
      </>
    );
  return (
    <>
      {/* Centred on desktop; on touch devices the stack hugs the top-left and money joins the
          checkpoint row, and the clock lines up with the toolbar pads' faces (see touchPad.ts). */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center p-4 font-pixel text-ink coarse:items-start coarse:pl-14">
        <p
          className="pixel-box px-4 py-2 text-xl leading-none md:text-2xl coarse:flex coarse:h-14 coarse:items-center coarse:px-3 coarse:text-2xl"
          data-testid="stage-timer"
        >
          {formatTime(time)}
        </p>
        {/* Checkpoints (or laps) and, on touch devices, money beside them; on desktop money sits bottom-left. */}
        <div className="mt-4 flex items-center gap-2">
          {laps > 0 ? (
            <p className="pixel-tag px-2 py-1 text-[10px]" data-testid="lap-counter">
              {fill(m.stage.lap, { n: lap, total: laps })}
            </p>
          ) : (
            <p
              className="pixel-tag px-2 py-1 text-[10px] coarse:flex coarse:items-center coarse:gap-1.5"
              data-testid="checkpoint-counter"
            >
              <span className="coarse:sr-only">
                {fill(m.stage.checkpoint, { n: gatesPassed, total: gateCount })}
              </span>
              <PixelIcon name="checkpoint" className="hidden size-4 coarse:block" />
              <span className="hidden coarse:inline" aria-hidden="true">
                {gatesPassed}/{gateCount}
              </span>
            </p>
          )}
          {!session && (
            <div className="absolute bottom-6 left-6 flex items-center gap-2 coarse:static">
              <p
                className="pixel-box px-4 py-3 text-sm coarse:flex coarse:items-center coarse:gap-1.5 coarse:px-2 coarse:py-1 coarse:text-[10px]"
                data-testid="money"
              >
                <span className="coarse:sr-only">{m.stage.money} </span>
                <PixelIcon name="money" className="hidden size-4 coarse:block" />
                {formatMoney(money, locale)}
              </p>
              <GarageButton />
            </div>
          )}
        </div>
        {laps > 0 && bestLap !== null && (
          <p className="pixel-tag mt-3 px-2 py-1 text-[10px]">
            {m.stage.bestLap} {formatTime(bestLap)}
          </p>
        )}
        {penalties > 0 && (
          <p className="pixel-tag mt-3 bg-rally px-2 py-1 text-[10px] text-paper">
            {fill(m.stage.penalties, { s: penalties })}
          </p>
        )}
        <PaceNoteCallout />
        {replay && <ReplayBar />}
      </div>
      <Countdown />
      {result &&
        !replay &&
        (session ? <SessionResultPanel result={result} /> : <ResultPanel result={result} />)}
    </>
  );
}
