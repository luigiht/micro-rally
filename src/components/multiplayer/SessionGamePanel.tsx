'use client';

import { useState } from 'react';
import { formatGameId } from '@/game/save/GameId';
import { fill, formatTime } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { backToLobby, driveSessionStage, retireStage, useSessionStore } from '@/state/sessionStore';
import { useStageHudStore } from '@/state/stageHudStore';
import { useUiStore } from '@/state/uiStore';
import { HudDialog } from '@/components/hud/HudDialog';
import { PixelIcon } from '@/components/hud/PixelIcon';
import { useCopySessionLink } from './sessionHooks';

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

/**
 * Multiplayer's Game panel: this stage, then restart or retire while the
 * run hasn't finished, the way back to the session, and the Session ID.
 */
export function SessionGamePanel() {
  const m = useMessages();
  const stage = useStageHudStore((s) => s.stage);
  const finished = useStageHudStore((s) => s.result !== null);
  const session = useSessionStore((s) => s.session);
  const me = useSessionStore((s) => s.seat?.playerId);
  const upload = useSessionStore((s) => s.upload);
  const { copied, copy } = useCopySessionLink(session?.id ?? '');
  const [confirming, setConfirming] = useState(false);
  const [retiring, setRetiring] = useState(false);
  if (!session) return null;

  const stageRows: [string, string][] = stage
    ? [
        [m.game.stageName, `${stage.index + 1} · ${stage.name}`],
        [m.game.stageType, m.stageTypes[stage.stageType]],
        [
          m.game.length,
          stage.laps > 0
            ? fill(m.game.laps, { laps: stage.laps, km: (stage.lapLength / 1000).toFixed(1) })
            : fill(m.game.km, { km: (stage.length / 1000).toFixed(1) }),
        ],
        [m.game.par, formatTime(stage.parTime)],
      ]
    : [];

  const retire = async () => {
    setRetiring(true);
    if (!(await retireStage())) setRetiring(false);
  };

  return (
    <HudDialog
      id="game-panel"
      title={m.game.title}
      closeLabel={m.game.close}
      onClose={() => useUiStore.getState().closePanel()}
    >
      {stage && (
        <>
          <h3 className="mt-5 font-pixel text-xs">{m.game.stageSection}</h3>
          <Rows rows={stageRows} />
        </>
      )}

      {!finished && !confirming && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => driveSessionStage()}
            className="pixel-btn-ghost inline-flex items-center justify-center gap-2 px-2"
          >
            <PixelIcon name="restart" />
            {m.session.restart}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="pixel-btn-ghost px-2"
          >
            {m.session.retire}
          </button>
        </div>
      )}
      {!finished && confirming && (
        <div className="pixel-box-dark mt-3 p-3" role="group" aria-labelledby="retire-question">
          <p id="retire-question" className="text-sm">
            {fill(m.session.retireConfirm, { n: (stage?.index ?? 0) + 1 })}
          </p>
          {upload === 'failed' && (
            <p role="alert" className="mt-2 text-sm">
              {m.session.unavailable}
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="pixel-btn-ghost px-2"
              onClick={() => setConfirming(false)}
              disabled={retiring}
            >
              {m.session.cancel}
            </button>
            <button type="button" className="pixel-btn px-2" onClick={retire} disabled={retiring}>
              {m.session.retireYes}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={backToLobby}
        className="pixel-btn-ghost mt-3 w-full"
        disabled={upload === 'sending'}
      >
        {m.session.backToSession}
      </button>
      {!finished && <p className="mt-2 text-xs text-ink/70">{m.session.leaveRunHint}</p>}

      <h3 className="mt-5 font-pixel text-xs">{m.session.lobbyTitle}</h3>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
        <div className="contents">
          <dt className="text-ink/70">{m.session.idLabel}</dt>
          <dd className="text-right">
            <code className="font-pixel text-xs select-all" data-testid="session-id">
              {formatGameId(session.id)}
            </code>
          </dd>
        </div>
        <div className="contents">
          <dt className="text-ink/70">{m.session.driversSection}</dt>
          <dd className="text-right font-semibold">
            {session.players
              .map((p) => (p.id === me ? fill(m.session.you, { name: p.name }) : p.name))
              .join(' · ')}
          </dd>
        </div>
      </dl>
      <button type="button" className="pixel-btn-ghost mt-3 w-full" onClick={copy}>
        {copied ? m.session.copied : m.session.copyLink}
      </button>
    </HudDialog>
  );
}
