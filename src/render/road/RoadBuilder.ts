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
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StageDef } from '@/game/stage/StageGenerator';
import { markerDistances } from '@/game/stage/RoadMarkers';
import { ROAD_LIFT, TRENCH_OUT, type TerrainField } from '@/game/stage/TerrainField';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { KERB_LIFT, townFade } from '@/game/stage/Town';
import { routeOpenings, type Openings } from '@/game/stage/TownKerbs';
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
/** The edge line stands this far above the carriageway it is painted on. */
export const LINE_ABOVE_DECK = 0.02;
export const LINE_LIFT = ROAD_LIFT + LINE_ABOVE_DECK;
const LINE_WIDTH = 0.22;
/** Through a town the verges become pavements: pale concrete standing a kerb's height above the road. */
export const PAVEMENT_COLOR = '#a6a39b';
/** The kerb's vertical face, a shade darker than the pavement it carries. */
export const KERB_COLOR = '#8d8a82';

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

/** One cross-section of the ribbon: where it is, which way is left, how wide, how high, and its tarmac shade. */
interface Station {
  d: number;
  /** Sample index the shade and snow cover are drawn from. */
  k: number;
  x: number;
  z: number;
  lx: number;
  lz: number;
  hw: number;
  y: number;
  shade: number;
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
  /** Which verge this strip lies on (+1 left, -1 right); such strips stop across junction openings. */
  side?: number;
  /** A vertical kerb face, only in town: a positive rise lifts the `b` edge by this much, a negative one the `a` edge. */
  rise?: number;
}

/** Ribbon road split into pieces for frustum culling, plus verges, edge lines and marker posts. */
export class RoadBuilder {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly instanced: InstancedMesh[] = [];
  private readonly verge: Color;
  private readonly scratch = { x: 0, z: 0, heading: 0 };

