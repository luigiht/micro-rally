import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { DECK_OUT, RAIL_HALF, RAIL_OUT, type Lake } from '@/game/stage/Lakes';
import type { RoadSample } from '@/game/stage/RoadPath';
import type { StageDef } from '@/game/stage/StageGenerator';
import { ROAD_LIFT, type TerrainField, type TerrainSample } from '@/game/stage/TerrainField';

/**
 * A long concrete beam bridge wherever the road crosses a lake (`Lakes`):
 * a deck slab under the road ribbon, its ledge out to the guard rails, its
 * fascia and soffit; a pier across the slab every `PIER_EVERY` metres down
 * into the lake bed; a solid abutment at each end down into the bank; and
 * white steel guard rails along both edges on short posts, the rails the
 * colliders `lakeBridgeObstacles` gives the sim. One merged mesh in vertex
 * colours.
 */

/** The deck is drawn every this many metres along the road, and stands this deep under the ribbon. */
const STEP = 2;
const SLAB = 1.1;
/** The ledge's top lies this far under the road ribbon. */
const LEDGE_DROP = 0.03;
/** The abutments' tops lie this far under the deck, so the ribbon's worn dips never show them through. */
const ABUTMENT_DROP = 0.25;
/** Piers: this far apart, this thick along the road, and this far into the bed. */
const PIER_EVERY = 18;
const PIER_THICK = 1.3;
const BURY = 1.5;
/** The abutments run this far in from each end of the span. */
const ABUTMENT = 4;
/** Guard rail posts this far apart and this tall; two rails, at these heights over the deck. */
const POST_EVERY = 2.5;
const POST_HALF = 0.07;
const RAIL_HEIGHTS = [0.55, 0.85] as const;
const RAIL_DEPTH = 0.09;

const CONCRETE = new Color('#bdb9b0');
const FASCIA = new Color('#a9a59c');
const SOFFIT = new Color('#7d7a74');
const PIER = new Color('#a6a299');
const RAIL = new Color('#eef0f1');
const POST = new Color('#9ba1a7');

type V3 = [number, number, number];

/** Coloured triangles in one non-indexed geometry. */
class Parts {
  readonly pos: number[] = [];
  readonly col: number[] = [];

  /** A quad a-b-c-d, wound so its front faces the side `a → b → c` turns counter-clockwise on. */
  quad(a: V3, b: V3, c: V3, d: V3, colour: Color): void {
    for (const p of [a, b, c, a, c, d]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(colour.r, colour.g, colour.b);
    }
  }

  /** A box between the two cross-sections `p` (back) and `q` (front): each four corners, bottom-left, bottom-right, top-right, top-left seen from the back. */
  box(p: readonly V3[], q: readonly V3[], colour: Color, top = colour, bottom = colour): void {
    const [p0, p1, p2, p3] = p as [V3, V3, V3, V3];
    const [q0, q1, q2, q3] = q as [V3, V3, V3, V3];
    this.quad(p3, p2, q2, q3, top);
    this.quad(p0, q0, q1, p1, bottom);
    this.quad(p0, p3, q3, q0, colour);
    this.quad(p1, q1, q2, p2, colour);
    this.quad(p0, p1, p2, p3, colour);
    this.quad(q1, q0, q3, q2, colour);
  }
}

export class LakeBridgeBuilder {
  readonly group = new Group();
  private readonly geometry = new BufferGeometry();
  private readonly material: MeshStandardMaterial;

