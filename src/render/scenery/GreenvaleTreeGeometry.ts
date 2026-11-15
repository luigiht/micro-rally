import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  Quaternion,
  Vector3,
} from 'three';

/**
 * The Greenvale's mixed Riviera woods, after the low-poly tree sets in
 * `context/low-poly-trees` (used as references only): broadleaves whose
 * crowns are clusters of faceted lumps on forked trunks (an oak, a chestnut
 * dome, an umbrella stone pine, a round linden) and conifers of stacked
 * drooping tiers with scalloped hems (a fir, a tall spruce, a young fir) or
 * a lumpy flame (an Italian cypress); and a lumpy bush. Each is one mesh in
 * vertex colours, every facet its own shade between a crown's shadowed and
 * sunlit greens, lighter the more it faces the sky, so the crowns read as
 * cut gems; trunks and limbs in bark. `detail` 1 is the near build, 0 the
 * far stand-in (the same silhouette in a quarter of the facets). Sizes at
 * scale 1: broadleaf crowns within about 2.3 m of the trunk, conifers 1.6 m,
 * 3.5–7.8 m tall.
 */

type V3 = readonly [number, number, number];

export type BroadleafForm = 'oak' | 'chestnut' | 'stonePine' | 'linden';
export type ConiferForm = 'fir' | 'spruce' | 'cypress' | 'youngFir';
export const BROADLEAF_FORMS: readonly BroadleafForm[] = ['oak', 'chestnut', 'stonePine', 'linden'];
export const CONIFER_FORMS: readonly ConiferForm[] = ['fir', 'spruce', 'cypress', 'youngFir'];

/** The woods' colours: broadleaf and conifer base greens, the stone pine's and cypress's own, and the bark. */
export interface GreenvaleColours {
  leaf: Color;
  leafAlt: Color;
  needle: Color;
  needleAlt: Color;
  bark: Color;
}

/** A crown's facets run from this much of its green in shadow to sunlit, warmed toward this yellow-green. */
const SHADOW = 0.72;
const SUNLIT = new Color('#c4d96e');
const SUN_SHARE = 0.3;

/** A stable 0..1 from integers. */
function hash(a: number, b: number, c = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Triangles with a colour each, built into one non-indexed geometry. */
class Facets {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private faces = 0;

  /** Every triangle of `g` (disposed), coloured by `paint` from its normal's upness (0..1) and a per-face draw. */
  add(g: BufferGeometry, paint: (up: number, draw: number, out: Color) => void): void {
    const flat = g.index ? g.toNonIndexed() : g;
    const p = flat.getAttribute('position');
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const colour = new Color();
    for (let i = 0; i + 2 < p.count; i += 3) {
      a.fromBufferAttribute(p, i);
      b.fromBufferAttribute(p, i + 1);
      c.fromBufferAttribute(p, i + 2);
      const n = c.clone().sub(b).cross(a.clone().sub(b)).normalize();
      paint(n.y * 0.5 + 0.5, hash(this.faces++, 7), colour);
      for (const v of [a, b, c]) {
        this.pos.push(v.x, v.y, v.z);
        this.col.push(colour.r, colour.g, colour.b);
      }
    }
    if (flat !== g) flat.dispose();
    g.dispose();
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    g.setAttribute('color', new BufferAttribute(Float32Array.from(this.col), 3));
    g.computeVertexNormals();
    return g;
  }
}

/** Paints a crown's facets in `green`: shadowed below, sunlit and warmer above, each facet a little its own. */
function foliage(green: Color): (up: number, draw: number, out: Color) => void {
  return (up, draw, out) => {
    const t = Math.min(1, Math.max(0, 0.15 + 0.7 * up + (draw - 0.5) * 0.45));
    out.copy(green).multiplyScalar(SHADOW + (1.08 - SHADOW) * t);
    out.lerp(SUNLIT, SUN_SHARE * t * t);
  };
}

function barkPaint(bark: Color): (up: number, draw: number, out: Color) => void {
  return (_up, draw, out) => {
    out.copy(bark).multiplyScalar(0.88 + draw * 0.22);
  };
}

/**
 * A faceted lump: an icosahedron at `detail`, each corner pushed in or out a
 * little by where it lies (so shared corners move together and the lump
 * stays closed), squashed by `squash` in height, at `at`.
 */
function lump(r: number, detail: number, at: V3, salt: number, squash = 1): BufferGeometry {
  const g = new IcosahedronGeometry(r, detail);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k =
      1 + (hash(Math.round(x * 50), Math.round(y * 50) + salt, Math.round(z * 50)) - 0.5) * 0.24;
    p.setXYZ(i, x * k + at[0], y * k * squash + at[1], z * k + at[2]);
  }
  return g;
}

