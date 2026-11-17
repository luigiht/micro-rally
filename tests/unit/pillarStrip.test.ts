import { describe, expect, it } from 'vitest';
import { pillarStrip } from '@/render/car/PillarStrip';
import { BERLINETTE_A_PILLAR, BERLINETTE_HULL } from '@/render/car/BerlinetteShape';

describe('pillar strip', () => {
  const rounding = BERLINETTE_HULL.rounding ?? {};
  const pos = pillarStrip(BERLINETTE_A_PILLAR, rounding, 0.03, 0.006);
  const first = BERLINETTE_A_PILLAR[0]!;
  const last = BERLINETTE_A_PILLAR.at(-1)!;

  it('runs from the roof front edge to the cowl on both sides', () => {
    let z0 = Infinity;
    let z1 = -Infinity;
    let left = 0;
    let right = 0;
    for (let i = 0; i < pos.length; i += 3) {
      z0 = Math.min(z0, pos[i + 2]!);
      z1 = Math.max(z1, pos[i + 2]!);
      if (pos[i]! > 0) right++;
      else left++;
    }
    expect(z0).toBeCloseTo(first.z, 6);
    expect(z1).toBeCloseTo(last.z, 6);
    expect(left).toBe(right);
    // The top end meets the roof's front edge, the bottom end the bonnet's edge at the cowl.
    expect(first.roof).toBeGreaterThan(last.roof + 0.25);
  });

  it("lies flush: every point within a few centimetres of its station's roof edge", () => {
    for (let i = 0; i < pos.length; i += 3) {
      const z = pos[i + 2]!;
      const s = BERLINETTE_A_PILLAR.reduce((a, b) =>
        Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a,
      );
      const d = Math.hypot(Math.abs(pos[i]!) - s.xRoof, pos[i + 1]! - s.roof);
      expect(d).toBeLessThan(0.05);
    }
  });
});
