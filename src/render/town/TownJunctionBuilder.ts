import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StageDef } from '@/game/stage/StageGenerator';
import { KERB_LIFT, PAVEMENT_WIDTH, type GroundQuery } from '@/game/stage/Town';
import {
  junctionKerbs,
  type JunctionSurface,
  type KerbPoint,
  type Pt,
} from '@/game/stage/TownKerbs';
import { LINE_ABOVE_DECK } from '../road/RoadBuilder';
import { cellTone, SLAB_JITTER, SLAB_ROWS } from '../road/SurfaceDetail';
import { themeColor } from '../theme/themeColor';
import type { RoadTheme } from '../theme/WorldTheme';

/** The pavement starts this far over the tarmac so no seam shows along the kerb. */
/** Round a corner, slabs take their tone from this world grid (the kerb's pieces are shorter than a slab). */
const SLAB_CELL = 2;
const PAVEMENT_OVERLAP = 0.05;
/** Mouth strips are laid in pieces this long along the arm, so they follow the deck. */
const MOUTH_STEP = 2;
const LINE_INSET = 0.35;
const LINE_WIDTH = 0.22;

type Layer = { pos: number[]; col: number[] };

/**
 * The paved ground of every junction. Kerbs come from `junctionKerbs`: one
 * outline per wedge between arms, from a side street's cut round its kerb
 * return and along the route's edge to where the ribbon resumes, each with
 * exact normals, so the pavement band and the white edge line are offset
 * strips that meet the ribbon's and the side-street plates' own sections
 * vertex for vertex. Tarmac fills the mouths and kerb-return crescents from
 * the same geometry, flush with the ribbon. Two merged meshes: the tarmac
 * fill, and the pavements, kerbs and lines dressed over it.
 */
export class TownJunctionBuilder {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshStandardMaterial[] = [];
  /** The tarmac fill, and the dressing over it: pavements, kerb faces and the white edge line. */
  private readonly fill: Layer = { pos: [], col: [] };
  private readonly dressing: Layer = { pos: [], col: [] };
  private readonly tarmac: Color;
  private readonly pavement: Color;
  private readonly line: Color;
  private readonly kerb: Color;

  constructor(
    private readonly stage: StageDef,
    private readonly field: GroundQuery,
    road: RoadTheme,
  ) {
    this.group.name = 'town-junctions';
    this.tarmac = new Color(road.surface ?? road.surfaces.tarmac);
    this.pavement = new Color(road.pavement);
    this.line = themeColor(road.line);
    this.kerb = themeColor(road.kerb);
    for (const j of stage.town?.junctions ?? []) {
      const kerbs = junctionKerbs(j, stage, stage.halfWidth);
      for (const o of kerbs.outlines) {
        // A city's pavement round the corner in two rows of slabs, each a touch lighter or darker.
        if (stage.town?.city) {
          const row = PAVEMENT_WIDTH / SLAB_ROWS;
          for (let r = 0; r < SLAB_ROWS; r++)
            this.strip(
              o.points,
              r === 0 ? -PAVEMENT_OVERLAP : row * r,
              row * (r + 1),
              KERB_LIFT,
              this.pavement,
              (x, z) =>
                cellTone(
                  Math.floor(x / SLAB_CELL),
                  Math.floor(z / SLAB_CELL),
                  401 + r,
                  SLAB_JITTER,
                ),
            );
        } else this.strip(o.points, -PAVEMENT_OVERLAP, PAVEMENT_WIDTH, KERB_LIFT, this.pavement);
        this.strip(o.points, -LINE_INSET - LINE_WIDTH, -LINE_INSET, LINE_ABOVE_DECK, this.line);
        this.face(o.points);
      }
      this.fillSurface(kerbs.surface);
    }
    // The fill a step behind the ribbon, which wins where a boxed junction's paving lies under its
    // arc; the dressing level with it, so the edge line's 2 cm over the deck always tells, as the
    // ribbon's own edge lines do. Both offset toward the eye, so they win depth ties with the terrain.
    this.build(this.fill, -1);
    this.build(this.dressing, -2);
  }

