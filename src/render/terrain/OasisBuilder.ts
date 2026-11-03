import { type BufferGeometry, CircleGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { OASIS_BLEND, OASIS_BOWL, OASIS_WATER_ABOVE, type Oasis } from '@/game/stage/Oases';
import { merge } from '../scenery/HouseGeometry';

/** The pools: one flat disc per oasis at its water level, reaching under the hollow's slope so no edge shows. */
export class OasisBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: MeshStandardMaterial;

  constructor(oases: readonly Oasis[], color: string) {
    this.group.name = 'oases';
    // The slope climbs the bowl's depth over the blend; the water line sits where it has climbed to the water.
    const shore = (OASIS_WATER_ABOVE / OASIS_BOWL) * OASIS_BLEND + 1.5;
    const parts = oases.map((o) =>
      new CircleGeometry(o.radius + shore, 18)
        .rotateX(-Math.PI / 2)
        .translate(o.x, o.y + OASIS_WATER_ABOVE, o.z),
    );
    this.geometry = merge(parts);
    this.material = new MeshStandardMaterial({ color, flatShading: true, roughness: 0.4 });
    const mesh = new Mesh(this.geometry, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
