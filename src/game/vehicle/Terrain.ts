import type { Surface } from './surfaces';

/** What the vehicle sim needs to know about the ground. */
export interface TerrainQuery {
  heightAt(x: number, z: number): number;
  surfaceAt(x: number, z: number): Surface;
}

export function flatTerrain(surface: Surface, height = 0): TerrainQuery {
  return { heightAt: () => height, surfaceAt: () => surface };
}