  /** `shoulder` is the region palette's verge colour, so the strips match the terrain beside them. */
  constructor(stage: StageDef, field: TerrainField, shoulder: string) {
    this.group.name = 'road';
    this.verge = new Color(shoulder);
    const openings: Openings = stage.town
      ? routeOpenings(stage.town, stage)
      : { left: [], right: [] };
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
      const geo = this.buildPiece(stage, field, s0, s1, openings);
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

  private buildPiece(
    stage: StageDef,
    field: TerrainField,
    s0: number,
    s1: number,
    openings: Openings,
  ): BufferGeometry {
    const path = stage.path;
    const sp = path.spacing;
    const snowy = stage.surface === 'snow';
    const road = new Color(snowy ? ROAD_COLORS.tarmac : ROAD_COLORS[stage.surface]);
    const dust = new Color(ROAD_COLORS.snow);
    const tint = new Color();
    const line = new Color(LINE_COLOR);
    const paved = { color: new Color(ROAD_COLORS.tarmac), lift: ROAD_LIFT };
    const pavement = { color: new Color(PAVEMENT_COLOR), lift: ROAD_LIFT + KERB_LIFT };
    const kerb = new Color(KERB_COLOR);
    const town = stage.town;
    // A station is a cross-section of the ribbon: every sample, plus the exact ends of each
    // junction opening, where the verge and edge line stop and the junction surface takes over.
    const stationAt = (d: number, i: number | null): Station => {
      let x: number;
      let z: number;
      let heading: number;
      if (i !== null) {
        x = path.xs[i]!;
        z = path.zs[i]!;
        heading = path.headings[i]!;
      } else {
        path.sample(d, this.scratch);
        x = this.scratch.x;
        z = this.scratch.z;
        heading = this.scratch.heading;
      }
      const k = i ?? Math.floor(d / sp);
      return {
        d,
        k,
        x,
        z,
        lx: Math.cos(heading),
        lz: -Math.sin(heading),
        hw: halfWidthAt(stage, d),
        y: field.roadHeightAt(d),
        shade: 0.96 + hash01(k) * 0.08,
      };
    };
    const base: Station[] = [];
    for (let i = s0; i <= s1; i++) base.push(stationAt(i * sp, i));
    const stationsFor = (side: number | undefined): Station[] => {
      if (side === undefined) return base;
      const cuts = (side > 0 ? openings.left : openings.right)
        .flatMap((o) => [o.from, o.to])
        .filter((d) => d > s0 * sp + 1e-6 && d < s1 * sp - 1e-6);
      if (cuts.length === 0) return base;
      return [...base, ...cuts.map((d) => stationAt(d, null))].sort((p, q) => p.d - q.d);
    };
    const open = (side: number, d: number) =>
      (side > 0 ? openings.left : openings.right).some((o) => d > o.from && d < o.to);
    // Road, two verges and two edge lines; lateral extents follow the local half width.
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
      // Kerb faces in town, each wound with its raised edge placed so the face looks at the carriageway.
      {
        a: (hw) => hw,
        b: (hw) => hw,
        lift: ROAD_LIFT,
        color: kerb,
        shaded: false,
        town: { color: kerb, lift: ROAD_LIFT },
        side: 1,
        rise: KERB_LIFT,
      },
      {
        a: (hw) => -hw,
        b: (hw) => -hw,
        lift: ROAD_LIFT,
        color: kerb,
        shaded: false,
        town: { color: kerb, lift: ROAD_LIFT },
        side: -1,
        rise: -KERB_LIFT,
      },
    ];
    const pos: number[] = [];
    const col: number[] = [];
    const index: number[] = [];
    // Into and out of a town the ribbon eases over TOWN_FADE: the surface colour toward tarmac, the
    // verges up into pavements, the kerb faces growing with them.
    const vertex = (st: Station, e: number, strip: Strip, raise = 0) => {
      const t = strip.town !== undefined && town !== undefined ? townFade(town, st.d) : 0;
      const y = st.y + strip.lift + (t > 0 ? (strip.town!.lift - strip.lift) * t : 0) + raise * t;
      const shade = strip.shaded ? st.shade : 1;
      const c = strip.cover
        ? tint.copy(strip.color).lerp(dust, strip.cover(st.k) * (1 - t))
        : tint.copy(strip.color);
      if (t > 0) c.lerp(strip.town!.color, t);
      pos.push(st.x + st.lx * e, y, st.z + st.lz * e);
      col.push(c.r * shade, c.g * shade, c.b * shade);
    };
    for (const strip of strips) {
      const stations = stationsFor(strip.side);
      for (let k = 0; k + 1 < stations.length; k++) {
        const p = stations[k]!;
        const q = stations[k + 1]!;
        if (strip.side !== undefined && open(strip.side, (p.d + q.d) / 2)) continue;
        const mid = (p.d + q.d) / 2;
        if (strip.rise !== undefined && (!town || townFade(town, mid) < 0.02)) continue;
        const base = pos.length / 3;
        // a is the right-hand edge; wind counter-clockwise seen from above. A kerb face raises one edge instead.
        const ra = strip.rise !== undefined && strip.rise < 0 ? -strip.rise : 0;
        const rb = strip.rise !== undefined && strip.rise > 0 ? strip.rise : 0;
        vertex(p, strip.a(p.hw), strip, ra);
        vertex(p, strip.b(p.hw), strip, rb);
        vertex(q, strip.a(q.hw), strip, ra);
        vertex(q, strip.b(q.hw), strip, rb);
        index.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
      }
    }
    const raw = new BufferGeometry();
    raw.setAttribute('position', new BufferAttribute(Float32Array.from(pos), 3));
    raw.setAttribute('color', new BufferAttribute(Float32Array.from(col), 3));
    raw.setIndex(index);
    // Quads are laid one by one; weld them so the normals smooth along the ribbon instead of faceting it.
    const geo = mergeVertices(raw, 1e-4);
    raw.dispose();
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
