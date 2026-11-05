import type { CoastDef, RegionPalette } from '@/game/stage/regions';
import type { TerrainField, TerrainSample } from '@/game/stage/TerrainField';
import { coastFaceColor, type CoastFace, type CoastTones } from './coastFaceColor';

export type Rgb = readonly [number, number, number];

export interface TerrainColors {
  grassLow: Rgb;
  grassHigh: Rgb;
  rock: Rgb;
  shoulder: Rgb;
  /** Coast stages: dry sand up to a metre above `seaLevel`, wet sand under the water. */
  sand?: Rgb;
  sandWet?: Rgb;
  seaLevel?: number;
  /** Faces turn to rock from this much tilt (1 − normal.y): `ROCK_FROM` unless set, lower on the stony coast. */
  rockFrom?: number;
  /** Coast stages: strata, scree and scrub tones, coloured by `coastFaceColor` in place of the plain rock blend. */
  coast?: CoastTones;
}

/** Hills go rocky past about 44° of tilt; the coast's limestone past about 37°, so its scrub hillside stays green. */
const ROCK_FROM = 0.28;
const COAST_ROCK_FROM = 0.2;

export interface ChunkMeshData {
  cx: number;
  cz: number;
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Hex colour → linear RGB (vertex colours are interpreted as linear). */
export function hexToLinear(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  ];
}

export function terrainColors(p: RegionPalette, coast?: CoastDef): TerrainColors {
  const out: TerrainColors = {
    grassLow: hexToLinear(p.grassLow),
    grassHigh: hexToLinear(p.grassHigh),
    rock: hexToLinear(p.rock),
    shoulder: hexToLinear(p.shoulder),
  };
  if (coast) {
    out.sand = hexToLinear(coast.sand);
    out.sandWet = hexToLinear(coast.sandWet);
    out.seaLevel = coast.seaLevel;
    out.rockFrom = COAST_ROCK_FROM;
    out.coast = {
      rock: out.rock,
      rockLight: hexToLinear(coast.rockLight),
      rockDark: hexToLinear(coast.rockDark),
      rockWarm: hexToLinear(coast.rockWarm),
      ledge: out.grassHigh,
      scree: hexToLinear(coast.scree),
      grassDry: hexToLinear(coast.grassDry),
      scrub: hexToLinear(coast.scrub),
    };
  }
  return out;
}

