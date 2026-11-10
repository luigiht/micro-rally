import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RoadWidthSource } from '@/game/stage/RoadWidth';
import { ringOuterRadius, ringPoint, type Roundabout } from '@/game/stage/Roundabout';
import { KERB_LIFT, PAVEMENT_WIDTH, type GroundQuery, type TownDef } from '@/game/stage/Town';
import { LINE_ABOVE_DECK } from '../road/RoadBuilder';
import { themeColor } from '../theme/themeColor';
import type { RoadTheme } from '../theme/WorldTheme';
import { roundaboutSurface, type Band } from './RoundaboutSurface';

/** The ring's tarmac disc is laid in facets of about this length. */
const FACET = 1.5;
/** The ring's tarmac lies this far under the deck: the ribbon drives over the part the route takes. */
const RING_BELOW_DECK = 0.004;
/**
 * The fillets lie a hair over the deck: the ground beside a carriageway sits
 * at deck level (only under the carriageway is it trenched), so anything at
 * or under the deck there is hidden by the terrain and shows its colour.
 */
const FILLET_ABOVE_DECK = 0.004;
/** Pavements lie a hair under the ribbon's and the side streets' pavements, which they meet edge to edge. */
const PAVEMENT_BELOW = 0.003;
/** The edge lines lie a hair over the roads' own lines, which they overlap at the hand-offs. */
const LINE_ABOVE = 0.004;

/**
 * A city's roundabouts: the ring's tarmac as a full annulus under the
 * ribbon, the island's grass top, and from one distance field of the
 * carriageways (`RoundaboutSurface`) the tarmac fillets at every road's
 * mouth, every pavement with its kerb faces, and the white edge lines, all
 * running from each road onto the ring in one piece. All on the deck the
 * field reports. One merged mesh per theme.
 */
export class RoundaboutBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: MeshStandardMaterial;
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly idx: number[] = [];

  constructor(
    town: TownDef,
    stage: RoadWidthSource,
    private readonly field: GroundQuery,
    road: RoadTheme,
    grass: string,
  ) {
    this.group.name = 'roundabouts';
    const tarmac = new Color(road.surface ?? road.surfaces.tarmac);
    const pavement = new Color(road.pavement);
    const line = themeColor(road.line);
    const kerb = themeColor(road.kerb);
    const green = new Color(grass);
    for (const r of town.roundabouts ?? []) {
      const inner = r.islandRadius;
      const outer = ringOuterRadius(r);
      this.disc(r, inner - 0.2, outer + 0.2, -RING_BELOW_DECK, tarmac);
      this.disc(r, 0, inner - PAVEMENT_WIDTH + 0.05, KERB_LIFT + 0.002, green);
      const exits = town.streets.filter(
        (s) => !s.route && Math.abs(Math.hypot(s.x0 - r.x, s.z0 - r.z) - outer) < 0.05,
      );
      const surface = roundaboutSurface(r, stage, exits);
      for (const b of surface.fillets) this.flat(b, FILLET_ABOVE_DECK, tarmac);
      for (const b of surface.pavements) {
        this.flat(b, KERB_LIFT - PAVEMENT_BELOW, pavement);
        this.faces(b.a, b.n, 1, kerb);
        this.faces(b.b, b.n, -1, kerb);
      }
      for (const b of surface.lines) this.flat(b, LINE_ABOVE_DECK + LINE_ABOVE, line);
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
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new Mesh(this.geometry, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  private lifted(p: readonly [number, number], lift: number): [number, number, number] {
    return [p[0], this.field.deckAt(p[0], p[1]) + lift, p[1]];
  }

  /** A band laid flat on the deck plus `lift`. */
  private flat(b: Band, lift: number, c: Color): void {
    for (let i = 0; i + 1 < b.a.length; i++)
      this.quad(
        [
          this.lifted(b.a[i]!, lift),
          this.lifted(b.b[i]!, lift),
          this.lifted(b.a[i + 1]!, lift),
          this.lifted(b.b[i + 1]!, lift),
        ],
        [0, 1, 0],
        c,
      );
  }

  /** Kerb faces along a band's edge, `KERB_LIFT` high, facing `sign` times the band's direction `n` (toward `a`). */
  private faces(
    edge: readonly [number, number][],
    n: readonly [number, number][],
    sign: 1 | -1,
    c: Color,
  ): void {
    for (let i = 0; i + 1 < edge.length; i++) {
      const p = edge[i]!;
      const q = edge[i + 1]!;
      const [nx, nz] = n[i]!;
      this.quad(
        [
          this.lifted(p, 0),
          this.lifted(p, KERB_LIFT),
          this.lifted(q, 0),
          this.lifted(q, KERB_LIFT),
        ],
        [sign * nx, 0, sign * nz],
        c,
      );
    }
  }

  private vertex(x: number, y: number, z: number, c: Color): void {
    this.pos.push(x, y, z);
    this.col.push(c.r, c.g, c.b);
  }

  /** A triangle wound so its normal has a positive dot with `want`. */
  private tri(
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
    want: readonly [number, number, number],
    color: Color,
  ): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    // Normal of the winding a, b, c is u × v.
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const dot = nx * want[0] + ny * want[1] + nz * want[2];
    const base = this.pos.length / 3;
    for (const [x, y, z] of dot >= 0 ? [a, b, c] : [a, c, b]) this.vertex(x, y, z, color);
    this.idx.push(base, base + 1, base + 2);
  }

  /**
   * A quad from four corners (two along one edge, then the two across from
   * them) as two triangles, each wound on its own to face `want`, so a
   * twisted quad (where a band's edges cross) never leaves a culled hole.
   */
  private quad(
    p: readonly (readonly [number, number, number])[],
    want: readonly [number, number, number],
    c: Color,
  ): void {
    this.tri(p[0]!, p[1]!, p[2]!, want, c);
    this.tri(p[2]!, p[1]!, p[3]!, want, c);
  }

  /** A flat disc or annulus round the centre between two radii, `lift` over the deck. */
  private disc(r: Roundabout, r0: number, r1: number, lift: number, c: Color): void {
    const steps = Math.max(12, Math.ceil((Math.PI * 2 * Math.max(r1, 1)) / FACET));
    const at = (ang: number, rad: number): [number, number, number] => {
      const p = ringPoint(r, ang, rad);
      return [p.x, this.field.deckAt(p.x, p.z) + lift, p.z];
    };
    for (let k = 0; k < steps; k++) {
      const a = (Math.PI * 2 * k) / steps;
      const b = (Math.PI * 2 * (k + 1)) / steps;
      this.quad([at(a, r0), at(a, r1), at(b, r0), at(b, r1)], [0, 1, 0], c);
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
