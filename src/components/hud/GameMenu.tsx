'use client';

import { useState } from 'react';
import { formatGameId } from '@/game/save/GameId';
import { fill, formatTime } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { useGameStore } from '@/state/gameStore';
import { useSaveStore } from '@/state/saveStore';
import { useStageHudStore } from '@/state/stageHudStore';
import { useUiStore } from '@/state/uiStore';
import { HudDialog } from './HudDialog';
import { PixelIcon } from './PixelIcon';

const COPIED_MS = 1500;

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink/70">{k}</dt>
          <dd className="text-right font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The Game panel: this stage, and the driver's name + Game ID. */
export function GamePanel() {
  const m = useMessages();
  const stage = useStageHudStore((s) => s.stage);
  const best = useGameStore((s) => (stage ? s.records[stage.index]?.best : undefined));
  const driverName = useGameStore((s) => s.driverName);
  const gameId = useGameStore((s) => s.gameId);
  const sync = useSaveStore((s) => s.status);
  const [copied, setCopied] = useState(false);
  const formattedId = gameId ? formatGameId(gameId) : '';

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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formattedId);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Clipboard unavailable (insecure context); the ID stays selectable on screen.
    }
  };

  const restartStage = () => {
    useUiStore.getState().closePanel();
    useGameStore.getState().retry();
  };

  const syncText = {
    idle: m.game.syncIdle,
    saving: m.game.syncSaving,
    online: m.game.syncOnline,
    offline: m.game.syncOffline,
  }[sync];

  return (
    <HudDialog
      id="game-panel"
      title={m.game.title}
      subtitle={m.game.paused}
      closeLabel={m.game.close}
      onClose={() => useUiStore.getState().closePanel()}
    >
      {stage && (
        <>
          <h3 className="mt-5 font-pixel text-xs">{m.game.stageSection}</h3>
          <Rows rows={stageRows} />
          <button
            type="button"
            onClick={restartStage}
            className="pixel-btn-ghost mt-3 inline-flex w-full items-center justify-center gap-2"
          >
            <PixelIcon name="restart" />
            {m.game.restartStage}
          </button>
        </>
      )}

      <h3 className="mt-5 font-pixel text-xs">{m.game.driverSection}</h3>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
        <div className="contents">
          <dt className="text-ink/70">{m.game.driver}</dt>
          <dd className="text-right font-semibold" data-testid="driver-name">
            {driverName}
          </dd>
        </div>
        <div className="contents">
          <dt className="text-ink/70">{m.game.gameId}</dt>
          <dd className="text-right">
            <code className="font-pixel text-xs select-all" data-testid="game-id">
              {formattedId}
            </code>
          </dd>
        </div>
      </dl>
      <button type="button" className="pixel-btn-ghost mt-3 w-full" onClick={copy}>
        {copied ? m.game.copied : m.game.copy}
      </button>
      <p role="status" className="mt-3 text-xs text-ink/70">
        {syncText}
      </p>
    </HudDialog>
  );
}
