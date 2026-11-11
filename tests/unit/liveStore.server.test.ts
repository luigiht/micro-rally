import { describe, expect, it } from 'vitest';
import { MemoryLiveStore, selectLiveStore, SupabaseLiveStore } from '@/app/api/sessions/liveStore';
import { LIVE_FIELDS, LIVE_STALE_MS } from '@/game/multiplayer/LiveTrack';

const record = (stageIndex: number, run = 'r') => ({
  stageIndex,
  run,
  samples: new Array<number>(LIVE_FIELDS).fill(0),
});

describe('MemoryLiveStore', () => {
  it('answers the other driver’s fresh record, never the sender’s own', async () => {
    let now = 1_000;
    const store = new MemoryLiveStore(() => now);
    expect(await store.exchange('S1', 'ada', record(0, 'a'))).toBeNull();
    expect(await store.exchange('S1', 'bo', record(0, 'b'))).toEqual(record(0, 'a'));
    expect(await store.exchange('S1', 'ada', record(0, 'a2'))).toEqual(record(0, 'b'));
    // Another session is separate.
    expect(await store.exchange('S2', 'cy', record(0))).toBeNull();
    // Bo goes quiet: after the stale window Ada hears nothing.
    now += LIVE_STALE_MS + 1;
    expect(await store.exchange('S1', 'ada', record(0, 'a3'))).toBeNull();
  });
});

describe('SupabaseLiveStore', () => {
  it('stores and swaps in one RPC call', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const store = new SupabaseLiveStore('https://proj.supabase.co/', 'key', async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init!.body)) });
      return Response.json([
        { player_id: 'bo', stage_index: 1, run: 'b', samples: record(1).samples },
      ]);
    });
    expect(await store.exchange('S1', 'ada', record(1, 'a'))).toEqual(record(1, 'b'));
    expect(calls[0]!.url).toBe('https://proj.supabase.co/rest/v1/rpc/session_live_exchange');
    expect(calls[0]!.body).toMatchObject({
      p_session: 'S1',
      p_player: 'ada',
      p_stage: 1,
      p_run: 'a',
    });
  });

  it('answers null when the other driver is quiet, and throws on server errors', async () => {
    const quiet = new SupabaseLiveStore('https://p', 'k', async () => Response.json([]));
    expect(await quiet.exchange('S1', 'ada', record(0))).toBeNull();
    const failing = new SupabaseLiveStore(
      'https://p',
      'k',
      async () => new Response('', { status: 500 }),
    );
    await expect(failing.exchange('S1', 'ada', record(0))).rejects.toThrow('500');
  });
});

describe('selectLiveStore', () => {
  it('uses Supabase when configured, memory locally and nothing on bare Vercel', () => {
    expect(
      selectLiveStore({ SUPABASE_URL: 'https://p', SUPABASE_SERVICE_ROLE_KEY: 'k' }),
    ).toBeInstanceOf(SupabaseLiveStore);
    expect(selectLiveStore({})).toBeInstanceOf(MemoryLiveStore);
    expect(selectLiveStore({ VERCEL: '1' })).toBeNull();
  });
});
