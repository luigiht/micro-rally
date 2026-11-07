import { BUILDING_SIZE } from './BuildingCatalog';
import { SpatialHash } from './SpatialHash';
import { buildingCorners, type Building } from './Town';

/**
 * The buildings of a town under construction, gridded by centre with their
 * corners cached, so standing a house checks the handful nearby rather
 * than every terrace laid so far (a city lays thousands). Built once per
 * building list and kept in step with it as buildings are pushed.
 */

/** The furthest any style's corner stands from its centre. */
export const MAX_BUILDING_REACH = Math.max(
  ...Object.values(BUILDING_SIZE).map(({ hx, hz }) => Math.hypot(hx, hz)),
);
const CELL = 16;

export interface IndexedBuilding {
  b: Building;
  corners: [number, number][];
}

export class BuildingIndex {
  private readonly grid = new SpatialHash<IndexedBuilding>(CELL);
  private synced = 0;

  constructor(private readonly buildings: readonly Building[]) {}

  /** File any buildings pushed to the list since the last call. */
  private sync(): void {
    for (; this.synced < this.buildings.length; this.synced++) {
      const b = this.buildings[this.synced]!;
      this.grid.insert({ b, corners: buildingCorners(b) }, b.x, b.z);
    }
  }

  /** Visit every building whose footprint might come within `reach` of (x, z); stops when `fn` returns true. */
  near(x: number, z: number, reach: number, fn: (e: IndexedBuilding) => boolean | void): boolean {
    this.sync();
    return this.grid.near(x, z, reach + MAX_BUILDING_REACH, fn);
  }

  /** True when any building's footprint, grown by `margin`, covers (x, z). */
  covers(x: number, z: number, margin: number): boolean {
    return this.near(x, z, margin, ({ b }) => {
      const dx = x - b.x;
      const dz = z - b.z;
      const cy = Math.cos(b.yaw);
      const sy = Math.sin(b.yaw);
      const u = dx * cy - dz * sy;
      const v = dx * sy + dz * cy;
      return Math.abs(u) <= b.hx + margin && Math.abs(v) <= b.hz + margin;
    });
  }
}

const indices = new WeakMap<readonly Building[], BuildingIndex>();

/** The index over a building list, made on first use. */
export function buildingIndex(buildings: readonly Building[]): BuildingIndex {
  let idx = indices.get(buildings);
  if (!idx) {
    idx = new BuildingIndex(buildings);
    indices.set(buildings, idx);
  }
  return idx;
}
