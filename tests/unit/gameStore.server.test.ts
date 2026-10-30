import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileGameStore, selectGameStore, SupabaseGameStore } from '@/app/api/games/gameStore';
import { SAVE_VERSION, type SaveFile } from '@/game/save/SaveFile';
import { resolveSiteUrl } from '@/lib/site';

const save: SaveFile = {
  version: SAVE_VERSION,
  gameId: 'ABCD2345',
  driverName: 'Ada',
  gameSeed: 1,
  money: 50,
  stageIndex: 0,
  records: {},
  carId: 'hatchback',
  ownedCars: ['hatchback'],
  upgrades: {},
  updatedAt: 1_700_000_000_000,
};

/** A tiny PostgREST stand-in: a `games` table with select-by-id and upsert. */
function fakeSupabase() {
  const calls: { url: string; init?: RequestInit }[] = [];
  const rows = new Map<string, { save: unknown; updated_at: string }>();
  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as {
        id: string;
        save: unknown;
        updated_at: string;
      };
      rows.set(body.id, { save: body.save, updated_at: body.updated_at });
      return new Response(null, { status: 201 });
    }
    const id = decodeURIComponent(/id=eq\.([^&]+)/.exec(url)![1]!);
    const row = rows.get(id);
    return Response.json(row ? [{ save: row.save }] : []);
  };
  return { fetchFn, calls, rows };
}

describe('SupabaseGameStore', () => {
  it('upserts and selects through the REST API with the service-role headers', async () => {
    const db = fakeSupabase();
    const store = new SupabaseGameStore('https://proj.supabase.co/', 'service-key', db.fetchFn);
    expect(await store.read('ABCD2345')).toBeNull();
    await store.write(save);
    expect(await store.read('ABCD2345')).toEqual(save);

    const post = db.calls.find((c) => c.init?.method === 'POST')!;
    expect(post.url).toBe('https://proj.supabase.co/rest/v1/games');
    const headers = post.init!.headers as Record<string, string>;
    expect(headers.apikey).toBe('service-key');
    expect(headers.authorization).toBe('Bearer service-key');
    expect(headers.prefer).toContain('merge-duplicates');
    expect(db.rows.get('ABCD2345')?.updated_at).toBe(new Date(save.updatedAt).toISOString());

    const get = db.calls.find((c) => !c.init?.method)!;
    expect(get.url).toBe(
      'https://proj.supabase.co/rest/v1/games?id=eq.ABCD2345&select=save&limit=1',
    );
  });

  it('throws on HTTP failures, ignores corrupt rows and refuses bad IDs', async () => {
    const failing = new SupabaseGameStore(
      'https://p',
      'k',
      async () => new Response('x', { status: 500 }),
    );
    await expect(failing.read('ABCD2345')).rejects.toThrow('500');
    await expect(failing.write(save)).rejects.toThrow('500');
    const corrupt = new SupabaseGameStore('https://p', 'k', async () =>
      Response.json([{ save: { nope: 1 } }]),
    );
    expect(await corrupt.read('ABCD2345')).toBeNull();
    await expect(corrupt.read('../x')).rejects.toThrow('invalid game id');
  });
});

describe('FileGameStore', () => {
  let dir: string;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('writes and reads JSON files, and rejects bad IDs before touching the disk', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'micro-rally-'));
    const store = new FileGameStore(path.join(dir, 'games'));
    expect(await store.read('ABCD2345')).toBeNull();
    await store.write(save);
    expect(await store.read('ABCD2345')).toEqual(save);
    await expect(store.read('../etc/passwd')).rejects.toThrow('invalid game id');
  });
});

describe('selectGameStore', () => {
  const noFetch: typeof fetch = async () => Response.json([]);

  it('prefers Supabase credentials, falls back to files, and refuses silently broken Vercel setups', () => {
    expect(
      selectGameStore(
        { SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' },
        '/x',
        noFetch,
      ),
    ).toBeInstanceOf(SupabaseGameStore);
    expect(
      selectGameStore(
        { NEXT_PUBLIC_SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' },
        '/x',
        noFetch,
      ),
    ).toBeInstanceOf(SupabaseGameStore);
    expect(selectGameStore({}, '/x')).toBeInstanceOf(FileGameStore);
    expect(selectGameStore({ VERCEL: '1' }, '/x')).toBeNull();
    // The public URL alone (no service key) must not pretend to be a store.
    expect(
      selectGameStore({ VERCEL: '1', NEXT_PUBLIC_SUPABASE_URL: 'https://p.supabase.co' }, '/x'),
    ).toBeNull();
  });
});

describe('resolveSiteUrl', () => {
  it('uses the explicit origin, then Vercel system variables, then localhost', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://rally.example/' })).toBe(
      'https://rally.example',
    );
    expect(
      resolveSiteUrl({
        VERCEL_PROJECT_PRODUCTION_URL: 'rally.vercel.app',
        VERCEL_URL: 'preview.vercel.app',
      }),
    ).toBe('https://rally.vercel.app');
    expect(resolveSiteUrl({ VERCEL_URL: 'preview.vercel.app' })).toBe('https://preview.vercel.app');
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });
});
