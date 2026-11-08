import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ShadowSnap } from '@/render/effects/ShadowSnap';

const OFFSET = [8, 14, 6] as const;
const TEXEL = 60 / 2048;

describe('ShadowSnap', () => {
  it('moves the target only by whole texels across the shadow camera, never more than half of one', () => {
    const snap = new ShadowSnap(OFFSET, TEXEL);
    const axes = new Matrix4().lookAt(new Vector3(...OFFSET), new Vector3(), new Vector3(0, 1, 0));
    const ax = new Vector3().setFromMatrixColumn(axes, 0);
    const ay = new Vector3().setFromMatrixColumn(axes, 1);
    for (const [x, y, z] of [
      [0.013, 0, 0.4],
      [1234.567, 12.3, -987.654],
      [-55.5, -3.2, 2001.01],
    ] as const) {
      const p = new Vector3(x, y, z);
      const q = snap.snap(p.clone());
      expect(q.distanceTo(p)).toBeLessThanOrEqual(TEXEL * Math.SQRT1_2 + 1e-9);
      for (const a of [ax, ay]) {
        const t = q.dot(a) / TEXEL;
        expect(Math.abs(t - Math.round(t))).toBeLessThan(1e-6);
      }
      // Sliding the car a fraction of a texel from a snapped spot leaves the light where it was.
      expect(snap.snap(q.clone().addScaledVector(ax, TEXEL * 0.3)).distanceTo(q)).toBeLessThan(
        1e-6,
      );
      expect(snap.snap(q.clone().addScaledVector(ay, -TEXEL * 0.3)).distanceTo(q)).toBeLessThan(
        1e-6,
      );
    }
  });
});
