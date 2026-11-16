import { type BufferGeometry, Color, CylinderGeometry } from 'three';
import type { SpruceSpec } from './SpruceSpecs';
import { jitter, Triangles, type V3 } from './TriangleMesh';

export { SPRUCE_SPECS, type SpruceSpec } from './SpruceSpecs';

/**
 * The Arctic's tall spruces, after the low-poly snowy spruces in
 * `context/low-poly-tall-snowy-trees` (used as references only). Each tier is
 * a thick slab rather than a cone: a rim of eight points, each its own reach
 * (and one side shorter on a lopsided tree), so the outline is a blunt,
 * lopsided polygon, never a star; the rim stands a short edge thick, its
 * points drooping; above it the top climbs to a mid ring and on to the
 * tier's middle, gently domed; underneath it closes back to the trunk. Every
 * tier sits a little off the trunk's line, turned and tipped. Snow lies on
 * the tops as a shell a few centimetres proud: on a laden tree out to the
 * rims and hanging down them a different depth at each point, so a ragged
 * band of dark green shows beneath; on a dusted one only round the middle of
 * each tier; on a plain tree not at all. The top tier is drawn taller, so the
 * tree ends in its point.
 * The trunk tapers and bends a little, flares at its foot, and on a
 * high-crowned tree carries stubs of old branches. One mesh in vertex
 * colours; `detail` 0 is the far stand-in (five points a rim, no mid ring,
 * no hanging snow, no stubs or flared foot).
 */

const SNOW = new Color('#eef2f5');
/** A tier's height over the spacing between tiers, by default. */
const OVERLAP = 1.55;
/** The mid ring: this share of the rim's reach out, this share of the tier's height up. */
const MID_OUT = 0.55;
const MID_UP = 0.62;
/** The rim's lower edge is drawn in to this share of its upper edge's reach. */
const RIM_IN = 0.95;
/** The underside meets the trunk this share of the tier's height above the rim's lower edge. */
const HUB_UP = 0.3;
/** A tier's reach strays this much from the even taper; its rim points' angles this share of their spacing. */
const REACH_JITTER = 0.13;
const ANGLE_JITTER = 0.3;
/** The snow stands this far proud of the green: up, and out. */
const CAP_UP = 0.07;
const CAP_OUT = 1.03;
/** A point's snow reaches this many times the tree's share of the way out, give or take this much. */
const CAP_FULL = 1.18;
const CAP_RAG = 0.18;
/** Where the snow reaches a rim it hangs this share of the rim's thickness down it, and this much more at most. */
const LIP = 0.3;
const LIP_RAG = 0.45;
/** The crown's stub: this tall, this wide at its foot and its top. */
/** The top tier is drawn this many times as tall as the others, so the tree ends in its point. */
const TOP_TIER = 1.8;
/** Shades of a tier's green: its rim, its underside; and how much a tier strays. */
const RIM_SHADE = 0.82;
const UNDER_SHADE = 0.6;
const TIER_JITTER = 0.06;

interface Tier {
  y: number;
  h: number;
  t: number;
  r: number;
  dx: number;
  dz: number;
  turn: number;
  /** The tier's tip: which way its slope runs, and how steep. */
  tipDir: number;
  tip: number;
}

/** The tree's tiers, laid out from its spec. */
function tiersOf(spec: SpruceSpec): Tier[] {
  const n = spec.tiers;
  const overlap = spec.overlap ?? OVERLAP;
  // The top tier, drawn taller, ends at the tree's top.
  const spacing = (spec.top - spec.foot) / (n - 1 + overlap * TOP_TIER);
  return Array.from({ length: n }, (_, i) => {
    const t = n > 1 ? i / (n - 1) : 0;
    const taper = 1 - Math.pow(t, spec.fullness ?? 1);
    const j = (k: number) => jitter(spec.salt, i, k);
    return {
      y: spec.foot + i * spacing,
      h: spacing * overlap * (i === n - 1 ? TOP_TIER : 1),
      t: spec.thickness * (0.85 + 0.3 * Math.abs(j(1))),
      r: (spec.topReach + (spec.reach - spec.topReach) * taper) * (1 + REACH_JITTER * j(2)),
      dx: (spec.lean ?? 0) * t * t + spec.offset * j(3),
      dz: spec.offset * j(4),
      turn: Math.PI * j(5),
      tipDir: Math.PI * j(6),
      tip: spec.tilt * j(7),
    };
  });
}

/** A point `x`, `y`, `z` in the tier's own frame (about its axis) placed on the tree: shifted, and tipped. */
function place(tier: Tier, x: number, y: number, z: number): V3 {
  const lift = (x * Math.cos(tier.tipDir) + z * Math.sin(tier.tipDir)) * tier.tip;
  return [tier.dx + x, y + lift, tier.dz + z];
}

