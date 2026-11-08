import type { Color, Material } from 'three';
import type { Outfit } from '../SpectatorWardrobe';
import {
  SPECTATOR_POSE_COUNT,
  spectatorBodyGeometry,
  spectatorJacketGeometry,
  spectatorPose,
} from '../SpectatorGeometry';
import type { KindKit } from '../SceneryChunkManager';

/**
 * Two kits per spectator pose, dressed for `outfit`: the body in its own
 * vertex colours (optionally dimmed by `bodyTint`) and the top tinted by
 * `jackets[variant % n]`.
 */
export function spectatorKits(
  material: () => Material,
  jackets: readonly Color[],
  shadows: boolean,
  bodyTint: readonly Color[] | null = null,
  outfit: Outfit = 'winter',
): KindKit[] {
  const kits: KindKit[] = [];
  for (let pose = 0; pose < SPECTATOR_POSE_COUNT; pose++) {
    const accept = (p: { variant: number }) => spectatorPose(p.variant) === pose;
    kits.push(
      {
        sources: ['spectator'],
        geometry: spectatorBodyGeometry(pose, outfit),
        material: material(),
        tint: bodyTint,
        castShadow: shadows,
        vertexColors: true,
        accept,
      },
      {
        sources: ['spectator'],
        geometry: spectatorJacketGeometry(pose, outfit),
        material: material(),
        tint: jackets,
        castShadow: shadows,
        vertexColors: true,
        accept,
      },
    );
  }
  return kits;
}
