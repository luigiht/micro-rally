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
    <div className="pixel-scrim absolute inset-0 grid place-items-center p-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-panel-title"
        className="pixel-box flex max-h-[calc(100dvh-4rem)] w-full max-w-lg flex-col p-6"
      >
        <div className="min-h-0 overflow-y-auto pr-1">
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
                <tr key={c.keys} className="border-t-2 border-dashed border-ink/20">
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
        </div>

        <button
          type="button"
          autoFocus
          onClick={close}
          className="pixel-btn mt-6 mb-1 w-full shrink-0"
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
        className="pixel-btn-ghost absolute top-6 right-6"
      >
        {m.game.button}
      </button>
      {open && <GamePanel />}
    </>
  );
}
