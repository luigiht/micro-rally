import type { Surface } from '../vehicle/surfaces';
import type { TerrainQuery } from '../vehicle/Terrain';
import type { SpawnPose } from '../vehicle/VehicleSim';

/** Flat proving ground for tuning the car: a tarmac ring, surface pads and a jump ramp. */
export const TEST_TRACK = {
  size: 220,
  ring: { innerRadius: 54, outerRadius: 66 },
  pads: [
    { surface: 'gravel', cx: -22, cz: -20, w: 28, d: 28 },
    { surface: 'snow', cx: 22, cz: -20, w: 28, d: 28 },
    { surface: 'mud', cx: -22, cz: 20, w: 28, d: 28 },
  ] as const satisfies readonly {
    surface: Surface;
    cx: number;
    cz: number;
    w: number;
    d: number;
  }[],
  ramp: { cx: 22, z0: 8, length: 9, width: 8, height: 1.4 },
  spawn: { x: 0, z: -60, yaw: Math.PI / 2 } satisfies SpawnPose,
} as const;

export const testTrackTerrain: TerrainQuery = {
  heightAt(x, z) {
    const r = TEST_TRACK.ramp;
    if (Math.abs(x - r.cx) <= r.width / 2 && z >= r.z0 && z <= r.z0 + r.length) {
      return ((z - r.z0) / r.length) * r.height;
    }
    return 0;
  },
  surfaceAt(x, z) {
    const { innerRadius, outerRadius } = TEST_TRACK.ring;
    const d2 = x * x + z * z;
    if (d2 >= innerRadius * innerRadius && d2 <= outerRadius * outerRadius) return 'tarmac';
    const r = TEST_TRACK.ramp;
    if (Math.abs(x - r.cx) <= r.width / 2 && z >= r.z0 && z <= r.z0 + r.length) return 'tarmac';
    for (const pad of TEST_TRACK.pads) {
      if (Math.abs(x - pad.cx) <= pad.w / 2 && Math.abs(z - pad.cz) <= pad.d / 2)
        return pad.surface;
    }
    return 'grass';
  },
};
