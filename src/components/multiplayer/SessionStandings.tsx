'use client';

import { useMemo } from 'react';
import { resultFor, SESSION_SEATS, type SessionView } from '@/game/multiplayer/Session';
import { sessionStandings, type StagePoints } from '@/game/multiplayer/SessionScore';
import type { StageBrief } from '@/game/stage/StageGenerator';
import { fill, formatTime } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';

interface SessionStandingsProps {
  session: SessionView;
  briefs: readonly StageBrief[];
  me: string;
  /** The stage the session is on, marked in the table; stageCount once it's over. */
  current: number;
}

/**
 * The scoreboard: one row per stage (each driver's time and points), totals
 * at the foot. A stage win is marked with a star and named for assistive
 * tech; points that can still change carry an asterisk, explained below.
 * Nothing relies on colour alone.
 */
export function SessionStandings({ session, briefs, me, current }: SessionStandingsProps) {
  const m = useMessages();
  const standings = useMemo(
    () => sessionStandings(session, (i) => briefs[i]!.parTime),
    [session, briefs],
  );
  const byId = new Map(standings.map((s) => [s.playerId, s]));
  const seats = Array.from(
    { length: SESSION_SEATS },
    (_, seat) => session.players.find((p) => p.seat === seat) ?? null,
  );
  const complete = (stage: number) =>
    session.results.filter((r) => r.stageIndex === stage).length >= SESSION_SEATS;
  const provisional = session.results.some((r) => !complete(r.stageIndex));

  const cell = (playerId: string, stage: number, points: StagePoints | null) => {
    const r = resultFor(session, stage, playerId);
    if (!r) return <span className="text-ink/50">{m.session.notRun}</span>;
    return (
      <>
        <span className="block">{r.time === null ? m.session.retired : formatTime(r.time)}</span>
        <span className="block text-ink/70">
          {points && points.win > 0 && (
            <>
              <span aria-hidden="true">★ </span>
              <span className="sr-only">{m.session.stageWin}: </span>
            </>
          )}
          {fill(m.session.points, { n: points?.total ?? 0 })}
          {!complete(stage) && <span aria-hidden="true">*</span>}
        </span>
      </>
    );
  };

  const rows = briefs.map((b, i) => (
    <tr key={i} className={i === current ? 'bg-ink/10' : undefined}>
      <th scope="row" className="py-1.5 pr-2 text-left align-top font-normal">
        <span className="block font-pixel text-[10px] leading-5">
          {i === current && <span aria-hidden="true">▶ </span>}
          {i + 1}
        </span>
        <span className="block text-xs text-ink/70">
          {b.name} · {m.stageTypes[b.stageType]}
        </span>
      </th>
      {seats.map((p, seat) => (
        <td key={seat} className="py-1.5 pl-2 text-right align-top text-xs tabular-nums">
          {p ? cell(p.id, i, byId.get(p.id)?.stages[i] ?? null) : null}
        </td>
      ))}
    </tr>
  ));

  return (
    <>
      <table className="mt-2 w-full border-collapse" data-testid="session-standings">
        <caption className="sr-only">{m.session.standings}</caption>
        <thead>
          <tr className="border-b-2 border-ink">
            <th scope="col" className="pb-1 text-left font-pixel text-[10px]">
              {m.session.stageCol}
            </th>
            {seats.map((p, seat) => (
              <th
                key={seat}
                scope="col"
                className="pb-1 pl-2 text-right text-xs font-semibold break-words"
              >
                {p ? (
                  <>
                    <span className="block">
                      {p.id === me ? fill(m.session.you, { name: p.name }) : p.name}
                    </span>
                    <span className="block font-normal text-ink/70">
                      {p.carId ? m.cars[p.carId].name : m.session.choosingCar}
                    </span>
                  </>
                ) : (
                  <span className="font-normal text-ink/50">{m.session.openSeat}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
        <tfoot>
          <tr className="border-t-2 border-ink">
            <th scope="row" className="pt-1.5 text-left font-pixel text-[10px]">
              {m.session.total}
            </th>
            {seats.map((p, seat) => (
              <td
                key={seat}
                className="pt-1.5 pl-2 text-right text-sm font-semibold tabular-nums"
                data-testid={p ? `session-total-${seat}` : undefined}
              >
                {p ? fill(m.session.points, { n: byId.get(p.id)?.total ?? 0 }) : null}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      {provisional && <p className="mt-2 text-xs text-ink/70">{m.session.provisional}</p>}
    </>
  );
}
