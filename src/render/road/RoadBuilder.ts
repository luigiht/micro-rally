import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import type { StageDef } from '@/game/stage/StageGenerator';
import { markerDistances } from '@/game/stage/RoadMarkers';
import { ROAD_LIFT, TRENCH_OUT, type TerrainField } from '@/game/stage/TerrainField';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { FILLET, KERB_LIFT } from '@/game/stage/Town';
import type { Surface } from '@/game/vehicle/surfaces';

export const ROAD_COLORS: Readonly<Record<Surface, string>> = {
  tarmac: '#55565e',
  gravel: '#a98e68',
  mud: '#6b4d33',
  /** Snow stages are asphalt under drifting snow: this is the dusting, blended over tarmac. */
  snow: '#e9eef2',
  grass: '#8fbf6a',
};
/**
 * Snow stages: asphalt with snow lying in patches every ~28 m, the same cover
 * across the full width, so a clear stretch is bare out to the edge lines
 * and a snowy one is even from side to side. The wide threshold band gives
 * each patch a long run-in and run-out rather than a cut.
 */
const PATCH_PERIOD = 14;
/** Noise thresholds where a patch starts and saturates. */
const PATCH_FROM = 0.3;
const PATCH_TO = 0.7;
const SNOW_COVER = 0.45;
export const LINE_COLOR = '#f4f1e8';
/**
 * Terrain-coloured verge strips either side of the ribbon, built from the
 * same samples, so road and verge share their edge vertices and meet flush;
 * the coarse terrain mesh only takes over beyond them, where it is the same
 * colour and any seam is invisible.
 */
const VERGE_WIDTH = 2;
const SAMPLES_PER_PIECE = 100;
export const LINE_LIFT = 0.1;
const LINE_WIDTH = 0.22;
/** Through a town the verges become pavements: pale concrete standing a kerb's height above the road. */
export const PAVEMENT_COLOR = '#a6a39b';

