import type { RegionDef } from '@/game/stage/regions';
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
 * data. `dayTheme` reproduces a region's daytime look, including its dusk
 * variant. Pure TS: the builders turn these into three.js colours and materials.
 */

/**
 * A colour that may glow. `glow` > 1 bakes the colour that many times over into
 * vertex colours or sets a
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
  /** A gradient sky dome in place of the flat background (dusk); the fog matches its horizon. */
  sky?: SkyGradient;
}

/** A twilight sky: deep overhead, the fog's colour at the horizon, an afterglow where the sun went down. */
export interface SkyGradient {
  zenith: string;
  horizon: string;
  /** The wide pink band and the narrow orange one over the sunset. */
  glow: string;
  glowHot: string;
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
  /** A city's tram tracks: the sett paving between the rails, and the rail heads. */
  tramBed: string;
  rail: ThemeColor;
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

export interface SkidInk {
  color: ThemeColor;
  opacity: number;
}

export interface WorldTheme {
  lighting: ThemeLighting;
  road: RoadTheme;
  gates: GateTheme;
  walls: WallTheme;
  /** A city's garden hedges in place of its walls: the leaf body and the lighter clipped top. */
  hedges: WallTheme;
  /** The coast's block walls: concrete, between `body` and `cap` block by block. */
  seawall: WallTheme;
  /** The sea plane on Coast stages. */
  sea: string;
  /** Tyre-mark ink on every surface; null keeps the per-surface table. */
  skidInk: SkidInk | null;
  circuit: CircuitTheme;
  /** The car's headlamps and brake lamps are lit (dusk). */
  carLamps?: boolean;
}

const DAY_LIGHTING = {
  fogNear: 70,
  fogFar: 260,
  hemiSky: '#fff6e0',
  hemiGround: '#7fa05f',
  hemiIntensity: 1.9,
  sunColor: '#ffffff',
  sunIntensity: 2.6,
} as const;

/**
 * The coast's sky light: cooler and greyer than inland, where the warm sky and the green ground
 * bounce turned the shaded side of its pale limestone olive. Shadows on the cliffs read blue-grey.
 */
export const COAST_HEMI = { hemiSky: '#e6eef5', hemiGround: '#a3aa94' } as const;

/**
 * Just past sunset: an indigo sky over an afterglow, a violet haze closing in
 * nearer than by day, and little light left: a cool sky fill and a faint warm
 * glow from the west, so the snow reads blue and the car's lamps carry.
 */
export const DUSK_LIGHTING: ThemeLighting = {
  background: '#1d2448',
  fog: '#4a4a72',
  fogNear: 45,
  fogFar: 230,
  hemiSky: '#7d86c4',
  hemiGround: '#2a2c44',
  hemiIntensity: 0.55,
  sunColor: '#ffa07a',
  sunIntensity: 0.3,
  sky: { zenith: '#141a3c', horizon: '#4a4a72', glow: '#b8607a', glowHot: '#ff9a52' },
};

/** Tyre marks are drawn unlit, so after dark the snow's pale ink would glow: a faint shadow instead. */
export const DUSK_SKID_INK: SkidInk = { color: '#2b2a44', opacity: 0.3 };

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
const DAY_HEDGES: WallTheme = { body: '#4f7a3a', cap: '#6b9a48' };

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

/** Grey sett paving between tram rails, and the rails' worn steel. */
const TRAM_BED_COLOR = '#8e8b84';
const RAIL_COLOR = '#5c5e63';

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
    tramBed: TRAM_BED_COLOR,
    rail: RAIL_COLOR,
  };
}

const DAY = new Map<string, WorldTheme>();

/**
 * A region's look by day, as the game has always drawn it, or after sunset on
 * a stage that runs at dusk (`StageBrief.dusk`). Memoised, so a theme can be
 * compared by identity.
 */
export function dayTheme(region: RegionDef, dusk = false): WorldTheme {
  const key = `${region.id}${dusk ? ':dusk' : ''}`;
  let theme = DAY.get(key);
  if (!theme) {
    theme = {
      lighting: dusk
        ? DUSK_LIGHTING
        : {
            background: region.palette.sky,
            fog: region.palette.fog,
            ...DAY_LIGHTING,
            ...(region.coast ? COAST_HEMI : {}),
          },
      road: dayRoad(region.palette.shoulder),
      gates: DAY_GATES,
      walls: DAY_WALLS,
      hedges: DAY_HEDGES,
      seawall: DAY_SEAWALL,
      sea: region.coast?.sea ?? DAY_SEA,
      skidInk: dusk ? DUSK_SKID_INK : null,
      circuit: DAY_CIRCUIT,
      carLamps: dusk,
    };
    DAY.set(key, theme);
  }
  return theme;
}

/** Daytime theme for a world without a region (the test track): only sky and fog differ. */
export function flatTheme(sky: string, fog: string, shoulder = '#8fbf6a'): WorldTheme {
  return {
    lighting: { background: sky, fog, ...DAY_LIGHTING },
    road: dayRoad(shoulder),
    gates: DAY_GATES,
    walls: DAY_WALLS,
    hedges: DAY_HEDGES,
    seawall: DAY_SEAWALL,
    sea: DAY_SEA,
    skidInk: null,
    circuit: DAY_CIRCUIT,
  };
}
