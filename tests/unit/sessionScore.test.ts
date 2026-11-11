import { describe, expect, it } from 'vitest';
import type { SessionResult, SessionView } from '@/game/multiplayer/Session';
import {
  PACE_POINTS,
  SECTOR_WIN_POINTS,
  STAGE_WIN_POINTS,
  scoreStage,
  sessionStandings,
  sessionWinner,
} from '@/game/multiplayer/SessionScore';

const r = (
  playerId: string,
  time: number | null,
  splits: number[] = [],
  stageIndex = 0,
): SessionResult => ({ stageIndex, playerId, time, splits });

describe('scoreStage', () => {
  it('pays pace points from the prize curve as soon as a run is in', () => {
    const solo = scoreStage([r('a', 100)], 100).get('a')!;
    expect(solo).toEqual({ pace: PACE_POINTS, win: 0, sectors: 0, total: PACE_POINTS });
    // 20 % under par is the curve's +25 % ceiling; double par its 0.3 floor.
    expect(scoreStage([r('a', 80)], 100).get('a')!.pace).toBe(1250);
    expect(scoreStage([r('a', 200)], 100).get('a')!.pace).toBe(300);
  });

  it('settles the stage win and section wins once both have run', () => {
    // a: sections 30, 40, 30 · b: sections 35, 35, 32
    const points = scoreStage([r('a', 100, [30, 70, 100]), r('b', 102, [35, 70, 102])], 100);
    const a = points.get('a')!;
    const b = points.get('b')!;
    expect(a.win).toBe(STAGE_WIN_POINTS);
    expect(b.win).toBe(0);
    expect(a.sectors).toBe(2 * SECTOR_WIN_POINTS);
    expect(b.sectors).toBe(SECTOR_WIN_POINTS);
    expect(a.total).toBe(a.pace + a.win + a.sectors);
  });

  it('gives a retirement nothing and the other driver the win', () => {
    const points = scoreStage([r('a', null), r('b', 150, [70, 150])], 100);
    expect(points.get('a')).toEqual({ pace: 0, win: 0, sectors: 0, total: 0 });
    expect(points.get('b')!.win).toBe(STAGE_WIN_POINTS);
    expect(points.get('b')!.sectors).toBe(0);
  });

  it('shares nothing on a tie', () => {
    const points = scoreStage([r('a', 100, [50]), r('b', 100, [50])], 100);
    expect(points.get('a')!.win + points.get('b')!.win).toBe(0);
    expect(points.get('a')!.sectors + points.get('b')!.sectors).toBe(0);
  });
});

describe('sessionStandings', () => {
  const view: Pick<SessionView, 'players' | 'results' | 'stageCount'> = {
    stageCount: 3,
    players: [
      { id: 'a', name: 'Ada', seat: 0 },
      { id: 'b', name: 'Bo', seat: 1 },
    ],
    results: [r('a', 100, [], 0), r('b', 90, [], 0), r('a', 95, [], 1)],
  };

  it('sums each driver’s stages and puts the leader first', () => {
    // Stage 1: Ada 1000, Bo 1125 + 300 for the win. Stage 2 so far: Ada 1063, Bo nothing yet.
    const standings = sessionStandings(view, () => 100);
    expect(standings.map((s) => [s.name, s.total])).toEqual([
      ['Ada', 2063],
      ['Bo', 1425],
    ]);
    const [ada, bo] = standings;
    expect(bo!.stageWins).toBe(1);
    expect(ada!.stageWins).toBe(0);
    expect(bo!.stages[1]).toBeNull();
    expect(bo!.stages[2]).toBeNull();
  });

  it('names a winner, or none on a draw', () => {
    const standings = sessionStandings(view, () => 100);
    expect(sessionWinner(standings)?.name).toBe('Ada');
    const even = sessionStandings({ ...view, results: [r('a', 100), r('b', 100)] }, () => 100);
    expect(sessionWinner(even)).toBeNull();
  });
});
