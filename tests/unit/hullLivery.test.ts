import { describe, expect, it } from 'vitest';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { buildCarHull, wellsFor, type HullSpec } from '@/render/car/CarHull';
import { paintLivery, type LiveryShapes } from '@/render/car/HullLivery';
import { WRC_STATIONS } from '@/render/car/HullShapes';
import { BERLINETTE_LIVERY } from '@/render/car/BerlinetteLivery';
import { BERLINETTE_HULL } from '@/render/car/BerlinetteShape';
import { RIVIERA_LIVERY } from '@/render/car/RivieraLivery';
import { SATORY_LIVERY } from '@/render/car/SatoryLivery';
import { SATORY_HULL } from '@/render/car/SatoryShape';

const SPEC: HullSpec = {
  wells: wellsFor(CAR_SPECS.wrc),
  colors: { body: '#f4f1ea', trim: '#2b2a33', glass: '#3f5b73' },
  stations: WRC_STATIONS,
};
const RED = '#ff0000';
/** One red square on the left flank (z −0.2..0.2, y 0.6..0.8), nothing else. */
const SQUARE: LiveryShapes = {
  left: {
    u: [2, -2.15, 2.15],
    v: [1, 0.2, 1.6],
    paint: [{ color: RED, tris: [-0.2, 0.6, 0.2, 0.6, 0.2, 0.8, -0.2, 0.6, 0.2, 0.8, -0.2, 0.8] }],
  },
  right: { u: [2, -2.15, 2.15], v: [1, 0.2, 1.6], paint: [] },
  top: { u: [2, -2.15, 2.15], v: [0, -1, 1], paint: [] },
};

describe('hull livery', () => {
  const plain = buildCarHull(SPEC);

  it('keeps the hull and appends the livery before the glowing faces', () => {
    const painted = paintLivery(plain, SQUARE, [SPEC.colors.body]);
    const n = plain.glowStart * 3;
    expect(Array.from(painted.positions.subarray(0, n))).toEqual(
      Array.from(plain.positions.subarray(0, n)),
    );
    const glow = plain.positions.length - n;
    expect(Array.from(painted.positions.subarray(painted.positions.length - glow))).toEqual(
      Array.from(plain.positions.subarray(n)),
    );
    expect(painted.glowStart).toBeGreaterThan(plain.glowStart);
    expect(painted.liveryStart).toBe(plain.glowStart);
  });

  it('lays a shape exactly over its outline, on the left flank only, just proud of it', () => {
    const painted = paintLivery(plain, SQUARE, [SPEC.colors.body]);
    const p = painted.positions;
    let area = 0;
    for (let t = plain.glowStart; t < painted.glowStart; t += 3) {
      const q = [0, 1, 2].map((k) => [p[(t + k) * 3]!, p[(t + k) * 3 + 1]!, p[(t + k) * 3 + 2]!]);
      for (const [x, y, z] of q) {
        expect(x).toBeGreaterThan(0.8);
        expect(y).toBeGreaterThanOrEqual(0.6 - 6e-3);
        expect(y).toBeLessThanOrEqual(0.8 + 6e-3);
        expect(z).toBeGreaterThanOrEqual(-0.2 - 6e-3);
        expect(z).toBeLessThanOrEqual(0.2 + 6e-3);
      }
      // Its area seen from the side.
      area +=
        Math.abs(
          (q[1]![2]! - q[0]![2]!) * (q[2]![1]! - q[0]![1]!) -
            (q[2]![2]! - q[0]![2]!) * (q[1]![1]! - q[0]![1]!),
        ) / 2;
      // Facing out, like the flank.
      const u = [1, 2].map((k) => q[k]!.map((v, j) => v - q[0]![j]!));
      const nx = u[0]![1]! * u[1]![2]! - u[0]![2]! * u[1]![1]!;
      expect(nx).toBeGreaterThan(0);
    }
    // The whole square: 0.4 × 0.2.
    expect(area).toBeCloseTo(0.08, 3);
  });

  it('paints the Riviera on both flanks and the bonnet, never on glass or in the arches', () => {
    const painted = paintLivery(plain, RIVIERA_LIVERY, [SPEC.colors.body]);
    const p = painted.positions;
    let left = 0;
    let right = 0;
    let top = 0;
    for (let i = plain.glowStart; i < painted.glowStart; i++) {
      const [x, y, z] = [p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!];
      if (y > 0.97 && Math.abs(x) < 0.85) top++;
      else if (x > 0) left++;
      else right++;
      for (const az of SPEC.wells!.zs)
        expect(Math.hypot(z - az, y - SPEC.wells!.axleY)).toBeGreaterThan(SPEC.wells!.radius);
    }
    expect(left).toBeGreaterThan(100);
    expect(right).toBeGreaterThan(100);
    expect(top).toBeGreaterThan(100);
  });

  /** Every livery face painted onto the test hull: its centre, its linear red channel and its area seen from the side. */
  const pieces = (livery: LiveryShapes, hull: HullSpec = SPEC) => {
    const base = buildCarHull(hull);
    const painted = paintLivery(base, livery, [hull.colors.body]);
    const out: { z: number; x: number; r: number; area: number }[] = [];
    const p = painted.positions;
    for (let t = base.glowStart; t < painted.glowStart; t += 3) {
      const q = [0, 1, 2].map((k) => [p[(t + k) * 3]!, p[(t + k) * 3 + 1]!, p[(t + k) * 3 + 2]!]);
      const area =
        Math.abs(
          (q[1]![2]! - q[0]![2]!) * (q[2]![1]! - q[0]![1]!) -
            (q[2]![2]! - q[0]![2]!) * (q[1]![1]! - q[0]![1]!),
        ) / 2;
      out.push({
        z: (q[0]![2]! + q[1]![2]! + q[2]![2]!) / 3,
        x: (q[0]![0]! + q[1]![0]! + q[2]![0]!) / 3,
        r: painted.colors[t * 3]!,
        area,
      });
    }
    return out;
  };

  it("paints the Satory's tail panel across and leaves the Berlinette's doors plain blue", () => {
    // The Satory's blue (linear red channel ≈ 0.013) covers the tail panel from side to side.
    const tail = pieces(SATORY_LIVERY, SATORY_HULL).filter((f) => f.z < -1.98 && f.r < 0.05);
    expect(tail.some((f) => f.x > 0.5)).toBe(true);
    expect(tail.some((f) => f.x < -0.5)).toBe(true);
    // The Berlinette's doors carry only their details (gaps, handles): no pale roundel.
    const doors = pieces(BERLINETTE_LIVERY, BERLINETTE_HULL).filter(
      (f) => f.z > -0.2 && f.z < 0.75 && Math.abs(f.x) > 0.6,
    );
    expect(doors.length).toBeGreaterThan(0);
    expect(doors.filter((f) => f.r > 0.8)).toHaveLength(0);
  });
});
