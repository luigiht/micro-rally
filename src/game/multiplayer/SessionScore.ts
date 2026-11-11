import { paceFactor } from '../economy/prize';
import { SESSION_SEATS, type SessionResult, type SessionView } from './Session';

/** Pace points at par; the prize curve scales them from 300 (double par) to 1250 (20 % under). */
export const PACE_POINTS = 1000;
/** To the faster driver once both have run the stage. */
export const STAGE_WIN_POINTS = 300;
/** Per section between checkpoints where a driver was faster. */
export const SECTOR_WIN_POINTS = 50;

export interface StagePoints {
  pace: number;
  /** STAGE_WIN_POINTS or 0; settled only once every seat has a result. */
  win: number;
  sectors: number;
  total: number;
}

const ZERO: Readonly<StagePoints> = { pace: 0, win: 0, sectors: 0, total: 0 };

/** Time between consecutive splits, the first measured from the start. */
function sectorTimes(splits: readonly number[]): number[] {
  return splits.map((s, i) => s - (i > 0 ? splits[i - 1]! : 0));
}

/**
 * Points for one stage, per player with a result. Pace counts as soon as a
 * run is in; the stage win and section wins wait until every seat has run,
 * so a lone finisher sees provisional points. A retirement scores nothing
 * and wins nothing; ties share nothing.
 */
export function scoreStage(
  results: readonly SessionResult[],
  parTime: number,
): Map<string, StagePoints> {
  const out = new Map<string, StagePoints>();
  for (const r of results) {
    const pace = r.time === null ? 0 : Math.round(PACE_POINTS * paceFactor(r.time, parTime));
    out.set(r.playerId, { ...ZERO, pace, total: pace });
  }
  if (results.length < SESSION_SEATS) return out;

  const finished = results.filter((r) => r.time !== null);
  const award = (playerId: string, field: 'win' | 'sectors', points: number) => {
    const p = out.get(playerId)!;
    p[field] += points;
    p.total += points;
  };

  // Stage win: the single fastest finisher.
  const best = Math.min(...finished.map((r) => r.time!));
  const winners = finished.filter((r) => r.time === best);
  if (winners.length === 1) award(winners[0]!.playerId, 'win', STAGE_WIN_POINTS);

  // Section wins: compare each section both finishers timed.
  if (finished.length >= 2) {
    const sectors = finished.map((r) => sectorTimes(r.splits));
    const count = Math.min(...sectors.map((s) => s.length));
    for (let i = 0; i < count; i++) {
      const fastest = Math.min(...sectors.map((s) => s[i]!));
      const holders = finished.filter((_, k) => sectors[k]![i] === fastest);
      if (holders.length === 1) award(holders[0]!.playerId, 'sectors', SECTOR_WIN_POINTS);
    }
  }
  return out;
}

export interface Standing {
  playerId: string;
  name: string;
  total: number;
  stageWins: number;
  /** Points per stage index; null where this driver has no result yet. */
  stages: (StagePoints | null)[];
}

/**
 * The scoreboard, leader first (ties by seat). `parFor` gives each stage's
 * par time (the stage brief's), kept as a parameter so this stays free of
 * the stage generator.
 */
export function sessionStandings(
  view: Pick<SessionView, 'players' | 'results' | 'stageCount'>,
  parFor: (stageIndex: number) => number,
): Standing[] {
  const rows: Standing[] = view.players.map((p) => ({
    playerId: p.id,
    name: p.name,
    total: 0,
    stageWins: 0,
    stages: Array.from({ length: view.stageCount }, () => null),
  }));
  for (let i = 0; i < view.stageCount; i++) {
    const results = view.results.filter((r) => r.stageIndex === i);
    if (results.length === 0) continue;
    const points = scoreStage(results, parFor(i));
    for (const row of rows) {
      const p = points.get(row.playerId);
      if (!p) continue;
      row.stages[i] = p;
      row.total += p.total;
      if (p.win > 0) row.stageWins++;
    }
  }
  const seat = new Map(view.players.map((p) => [p.id, p.seat]));
  return rows.sort((a, b) => b.total - a.total || seat.get(a.playerId)! - seat.get(b.playerId)!);
}

/** The winner of a finished session, or null on a draw. */
export function sessionWinner(standings: readonly Standing[]): Standing | null {
  const [first, second] = standings;
  if (!first) return null;
  return second && second.total === first.total ? null : first;
}
