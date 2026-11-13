import { BufferAttribute, BufferGeometry, Color, CylinderGeometry } from 'three';

/**
 * The Alpine's tiered snow pines, after a low-poly winter tree set (used as
 * a reference only), about the stock pine's size (3.5–7 m before the
 * scatter's scale). Each tier is a whorl of branch clumps rather than a
 * cone: its rim is a star of six to eight branch tips, each reaching out a
 * little further or shorter than the next and drooping under the snow, with
 * notches pulled in and up between them; a skirt closes it underneath. Snow
 * covers the top of the whorl and runs further out along the branches than
 * into the notches, so its edge zigzags round the tier; it stands a hair
 * proud of the green and turns down over it in a lip, so the two never share
 * a plane. The top tier carries a thin leader; the trunk flares at its foot.
 *
 * Nine silhouettes, each laid out from a few numbers (`PineSpec`): how many
 * tiers, how tall, how wide at the foot and the top and how the reach falls
 * between them, how much the tiers overlap (a sparse tree shows its trunk
 * between them), how far the snow lies out, and whether the top leans or the
 * tiers sit lopsided. Each is one mesh in vertex colours: its own green from
 * the region's two pine greens, a touch darker on the lower tiers, white
 * snow and the palette's trunk.
 */

export interface PineSpec {
  /** Salt for the tree's own branch lengths. */
  salt: number;
  tiers: number;
  /** The lowest tier's foot, and the tree's point (before the leader). */
  foot: number;
  top: number;
  /** The lowest and the highest tier's reach, and the curve between them (1 straight, more for a fuller middle). */
  reach: number;
  topReach: number;
  fullness?: number;
  /** A tier's height over the spacing between tiers (1.75 by default): less stands the tiers apart, each one's snowy point showing under the next. */
  overlap?: number;
  /** How far out along the branches the snow lies (0..1 of the way from each point to its tips). */
  snow?: number;
  /** The top's sideways shift, growing up the tree; and each tier's shift either side (lopsided). */
  lean?: number;
  sway?: number;
  /** How far the branch tips droop, as a share of a tier's height. */
  droop?: number;
  /** The trunk's foot radius. */
  trunk: number;
  /** Where between the region's two pine greens this tree's green lies (0..1), and its brightness. */
  green: number;
  shade: number;
}

export const PINE_SPECS: readonly PineSpec[] = [
  // Broad: wide, flat tiers.
  {
    salt: 1,
    tiers: 4,
    foot: 1.0,
    top: 5.3,
    reach: 1.85,
    topReach: 0.62,
    trunk: 0.27,
    green: 0.1,
    shade: 1,
  },
  // Tall and narrow.
  {
    salt: 2,
    tiers: 6,
    foot: 0.9,
    top: 6.4,
    reach: 1.35,
    topReach: 0.42,
    trunk: 0.22,
    green: 0.55,
    shade: 0.95,
  },
  // Leaning top.
  {
    salt: 3,
    tiers: 4,
    foot: 1.0,
    top: 5.1,
    reach: 1.55,
    topReach: 0.55,
    lean: 0.45,
    trunk: 0.24,
    green: 0.3,
    shade: 1.05,
  },
  // Young: short, three tiers.
  {
    salt: 4,
    tiers: 3,
    foot: 0.6,
    top: 3.4,
    reach: 1.2,
    topReach: 0.55,
    trunk: 0.16,
    green: 0.8,
    shade: 1.08,
  },
  // Snow-laden: full tiers buried nearly to their tips, drooping.
  {
    salt: 5,
    tiers: 5,
    foot: 0.95,
    top: 5.6,
    reach: 1.7,
    topReach: 0.45,
    snow: 0.88,
    droop: 0.2,
    trunk: 0.25,
    green: 0.2,
    shade: 0.9,
  },
  // Sparse: tiers apart, a light dusting.
  {
    salt: 6,
    tiers: 4,
    foot: 1.4,
    top: 5.6,
    reach: 1.45,
    topReach: 0.5,
    overlap: 1.15,
    snow: 0.58,
    trunk: 0.2,
    green: 0.65,
    shade: 1,
  },
  // Columnar: many small tiers, slim as a spire.
  {
    salt: 7,
    tiers: 7,
    foot: 0.8,
    top: 6.9,
    reach: 1.0,
    topReach: 0.34,
    fullness: 0.7,
    trunk: 0.2,
    green: 0.0,
    shade: 0.88,
  },
  // Lopsided: each tier shifted the other way from the last.
  {
    salt: 8,
    tiers: 5,
    foot: 1.0,
    top: 5.7,
    reach: 1.6,
    topReach: 0.5,
    sway: 0.2,
    trunk: 0.23,
    green: 0.45,
    shade: 1.02,
  },
  // Squat: three wide tiers heavy with snow.
  {
    salt: 9,
    tiers: 3,
    foot: 0.8,
    top: 4.0,
    reach: 2.0,
    topReach: 0.85,
    snow: 0.82,
    trunk: 0.26,
    green: 0.9,
    shade: 0.97,
  },
];

