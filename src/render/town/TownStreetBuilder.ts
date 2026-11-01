import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { KERB_LIFT, type GroundQuery, type TownDef } from '@/game/stage/Town';
import { PAVEMENT_COLOR, ROAD_COLORS } from '../road/RoadBuilder';

/** Side-street plates sit this far under the deck the field reports, so the route ribbon wins where they overlap. */
const PLATE_DROP = 0.005;
/** Intersection plates are sampled on a grid, so they sit a little lower still to stay under the ribbon between samples. */
const JUNCTION_DROP = 0.02;
const PAVEMENT_WIDTH = 2;
/** Intersection plates reach this far beyond the carriageway edge, where the side-street plates begin. */
const PLATE_REACH = 0.3;
const STRIP_STEP = 4;
const GRID_STEP = 2;

/**
 * The town's paved ground that the route ribbon does not draw: a plate over
 * every intersection (filling the inner corners the spline cuts) and, for
 * each blocked side street, a tarmac plate with pavements either side. Every
 * vertex takes its height from the field, so the plates climb and dip with
 * the streets. One merged mesh.
 */
export class TownStreetBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: MeshStandardMaterial;
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly idx: number[] = [];

  constructor(town: TownDef, field: GroundQuery, halfWidth: number) {
    this.group.name = 'town-streets';
    const tarmac = new Color(ROAD_COLORS.tarmac);
    const pavement = new Color(PAVEMENT_COLOR);
    const seen = new Set<string>();
    for (const s of town.streets) {
      if (s.route) continue;
      const heading = Math.atan2(s.x1 - s.x0, s.z1 - s.z0);
      const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0);
      const start = halfWidth + PLATE_REACH;
      const deck = (a: number) =>
        field.heightAt(s.x0 + Math.sin(heading) * a, s.z0 + Math.cos(heading) * a);
      this.strip(
        s.x0,
        s.z0,
        heading,
        start,
        len,
        -s.halfWidth,
        s.halfWidth,
        (a) => deck(a) - PLATE_DROP,
        tarmac,
      );
      this.strip(
        s.x0,
        s.z0,
        heading,
        start,
        len,
        s.halfWidth,
        s.halfWidth + PAVEMENT_WIDTH,
        (a) => deck(a) + KERB_LIFT,
        pavement,
      );
      this.strip(
        s.x0,
        s.z0,
        heading,
        start,
        len,
        -s.halfWidth - PAVEMENT_WIDTH,
        -s.halfWidth,
        (a) => deck(a) + KERB_LIFT,
        pavement,
      );
      const key = `${s.x0.toFixed(1)}|${s.z0.toFixed(1)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      this.plate(s.x0, s.z0, heading, halfWidth + PLATE_REACH, field, tarmac);
    }
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    this.geometry.setAttribute('color', new BufferAttribute(Float32Array.from(this.col), 3));
    this.geometry.setIndex(this.idx);
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    const mesh = new Mesh(this.geometry, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  /** One quad in the street frame: `along` forward from (cx, cz), `left` across; wound counter-clockwise seen from above. */
  private quad(
    cx: number,
    cz: number,
    heading: number,
    corners: readonly (readonly [number, number, number])[],
    c: Color,
  ): void {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const lx = Math.cos(heading);
    const lz = -Math.sin(heading);
    const base = this.pos.length / 3;
    for (const [a, l, y] of corners) {
      this.pos.push(cx + fx * a + lx * l, y, cz + fz * a + lz * l);
      this.col.push(c.r, c.g, c.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Flat-across strip along a street, in pieces so it follows the deck's rise and fall. */
  private strip(
    cx: number,
    cz: number,
    heading: number,
    a0: number,
    a1: number,
    l0: number,
    l1: number,
    yAt: (a: number) => number,
    c: Color,
  ): void {
    for (let a = a0; a < a1 - 1e-6; a += STRIP_STEP) {
      const b = Math.min(a1, a + STRIP_STEP);
      const ya = yAt(a);
      const yb = yAt(b);
      this.quad(
        cx,
        cz,
        heading,
        [
          [a, l0, ya],
          [b, l0, yb],
          [b, l1, yb],
          [a, l1, ya],
        ],
        c,
      );
    }
  }

  /** Square plate over an intersection on a grid of cells, each vertex on the field's deck. */
  private plate(
    cx: number,
    cz: number,
    heading: number,
    r: number,
    field: GroundQuery,
    c: Color,
  ): void {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const lx = Math.cos(heading);
    const lz = -Math.sin(heading);
    const y = (a: number, l: number) =>
      field.heightAt(cx + fx * a + lx * l, cz + fz * a + lz * l) - JUNCTION_DROP;
    const cells = Math.ceil((2 * r) / GRID_STEP);
    const step = (2 * r) / cells;
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const a0 = -r + i * step;
        const a1 = a0 + step;
        const l0 = -r + j * step;
        const l1 = l0 + step;
        this.quad(
          cx,
          cz,
          heading,
          [
            [a0, l0, y(a0, l0)],
            [a1, l0, y(a1, l0)],
            [a1, l1, y(a1, l1)],
            [a0, l1, y(a0, l1)],
          ],
          c,
        );
      }
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