/** The tier's rings in its own frame: rim (upper and lower edge), mid ring, and the angle and reach of each point. */
function tierRings(spec: SpruceSpec, tier: Tier, i: number, points: number) {
  const lopDir = spec.salt * 1.7;
  const rim: [number, number, number][] = [];
  const low: [number, number, number][] = [];
  const mid: [number, number, number][] = [];
  for (let k = 0; k < points; k++) {
    const a =
      tier.turn +
      (2 * Math.PI * k) / points +
      jitter(spec.salt, i, 10 + k) * ANGLE_JITTER * (Math.PI / points);
    const lop = 1 - (spec.lopside ?? 0) * 0.5 * (1 + Math.cos(a - lopDir));
    const r = tier.r * (1 + spec.jag * jitter(spec.salt, i, 30 + k)) * lop;
    const droop = spec.droop * r * (0.7 + 0.3 * jitter(spec.salt, i, 50 + k));
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    rim.push([ca * r, tier.y - droop, sa * r]);
    low.push([ca * r * RIM_IN, tier.y - droop - tier.t, sa * r * RIM_IN]);
    mid.push([ca * r * MID_OUT, tier.y + tier.h * MID_UP - droop * 0.25, sa * r * MID_OUT]);
  }
  return { rim, low, mid };
}

/** Outward from the tree's axis at `p`, tipped up or down. */
const outward = (p: V3, up: number): V3 => [p[0], up, p[2]];