const UP = new Vector3(0, 1, 0);

/** A limb (or trunk) from `a` to `b`, `r0` thick at `a` tapering to `r1`. */
function limb(a: V3, b: V3, r0: number, r1: number, sides = 5): BufferGeometry {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const g = new CylinderGeometry(r1, r0, len, sides, 1, true);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}

/**
 * A trunk through `points` (foot first), `radii` thick at each: one tube
 * whose rings are shared between segments, each turned to the mean of the
 * segments it joins, so a bend never opens a seam.
 */
function tube(points: readonly V3[], radii: readonly number[], sides = 6): BufferGeometry {
  const rings: Vector3[][] = [];
  const q = new Quaternion();
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    const dir = new Vector3(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]).normalize();
    q.setFromUnitVectors(UP, dir);
    const p = points[i]!;
    rings.push(
      Array.from({ length: sides }, (_, k) => {
        const a = (k * Math.PI * 2) / sides;
        return new Vector3(Math.cos(a) * radii[i]!, 0, Math.sin(a) * radii[i]!)
          .applyQuaternion(q)
          .add(new Vector3(p[0], p[1], p[2]));
      }),
    );
  }
  const pos: number[] = [];
  for (let i = 0; i + 1 < rings.length; i++) {
    const lo = rings[i]!;
    const hi = rings[i + 1]!;
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      // Wound to face outward (the ring runs from +x toward +z).
      for (const v of [lo[k]!, hi[k]!, lo[k1]!, lo[k1]!, hi[k]!, hi[k1]!]) pos.push(v.x, v.y, v.z);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(Float32Array.from(pos), 3));
  return g;
}

/** A point `out` metres from the axis at angle `a`, `y` up. */
const around = (a: number, out: number, y: number): V3 => [Math.cos(a) * out, y, Math.sin(a) * out];

