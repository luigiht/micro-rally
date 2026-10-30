/**
 * Lofted low-poly car hull. A hull is a list of cross-section stations along
 * the car's length; each gives the heights of floor, sill top, belt line and
 * roof, and the half-widths at sill, belt and roof. Consecutive stations are
 * joined with quads, the ends are capped, and every face gets a flat colour
 * by band (underside, wheel well, sill, paint, stripe, glass, roof). Wheel
 * wells are cut by inserting stations around each axle and lifting the lower
 * edge along a circle. Deck decals (bonnet stripes, badges, vents) split the
 * top faces along x so they follow the surface exactly. Output is plain
 * arrays so this module stays free of three.js and unit-testable.
 */
import type { CarSpec } from '@/game/vehicle/CarSpec';

export interface HullStation {
  z: number;
  floor: number;
  sill: number;
  belt: number;
  roof: number;
  xSill: number;
  xBody: number;
  xRoof: number;
  /** The glass faces from this station to the next (side glass, or the screen where the roof meets the belt). */
  glass?: boolean;
}

export interface HullColors {
  body: string;
  trim: string;
  glass: string;
  /** Band(s) just under the belt line, listed top to bottom; omitted = body colour. */
  stripe?: string | readonly string[];
  /** Roof panel over the cabin; omitted = body colour. */
  roof?: string;
}

export interface WheelWells {
  /** Axle positions along the car. */
  zs: readonly number[];
  /** Opening radius, a little more than the tyre. */
  radius: number;
  axleY: number;
  /** Half-width of the inner well wall, inboard of the tyre. */
  xInner: number;
}

/** A painted patch on the top surface (bonnet, roof, deck); never drawn over glass. */
export interface DeckDecal {
  /** Signed x range across the car, x0 < x1. */
  x0: number;
  x1: number;
  /** Length range along the car, z0 < z1. */
  z0: number;
  z1: number;
  color: string;
  /** Also paint the range mirrored about the centre line. */
  mirror?: boolean;
}

export interface HullSpec {
  stations: readonly HullStation[];
  colors: HullColors;
  wells?: WheelWells;
  /** Stripe band as offsets below the belt line, [bottom, top]. */
  stripeBand?: readonly [number, number];
  /** Painted onto the top faces in order; later decals win where they overlap. */
  deck?: readonly DeckDecal[];
}

export interface HullMesh {
  /** Non-indexed triangle soup, xyz per vertex. */
  positions: Float32Array;
  /** rgb per vertex, flat per face. */
  colors: Float32Array;
}

/** Wheel wells matching a car's axles and tyres, with clearance. */
export function wellsFor(spec: CarSpec): WheelWells {
  return {
    zs: [spec.cgToFront, -spec.cgToRear],
    radius: spec.wheelRadius + 0.08,
    axleY: spec.wheelRadius,
    xInner: spec.trackWidth / 2 - 0.2,
  };
}

type V3 = [number, number, number];
type V2 = [number, number];

interface Station extends HullStation {
  /** Lower edge of the side at this z: the floor, or the wheel-well arch. */
  low: number;
  /** Index of the user segment this station starts (inserted stations inherit it). */
  seg: number;
}

/** What a band between two profile points is painted as. */
type Band = 'trim' | 'body' | 'side' | 'top' | { stripe: number };

const DEFAULT_STRIPE_BAND: readonly [number, number] = [0.16, 0.08];
/** A cabin needs this much roof above the belt to count as a greenhouse. */
const CABIN_MIN_HEIGHT = 0.05;
/** Where extra stations go across each wheel well, as fractions of its radius. */
const WELL_STEPS = [-1, -0.8, -0.55, -0.28, 0, 0.28, 0.55, 0.8, 1];

