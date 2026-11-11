import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FileSessionStore,
  selectSessionStore,
  toView,
  type StoredSession,
} from '@/app/api/sessions/sessionStore';
import { SupabaseSessionStore } from '@/app/api/sessions/supabaseSessionStore';

const host = { id: 'p-host', name: 'Ada', seat: 0, carId: 'hatchback' as const, tokenHash: 'aa' };
const guest = { id: 'p-guest', name: 'Bo', seat: 1, carId: 'buggy' as const, tokenHash: 'bb' };

const session: StoredSession = {
  id: 'ABCD2345',
  seed: 42,
  stageCount: 3,
  stageTypes: ['alpine', 'circuit'],
  createdAt: 1_700_000_000_000,
  players: [host],
  results: [],
};

let dir: string | null = null;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = null;
});

async function fileStore(): Promise<FileSessionStore> {
  dir = await mkdtemp(path.join(os.tmpdir(), 'mr-sessions-'));
  return new FileSessionStore(dir);
}

describe('FileSessionStore', () => {
  it('creates once, seats a guest once and records one run per driver per stage', async () => {
    const store = await fileStore();
    expect(await store.read('ABCD2345')).toBeNull();
    expect(await store.create(session)).toBe(true);
    expect(await store.create(session)).toBe(false);

    expect(await store.addPlayer('ABCD2345', guest)).toBe(true);
    expect(await store.addPlayer('ABCD2345', { ...guest, id: 'p-third' })).toBe(false);

    const run = { stageIndex: 0, playerId: 'p-host', time: 99, splits: [40] };
    expect(await store.addResult('ABCD2345', run)).toBe(true);
    expect(await store.addResult('ABCD2345', { ...run, time: 80 })).toBe(false);

    const saved = await store.read('ABCD2345');
    expect(saved?.players.map((p) => p.name)).toEqual(['Ada', 'Bo']);
    expect(saved?.results).toEqual([run]);
  });

  it('gives a seat its car once', async () => {
    const store = await fileStore();
    const bare = { id: guest.id, name: guest.name, seat: guest.seat, tokenHash: guest.tokenHash };
    await store.create({ ...session, players: [host, bare] });
    expect(await store.setCar('ABCD2345', 'p-guest', 'dakar')).toBe(true);
    expect(await store.setCar('ABCD2345', 'p-guest', 'wrc')).toBe(false);
    expect(await store.setCar('ABCD2345', 'p-host', 'wrc')).toBe(false);
    expect(await store.setCar('ABCD2345', 'nobody', 'wrc')).toBe(false);
    const saved = await store.read('ABCD2345');
    expect(saved?.players.map((p) => p.carId)).toEqual(['hatchback', 'dakar']);
    expect(saved?.stageTypes).toEqual(['alpine', 'circuit']);
  });

  it('keeps both runs when two drivers finish at the same moment', async () => {
    const store = await fileStore();
    await store.create({ ...session, players: [host, guest] });
    await Promise.all([
      store.addResult('ABCD2345', { stageIndex: 0, playerId: 'p-host', time: 99, splits: [] }),
      store.addResult('ABCD2345', { stageIndex: 0, playerId: 'p-guest', time: 98, splits: [] }),
    ]);
    expect((await store.read('ABCD2345'))?.results).toHaveLength(2);
  });

  it('refuses IDs that could escape its directory', async () => {
    const store = await fileStore();
    await expect(store.read('../x')).rejects.toThrow('invalid session id');
  });
});

describe('toView', () => {
  it('drops token hashes', () => {
    const view = toView({ ...session, players: [guest, host] });
    expect(JSON.stringify(view)).not.toContain('tokenHash');
    expect(view.players.map((p) => p.seat)).toEqual([0, 1]);
  });

  it('gives each driver their own car: none until picked, an older session’s shared one', () => {
    const legacy = { id: guest.id, name: guest.name, seat: guest.seat, tokenHash: guest.tokenHash };
    const view = toView({ ...session, players: [host, guest] });
    expect(view.players.map((p) => p.carId)).toEqual(['hatchback', 'buggy']);
    expect(toView({ ...session, players: [host, legacy] }).players[1]!.carId).toBeNull();
    const old = toView({ ...session, carId: 'wrc', players: [host, legacy] });
    expect(old.players.map((p) => p.carId)).toEqual(['hatchback', 'wrc']);
    expect(view.stageTypes).toEqual(['alpine', 'circuit']);
  });
});

