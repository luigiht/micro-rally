import { Color } from 'three';
import type { StagePalette } from '@/game/stage/regions';
import type { KindKit } from '../SceneryChunkManager';
import { tallGrassGeometry, tallGrassMaterial, tallGrassStandIn } from '../TallGrassGeometry';

/** Straw the third tint leans towards, so some clumps read dry. */
const STRAW = new Color('#c9b46a');

/**
 * Tall grass (stage types with `grass` or `meadow`): full patches near the
 * car and a third of their blades beyond, tinted from the region's own
 * grass, one variant drier, so they belong to the ground they stand on. No
 * shadows cast (thin blades would only speckle the ground); they take the
 * trees' shadows.
 */
export function tallGrassKits(palette: StagePalette, shadows: boolean): KindKit[] {
  const high = new Color(palette.grassHigh);
  const low = new Color(palette.grassLow);
  // One tint per `GRASS_VARIANTS`.
  const tint = [high, low.clone().lerp(high, 0.5), high.clone().lerp(STRAW, 0.35)];
  const kit = (lod: 'near' | 'far'): KindKit => ({
    sources: ['grass'],
    geometry: lod === 'near' ? tallGrassGeometry() : tallGrassStandIn(),
    material: tallGrassMaterial(),
    tint,
    vertexColors: true,
    castShadow: false,
    receiveShadow: shadows,
    lod,
  });
  return [kit('near'), kit('far')];
}
