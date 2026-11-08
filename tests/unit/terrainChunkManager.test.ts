import { afterEach, describe, expect, it } from 'vitest';
import { REGIONS } from '@/game/stage/regions';
import { createStageWorld } from '@/game/stage/StageWorld';
import { TerrainChunkManager } from '@/render/terrain/TerrainChunkManager';
import { terrainColors } from '@/render/terrain/meshTerrainChunk';

/** Stands in for the terrain worker: records what it is sent, replies only when told. */
class FakeWorker {
  static last: FakeWorker | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly posted: { type: string }[] = [];
  terminated = false;
  constructor() {
    FakeWorker.last = this;
  }
  postMessage(msg: { type: string }) {
    this.posted.push(msg);
  }
  terminate() {
    this.terminated = true;
  }
}

const realWorker = globalThis.Worker;
afterEach(() => {
  globalThis.Worker = realWorker;
  FakeWorker.last = null;
});

function manager() {
  const world = createStageWorld(1, 0);
  const region = REGIONS[world.stage.region];
  const m = new TerrainChunkManager(
    1,
    0,
    world.field,
    terrainColors(region.palette, region.coast),
    region.terrain.amplitude,
    { size: 64, resolution: 8, radius: 200 },
  );
  return { m, spawn: world.stage.spawn };
}

/** Frames until the ground stops growing. */
function settle(m: TerrainChunkManager, x: number, z: number): number {
  let last = -1;
  for (let i = 0; i < 200 && m.loadedCount !== last; i++) {
    last = m.loadedCount;
    for (let k = 0; k < 5; k++) m.update(x, z);
  }
  return m.loadedCount;
}

describe('TerrainChunkManager', () => {
  it('meshes every chunk on the main thread when there is no worker', () => {
    globalThis.Worker = undefined as unknown as typeof Worker;
    const { m, spawn } = manager();
    m.update(spawn.x, spawn.z);
    expect(m.loadedCount).toBeGreaterThan(0);
    expect(settle(m, spawn.x, spawn.z)).toBeGreaterThan(20);
    m.dispose();
  });

  it('lays the nearest ground itself until the worker is ready, then hands the rest over', () => {
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    const { m, spawn } = manager();
    const w = FakeWorker.last!;
    m.update(spawn.x, spawn.z);
    // The worker is still starting: only the init went out, and ground is already there.
    expect(w.posted.map((p) => p.type)).toEqual(['init']);
    expect(m.loadedCount).toBeGreaterThan(0);
    w.onmessage!({ data: { type: 'ready' } });
    // Driving on, the chunks it now needs go to the worker; the main thread adds none.
    const before = m.loadedCount;
    for (let i = 0; i < 20; i++) m.update(spawn.x + 400, spawn.z + 400);
    expect(w.posted.filter((p) => p.type === 'chunk').length).toBeGreaterThan(0);
    expect(m.loadedCount).toBeLessThanOrEqual(before);
    m.dispose();
    expect(w.terminated).toBe(true);
  });

  it('falls back to the main thread for good when the worker fails', () => {
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    const { m, spawn } = manager();
    const w = FakeWorker.last!;
    w.onmessage!({ data: { type: 'ready' } });
    m.update(spawn.x, spawn.z);
    // Everything went to the worker, which then dies without replying.
    expect(m.loadedCount).toBe(0);
    w.onerror!();
    expect(w.terminated).toBe(true);
    expect(settle(m, spawn.x, spawn.z)).toBeGreaterThan(20);
    m.dispose();
  });
});
