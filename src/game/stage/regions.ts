import type { Surface } from '../vehicle/surfaces';
import type { BuildingStyle } from './Town';

export type RegionId =
  'forest' | 'coast' | 'desert' | 'alpine' | 'night' | 'circuit' | 'urban' | 'arctic';
export type Weather = 'clear' | 'overcast' | 'rain' | 'night';

export interface RegionPalette {
  sky: string;
  fog: string;
  grassLow: string;
  grassHigh: string;
  rock: string;
  shoulder: string;
  foliage: string;
  foliageAlt: string;
  canopy: string;
  canopyAlt: string;
  trunk: string;
  boulder: string;
}

export interface SceneryDensity {
  /** Expected items per 100 m of road, both sides combined. */
  trees: number;
  broadleaf: number;
  bushes: number;
  rocks: number;
  /** Houses per 100 m of road, well back from it. */
  houses: number;
  /** Tall spruces (the Arctic's forest wall) per 100 m of road; none when unset. */
  spruces?: number;
}

/** A region whose stages have oases (see `Oases`): how often along the road, how wide the pool, how many palms. */
export interface OasisDef {
  every: number;
  radius: number;
  palms: number;
}

/** A region whose stages run along the sea (see `Coastline`): where the water stands and what the shore wears. */
export interface CoastDef {
  seaLevel: number;
  sand: string;
  sandWet: string;
  sea: string;
  /** The limestone's strata, palest and darkest (a cool blue-grey), and its faintly warm beds; the palette's `rock` is the body. */
  rockLight: string;
  rockDark: string;
  rockWarm: string;
  /** Gravel and scree: the boulder apron, fans below the outcrops, gully beds. */
  scree: string;
  /** Sun-dried grass in patches across the hillside, and the dark maquis scrub dotted through it. */
  grassDry: string;
  scrub: string;
}

/**
 * A region whose stages run through a big city (see `UrbanPlan`,
 * `UrbanGenerator`): the whole stage is one town. Half widths of the street
 * classes the plan draws from, the roundabout islands, how much hill relief
 * the city keeps, and the mix of buildings along its streets.
 */
export interface UrbanDef {
  /** Half widths: a narrow one-way lane, two lanes, three, a four-lane boulevard. */
  lanes: { narrow: number; two: number; three: number; four: number };
  /** Roundabout island radii, smallest and largest. */
  island: { min: number; max: number };
  /** Metres of hill relief kept inside the city (a village keeps 8). */
  relief: number;
  /** Building style weights along the city's facades. */
  styles: readonly (readonly [BuildingStyle, number])[];
}

export interface RegionDef {
  id: RegionId;
  surfaces: readonly (readonly [Surface, number])[];
  offroad: Surface;
  weathers: readonly (readonly [Weather, number])[];
  palette: RegionPalette;
  /** Palettes some surfaces swap in for `palette` (Forest mud stages wear autumn); the rest keep it. */
  surfacePalettes?: Partial<Record<Surface, RegionPalette>>;
  /** Set when the region's stages run along the sea. */
  coast?: CoastDef;
  /** Set when the region's stages have oases. */
  oases?: OasisDef;
  /** Set when the region's stages are a city from start to finish. */
  urban?: UrbanDef;
  /** Whether the town stages (every third, see `stageHasTown`) build a village here: the cliff road and the dunes have none. */
  towns: boolean;
  /**
   * Hills by default; `dunes` makes them a dune sea (see `TerrainField.duneHeight`); `banks` heaps a
   * ridge of snow this high and wide along both verges; `crests` raises a hump this high over this
   * length on the straights about every `every` metres, for the car to jump.
   */
  terrain: {
    amplitude: number;
    frequency: number;
    dunes?: boolean;
    banks?: { height: number; width: number };
    crests?: { every: number; height: number; length: number };
  };
  /** How the car handles here, as multipliers on the sim's grip, steering rate and steering lock; 1 each when unset. */
  handling?: { grip: number; steer: number; lock: number };
  /** Road curviness 0..1. */
  twistiness: number;
  baseLength: number;
  scenery: SceneryDensity;
  /** Average speed (m/s) a decent run should hold. */
  parSpeed: number;
}