export function broadleafGeometry(
  form: BroadleafForm,
  colours: GreenvaleColours,
  detail: 0 | 1,
): BufferGeometry {
  const m = new Facets();
  const bark = barkPaint(colours.bark);
  const wood = (g: BufferGeometry) => m.add(g, bark);
  const crown = (green: Color) => (g: BufferGeometry) => m.add(g, foliage(green));
  const fork: V3 = [0.08, 1.9, 0];
  if (form === 'oak') {
    // A short trunk forking into three limbs, a lump at each end, a big one on top and two small ones.
    const leaf = crown(colours.leaf);
    wood(limb([0, -0.2, 0], fork, 0.34, 0.24, 6));
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3 + 0.3;
      const end = around(a, 1.15, 3.2 + 0.25 * k);
      wood(limb(fork, end, 0.18, 0.09));
      leaf(lump(1.05 + 0.1 * (k % 2), detail, [end[0] * 1.1, end[1] + 0.45, end[2] * 1.1], k));
    }
    leaf(lump(1.35, detail, [0.1, 4.6, -0.1], 5));
    leaf(lump(0.75, detail, [-0.9, 4.3, 0.8], 6));
    leaf(lump(0.7, detail, [0.95, 4.5, 0.55], 7));
  } else if (form === 'chestnut') {
    // A stout trunk under one broad dome ringed with bulges.
    const leaf = crown(colours.leafAlt);
    wood(limb([0, -0.2, 0], [0, 2.4, 0], 0.4, 0.28, 6));
    wood(limb([0, 1.8, 0], around(0.8, 0.9, 3.1), 0.16, 0.08));
    wood(limb([0, 2.0, 0], around(3.6, 0.85, 3.2), 0.15, 0.08));
    leaf(lump(1.85, detail, [0, 4.0, 0], 11, 0.78));
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + 0.6;
      leaf(lump(0.95 - 0.08 * (k % 2), detail, around(a, 1.35, 3.5 + 0.3 * (k % 3)), 12 + k));
    }
  } else if (form === 'stonePine') {
    // A tall bare trunk leaning as it climbs, forking under a flat umbrella of squashed lumps.
    const leaf = crown(colours.needle);
    const top: V3 = [0.5, 4.5, 0.1];
    wood(
      tube(
        [[0, -0.2, 0], [0.06, 1.2, 0.01], [0.18, 2.4, 0.04], [0.34, 3.5, 0.07], top],
        [0.3, 0.26, 0.22, 0.19, 0.16],
      ),
    );
    const head: V3 = [top[0], 5.55, top[2]];
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3 + 1.1;
      const end = around(a, 0.95, 5.25);
      wood(limb(top, [end[0] + top[0], end[1], end[2] + top[2]], 0.13, 0.07));
    }
    leaf(lump(1.15, detail, [head[0], head[1] + 0.25, head[2]], 21, 0.45));
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + 0.25;
      const at = around(a, 0.95 + 0.12 * (k % 2), head[1] - 0.05 * (k % 3));
      leaf(
        lump(0.92 + 0.1 * (k % 3), detail, [at[0] + head[0], at[1], at[2] + head[2]], 22 + k, 0.45),
      );
    }
  } else {
    // A slim trunk under an upright egg of a crown, a lump on each shoulder.
    const leaf = crown(colours.leaf);
    wood(limb([0, -0.2, 0], [0, 2.6, 0], 0.26, 0.18, 6));
    leaf(lump(1.3, detail, [0, 4.3, 0], 31, 1.45));
    leaf(lump(0.78, detail, [0.85, 3.6, 0.3], 32));
    leaf(lump(0.7, detail, [-0.7, 4.9, -0.45], 33));
  }
  return m.build();
}

/**
 * A tier: a skirt from its point down to a scalloped hem (tips at `r`,
 * notches pulled in and up between them, each tip drooping), closed
 * underneath by a flatter cone back up to the trunk.
 */
function tier(
  y: number,
  h: number,
  r: number,
  tips: number,
  turn: number,
  salt: number,
): BufferGeometry {
  const apex: V3 = [0, y + h, 0];
  const hub: V3 = [0, y + h * 0.3, 0];
  const rim: V3[] = [];
  for (let k = 0; k < 2 * tips; k++) {
    const tip = k % 2 === 0;
    const a = turn + (k * Math.PI) / tips;
    const j = hash(salt, k, 3) - 0.5;
    const out = tip ? r * (1 + 0.12 * j) : r * 0.78;
    const yy = tip ? y - h * (0.12 + 0.08 * j) : y + h * 0.08;
    rim.push([Math.cos(a) * out, yy, Math.sin(a) * out]);
  }
  const pos: number[] = [];
  for (let k = 0; k < rim.length; k++) {
    const p = rim[k]!;
    const q = rim[(k + 1) % rim.length]!;
    // Top face, then the underside, both wound to face outward.
    pos.push(...apex, ...q, ...p, ...hub, ...p, ...q);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(Float32Array.from(pos), 3));
  return g;
}

interface TierSpec {
  tiers: number;
  foot: number;
  top: number;
  reach: number;
  topReach: number;
  trunk: number;
}

