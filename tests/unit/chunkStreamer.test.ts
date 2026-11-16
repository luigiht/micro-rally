import { describe, expect, it } from 'vitest';
import { chunkCoords, ChunkStreamer } from '@/render/ChunkStreamer';

describe('ChunkStreamer', () => {
  const size = 96;
  const radius = 284;
  /** Distance from (x, z) to the nearest point of a chunk's square. */
  const edge = (cx: number, cz: number, x: number, z: number) =>
    Math.hypot(
      Math.max(cx * size - x, 0, x - (cx + 1) * size),
      Math.max(cz * size - z, 0, z - (cz + 1) * size),
    );

  it('loads a chunk only once its nearest edge is within reach, never much closer', () => {
    const loads: { key: number; d: number }[] = [];
    let at = { x: 0, z: 0 };
    const s = new ChunkStreamer(
      size,
      radius,
      (cx, cz, key) => loads.push({ key, d: edge(cx, cz, at.x, at.z) }),
      () => {},
    );
    // Drive a long diagonal at a steady step: after the first look, nothing new arrives
    // closer than the radius less the distance moved between looks.
    for (let k = 0; k < 400; k++) {
      at = { x: k * 3.1, z: k * 1.7 };
      const first = loads.length;
      s.update(at.x, at.z);
      if (k === 0) continue;
      for (const l of loads.slice(first)) expect(l.d).toBeGreaterThan(radius - size * 0.25 - 4);
    }
    // Everything within reach of where the drive ended is loaded.
    for (let cx = -10; cx <= 20; cx++)
      for (let cz = -10; cz <= 15; cz++)
        if (edge(cx, cz, at.x, at.z) <= radius - size * 0.25 - 4)
          expect(s.loaded.has((cx + 0x8000) * 0x10000 + (cz + 0x8000))).toBe(true);
  });

  it('drops a chunk once it lies well out of reach, and only then', () => {
    const dropped: number[] = [];
    const s = new ChunkStreamer(
      size,
      radius,
      () => {},
      (key) => dropped.push(key),
    );
    s.update(0, 0);
    s.update(2000, 0);
    for (const key of dropped) {
      const [cx, cz] = chunkCoords(key);
      expect(edge(cx, cz, 2000, 0)).toBeGreaterThan(radius + size * 0.5);
    }
    for (const key of s.loaded) {
      const [cx, cz] = chunkCoords(key);
      expect(edge(cx, cz, 2000, 0)).toBeLessThanOrEqual(radius + size * 0.5);
    }
    expect(dropped.length).toBeGreaterThan(0);
  });
});
