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
import {
  HANDOFF_OVERLAP,
  handoffRadius,
  ringOuterRadius,
  type Roundabout,
} from '@/game/stage/Roundabout';
import { stubCut } from '@/game/stage/TownJunctions';
import { LINE_ABOVE_DECK } from '../road/RoadBuilder';
import { themeColor } from '../theme/themeColor';
import type { RoadTheme } from '../theme/WorldTheme';

const STRIP_STEP = 4;
const LINE_INSET = 0.35;
const LINE_WIDTH = 0.22;

/** The roundabout a side street leaves, if it is one of a ring's exits. */
function ringOf(town: TownDef, st: Street): Roundabout | undefined {
  return (town.roundabouts ?? []).find(
    (r) => Math.abs(Math.hypot(st.x0 - r.x, st.z0 - r.z) - ringOuterRadius(r)) < 0.05,
  );
}

/**
 * Where a side street's own pavements, kerbs and lines start: at its plate
 * cut, or for a ring's exit at the ring's hand-off radius, inside which the
 * ring's own surface paints them.
 */
function kerbCutOf(town: TownDef, st: Street, cut: number): number {
  const r = ringOf(town, st);
  return r ? handoffRadius(r) - ringOuterRadius(r) - HANDOFF_OVERLAP : cut;
}

/**
 * Where a side street's own plates start: its junction's cut along its arm,
 * the ring's outer edge for a roundabout's exit, or the reach when no arm
 * matches.
 */
function cutOf(town: TownDef, st: Street, heading: number, routeHalfWidth: number): number {
  const ring = ringOf(town, st);
  // A ring exit's plate starts inside the ring: its square end would otherwise stand proud of the
  // ring's round edge at its corners, which the circle curves back from, and leave two slivers bare.
  if (ring) {
    const outer = ringOuterRadius(ring);
    return -(outer - Math.sqrt(Math.max(0, outer * outer - st.halfWidth * st.halfWidth))) - 0.3;
  }
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
 * Where a side street's plates end: its length, or, where it runs into a
 * junction at its far end (a city street ending in a T on the route), that
 * junction's cut along the arm pointing back up the street.
 */
function endOf(
  town: TownDef,
  st: Street,
  heading: number,
  len: number,
  routeHalfWidth: number,
): number {
  for (const j of town.junctions) {
    if (Math.hypot(j.x - st.x1, j.z - st.z1) > 1e-3) continue;
    for (const a of j.arms) {
      const d = Math.atan2(
        Math.sin(a.heading - heading - Math.PI),
        Math.cos(a.heading - heading - Math.PI),
      );
      if (a.role === 'blocked' && Math.abs(d) < 0.01) return len - stubCut(j, a, routeHalfWidth);
    }
  }
  return len;
}

/** A mouth in a side street's pavement: another street arrives on `side`, its axis crossing at `at` along, `halfWidth` wide. */
interface Mouth {
  at: number;
  halfWidth: number;
  side: 1 | -1;
}

/**
 * The open streets that run into `st`'s side: each ends on `st`'s
 * carriageway edge, and `st`'s pavement, kerb and line open for it over the
 * arriving street's width.
 */
function mouthsOf(town: TownDef, st: Street, heading: number, len: number): Mouth[] {
  const out: Mouth[] = [];
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const lx = Math.cos(heading);
  const lz = -Math.sin(heading);
  for (const o of town.streets) {
    if (o === st || o.route || !o.open) continue;
    const dx = o.x1 - st.x0;
    const dz = o.z1 - st.z0;
    const at = dx * fx + dz * fz;
    const across = dx * lx + dz * lz;
    if (at < 0 || at > len) continue;
    if (Math.abs(Math.abs(across) - st.halfWidth) > 0.5) continue;
    out.push({ at, halfWidth: o.halfWidth, side: across >= 0 ? 1 : -1 });
  }
  return out;
}

/** Pieces of [a0, a1] left once the mouths on `side` are taken out. */
function openPieces(
  a0: number,
  a1: number,
  mouths: readonly Mouth[],
  side: 1 | -1,
): [number, number][] {
  const cuts = mouths
    .filter((m) => m.side === side)
    .map((m): [number, number] => [m.at - m.halfWidth, m.at + m.halfWidth])
    .sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let start = a0;
  for (const [c0, c1] of cuts) {
    if (c0 > start) out.push([start, Math.min(c0, a1)]);
    start = Math.max(start, c1);
  }
  if (start < a1) out.push([start, a1]);
  return out.filter(([p, q]) => q - p > 1e-6);
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
    road: RoadTheme,
  ) {
    this.group.name = 'town-streets';
    const tarmac = new Color(road.surface ?? road.surfaces.tarmac);
    const pavement = new Color(road.pavement);
    const line = themeColor(road.line);
    const kerb = themeColor(road.kerb);
    for (const st of town.streets) {
      if (st.route) continue;
      const dx = st.x1 - st.x0;
      const dz = st.z1 - st.z0;
      const h = Math.atan2(dx, dz);
      const len = Math.hypot(dx, dz);
      const hw = st.halfWidth;
      const cut = cutOf(town, st, h, halfWidth);
      const end = endOf(town, st, h, len, halfWidth);
      // A roundabout's ring chords are shorter than any cut: the ring is drawn by its own builder.
      if (end <= cut) continue;
      const kerbCut = Math.min(end, kerbCutOf(town, st, cut));
      const strip = (a0: number, a1: number, l0: number, l1: number, lift: number, c: Color) =>
        this.strip(st.x0, st.z0, h, a0, a1, l0, l1, lift, c);
      strip(cut, end, -hw, hw, 0, tarmac);
      const mouths = mouthsOf(town, st, h, len);
      // An open street's own pavements stop at the pavement of the side street it meets; one ending
      // in a T on the route stops at the junction's cut like any arm.
      const sideEnd = st.open && end === len ? end - PAVEMENT_WIDTH : end;
      for (const side of [1, -1] as const) {
        const lo = Math.min(side * hw, side * (hw + PAVEMENT_WIDTH));
        const inner = Math.min(side * (hw - LINE_INSET), side * (hw - LINE_INSET - LINE_WIDTH));
        for (const [p0, p1] of openPieces(kerbCut, sideEnd, mouths, side)) {
          strip(p0, p1, lo, lo + PAVEMENT_WIDTH, KERB_LIFT, pavement);
          strip(p0, p1, inner, inner + LINE_WIDTH, LINE_ABOVE_DECK, line);
          this.face(st.x0, st.z0, h, p0, p1, side * hw, side, kerb);
        }
        // Tarmac across the pavement band at each mouth, flush with both carriageways.
        for (const m of mouths)
          if (m.side === side)
            strip(m.at - m.halfWidth, m.at + m.halfWidth, lo, lo + PAVEMENT_WIDTH, 0.002, tarmac);
      }
      // An open street runs on to another road's pavement; a closed one has a pavement across its end.
      if (!st.open)
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
