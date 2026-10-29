'use client';

import { fill, formatTime } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { useGameStore } from '@/state/gameStore';
import { useStageHudStore } from '@/state/stageHudStore';
import { useUiStore } from '@/state/uiStore';

function GamePanel() {
  const m = useMessages();
  const stage = useStageHudStore((s) => s.stage);
  const best = useGameStore((s) => (stage ? s.records[stage.index]?.best : undefined));
  const close = () => useUiStore.getState().setGamePanelOpen(false);
  const stageRows: [string, string][] = stage
    ? [
        [m.game.stageName, stage.name],
        [m.game.region, m.regions[stage.region]],
        [m.game.surface, m.surfaces[stage.surface]],
        [m.game.length, fill(m.game.km, { km: (stage.length / 1000).toFixed(1) })],
        [m.game.par, formatTime(stage.parTime)],
        [m.game.best, best !== undefined ? formatTime(best) : m.game.none],
      ]
    : [];

  return (
    <div className="absolute inset-0 grid place-items-center bg-ink/40 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-panel-title"
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-paper p-6 text-ink shadow-xl"
      >
        <h2 id="game-panel-title" className="font-pixel text-lg">
          {m.game.title}
        </h2>
        <p className="mt-2 text-sm text-ink/70">{m.game.paused}</p>

        {stage && (
          <>
            <h3 className="mt-5 font-pixel text-xs">{m.game.stageSection}</h3>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
              {stageRows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-ink/70">{k}</dt>
                  <dd className="text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </>
        )}

        <h3 className="mt-5 font-pixel text-xs">{m.game.controlsSection}</h3>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {m.controls.map((c) => (
              <tr key={c.keys} className="border-t border-ink/10">
                <th
                  scope="row"
                  className="py-1 pr-3 text-left font-mono font-semibold whitespace-nowrap"
                >
                  {c.keys}
                </th>
                <td className="py-1">{c.action}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-5 text-sm text-ink/70">{m.game.about}</p>

        <button
          type="button"
          autoFocus
          onClick={close}
          className="mt-6 w-full rounded-lg bg-rally px-3 py-2 font-semibold text-paper"
        >
          {m.game.close}
        </button>
      </section>
    </div>
  );
}

/** Top-right "Game" button and the panel it opens (controls + stage info). */
export function GameMenu() {
  const m = useMessages();
  const open = useUiStore((s) => s.gamePanelOpen);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => {
          // Drop focus so Space (handbrake) can't re-trigger the button.
          e.currentTarget.blur();
          useUiStore.getState().toggleGamePanel();
        }}
        className="absolute top-4 right-4 rounded-xl bg-paper/90 px-4 py-3 font-pixel text-xs text-ink shadow hover:bg-paper"
      >
        {m.game.button}
      </button>
      {open && <GamePanel />}
    </>
  );
}
