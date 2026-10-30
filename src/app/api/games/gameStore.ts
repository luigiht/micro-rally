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
 * Supabase Postgres through its REST API (PostgREST), table `games`
 * (see supabase/migrations). Plain `fetch` with the service-role key, which
 * bypasses row-level security; the key never leaves the server.
 */
export class SupabaseGameStore implements GameStore {
  private readonly endpoint: string;

  constructor(
    url: string,
    private readonly serviceKey: string,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    table = 'games',
  ) {
    this.endpoint = `${url.replace(/\/$/, '')}/rest/v1/${table}`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.serviceKey,
      authorization: `Bearer ${this.serviceKey}`,
      accept: 'application/json',
      ...extra,
    };
  }

  async read(gameId: string): Promise<SaveFile | null> {
    if (!isValidGameId(gameId)) throw new Error('invalid game id');
    const res = await this.fetchFn(
      `${this.endpoint}?id=eq.${encodeURIComponent(gameId)}&select=save&limit=1`,
      { headers: this.headers(), cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`supabase select failed: ${res.status}`);
    const rows = (await res.json()) as { save: unknown }[];
    const row = rows[0];
    return row ? parseSaveFile(row.save) : null;
  }

  /** Upsert on the primary key; last write wins. */
  async write(file: SaveFile): Promise<void> {
    const res = await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers: this.headers({
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify({
        id: file.gameId,
        save: file,
        updated_at: new Date(file.updatedAt).toISOString(),
      }),
    });
    if (!res.ok) throw new Error(`supabase upsert failed: ${res.status}`);
  }
}

export type StoreEnv = Partial<
  Record<
    | 'SUPABASE_URL'
    | 'NEXT_PUBLIC_SUPABASE_URL'
    | 'SUPABASE_SERVICE_ROLE_KEY'
    | 'MICRO_RALLY_SAVE_DIR'
    | 'VERCEL',
    string
  >
>;

/**
 * Pick the store for this deployment:
 * - Supabase when a project URL and the service-role key are present (production).
 * - The file store elsewhere (dev, self-hosted), under MICRO_RALLY_SAVE_DIR or `.data/games`.
 * - `null` on Vercel without Supabase: saves then stay on the player's device and the
 *   API answers 503 rather than pretending to persist into a read-only filesystem.
 */
export function selectGameStore(
  env: StoreEnv,
  cwd: string,
  fetchFn?: typeof fetch,
): GameStore | null {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return new SupabaseGameStore(url, key, fetchFn);
  if (env.VERCEL) return null;
  return new FileGameStore(env.MICRO_RALLY_SAVE_DIR ?? path.join(cwd, '.data', 'games'));
}

let active: GameStore | null | undefined;

/** The process-wide store, chosen once from the environment. */
export function getGameStore(): GameStore | null {
  if (active === undefined) active = selectGameStore(process.env as StoreEnv, process.cwd());
  return active;
}
