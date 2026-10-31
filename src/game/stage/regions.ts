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
}

export interface RegionDef {
  id: RegionId;
  surfaces: readonly (readonly [Surface, number])[];
  offroad: Surface;
  weathers: readonly (readonly [Weather, number])[];
  palette: RegionPalette;
  terrain: { amplitude: number; frequency: number };
  /** Road curviness 0..1. */
  twistiness: number;
  baseLength: number;
  scenery: SceneryDensity;
  /** Average speed (m/s) a decent run should hold. */
  parSpeed: number;
}

const FOREST: RegionDef = {
  id: 'forest',
  surfaces: [
    ['gravel', 3],
    ['tarmac', 1],
    ['mud', 1],
  ],
  offroad: 'grass',
  weathers: [['clear', 1]],
  palette: {
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
  },
  terrain: { amplitude: 22, frequency: 1 / 260 },
  twistiness: 0.9,
  baseLength: 1800,
  scenery: { trees: 80, broadleaf: 18, bushes: 16, rocks: 5 },
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
  scenery: { trees: 55, broadleaf: 4, bushes: 6, rocks: 14 },
  parSpeed: 14,
};

export const REGIONS: Readonly<Record<RegionId, RegionDef>> = {
  forest: FOREST,
  alpine: ALPINE,
  // Forest clones until milestone 8 gives each region its own look; not yet in REGION_ORDER.
  coast: { ...FOREST, id: 'coast' },
  desert: { ...FOREST, id: 'desert' },
  night: { ...FOREST, id: 'night' },
};

/** Regions currently in the progression loop, `STAGES_PER_REGION` stages each. */
export const REGION_ORDER: readonly RegionId[] = ['forest', 'alpine'];
export const STAGES_PER_REGION = 3;
