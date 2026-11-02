import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  JUNCTION_REACH,
  KERB_LIFT,
  PAVEMENT_WIDTH,
  type GroundQuery,
  type Street,
  type TownDef,
} from '@/game/stage/Town';
import { stubCut } from '@/game/stage/TownJunctions';
import {
  KERB_COLOR,
  LINE_COLOR,
  LINE_ABOVE_DECK,
  PAVEMENT_COLOR,
  ROAD_COLORS,
} from '../road/RoadBuilder';

const STRIP_STEP = 4;
const LINE_INSET = 0.35;
const LINE_WIDTH = 0.22;

/** Where a side street's own plates start: its junction's cut along its arm, or the reach when no arm matches. */
function cutOf(town: TownDef, st: Street, heading: number, routeHalfWidth: number): number {
  for (const j of town.junctions) {
    if (Math.hypot(j.x - st.x0, j.z - st.z0) > 1e-3) continue;
    for (const a of j.arms) {
      const d = Math.atan2(Math.sin(a.heading - heading), Math.cos(a.heading - heading));
      if (a.role === 'blocked' && Math.abs(d) < 0.01) return stubCut(j, a, routeHalfWidth);
    }
  }
  return routeHalfWidth + JUNCTION_REACH;
}

/**
 * The straight part of every blocked side street, from the junction's cut
 * to its end: a tarmac plate, pavements behind kerb faces and white edge
 * lines either side, and a pavement across the end under the building that
 * closes it. Every vertex takes its height from the field at its own
 * position, so the plates follow the deck wherever it tilts or climbs and
 * meet the junction surface and the pavements exactly. One merged mesh.
 */
export class TownStreetBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: MeshStandardMaterial;
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly idx: number[] = [];

  constructor(
    town: TownDef,
    private readonly field: GroundQuery,
    halfWidth: number,
  ) {
    this.group.name = 'town-streets';
    const tarmac = new Color(ROAD_COLORS.tarmac);
    const pavement = new Color(PAVEMENT_COLOR);
    const line = new Color(LINE_COLOR);
    const kerb = new Color(KERB_COLOR);
    for (const st of town.streets) {
      if (st.route) continue;
      const dx = st.x1 - st.x0;
      const dz = st.z1 - st.z0;
      const h = Math.atan2(dx, dz);
      const len = Math.hypot(dx, dz);
      const hw = st.halfWidth;
      const cut = cutOf(town, st, h, halfWidth);
      const strip = (a0: number, a1: number, l0: number, l1: number, lift: number, c: Color) =>
        this.strip(st.x0, st.z0, h, a0, a1, l0, l1, lift, c);
      strip(cut, len, -hw, hw, 0, tarmac);
      for (const side of [1, -1] as const) {
        const lo = Math.min(side * hw, side * (hw + PAVEMENT_WIDTH));
        strip(cut, len, lo, lo + PAVEMENT_WIDTH, KERB_LIFT, pavement);
        const inner = Math.min(side * (hw - LINE_INSET), side * (hw - LINE_INSET - LINE_WIDTH));
        strip(cut, len, inner, inner + LINE_WIDTH, LINE_ABOVE_DECK, line);
        this.face(st.x0, st.z0, h, cut, len, side * hw, side, kerb);
      }
      strip(
        len,
        len + PAVEMENT_WIDTH,
        -hw - PAVEMENT_WIDTH,
        hw + PAVEMENT_WIDTH,
        KERB_LIFT,
        pavement,
      );
    }
    const raw = new BufferGeometry();
    raw.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    raw.setAttribute('color', new BufferAttribute(Float32Array.from(this.col), 3));
    raw.setIndex(this.idx);
    this.geometry = mergeVertices(raw, 1e-4);
    raw.dispose();
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.75,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new Mesh(this.geometry, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  /** A point `along` the street frame at (cx, cz), `left` across, on the deck plus `lift`, as a quad corner. */
  private corner(
    cx: number,
    cz: number,
    heading: number,
    along: number,
    left: number,
    lift: number,
  ): readonly [number, number, number] {
    const x = cx + Math.sin(heading) * along + Math.cos(heading) * left;
    const z = cz + Math.cos(heading) * along - Math.sin(heading) * left;
    return [x, this.field.deckAt(x, z) + lift, z];
  }

  /** One quad of world points with heights, wound as given. */
  private quad(corners: readonly (readonly [number, number, number])[], c: Color): void {
    const base = this.pos.length / 3;
    for (const [x, y, z] of corners) {
      this.pos.push(x, y, z);
      this.col.push(c.r, c.g, c.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Strip along a street between `l0` and `l1` across (l0 < l1), in pieces, counter-clockwise from above. */
  private strip(
    cx: number,
    cz: number,
    heading: number,
    a0: number,
    a1: number,
    l0: number,
    l1: number,
    lift: number,
    c: Color,
  ): void {
    for (let a = a0; a < a1 - 1e-6; a += STRIP_STEP) {
      const b = Math.min(a1, a + STRIP_STEP);
      this.quad(
        [
          this.corner(cx, cz, heading, a, l0, lift),
          this.corner(cx, cz, heading, b, l0, lift),
          this.corner(cx, cz, heading, b, l1, lift),
          this.corner(cx, cz, heading, a, l1, lift),
        ],
        c,
      );
    }
  }

  /** The kerb's vertical face along one edge of a street, facing the carriageway, in pieces. */
  private face(
    cx: number,
    cz: number,
    heading: number,
    a0: number,
    a1: number,
    l: number,
    side: 1 | -1,
    c: Color,
  ): void {
    for (let a = a0; a < a1 - 1e-6; a += STRIP_STEP) {
      const b = Math.min(a1, a + STRIP_STEP);
      const lowA = this.corner(cx, cz, heading, a, l, 0);
      const lowB = this.corner(cx, cz, heading, b, l, 0);
      const highA = this.corner(cx, cz, heading, a, l, KERB_LIFT);
      const highB = this.corner(cx, cz, heading, b, l, KERB_LIFT);
      // The left kerb's quad climbs on its far edge, the right kerb's on its near edge, so both face the road.
      this.quad(side > 0 ? [lowA, lowB, highB, highA] : [highA, highB, lowB, lowA], c);
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