function hash(i: number, j: number): number {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Flat-shaded (non-indexed) terrain chunk with per-face colours. Pure — runs in a worker. */
export function meshTerrainChunk(
  field: TerrainField,
  colors: TerrainColors,
  amplitude: number,
  cx: number,
  cz: number,
  size: number,
  res: number,
): ChunkMeshData {
  const n = res + 1;
  const step = size / res;
  const x0 = cx * size;
  const z0 = cz * size;
  const hs = new Float32Array(n * n);
  const road = new Float32Array(n * n);
  const rock = new Float32Array(n * n);
  const scree = new Float32Array(n * n);
  const dry = new Float32Array(n * n);
  const s: TerrainSample = { height: 0, roadBlend: 0, roadDistance: 0 };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      field.sample(x0 + i * step, z0 + j * step, s);
      hs[j * n + i] = s.height;
      road[j * n + i] = s.roadBlend;
      rock[j * n + i] = s.rock ?? 0;
      scree[j * n + i] = s.scree ?? 0;
      dry[j * n + i] = s.dry ?? 0;
    }
  }

  const triCount = res * res * 2;
  const positions = new Float32Array(triCount * 9);
  const normals = new Float32Array(triCount * 9);
  const cols = new Float32Array(triCount * 9);
  let o = 0;
  const face: CoastFace = {
    x: 0,
    z: 0,
    h: 0,
    ny: 1,
    rock: 0,
    scree: 0,
    dry: 0,
    hashA: 0,
    hashB: 0,
  };
  const rgb = [0, 0, 0];
  const emit = (
    ia: number,
    ib: number,
    ic: number,
    ax: number,
    az: number,
    bx: number,
    bz: number,
    qx: number,
    qz: number,
    seed: number,
  ) => {
    const ay = hs[ia]!;
    const by = hs[ib]!;
    const cy = hs[ic]!;
    // Face normal = (b - a) × (c - a).
    const ux = bx - ax,
      uy = by - ay,
      uz = bz - az;
    const vx = qx - ax,
      vy = cy - ay,
      vz = qz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    const h = (ay + by + cy) / 3;
    const t = Math.min(1, Math.max(0, h / (2 * amplitude) + 0.5));
    const jitter = 0.94 + hash(seed, cx * 7919 + cz) * 0.12;
    let r = colors.grassLow[0] + (colors.grassHigh[0] - colors.grassLow[0]) * t;
    let g = colors.grassLow[1] + (colors.grassHigh[1] - colors.grassLow[1]) * t;
    let b = colors.grassLow[2] + (colors.grassHigh[2] - colors.grassLow[2]) * t;
    let loose = 0;
    if (colors.coast) {
      // Coast: strata, scree and scrub from the field's masks and the face's tilt.
      face.x = (ax + bx + qx) / 3;
      face.z = (az + bz + qz) / 3;
      face.h = h;
      face.ny = ny;
      face.rock = (rock[ia]! + rock[ib]! + rock[ic]!) / 3;
      face.scree = loose = (scree[ia]! + scree[ib]! + scree[ic]!) / 3;
      face.dry = (dry[ia]! + dry[ib]! + dry[ic]!) / 3;
      face.hashA = hash(seed * 3 + 1, cz * 7919 + cx);
      face.hashB = hash(seed * 5 + 2, cx * 6151 - cz);
      rgb[0] = r;
      rgb[1] = g;
      rgb[2] = b;
      coastFaceColor(colors.coast, face, rgb);
      r = rgb[0]!;
      g = rgb[1]!;
      b = rgb[2]!;
    } else {
      // Steep faces go rocky.
      const tilt = Math.min(1, Math.max(0, (1 - ny - (colors.rockFrom ?? ROCK_FROM)) * 4));
      const rocky = Math.max(tilt, (rock[ia]! + rock[ib]! + rock[ic]!) / 3);
      r += (colors.rock[0] - r) * rocky;
      g += (colors.rock[1] - g) * rocky;
      b += (colors.rock[2] - b) * rocky;
    }
    if (colors.sand && colors.sandWet) {
      // Coast: dry sand from the cliff foot to the water and wet sand under it, the boulder apron excepted.
      const sea = colors.seaLevel ?? 0;
      const sandy = (1 - Math.min(1, Math.max(0, (h - sea - 1.0) / 1.6))) * (1 - loose);
      r += (colors.sand[0] - r) * sandy;
      g += (colors.sand[1] - g) * sandy;
      b += (colors.sand[2] - b) * sandy;
      const wet = 1 - Math.min(1, Math.max(0, (h - sea + 0.5) / 0.7));
      r += (colors.sandWet[0] - r) * wet;
      g += (colors.sandWet[1] - g) * wet;
      b += (colors.sandWet[2] - b) * wet;
    }
    // Dirt verge only right next to the road bed; the rest of the corridor stays grassy.
    const blend = (road[ia]! + road[ib]! + road[ic]!) / 3;
    const shoulder = Math.min(1, Math.max(0, (blend - 0.9) * 10));
    r += (colors.shoulder[0] - r) * shoulder;
    g += (colors.shoulder[1] - g) * shoulder;
    b += (colors.shoulder[2] - b) * shoulder;

    const verts = [ax, ay, az, bx, by, bz, qx, cy, qz];
    for (let k = 0; k < 3; k++) {
      positions[o] = verts[k * 3]!;
      positions[o + 1] = verts[k * 3 + 1]!;
      positions[o + 2] = verts[k * 3 + 2]!;
      normals[o] = nx;
      normals[o + 1] = ny;
      normals[o + 2] = nz;
      cols[o] = r * jitter;
      cols[o + 1] = g * jitter;
      cols[o + 2] = b * jitter;
      o += 3;
    }
  };

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const i00 = j * n + i;
      const i10 = i00 + 1;
      const i01 = i00 + n;
      const i11 = i01 + 1;
      const xa = x0 + i * step;
      const xb = xa + step;
      const za = z0 + j * step;
      const zb = za + step;
      // Counter-clockwise when viewed from above (+Y).
      emit(i00, i01, i11, xa, za, xa, zb, xb, zb, i00 * 2);
      emit(i00, i11, i10, xa, za, xb, zb, xb, za, i00 * 2 + 1);
    }
  }
  return { cx, cz, positions, normals, colors: cols };
}
