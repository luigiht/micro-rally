import { BufferAttribute, BufferGeometry, CylinderGeometry } from 'three';
import type { PineForm } from '@/game/stage/SceneryScatter';

/**
 * The pine wood's pines, built face by face with a colour per corner: the
 * colours are a ramp the instance's green multiplies, dark where a bough
 * meets the trunk and light, a touch yellow, at its tips, so every tier
 * reads as a rounded mass of needles lit from above. All white-based; the
 * pine material is double-sided, as a blade is a single face.
 */

type V3 = readonly [number, number, number];
type Rgb = readonly [number, number, number];

/** Where a bough meets the trunk: deep and cool. */
const ROOT: Rgb = [0.5, 0.56, 0.52];
/** A bough's tip: bright and a little warm. */
const TIP: Rgb = [1.18, 1.2, 0.88];

function ramp(t: number): Rgb {
  const k = Math.min(1, Math.max(0, t));
  return [
    ROOT[0] + (TIP[0] - ROOT[0]) * k,
    ROOT[1] + (TIP[1] - ROOT[1]) * k,
    ROOT[2] + (TIP[2] - ROOT[2]) * k,
  ];
}

/** Faces with their colours, collected and turned into one flat-shaded geometry. */
class Faces {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];

  tri(a: V3, b: V3, c: V3, ca: Rgb, cb: Rgb, cc: Rgb): void {
    this.pos.push(...a, ...b, ...c);
    this.col.push(...ca, ...cb, ...cc);
  }

  geometry(): BufferGeometry {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    geo.setAttribute('color', new BufferAttribute(Float32Array.from(this.col), 3));
    geo.computeVertexNormals();
    return geo;
  }
}

function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * One umbrella tier: an open cone from its apex on the trunk down to a hem of
 * `points` points, about 45° below, the way the low-poly pine packs build
 * their pines. The hem is irregular: each point's reach varies a little and
 * about a quarter of them hang lower, so no two tiers read alike. Coloured
 * from dark at the apex to light at the hem.
 */
function tier(
  f: Faces,
  apex: V3,
  reach: number,
  drop: number,
  points: number,
  rand: () => number,
  stride: number,
) {
  const turn = rand() * Math.PI * 2;
  const hem: V3[] = [];
  for (let j = 0; j < points; j++) {
    const a = turn + ((j + (rand() - 0.5) * 0.3) / points) * Math.PI * 2;
    const r = reach * (0.93 + rand() * 0.14);
    const sag = rand() < 0.25 ? 0.15 + rand() * 0.15 : rand() * 0.05;
    hem.push([apex[0] + Math.cos(a) * r, apex[1] - drop - sag, apex[2] + Math.sin(a) * r]);
  }
  const cA = ramp(0.08);
  // A stand-in (`stride` 2) skips every other point of the very same hem, so it never changes shape.
  for (let j = 0; j < points; j += stride) {
    const p = hem[j]!;
    const q = hem[(j + stride) % points]!;
    const cp = ramp(p[1] < apex[1] - drop - 0.1 ? 1 : 0.85);
    const cq = ramp(q[1] < apex[1] - drop - 0.1 ? 1 : 0.85);
    f.tri(apex, q, p, cA, cq, cp);
  }
}

/** A tier as built: apex height, reach and drop. */
type Tier = readonly [apex: number, reach: number, drop: number];

/** Stack `tiers` up a trunk, each apex nudged a little off the axis, with `points` hem points each, every `stride`th drawn. */
function stacked(tiers: readonly Tier[], points: number, seed: number, stride = 1): BufferGeometry {
  const rand = stream(seed);
  const f = new Faces();
  for (const [y, reach, drop] of tiers)
    tier(f, [(rand() - 0.5) * 0.2, y, (rand() - 0.5) * 0.2], reach, drop, points, rand, stride);
  return f.geometry();
}

/**
 * Bend a pine sideways by `bend` metres at height `h`, growing with the
 * square of the height, so the trunk leans gently and the foliage follows.
 * Applied alike to a shape's foliage, trunk and stand-in, so they stay together.
 */
