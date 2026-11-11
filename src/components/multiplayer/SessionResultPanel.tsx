'use client';

import { SESSION_SEATS, type SessionResult } from '@/game/multiplayer/Session';
import { scoreStage } from '@/game/multiplayer/SessionScore';
import { fill, formatTime } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import type { StageResult } from '@/state/gameStore';
import { backToLobby, retryUpload, useSessionStore } from '@/state/sessionStore';
import { useStageHudStore } from '@/state/stageHudStore';
import { useUiStore } from '@/state/uiStore';
import { useSessionPolling } from './sessionHooks';

/**
 * Multiplayer's stage result: this run's time against par and the other
 * driver's, the points it earns (pace at once; the stage and section wins
 * once both have run it) and whether the time has reached the server. No
 * second try: the first finish is the one that counts.
 */
export function SessionResultPanel({ result }: { result: StageResult }) {
  const m = useMessages();
  const session = useSessionStore((s) => s.session);
  const me = useSessionStore((s) => s.seat?.playerId ?? '');
  const upload = useSessionStore((s) => s.upload);
  const laps = useStageHudStore((s) => s.lapTimes);
  useSessionPolling();
  if (!session) return null;

  const stageResults = session.results.filter((r) => r.stageIndex === result.stageIndex);
  const counted = stageResults.some((r) => r.playerId === me);
  const local: SessionResult = {
    stageIndex: result.stageIndex,
    playerId: me,
    time: result.time,
    splits: result.splits,
  };
  const scored = counted ? stageResults : [...stageResults, local];
  const points = scoreStage(scored, result.parTime).get(me);
  const complete = counted && stageResults.length >= SESSION_SEATS;

  const other = session.players.find((p) => p.id !== me);
  const theirs = other ? stageResults.find((r) => r.playerId === other.id) : undefined;

  const rows: [string, string][] = [
    [m.stage.time, formatTime(result.time)],
    [m.stage.par, formatTime(result.parTime)],
  ];
  // The other driver's time sits with the times; while they haven't run it, a line of its own below.
  if (other && theirs)
    rows.push([other.name, theirs.time === null ? m.session.retired : formatTime(theirs.time)]);
  rows.push([m.session.pace, fill(m.session.points, { n: points?.pace ?? 0 })]);
  if (complete && points) {
    rows.push([m.session.win, fill(m.session.points, { n: points.win })]);
    rows.push([m.session.sectors, fill(m.session.points, { n: points.sectors })]);
  }
  rows.push([
    m.session.stagePoints,
    `${fill(m.session.points, { n: points?.total ?? 0 })}${complete ? '' : '*'}`,
  ]);

  const uploadText = {
    idle: m.session.uploadSending,
    sending: m.session.uploadSending,
    saved: m.session.uploadSaved,
    failed: m.session.uploadFailed,
  }[upload];

  return (
    <div className="pixel-scrim pointer-events-auto absolute inset-0 grid place-items-center p-4 short:p-2 md:p-6">
      {/* Phones in landscape: tighter spacing, and the card scrolls rather than overflow. */}
      <section
        role="dialog"
        aria-labelledby="result-title"
        className="pixel-box max-h-full w-96 max-w-full overflow-y-auto p-6 short:p-3"
        data-testid="session-result"
      >
        <h2 id="result-title" className="font-pixel text-lg leading-snug short:text-base">
          {laps.length > 0 ? m.stage.raceTitle : m.stage.resultTitle}
        </h2>
        <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 short:mt-2 short:gap-y-0">
          {rows.map(([k, v], i) => (
            <div key={i} className="contents">
              <dt className="min-w-0 truncate">{k}</dt>
              <dd className="text-right font-pixel text-xs leading-6">{v}</dd>
            </div>
          ))}
        </dl>
        {!theirs && (
          <p className="mt-3 text-sm short:mt-1" data-testid="opponent-status">
            {other ? `${other.name} · ${m.session.opponentPending}` : m.session.opponentMissing}
          </p>
        )}
        {!complete && (
          <p className="mt-2 text-xs text-ink/70 short:mt-1">{m.session.provisional}</p>
        )}
        <div className="mt-4 flex items-center gap-3 short:mt-2">
          <p role="status" className="flex-1 text-sm">
            {uploadText}
          </p>
          {upload === 'failed' && (
            <button
              type="button"
              className="pixel-btn-ghost px-3 py-2 text-[10px]"
              onClick={retryUpload}
            >
              {m.session.uploadRetry}
            </button>
          )}
        </div>
        <div className="mt-6 flex gap-2 short:mt-3">
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
            onClick={backToLobby}
            disabled={upload === 'sending'}
          >
            {m.session.backToSession}
          </button>
        </div>
      </section>
    </div>
  );
}
