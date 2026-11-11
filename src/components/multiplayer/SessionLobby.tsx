'use client';

import { sessionStage, stageToDrive } from '@/game/multiplayer/Session';
import { sessionStandings, sessionWinner } from '@/game/multiplayer/SessionScore';
import { formatGameId } from '@/game/save/GameId';
import { fill } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { driveSessionStage, leaveSession, useSessionStore } from '@/state/sessionStore';
import { QUIET_LINK } from '@/components/splash/ModeSelect';
import { SplashFrame } from '@/components/splash/SplashScreen';
import { SessionStandings } from './SessionStandings';
import { useCopySessionLink, useSessionBriefs, useSessionPolling } from './sessionHooks';

/**
 * Between stages: the Session ID to share, the scoreboard, and either the
 * stage this driver can run next or who the session is waiting for. Polls
 * the server so the other driver's progress shows up on its own.
 */
export function SessionLobby() {
  const session = useSessionStore((s) => s.session);
  const seat = useSessionStore((s) => s.seat);
  if (!session || !seat) return null;
  return <Lobby key={session.id} />;
}

function Lobby() {
  const m = useMessages();
  const session = useSessionStore((s) => s.session)!;
  const me = useSessionStore((s) => s.seat)!.playerId;
  const offline = useSessionStore((s) => s.offline);
  const briefs = useSessionBriefs(session);
  const { copied, copy } = useCopySessionLink(session.id);
  const current = sessionStage(session);
  const over = current >= session.stageCount;
  // A finished session can't change any more.
  useSessionPolling(!over);
  const next = stageToDrive(session, me);
  const other = session.players.find((p) => p.id !== me);
  const seatOpen = !other;

  let status: string;
  if (over) {
    const winner = sessionWinner(sessionStandings(session, (i) => briefs[i]!.parTime));
    status = winner ? fill(m.session.winner, { name: winner.name }) : m.session.draw;
  } else if (next !== null) {
    status = `${briefs[next]!.name} · ${m.stageTypes[briefs[next]!.stageType]}`;
  } else if (other) {
    status = fill(m.session.waitingFor, { name: other.name, n: current + 1 });
  } else {
    status = fill(m.session.waitingJoin, { n: current + 1 });
  }

  return (
    <SplashFrame width="max-w-lg">
      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-pixel text-xs">
            {over ? m.session.finalTitle : m.session.lobbyTitle}
          </h2>
          <code className="font-pixel text-xs select-all" data-testid="session-id">
            {formatGameId(session.id)}
          </code>
        </div>
        <p className="mt-2 text-sm text-ink/70">
          {fill(m.session.summary, {
            n: session.stageCount,
            car: m.cars[session.carId].name,
          })}
        </p>
        {seatOpen && <p className="mt-2 text-sm">{m.session.shareHint}</p>}
        <button type="button" className="pixel-btn-ghost mt-3 w-full" onClick={copy}>
          {copied ? m.session.copied : m.session.copyLink}
        </button>

        <h3 className="mt-6 font-pixel text-xs">{m.session.standings}</h3>
        <SessionStandings session={session} briefs={briefs} me={me} current={current} />

        <p role="status" className="mt-5 text-sm font-semibold" data-testid="session-status">
          {status}
        </p>
        {offline && (
          <p role="alert" className="pixel-box-dark mt-3 p-3 text-sm">
            {m.session.offline}
          </p>
        )}
        {next !== null && (
          <button
            type="button"
            className="pixel-btn mt-4 w-full"
            onClick={() => driveSessionStage()}
            autoFocus
          >
            {fill(m.session.drive, { n: next + 1 })}
          </button>
        )}
        <div className="mt-5 text-center">
          <button type="button" className={QUIET_LINK} onClick={leaveSession}>
            {m.session.leave}
          </button>
        </div>
      </div>
    </SplashFrame>
  );
}
