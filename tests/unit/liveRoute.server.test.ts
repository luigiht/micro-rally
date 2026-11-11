import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LIVE_FIELDS } from '@/game/multiplayer/LiveTrack';

// The routes pick their stores once, from the environment, on first use.
const dir = mkdtempSync(path.join(os.tmpdir(), 'mr-live-route-'));
process.env.MICRO_RALLY_SESSION_DIR = dir;
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const { POST: create } = await import('@/app/api/sessions/route');
const { POST: join } = await import('@/app/api/sessions/[id]/join/route');
const { POST: live } = await import('@/app/api/sessions/[id]/live/route');

const post = (body: unknown) =>
  new Request('http://test/api', { method: 'POST', body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const samples = new Array<number>(LIVE_FIELDS).fill(0);

interface Seated {
  session: { id: string };
  playerId: string;
  token: string;
}

describe('live route', () => {
  it('swaps the two drivers’ windows, checking each seat’s token', async () => {
    const host = (await (
      await create(post({ name: 'Ada', stageCount: 3, carId: 'wrc' }))
    ).json()) as Seated;
    const id = host.session.id;
    const guest = (await (
      await join(post({ name: 'Bo', carId: 'buggy' }), ctx(id))
    ).json()) as Seated;
    const send = (seat: Seated, extra: object = {}) =>
      live(
        post({
          playerId: seat.playerId,
          token: seat.token,
          stageIndex: 0,
          run: seat.playerId.slice(0, 8),
          samples,
          ...extra,
        }),
        ctx(id),
      );

    const first = await send(host);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ other: null });
    const second = await send(guest);
    expect(await second.json()).toEqual({
      other: { stageIndex: 0, run: host.playerId.slice(0, 8), samples },
    });

    expect((await send(host, { token: guest.token })).status).toBe(403);
    expect((await send(host, { playerId: 'nobody' })).status).toBe(403);
    expect((await send(host, { samples: [1, 2] })).status).toBe(400);
    expect((await live(post({}), ctx('bad'))).status).toBe(400);
  });
});
