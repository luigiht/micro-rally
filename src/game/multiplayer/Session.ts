import { isCatalogCar, type CatalogCarId } from '../economy/cars';
import { isValidGameId } from '../save/GameId';
import { sanitizeDriverName } from '../save/SaveFile';

/** Drivers in a session: the host and one guest. Seats are numbered 0 (host) and 1. */
export const SESSION_SEATS = 2;

/** How many stages the host can make a session. */
export const SESSION_LENGTHS = [3, 6, 9] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];

/** A counted time faster than this share of par is refused as implausible. */
export const MIN_PAR_SHARE = 0.25;
/** Longest counted time, seconds. */
export const MAX_STAGE_TIME = 3600;
/** More checkpoint splits than any stage has. */
const MAX_SPLITS = 64;

export interface SessionPlayer {
  id: string;
  name: string;
  seat: number;
}

/** One driver's counted run of one stage. `time` is null when they retired from it. */
export interface SessionResult {
  stageIndex: number;
  playerId: string;
  time: number | null;
  splits: number[];
}

/** Everything a driver in the session may see; secrets stay on the server. */
export interface SessionView {
  id: string;
  seed: number;
  stageCount: SessionLength;
  carId: CatalogCarId;
  createdAt: number;
  players: SessionPlayer[];
  results: SessionResult[];
}

/** What a client submits when a run ends. */
export interface ResultInput {
  stageIndex: number;
  time: number | null;
  splits: number[];
}

export function isSessionLength(n: unknown): n is SessionLength {
  return (SESSION_LENGTHS as readonly unknown[]).includes(n);
}

export function resultFor(
  view: Pick<SessionView, 'results'>,
  stageIndex: number,
  playerId: string,
): SessionResult | null {
  return view.results.find((r) => r.stageIndex === stageIndex && r.playerId === playerId) ?? null;
}

/**
 * The stage the session is on: the first one that lacks a result from every
 * seat. Nobody moves past it until both drivers have finished (or retired).
 * Equals `stageCount` once the session is over.
 */
export function sessionStage(view: Pick<SessionView, 'results' | 'stageCount'>): number {
  for (let i = 0; i < view.stageCount; i++) {
    const done = view.results.filter((r) => r.stageIndex === i).length;
    if (done < SESSION_SEATS) return i;
  }
  return view.stageCount;
}

export function sessionOver(view: Pick<SessionView, 'results' | 'stageCount'>): boolean {
  return sessionStage(view) >= view.stageCount;
}

/** The stage this player should drive now, or null while they wait for the other driver (or it's over). */
export function stageToDrive(
  view: Pick<SessionView, 'results' | 'stageCount'>,
  playerId: string,
): number | null {
  const stage = sessionStage(view);
  if (stage >= view.stageCount) return null;
  return resultFor(view, stage, playerId) ? null : stage;
}

export type ResultProblem =
  'over' | 'not_current' | 'duplicate' | 'invalid_time' | 'invalid_splits';

/**
 * Why a submitted run can't count, or null when it can: it must be for the
 * session's current stage, the first run this player sends for it, a
 * plausible time against par, and splits that climb to no more than the time.
 */
export function checkResult(
  view: Pick<SessionView, 'results' | 'stageCount'>,
  playerId: string,
  input: ResultInput,
  parTime: number,
): ResultProblem | null {
  const stage = sessionStage(view);
  if (stage >= view.stageCount) return 'over';
  if (input.stageIndex !== stage) return 'not_current';
  if (resultFor(view, stage, playerId)) return 'duplicate';
  if (input.time === null) return input.splits.length === 0 ? null : 'invalid_splits';
  if (
    !Number.isFinite(input.time) ||
    input.time < parTime * MIN_PAR_SHARE ||
    input.time > MAX_STAGE_TIME
  )
    return 'invalid_time';
  if (input.splits.length > MAX_SPLITS) return 'invalid_splits';
  let prev = 0;
  for (const s of input.splits) {
    if (!Number.isFinite(s) || s < prev || s > input.time + 1e-6) return 'invalid_splits';
    prev = s;
  }
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Validate a submitted run body; null when malformed. */
export function parseResultInput(raw: unknown): ResultInput | null {
  if (!isRecord(raw)) return null;
  const { stageIndex, time, splits } = raw;
  if (!Number.isInteger(stageIndex) || (stageIndex as number) < 0) return null;
  if (time !== null && !finite(time)) return null;
  if (!Array.isArray(splits) || !splits.every(finite)) return null;
  return { stageIndex: stageIndex as number, time: time as number | null, splits };
}

/** A name for the session's scoreboard: trimmed and capped like a driver name; empty when unusable. */
export function sessionDriverName(raw: unknown): string {
  return typeof raw === 'string' ? sanitizeDriverName(raw) : '';
}

function parsePlayer(raw: unknown): SessionPlayer | null {
  if (!isRecord(raw)) return null;
  const { id, name, seat } = raw;
  if (typeof id !== 'string' || typeof name !== 'string' || !Number.isInteger(seat)) return null;
  return { id, name, seat: seat as number };
}

function parseResult(raw: unknown): SessionResult | null {
  if (!isRecord(raw) || typeof raw.playerId !== 'string') return null;
  const input = parseResultInput(raw);
  return input ? { ...input, playerId: raw.playerId } : null;
}

/** Validate a session from the API; null when it isn't one. */
export function parseSessionView(raw: unknown): SessionView | null {
  if (!isRecord(raw)) return null;
  const { id, seed, stageCount, carId, createdAt, players, results } = raw;
  if (typeof id !== 'string' || !isValidGameId(id)) return null;
  if (!finite(seed) || !finite(createdAt) || !isSessionLength(stageCount)) return null;
  if (typeof carId !== 'string' || !isCatalogCar(carId)) return null;
  if (!Array.isArray(players) || !Array.isArray(results)) return null;
  const parsedPlayers = players.map(parsePlayer);
  const parsedResults = results.map(parseResult);
  if (parsedPlayers.some((p) => !p) || parsedResults.some((r) => !r)) return null;
  return {
    id,
    seed,
    stageCount,
    carId,
    createdAt,
    players: (parsedPlayers as SessionPlayer[]).sort((a, b) => a.seat - b.seat),
    results: parsedResults as SessionResult[],
  };
}