const FOREST_PALETTE: RegionPalette = {
  sky: '#cfe3e8',
  fog: '#cfe3e8',
  grassLow: '#7fae5c',
  grassHigh: '#a4c46e',
  rock: '#8d8a7e',
  shoulder: '#a3a46c',
  foliage: '#3f7a4a',
  foliageAlt: '#2f6440',
  canopy: '#6f9a45',
  canopyAlt: '#8aab4f',
  trunk: '#6b4d33',
  boulder: '#9a9688',
};

/**
 * Autumn, worn by Forest stages on mud: sky, ground and trunks are the summer
 * ones, every other pine is a golden larch, the broadleaves turn orange and
 * rust, and the bushes follow the pines.
 */
const FOREST_AUTUMN: RegionPalette = {
  ...FOREST_PALETTE,
  foliage: '#3d6e46',
  foliageAlt: '#c48a2f',
  canopy: '#d8862c',
  canopyAlt: '#b7432a',
};

const FOREST: RegionDef = {
  id: 'forest',
  surfaces: [
    ['gravel', 3],
    ['tarmac', 1],
    ['mud', 1],
  ],
  offroad: 'grass',
  weathers: [['clear', 1]],
  palette: FOREST_PALETTE,
  surfacePalettes: { mud: FOREST_AUTUMN },
  terrain: { amplitude: 22, frequency: 1 / 260 },
  twistiness: 0.9,
  baseLength: 1800,
  scenery: { trees: 110, broadleaf: 26, bushes: 16, rocks: 5, houses: 0.9 },
  parSpeed: 15,
  towns: true,
};

/**
 * Mountain passes: asphalt under patchy snow (the `snow` surface, drawn as
 * dusted tarmac by the road builder) or cleared tarmac, snowfields either
 * side, frosted pines and bare broadleaves, bigger hills and sharper,
 * closer bends.
 */
const ALPINE: RegionDef = {
  id: 'alpine',
  surfaces: [
    ['snow', 3],
    ['tarmac', 1],
  ],
  offroad: 'snow',
  weathers: [
    ['overcast', 2],
    ['clear', 1],
  ],
  palette: {
    sky: '#dde5ec',
    fog: '#e3e9ee',
    grassLow: '#e4eaef',
    grassHigh: '#f5f7f9',
    rock: '#7b7f88',
    shoulder: '#d6dce2',
    foliage: '#3a6451',
    foliageAlt: '#6a8c82',
    canopy: '#b8c4cb',
    canopyAlt: '#d5dce1',
    trunk: '#4e3a2b',
    boulder: '#8b9098',
  },
  terrain: { amplitude: 34, frequency: 1 / 230 },
  twistiness: 1.4,
  baseLength: 1500,
  scenery: { trees: 78, broadleaf: 6, bushes: 6, rocks: 14, houses: 0.7 },
  parSpeed: 14,
  towns: true,
};

/**
 * A cliff road along the sea (see `CoastShape`, `CoastRoad`, `Coastline`):
 * tarmac only, a terraced rock band down to a beach and the water on one
 * side, a scrub-and-pine hillside with outcrops on the other, hairpin
 * stacks climbing it. No farms; the sea, the sand and the cliff take few
 * props, hence the generous numbers.
 */
const COAST: RegionDef = {
  id: 'coast',
  surfaces: [['tarmac', 1]],
  offroad: 'grass',
  weathers: [['clear', 1]],
  palette: {
    sky: '#d4ebf3',
    fog: '#d9ebf1',
    grassLow: '#5f8f4a',
    grassHigh: '#7da35a',
    rock: '#c4c6c3',
    shoulder: '#b3a784',
    foliage: '#4d7d53',
    foliageAlt: '#3a6b49',
    canopy: '#7f9d4b',
    canopyAlt: '#a4a95c',
    trunk: '#7a5a3c',
    boulder: '#bcbfbd',
  },
  terrain: { amplitude: 16, frequency: 1 / 200 },
  twistiness: 1.25,
  baseLength: 1600,
  scenery: { trees: 80, broadleaf: 24, bushes: 90, rocks: 24, houses: 0 },
  parSpeed: 15,
  towns: false,
  coast: {
    seaLevel: 0,
    sand: '#e8d9ab',
    sandWet: '#c4ad86',
    sea: '#3b8fb5',
    rockLight: '#e4e5e0',
    rockDark: '#949ba2',
    rockWarm: '#d9d2c0',
    scree: '#cdccc4',
    grassDry: '#98a258',
    scrub: '#4a7342',
  },
};

