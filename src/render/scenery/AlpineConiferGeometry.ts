import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
} from 'three';

/**
 * More of the Alpine's winter woods, after the low-poly snowy tree sets in
 * `context/low-poly-snowy-trees` (used as references only), beside the
 * tiered snow pines (`SnowPineGeometry`): spruces of drooping fronds, whorl
 * above whorl, each frond a bent strip with a band of snow along its top;
 * firs heaped with chunky faceted clumps, white where they face the sky and
 * green beneath; and on the ground, boulders and stumps under caps of snow.
 * Each is one mesh in vertex colours, about the stock pine's size.
 */

type V3 = [number, number, number];

const SNOW = new Color('#eef2f5');
/** Snow in its own shade: a touch blue where it faces away from the sky. */
const SNOW_SHADE = new Color('#cfdae6');

/** A stable 0..1 from integers. */
function hash(a: number, b: number, c = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Triangles with a colour each, built into one non-indexed geometry. */
class Mesh {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  readonly colour = new Color();

  tri(a: V3, b: V3, c: V3): void {
    this.pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) this.col.push(this.colour.r, this.colour.g, this.colour.b);
  }

  /** A quad seen from both sides (a frond is a single sheet). */
  sheet(a: V3, b: V3, c: V3, d: V3): void {
    this.tri(a, b, c);
    this.tri(a, c, d);
    this.tri(a, c, b);
    this.tri(a, d, c);
  }

  /** Every triangle of `g` (disposed), each coloured by `paint` from how much it faces the sky (−1..1). */
  add(g: BufferGeometry, paint: (up: number, face: number, out: Color) => void): void {
    const flat = g.index ? g.toNonIndexed() : g;
    const p = flat.getAttribute('position');
    for (let i = 0; i + 2 < p.count; i += 3) {
      const a: V3 = [p.getX(i), p.getY(i), p.getZ(i)];
      const b: V3 = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)];
      const c: V3 = [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
      const ux = b[0] - a[0];
      const uy = b[1] - a[1];
      const uz = b[2] - a[2];
      const vx = c[0] - a[0];
      const vy = c[1] - a[1];
      const vz = c[2] - a[2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      paint(ny / (Math.hypot(nx, ny, nz) || 1), i / 3, this.colour);
      this.tri(a, b, c);
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

/** A drooping-frond spruce's build. */
export interface FrondSpec {
  salt: number;
  /** Whorls of fronds, the lowest whorl's height and the tree's top. */
  whorls: number;
  foot: number;
  top: number;
  /** Frond length at the lowest whorl and the highest, and how far a frond droops at its tip (share of its length). */
  reach: number;
  topReach: number;
  droop: number;
  /** Fronds per whorl, and how much of each frond's top the snow covers (0..1 of its width). */
  fronds: number;
  snow: number;
  trunk: number;
  /** Where between the region's two pine greens this tree's green lies. */
  green: number;
}

export const FROND_SPECS: readonly FrondSpec[] = [
  // Full: long fronds, heavy snow, a broad skirt.
  {
    salt: 11,
    whorls: 12,
    foot: 0.9,
    top: 6.6,
    reach: 1.9,
    topReach: 0.45,
    droop: 0.55,
    fronds: 10,
    snow: 0.7,
    trunk: 0.24,
    green: 0.15,
  },
  // Slim: shorter fronds, more whorls, a light dusting.
  {
    salt: 12,
    whorls: 14,
    foot: 1.2,
    top: 7.4,
    reach: 1.35,
    topReach: 0.35,
    droop: 0.7,
    fronds: 9,
    snow: 0.45,
    trunk: 0.21,
    green: 0.5,
  },
];

/** One whorl's fronds: each a strip bent down from the trunk to its tip, with a band of snow on top. */
function frondWhorl(m: Mesh, spec: FrondSpec, i: number, green: Color): void {
  const t = spec.whorls > 1 ? i / (spec.whorls - 1) : 0;
  const y = spec.foot + (spec.top - spec.foot) * t * 0.92;
  const reach = spec.reach + (spec.topReach - spec.reach) * Math.pow(t, 0.85);
  const n = spec.fronds - (t > 0.7 ? 2 : 0);
  for (let k = 0; k < n; k++) {
    const j = hash(spec.salt, i, k);
    const a = (k / n) * Math.PI * 2 + i * 0.6 + (j - 0.5) * 0.4;
    const len = reach * (0.85 + 0.3 * j);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // Three stations along the frond: root, middle, tip, drooping more toward the tip.
    const along = [0.05, 0.5, 1].map((f) => f * len);
    const drop = [0, 0.18, 1].map((f) => f * spec.droop * len);
    const half = [0.09, 0.38, 0.08].map((f) => f * (0.6 + len * 0.4));
    const at = (s: number, side: number, lift = 0): V3 => [
      ca * along[s]! - sa * half[s]! * side,
      y - drop[s]! + lift,
      sa * along[s]! + ca * half[s]! * side,
    ];
    m.colour.copy(green).multiplyScalar(0.92 + 0.12 * j);
    for (let s = 0; s < 2; s++) m.sheet(at(s, -1), at(s + 1, -1), at(s + 1, 1), at(s, 1));
    // The snow: a narrower band along the top, a hair above, from just off the trunk to short of the tip.
    m.colour.copy(SNOW);
    const w = spec.snow;
    const snowAt = (s: number, side: number): V3 => {
      const p = at(s, side * w, 0.035);
      return s === 2 ? [p[0] * 0.92, p[1] + spec.droop * len * 0.06, p[2] * 0.92] : p;
    };
    for (let s = 0; s < 2; s++)
      m.sheet(snowAt(s, -1), snowAt(s + 1, -1), snowAt(s + 1, 1), snowAt(s, 1));
  }
}

export function frondSpruceGeometry(
  spec: FrondSpec,
  greens: readonly [Color, Color],
  trunk: Color,
): BufferGeometry {
  const m = new Mesh();
  const green = greens[0].clone().lerp(greens[1], spec.green);
  for (let i = 0; i < spec.whorls; i++) frondWhorl(m, spec, i, green);
  // A snowy point rising out of the top whorl, and the trunk up into the crown.
  const point = new CylinderGeometry(0, spec.topReach * 0.7, spec.top * 0.16, 6).translate(
    0,
    spec.top * 0.92 + spec.top * 0.05,
    0,
  );
  m.add(point, (up, f, out) => {
    out.copy(f % 3 === 0 ? green : SNOW);
    if (up < 0) out.copy(green);
  });
  m.add(
    new CylinderGeometry(spec.trunk * 0.45, spec.trunk, spec.top * 0.85, 6).translate(
      0,
      (spec.top * 0.85) / 2 - 0.15,
      0,
    ),
    (_u, f, out) => out.copy(trunk).multiplyScalar(0.9 + 0.2 * hash(spec.salt, f, 3)),
  );
  return m.build();
}

/** A clump fir's build: tiers of faceted clumps round the trunk, the heaviest at the foot. */
export interface ClumpSpec {
  salt: number;
  tiers: number;
  foot: number;
  top: number;
  /** The lowest tier's clump ring radius and clump size; the top tier's are this share of them. */
  reach: number;
  clump: number;
  taper: number;
  /** Faces turned more than this to the sky are snow. */
  snowFrom: number;
  trunk: number;
  green: number;
}

export const CLUMP_SPECS: readonly ClumpSpec[] = [
  // Round: four heavy tiers, mostly white.
  {
    salt: 21,
    tiers: 4,
    foot: 1.0,
    top: 5.4,
    reach: 1.15,
    clump: 0.95,
    taper: 0.42,
    snowFrom: -0.05,
    trunk: 0.24,
    green: 0.2,
  },
  // Tall: six lighter tiers, green showing on the flanks.
  {
    salt: 22,
    tiers: 6,
    foot: 1.1,
    top: 6.8,
    reach: 0.95,
    clump: 0.78,
    taper: 0.4,
    snowFrom: 0.25,
    trunk: 0.22,
    green: 0.6,
  },
];

/** Paints a clump: snow where it faces the sky (a touch bluer as it turns away), green beneath. */
function clumpPaint(green: Color, snowFrom: number, salt: number) {
  return (up: number, face: number, out: Color) => {
    const j = hash(salt, face, 5);
    if (up > snowFrom + (j - 0.5) * 0.25) {
      out.copy(SNOW).lerp(SNOW_SHADE, Math.max(0, Math.min(1, (0.8 - up) * 0.9)));
    } else out.copy(green).multiplyScalar(0.8 + 0.25 * j);
  };
}

export function snowClumpFirGeometry(
  spec: ClumpSpec,
  greens: readonly [Color, Color],
  trunk: Color,
): BufferGeometry {
  const m = new Mesh();
  const green = greens[0].clone().lerp(greens[1], spec.green);
  const paint = clumpPaint(green, spec.snowFrom, spec.salt);
  m.add(
    new CylinderGeometry(spec.trunk * 0.5, spec.trunk, spec.top * 0.7, 6).translate(
      0,
      (spec.top * 0.7) / 2 - 0.15,
      0,
    ),
    (_u, f, out) => out.copy(trunk).multiplyScalar(0.9 + 0.2 * hash(spec.salt, f, 4)),
  );
  // The crown's green body, so the gaps between clumps show needles, not sky.
  const bodyH = spec.top - spec.foot;
  m.add(
    new CylinderGeometry(0.05, spec.reach * 0.9, bodyH, 7).translate(0, spec.foot + bodyH / 2, 0),
    (_u, f, out) => out.copy(green).multiplyScalar(0.72 + 0.12 * hash(spec.salt, f, 6)),
  );
  for (let i = 0; i < spec.tiers; i++) {
    const t = spec.tiers > 1 ? i / (spec.tiers - 1) : 0;
    const k = 1 - (1 - spec.taper) * t;
    const y = spec.foot + (spec.top - spec.foot - spec.clump * spec.taper * 1.2) * t;
    const r = spec.reach * k;
    const size = spec.clump * k;
    const n = t > 0.75 ? 4 : 6;
    for (let c = 0; c < n; c++) {
      const j = hash(spec.salt, i, c);
      const a = (c / n) * Math.PI * 2 + i * 0.9 + j * 0.5;
      m.add(
        new IcosahedronGeometry(size * (0.85 + 0.3 * j), 0)
          .scale(1.1, 0.85, 1.1)
          .rotateY(j * 3)
          .translate(Math.cos(a) * r, y + (j - 0.5) * 0.15, Math.sin(a) * r),
        paint,
      );
    }
    // A clump over the trunk at each tier, closing the crown's middle.
    m.add(
      new IcosahedronGeometry(size * 0.9, 0).scale(1, 0.75, 1).translate(0, y + size * 0.25, 0),
      paint,
    );
  }
  m.add(
    new IcosahedronGeometry(spec.clump * spec.taper * 0.8, 0)
      .scale(1, 1.6, 1)
      .translate(0, spec.top - spec.clump * spec.taper * 0.4, 0),
    paint,
  );
  return m.build();
}

/** A boulder under a cap of snow: its grey body, its snow on whatever faces the sky. */
export function snowyBoulderGeometry(rock: Color): BufferGeometry {
  const m = new Mesh();
  m.add(new DodecahedronGeometry(0.9, 0).translate(0, 0.25, 0), (up, f, out) => {
    if (up > 0.3) out.copy(SNOW).lerp(SNOW_SHADE, (1 - up) * 0.7);
    else out.copy(rock).multiplyScalar(0.85 + 0.3 * hash(31, f));
  });
  return m.build();
}

/** A stump with a cap of snow and two roots running into the ground. */
export function snowyStumpGeometry(bark: Color): BufferGeometry {
  const m = new Mesh();
  const wood = (_u: number, f: number, out: Color) =>
    out.copy(bark).multiplyScalar(0.85 + 0.3 * hash(41, f));
  m.add(new CylinderGeometry(0.34, 0.42, 0.7, 7).translate(0, 0.3, 0), wood);
  for (const [a, len] of [
    [0.4, 0.75],
    [2.7, 0.6],
  ] as const)
    m.add(
      new CylinderGeometry(0.06, 0.14, len, 5)
        .rotateZ(Math.PI / 2 - 0.35)
        .translate(len / 2, 0.08, 0)
        .rotateY(a),
      wood,
    );
  m.add(new CylinderGeometry(0.36, 0.38, 0.14, 7).translate(0, 0.72, 0), (up, _f, out) =>
    out.copy(up < -0.5 ? bark : SNOW),
  );
  return m.build();
}
