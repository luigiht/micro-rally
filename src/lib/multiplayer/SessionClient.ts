import type { CatalogCarId } from '@/game/economy/cars';
import {
  parseSessionView,
  type ResultInput,
  type SessionLength,
  type SessionView,
} from '@/game/multiplayer/Session';
import { isValidGameId, normalizeGameId } from '@/game/save/GameId';
import type { StorageLike } from '@/lib/save/SaveBackend';

/** This device's seat in a session: who it drives as, and the secret that proves it. */
export interface SessionSeat {
  playerId: string;
  token: string;
}

/**
 * Why a call failed: the API's error code (`not_found`, `full`, `duplicate`,
 * `not_current`…), or `unavailable` when the server couldn't be reached or
 * has no session storage.
 */
export class SessionApiError extends Error {
  constructor(readonly code: string) {
    super(`session api: ${code}`);
  }
}

export interface SeatedSession {
  session: SessionView;
  seat: SessionSeat;
}

/** The `/api/sessions` routes. Every failure throws a SessionApiError. */
export class SessionClient {
  constructor(
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly baseUrl = '/api/sessions',
    private readonly timeoutMs = 8000,
  ) {}

  private async call(path: string, body?: object): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new SessionApiError('unavailable');
    }
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const code = typeof json.error === 'string' ? json.error : '';
      throw new SessionApiError(
        res.status >= 500 || code === '' || code === 'storage_unconfigured' ? 'unavailable' : code,
      );
    }
    return json;
  }

  private static view(json: Record<string, unknown>): SessionView {
    const session = parseSessionView(json.session);
    if (!session) throw new SessionApiError('unavailable');
    return session;
  }

  private static seated(json: Record<string, unknown>): SeatedSession {
    const { playerId, token } = json;
    if (typeof playerId !== 'string' || typeof token !== 'string')
      throw new SessionApiError('unavailable');
    return { session: SessionClient.view(json), seat: { playerId, token } };
  }

  async create(name: string, stageCount: SessionLength, carId: CatalogCarId) {
    return SessionClient.seated(await this.call('', { name, stageCount, carId }));
  }

  async join(id: string, name: string): Promise<SeatedSession> {
    return SessionClient.seated(await this.call(`/${id}/join`, { name }));
  }

  async get(id: string): Promise<SessionView> {
    return SessionClient.view(await this.call(`/${id}`));
  }

  async submit(id: string, seat: SessionSeat, result: ResultInput): Promise<SessionView> {
    return SessionClient.view(await this.call(`/${id}/results`, { ...seat, ...result }));
  }
}

const SEAT_PREFIX = 'micro-rally:session-seat:';
const LAST_SESSION_KEY = 'micro-rally:last-session';
const NAME_KEY = 'micro-rally:session-name';

/** The seats this device holds, by Session ID, plus the last session and name used. */
export class SessionSeats {
  constructor(private readonly storage: StorageLike) {}

  get(id: string): SessionSeat | null {
    try {
      const raw = JSON.parse(this.storage.getItem(SEAT_PREFIX + id) ?? 'null') as unknown;
      if (typeof raw !== 'object' || raw === null) return null;
      const { playerId, token } = raw as Record<string, unknown>;
      return typeof playerId === 'string' && typeof token === 'string' ? { playerId, token } : null;
    } catch {
      return null;
    }
  }

  set(id: string, seat: SessionSeat): void {
    try {
      this.storage.setItem(SEAT_PREFIX + id, JSON.stringify(seat));
    } catch {
      // Storage full or blocked: the seat lasts as long as the page.
    }
  }

  private read(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
    } catch {
      // Best effort only.
    }
  }

  get lastSessionId(): string | null {
    const id = this.read(LAST_SESSION_KEY);
    return id && isValidGameId(id) ? id : null;
  }

  set lastSessionId(id: string) {
    this.write(LAST_SESSION_KEY, id);
  }

  get lastName(): string {
    return this.read(NAME_KEY) ?? '';
  }

  set lastName(name: string) {
    this.write(NAME_KEY, name);
  }
}

const PARAM = 'session';

/** The Session ID from `?session=`, normalized, or null when absent/invalid. */
export function readSessionParam(search: string): string | null {
  const id = normalizeGameId(new URLSearchParams(search).get(PARAM) ?? '');
  return isValidGameId(id) ? id : null;
}

/** Put the session in the URL (a bookmark or a shared link rejoins it); clears `?game=` meanwhile. */
export function writeSessionParam(id: string | null): void {
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set(PARAM, id);
    url.searchParams.delete('game');
  } else {
    url.searchParams.delete(PARAM);
  }
  window.history.replaceState(null, '', url);
}

/** A link that opens the splash on this session's join form. */
export function sessionLink(id: string, origin: string): string {
  return `${origin}/?${PARAM}=${id}`;
}