interface Tier {
  y: number;
  h: number;
  r: number;
  turn: number;
  dx: number;
  dz: number;
}

/** Branch tips per tier: more round a wider tier. */
const tipsFor = (r: number) => (r > 1.4 ? 8 : r > 0.9 ? 7 : 6);
/** A tip reaches this much further or shorter at most, and droops this share of the tier's height by default. */
const TIP_JITTER = 0.12;
const TIP_DROOP = 0.12;
/** A notch is pulled in to this share of the reach and up this share of the height. */
const NOTCH_IN = 0.64;
const NOTCH_RISE = 0.12;
/** The snow lies this far out by default, and this much less into a notch. */
const SNOW_REACH = 0.74;
const SNOW_NOTCH = 0.12;
/** The snow stands this far proud of the green: out, and up. */
const SNOW_OUT = 1.05;
const SNOW_UP = 0.03;
/** The skirt underneath meets the trunk this share of the tier's height above its foot. */
const SKIRT_HUB = 0.12;
/** The top tier's leader: this much higher than its point, this thick at its foot. */
const LEADER = 0.45;
const LEADER_R = 0.07;
/** A tier's height over the spacing between tiers, by default. */
const OVERLAP = 1.75;
/** A tier's reach strays this much from the even taper. */
const REACH_JITTER = 0.07;
/** The lowest tier's green is this much darker than the highest's. */
const LOW_DARK = 0.1;
const SNOW = new Color('#eef2f5');

type V3 = [number, number, number];

