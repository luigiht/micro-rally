import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import type { WallPoint } from '@/game/stage/Coastline';
import { createRoadHit, type RoadSample } from '@/game/stage/RoadPath';
import { bridgeSpan, PARAPET_HALF, PARAPET_OUT, type River } from '@/game/stage/Rivers';
import type { StageDef } from '@/game/stage/StageGenerator';
import { ROAD_LIFT, type TerrainField, type TerrainSample } from '@/game/stage/TerrainField';
import { merge } from '../scenery/HouseGeometry';
import type { WallTheme } from '../theme/WorldTheme';
import { stoneWallParts } from './StoneWallGeometry';

/**
 * A stone arch bridge wherever the road crosses a frozen river (`Rivers`):
 * dry-stone parapets along both edges (the coast's walls, `StoneWallGeometry`,
 * set on the deck), and the bridge's masonry body under the road ribbon out
 * to the parapets' outer faces: its faces laid in courses of blocks, each a
 * shade its own, a ring of paler voussoirs round the arch, the arch itself
 * springing from the banks just over the ice and rising to just under the
 * deck, and solid abutments either side going down into the banks. One
 * merged mesh in vertex colours; the colliders are the parapets'
 * (`bridgeObstacles`).
 */

/** The body is drawn every this many metres along the road, its courses this tall. */
const STEP = 1;
const COURSE = 0.7;
/** The arch springs this far over the ice, its crown this far under the deck, its ring of voussoirs this deep. */
const SPRING = 0.35;
const CROWN = 0.85;
const RING = 0.6;
/** The arch spans the ice and this much of each bank; the abutments go this far into the ground. */
const ARCH_PAST = 1.5;
const BURY = 1;
/** The deck's ledge between the road's edge and the parapet lies this far under the road ribbon. */
const LEDGE = 0.02;
const JITTER = 0.07;

function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type V3 = [number, number, number];

/** Coloured triangles in one non-indexed geometry. */
class Masonry {
  readonly pos: number[] = [];
  readonly col: number[] = [];

  quad(a: V3, b: V3, c: V3, d: V3, colour: Color): void {
    this.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) this.col.push(colour.r, colour.g, colour.b);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    g.setAttribute('color', new BufferAttribute(Float32Array.from(this.col), 3));
    g.computeVertexNormals();
    return g;
  }
}

/** One cross-section of a bridge: where it is, which way is left, the deck and the underside there. */
interface Station {
  d: number;
  x: number;
  z: number;
  lx: number;
  lz: number;
  deck: number;
  bottom: number;
  /** How far the underside lies inside the voussoir ring (≤ RING: a voussoir). */
  arch: boolean;
}

export class StoneBridgeBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry | null;
  private readonly material: MeshStandardMaterial;

  constructor(stage: StageDef, field: TerrainField, theme: WallTheme) {
    this.group.name = 'stone-bridges';
    const parts: BufferGeometry[] = [];
    const body = new Color(theme.body);
    const pale = new Color(theme.cap);
    const hit = createRoadHit();
    // The parapets stand on the deck, wherever along the bridge their stones fall.
    const deck = {
      heightAt: (x: number, z: number) => deckAt(x, z),
      deckAt: (x: number, z: number) => deckAt(x, z),
    };
    const deckAt = (x: number, z: number) =>
      stage.path.nearest(x, z, stage.halfWidth + 4, hit)
        ? field.roadHeightAt(hit.along) + ROAD_LIFT
        : field.heightAt(x, z);
    const off = stage.halfWidth + PARAPET_OUT;
    const sample: RoadSample = { x: 0, z: 0, heading: 0 };
    field.rivers.forEach((river, ri) => {
      const span = bridgeSpan(river);
      for (const side of [1, -1] as const) {
        const line = (along: number, out: WallPoint) => {
          stage.path.sample(along, sample);
          out.x = sample.x + Math.cos(sample.heading) * off * side;
          out.z = sample.z - Math.sin(sample.heading) * off * side;
          out.heading = sample.heading;
          return out;
        };
        stoneWallParts({ ...span, side }, line, deck, theme, stage.seed + ri, parts);
      }
      parts.push(bridgeBody(stage, field, river, body, pale));
    });
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.95,
    });
    // The wall stones carry UVs and the masonry none: the material needs neither, so drop them to merge.
    for (const g of parts) g.deleteAttribute('uv');
    this.geometry = parts.length > 0 ? merge(parts) : null;
    if (this.geometry) {
      const mesh = new Mesh(this.geometry, this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
  }

  dispose(): void {
    this.geometry?.dispose();
    this.material.dispose();
  }
}

