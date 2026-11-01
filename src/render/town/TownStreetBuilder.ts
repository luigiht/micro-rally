import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { KERB_LIFT, PAVEMENT_WIDTH, type GroundQuery, type TownDef } from '@/game/stage/Town';
import { stubCut } from '@/game/stage/TownJunctions';
import { BARRIER_DISTANCE, STUB_LENGTH } from '@/game/stage/TownSideStreets';
import { LINE_COLOR, LINE_LIFT, PAVEMENT_COLOR, ROAD_COLORS } from '../road/RoadBuilder';

/** Side-street plates sit this far under the deck the field reports, so the junction surface and ribbon win where they overlap. */
const PLATE_DROP = 0.005;
/** A white stop line across each blocked arm where its plate begins, when that is still short of the barrier. */
const STOP_LINE = 0.4;
const STRIP_STEP = 4;
const LINE_INSET = 0.35;
const LINE_WIDTH = 0.22;

/**
 * The straight part of every blocked side street, from the junction's cut
 * to its end: a tarmac plate, pavements and white edge lines either side, a
 * stop line, and a pavement across the end under the building that closes
 * it. Every vertex takes its height from the field, so the plates climb and
 * dip with the streets. One merged mesh.
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
    const line = new Color(LINE_COLOR);
    for (const j of town.junctions) {
      for (const a of j.arms) {
        if (a.role !== 'blocked') continue;
        const cut = stubCut(j, a, halfWidth);
        const h = a.heading;
        const hw = a.halfWidth;
        const deck = (al: number) => field.heightAt(j.x + Math.sin(h) * al, j.z + Math.cos(h) * al);
        const strip = (a0: number, a1: number, l0: number, l1: number, lift: number, c: Color) =>
          this.strip(j.x, j.z, h, a0, a1, l0, l1, (al) => deck(al) + lift, c);
        if (cut + STOP_LINE + 0.2 < BARRIER_DISTANCE - 1)
          strip(cut + 0.2, cut + 0.2 + STOP_LINE, -hw, hw, LINE_LIFT, line);
        strip(cut, STUB_LENGTH, -hw, hw, -PLATE_DROP, tarmac);
        for (const side of [1, -1] as const) {
          const lo = Math.min(side * hw, side * (hw + PAVEMENT_WIDTH));
          strip(cut, STUB_LENGTH, lo, lo + PAVEMENT_WIDTH, KERB_LIFT, pavement);
          const inner = Math.min(side * (hw - LINE_INSET), side * (hw - LINE_INSET - LINE_WIDTH));
          strip(cut, STUB_LENGTH, inner, inner + LINE_WIDTH, LINE_LIFT, line);
        }
        const end = deck(STUB_LENGTH) + KERB_LIFT;
        this.strip(
          j.x,
          j.z,
          h,
          STUB_LENGTH,
          STUB_LENGTH + PAVEMENT_WIDTH,
          -hw - PAVEMENT_WIDTH,
          hw + PAVEMENT_WIDTH,
          () => end,
          pavement,
        );
      }
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

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
