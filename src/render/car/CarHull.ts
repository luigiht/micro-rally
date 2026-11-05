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
import {
  capPatches,
  deckPatches,
  patchAt,
  patchCuts,
  sidePatches,
  type CapDecal,
  type DeckDecal,
  type SideDecal,
} from './CarHullDecals';

export type { CapDecal, DeckDecal, SideDecal } from './CarHullDecals';

export interface HullStation {
  z: number;
  floor: number;
  sill: number;
  belt: number;
  roof: number;
  xSill: number;
  xBody: number;
  xRoof: number;
  /**
   * Half-width at the belt line; omitted = `xBody`. Wider than `xBody` gives
   * the flank a shoulder (lower side leaning out to the belt, tumblehome
   * above), so bodies read as sculpted rather than slab-sided.
   */
  xBelt?: number;
  /**
   * An extra crease between the belt and the roof edge, at height `shoulder`
   * and half-width `xShoulder`, so a rounded shoulder is two planes instead
   * of one. Once any station names one, every station gets the point
   * (interpolated, or the midpoint of belt and roof where unset). Not for
   * hulls with `sideDecals`, whose across-the-band fractions assume one band.
   */
  shoulder?: number;
  xShoulder?: number;
  /** Paint for the side bands (belt to roof edge) from this station to the next where they are not glass; omitted = body. */
  sidePaint?: string;
  /** The glass faces from this station to the next (side glass, or the screen where the roof meets the belt). */
  glass?: boolean;
}

export interface HullColors {
  body: string;
  trim: string;
  glass: string;
  /** Windscreen and rear window (the glazed top faces); omitted = `glass`, which the side windows always use. */
  screen?: string;
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
  /** Facets across each arch; omitted = 8, spaced closer toward the ends. */
  segments?: number;
}

export interface HullSpec {
  stations: readonly HullStation[];
  colors: HullColors;
  wells?: WheelWells;
  /** Stripe band as offsets below the belt line, [bottom, top]. */
  stripeBand?: readonly [number, number];
  /** Painted onto the top faces in order; later decals win where they overlap. */
  deck?: readonly DeckDecal[];
  /** Painted onto the pillar band (belt line to roof edge, where it is not glass), following its twist. */
  sideDecals?: readonly SideDecal[];
  /** Painted onto the nose and tail panels. */
  capDecals?: readonly CapDecal[];
  /** Carry the stripe bands across the end caps (nose and tail) instead of painting them body colour. */
  wrapStripes?: boolean;
}