  /** One merged mesh of a layer, drawn with depth offset `offset`. */
  private build(layer: Layer, offset: number): void {
    const raw = new BufferGeometry();
    raw.setAttribute('position', new BufferAttribute(Float32Array.from(layer.pos), 3));
    raw.setAttribute('color', new BufferAttribute(Float32Array.from(layer.col), 3));
    // Weld the fans and strips so the normals smooth across their seams instead of faceting the tarmac.
    const geometry = mergeVertices(raw, 1e-3);
    raw.dispose();
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.75,
      polygonOffset: true,
      polygonOffsetFactor: offset,
      polygonOffsetUnits: offset,
    });
    this.geometries.push(geometry);
    this.materials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  /** Band between offsets `o0` and `o1` along the kerb normals, each vertex on the ground there plus `lift`. */
  private strip(
    points: KerbPoint[],
    o0: number,
    o1: number,
    lift: number,
    c: Color,
    tone?: (x: number, z: number) => number,
  ): void {
    const shaded = new Color();
    const at = (p: KerbPoint, o: number) =>
      this.field.deckAt(p.x + p.nx * o, p.z + p.nz * o) + lift;
    for (let i = 0; i + 1 < points.length; i++) {
      const p = points[i]!;
      const q = points[i + 1]!;
      const tx = q.x - p.x;
      const tz = q.z - p.z;
      if (tx * tx + tz * tz < 1e-8) continue;
      // Wind counter-clockwise seen from above: the further-left offset comes last.
      const leftward = p.nx * tz - p.nz * tx > 0;
      const [a0, a1] = leftward ? [o0, o1] : [o1, o0];
      const corners = [
        [p, a0, at(p, a0)],
        [q, a0, at(q, a0)],
        [q, a1, at(q, a1)],
        [p, a1, at(p, a1)],
      ] as const;
      const piece = tone
        ? shaded.copy(c).multiplyScalar(tone((p.x + q.x) / 2, (p.z + q.z) / 2))
        : c;
      // Two triangles, vertices pushed in order: the geometry is non-indexed.
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const [v, o, y] = corners[k]!;
        this.dressing.pos.push(v.x + v.nx * o, y, v.z + v.nz * o);
        this.dressing.col.push(piece.r, piece.g, piece.b);
      }
    }
  }

  /**
   * Tarmac beyond the ribbon: each blocked arm's mouth as a strip of quads
   * (so it follows the deck) and a fan over each kerb return's crescent,
   * from the same geometry as the kerbs, flush with the ribbon and plates.
   */
  private fillSurface(surface: JunctionSurface): void {
    for (const poly of surface.polygons) {
      if (poly.length === 4) this.mouth(poly);
      else this.fan(poly);
    }
  }

  /** The mouth quad [back-left, back-right, cut-right, cut-left] in pieces along the arm. */
  private mouth(q: Pt[]): void {
    const [bl, br, cr, cl] = q as [Pt, Pt, Pt, Pt];
    const len = Math.max(
      Math.hypot(cl.x - bl.x, cl.z - bl.z),
      Math.hypot(cr.x - br.x, cr.z - br.z),
    );
    const n = Math.max(1, Math.ceil(len / MOUTH_STEP));
    const lerp = (a: Pt, b: Pt, t: number): Pt => ({
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
    });
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      this.fan([lerp(bl, cl, t0), lerp(br, cr, t0), lerp(br, cr, t1), lerp(bl, cl, t1)]);
    }
  }

  /** The kerb's vertical face along the outline, facing the carriageway. */
  private face(points: KerbPoint[]): void {
    for (let i = 0; i + 1 < points.length; i++) {
      const p = points[i]!;
      const q = points[i + 1]!;
      const tx = q.x - p.x;
      const tz = q.z - p.z;
      if (tx * tx + tz * tz < 1e-8) continue;
      const yp = this.field.deckAt(p.x, p.z);
      const yq = this.field.deckAt(q.x, q.z);
      // With the pavement on the left of travel the face must look right, toward the road.
      const leftward = p.nx * tz - p.nz * tx > 0;
      const low = [
        [p.x, yp, p.z],
        [q.x, yq, q.z],
      ] as const;
      const high = [
        [p.x, yp + KERB_LIFT, p.z],
        [q.x, yq + KERB_LIFT, q.z],
      ] as const;
      const quad = leftward
        ? [low[0], low[1], high[1], high[0]]
        : [high[0], high[1], low[1], low[0]];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const v = quad[k]!;
        this.dressing.pos.push(v[0], v[1], v[2]);
        this.dressing.col.push(this.kerb.r, this.kerb.g, this.kerb.b);
      }
    }
  }

  /** Fan-triangulate a polygon that is star-shaped from its first vertex, counter-clockwise seen from above. */
  private fan(poly: Pt[]): void {
    if (poly.length < 3) return;
    let area = 0;
    for (let i = 0, k = poly.length - 1; i < poly.length; k = i++)
      area += poly[k]!.x * poly[i]!.z - poly[i]!.x * poly[k]!.z;
    // Positive shoelace area in (x, z) is clockwise seen from above (y up): reverse it.
    const pts = area > 0 ? [...poly].reverse() : poly;
    const ys = pts.map((v) => this.field.deckAt(v.x, v.z));
    const c = this.tarmac;
    for (let i = 1; i + 1 < pts.length; i++) {
      for (const k of [0, i, i + 1]) {
        const v = pts[k]!;
        this.fill.pos.push(v.x, ys[k]!, v.z);
        this.fill.col.push(c.r, c.g, c.b);
      }
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
