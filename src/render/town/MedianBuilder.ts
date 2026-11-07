import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MEDIAN_HALF, MEDIAN_WALK, type Median } from '@/game/stage/Median';
import { KERB_LIFT, type GroundQuery } from '@/game/stage/Town';
import { patchNeon } from '../theme/NeonMaterial';
import { themeColor } from '../theme/themeColor';
import type { RoadTheme } from '../theme/WorldTheme';

/** Pieces this long along the divider, so it follows the deck. */
const STEP = 4;
/** The grass sits a hair under the sidewalk strips so the two never share a plane along their edge. */
const GRASS_BELOW = 0.004;
/** Facets round each rounded end. */
const CAP_STEPS = 8;

/**
 * A city boulevard's green dividers: a kerb-high strip down the middle of
 * the carriageway with a narrow sidewalk along each edge, grass between, a
 * kerb face each side and a rounded end (half a disc of grass, sidewalk ring
 * and kerb) at both ends, every vertex on the deck the field reports at its
 * own position. One merged mesh; the kerb the wheels feel is `medianLift`'s.
 */
export class MedianBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: MeshStandardMaterial;
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly idx: number[] = [];

  constructor(
    medians: readonly Median[],
    private readonly field: GroundQuery,
    road: RoadTheme,
    grass: string,
  ) {
    this.group.name = 'medians';
    const pavement = new Color(road.pavement);
    const kerb = themeColor(road.kerb);
    const green = new Color(grass);
    for (const m of medians) {
      const dx = m.x1 - m.x0;
      const dz = m.z1 - m.z0;
      const len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const h = Math.atan2(dx, dz);
      const inner = MEDIAN_HALF - MEDIAN_WALK;
      this.strip(m, h, len, -inner, inner, KERB_LIFT - GRASS_BELOW, green);
      for (const side of [-1, 1] as const) {
        const lo = Math.min(side * inner, side * MEDIAN_HALF);
        this.strip(m, h, len, lo, lo + MEDIAN_WALK, KERB_LIFT, pavement);
        this.face(m, h, len, side * MEDIAN_HALF, side, kerb);
      }
      // Both ends rounded: half a disc of grass inside a sidewalk ring behind a curved kerb.
      this.cap(m, h, 0, -1, inner, green, pavement, kerb);
      this.cap(m, h, len, 1, inner, green, pavement, kerb);
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
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    if (road.neon) patchNeon(this.material);
    const mesh = new Mesh(this.geometry, this.material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  /** A point `along` the divider, `left` across it, on the deck plus `lift`. */
  private corner(m: Median, h: number, along: number, left: number, lift: number) {
    const x = m.x0 + Math.sin(h) * along + Math.cos(h) * left;
    const z = m.z0 + Math.cos(h) * along - Math.sin(h) * left;
    return [x, this.field.deckAt(x, z) + lift, z] as const;
  }

  private quad(corners: readonly (readonly [number, number, number])[], c: Color): void {
    const base = this.pos.length / 3;
    for (const [x, y, z] of corners) {
      this.pos.push(x, y, z);
      this.col.push(c.r, c.g, c.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** A flat strip between `l0` and `l1` across (l0 < l1), in pieces, counter-clockwise from above. */
  private strip(
    m: Median,
    h: number,
    len: number,
    l0: number,
    l1: number,
    lift: number,
    c: Color,
  ): void {
    for (let a = 0; a < len - 1e-6; a += STEP) {
      const b = Math.min(len, a + STEP);
      this.quad(
        [
          this.corner(m, h, a, l0, lift),
          this.corner(m, h, b, l0, lift),
          this.corner(m, h, b, l1, lift),
          this.corner(m, h, a, l1, lift),
        ],
        c,
      );
    }
  }

  /** The kerb's vertical face along one edge, facing out toward that side's carriageway. */
  private face(m: Median, h: number, len: number, l: number, side: 1 | -1, c: Color): void {
    for (let a = 0; a < len - 1e-6; a += STEP) {
      const b = Math.min(len, a + STEP);
      const lowA = this.corner(m, h, a, l, 0);
      const lowB = this.corner(m, h, b, l, 0);
      const highA = this.corner(m, h, a, l, KERB_LIFT);
      const highB = this.corner(m, h, b, l, KERB_LIFT);
      // The left face's quad climbs on its far edge, the right face's on its near edge, so both look outward.
      this.quad(side > 0 ? [lowA, lowB, highB, highA] : [highA, highB, lowB, lowA], c);
    }
  }

  /** A triangle wound to face up. */
  private triUp(
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
    color: Color,
  ): void {
    // y of (b - a) × (c - a): positive when a, b, c run counter-clockwise seen from above.
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const base = this.pos.length / 3;
    for (const [x, y, z] of ny >= 0 ? [a, b, c] : [a, c, b]) {
      this.pos.push(x, y, z);
      this.col.push(color.r, color.g, color.b);
    }
    this.idx.push(base, base + 1, base + 2);
  }

  /** A quad from four corners (two along one edge, then the two across from them), wound so its normal has a positive dot with `want`. */
  private quadFacing(
    p: readonly (readonly [number, number, number])[],
    want: readonly [number, number, number],
    c: Color,
  ): void {
    const [a, b, d] = [p[0]!, p[1]!, p[2]!];
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = d[0] - a[0];
    const vy = d[1] - a[1];
    const vz = d[2] - a[2];
    const nx = vy * uz - vz * uy;
    const ny = vz * ux - vx * uz;
    const nz = vx * uy - vy * ux;
    const dot = nx * want[0] + ny * want[1] + nz * want[2];
    this.quad(dot >= 0 ? [p[0]!, p[2]!, p[3]!, p[1]!] : [p[0]!, p[1]!, p[3]!, p[2]!], c);
  }

  /**
   * The rounded end at `along` (the start with `dir` -1, the end with 1): a
   * half disc of grass of radius `inner`, a sidewalk ring out to
   * `MEDIAN_HALF`, and the kerb face round it, facing away from the divider.
   */
  private cap(
    m: Median,
    h: number,
    along: number,
    dir: 1 | -1,
    inner: number,
    green: Color,
    pavement: Color,
    kerb: Color,
  ): void {
    const cx = m.x0 + Math.sin(h) * along;
    const cz = m.z0 + Math.cos(h) * along;
    // Angles from the divider's heading, sweeping the half turn on the `dir` side.
    const at = (ang: number, radius: number, lift: number): [number, number, number] => {
      const a = h + ang;
      const x = cx + Math.sin(a) * radius;
      const z = cz + Math.cos(a) * radius;
      return [x, this.field.deckAt(x, z) + lift, z];
    };
    const a0 = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    const centre: [number, number, number] = [
      cx,
      this.field.deckAt(cx, cz) + KERB_LIFT - GRASS_BELOW,
      cz,
    ];
    for (let k = 0; k < CAP_STEPS; k++) {
      const a = a0 + (Math.PI * k) / CAP_STEPS;
      const b = a0 + (Math.PI * (k + 1)) / CAP_STEPS;
      this.triUp(
        centre,
        at(a, inner, KERB_LIFT - GRASS_BELOW),
        at(b, inner, KERB_LIFT - GRASS_BELOW),
        green,
      );
      this.quadFacing(
        [
          at(a, inner, KERB_LIFT),
          at(a, MEDIAN_HALF, KERB_LIFT),
          at(b, inner, KERB_LIFT),
          at(b, MEDIAN_HALF, KERB_LIFT),
        ],
        [0, 1, 0],
        pavement,
      );
      const mid = h + (a + b) / 2;
      this.quadFacing(
        [
          at(a, MEDIAN_HALF, 0),
          at(a, MEDIAN_HALF, KERB_LIFT),
          at(b, MEDIAN_HALF, 0),
          at(b, MEDIAN_HALF, KERB_LIFT),
        ],
        [Math.sin(mid), 0, Math.cos(mid)],
        kerb,
      );
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
