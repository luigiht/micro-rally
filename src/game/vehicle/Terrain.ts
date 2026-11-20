import type { Surface } from './surfaces';

/** What the vehicle sim needs to know about the ground. */
export interface TerrainQuery {
  /**
   * The ground's height at (x, z). `y`, the asker's own height, picks the
   * level where two roads cross one over the other (a circuit's bridge over
   * its tunnel); without it, the lower.
   */
  heightAt(x: number, z: number, y?: number): number;
  surfaceAt(x: number, z: number): Surface;
}

export function flatTerrain(surface: Surface, height = 0): TerrainQuery {
  return { heightAt: () => height, surfaceAt: () => surface };
}
