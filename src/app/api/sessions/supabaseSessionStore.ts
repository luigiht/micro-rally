import { isCatalogCar } from '@/game/economy/cars';
import { isValidGameId } from '@/game/save/GameId';
import { isSessionLength, type SessionResult } from '@/game/multiplayer/Session';
import type { SessionStore, StoredPlayer, StoredSession } from './sessionStore';

interface PlayerRow {
  seat: number;
  player_id: string;
  name: string;
  token_hash: string;
}

interface ResultRow {
  stage_index: number;
  player_id: string;
  time: number | null;
  splits: unknown;
}

interface SessionRow {
  id: string;
  seed: number;
  stage_count: number;
  car_id: string;
  created_at: string;
  session_players: PlayerRow[];
  session_results: ResultRow[];
}

const SELECT =
  'id,seed,stage_count,car_id,created_at,' +
  'session_players(seat,player_id,name,token_hash),' +
  'session_results(stage_index,player_id,time,splits)';

function fromRow(row: SessionRow): StoredSession | null {
  if (!isSessionLength(row.stage_count) || !isCatalogCar(row.car_id)) return null;
  return {
    id: row.id,
    seed: Number(row.seed),
    stageCount: row.stage_count,
    carId: row.car_id,
    createdAt: Date.parse(row.created_at),
    players: row.session_players.map((p) => ({
      id: p.player_id,
      name: p.name,
      seat: p.seat,
      tokenHash: p.token_hash,
    })),
    results: row.session_results.map((r) => ({
      stageIndex: r.stage_index,
      playerId: r.player_id,
      time: r.time,
      splits: Array.isArray(r.splits) ? (r.splits as number[]) : [],
    })),
  };
}

/**
 * Sessions in Supabase Postgres through PostgREST: tables `sessions`,
 * `session_players` and `session_results` (see supabase/migrations). Their
 * primary keys make a taken seat or a second run for a stage a 409, which
 * is how two drivers acting at once are kept from overwriting each other.
 * Server-only, with the service-role key, like the saves.
 */
export class SupabaseSessionStore implements SessionStore {
  private readonly base: string;

  constructor(
    url: string,
    private readonly serviceKey: string,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {
    this.base = `${url.replace(/\/$/, '')}/rest/v1`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.serviceKey,
      authorization: `Bearer ${this.serviceKey}`,
      accept: 'application/json',
      ...extra,
    };
  }

  /** Insert one row; false on a key conflict, throws on anything else. */
  private async insert(table: string, row: object): Promise<boolean> {
    const res = await this.fetchFn(`${this.base}/${table}`, {
      method: 'POST',
      headers: this.headers({ 'content-type': 'application/json', prefer: 'return=minimal' }),
      body: JSON.stringify(row),
    });
    if (res.status === 409) return false;
    if (!res.ok) throw new Error(`supabase insert into ${table} failed: ${res.status}`);
    return true;
  }

  private playerRow(id: string, p: StoredPlayer) {
    return {
      session_id: id,
      seat: p.seat,
      player_id: p.id,
      name: p.name,
      token_hash: p.tokenHash,
    };
  }

  async create(s: StoredSession): Promise<boolean> {
    const created = await this.insert('sessions', {
      id: s.id,
      seed: s.seed,
      stage_count: s.stageCount,
      car_id: s.carId,
      created_at: new Date(s.createdAt).toISOString(),
    });
    if (!created) return false;
    for (const p of s.players) await this.insert('session_players', this.playerRow(s.id, p));
    return true;
  }

  async read(id: string): Promise<StoredSession | null> {
    if (!isValidGameId(id)) throw new Error('invalid session id');
    const res = await this.fetchFn(
      `${this.base}/sessions?id=eq.${encodeURIComponent(id)}&select=${SELECT}&limit=1`,
      { headers: this.headers(), cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`supabase select failed: ${res.status}`);
    const rows = (await res.json()) as SessionRow[];
    return rows[0] ? fromRow(rows[0]) : null;
  }

  addPlayer(id: string, player: StoredPlayer): Promise<boolean> {
    return this.insert('session_players', this.playerRow(id, player));
  }

  addResult(id: string, r: SessionResult): Promise<boolean> {
    return this.insert('session_results', {
      session_id: id,
      stage_index: r.stageIndex,
      player_id: r.playerId,
      time: r.time,
      splits: r.splits,
    });
  }
}
