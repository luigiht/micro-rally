import type { Surface } from '../vehicle/surfaces';
import type { PineForm } from './SceneryScatter';
import type { BuildingStyle } from './Town';

export type StageTypeId =
  | 'arctic'
  | 'circuit'
  | 'autumnal'
  | 'pinewood'
  | 'alpine'
  | 'forest'
  | 'urban'
  | 'coastal'
  | 'desert';
export type Weather = 'clear' | 'overcast' | 'rain' | 'night';

export interface StagePalette {
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
  /**
   * Autumn woods: each conifer, broadleaf and bush takes one of these colours
   * (and the trees one of several silhouettes) instead of the two-tone tints.
   */
  autumn?: {
    conifers: readonly string[];
    broadleaves: readonly string[];
    bushes: readonly string[];
  };
  /** Pine woods: each pine takes one of these greens and one of the detailed pine silhouettes. */
  pines?: readonly string[];
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
  /** Small groups of roadside spectators per 100 m of road; none when unset. */
  spectators?: number;
  /** Desert crowds gather only at the start, checkpoints and finish. */
  spectatorEventsOnly?: boolean;
  /** The crowds stand behind low earth berms. */
  berms?: boolean;
  /** Trees and broadleaves stand this much taller (a vertical stretch on their scale): the Autumnal's tall woods. */
  treeStretch?: number;
  /** Pines (`tree` props) grow this much bigger all round, colliders included; 1 when unset. */
  treeScale?: number;
  /** Nearest any wild prop stands to the carriageway's edge, metres (3 when unset). */
  clearance?: number;
  /** Mean distance out from that clearance, metres (28 when unset): lower crowds the road. */
  meanOffset?: number;
  /** Trees may stand this share of their canopies' spacing apart (1 when unset): a crowded wood's foliage brushes. */
  crowding?: number;
  /** Small pines along the verges per 100 m of road, both sides (none when unset). */
  saplings?: number;
  /**
   * A pine wood: each pine is one of the pine builds, spaced by that build's
   * real bough reach (scale 1, metres; times `crowding`) and with every
   * bough clear of the road. Within `roadside` metres of the road's edge
   * every pine is the `tall` build, its trunk bare to above a car; further
   * out the builds follow `mix` (shares summing to 1). Saplings are `young`.
   */
  pineWood?: {
    reach: Readonly<Record<PineForm, number>>;
    mix: Readonly<Partial<Record<PineForm, number>>>;
    roadside: number;
  };
  /** More trees per 100 m of road, both sides, spread evenly from a dozen metres out into the distance (none when unset). */
  deepWood?: number;
  /** Patches of tall grass along the verges and nearby ground per 100 m of road, both sides (none when unset). */
  grass?: number;
  /** Patches of tall grass spread evenly over the hills either side, out to 150 m, per 100 m of road (none when unset). */
  meadow?: number;
  /** Clusters of fallen leaves on the ground per 100 m of road, both sides, plus a few under each broadleaf. */
  leaves?: number;
}

/** A stage type with oases (see `Oases`): how often along the road, how wide the pool, how many palms. */
export interface OasisDef {
  every: number;
  radius: number;
  palms: number;
}

/** A stage type that runs along the sea (see `Coastline`): where the water stands and what the shore wears. */
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
 * A stage type that runs through a big city (see `UrbanPlan`,
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

export interface StageTypeDef {
  id: StageTypeId;
  /** Previous region key, retained so existing game seeds keep their layouts. */
  seedKey: string;
  /** The fixed driving surface for this stage type. */
  surface: Surface;
  offroad: Surface;
  weathers: readonly (readonly [Weather, number])[];
  palette: StagePalette;
  /** Set when this stage type runs along the sea. */
  coast?: CoastDef;
  /** Set when this stage type has oases. */
  oases?: OasisDef;
  /** Set when this stage type is a city from start to finish. */
  urban?: UrbanDef;
  /** Whether town stages (every third, see `stageHasTown`) build a village here. */
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
    /** The road is built up on a bank: the ground falls this far over this width past its edges. */
    embankment?: { height: number; width: number };
    crests?: { every: number; height: number; length: number };
  };
  /** How the car handles here, as multipliers on the sim's grip, steering rate and steering lock; 1 each when unset. */
  handling?: { grip: number; steer: number; lock: number };
  /** Road curviness 0..1. */
  twistiness: number;
  /** The open road's half width (m), where it differs from its surface's (4.5 on tarmac, 4 elsewhere). */
  roadHalfWidth?: number;
  baseLength: number;
  scenery: SceneryDensity;
  /** Average speed (m/s) a decent run should hold. */
  parSpeed: number;
  /** Some of its stages run after sunset (every `DUSK_EVERY`th): a twilight sky, little light, the car's lamps lit. */
  dusk?: boolean;
}

