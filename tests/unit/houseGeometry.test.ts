import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import {
  gableGeometry,
  houseRoofGeometry,
  houseWallsGeometry,
} from '@/render/scenery/HouseGeometry';

describe('HouseGeometry', () => {
  it('builds both instanced parts with positions, normals and vertex colours', () => {
    for (const geo of [houseWallsGeometry(), houseRoofGeometry()]) {
      expect(geo.index).toBeNull();
      const pos = geo.getAttribute('position');
      expect(pos.count).toBeGreaterThan(30);
      expect(geo.getAttribute('normal').count).toBe(pos.count);
      expect(geo.getAttribute('color').count).toBe(pos.count);
      geo.computeBoundingSphere();
      expect(geo.boundingSphere!.radius).toBeGreaterThan(2);
      geo.dispose();
    }
  });

  it('closes the gable roof and winds every face outward so none is back-face culled', () => {
    const roof = gableGeometry(6, 4, 2, 0.2, 3, new Color('#fff'));
    const pos = roof.getAttribute('position');
    const nor = roof.getAttribute('normal');
    // Soffit, two eaves, two slopes, two pentagon ends (quad + triangle): 16 triangles.
    expect(pos.count).toBe(16 * 3);
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let i = 0; i < pos.count; i++) {
      cx += pos.getX(i);
      cy += pos.getY(i);
      cz += pos.getZ(i);
    }
    cx /= pos.count;
    cy /= pos.count;
    cz /= pos.count;
    let soffit = 0;
    for (let t = 0; t < pos.count; t += 3) {
      const mx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3 - cx;
      const my = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3 - cy;
      const mz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3 - cz;
      expect(
        nor.getX(t) * mx + nor.getY(t) * my + nor.getZ(t) * mz,
        `face ${t / 3}`,
      ).toBeGreaterThan(0);
      if (nor.getY(t) < -0.99) soffit++;
    }
    expect(soffit).toBe(2);
    roof.dispose();
  });
});
