import type { RegionDef, RegionId } from '@/game/stage/regions';
import type { Surface } from '@/game/vehicle/surfaces';
import {
  CAP_COLOR,
  KERB_COLOR,
  LINE_COLOR,
  PAVEMENT_COLOR,
  POST_COLOR,
  ROAD_COLORS,
} from '../road/roadColors';

/**
 * Everything the stage renderer needs to know about colour and light, as plain
 * data. `dayTheme` reproduces a region's daytime look exactly; `NIGHTCITY_THEME`
 * is the hidden cyberpunk re-skin the N key toggles. Pure TS: the builders turn
 * these into three.js colours and materials through `themeColor.ts`.
 */

/**
 * A colour that may glow. `glow` > 1 bakes the colour that many times over into
 * vertex colours (HDR, so the neon shader patch and bloom pick it up) or sets a
 * material's emissive intensity; 0 < glow < 1 is the faint self-light only a
 * material can show (the start gantry's tiles). A plain string never glows.
 */
export type ThemeColor = string | { hex: string; glow: number };

export interface ThemeLighting {
  background: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sunColor: string;
  sunIntensity: number;
}

export interface RoadTheme {
  /** Daytime carriageway colour per surface. */
  surfaces: Readonly<Record<Surface, string>>;
  /** Overrides `surfaces` on every stage when set (one dark asphalt at night). */
  surface: string | null;
  /** Lay snow patches over snow stages' asphalt. */
  snowPatches: boolean;
  /** Verge strips either side of the ribbon (the region's shoulder by day). */
  verge: string;
  line: ThemeColor;
  pavement: string;
  kerb: ThemeColor;
  post: string;
  cap: ThemeColor;
  /** Patch the surface material so HDR vertex colours are drawn as emission. */
  neon: boolean;
}

export interface GateTheme {
  post: string;
  /** Alternating gantry tiles. */
  start: readonly [ThemeColor, ThemeColor];
  finish: readonly [ThemeColor, ThemeColor];
  board: ThemeColor;
  clock: ThemeColor;
  ink: string;
}

export interface WallTheme {
  body: string;
  cap: string;
}

/** A circuit's trackside: kerb stripes, Armco and catch fencing, gravel, the painted start line and grid, the grandstand. */
export interface CircuitTheme {
  kerb: readonly [ThemeColor, ThemeColor];
  rail: string;
  railPost: string;
  fence: string;
  gravel: string;
  /** Chequered start/finish line, and the white grid slots behind it. */
  chequer: readonly [ThemeColor, ThemeColor];
  grid: ThemeColor;
  stand: { seats: string; frame: string; roof: ThemeColor };
}

/** `palette`: the worker's baked per-face colours; `flat`: one colour, the bake ignored. */
export type TerrainTheme = { mode: 'palette' } | { mode: 'flat'; color: string };

export type SceneryKitId = 'rally' | 'nightcity';

export interface SkidInk {
  color: ThemeColor;
  opacity: number;
}

export interface WorldTheme {
  id: 'day' | 'nightcity';
  lighting: ThemeLighting;
  terrain: TerrainTheme;
  road: RoadTheme;
  gates: GateTheme;
  walls: WallTheme;
  /** The coast's block walls: concrete, between `body` and `cap` block by block. */
  seawall: WallTheme;
  /** The sea plane on Coast stages. */
  sea: string;
  scenery: { kit: SceneryKitId };
  /** Tyre-mark ink on every surface; null keeps the per-surface table. */
  skidInk: SkidInk | null;
  circuit: CircuitTheme;
}

/** The hues Nightcity is lit in; kits and the car pick from these by hash. */
export const NEON = {
  cyan: '#19e6ff',
  magenta: '#ff2bd6',
  amber: '#ffb020',
  violet: '#7a3cff',
} as const;

const DAY_LIGHTING = {
  fogNear: 70,
  fogFar: 260,
  hemiSky: '#fff6e0',
  hemiGround: '#7fa05f',
  hemiIntensity: 1.9,
  sunColor: '#ffffff',
  sunIntensity: 2.6,
} as const;

const DAY_GATES: GateTheme = {
  post: '#d9d4c7',
  start: [
    { hex: '#4f9d69', glow: 0.25 },
    { hex: '#f4f1e8', glow: 0.25 },
  ],
  finish: ['#2b2a33', '#f4f1e8'],
  board: '#f4f1e8',
  clock: '#f2c14e',
  ink: '#2b2a33',
};

const DAY_WALLS: WallTheme = { body: '#c9c0b0', cap: '#e3dccf' };