/** Integer mix hash to 0..1; a plain multiply-mod ramps instead of scattering. */
function hash01(k: number): number {
  let h = Math.imul(k ^ 0x9e3779b9, 374761393);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Patch noise 0..1 along the road, smooth between hashed knots. */
function patchNoise(i: number): number {
  const c = i / PATCH_PERIOD;
  const k = Math.floor(c);
  const f = c - k;
  const a = hash01(k);
  return a + (hash01(k + 1) - a) * (f * f * (3 - 2 * f));
}

/** Snow cover at road sample `i`: zero in clear stretches, rising to `SNOW_COVER` inside a patch. */
function snowCover(i: number): number {
  return SNOW_COVER * smoothstep(PATCH_FROM, PATCH_TO, patchNoise(i));
}

/** One ribbon strip: lateral extent, lift, flat colour, optional snow cover and tarmac shade jitter; `town` overrides inside a town. */
interface Strip {
  /** Lateral extents as functions of the local half width. */
  a: (hw: number) => number;
  b: (hw: number) => number;
  lift: number;
  color: Color;
  cover?: (i: number) => number;
  shaded: boolean;
  town?: { color: Color; lift: number };
  /** Which verge this strip lies on (+1 left, -1 right); such strips open up across side-street mouths. */
  side?: number;
}

/** Ribbon road split into pieces for frustum culling, plus verges, edge lines and marker posts. */
export class RoadBuilder {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly instanced: InstancedMesh[] = [];
  private readonly verge: Color;

  /** `shoulder` is the region palette's verge colour, so the strips match the terrain beside them. */
  constructor(stage: StageDef, field: TerrainField, shoulder: string) {
    this.group.name = 'road';
    this.verge = new Color(shoulder);
    if (VERGE_WIDTH <= TRENCH_OUT) throw new Error('verge strip must cover the trench ramp');
    const roadMat = new MeshStandardMaterial({
      vertexColors: true,
      roughness: stage.surface === 'tarmac' ? 0.75 : 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.materials.push(roadMat);
    const path = stage.path;
    for (let s0 = 0; s0 < path.count - 1; s0 += SAMPLES_PER_PIECE) {
      const s1 = Math.min(path.count - 1, s0 + SAMPLES_PER_PIECE);
      const geo = this.buildPiece(stage, field, s0, s1);
      this.geometries.push(geo);
      const mesh = new Mesh(geo, roadMat);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    this.buildMarkers(stage, field);
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const i of this.instanced) i.dispose();
  }

  private buildPiece(stage: StageDef, field: TerrainField, s0: number, s1: number): BufferGeometry {
    const path = stage.path;
    const snowy = stage.surface === 'snow';
    const road = new Color(snowy ? ROAD_COLORS.tarmac : ROAD_COLORS[stage.surface]);
    const dust = new Color(ROAD_COLORS.snow);
    const tint = new Color();
    const line = new Color(LINE_COLOR);
    const paved = { color: new Color(ROAD_COLORS.tarmac), lift: ROAD_LIFT };
    const pavement = { color: new Color(PAVEMENT_COLOR), lift: ROAD_LIFT + KERB_LIFT };
    const town = stage.town;
    // Side streets leave the route here: the kerb drops and the edge line stops across each mouth.
    // A stub starts at the polygon corner, which the route's arc cuts, so the mouth is found by
    // projecting the verge point onto the stub's line rather than by distance to its start.
    const mouths = (town?.streets ?? [])
      .filter((st) => !st.route)
      .map((st) => {
        const len = Math.hypot(st.x1 - st.x0, st.z1 - st.z0) || 1;
        return {
          x: st.x0,
          z: st.z0,
          ux: (st.x1 - st.x0) / len,
          uz: (st.z1 - st.z0) / len,
          hw: st.halfWidth,
        };
      });
    const openOn = (x: number, z: number, lx: number, lz: number, side: number, hw: number) =>
      mouths.some((m) => {
        if (Math.sign(m.ux * lx + m.uz * lz) !== side) return false;
        const rx = x - m.x;
        const rz = z - m.z;
        const along = rx * m.ux + rz * m.uz;
        const across = Math.abs(rx * m.uz - rz * m.ux);
        // The kerb returns reach further along the route's edge the more acutely the street meets it;
        // the junction surface draws the pavement and line around them.
        const skew = Math.abs(m.ux * -lz + m.uz * lx);
        return along > -(hw + 8) && along < 14 && across < m.hw + FILLET * (1 + skew) + 0.6;
      });
    const n = s1 - s0 + 1;
    // Road, two verges and two edge lines, two verts per sample each; lateral extents follow the local half width.
    const strips: Strip[] = [
      {
        a: (hw) => -hw,
        b: (hw) => hw,
        lift: ROAD_LIFT,
        color: road,
        cover: snowy ? snowCover : undefined,
        shaded: true,
        town: paved,
      },
      {
        a: (hw) => hw,
        b: (hw) => hw + VERGE_WIDTH,
        lift: ROAD_LIFT,
        color: this.verge,
        shaded: true,
        town: pavement,
        side: 1,
      },
      {
        a: (hw) => -hw - VERGE_WIDTH,
        b: (hw) => -hw,
        lift: ROAD_LIFT,
        color: this.verge,
        shaded: true,
        town: pavement,
        side: -1,
      },
      {
        a: (hw) => hw - 0.35 - LINE_WIDTH,
        b: (hw) => hw - 0.35,
        lift: LINE_LIFT,
        color: line,
        shaded: false,
        side: 1,
      },
      {
        a: (hw) => -hw + 0.35,
        b: (hw) => -hw + 0.35 + LINE_WIDTH,
        lift: LINE_LIFT,
        color: line,
        shaded: false,
        side: -1,
      },
    ];
    const pos = new Float32Array(n * strips.length * 2 * 3);
    const col = new Float32Array(n * strips.length * 2 * 3);
    const index: number[] = [];
    strips.forEach(({ a, b, lift, color, cover, shaded, town: inTown, side }, strip) => {
      const base = strip * n * 2;
      for (let k = 0; k < n; k++) {
        const i = s0 + k;
        const x = path.xs[i]!;
        const z = path.zs[i]!;
        const h = path.headings[i]!;
        const lx = Math.cos(h);
        const lz = -Math.sin(h);
        const d = i * path.spacing;
        const hw = halfWidthAt(stage, d);
        const urban = inTown !== undefined && town !== undefined && d >= town.from && d <= town.to;
        const mouth =
          side !== undefined &&
          mouths.length > 0 &&
          openOn(x + lx * side * hw, z + lz * side * hw, lx, lz, side, hw);
        const y = field.roadHeightAt(d) + (mouth ? ROAD_LIFT : urban ? inTown.lift : lift);
        const shade = shaded ? 0.96 + hash01(i) * 0.08 : 1;
        const c = mouth
          ? paved.color
          : urban
            ? inTown.color
            : cover
              ? tint.copy(color).lerp(dust, cover(i))
              : color;
        const v = (base + k * 2) * 3;
        const ea = a(hw);
        const eb = b(hw);
        pos.set([x + lx * ea, y, z + lz * ea, x + lx * eb, y, z + lz * eb], v);
        col.set([c.r * shade, c.g * shade, c.b * shade, c.r * shade, c.g * shade, c.b * shade], v);
        if (k > 0) {
          const p = base + (k - 1) * 2;
          const q = base + k * 2;
          // a is the right-hand edge; wind counter-clockwise seen from above.
          index.push(p, q, p + 1, q, q + 1, p + 1);
        }
      }
    });
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  /** Verge posts every 20 m, except where a checkpoint board stands. */
  private buildMarkers(stage: StageDef, field: TerrainField): void {
    const path = stage.path;
    const distances = markerDistances(
      path.length,
      stage.gates,
      stage.town ? [[stage.town.from, stage.town.to]] : [],
    );
    const count = distances.length * 2;
    const postGeo = new BoxGeometry(0.14, 0.9, 0.14).translate(0, 0.45, 0);
    const capGeo = new BoxGeometry(0.16, 0.18, 0.16).translate(0, 0.98, 0);
    this.geometries.push(postGeo, capGeo);
    const postMat = new MeshStandardMaterial({ color: '#f4f1e8', flatShading: true });
    const capMat = new MeshStandardMaterial({ color: '#e8623a', flatShading: true });
    this.materials.push(postMat, capMat);
    const posts = new InstancedMesh(postGeo, postMat, count);
    const caps = new InstancedMesh(capGeo, capMat, count);
    const dummy = new Object3D();
    const sample = { x: 0, z: 0, heading: 0 };
    let n = 0;
    for (const d of distances) {
      path.sample(d, sample);
      for (const side of [-1, 1]) {
        const off = (halfWidthAt(stage, d) + 1.4) * side;
        const x = sample.x + Math.cos(sample.heading) * off;
        const z = sample.z - Math.sin(sample.heading) * off;
        dummy.position.set(x, field.heightAt(x, z), z);
        dummy.rotation.set(0, sample.heading, 0);
        dummy.updateMatrix();
        posts.setMatrixAt(n, dummy.matrix);
        caps.setMatrixAt(n, dummy.matrix);
        n++;
      }
    }
    posts.computeBoundingSphere();
    caps.computeBoundingSphere();
    this.instanced.push(posts, caps);
    this.group.add(posts, caps);
  }
}
