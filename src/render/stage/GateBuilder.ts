import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { StageDef } from '@/game/stage/StageGenerator';
import type { TerrainField } from '@/game/stage/TerrainField';
import { themedMaterial, themeGlow, themeHex } from '../theme/themeColor';
import type { GateTheme, ThemeColor } from '../theme/WorldTheme';

type ArchStyle = 'start' | 'finish';

const HEIGHT = 4.4;
const TILES = 10;

/** Time-control board standing on the ground: plain white plate, yellow "start of control" clock reading 2:50. */
const BOARD = { width: 0.9, height: 1.15, clock: 0.3, ring: 0.045 } as const;
/** Clock hands, clockwise from 12 as the approaching driver sees them. */
const HOUR_ANGLE = (2 + 50 / 60) * (Math.PI / 6);
const MINUTE_ANGLE = 50 * (Math.PI / 30);
/** Layers sit this far in front of each other: flat to the eye, no z-fighting. */
const LAYER = 0.003;

/**
 * Start gantry and finish gantry built from boxes; checkpoints are a pair of
 * roadside time-control boards (yellow clock on white), as at real rally
 * controls, rather than arches.
 */
export class GateBuilder {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials = new Map<string, MeshStandardMaterial>();

  constructor(
    stage: StageDef,
    field: TerrainField,
    private readonly theme: GateTheme,
  ) {
    this.group.name = 'gates';
    const sample = { x: 0, z: 0, heading: 0 };
    stage.path.sample(stage.startDistance, sample);
    this.addArch('start', sample.x, sample.z, sample.heading, stage.halfWidth + 2.2, field);
    for (const g of stage.gates) {
      if (g.kind === 'finish')
        this.addArch('finish', g.x, g.z, g.heading, g.halfWidth - 0.8, field);
      else this.addControlBoards(g.x, g.z, g.heading, g.halfWidth - 3 + 1.2, field);
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials.values()) m.dispose();
  }

  private material(color: ThemeColor): MeshStandardMaterial {
    const key = `${themeHex(color)}*${themeGlow(color)}`;
    let m = this.materials.get(key);
    if (!m) {
      m = themedMaterial(color);
      this.materials.set(key, m);
    }
    return m;
  }

  private box(w: number, h: number, d: number): BoxGeometry {
    const g = new BoxGeometry(w, h, d);
    this.geometries.push(g);
    return g;
  }

  /** Thin disc facing -z (toward the approaching car). */
  private disc(radius: number, depth: number): BufferGeometry {
    const g = new CylinderGeometry(radius, radius, depth, 16).rotateX(Math.PI / 2);
    this.geometries.push(g);
    return g;
  }

  /** One board on each verge, standing on the ground with no post: a plain white plate with a flat yellow clock. */
  private addControlBoards(
    x: number,
    z: number,
    heading: number,
    half: number,
    field: TerrainField,
  ) {
    const { width, height, clock, ring } = BOARD;
    const thick = 0.04;
    // Sunk 0.1 m so it meets sloping ground without a gap.
    const plateGeo = this.box(width, height + 0.1, thick).translate(0, (height - 0.1) / 2, 0);
    const ringGeo = this.disc(clock + ring, LAYER);
    const faceGeo = this.disc(clock, LAYER);
    const hourGeo = this.box(0.05, clock * 0.55, LAYER).translate(0, clock * 0.275, 0);
    const minuteGeo = this.box(0.04, clock * 0.8, LAYER).translate(0, clock * 0.4, 0);
    const hubGeo = this.disc(0.04, LAYER);
    const cy = height - clock - ring - 0.12;
    const front = -thick / 2;
    for (const side of [-1, 1]) {
      const px = x + Math.cos(heading) * half * side;
      const pz = z - Math.sin(heading) * half * side;
      const board = new Group();
      board.position.set(px, field.heightAt(px, pz), pz);
      board.rotation.y = heading;
      const { board: plateColor, clock, ink } = this.theme;
      const plate = new Mesh(plateGeo, this.material(plateColor));
      plate.castShadow = true;
      board.add(plate);
      // Positive z-rotation reads clockwise from the -z side the driver sees.
      const parts: [BufferGeometry, ThemeColor, number, number][] = [
        [ringGeo, ink, 0, front - LAYER],
        [faceGeo, clock, 0, front - LAYER * 2],
        [hourGeo, ink, HOUR_ANGLE, front - LAYER * 3],
        [minuteGeo, ink, MINUTE_ANGLE, front - LAYER * 3],
        [hubGeo, ink, 0, front - LAYER * 4],
      ];
      for (const [geo, color, spin, depth] of parts) {
        const m = new Mesh(geo, this.material(color));
        m.position.set(0, cy, depth);
        m.rotation.z = spin;
        board.add(m);
      }
      board.traverse((o) => {
        o.matrixAutoUpdate = false;
        o.updateMatrix();
      });
      board.updateMatrixWorld(true);
      this.group.add(board);
    }
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
    const [primary, secondary] = style === 'start' ? this.theme.start : this.theme.finish;
    const postGeo = this.box(0.35, HEIGHT, 0.35);
    for (const side of [-1, 1]) {
      const post = new Mesh(postGeo, this.material(this.theme.post));
      post.position.set(side * half, HEIGHT / 2, 0);
      post.castShadow = true;
      arch.add(post);
    }
    const tileW = (half * 2) / TILES;
    const tileGeo = this.box(tileW, 0.9, 0.3);
    for (let i = 0; i < TILES; i++) {
      const color = i % 2 === 0 ? primary : secondary;
      const tile = new Mesh(tileGeo, this.material(color));
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