const FOREST_PALETTE: StagePalette = {
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
const FOREST_AUTUMN: StagePalette = {
  ...FOREST_PALETTE,
  foliage: '#3d6e46',
  foliageAlt: '#c48a2f',
  canopy: '#d8862c',
  canopyAlt: '#b7432a',
  autumn: {
    // Evergreen and olive firs among larches turning ochre, orange and rust.
    conifers: ['#3d6e46', '#5f8a3c', '#a3a83a', '#c48a2f', '#d9772b', '#b8402e'],
    // Gold, amber, orange, rust and crimson crowns.
    broadleaves: ['#f0c64a', '#e8a32e', '#e07b26', '#c95a28', '#b23a2a', '#962d2d'],
    bushes: ['#6d8f3e', '#a3a83a', '#d9952f', '#c4602a'],
  },
};

const FOREST: StageTypeDef = {
  id: 'forest',
  seedKey: 'forest',
  surface: 'tarmac',
  offroad: 'grass',
  weathers: [['clear', 1]],
  palette: FOREST_PALETTE,
  terrain: { amplitude: 22, frequency: 1 / 260 },
  twistiness: 0.9,
  baseLength: 1800,
  scenery: { trees: 110, broadleaf: 26, bushes: 16, rocks: 5, houses: 0.9 },
  parSpeed: 15,
  towns: true,
};

const PINEWOOD: StageTypeDef = {
  ...FOREST,
  id: 'pinewood',
  surface: 'gravel',
  // Detailed pines in five greens, from deep to sunlit.
  palette: { ...FOREST_PALETTE, pines: ['#28543a', '#2f5e3c', '#3d6e46', '#4a7a45', '#5b8a4c'] },
  // A dense pine wood the road cuts through: many tall pines standing close together right up to
  // the verges, fewer broadleaves among them.
  scenery: {
    ...FOREST.scenery,
    trees: 720,
    // Pines only: no broadleaves or round bushes in the wood.
    broadleaf: 0,
    bushes: 0,
    treeScale: 1.35,
    treeStretch: 1.15,
    clearance: 1.6,
    meanOffset: 9,
    // Each pine spaced by its build's real reach, so no two grow into each other and no bough
    // hangs over the road; tall leafy pines line the road, trunks bare to well above the car;
    // further out mostly full pines.
    pineWood: {
      reach: { full: 2.6, tall: 2.35, sparse: 1.8, young: 2 },
      mix: { full: 0.6, tall: 0.15, young: 0.17, sparse: 0.08 },
      roadside: 6,
    },
    // And the wood carries on out of sight, not just along the verges.
    deepWood: 220,
    crowding: 1,
    saplings: 150,
    grass: 600,
    // Tall grass over the hills too, not only by the road.
    meadow: 900,
  },
};

const AUTUMNAL: StageTypeDef = {
  ...FOREST,
  id: 'autumnal',
  surface: 'mud',
  palette: FOREST_AUTUMN,
  // A built-up lane: the ground falls away 0.55 m across the verges on either side.
  terrain: {
    ...FOREST.terrain,
    crests: { every: 220, height: 0.75, length: 30 },
    embankment: { height: 0.55, width: 2.4 },
  },
  // Mud tyres: 30 % more grip (just under gravel's), so the drive bites on the climbs instead of
  // spinning. Mud's own drag still holds the weakest cars back; steering is unchanged.
  handling: { grip: 1.3, steer: 1, lock: 1 },
  // A single-track mud lane, 6 m across: narrower than a village's old-town streets.
  roadHalfWidth: 3,
  // Taller, thicker autumn woods than the Forest's, with fallen leaves on the grass.
  scenery: {
    ...FOREST.scenery,
    trees: 135,
    broadleaf: 55,
    bushes: 24,
    treeStretch: 1.3,
    leaves: 200,
    spectators: 2.2,
    berms: true,
  },
};

/**
 * Mountain passes: asphalt under patchy snow (the `snow` surface, drawn as
 * dusted tarmac by the road builder) or cleared tarmac, snowfields either
 * side, frosted pines and bare broadleaves, bigger hills and sharper,
 * closer bends.
 */
const ALPINE: StageTypeDef = {
  id: 'alpine',
  seedKey: 'alpine',
  surface: 'snow',
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
  // Winter tyres: 35 % more grip on the snow-dusted tarmac, so the cars climb the passes instead of
  // spinning their wheels; still short of the Arctic's studs. Steering is unchanged.
  handling: { grip: 1.35, steer: 1, lock: 1 },
  twistiness: 1.4,
  baseLength: 1500,
  // The Arctic's crowd too: groups in winter clothes on the verges, the start and the checkpoints.
  scenery: {
    trees: 78,
    broadleaf: 6,
    bushes: 6,
    rocks: 14,
    houses: 0.7,
    spectators: 2.2,
    berms: true,
  },
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
const COAST: StageTypeDef = {
  id: 'coastal',
  seedKey: 'coast',
  surface: 'tarmac',
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
  scenery: { trees: 80, broadleaf: 24, bushes: 90, rocks: 24, houses: 0, spectators: 0 },
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
const DESERT: StageTypeDef = {
  id: 'desert',
  seedKey: 'desert',
  surface: 'sand',
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
  scenery: {
    trees: 0,
    broadleaf: 0,
    bushes: 10,
    rocks: 8,
    houses: 0,
    spectatorEventsOnly: true,
  },
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
const CIRCUIT: StageTypeDef = {
  id: 'circuit',
  seedKey: 'circuit',
  surface: 'track',
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
  scenery: { trees: 36, broadleaf: 30, bushes: 8, rocks: 0, houses: 0, spectators: 0 },
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
const URBAN: StageTypeDef = {
  id: 'urban',
  seedKey: 'urban',
  surface: 'tarmac',
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
 * sky; the road, snowed over from bank to bank, runs between thick
 * snow banks heaped along both verges, with a dense wall of tall spruces
 * right behind them and the odd bare birch, long flowing bends rather than
 * the Alpine's switchbacks. No villages: open country only.
 */
const ARCTIC: StageTypeDef = {
  id: 'arctic',
  seedKey: 'arctic',
  surface: 'snow',
  dusk: true,
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
  scenery: {
    trees: 30,
    broadleaf: 14,
    bushes: 8,
    rocks: 2,
    houses: 0.4,
    spruces: 230,
    spectators: 2.2,
  },
  parSpeed: 16,
  // Open country only: the snowed-over road never runs through a village.
  towns: false,
};

export const STAGE_TYPES: Readonly<Record<StageTypeId, StageTypeDef>> = {
  arctic: ARCTIC,
  circuit: CIRCUIT,
  autumnal: AUTUMNAL,
  pinewood: PINEWOOD,
  alpine: ALPINE,
  forest: FOREST,
  urban: URBAN,
  coastal: COAST,
  desert: DESERT,
};

/**
 * The progression, in three fixed slots. Every ninth stage is a city (stage
 * 9, 18, 27…, index 8, 17, 26…): eight others, then a city. Every tenth is a
 * circuit (stage 10, 20, 30…); where the two would land on the same stage
 * (stage 90, 180…) the city keeps it and the circuit moves to the next.
 * The stages between run through `RALLY_CYCLE`, counting only themselves,
 * so the mix never skips a slot for a city or a circuit.
 */
export const CITY_EVERY = 9;
export const CIRCUIT_EVERY = 10;

export function isCityStage(index: number): boolean {
  return index % CITY_EVERY === CITY_EVERY - 1;
}

/** Where the regular tenth-stage slot falls, before any clash with a city. */
function circuitSlot(index: number): boolean {
  return index % CIRCUIT_EVERY === CIRCUIT_EVERY - 1;
}

export function isCircuitStage(index: number): boolean {
  if (circuitSlot(index)) return !isCityStage(index);
  return index > 0 && circuitSlot(index - 1) && isCityStage(index - 1);
}

/**
 * The rally stages between the cities and circuits, in turn: Pinewood,
 * Alpine, Forest, Coastal, Arctic, Autumnal, Desert. No type runs twice in a
 * row, round the wrap too, and stage 1 remains Pinewood as before.
 */
export const RALLY_CYCLE: readonly StageTypeId[] = [
  'pinewood',
  'alpine',
  'forest',
  'coastal',
  'arctic',
  'autumnal',
  'desert',
];

/** How many cities and circuits come before `index`. */
function specialsBefore(index: number): number {
  let n = Math.floor(index / CITY_EVERY);
  for (let k = 0; ; k++) {
    let at = k * CIRCUIT_EVERY + CIRCUIT_EVERY - 1;
    if (isCityStage(at)) at++;
    if (at >= index) break;
    n++;
  }
  return n;
}

/** The count of rally stages before `index` (its place in the mix); null on a city or a circuit. */
export function rallyIndex(index: number): number | null {
  if (isCityStage(index) || isCircuitStage(index)) return null;
  return index - specialsBefore(index);
}

/** What stage `index` is: a city, a circuit, or the next slot of the rally mix. */
export function stageSlot(index: number): StageTypeId {
  const rally = rallyIndex(index);
  if (rally === null) return isCityStage(index) ? 'urban' : 'circuit';
  return RALLY_CYCLE[rally % RALLY_CYCLE.length]!;
}

/** Stages per difficulty loop: every sixth stage the roads grow 25 % longer and bend tighter. */
export const STAGES_PER_LOOP = 6;

/** The hills' relief on a stage: the region's amplitude, 15 % more per difficulty loop up to four. */
export function reliefAmplitude(def: StageTypeDef, loop: number): number {
  return def.terrain.amplitude * (1 + 0.15 * Math.min(loop, 4));
}

/** The scenery density a stage wears: its region's, with any override for its surface. */
export function stageScenery(stageType: StageTypeId): SceneryDensity {
  const scenery = { ...STAGE_TYPES[stageType].scenery };
  return {
    ...scenery,
    spectators: scenery.spectators ?? 2.2,
    berms: scenery.berms ?? true,
  };
}

/** Whether spectators dress for snow or a mild day. */
export function spectatorOutfit(stageType: StageTypeId): 'winter' | 'casual' {
  return STAGE_TYPES[stageType].offroad === 'snow' ? 'winter' : 'casual';
}

/** The palette for a stage type. */
export function stagePalette(stageType: StageTypeId): StagePalette {
  return STAGE_TYPES[stageType].palette;
}
