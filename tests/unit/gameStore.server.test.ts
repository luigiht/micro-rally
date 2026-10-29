import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileGameStore, RedisGameStore, selectGameStore } from '@/app/api/games/gameStore';
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
  updatedAt: 10,
};

function fakeRedis() {
  const calls: { url: string; init?: RequestInit }[] = [];
  const data = new Map<string, string>();
  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    const m = /\/(get|set)\/([^/?]+)$/.exec(url)!;
    const key = decodeURIComponent(m[2]!);
    if (m[1] === 'set') {
      data.set(key, String(init?.body));
      return Response.json({ result: 'OK' });
    }
    return Response.json({ result: data.get(key) ?? null });
  };
  return { fetchFn, calls, data };
}

describe('RedisGameStore', () => {
  it('round-trips a save through the REST API with a namespaced key and bearer token', async () => {
    const redis = fakeRedis();
    const store = new RedisGameStore('https://kv.example.com', 'secret', redis.fetchFn);
    expect(await store.read('ABCD2345')).toBeNull();
    await store.write(save);
    expect(await store.read('ABCD2345')).toEqual(save);
    expect(redis.data.has('micro-rally:game:ABCD2345')).toBe(true);
    const put = redis.calls.find((c) => c.init?.method === 'POST')!;
    expect(put.url).toBe('https://kv.example.com/set/micro-rally%3Agame%3AABCD2345');
    expect((put.init!.headers as Record<string, string>).authorization).toBe('Bearer secret');
  });

  it('throws on HTTP failures and ignores corrupt values', async () => {
    const failing = new RedisGameStore(
      'https://kv',
      't',
      async () => new Response('x', { status: 500 }),
    );
    await expect(failing.read('ABCD2345')).rejects.toThrow('500');
    await expect(failing.write(save)).rejects.toThrow('500');
    const corrupt = new RedisGameStore('https://kv', 't', async () =>
      Response.json({ result: '{nope' }),
    );
    expect(await corrupt.read('ABCD2345')).toBeNull();
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
  const noFetch: typeof fetch = async () => Response.json({ result: null });

  it('prefers Redis credentials, falls back to files, and refuses silently broken Vercel setups', () => {
    expect(
      selectGameStore({ KV_REST_API_URL: 'https://a/', KV_REST_API_TOKEN: 't' }, '/x', noFetch),
    ).toBeInstanceOf(RedisGameStore);
    expect(
      selectGameStore(
        { UPSTASH_REDIS_REST_URL: 'https://b', UPSTASH_REDIS_REST_TOKEN: 't' },
        '/x',
        noFetch,
      ),
    ).toBeInstanceOf(RedisGameStore);
    expect(selectGameStore({}, '/x')).toBeInstanceOf(FileGameStore);
    expect(selectGameStore({ VERCEL: '1' }, '/x')).toBeNull();
    expect(selectGameStore({ VERCEL: '1', KV_REST_API_URL: 'https://a' }, '/x')).toBeNull();
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