  constructor(stage: StageDef, field: TerrainField, lakes: readonly Lake[]) {
    this.group.name = 'lake-bridges';
    const parts = new Parts();
    const at: RoadSample = { x: 0, z: 0, heading: 0 };
    const s: TerrainSample = { height: 0, roadBlend: 0, roadDistance: 0 };
    const hw = stage.halfWidth;
    const rail = hw + RAIL_OUT;
    const edge = hw + DECK_OUT;
    /** A point `e` metres left of the road at distance `d`, `dy` over the deck. */
    const point = (d: number, e: number, dy: number): V3 => {
      stage.path.sample(d, at);
      const deck = field.roadHeightAt(d) + ROAD_LIFT;
      return [at.x + Math.cos(at.heading) * e, deck + dy, at.z - Math.sin(at.heading) * e];
    };
    /** The lowest ground across the slab at distance `d`. */
    const groundUnder = (d: number) => {
      stage.path.sample(d, at);
      let low = Infinity;
      for (const e of [-edge, 0, edge])
        low = Math.min(
          low,
          field.sample(at.x + Math.cos(at.heading) * e, at.z - Math.sin(at.heading) * e, s).height,
        );
      return low;
    };
    for (const lake of lakes) {
      if (!lake.bridge) continue;
      const { from, to } = lake.bridge;
      // The slab: ledges either side of the ribbon, fascias down its edges, the soffit under it.
      for (let d = from; d < to - 1e-6; d += STEP) {
        const e = Math.min(to, d + STEP);
        for (const side of [1, -1] as const) {
          const inner = side * hw;
          const outer = side * edge;
          const a = point(d, inner, -LEDGE_DROP);
          const b = point(e, inner, -LEDGE_DROP);
          const c = point(e, outer, -LEDGE_DROP);
          const f = point(d, outer, -LEDGE_DROP);
          if (side > 0) parts.quad(a, f, c, b, CONCRETE);
          else parts.quad(a, b, c, f, CONCRETE);
          const lo0 = point(d, outer, -SLAB);
          const lo1 = point(e, outer, -SLAB);
          if (side > 0) parts.quad(f, lo0, lo1, c, FASCIA);
          else parts.quad(f, c, lo1, lo0, FASCIA);
        }
        parts.quad(
          point(d, -edge, -SLAB),
          point(e, -edge, -SLAB),
          point(e, edge, -SLAB),
          point(d, edge, -SLAB),
          SOFFIT,
        );
      }
      // Piers, evenly between the abutments, down into the bed.
      const inner = to - from - 2 * ABUTMENT;
      const piers = Math.max(1, Math.round(inner / PIER_EVERY));
      for (let i = 1; i < piers; i++) {
        const d = from + ABUTMENT + (inner * i) / piers;
        const foot = groundUnder(d) - BURY;
        const cross = (dd: number, y: (e: number) => number): V3[] =>
          [-edge + 0.3, edge - 0.3, edge - 0.3, -edge + 0.3].map((e, j) => {
            const p = point(dd, e, 0);
            return [p[0], j < 2 ? foot : y(e), p[2]] as V3;
          });
        const deckAt = (dd: number) => field.roadHeightAt(dd) + ROAD_LIFT - SLAB;
        parts.box(
          cross(d - PIER_THICK / 2, () => deckAt(d - PIER_THICK / 2)),
          cross(d + PIER_THICK / 2, () => deckAt(d + PIER_THICK / 2)),
          PIER,
        );
      }
      // Abutments at either end, from under the slab down into the bank.
      for (const [d0, d1] of [
        [from, from + ABUTMENT],
        [to - ABUTMENT, to],
      ] as const) {
        const foot = Math.min(groundUnder(d0), groundUnder(d1)) - BURY;
        const cross = (dd: number): V3[] =>
          [-edge, edge, edge, -edge].map((e, j) => {
            const p = point(dd, e, -ABUTMENT_DROP);
            return [p[0], j < 2 ? foot : p[1], p[2]] as V3;
          });
        parts.box(cross(d0), cross(d1), FASCIA, CONCRETE);
      }
      // Guard rails: posts, and two rails along both edges.
      for (const side of [1, -1] as const) {
        const e = side * rail;
        for (let d = from; d <= to + 1e-6; d += POST_EVERY) {
          const corners = (dd: number, h: number): V3[] =>
            [e - POST_HALF, e + POST_HALF, e + POST_HALF, e - POST_HALF].map((x, j) =>
              point(dd, x, j < 2 ? -LEDGE_DROP : h),
            );
          parts.box(corners(d - POST_HALF, 1), corners(d + POST_HALF, 1), POST);
        }
        for (const h of RAIL_HEIGHTS) {
          for (let d = from; d < to - 1e-6; d += STEP) {
            const f = Math.min(to, d + STEP);
            const corners = (dd: number): V3[] => [
              point(dd, e - RAIL_HALF, h - RAIL_DEPTH),
              point(dd, e + RAIL_HALF, h - RAIL_DEPTH),
              point(dd, e + RAIL_HALF, h + RAIL_DEPTH),
              point(dd, e - RAIL_HALF, h + RAIL_DEPTH),
            ];
            parts.box(corners(d), corners(f), RAIL);
          }
        }
      }
    }
    this.geometry.setAttribute('position', new BufferAttribute(Float32Array.from(parts.pos), 3));
    this.geometry.setAttribute('color', new BufferAttribute(Float32Array.from(parts.col), 3));
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.85,
      // Flat shading lights each face by its screen-space normal, so both sides read right whichever way it is wound.
      side: DoubleSide,
    });
    const mesh = new Mesh(this.geometry, this.material);
    // It casts its shadow on the lake but takes none: two-sided faces would shade themselves in stripes.
    mesh.castShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