/** A PostgREST stand-in: inserts with primary keys (409 on conflict) and the embedded select. */
function fakeSupabase() {
  const tables: Record<string, Record<string, unknown>[]> = {
    sessions: [],
    session_players: [],
    session_results: [],
  };
  const keys: Record<string, string[]> = {
    sessions: ['id'],
    session_players: ['session_id', 'seat'],
    session_results: ['session_id', 'stage_index', 'player_id'],
  };
  const calls: string[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const table = url.pathname.split('/').pop()!;
    calls.push(`${init?.method ?? 'GET'} ${table}`);
    if (init?.method === 'PATCH') {
      // Only the set-once car update: rows matching every eq./is.null filter get the body.
      const filters = [...url.searchParams.entries()];
      const patch = JSON.parse(String(init.body)) as Record<string, unknown>;
      const hits = tables[table]!.filter((r) =>
        filters.every(([k, v]) => (v === 'is.null' ? r[k] == null : r[k] === v.replace('eq.', ''))),
      );
      for (const r of hits) Object.assign(r, patch);
      return Response.json(hits);
    }
    if (init?.method === 'POST') {
      const row = JSON.parse(String(init.body)) as Record<string, unknown>;
      const key = (r: Record<string, unknown>) => keys[table]!.map((k) => r[k]).join('|');
      if (tables[table]!.some((r) => key(r) === key(row)))
        return new Response('{}', { status: 409 });
      tables[table]!.push(row);
      return new Response(null, { status: 201 });
    }
    const id = url.searchParams.get('id')!.replace('eq.', '');
    const row = tables.sessions!.find((r) => r.id === id);
    if (!row) return Response.json([]);
    return Response.json([
      {
        ...row,
        session_players: tables.session_players!.filter((r) => r.session_id === id),
        session_results: tables.session_results!.filter((r) => r.session_id === id),
      },
    ]);
  };
  return { fetchFn, tables, calls };
}

describe('SupabaseSessionStore', () => {
  it('maps sessions, seats and runs onto the three tables, with 409 as a taken slot', async () => {
    const db = fakeSupabase();
    const store = new SupabaseSessionStore('https://proj.supabase.co/', 'key', db.fetchFn);
    expect(await store.create(session)).toBe(true);
    expect(await store.create(session)).toBe(false);
    expect(await store.addPlayer('ABCD2345', guest)).toBe(true);
    expect(await store.addPlayer('ABCD2345', { ...guest, id: 'p-third' })).toBe(false);
    const run = { stageIndex: 0, playerId: 'p-guest', time: null, splits: [] };
    expect(await store.addResult('ABCD2345', run)).toBe(true);
    expect(await store.addResult('ABCD2345', run)).toBe(false);

    const read = await store.read('ABCD2345');
    expect(read).toEqual({ ...session, players: [host, guest], results: [run] });
    expect(db.tables.sessions![0]).toMatchObject({
      stage_types: ['alpine', 'circuit'],
      car_id: null,
    });
    expect(db.tables.session_players![0]).toMatchObject({
      token_hash: 'aa',
      seat: 0,
      car_id: 'hatchback',
    });
    // A seat without a car picks one once; a second pick updates no row.
    db.tables.session_players![1]!.car_id = null;
    expect(await store.setCar('ABCD2345', 'p-guest', 'dakar')).toBe(true);
    expect(await store.setCar('ABCD2345', 'p-guest', 'wrc')).toBe(false);
    expect((await store.read('ABCD2345'))?.players[1]!.carId).toBe('dakar');
    // A seat with no car_id reads back without one.
    db.tables.session_players![1]!.car_id = null;
    expect((await store.read('ABCD2345'))?.players[1]).toEqual({
      id: guest.id,
      name: guest.name,
      seat: guest.seat,
      tokenHash: guest.tokenHash,
    });
  });

  it('throws on server errors', async () => {
    const failing = new SupabaseSessionStore(
      'https://p',
      'k',
      async () => new Response('', { status: 500 }),
    );
    await expect(failing.read('ABCD2345')).rejects.toThrow('500');
    await expect(
      failing.addResult('ABCD2345', { stageIndex: 0, playerId: 'x', time: 1, splits: [] }),
    ).rejects.toThrow('500');
  });
});

describe('selectSessionStore', () => {
  it('uses Supabase when configured, files locally and nothing on bare Vercel', () => {
    expect(
      selectSessionStore({ SUPABASE_URL: 'https://p', SUPABASE_SERVICE_ROLE_KEY: 'k' }, '/app'),
    ).toBeInstanceOf(SupabaseSessionStore);
    expect(selectSessionStore({}, '/app')).toBeInstanceOf(FileSessionStore);
    expect(selectSessionStore({ VERCEL: '1' }, '/app')).toBeNull();
  });
});