const CONIFERS: Readonly<Record<Exclude<ConiferForm, 'cypress'>, TierSpec>> = {
  fir: { tiers: 5, foot: 1.0, top: 6.6, reach: 1.6, topReach: 0.45, trunk: 0.26 },
  spruce: { tiers: 7, foot: 0.9, top: 7.8, reach: 1.25, topReach: 0.32, trunk: 0.24 },
  youngFir: { tiers: 3, foot: 0.45, top: 3.5, reach: 1.15, topReach: 0.45, trunk: 0.15 },
};

export function coniferGeometry(
  form: ConiferForm,
  colours: GreenvaleColours,
  detail: 0 | 1,
): BufferGeometry {
  const m = new Facets();
  const bark = barkPaint(colours.bark);
  if (form === 'cypress') {
    // A lumpy flame: a ring of corners at each height, each pushed in or out by where it lies.
    const profile: readonly [number, number][] = [
      [0.35, 0.5],
      [0.62, 1.3],
      [0.74, 2.6],
      [0.68, 4.0],
      [0.48, 5.3],
      [0.22, 6.3],
    ];
    const sides = detail ? 8 : 6;
    const ring = (i: number): V3[] =>
      Array.from({ length: sides }, (_, k) => {
        const [r, y] = profile[i]!;
        const a = (k * Math.PI * 2) / sides + i * 0.4;
        const out = r * (1 + (hash(i, k, 61) - 0.5) * (detail ? 0.3 : 0.15));
        return [Math.cos(a) * out, y, Math.sin(a) * out] as V3;
      });
    const pos: number[] = [];
    const rings = profile.map((_, i) => ring(i));
    const tip: V3 = [0.05, 6.95, 0];
    const foot: V3 = [0, 0.45, 0];
    for (let i = 0; i < rings.length; i++) {
      const lo = rings[i]!;
      const hi = rings[i + 1];
      for (let k = 0; k < sides; k++) {
        const k1 = (k + 1) % sides;
        if (hi) pos.push(...lo[k]!, ...hi[k]!, ...lo[k1]!, ...lo[k1]!, ...hi[k]!, ...hi[k1]!);
        else pos.push(...lo[k]!, ...tip, ...lo[k1]!);
        if (i === 0) pos.push(...lo[k]!, ...lo[k1]!, ...foot);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(Float32Array.from(pos), 3));
    m.add(limb([0, -0.2, 0], [0, 1.0, 0], 0.2, 0.15), bark);
    m.add(g, foliage(colours.needleAlt));
    return m.build();
  }
  const spec = CONIFERS[form];
  const n = spec.tiers;
  // Tiers overlap: each is 1.7 spacings tall, so its hem hangs over the point of the one below.
  const spacing = (spec.top - spec.foot) / (n - 1 + 1.7);
  m.add(limb([0, -0.2, 0], [0, spec.top * 0.7, 0], spec.trunk, spec.trunk * 0.5, 6), bark);
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const r = spec.reach + (spec.topReach - spec.reach) * t;
    const tips = detail ? (r > 1.1 ? 8 : 6) : 5;
    const g = tier(spec.foot + i * spacing, spacing * 1.7, r, tips, i * 0.7, i + 40);
    // The lower tiers a touch darker than the top.
    const green = colours.needle.clone().multiplyScalar(0.9 + 0.12 * t);
    m.add(g, foliage(green));
  }
  return m.build();
}

/** A bush: two or three faceted lumps huddled low. */
export function bushGeometry(colours: GreenvaleColours, detail: 0 | 1): BufferGeometry {
  const m = new Facets();
  const paint = foliage(colours.leafAlt.clone().lerp(colours.needle, 0.5));
  m.add(lump(0.85, detail, [0, 0.45, 0], 51, 0.8), paint);
  m.add(lump(0.6, detail, [0.7, 0.35, 0.25], 52, 0.85), paint);
  m.add(lump(0.55, detail, [-0.45, 0.4, -0.55], 53, 0.85), paint);
  return m.build();
}
