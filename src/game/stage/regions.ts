import type { Surface } from '../vehicle/surfaces';

export type RegionId = 'forest' | 'coast' | 'desert' | 'alpine' | 'night';
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
}

/** A region whose stages run along the sea (see `Coastline`): where the water stands and what the shore wears. */
export interface CoastDef {
  seaLevel: number;
  sand: string;
  sandWet: string;
  sea: string;
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
  terrain: { amplitude: number; frequency: number };
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
    rock: '#b8906f',
    shoulder: '#b3a784',
    foliage: '#4d7d53',
    foliageAlt: '#3a6b49',
    canopy: '#7f9d4b',
    canopyAlt: '#a4a95c',
    trunk: '#7a5a3c',
    boulder: '#a89e8e',
  },
  terrain: { amplitude: 16, frequency: 1 / 200 },
  twistiness: 1.25,
  baseLength: 1600,
  scenery: { trees: 80, broadleaf: 24, bushes: 90, rocks: 24, houses: 0 },
  parSpeed: 15,
  coast: { seaLevel: 0, sand: '#e8d9ab', sandWet: '#c4ad86', sea: '#3b8fb5' },
};

export const REGIONS: Readonly<Record<RegionId, RegionDef>> = {
  forest: FOREST,
  alpine: ALPINE,
  coast: COAST,
  // Forest clones until milestone 8 gives each region its own look; not in the cycle.
  desert: { ...FOREST, id: 'desert' },
  night: { ...FOREST, id: 'night' },
};

/**
 * The progression: a fixed nine-stage cycle of ones and twos (Forest ×2,
 * Alpine ×2, Coast, Forest, Coast ×2, Alpine), laid so that no region shows
 * three stages running, each gets three of every nine, and the town stages
 * (every third, see `hasTown`) fall on Forest and Alpine: the cliff road has
 * no villages. Stage 1 is Forest and stage 4 Alpine, as they always were.
 */
export const REGION_CYCLE: readonly RegionId[] = [
  'forest',
  'forest',
  'alpine',
  'alpine',
  'coast',
  'forest',
  'coast',
  'coast',
  'alpine',
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
