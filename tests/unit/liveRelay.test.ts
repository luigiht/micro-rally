import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_FIELDS, LIVE_STALE_MS } from '@/game/multiplayer/LiveTrack';
import { createVehiclePose } from '@/game/vehicle/interpolatePose';
import { LiveRelay, type LivePresence } from '@/lib/multiplayer/LiveRelay';

const seat = { playerId: 'p1', token: 't1' };

/** The other driver's window: one sample at progress 0.4. */
function otherWindow(stageIndex: number) {
  const samples = new Array<number>(LIVE_FIELDS).fill(0);
  samples[LIVE_FIELDS - 1] = 0.4;
  return { stageIndex, run: 'theirs', samples };
}

function setup(answer: () => Response | Promise<Response>) {
  const bodies: Record<string, unknown>[] = [];
  const urls: string[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    urls.push(String(input));
    bodies.push(JSON.parse(String(init!.body)) as Record<string, unknown>);
    return answer();
  };
  const presence: LivePresence[] = [];
  const relay = new LiveRelay(
    (p) => presence.push(p),
    fetchFn,
    '/api/sessions',
    () => Date.now(),
  );
  return { relay, bodies, urls, presence };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('LiveRelay', () => {
  it('sends this car’s window with the seat and shows the other driver on the same stage', async () => {
    const { relay, bodies, urls, presence } = setup(() => Response.json({ other: otherWindow(2) }));
    relay.start('ABCD2345', seat, 2);
    relay.record(0, createVehiclePose(), 0, () => 0.1);
    await vi.advanceTimersByTimeAsync(0);
    expect(urls[0]).toBe('/api/sessions/ABCD2345/live');
    expect(bodies[0]).toMatchObject({ playerId: 'p1', token: 't1', stageIndex: 2 });
    expect((bodies[0]!.samples as number[]).length).toBe(LIVE_FIELDS);
    expect(relay.present).toBe(true);
    expect(presence.at(-1)).toEqual({ present: true, progress: 0.4 });
    expect(relay.ghost.empty).toBe(false);

    // While they're on the stage the exchanges come four times a second.
    await vi.advanceTimersByTimeAsync(1000);
    expect(bodies.length).toBeGreaterThanOrEqual(4);
    relay.stop();
    expect(relay.present).toBe(false);
    expect(relay.ghost.empty).toBe(true);
    const sent = bodies.length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(bodies.length).toBe(sent);
  });

  it('ignores the other driver while they are on another stage, and polls slowly', async () => {
    const { relay, bodies } = setup(() => Response.json({ other: otherWindow(1) }));
    relay.start('ABCD2345', seat, 2);
    await vi.advanceTimersByTimeAsync(0);
    expect(relay.present).toBe(false);
    expect(relay.ghost.empty).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(bodies.length).toBe(2);
    relay.stop();
  });

  it('keeps the other car through a short outage and drops it after a long one', async () => {
    let up = true;
    const { relay } = setup(() => {
      if (!up) throw new TypeError('offline');
      return Response.json({ other: otherWindow(0) });
    });
    relay.start('ABCD2345', seat, 0);
    await vi.advanceTimersByTimeAsync(0);
    expect(relay.present).toBe(true);
    up = false;
    await vi.advanceTimersByTimeAsync(2500);
    expect(relay.present).toBe(true);
    await vi.advanceTimersByTimeAsync(LIVE_STALE_MS + 2000);
    expect(relay.present).toBe(false);
    relay.stop();
  });

  it('records nothing until started', () => {
    const { relay } = setup(() => Response.json({ other: null }));
    relay.record(0, createVehiclePose(), 0, () => 0);
    expect(relay.outbox.window()).toEqual([]);
  });
});

describe('getLiveRelay', () => {
  it('fetches the session again when a driver it doesn’t know yet shows up live', async () => {
    const { getLiveRelay, useOpponentStore } = await import('@/state/opponentStore');
    const { opponentOf, useSessionStore } = await import('@/state/sessionStore');
    const ada = { id: 'p1', name: 'Ada', seat: 0, carId: 'wrc' as const };
    const bo = { id: 'p2', name: 'Bo', seat: 1, carId: 'buggy' as const };
    const view = { id: 'ABCD2345', seed: 1, stageCount: 3 as const, createdAt: 1, results: [] };
    // Ada started the stage before her lobby saw Bo join.
    useSessionStore.setState({ session: { ...view, players: [ada] }, seat, screen: 'drive' });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
      String(input).endsWith('/live')
        ? Response.json({ other: otherWindow(0) })
        : Response.json({ session: { ...view, players: [ada, bo] } }),
    );
    try {
      const relay = getLiveRelay();
      relay.start('ABCD2345', seat, 0);
      await vi.advanceTimersByTimeAsync(0);
      expect(useOpponentStore.getState().present).toBe(true);
      expect(opponentOf(useSessionStore.getState())?.carId).toBe('buggy');
      relay.stop();
      expect(useOpponentStore.getState().present).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
