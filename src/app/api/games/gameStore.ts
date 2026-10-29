import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isValidGameId } from '@/game/save/GameId';
import { parseSaveFile, type SaveFile } from '@/game/save/SaveFile';

/** Server-side persistence for saves, keyed by Game ID. */
export interface GameStore {
  read(gameId: string): Promise<SaveFile | null>;
  write(file: SaveFile): Promise<void>;
}

/**
 * One JSON file per game. Good for `next dev` and a single self-hosted node;
 * useless on serverless, where the filesystem is read-only and ephemeral.
 */
export class FileGameStore implements GameStore {
  constructor(private readonly dir: string) {}

  private fileFor(gameId: string): string {
    if (!isValidGameId(gameId)) throw new Error('invalid game id');
    return path.join(this.dir, `${gameId}.json`);
  }

  async read(gameId: string): Promise<SaveFile | null> {
    try {
      return parseSaveFile(JSON.parse(await readFile(this.fileFor(gameId), 'utf8')));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  /** Atomic write: temp file then rename, so a crash never leaves a half-written save. */
  async write(file: SaveFile): Promise<void> {
    const target = this.fileFor(file.gameId);
    await mkdir(this.dir, { recursive: true });
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(file), 'utf8');
    await rename(tmp, target);
  }
}

/**
 * Redis over the Upstash REST API (what Vercel's KV / Upstash integration
 * provides). Plain `fetch`, no SDK: `GET /get/<key>` → `{ result }`,
 * `POST /set/<key>` with the value as the body.
 */
export class RedisGameStore implements GameStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly prefix = 'micro-rally:game:',
  ) {}

  private key(gameId: string): string {
    if (!isValidGameId(gameId)) throw new Error('invalid game id');
    return encodeURIComponent(this.prefix + gameId);
  }

  async read(gameId: string): Promise<SaveFile | null> {
    const res = await this.fetchFn(`${this.url}/get/${this.key(gameId)}`, {
      headers: { authorization: `Bearer ${this.token}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`redis get failed: ${res.status}`);
    const { result } = (await res.json()) as { result: string | null };
    if (result === null || result === undefined) return null;
    try {
      return parseSaveFile(JSON.parse(result));
    } catch {
      return null;
    }
  }

  async write(file: SaveFile): Promise<void> {
    const res = await this.fetchFn(`${this.url}/set/${this.key(file.gameId)}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(file),
    });
    if (!res.ok) throw new Error(`redis set failed: ${res.status}`);
  }
}

export type StoreEnv = Partial<
  Record<
    | 'KV_REST_API_URL'
    | 'KV_REST_API_TOKEN'
    | 'UPSTASH_REDIS_REST_URL'
    | 'UPSTASH_REDIS_REST_TOKEN'
    | 'MICRO_RALLY_SAVE_DIR'
    | 'VERCEL',
    string
  >
>;

/**
 * Pick the store for this deployment:
 * - Redis when Vercel KV / Upstash credentials are present (production).
 * - The file store elsewhere (dev, self-hosted), under MICRO_RALLY_SAVE_DIR or `.data/games`.
 * - `null` on Vercel without Redis: saves then stay on the player's device and the
 *   API answers 503 rather than pretending to persist into a read-only filesystem.
 */
export function selectGameStore(
  env: StoreEnv,
  cwd: string,
  fetchFn?: typeof fetch,
): GameStore | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new RedisGameStore(url.replace(/\/$/, ''), token, fetchFn);
  if (env.VERCEL) return null;
  return new FileGameStore(env.MICRO_RALLY_SAVE_DIR ?? path.join(cwd, '.data', 'games'));
}

let active: GameStore | null | undefined;

/** The process-wide store, chosen once from the environment. */
export function getGameStore(): GameStore | null {
  if (active === undefined) active = selectGameStore(process.env as StoreEnv, process.cwd());
  return active;
}