/** sRGB hex → linear RGB, which is what a vertex colour attribute holds. */
function hexToRgb(hex: string): V3 {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Index of the user segment containing `z`. */
function segmentAt(stations: readonly HullStation[], z: number): number {
  let i = 0;
  while (i < stations.length - 2 && stations[i + 1]!.z <= z) i++;
  return i;
}

/** Linear blend of the two user stations around `z`. */
function interpolate(stations: readonly HullStation[], z: number): HullStation {
  const i = segmentAt(stations, z);
  const a = stations[i]!;
  const b = stations[i + 1]!;
  const t = b.z === a.z ? 0 : Math.min(1, Math.max(0, (z - a.z) / (b.z - a.z)));
  return {
    z,
    floor: lerp(a.floor, b.floor, t),
    sill: lerp(a.sill, b.sill, t),
    belt: lerp(a.belt, b.belt, t),
    roof: lerp(a.roof, b.roof, t),
    xSill: lerp(a.xSill, b.xSill, t),
    xBody: lerp(a.xBody, b.xBody, t),
    xRoof: lerp(a.xRoof, b.xRoof, t),
  };
}

/** Height of the lower side edge at `z`: the floor, lifted along any wheel-well arch. */
function lowEdge(floor: number, z: number, wells: WheelWells | undefined): number {
  if (!wells) return floor;
  let low = floor;
  for (const wz of wells.zs) {
    const dz = z - wz;
    if (Math.abs(dz) < wells.radius) {
      low = Math.max(low, wells.axleY + Math.sqrt(wells.radius ** 2 - dz * dz));
    }
  }
  return low;
}

/** User stations plus the extra ones that shape each wheel well, sorted along z. */
function expandStations(spec: HullSpec): Station[] {
  const zs = new Set(spec.stations.map((s) => s.z));
  const first = spec.stations[0]!.z;
  const last = spec.stations[spec.stations.length - 1]!.z;
  const add = (z: number) => {
    if (z > first + 1e-3 && z < last - 1e-3) zs.add(Math.round(z * 1e4) / 1e4);
  };
  for (const wz of spec.wells?.zs ?? []) {
    for (const f of WELL_STEPS) add(wz + f * spec.wells!.radius);
  }
  for (const d of spec.deck ?? []) {
    add(d.z0);
    add(d.z1);
  }
  return [...zs]
    .sort((a, b) => a - b)
    .map((z) => {
      const user = spec.stations.findIndex((u) => u.z === z);
      const s = user >= 0 ? spec.stations[user]! : interpolate(spec.stations, z);
      const seg = user >= 0 ? user : segmentAt(spec.stations, z);
      return { ...s, low: lowEdge(s.floor, z, spec.wells), seg };
    });
}

/** Left-side profile points, bottom centre to top centre (x ≥ 0), with the band kind after each point. */
function profile(
  s: Station,
  xInner: number,
  stripes: number,
  band: readonly [number, number],
): { pts: V2[]; kinds: Band[] } {
  const inner = Math.min(xInner, s.xSill);
  const sillTop = Math.max(s.sill, s.low);
  const stripeLo = Math.max(s.belt - band[0], sillTop);
  const stripeHi = Math.max(s.belt - band[1], stripeLo);
  const pts: V2[] = [
    [0, s.floor],
    [inner, s.floor],
    [inner, s.low],
    [s.xSill, s.low],
    [s.xBody, sillTop],
    [s.xBody, stripeLo],
  ];
  const kinds: Band[] = ['trim', 'trim', 'trim', 'trim', 'body'];
  for (let k = 0; k < stripes; k++) {
    pts.push([s.xBody, stripeLo + ((stripeHi - stripeLo) * (k + 1)) / stripes]);
    // Stripe colours are listed top to bottom; sub-band 0 is the lowest.
    kinds.push({ stripe: stripes - 1 - k });
  }
  pts.push([s.xBody, Math.max(s.belt, stripeHi)], [s.xRoof, s.roof], [0, s.roof]);
  kinds.push('body', 'side', 'top');
  return { pts, kinds };
}

/** Outward normal (in the cross-section plane) of profile edge k, for the left side. */
function edgeNormal(p: V2[], k: number): V2 {
  const dx = p[k + 1]![0] - p[k]![0];
  const dy = p[k + 1]![1] - p[k]![1];
  const len = Math.hypot(dx, dy) || 1;
  return [dy / len, -dx / len];
}

function bandColor(
  c: HullColors,
  stripes: readonly string[],
  kind: Band,
  side: 'glass' | 'paint',
  top: 'glass' | 'roof' | 'paint',
): string {
  if (kind === 'trim') return c.trim;
  if (kind === 'body') return c.body;
  if (kind === 'side') return side === 'glass' ? c.glass : c.body;
  if (kind === 'top')
    return top === 'glass' ? c.glass : top === 'roof' ? (c.roof ?? c.body) : c.body;
  return stripes[kind.stripe] ?? c.body;
}

/** Decals as absolute-x intervals on one side of the car (sgn = +1 left, -1 right). */
function decalsOnSide(
  deck: readonly DeckDecal[],
  z: number,
  sgn: 1 | -1,
): { a: number; b: number; color: string }[] {
  const out: { a: number; b: number; color: string }[] = [];
  for (const d of deck) {
    if (z < d.z0 || z > d.z1) continue;
    for (const m of d.mirror ? [1, -1] : [1]) {
      const lo = Math.min(d.x0 * m, d.x1 * m) * sgn;
      const hi = Math.max(d.x0 * m, d.x1 * m) * sgn;
      const a = Math.max(0, Math.min(lo, hi));
      const b = Math.max(lo, hi);
      if (b > a + 1e-6) out.push({ a, b, color: d.color });
    }
  }
  return out;
}

export function buildCarHull(spec: HullSpec): HullMesh {
  const pos: number[] = [];
  const col: number[] = [];
  const colorOf = new Map<string, V3>();
  const rgb = (hex: string) => {
    let v = colorOf.get(hex);
    if (!v) colorOf.set(hex, (v = hexToRgb(hex)));
    return v;
  };

  function tri(a: V3, b: V3, c: V3, expected: V3, color: V3): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (Math.hypot(nx, ny, nz) < 1e-7) return;
    const flip = nx * expected[0] + ny * expected[1] + nz * expected[2] < 0;
    for (const p of flip ? [a, c, b] : [a, b, c]) {
      pos.push(p[0], p[1], p[2]);
      col.push(color[0], color[1], color[2]);
    }
  }

  function quad(a: V3, b: V3, c: V3, d: V3, expected: V3, color: V3): void {
    tri(a, b, c, expected, color);
    tri(a, c, d, expected, color);
  }

  const st = expandStations(spec);
  const xInner = spec.wells?.xInner ?? Infinity;
  const stripes =
    spec.colors.stripe === undefined
      ? []
      : typeof spec.colors.stripe === 'string'
        ? [spec.colors.stripe]
        : spec.colors.stripe;
  const band = spec.stripeBand ?? DEFAULT_STRIPE_BAND;
  const deck = spec.deck ?? [];
  const profiles = st.map((s) => profile(s, xInner, Math.max(1, stripes.length), band));
  const bands = profiles[0]!.kinds.length;
  const users = spec.stations;
  const isCabin = (u: HullStation) => u.roof > u.belt + CABIN_MIN_HEIGHT;

  for (let i = 0; i < st.length - 1; i++) {
    const p0 = profiles[i]!.pts;
    const p1 = profiles[i + 1]!.pts;
    const z0 = st[i]!.z;
    const z1 = st[i + 1]!.z;
    // Paint by the user segment this piece belongs to, so wheel-well stations never split a screen.
    const a = users[st[i]!.seg]!;
    const b = users[Math.min(users.length - 1, st[i]!.seg + 1)]!;
    const flagged = Boolean(a.glass);
    const cabin0 = isCabin(a);
    const cabin1 = isCabin(b);
    const side = flagged && (cabin0 || cabin1) ? 'glass' : 'paint';
    // The top band is the roof over the cabin, and the windscreen / rear glass
    // where the roof meets the belt on one side of the segment only.
    const top = cabin0 && cabin1 ? 'roof' : flagged && cabin0 !== cabin1 ? 'glass' : 'paint';
    const zMid = (z0 + z1) / 2;
    for (let k = 0; k < bands; k++) {
      const kind = profiles[i]!.kinds[k]!;
      const base = bandColor(spec.colors, stripes, kind, side, top);
      const color = rgb(base);
      const n0 = edgeNormal(p0, k);
      const n1 = edgeNormal(p1, k);
      for (const sgn of [1, -1] as const) {
        const exp: V3 = [(n0[0] + n1[0]) * sgn, n0[1] + n1[1], 0];
        const decals = kind === 'top' && top !== 'glass' ? decalsOnSide(deck, zMid, sgn) : [];
        if (decals.length === 0) {
          const pa: V3 = [p0[k]![0] * sgn, p0[k]![1], z0];
          const pb: V3 = [p1[k]![0] * sgn, p1[k]![1], z1];
          const pc: V3 = [p1[k + 1]![0] * sgn, p1[k + 1]![1], z1];
          const pd: V3 = [p0[k + 1]![0] * sgn, p0[k + 1]![1], z0];
          quad(pa, pb, pc, pd, exp, color);
          continue;
        }
        // Split the top strip at every decal edge; the outer edge keeps each station's own width.
        const x0 = p0[k]![0];
        const x1 = p1[k]![0];
        const xMax = Math.min(x0, x1);
        const cuts = [...new Set(decals.flatMap((d) => [d.a, d.b]))]
          .filter((x) => x > 1e-6 && x < xMax - 1e-6)
          .sort((u, v) => u - v);
        const edges = [0, ...cuts, Infinity];
        for (let e = 0; e < edges.length - 1; e++) {
          const a = edges[e]!;
          const bOuter = edges[e + 1] === Infinity;
          const b0 = bOuter ? x0 : edges[e + 1]!;
          const b1 = bOuter ? x1 : edges[e + 1]!;
          const mid = (a + Math.min(b0, b1)) / 2;
          let paint = base;
          for (const d of decals) if (mid > d.a && mid < d.b) paint = d.color;
          const pa: V3 = [b0 * sgn, p0[k]![1], z0];
          const pb: V3 = [b1 * sgn, p1[k]![1], z1];
          const pc: V3 = [a * sgn, p1[k + 1]![1], z1];
          const pd: V3 = [a * sgn, p0[k + 1]![1], z0];
          quad(pa, pb, pc, pd, exp, rgb(paint));
        }
      }
    }
  }

  // End caps: strips across the car between mirrored profile points.
  for (const [i, dir] of [
    [0, -1],
    [st.length - 1, 1],
  ] as const) {
    const { pts, kinds } = profiles[i]!;
    const z = st[i]!.z;
    const expected: V3 = [0, 0, dir];
    for (let k = 0; k < bands; k++) {
      const color = rgb(kinds[k] === 'trim' ? spec.colors.trim : spec.colors.body);
      const pa: V3 = [pts[k]![0], pts[k]![1], z];
      const pb: V3 = [-pts[k]![0], pts[k]![1], z];
      const pc: V3 = [-pts[k + 1]![0], pts[k + 1]![1], z];
      const pd: V3 = [pts[k + 1]![0], pts[k + 1]![1], z];
      quad(pa, pb, pc, pd, expected, color);
    }
  }

  return { positions: new Float32Array(pos), colors: new Float32Array(col) };
}
