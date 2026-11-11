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
const { stageBrief } = await import('@/game/stage/StageGenerator');

const post = (body: unknown) =>
  new Request('http://test/api', { method: 'POST', body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

interface Seated {
  session: { id: string; seed: number; players: { id: string }[]; results: unknown[] };
  playerId: string;
  token: string;
}

describe('session routes', () => {
  it('runs a session: create, join, a full third seat, then gated, token-checked results', async () => {
    const created = await create(post({ name: '  Ada ', stageCount: 3, carId: 'wrc' }));
    expect(created.status).toBe(201);
    const host = (await created.json()) as Seated;
    const id = host.session.id;
    expect(host.session.players).toEqual([{ id: host.playerId, name: 'Ada', seat: 0 }]);
    expect(JSON.stringify(host.session)).not.toContain('token');

    const joined = await join(post({ name: 'Bo' }), ctx(id));
    expect(joined.status).toBe(201);
    const guest = (await joined.json()) as Seated;
    expect(guest.session.players).toHaveLength(2);
    expect((await join(post({ name: 'Cy' }), ctx(id))).status).toBe(409);

    const par = stageBrief(host.session.seed, 0).parTime;
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

  it('refuses bad input and unknown sessions', async () => {
    expect((await create(post({ name: '', stageCount: 3, carId: 'wrc' }))).status).toBe(400);
    expect((await create(post({ name: 'A', stageCount: 4, carId: 'wrc' }))).status).toBe(400);
    expect((await create(post({ name: 'A', stageCount: 3, carId: 'tank' }))).status).toBe(400);
    expect((await get(new Request('http://test'), ctx('ZZZZ9999'))).status).toBe(404);
    expect((await get(new Request('http://test'), ctx('bad'))).status).toBe(400);
    expect((await join(post({ name: 'Bo' }), ctx('ZZZZ9999'))).status).toBe(404);
  });
});
