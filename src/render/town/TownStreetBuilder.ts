import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { ROAD_LIFT } from '@/game/stage/TerrainField';
import { KERB_LIFT, type Street, type TownDef } from '@/game/stage/Town';
import { PAVEMENT_COLOR, ROAD_COLORS } from '../road/RoadBuilder';

/** Street plates sit this far under the route ribbon so the ribbon wins where they overlap. */
const PLATE_DROP = 0.005;
const PAVEMENT_WIDTH = 2;
/** Intersection plates reach this far beyond the carriageway edge, where the side-street plates begin. */
const PLATE_REACH = 0.3;

/**
 * The town's paved ground that the route ribbon does not draw: a square plate
 * at every intersection (filling the inner corners the spline cuts) and, for
 * each blocked side street, a tarmac plate with pavements either side. All of
 * it lies flat on the plateau at deck height, one merged mesh.
 */
export class TownStreetBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: MeshStandardMaterial;

  constructor(town: TownDef, groundY: number, halfWidth: number) {
    this.group.name = 'town-streets';
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const tarmac = new Color(ROAD_COLORS.tarmac);
    const pavement = new Color(PAVEMENT_COLOR);
    const road = groundY + ROAD_LIFT - PLATE_DROP;
    const kerb = groundY + ROAD_LIFT + KERB_LIFT;
    const quad = (
      cx: number,
      cz: number,
      heading: number,
      along0: number,
      along1: number,
      left0: number,
      left1: number,
      y: number,
      c: Color,
    ) => {
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const lx = Math.cos(heading);
      const lz = -Math.sin(heading);
      const base = pos.length / 3;
      for (const [a, l] of [
        [along0, left0],
        [along1, left0],
        [along1, left1],
        [along0, left1],
      ] as const) {
        pos.push(cx + fx * a + lx * l, y, cz + fz * a + lz * l);
        col.push(c.r, c.g, c.b);
      }
      // Counter-clockwise seen from above: forward × left points up.
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    const seen = new Set<string>();
    for (const s of town.streets) {
      if (s.route) continue;
      const heading = Math.atan2(s.x1 - s.x0, s.z1 - s.z0);
      const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0);
      const start = halfWidth + PLATE_REACH;
      quad(s.x0, s.z0, heading, start, len, -s.halfWidth, s.halfWidth, road, tarmac);
      quad(
        s.x0,
        s.z0,
        heading,
        start,
        len,
        s.halfWidth,
        s.halfWidth + PAVEMENT_WIDTH,
        kerb,
        pavement,
      );
      quad(
        s.x0,
        s.z0,
        heading,
        start,
        len,
        -s.halfWidth - PAVEMENT_WIDTH,
        -s.halfWidth,
        kerb,
        pavement,
      );
      const key = `${s.x0.toFixed(1)}|${s.z0.toFixed(1)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      this.plate(quad, s, halfWidth, road, tarmac);
    }
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(Float32Array.from(pos), 3));
    this.geometry.setAttribute('color', new BufferAttribute(Float32Array.from(col), 3));
    this.geometry.setIndex(idx);
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    const mesh = new Mesh(this.geometry, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  /** Square tarmac plate centred on the intersection the side street leaves from, aligned to it. */
  private plate(
    quad: (
      cx: number,
      cz: number,
      heading: number,
      a0: number,
      a1: number,
      l0: number,
      l1: number,
      y: number,
      c: Color,
    ) => void,
    s: Street,
    halfWidth: number,
    y: number,
    c: Color,
  ): void {
    const heading = Math.atan2(s.x1 - s.x0, s.z1 - s.z0);
    const r = halfWidth + PLATE_REACH;
    quad(s.x0, s.z0, heading, -r, r, -r, r, y + PLATE_DROP / 2, c);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