function bent(geo: BufferGeometry, bend: number, h: number): BufferGeometry {
  if (bend === 0) return geo;
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i)) / h;
    pos.setX(i, pos.getX(i) + bend * t * t);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * The pine wood's shapes, after the proportions of low-poly pine packs:
 * a full pine of eight overlapping tiers narrowing to its tip; a tall pine,
 * as leafy, whose lowest hem hangs about 3.5 m up so its lower trunk shows
 * (the roadside build); a sparse pine with two tiers low, a long run of
 * bare trunk and three small tiers at the top; and a young pine of four
 * tiers starting low (its lowest hem about 0.7 m up, so a little trunk
 * shows), which the saplings use too. The scatter picks each pine's build.
 */
export type PineShape = PineForm;

interface ShapeSpec {
  tiers: readonly Tier[];
  points: number;
  /** The trunk ends this high, inside the top tier, so its tip never shows. */
  trunk: number;
  bend: number;
  seed: number;
}

const SHAPES: Record<PineShape, ShapeSpec> = {
  full: {
    tiers: [
      [4.6, 2.4, 3.0],
      [5.5, 2.2, 2.6],
      [6.6, 1.98, 2.4],
      [7.6, 1.85, 2.2],
      [8.4, 1.58, 1.8],
      [9.2, 1.31, 1.6],
      [9.8, 1.05, 1.3],
      [10.7, 0.66, 1.4],
    ],
    points: 14,
    trunk: 10.25,
    bend: 0.5,
    seed: 7,
  },
  tall: {
    tiers: [
      [6.2, 2.2, 2.4],
      [7.1, 2.05, 2.2],
      [8.0, 1.85, 2.0],
      [8.9, 1.62, 1.8],
      [9.7, 1.38, 1.6],
      [10.5, 1.12, 1.4],
      [11.2, 0.86, 1.3],
      [12.0, 0.6, 1.3],
    ],
    points: 14,
    trunk: 11.55,
    bend: 0.55,
    seed: 29,
  },
  sparse: {
    tiers: [
      [5.3, 1.65, 1.9],
      [6.5, 1.5, 2.0],
      [9.2, 1.08, 1.3],
      [9.8, 0.89, 1.25],
      [10.5, 0.64, 1.25],
    ],
    points: 10,
    trunk: 10.05,
    bend: 0.45,
    seed: 13,
  },
  young: {
    tiers: [
      [2.6, 1.85, 1.9],
      [3.75, 1.5, 1.7],
      [4.85, 1.1, 1.5],
      [5.8, 0.75, 1.3],
    ],
    points: 12,
    trunk: 5.35,
    bend: 0.25,
    seed: 21,
  },
};

export const PINE_SHAPES = Object.keys(SHAPES) as PineShape[];

/** Height a shape's bend is measured against: its top tier's apex. */
const top = (s: ShapeSpec) => s.tiers[s.tiers.length - 1]![0];

export function pineFoliage(shape: PineShape): BufferGeometry {
  const s = SHAPES[shape];
  return bent(stacked(s.tiers, s.points, s.seed), s.bend, top(s));
}

/** A shape's trunk: tapering and six-sided in four segments (so it curves), ending inside the top tier. */
export function pineTrunk(shape: PineShape): BufferGeometry {
  const s = SHAPES[shape];
  const geo = new CylinderGeometry(0.12, 0.32, s.trunk, 6, 4)
    .translate(0, s.trunk / 2, 0)
    .toNonIndexed();
  geo.deleteAttribute('uv');
  return bent(geo, s.bend, top(s));
}

/**
 * A distant stand-in: the very same tiers, every other point of each hem,
 * so half the faces and the same lean, heights and colours: the swap to it
 * never shows as a change of shape.
 */
export function pineStandIn(shape: PineShape): BufferGeometry {
  const s = SHAPES[shape];
  return bent(stacked(s.tiers, s.points, s.seed, 2), s.bend, top(s));
}

/** Where a shape's crown ends: its top tier's apex. */
export function pineCrownTop(shape: PineShape): number {
  return top(SHAPES[shape]);
}