/**
 * Dunes and oases: a packed-sand piste through long dune ridges, soft sand
 * off it, date palms and dry scrub round pools of water in the hollows.
 * Villages where the cycle puts them.
 */
const DESERT: RegionDef = {
  id: 'desert',
  surfaces: [['sand', 1]],
  offroad: 'dune',
  weathers: [['clear', 1]],
  palette: {
    sky: '#e3ecf0',
    fog: '#ead9b8',
    grassLow: '#dfc389',
    grassHigh: '#f0dcaa',
    rock: '#b8966c',
    shoulder: '#d9be86',
    foliage: '#8c9a58',
    foliageAlt: '#a99f5c',
    canopy: '#5e9a4d',
    canopyAlt: '#4c8b43',
    trunk: '#8a6a44',
    boulder: '#b39572',
  },
  terrain: { amplitude: 11, frequency: 1 / 300, dunes: true },
  twistiness: 0.75,
  baseLength: 1900,
  scenery: { trees: 0, broadleaf: 0, bushes: 10, rocks: 8, houses: 0 },
  parSpeed: 16,
  towns: false,
  oases: { every: 260, radius: 11, palms: 8 },
};

/**
 * A closed race circuit in parkland (see `CircuitGenerator`): race asphalt
 * (`track`, grippier than road tarmac) only,
 * mown grass and gravel traps off it, mixed trees well back behind the
 * fences, gentle hills the Ring-style laps climb. Not in `REGION_CYCLE`:
 * `stageRegion` puts a circuit on every tenth stage.
 */
const CIRCUIT: RegionDef = {
  id: 'circuit',
  surfaces: [['track', 1]],
  offroad: 'grass',
  weathers: [
    ['clear', 2],
    ['overcast', 1],
  ],
  palette: {
    sky: '#d3e6ee',
    fog: '#d6e6ec',
    grassLow: '#6fa851',
    grassHigh: '#8dbb5f',
    rock: '#8d8a7e',
    shoulder: '#7fae5a',
    foliage: '#3f7a4a',
    foliageAlt: '#2f6440',
    canopy: '#5f9a45',
    canopyAlt: '#7fa64f',
    trunk: '#6b4d33',
    boulder: '#9a9688',
  },
  terrain: { amplitude: 14, frequency: 1 / 300 },
  twistiness: 0,
  baseLength: 2000,
  scenery: { trees: 36, broadleaf: 30, bushes: 8, rocks: 0, houses: 0 },
  parSpeed: 20,
  towns: false,
};

/**
 * A big city from start to finish (see `UrbanPlan`, `UrbanGenerator`,
 * `UrbanField`): tarmac streets of two to four lanes on a grid of mostly
 * right-angle corners with the odd skewed block and sweeping avenue,
 * roundabouts, tram tracks across and along the route, apartment blocks and
 * offices terraced up hills the city keeps twice as much of as a village.
 * `towns` is false because the city is its own town; the wild scatter is
 * the parks' trees.
 */
const URBAN: RegionDef = {
  id: 'urban',
  surfaces: [['tarmac', 1]],
  offroad: 'grass',
  weathers: [
    ['clear', 2],
    ['overcast', 1],
  ],
  palette: {
    sky: '#d6e4ec',
    fog: '#d9e2e8',
    grassLow: '#7aa35a',
    grassHigh: '#97b86a',
    rock: '#8e8c88',
    shoulder: '#93ae63',
    foliage: '#3f7a4a',
    foliageAlt: '#32663f',
    canopy: '#6f9a45',
    canopyAlt: '#86a94f',
    trunk: '#6b4d33',
    boulder: '#9a9688',
  },
  terrain: { amplitude: 18, frequency: 1 / 260 },
  twistiness: 0,
  baseLength: 1700,
  scenery: { trees: 8, broadleaf: 16, bushes: 10, rocks: 0, houses: 0 },
  parSpeed: 13,
  towns: false,
  urban: {
    lanes: { narrow: 3.2, two: 4.5, three: 5.5, four: 7 },
    island: { min: 8, max: 11 },
    relief: 16,
    styles: [
      ['block', 4],
      ['tenement', 4],
      ['office', 2],
      ['arcade', 2],
      ['shop', 2],
      ['townhouse', 1],
    ],
  },
};