/** A stable −1..1 from integers. */
function jitter(a: number, b: number, c: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Coloured triangles, each wound to face along `facing` (a direction it should look toward). */
class Triangles {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  colour = new Color();

  tri(a: V3, b: V3, c: V3, facing: V3): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const flip = nx * facing[0] + ny * facing[1] + nz * facing[2] < 0;
    this.pos.push(...a, ...(flip ? c : b), ...(flip ? b : c));
    for (let i = 0; i < 3; i++) this.col.push(this.colour.r, this.colour.g, this.colour.b);
  }

  quad(a: V3, b: V3, c: V3, d: V3, facing: V3): void {
    this.tri(a, b, c, facing);
    this.tri(a, c, d, facing);
  }

  /** Every triangle of `g` as it is wound, in the current colour; `g` is disposed. */
  add(g: BufferGeometry): void {
    const flat = g.index ? g.toNonIndexed() : g;
    const p = flat.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.col.push(this.colour.r, this.colour.g, this.colour.b);
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

/** The tree's tiers, laid out from its spec. */
function tiersOf(spec: PineSpec): Tier[] {
  const n = spec.tiers;
  const overlap = spec.overlap ?? OVERLAP;
  const spacing = (spec.top - spec.foot) / (n - 1 + overlap);
  return Array.from({ length: n }, (_, i) => {
    const t = n > 1 ? i / (n - 1) : 0;
    const taper = 1 - Math.pow(t, spec.fullness ?? 1);
    const r =
      (spec.topReach + (spec.reach - spec.topReach) * taper) *
      (1 + REACH_JITTER * jitter(spec.salt, i, 90));
    const sway = (spec.sway ?? 0) * (i % 2 ? 1 : -1) * (0.6 + 0.4 * t);
    const turnSway = spec.salt * 0.7;
    return {
      y: spec.foot + i * spacing,
      h: spacing * overlap,
      r,
      turn: spec.salt + i * 0.45,
      dx: (spec.lean ?? 0) * t * t + sway * Math.cos(turnSway),
      dz: sway * Math.sin(turnSway),
    };
  });
}

/** A tier's rim (tips and notches by turns), its point, and where the snow's edge crosses each rim spoke. */
function tierShape(t: Tier, index: number, spec: PineSpec) {
  const n = tipsFor(t.r);
  const apex: V3 = [t.dx, t.y + t.h, t.dz];
  const rim: V3[] = [];
  const edge: V3[] = [];
  const reach = spec.snow ?? SNOW_REACH;
  const droop = spec.droop ?? TIP_DROOP;
  for (let k = 0; k < 2 * n; k++) {
    const tip = k % 2 === 0;
    const j = jitter(spec.salt, index, k);
    const a = t.turn + (k * Math.PI) / n + (tip ? 0 : j * 0.08);
    const rad = tip ? t.r * (1 + TIP_JITTER * j) : t.r * NOTCH_IN * (1 + 0.06 * j);
    const y = tip ? t.y - t.h * droop * (1 + 0.4 * j) : t.y + t.h * NOTCH_RISE;
    const p: V3 = [t.dx + Math.cos(a) * rad, y, t.dz + Math.sin(a) * rad];
    rim.push(p);
    const s = Math.min(
      0.95,
      (tip ? reach : reach - SNOW_NOTCH) + 0.04 * jitter(spec.salt, index, k + 50),
    );
    edge.push([
      apex[0] + (p[0] - apex[0]) * s,
      apex[1] + (p[1] - apex[1]) * s,
      apex[2] + (p[2] - apex[2]) * s,
    ]);
  }
  return { apex, rim, edge };
}

/** Outward from the tier's axis at `p`, tipped up or down. */
const outward = (p: V3, t: Tier, up: number): V3 => [p[0] - t.dx, up, p[2] - t.dz];

/** The whole tree, green, snow and trunk, in vertex colours from the region's two pine greens and its trunk colour. */
export function snowPineGeometry(
  spec: PineSpec,
  greens: readonly [Color, Color],
  trunk: Color,
): BufferGeometry {
  const m = new Triangles();
  const tiers = tiersOf(spec);
  const green = greens[0].clone().lerp(greens[1], spec.green).multiplyScalar(spec.shade);
  tiers.forEach((t, i) => {
    const { apex, rim, edge } = tierShape(t, i, spec);
    const n = rim.length;
    // The branch tips below the snow and the skirt underneath, the lower tiers a touch darker.
    const up = tiers.length > 1 ? i / (tiers.length - 1) : 1;
    m.colour.copy(green).multiplyScalar(1 - LOW_DARK * (1 - up));
    const hub: V3 = [t.dx, t.y + t.h * SKIRT_HUB, t.dz];
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      m.quad(edge[k]!, edge[k1]!, rim[k1]!, rim[k]!, outward(rim[k]!, t, 0.6));
      m.tri(hub, rim[k1]!, rim[k]!, [0, -1, 0]);
    }
    // The snow over the whorl, its lip turning down over the green.
    m.colour.copy(SNOW);
    const top: V3 = [apex[0], apex[1] + SNOW_UP * 2, apex[2]];
    const lip = edge.map((e): V3 => [
      t.dx + (e[0] - t.dx) * SNOW_OUT,
      e[1] + SNOW_UP,
      t.dz + (e[2] - t.dz) * SNOW_OUT,
    ]);
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      m.tri(top, lip[k]!, lip[k1]!, outward(lip[k]!, t, 1));
      m.quad(lip[k]!, lip[k1]!, edge[k1]!, edge[k]!, outward(lip[k]!, t, -0.3));
    }
    if (i === tiers.length - 1) {
      // The leader: a thin spike from the top tier's point, under snow like it.
      const foot = top[1] - 0.05;
      const tip: V3 = [top[0], top[1] + LEADER, top[2]];
      for (let k = 0; k < 4; k++) {
        const a0 = (k * Math.PI) / 2 + t.turn;
        const a1 = ((k + 1) * Math.PI) / 2 + t.turn;
        const p0: V3 = [top[0] + Math.cos(a0) * LEADER_R, foot, top[2] + Math.sin(a0) * LEADER_R];
        const p1: V3 = [top[0] + Math.cos(a1) * LEADER_R, foot, top[2] + Math.sin(a1) * LEADER_R];
        m.tri(tip, p0, p1, outward(p0, t, 0.2));
      }
    }
  });
  // The trunk up into the tiers, and a flare at its foot where the roots go in.
  m.colour.copy(trunk);
  const r = spec.trunk;
  const h = spec.top * 0.75;
  m.add(new CylinderGeometry(r * 0.6, r, h, 6).translate(0, h / 2, 0));
  m.add(new CylinderGeometry(r * 0.95, r * 1.45, 0.3, 6).rotateY(0.5).translate(0, 0.1, 0));
  return m.build();
}
