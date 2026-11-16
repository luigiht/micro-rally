import { describe, expect, it } from 'vitest';
import { pillarStrip } from '@/render/car/PillarStrip';
import { BERLINETTE_A_PILLAR, BERLINETTE_HULL } from '@/render/car/BerlinetteShape';
import { SATORY_A_PILLAR, SATORY_HULL } from '@/render/car/SatoryShape';

describe('pillar strip', () => {
  const rounding = SATORY_HULL.rounding ?? {};
  const pos = pillarStrip(SATORY_A_PILLAR, rounding, 0.045, 0.008);
  const first = SATORY_A_PILLAR[0]!;
  const last = SATORY_A_PILLAR.at(-1)!;

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
    expect(first.roof).toBeGreaterThan(1.3);
    expect(last.roof).toBeLessThan(0.9);
  });

  it("lies flush: every point within a few centimetres of its station's roof edge", () => {
    for (let i = 0; i < pos.length; i += 3) {
      const z = pos[i + 2]!;
      const s = SATORY_A_PILLAR.reduce((a, b) => (Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a));
      const d = Math.hypot(Math.abs(pos[i]!) - s.xRoof, pos[i + 1]! - s.roof);
      expect(d).toBeLessThan(0.05);
    }
  });

  it("lays the Berlinette's slim pillars flush along its grooved roof's edge", () => {
    const ber = pillarStrip(BERLINETTE_A_PILLAR, BERLINETTE_HULL.rounding ?? {}, 0.03, 0.006);
    expect(ber.length).toBeGreaterThan(0);
    for (let i = 0; i < ber.length; i += 3) {
      const z = ber[i + 2]!;
      const s = BERLINETTE_A_PILLAR.reduce((a, b) =>
        Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a,
      );
      expect(Math.hypot(Math.abs(ber[i]!) - s.xRoof, ber[i + 1]! - s.roof)).toBeLessThan(0.04);
    }
  });
});
