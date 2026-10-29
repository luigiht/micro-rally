import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { StageDef } from '@/game/stage/StageGenerator';
import type { TerrainField } from '@/game/stage/TerrainField';

type ArchStyle = 'start' | 'checkpoint' | 'finish';

const BANNER: Readonly<Record<ArchStyle, [string, string]>> = {
  start: ['#4f9d69', '#f4f1e8'],
  checkpoint: ['#f2c14e', '#2b2a33'],
  finish: ['#2b2a33', '#f4f1e8'],
};
const HEIGHT = 4.4;
const TILES = 10;

/** Start gantry, checkpoint arches and finish gantry built from boxes. */
export class GateBuilder {
  readonly group = new Group();
  private readonly geometries: BoxGeometry[] = [];
  private readonly materials = new Map<string, MeshStandardMaterial>();

  constructor(stage: StageDef, field: TerrainField) {
    this.group.name = 'gates';
    const sample = { x: 0, z: 0, heading: 0 };
    stage.path.sample(stage.startDistance, sample);
    this.addArch('start', sample.x, sample.z, sample.heading, stage.halfWidth + 2.2, field);
    for (const g of stage.gates) {
      this.addArch(g.kind, g.x, g.z, g.heading, g.halfWidth - 0.8, field);
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials.values()) m.dispose();
  }

  private material(color: string, emissive = false): MeshStandardMaterial {
    const key = color + (emissive ? '*' : '');
    let m = this.materials.get(key);
    if (!m) {
      m = new MeshStandardMaterial({
        color,
        flatShading: true,
        emissive: emissive ? color : '#000000',
        emissiveIntensity: emissive ? 0.25 : 0,
      });
      this.materials.set(key, m);
    }
    return m;
  }

  private box(w: number, h: number, d: number): BoxGeometry {
    const g = new BoxGeometry(w, h, d);
    this.geometries.push(g);
    return g;
  }

  private addArch(
    style: ArchStyle,
    x: number,
    z: number,
    heading: number,
    half: number,
    field: TerrainField,
  ) {
    const arch = new Group();
    arch.position.set(x, field.heightAt(x, z), z);
    arch.rotation.y = heading;
    const [primary, secondary] = BANNER[style];
    const postGeo = this.box(0.35, HEIGHT, 0.35);
    for (const side of [-1, 1]) {
      const post = new Mesh(postGeo, this.material('#d9d4c7'));
      post.position.set(side * half, HEIGHT / 2, 0);
      post.castShadow = true;
      arch.add(post);
    }
    const tileW = (half * 2) / TILES;
    const tileGeo = this.box(tileW, 0.9, 0.3);
    for (let i = 0; i < TILES; i++) {
      const color = i % 2 === 0 ? primary : secondary;
      const tile = new Mesh(tileGeo, this.material(color, style !== 'finish'));
      tile.position.set(-half + tileW * (i + 0.5), HEIGHT - 0.45, 0);
      arch.add(tile);
    }
    arch.traverse((o) => {
      o.matrixAutoUpdate = false;
      o.updateMatrix();
    });
    arch.updateMatrixWorld(true);
    this.group.add(arch);
  }
}