function lerp3(a: V3, b: V3, u: number): V3 {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

/** The whole tree, foliage, snow, stub and trunk, in vertex colours from the region's two pine greens and its trunk colour. */
export function spruceGeometry(
  spec: SpruceSpec,
  greens: readonly [Color, Color],
  trunk: Color,
  detail: 0 | 1,
): BufferGeometry {
  const m = new Triangles();
  const tiers = tiersOf(spec);
  const points = detail ? spec.spokes : 5;
  const green = greens[0].clone().lerp(greens[1], spec.green).multiplyScalar(spec.shade);
  tiers.forEach((tier, i) => {
    const { rim, low, mid } = tierRings(spec, tier, i, points);
    const at = (p: readonly number[]) => place(tier, p[0]!, p[1]!, p[2]!);
    const centre = at([0, tier.y + tier.h, 0]);
    const hub = at([0, tier.y - tier.t + tier.h * HUB_UP, 0]);
    // The rings the top climbs through, from its middle out to the rim.
    const rings: V3[][] = detail ? [mid.map(at), rim.map(at)] : [rim.map(at)];
    const lows = low.map(at);
    const own = 1 + TIER_JITTER * jitter(spec.salt, i, 90);
    m.colour.copy(green).multiplyScalar(own);
    for (let k = 0; k < points; k++) {
      const k1 = (k + 1) % points;
      m.tri(centre, rings[0]![k]!, rings[0]![k1]!, outward(rings[0]![k]!, 1));
      for (let g = 0; g + 1 < rings.length; g++)
        m.quad(
          rings[g]![k]!,
          rings[g + 1]![k]!,
          rings[g + 1]![k1]!,
          rings[g]![k1]!,
          outward(rings[g + 1]![k]!, 0.8),
        );
    }
    // The rim's edge, and the underside back to the trunk.
    const edge = rings[rings.length - 1]!;
    m.colour.copy(green).multiplyScalar(own * RIM_SHADE);
    for (let k = 0; k < points; k++) {
      const k1 = (k + 1) % points;
      m.quad(edge[k]!, edge[k1]!, lows[k1]!, lows[k]!, outward(edge[k]!, 0));
    }
    m.colour.copy(green).multiplyScalar(own * UNDER_SHADE);
    for (let k = 0; k < points; k++) m.tri(hub, lows[k]!, lows[(k + 1) % points]!, [0, -1, 0]);
    if (spec.snow > 0) snowCap(m, spec, tier, i, points, centre, rings, edge, detail);
  });
  trunkParts(m, spec, trunk, detail);
  return m.build();
}

/**
 * The snow on a tier's top: from its middle out along the top's profile to
 * each point's own reach, a few centimetres proud; where it reaches the rim
 * it hangs down it, deeper at some points than others.
 */
function snowCap(
  m: Triangles,
  spec: SpruceSpec,
  tier: Tier,
  i: number,
  points: number,
  centre: V3,
  rings: V3[][],
  edge: V3[],
  detail: 0 | 1,
) {
  // Along the top's profile at `p` (0 the middle, rings.length the rim) at point `k`.
  const profile = (k: number, p: number): V3 => {
    if (p <= 1) return lerp3(centre, rings[0]![k]!, p);
    const g = Math.min(rings.length - 1, Math.floor(p));
    const u = p - g;
    return u <= 0 ? rings[g - 1]![k]! : lerp3(rings[g - 1]![k]!, rings[g]![k]!, u);
  };
  const proud = (p: V3): V3 => {
    const [ax, , az] = [tier.dx, 0, tier.dz];
    return [ax + (p[0] - ax) * CAP_OUT, p[1] + CAP_UP, az + (p[2] - az) * CAP_OUT];
  };
  const steps = rings.length;
  const reach = Array.from({ length: points }, (_, k) =>
    Math.min(1, spec.snow * CAP_FULL * (1 + CAP_RAG * jitter(spec.salt, i, 70 + k))),
  );
  // Rings of the cap: halfway out (near only) and at its edge.
  const capRings: V3[][] = (detail ? [0.5, 1] : [1]).map((f) =>
    reach.map((rk, k) => proud(profile(k, rk * steps * f))),
  );
  const top = proud(centre);
  m.colour.copy(SNOW);
  for (let k = 0; k < points; k++) {
    const k1 = (k + 1) % points;
    m.tri(top, capRings[0]![k]!, capRings[0]![k1]!, outward(capRings[0]![k]!, 1));
    for (let g = 0; g + 1 < capRings.length; g++)
      m.quad(
        capRings[g]![k]!,
        capRings[g + 1]![k]!,
        capRings[g + 1]![k1]!,
        capRings[g]![k1]!,
        outward(capRings[g + 1]![k]!, 0.8),
      );
  }
  if (!detail) return;
  // Hanging down the rim where both points of an edge are snowed to it.
  const outer = capRings[capRings.length - 1]!;
  const drop = (k: number) =>
    tier.t * (LIP + LIP_RAG * (0.5 + 0.5 * jitter(spec.salt, i, 110 + k)));
  m.colour.copy(SNOW).multiplyScalar(0.94);
  for (let k = 0; k < points; k++) {
    const k1 = (k + 1) % points;
    if (reach[k]! < 0.97 || reach[k1]! < 0.97) continue;
    const a = outer[k]!;
    const b = outer[k1]!;
    const a2: V3 = [a[0], a[1] - CAP_UP - drop(k), a[2]];
    const b2: V3 = [b[0], b[1] - CAP_UP - drop(k1), b[2]];
    m.quad(a, b, b2, a2, outward(edge[k]!, 0));
  }
}

/** The trunk up into the crown, a little bent, its foot flared; stubs of old branches; a drift of snow round the foot. */
function trunkParts(m: Triangles, spec: SpruceSpec, trunk: Color, detail: 0 | 1) {
  const h = spec.top * 0.82;
  const r = spec.trunk;
  const bend = (spec.lean ?? 0) * 0.6 + 0.12 * jitter(spec.salt, 0, 140);
  const body = new CylinderGeometry(r * 0.35, r, h, 6).translate(0, h / 2, 0);
  const p = body.getAttribute('position');
  for (let v = 0; v < p.count; v++) {
    const u = p.getY(v) / h;
    p.setX(v, p.getX(v) + bend * u * u);
  }
  m.colour.copy(trunk);
  m.add(body);
  // Far off the foot's flare and the old branches' stubs are lost: the stand-in leaves them out.
  if (detail)
    m.add(new CylinderGeometry(r * 0.95, r * 1.5, 0.35, 6).rotateY(0.4).translate(0, 0.12, 0));
  const stubs = detail ? (spec.stubs ?? 0) : 0;
  m.colour.copy(trunk).multiplyScalar(1.3);
  for (let s = 0; s < stubs; s++) {
    const y = 1.4 + ((spec.foot - 1.9) * (s + 0.5)) / stubs;
    const len = 0.4 + 0.25 * (0.5 + 0.5 * jitter(spec.salt, s, 150));
    const a = s * 2.4 + jitter(spec.salt, s, 151);
    const ry = r * (1 - (0.65 * y) / h);
    m.add(
      new CylinderGeometry(0.025, 0.05, len, 4)
        .translate(0, len / 2, 0)
        .rotateZ(-(Math.PI / 2 - 0.45))
        .rotateY(a)
        .translate(Math.cos(-a) * ry, y, Math.sin(-a) * ry),
    );
  }
  if (spec.snow > 0) {
    m.colour.copy(SNOW);
    m.add(new CylinderGeometry(0.95, 1.3, 0.28, 7).translate(0, 0.12, 0));
  }
}
