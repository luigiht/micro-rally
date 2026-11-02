import { type BufferGeometry, Color } from 'three';
import { HOUSE_SLAB_TOP } from '@/game/stage/SceneryScatter';
import type { BuildingStyle } from '@/game/stage/Town';
import { box, merge } from './HouseGeometry';

/**
 * Flower boxes under the windows of the town buildings: a terracotta trough
 * hung just below the sill, a mound of leaves and three blooms. One merged,
 * vertex-coloured geometry per style, instanced untinted alongside the walls
 * kit, so it follows every building's transform. The hall keeps its civic
 * front bare.
 */
const FLOOR = HOUSE_SLAB_TOP;
const TROUGH = new Color('#9a5a3c');
const LEAVES = [new Color('#4f8a3b'), new Color('#67a048')] as const;
const BLOOMS = [new Color('#d9343a'), new Color('#f2c14e'), new Color('#e47ab0')] as const;

/** A sill: along the wall at `u`, window centre `y`, on the wall plane `wall` facing `sign` along `facing`. */
interface Sill {
  facing: 'z' | 'x';
  sign: 1 | -1;
  wall: number;
  u: number;
  y: number;
}

const win = (facing: 'z' | 'x', sign: 1 | -1, wall: number, u: number, y: number): Sill => ({
  facing,
  sign,
  wall,
  u,
  y,
});

/** Mirrors the window lists in BuildingGeometry and CivicGeometry: the fronts and the upper flank windows. */
const SILLS: Readonly<Record<BuildingStyle, readonly Sill[]>> = {
  townhouse: [
    win('z', -1, -3.5, -1.4, FLOOR + 1.6),
    win('z', -1, -3.5, -1.4, FLOOR + 4.3),
    win('z', -1, -3.5, 1.8, FLOOR + 4.3),
    win('x', -1, -4, 0.6, FLOOR + 4.3),
    win('x', 1, 4, 0.6, FLOOR + 4.3),
  ],
  shop: [
    win('z', -1, -4, -2.6, FLOOR + 4.9),
    win('z', -1, -4, 0, FLOOR + 4.9),
    win('z', -1, -4, 2.6, FLOOR + 4.9),
    win('x', -1, -5, -1.5, FLOOR + 4.9),
    win('x', -1, -5, 1.5, FLOOR + 4.9),
    win('x', 1, 5, -1.5, FLOOR + 4.9),
    win('x', 1, 5, 1.5, FLOOR + 4.9),
  ],
  tower: [
    win('z', -1, -3, -1.2, FLOOR + 1.6),
    win('z', -1, -3, 0, FLOOR + 7.0),
    win('x', -1, -3, 0.5, FLOOR + 4.4),
    win('x', 1, 3, 0.5, FLOOR + 4.4),
  ],
  hall: [],
};

/** One flower box under a sill. `out` is how far a part stands off the wall. */
function planter(s: Sill, k: number): BufferGeometry[] {
  const sill = s.y - 0.5;
  // (width along the wall, height, depth off the wall, along, up, out, colour)
  const part = (w: number, h: number, d: number, a: number, y: number, out: number, c: Color) => {
    const n = s.wall + s.sign * out;
    return s.facing === 'z' ? box(w, h, d, a, y, n, c) : box(d, h, w, n, y, a, c);
  };
  return [
    part(1.1, 0.26, 0.3, s.u, sill - 0.17, 0.17, TROUGH),
    part(0.96, 0.24, 0.2, s.u, sill + 0.06, 0.22, LEAVES[k % 2]!),
    part(0.16, 0.16, 0.16, s.u - 0.3, sill + 0.22, 0.22, BLOOMS[k % 3]!),
    part(0.16, 0.16, 0.16, s.u, sill + 0.24, 0.24, BLOOMS[(k + 1) % 3]!),
    part(0.16, 0.16, 0.16, s.u + 0.3, sill + 0.22, 0.2, BLOOMS[(k + 2) % 3]!),
  ];
}

/** Every flower box of a style as one geometry, or null for a style that has none. */
export function buildingPlantersGeometry(style: BuildingStyle): BufferGeometry | null {
  const sills = SILLS[style];
  if (sills.length === 0) return null;
  return merge(sills.flatMap((s, k) => planter(s, k)));
}
