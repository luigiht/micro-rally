import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// The routes pick their store once, from the environment, on first use.
const dir = mkdtempSync(path.join(os.tmpdir(), 'mr-session-routes-'));
process.env.MICRO_RALLY_SESSION_DIR = dir;
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const { POST: create } = await import('@/app/api/sessions/route');
const { GET: get } = await import('@/app/api/sessions/[id]/route');
const { POST: join } = await import('@/app/api/sessions/[id]/join/route');
const { POST: submit } = await import('@/app/api/sessions/[id]/results/route');
const { POST: chooseCar } = await import('@/app/api/sessions/[id]/car/route');
const { sessionBrief, SESSION_STAGE_TYPES } = await import('@/game/multiplayer/Session');

const post = (body: unknown) =>
  new Request('http://test/api', { method: 'POST', body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

interface Seated {
  session: {
    id: string;
    seed: number;
    stageTypes?: string[];
    players: { id: string; carId: string | null }[];
    results: unknown[];
  };
  playerId: string;
  token: string;
}

describe('session routes', () => {
  it('runs a session: create, join, cars picked once, then gated, token-checked results', async () => {
    const created = await create(
      post({ name: '  Ada ', stageCount: 3, stageTypes: ['desert', 'alpine'] }),
    );
    expect(created.status).toBe(201);
    const host = (await created.json()) as Seated;
    const id = host.session.id;
    expect(host.session.players).toEqual([
      { id: host.playerId, name: 'Ada', seat: 0, carId: null },
    ]);
    // Stored in the picker's order, whatever order they were ticked in.
    expect(host.session.stageTypes).toEqual(['alpine', 'desert']);
    expect(JSON.stringify(host.session)).not.toContain('token');

    const joined = await join(post({ name: 'Bo' }), ctx(id));
    expect(joined.status).toBe(201);
    const guest = (await joined.json()) as Seated;
    expect(guest.session.players.map((p) => p.carId)).toEqual([null, null]);
    expect((await join(post({ name: 'Cy' }), ctx(id))).status).toBe(409);

    const pick = (seat: Seated, carId: string, token = seat.token) =>
      chooseCar(post({ playerId: seat.playerId, token, carId }), ctx(id));
    const par = sessionBrief(
      { seed: host.session.seed, stageTypes: ['alpine', 'desert'] },
      0,
    ).parTime;
    const run = (seat: Seated, extra: object = {}) =>
      submit(
        post({
          playerId: seat.playerId,
          token: seat.token,
          stageIndex: 0,
          time: par,
          splits: [par / 2],
          ...extra,
        }),
        ctx(id),
      );

    // No run counts before the driver has picked a car.
    expect((await run(host)).status).toBe(409);
    expect((await pick(host, 'tank')).status).toBe(400);
    expect((await pick(host, 'wrc', guest.token)).status).toBe(403);
    const picked = await pick(host, 'wrc');
    expect(picked.status).toBe(200);
    expect(((await picked.json()) as Seated).session.players[0]!.carId).toBe('wrc');
    // Fixed for the session.
    expect((await pick(host, 'buggy')).status).toBe(409);
    expect((await pick(guest, 'buggy')).status).toBe(200);

    expect((await run(host, { token: guest.token })).status).toBe(403);
    expect((await run(host, { time: 1 })).status).toBe(400);
    expect((await run(host)).status).toBe(200);
    expect((await run(host)).status).toBe(409);
    // Stage 2 waits for the guest's stage 1.
    expect((await run(host, { stageIndex: 1 })).status).toBe(409);
    const last = await run(guest, { time: null, splits: [] });
    expect(last.status).toBe(200);
    expect(((await last.json()) as Seated).session.results).toHaveLength(2);

    const fetched = await get(new Request('http://test'), ctx(id.toLowerCase()));
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get('cache-control')).toBe('no-store');
  });

  it('ticks every stage type when the host sends none', async () => {
    const created = await create(post({ name: 'Ada', stageCount: 6 }));
    const host = (await created.json()) as Seated;
    expect(host.session.stageTypes).toEqual([...SESSION_STAGE_TYPES]);
  });

  it('refuses bad input and unknown sessions', async () => {
    expect((await create(post({ name: '', stageCount: 3 }))).status).toBe(400);
    expect((await create(post({ name: 'A', stageCount: 4 }))).status).toBe(400);
    expect((await create(post({ name: 'A', stageCount: 3, stageTypes: [] }))).status).toBe(400);
    expect((await create(post({ name: 'A', stageCount: 3, stageTypes: ['moon'] }))).status).toBe(
      400,
    );
    expect((await get(new Request('http://test'), ctx('ZZZZ9999'))).status).toBe(404);
    expect((await get(new Request('http://test'), ctx('bad'))).status).toBe(400);
    expect((await join(post({ name: 'Bo' }), ctx('ZZZZ9999'))).status).toBe(404);
  });
});
