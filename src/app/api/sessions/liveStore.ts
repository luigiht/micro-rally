import { LIVE_STALE_MS, parseLiveRecord, type LiveRecord } from '@/game/multiplayer/LiveTrack';
import type { StoreEnv } from '../games/gameStore';

/**
 * The latest live window of each driver in each session: ephemeral, one
 * slot per driver, overwritten a few times a second while they drive.
 */
export interface LiveStore {
  /**
   * Keep this driver's record and answer the other driver's, or null when
   * the other driver hasn't sent one in the last `LIVE_STALE_MS`.
   */
  exchange(sessionId: string, playerId: string, record: LiveRecord): Promise<LiveRecord | null>;
}

interface Slot {
  record: LiveRecord;
  at: number;
}

/**
 * In this process's memory, for `next dev`, self-hosting and the e2e server,
 * which all run one process. Sessions nobody has written to for a while are
 * dropped as others write, so the map can't grow without bound.
 */
export class MemoryLiveStore implements LiveStore {
  private readonly sessions = new Map<string, Map<string, Slot>>();

  constructor(private readonly now: () => number = Date.now) {}

  async exchange(sessionId: string, playerId: string, record: LiveRecord) {
    const now = this.now();
    for (const [id, slots] of this.sessions) {
      if (id === sessionId) continue;
      if ([...slots.values()].every((s) => now - s.at > LIVE_STALE_MS)) this.sessions.delete(id);
    }
    let slots = this.sessions.get(sessionId);
    if (!slots) {
      slots = new Map();
      this.sessions.set(sessionId, slots);
    }
    slots.set(playerId, { record, at: now });
    for (const [id, slot] of slots)
      if (id !== playerId && now - slot.at <= LIVE_STALE_MS) return slot.record;
    return null;
  }
}

interface LiveRow {
  player_id: string;
  stage_index: number;
  run: string;
  samples: unknown;
}

/**
 * Supabase: the unlogged `session_live` table, written and read in one
 * round trip by the `session_live_exchange` function (see
 * supabase/migrations). Server-only, with the service-role key.
 */
export class SupabaseLiveStore implements LiveStore {
  private readonly url: string;

  constructor(
    url: string,
    private readonly serviceKey: string,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {
    this.url = `${url.replace(/\/$/, '')}/rest/v1/rpc/session_live_exchange`;
  }

  async exchange(sessionId: string, playerId: string, record: LiveRecord) {
    const res = await this.fetchFn(this.url, {
      method: 'POST',
      headers: {
        apikey: this.serviceKey,
        authorization: `Bearer ${this.serviceKey}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        p_session: sessionId,
        p_player: playerId,
        p_stage: record.stageIndex,
        p_run: record.run,
        p_samples: record.samples,
      }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`supabase live exchange failed: ${res.status}`);
    const rows = (await res.json()) as LiveRow[];
    const row = rows[0];
    if (!row) return null;
    return parseLiveRecord({ stageIndex: row.stage_index, run: row.run, samples: row.samples });
  }
}

/** Supabase when configured, memory off Vercel, and none on bare Vercel (its instances share no memory). */
export function selectLiveStore(env: StoreEnv, fetchFn?: typeof fetch): LiveStore | null {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return new SupabaseLiveStore(url, key, fetchFn);
  if (env.VERCEL) return null;
  return new MemoryLiveStore();
}

let active: LiveStore | null | undefined;

/** The process-wide store, chosen once from the environment. */
export function getLiveStore(): LiveStore | null {
  if (active === undefined) active = selectLiveStore(process.env as StoreEnv);
  return active;
}