/**
 * Arctic: a Finnish winter rally stage. Flat, frozen country under a pale
 * sky; the road (snow-dusted asphalt, or cleared tarmac) runs between thick
 * snow banks heaped along both verges, with a dense wall of tall spruces
 * right behind them and the odd bare birch, long flowing bends rather than
 * the Alpine's switchbacks. Villages where the cycle puts them, under snow.
 */
const ARCTIC: RegionDef = {
  id: 'arctic',
  surfaces: [
    ['snow', 3],
    ['tarmac', 1],
  ],
  offroad: 'snow',
  weathers: [
    ['overcast', 2],
    ['clear', 1],
  ],
  palette: {
    sky: '#dfe8f1',
    fog: '#e8eef4',
    grassLow: '#eaf0f5',
    grassHigh: '#f8fafc',
    rock: '#8a8f98',
    shoulder: '#e2e8ee',
    foliage: '#2c4a3b',
    foliageAlt: '#3a5c48',
    canopy: '#c6ccd2',
    canopyAlt: '#d8dde2',
    trunk: '#4a3b2e',
    boulder: '#8f949b',
  },
  terrain: {
    amplitude: 9,
    frequency: 1 / 320,
    banks: { height: 0.9, width: 3.2 },
    crests: { every: 190, height: 1.1, length: 36 },
  },
  // Studded tyres on packed snow: far more grip than the Alpine's dusting gives, and quicker, deeper steering.
  handling: { grip: 1.45, steer: 1.25, lock: 1.2 },
  // Long flowing bends and straights for the crests, not the Alpine's switchbacks.
  twistiness: 0.65,
  baseLength: 1900,
  scenery: { trees: 30, broadleaf: 14, bushes: 8, rocks: 2, houses: 0.4, spruces: 230 },
  parSpeed: 16,
  towns: true,
};

export const REGIONS: Readonly<Record<RegionId, RegionDef>> = {
  forest: FOREST,
  alpine: ALPINE,
  coast: COAST,
  desert: DESERT,
  // A Forest clone until it gets a look of its own; not in the cycle.
  night: { ...FOREST, id: 'night' },
  circuit: CIRCUIT,
  urban: URBAN,
  arctic: ARCTIC,
};

/**
 * Stages that are race circuits instead of their cycle region's road: every
 * tenth (stage 10, 20, 30…, index 9, 19, 29…), so a circuit always stands
 * alone in the rotation with nine rally stages between it and the next.
 */
export const CIRCUIT_EVERY = 10;
export function isCircuitStage(index: number): boolean {
  return index % CIRCUIT_EVERY === CIRCUIT_EVERY - 1;
}

/**
 * The progression: a fixed eighteen-stage cycle (Forest ×2, Alpine, Arctic,
 * Coast, Forest, Urban, Desert, Alpine ×2, Urban, Coast, Urban, Arctic,
 * Desert, Coast, Desert, Arctic), laid so that no region shows three stages
 * running, each gets three of every eighteen, the town stages (every third,
 * see `stageHasTown`) build their village on Forest, Alpine and Arctic
 * (cycle indices 2, 5, 8 and 17; the cliff road, the dunes and the city have
 * none), and no city sits where the circuits land (every tenth stage falls
 * on the odd cycle indices). Stage 1 is Forest and stage 5 the first Coast,
 * as they always were; stage 4 is the first Arctic, stage 7 the first city
 * and stage 8 the first Desert.
 */
export const REGION_CYCLE: readonly RegionId[] = [
  'forest',
  'forest',
  'alpine',
  'arctic',
  'coast',
  'forest',
  'urban',
  'desert',
  'alpine',
  'alpine',
  'urban',
  'coast',
  'urban',
  'arctic',
  'desert',
  'coast',
  'desert',
  'arctic',
];
/** Stages per difficulty loop: every sixth stage the roads grow 25 % longer and bend tighter. */
export const STAGES_PER_LOOP = 6;

/** The hills' relief on a stage: the region's amplitude, 15 % more per difficulty loop up to four. */
export function reliefAmplitude(def: RegionDef, loop: number): number {
  return def.terrain.amplitude * (1 + 0.15 * Math.min(loop, 4));
}

/** The palette a stage is drawn in: its region's, or the one its surface swaps in. Stable per (region, surface). */
export function stagePalette(stage: { region: RegionId; surface: Surface }): RegionPalette {
  const def = REGIONS[stage.region];
  return def.surfacePalettes?.[stage.surface] ?? def.palette;
}