export interface HullMesh {
  /** Non-indexed triangle soup, xyz per vertex. */
  positions: Float32Array;
  /** rgb per vertex, flat per face. */
  colors: Float32Array;
  /** Vertex index where the glowing faces start (drawn unlit); the vertex count when there are none. */
  glowStart: number;
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

/** The well stations for an arch of `segments` facets: the default table, or cosine-spaced so the facets stay even along the arc. */
function wellSteps(segments: number | undefined): readonly number[] {
  if (segments === undefined) return WELL_STEPS;
  return Array.from({ length: segments + 1 }, (_, k) => -Math.cos((Math.PI * k) / segments));
}

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

/** The shoulder crease of a station: as given, or the midpoint of its belt and roof points. */
function shoulderOf(s: HullStation): { x: number; y: number } {
  return {
    x: s.xShoulder ?? ((s.xBelt ?? s.xBody) + s.xRoof) / 2,
    y: s.shoulder ?? (s.belt + s.roof) / 2,
  };
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
    xBelt: lerp(a.xBelt ?? a.xBody, b.xBelt ?? b.xBody, t),
    shoulder: lerp(shoulderOf(a).y, shoulderOf(b).y, t),
    xShoulder: lerp(shoulderOf(a).x, shoulderOf(b).x, t),
    sidePaint: a.sidePaint,
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
    for (const f of wellSteps(spec.wells!.segments)) add(wz + f * spec.wells!.radius);
  }
  for (const d of [...(spec.deck ?? []), ...(spec.sideDecals ?? [])]) {
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
  shoulders: boolean,
): { pts: V2[]; kinds: Band[] } {
  const inner = Math.min(xInner, s.xSill);
  const sillTop = Math.max(s.sill, s.low);
  const stripeLo = Math.max(s.belt - band[0], sillTop);
  const stripeHi = Math.max(s.belt - band[1], stripeLo);
  // The flank leans from xBody at the sill top to xBelt at the belt.
  const xBelt = s.xBelt ?? s.xBody;
  const flank = (y: number) =>
    s.belt <= sillTop
      ? xBelt
      : lerp(s.xBody, xBelt, Math.min(1, Math.max(0, (y - sillTop) / (s.belt - sillTop))));
  const pts: V2[] = [
    [0, s.floor],
    [inner, s.floor],
    [inner, s.low],
    [s.xSill, s.low],
    [s.xBody, sillTop],
    [flank(stripeLo), stripeLo],
  ];
  const kinds: Band[] = ['trim', 'trim', 'trim', 'trim', 'body'];
  for (let k = 0; k < stripes; k++) {
    const y = stripeLo + ((stripeHi - stripeLo) * (k + 1)) / stripes;
    pts.push([flank(y), y]);
    // Stripe colours are listed top to bottom; sub-band 0 is the lowest.
    kinds.push({ stripe: stripes - 1 - k });
  }
  pts.push([xBelt, Math.max(s.belt, stripeHi)]);
  kinds.push('body');
  if (shoulders) {
    const sh = shoulderOf(s);
    pts.push([sh.x, Math.max(sh.y, s.belt)]);
    kinds.push('side');
  }
  pts.push([s.xRoof, s.roof], [0, s.roof]);
  kinds.push('side', 'top');
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
    return top === 'glass' ? (c.screen ?? c.glass) : top === 'roof' ? (c.roof ?? c.body) : c.body;
  return stripes[kind.stripe] ?? c.body;
}

export function buildCarHull(input: HullSpec): HullMesh {
  // Stations may be listed in either direction; everything below walks them tail to nose.
  const spec: HullSpec = { ...input, stations: [...input.stations].sort((a, b) => a.z - b.z) };
  const pos: number[] = [];
  const col: number[] = [];
  // Glowing faces are kept apart and appended last, so the mesh can draw them unlit as one group.
  const glowPos: number[] = [];
  const glowCol: number[] = [];
  const colorOf = new Map<string, V3>();
  const rgb = (hex: string) => {
    let v = colorOf.get(hex);
    if (!v) colorOf.set(hex, (v = hexToRgb(hex)));
    return v;
  };

  function tri(a: V3, b: V3, c: V3, expected: V3, color: V3, glow = false): void {
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
    const p3 = glow ? glowPos : pos;
    const c3 = glow ? glowCol : col;
    for (const p of flip ? [a, c, b] : [a, b, c]) {
      p3.push(p[0], p[1], p[2]);
      c3.push(color[0], color[1], color[2]);
    }
  }

  function quad(a: V3, b: V3, c: V3, d: V3, expected: V3, color: V3, glow = false): void {
    tri(a, b, c, expected, color, glow);
    tri(a, c, d, expected, color, glow);
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
  const sideDecals = spec.sideDecals ?? [];
  const capDecals = spec.capDecals ?? [];
  const shoulders = spec.stations.some((u) => u.shoulder !== undefined);
  const profiles = st.map((s) => profile(s, xInner, Math.max(1, stripes.length), band, shoulders));
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
    // Side glass needs a greenhouse at both ends; where the roof meets the belt
    // (screen and rear window) the slanted side band is a pillar, so painted.
    const side = flagged && cabin0 && cabin1 ? 'glass' : 'paint';
    // The top band is the roof over the cabin, and the windscreen / rear glass
    // where the roof meets the belt on one side of the segment only.
    const top = cabin0 && cabin1 ? 'roof' : flagged && cabin0 !== cabin1 ? 'glass' : 'paint';
    const zMid = (z0 + z1) / 2;
    for (let k = 0; k < bands; k++) {
      const kind = profiles[i]!.kinds[k]!;
      const base =
        kind === 'side' && side === 'paint' && a.sidePaint
          ? a.sidePaint
          : bandColor(spec.colors, stripes, kind, side, top);
      const color = rgb(base);
      const n0 = edgeNormal(p0, k);
      const n1 = edgeNormal(p1, k);
      for (const sgn of [1, -1] as const) {
        const exp: V3 = [(n0[0] + n1[0]) * sgn, n0[1] + n1[1], 0];
        const pillar =
          kind === 'side' && side !== 'glass' ? sidePatches(sideDecals, zMid, sgn) : [];
        if (pillar.length > 0) {
          // Split the pillar band across its width at every decal edge. Each strip still spans
          // the two stations like the band itself, so a lens painted here follows the pillar's
          // twist instead of standing proud of it.
          const at = (p: V2[], u: number, z: number): V3 => [
            lerp(p[k]![0], p[k + 1]![0], u) * sgn,
            lerp(p[k]![1], p[k + 1]![1], u),
            z,
          ];
          const edges = [0, ...patchCuts(pillar, 1), 1];
          for (let e = 0; e < edges.length - 1; e++) {
            const ua = edges[e]!;
            const ub = edges[e + 1]!;
            const hit = patchAt(pillar, (ua + ub) / 2);
            quad(
              at(p0, ua, z0),
              at(p1, ua, z1),
              at(p1, ub, z1),
              at(p0, ub, z0),
              exp,
              rgb(hit?.color ?? base),
              hit?.glow ?? false,
            );
          }
          continue;
        }
        const decals = kind === 'top' && top !== 'glass' ? deckPatches(deck, zMid, sgn) : [];
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
        const edges = [0, ...patchCuts(decals, Math.min(x0, x1)), Infinity];
        for (let e = 0; e < edges.length - 1; e++) {
          const a = edges[e]!;
          const bOuter = edges[e + 1] === Infinity;
          const b0 = bOuter ? x0 : edges[e + 1]!;
          const b1 = bOuter ? x1 : edges[e + 1]!;
          const hit = patchAt(decals, (a + Math.min(b0, b1)) / 2);
          const pa: V3 = [b0 * sgn, p0[k]![1], z0];
          const pb: V3 = [b1 * sgn, p1[k]![1], z1];
          const pc: V3 = [a * sgn, p1[k + 1]![1], z1];
          const pd: V3 = [a * sgn, p0[k + 1]![1], z0];
          quad(pa, pb, pc, pd, exp, rgb(hit?.color ?? base), hit?.glow ?? false);
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
    const end = dir < 0 ? 'tail' : 'nose';
    for (let k = 0; k < bands; k++) {
      const kind = kinds[k]!;
      const base =
        kind === 'trim'
          ? spec.colors.trim
          : spec.wrapStripes
            ? bandColor(spec.colors, stripes, kind, 'paint', 'paint')
            : spec.colors.body;
      const [xa, ya] = pts[k]!;
      const [xb, yb] = pts[k + 1]!;
      const patches = kind === 'trim' ? [] : capPatches(capDecals, end, (ya + yb) / 2, 1);
      if (patches.length === 0) {
        quad([xa, ya, z], [-xa, ya, z], [-xb, yb, z], [xb, yb, z], expected, rgb(base));
        continue;
      }
      // Split the strip along x at every decal edge, each side from the centre line out to
      // the strip's own slanted edge (a lens at a corner wraps onto the panel this way).
      for (const sgn of [1, -1] as const) {
        const side = capPatches(capDecals, end, (ya + yb) / 2, sgn);
        const edges = [0, ...patchCuts(side, Math.min(xa, xb)), Infinity];
        for (let e = 0; e < edges.length - 1; e++) {
          const a = edges[e]!;
          const outer = edges[e + 1] === Infinity;
          const b0 = outer ? xa : edges[e + 1]!;
          const b1 = outer ? xb : edges[e + 1]!;
          const hit = patchAt(side, (a + Math.min(b0, b1)) / 2);
          quad(
            [b0 * sgn, ya, z],
            [a * sgn, ya, z],
            [a * sgn, yb, z],
            [b1 * sgn, yb, z],
            expected,
            rgb(hit?.color ?? base),
            hit?.glow ?? false,
          );
        }
      }
    }
  }

  const positions = new Float32Array(pos.length + glowPos.length);
  positions.set(pos);
  positions.set(glowPos, pos.length);
  const colors = new Float32Array(col.length + glowCol.length);
  colors.set(col);
  colors.set(glowCol, col.length);
  return { positions, colors, glowStart: pos.length / 3 };
}
