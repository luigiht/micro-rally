import { type BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { Coastline, WallPoint } from '@/game/stage/Coastline';
import type { GroundQuery } from '@/game/stage/Town';
import { merge } from '../scenery/HouseGeometry';
import type { WallTheme } from '../theme/WorldTheme';
import { stoneWallParts } from './StoneWallGeometry';

/**
 * The walls along a Coast stage's drops: dry-stone walls of concrete blocks
 * (see `StoneWallGeometry`) as one merged, flat-shaded, vertex-coloured mesh.
 * The colliders are the wall line's boxes.
 */
export class SeaWallBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry | null;
  private readonly material: MeshStandardMaterial;

  constructor(coast: Coastline, field: GroundQuery, theme: WallTheme) {
    this.group.name = 'sea-wall';
    const parts: BufferGeometry[] = [];
    for (const wall of coast.walls) {
      const sample = (along: number, out: WallPoint) => coast.wallPoint(along, wall.side, 0, out);
      stoneWallParts(wall, sample, field, theme, coast.stage.seed, parts);
    }
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.95,
    });
    this.geometry = parts.length > 0 ? merge(parts) : null;
    if (this.geometry) {
      const mesh = new Mesh(this.geometry, this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
  }

  dispose(): void {
    this.geometry?.dispose();
    this.material.dispose();
  }
}
