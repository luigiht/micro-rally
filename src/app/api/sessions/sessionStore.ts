import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CatalogCarId } from '@/game/economy/cars';
import type { StageTypeId } from '@/game/stage/regions';
import { isValidGameId } from '@/game/save/GameId';
import type {
  SessionLength,
  SessionPlayer,
  SessionResult,
  SessionView,
} from '@/game/multiplayer/Session';
import type { StoreEnv } from '../games/gameStore';
import { SupabaseSessionStore } from './supabaseSessionStore';

/**
 * A seat as the server keeps it: the player plus the hash of their secret
 * token. `carId` is missing until the driver picks a car in the lobby (and
 * on seats from before drivers picked their own, which drive the session's).
 */
export interface StoredPlayer extends Omit<SessionPlayer, 'carId'> {
  carId?: CatalogCarId;
  tokenHash: string;
}

export interface StoredSession {
  id: string;
  seed: number;
  stageCount: SessionLength;
  /** The ticked stage types; absent on older sessions, which follow the career calendar. */
  stageTypes?: StageTypeId[];
  /** Older sessions' shared car: the fallback for their seats stored without one. */
  carId?: CatalogCarId;
  createdAt: number;
  players: StoredPlayer[];
  results: SessionResult[];
}

/**
 * Server-side persistence for multiplayer sessions. Seats and results are
 * insert-only, and each insert fails rather than overwrites when its slot is
 * taken, so two drivers acting at once can never erase each other.
 */
export interface SessionStore {
  /** Store a new session with its host; false when the ID is taken. */
  create(session: StoredSession): Promise<boolean>;
  read(id: string): Promise<StoredSession | null>;
  /** Seat a player; false when that seat is already taken. */
  addPlayer(id: string, player: StoredPlayer): Promise<boolean>;
  /** Record a run; false when this player already has one for the stage. */
  addResult(id: string, result: SessionResult): Promise<boolean>;
  /** Give a seat its car, once; false when it already has one (or there is no such seat). */
  setCar(id: string, playerId: string, carId: CatalogCarId): Promise<boolean>;
}

/** The public face of a stored session: no token hashes. */
export function toView(s: StoredSession): SessionView {
  return {
    id: s.id,
    seed: s.seed,
    stageCount: s.stageCount,
    ...(s.stageTypes ? { stageTypes: s.stageTypes } : {}),
    createdAt: s.createdAt,
    players: s.players
      .map(({ id, name, seat, carId }) => ({ id, name, seat, carId: carId ?? s.carId ?? null }))
      .sort((a, b) => a.seat - b.seat),
    results: s.results,
  };
}

/**
 * One JSON file per session, for `next dev`, self-hosting and the e2e
 * server. Changes to a session run one at a time in this process, so a
 * read-modify-write can't lose a concurrent insert.
 */
export class FileSessionStore implements SessionStore {
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(private readonly dir: string) {}

  private fileFor(id: string): string {
    if (!isValidGameId(id)) throw new Error('invalid session id');
    return path.join(this.dir, `${id}.json`);
  }

  /** Run `task` after every earlier change to this session has settled. */
  private serial<T>(id: string, task: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(id) ?? Promise.resolve();
    const next = prev.then(task, task);
    const tail = next.catch(() => undefined);
    this.queues.set(id, tail);
    void tail.then(() => {
      if (this.queues.get(id) === tail) this.queues.delete(id);
    });
    return next;
  }

  async read(id: string): Promise<StoredSession | null> {
    try {
      return JSON.parse(await readFile(this.fileFor(id), 'utf8')) as StoredSession;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  /** Atomic write: temp file then rename. */
  private async write(session: StoredSession): Promise<void> {
    const target = this.fileFor(session.id);
    await mkdir(this.dir, { recursive: true });
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(session), 'utf8');
    await rename(tmp, target);
  }

  create(session: StoredSession): Promise<boolean> {
    return this.serial(session.id, async () => {
      if (await this.read(session.id)) return false;
      await this.write(session);
      return true;
    });
  }

  addPlayer(id: string, player: StoredPlayer): Promise<boolean> {
    return this.serial(id, async () => {
      const s = await this.read(id);
      if (!s) throw new Error('session not found');
      if (s.players.some((p) => p.seat === player.seat || p.id === player.id)) return false;
      await this.write({ ...s, players: [...s.players, player] });
      return true;
    });
  }

  setCar(id: string, playerId: string, carId: CatalogCarId): Promise<boolean> {
    return this.serial(id, async () => {
      const s = await this.read(id);
      if (!s) throw new Error('session not found');
      const player = s.players.find((p) => p.id === playerId);
      if (!player || player.carId) return false;
      await this.write({
        ...s,
        players: s.players.map((p) => (p.id === playerId ? { ...p, carId } : p)),
      });
      return true;
    });
  }

  addResult(id: string, result: SessionResult): Promise<boolean> {
    return this.serial(id, async () => {
      const s = await this.read(id);
      if (!s) throw new Error('session not found');
      const taken = s.results.some(
        (r) => r.stageIndex === result.stageIndex && r.playerId === result.playerId,
      );
      if (taken) return false;
      await this.write({ ...s, results: [...s.results, result] });
      return true;
    });
  }
}

/**
 * Pick the store the way saves do: Supabase when its URL and service-role
 * key are set, else a file store (under MICRO_RALLY_SESSION_DIR or
 * `.data/sessions`), and none on Vercel without Supabase.
 */
export function selectSessionStore(
  env: StoreEnv & { MICRO_RALLY_SESSION_DIR?: string },
  cwd: string,
  fetchFn?: typeof fetch,
): SessionStore | null {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return new SupabaseSessionStore(url, key, fetchFn);
  if (env.VERCEL) return null;
  return new FileSessionStore(env.MICRO_RALLY_SESSION_DIR ?? path.join(cwd, '.data', 'sessions'));
}

let active: SessionStore | null | undefined;

/** The process-wide store, chosen once from the environment. */
export function getSessionStore(): SessionStore | null {
  if (active === undefined) active = selectSessionStore(process.env as StoreEnv, process.cwd());
  return active;
}
