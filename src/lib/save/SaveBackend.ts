import { parseSaveFile, type SaveFile } from '@/game/save/SaveFile';

export interface SaveOptions {
  /** Let the request outlive the page (used on pagehide). */
  keepalive?: boolean;
}

export interface SaveBackend {
  load(gameId: string): Promise<SaveFile | null>;
  save(file: SaveFile, opts?: SaveOptions): Promise<void>;
}

/** The subset of `Storage` we use, so tests can pass a plain map. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const SAVE_PREFIX = 'micro-rally:save:';
const LAST_GAME_KEY = 'micro-rally:last-game';

/** Device-local saves in Web Storage, plus the ID of the last game played here. */
export class LocalSaveBackend implements SaveBackend {
  constructor(private readonly storage: StorageLike) {}

  load(gameId: string): Promise<SaveFile | null> {
    return Promise.resolve(this.loadSync(gameId));
  }

  loadSync(gameId: string): SaveFile | null {
    try {
      const raw = this.storage.getItem(SAVE_PREFIX + gameId);
      return raw ? parseSaveFile(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  save(file: SaveFile): Promise<void> {
    this.storage.setItem(SAVE_PREFIX + file.gameId, JSON.stringify(file));
    return Promise.resolve();
  }

  get lastGameId(): string | null {
    return this.storage.getItem(LAST_GAME_KEY);
  }

  set lastGameId(id: string | null) {
    if (id) this.storage.setItem(LAST_GAME_KEY, id);
    else this.storage.removeItem(LAST_GAME_KEY);
  }
}

/** Online saves via the `/api/games/:id` route. Any failure throws; callers decide how to degrade. */
export class RemoteSaveBackend implements SaveBackend {
  constructor(
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly baseUrl = '/api/games',
    private readonly timeoutMs = 6000,
  ) {}

  async load(gameId: string): Promise<SaveFile | null> {
    const res = await this.fetchFn(`${this.baseUrl}/${gameId}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`load failed: ${res.status}`);
    return parseSaveFile(await res.json());
  }

  async save(file: SaveFile, opts: SaveOptions = {}): Promise<void> {
    const res = await this.fetchFn(`${this.baseUrl}/${file.gameId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(file),
      keepalive: opts.keepalive ?? false,
      signal: opts.keepalive ? undefined : AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`save failed: ${res.status}`);
  }
}