/** The masonry under the deck: faces either side, the underside (arch and abutment feet), the ledges by the road. */
function bridgeBody(
  stage: StageDef,
  field: TerrainField,
  river: River,
  body: Color,
  pale: Color,
): BufferGeometry {
  const m = new Masonry();
  const span = bridgeSpan(river);
  const outer = stage.halfWidth + PARAPET_OUT + PARAPET_HALF;
  const ice = river.points[river.crossing.index]!.level;
  const centre = river.crossing.along;
  const half = river.halfWidth + ARCH_PAST;
  const crownDeck = field.roadHeightAt(centre) + ROAD_LIFT;
  const spring = ice + SPRING;
  const crown = crownDeck - CROWN;
  const s: TerrainSample = { height: 0, roadBlend: 0, roadDistance: 0 };
  const at: RoadSample = { x: 0, z: 0, heading: 0 };
  const stations: Station[] = [];
  for (let d = span.from; d <= span.to + 1e-6; d += STEP) {
    stage.path.sample(d, at);
    const lx = Math.cos(at.heading);
    const lz = -Math.sin(at.heading);
    const deck = field.roadHeightAt(d) + ROAD_LIFT;
    const u = (d - centre) / half;
    let bottom: number;
    let arch = false;
    if (Math.abs(u) < 1) {
      bottom = spring + (crown - spring) * Math.sqrt(1 - u * u);
      arch = true;
    } else {
      // The abutment: down into whichever ground under it lies lowest.
      let ground = Infinity;
      for (const e of [-outer, 0, outer])
        ground = Math.min(ground, field.sample(at.x + lx * e, at.z + lz * e, s).height);
      bottom = Math.min(deck - 0.4, ground - BURY);
    }
    stations.push({ d, x: at.x, z: at.z, lx, lz, deck, bottom, arch });
  }
  const tone = new Color();
  const stone = (k: number, row: number, side: number, ring: boolean) =>
    tone.copy(ring ? pale : body).multiplyScalar(1 + (hash01(k, row, side + 3) - 0.5) * 2 * JITTER);
  for (let k = 0; k + 1 < stations.length; k++) {
    const p = stations[k]!;
    const q = stations[k + 1]!;
    for (const side of [1, -1]) {
      const e = outer * side;
      const pt = (st: Station, y: number): V3 => [st.x + st.lx * e, y, st.z + st.lz * e];
      // The face in courses from the underside up to the deck; the course over the arch is its ring.
      const low = Math.min(p.bottom, q.bottom);
      const top = Math.max(p.deck, q.deck);
      for (let row = Math.floor(low / COURSE); row * COURSE < top; row++) {
        const y0 = row * COURSE;
        const y1 = y0 + COURSE;
        const pb = Math.min(Math.max(y0, p.bottom), p.deck);
        const qb = Math.min(Math.max(y0, q.bottom), q.deck);
        const pu = Math.min(Math.max(y1, p.bottom), p.deck);
        const qu = Math.min(Math.max(y1, q.bottom), q.deck);
        if (pu - pb < 1e-3 && qu - qb < 1e-3) continue;
        const ring = (p.arch || q.arch) && y0 < Math.max(p.bottom, q.bottom) + RING;
        const c = stone(k, row, side, ring);
        // Wound to face outward on either side.
        if (side > 0) m.quad(pt(p, pb), pt(p, pu), pt(q, qu), pt(q, qb), c);
        else m.quad(pt(p, pb), pt(q, qb), pt(q, qu), pt(p, pu), c);
      }
      // The ledge between the road ribbon's edge and the parapet.
      const inner = stage.halfWidth * side;
      const lp = (st: Station, lat: number): V3 => [
        st.x + st.lx * lat,
        st.deck - LEDGE,
        st.z + st.lz * lat,
      ];
      const ledge = stone(k, 99, side, true);
      if (side > 0) m.quad(lp(p, inner), lp(q, inner), lp(q, e), lp(p, e), ledge);
      else m.quad(lp(p, inner), lp(p, e), lp(q, e), lp(q, inner), ledge);
    }
    // The underside: the arch's soffit over the ice and the abutments' feet, facing down.
    const under = (st: Station, lat: number): V3 => [
      st.x + st.lx * lat,
      st.bottom,
      st.z + st.lz * lat,
    ];
    m.quad(
      under(p, -outer),
      under(p, outer),
      under(q, outer),
      under(q, -outer),
      stone(k, -1, 0, p.arch),
    );
  }
  return m.build();
}