/** Red-and-white kerbs, galvanised Armco on grey posts, dark mesh fencing, pale gravel, a blue-and-white grandstand. */
const DAY_CIRCUIT: CircuitTheme = {
  kerb: ['#d9343a', '#f4f1ea'],
  rail: '#b9bec4',
  railPost: '#8c9196',
  fence: '#4c5258',
  gravel: '#cdbf9c',
  chequer: ['#f4f1ea', '#2b2a33'],
  grid: '#f4f1ea',
  stand: { seats: '#2f6db5', frame: '#8c9196', roof: '#e8e4da' },
};
/** Concrete blocks for the coast's walls; the sea itself is the region's, with a default for worlds without a coast. */
const DAY_SEAWALL: WallTheme = { body: '#aeaba3', cap: '#d6d3cb' };
const DAY_SEA = '#3b8fb5';

/** The daytime road: region shoulder for the verges, white lines, concrete pavements. */
export function dayRoad(shoulder: string): RoadTheme {
  return {
    surfaces: ROAD_COLORS,
    surface: null,
    snowPatches: true,
    verge: shoulder,
    line: LINE_COLOR,
    pavement: PAVEMENT_COLOR,
    kerb: KERB_COLOR,
    post: POST_COLOR,
    cap: CAP_COLOR,
    neon: false,
  };
}

const DAY = new Map<RegionId, WorldTheme>();

/** A region's daytime look, as the game has always drawn it. Memoised, so a theme can be compared by identity. */
export function dayTheme(region: RegionDef): WorldTheme {
  let theme = DAY.get(region.id);
  if (!theme) {
    theme = {
      id: 'day',
      lighting: { background: region.palette.sky, fog: region.palette.fog, ...DAY_LIGHTING },
      terrain: { mode: 'palette' },
      road: dayRoad(region.palette.shoulder),
      gates: DAY_GATES,
      walls: DAY_WALLS,
      seawall: DAY_SEAWALL,
      sea: region.coast?.sea ?? DAY_SEA,
      scenery: { kit: 'rally' },
      skidInk: null,
      circuit: DAY_CIRCUIT,
    };
    DAY.set(region.id, theme);
  }
  return theme;
}

/** Daytime theme for a world without a region (the test track): only sky and fog differ. */
export function flatTheme(sky: string, fog: string, shoulder = '#8fbf6a'): WorldTheme {
  return {
    id: 'day',
    lighting: { background: sky, fog, ...DAY_LIGHTING },
    terrain: { mode: 'palette' },
    road: dayRoad(shoulder),
    gates: DAY_GATES,
    walls: DAY_WALLS,
    seawall: DAY_SEAWALL,
    sea: DAY_SEA,
    scenery: { kit: 'rally' },
    skidInk: null,
    circuit: DAY_CIRCUIT,
  };
}

/**
 * Nightcity: pitch-black sky, a cold moon, dark ground and asphalt, and every
 * line, kerb, cap and tile in neon. The fog sits just above the background so
 * towers dissolve into the dark without a band, and closer than by day.
 */
export const NIGHTCITY_THEME: WorldTheme = {
  id: 'nightcity',
  lighting: {
    background: '#02030a',
    fog: '#07080f',
    fogNear: 40,
    fogFar: 200,
    hemiSky: '#4a5680',
    hemiGround: '#0c0e16',
    hemiIntensity: 1.6,
    sunColor: '#8d9cd8',
    sunIntensity: 1.0,
  },
  terrain: { mode: 'flat', color: '#1a1e2b' },
  road: {
    surfaces: ROAD_COLORS,
    surface: '#2b2f3b',
    snowPatches: false,
    verge: '#1c2030',
    line: { hex: NEON.cyan, glow: 2.2 },
    pavement: '#323645',
    kerb: { hex: NEON.magenta, glow: 1.8 },
    post: '#15171f',
    cap: { hex: NEON.amber, glow: 2.5 },
    neon: true,
  },
  gates: {
    post: '#15171f',
    start: [
      { hex: NEON.cyan, glow: 2.5 },
      { hex: NEON.violet, glow: 2.5 },
    ],
    finish: [
      { hex: NEON.magenta, glow: 2.5 },
      { hex: NEON.amber, glow: 2.5 },
    ],
    board: '#1a1c26',
    clock: { hex: NEON.amber, glow: 2.5 },
    ink: '#05060a',
  },
  walls: { body: '#1e2130', cap: '#2e3345' },
  seawall: { body: '#171a26', cap: '#2a2f41' },
  sea: '#0a1424',
  scenery: { kit: 'nightcity' },
  skidInk: { color: { hex: NEON.cyan, glow: 2 }, opacity: 0.85 },
  circuit: {
    kerb: [
      { hex: NEON.magenta, glow: 1.8 },
      { hex: NEON.cyan, glow: 1.8 },
    ],
    rail: '#3a3f52',
    railPost: '#15171f',
    fence: '#232736',
    gravel: '#262a38',
    chequer: [{ hex: NEON.cyan, glow: 2 }, '#05060a'],
    grid: { hex: NEON.cyan, glow: 2 },
    stand: { seats: '#1e2130', frame: '#15171f', roof: { hex: NEON.violet, glow: 1.5 } },
  },
};
