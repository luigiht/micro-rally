'use client';

import { fill, formatMoney, formatTime } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { useGameStore, type StageResult } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useStageHudStore } from '@/state/stageHudStore';

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
      className="pointer-events-none absolute inset-x-0 top-1/3 text-center font-pixel text-8xl text-paper drop-shadow-[0_4px_0_rgba(43,42,51,0.6)]"
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
    <div className="absolute inset-0 grid place-items-center bg-ink/30">
      <section
        role="dialog"
        aria-labelledby="result-title"
        className="w-80 rounded-2xl bg-paper p-6 text-ink shadow-xl"
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
            className="flex-1 rounded-lg border-2 border-ink px-3 py-2 font-semibold"
            onClick={() => useGameStore.getState().retry()}
          >
            {m.stage.retry}
          </button>
          <button
            type="button"
            autoFocus
            className="flex-1 rounded-lg bg-rally px-3 py-2 font-semibold text-paper"
            onClick={() => useGameStore.getState().nextStage()}
          >
            {m.stage.next}
          </button>
        </div>
      </section>
    </div>
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
  const money = useGameStore((s) => s.money);
  if (gateCount === 0) return null;
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-4 flex flex-col items-center font-pixel text-ink">
        <p
          className="rounded-xl bg-paper/85 px-4 py-2 text-2xl leading-none"
          data-testid="stage-timer"
        >
          {formatTime(time)}
        </p>
        <p className="mt-2 rounded-md bg-paper/80 px-2 py-1 text-[10px]">
          {fill(m.stage.checkpoint, { n: gatesPassed, total: gateCount })}
        </p>
        {penalties > 0 && (
          <p className="mt-1 rounded-md bg-rally px-2 py-1 text-[10px] text-paper">
            {fill(m.stage.penalties, { s: penalties })}
          </p>
        )}
      </div>
      <p
        className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-paper/85 px-4 py-3 font-pixel text-sm text-ink shadow"
        data-testid="money"
      >
        {m.stage.money} {formatMoney(money, locale)}
      </p>
      <Countdown />
      {result && <ResultPanel result={result} />}
    </>
  );
}
