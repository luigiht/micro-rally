import type { Surface } from '../vehicle/surfaces';
import type { GroveDef } from './Groves';
import type { LacetStyle } from './Lacets';
import type { LakeStyle } from './Lakes';
import type { RiverStyle } from './Rivers';
import type { PineForm } from './SceneryScatter';
import type { SurfaceSpanStyle } from './SurfaceSpans';
import type { SplashStyle } from './Watersplashes';
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
  | 'desert'
  | 'lakeland'
  | 'moorland';
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
  /**
   * Valley ground (`valleyFaceColor`), in place of the plain low-to-high
   * grass ramp: the Greenvale's lush green down the hollows, meadow green,
   * sunlit green over the crests, olive patches, grey rock in beds from dark
   * to light (the body is `rock`) and brown earth toward the road; the
   * Alpine's snowfields in the same roles.
   */
  meadows?: {
    lush: string;
    meadow: string;
    sunlit: string;
    olive: string;
    rockDark: string;
    rockLight: string;
    earth: string;
    /** Lake shores' pebbles (the Lakeland's), dry over the waterline and darker wet at it; unset, a shore is rock. */
    shore?: string;
  };
  /** Plain ground in broad patches of a lusher and a drier green (`meshTerrainChunk`); unset, the height's gradient alone. */
  grassPatches?: { lush: string; dry: string };
  /**
   * How far the road's dirt shoulder eases into the ground, in shares of
   * the corridor's blend, ragged face by face in shades of dirt and earth;
   * unset, the shoulder ends crisply right by the road.
   */
  vergeBlend?: number;
  /** The farmhouses' walls and roofs, two tints each, where they differ from the stock render and terracotta. */
  houses?: {
    walls: readonly [string, string];
    roofs: readonly [string, string];
  };
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
  /** Stretches of dense broadleaf forest the road runs through (`Groves`); none when unset. */
  groves?: GroveDef;
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
    /**
     * Low earth banks along both verges of a forest track (the Moorland): `height` at their
     * tallest, over `width` from the carriageway's edge, swelling, dwindling and gone now and
     * then along the road (`TerrainField.earthBank`); the road mesh's verges ride up over them.
     */
    earthBanks?: { height: number; width: number };
    /**
     * The road is built up on a bank: the ground falls this far over this width past its edges,
     * from `from` metres out (0.3 when unset). With `lip`, the fall is the asphalt's own edge,
     * drawn as a dark face this wide down to a gravel shoulder (`MountainRoadStrips`).
     */
    embankment?: { height: number; width: number; from?: number; lip?: number };
    crests?: {
      every: number;
      height: number;
      length: number;
      /**
       * Most turning (radians) over the hump and 6 m either side (0.4), steepest grade under it
       * (0.06), and how far along to look for such a stretch (120 m). With `level`, the road is
       * levelled to that grade for the run-up, hump and landing instead of needing to be flat.
       */
      turn?: number;
      slope?: number;
      search?: number;
      level?: number;
    };
    /** Share of the relief drawn as sharp-crested ridges over broad valleys: mountains rather than hills. */
    ridges?: number;
    /** Metres of knolls, ribs and gullies laid over the broad relief, so a hillside is never smooth. */
    rugged?: number;
    /** Where the crowds gather, the ground either side of the road is levelled into benches (`CrowdBenches`). */
    benches?: boolean;
    /** Frozen rivers the road crosses on stone bridges at its low points (`Rivers`); none when unset. */
    rivers?: RiverStyle;
    /**
     * The ground beside the road is held within a bank's slope of every
     * stretch of it, cut above and filled below, and gives way to the hills
     * over a short blend, as on the coast: hairpin stacks never meet in a wall.
     */
    banked?: boolean;
  };
  /**
   * How the car handles here, as multipliers on the sim's grip, steering rate and steering lock; 1 each when unset.
   * `surfaceGrip` multiplies the grip again on the surfaces it names only (the Lakeland's mud tyres).
   */
  handling?: {
    grip: number;
    steer: number;
    lock: number;
    surfaceGrip?: Readonly<Partial<Record<Surface, number>>>;
  };
  /** Road curviness: about 1 for a winding road, more for one that bends harder and oftener. */
  twistiness: number;
  /** Share of the open road's bends that run straight instead (0.2 when unset). */
  straights?: number;
  /** Hairpin stacks up the hillsides (`Lacets`); none when unset. */
  lacets?: LacetStyle;
  /** The tarmac shows its wear (`SurfaceDetail.wornTone`): polished tracks, rubber through the bends, patches. */
  wornTarmac?: boolean;
  /** The open road's half width (m), where it differs from its surface's (4.5 on tarmac, 4 elsewhere). */
  roadHalfWidth?: number;
  baseLength: number;
  scenery: SceneryDensity;
  /** Average speed (m/s) a decent run should hold. */
  parSpeed: number;
  /** Some of its stages run after sunset (every `DUSK_EVERY`th): a twilight sky, little light, the car's lamps lit. */
  dusk?: boolean;
  /** The road changes surface along its length (`SurfaceSpans`): stretches of `surface` and of another. */
  surfaceSpans?: SurfaceSpanStyle;
  /** Lakes in the valleys, beside the road and bridged by it (`Lakes`); none when unset. */
  lakes?: LakeStyle;
  /** A high summer sun: stronger, warmer light than the stock day. */
  sunny?: boolean;
  /** Fords of standing water right across the road, in its dips (`Watersplashes`); none when unset. */
  splashes?: SplashStyle;
  /** A forest track with no painted edge lines. */
  unlined?: boolean;
  /** Hill farming on the open ground: sheep, post-and-wire fences, dry-stone walls (`MoorlandDressing`). */
  farms?: boolean;
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
 * The Greenvale's summer: richer greens in the grass and the woods (firs and
 * cypresses in the pine greens, oaks, lindens and chestnuts in the canopy
 * greens), grey rock, and a brown shoulder and earth by the road.
 */
const GREENVALE_PALETTE: StagePalette = {
  ...FOREST_PALETTE,
  grassLow: '#5f9c46',
  grassHigh: '#9cc062',
  rock: '#8c8e8b',
  shoulder: '#8f7b52',
  foliage: '#2f6c45',
  foliageAlt: '#2b583b',
  canopy: '#4f9140',
  canopyAlt: '#6b9a3a',
  boulder: '#8e908b',
  meadows: {
    lush: '#3d7d38',
    meadow: '#64a246',
    sunlit: '#a9c565',
    olive: '#8c9b4c',
    rockDark: '#6b6e6c',
    rockLight: '#aeb0aa',
    earth: '#8b7451',
  },
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

/** The summer woodland the Pinewood and the Autumnal start from: soft wooded hills and a winding road. */
const WOODLAND: StageTypeDef = {
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

/**
 * Greenvale (id `forest`): a Riviera mountain road in the Monte Carlo
 * manner. Tarmac that hardly ever runs straight, through green wooded
 * valleys between big sharp-crested mountains, the hillsides banked down to
 * it; once or twice a stage it climbs or drops a hillside in a stack of two
 * hairpins (`Lacets`). Mixed woods of oaks, chestnuts, stone pines,
 * cypresses and firs (`GreenvaleKits`), over tall grass.
 */
const FOREST: StageTypeDef = {
  ...WOODLAND,
  palette: GREENVALE_PALETTE,
  wornTarmac: true,
  // The asphalt stands 15 cm proud of its gravel shoulders, falling over its 30 cm edge.
  terrain: {
    amplitude: 40,
    frequency: 1 / 280,
    ridges: 0.4,
    rugged: 2.2,
    banked: true,
    benches: true,
    // A few jumps where the road straightens for a moment, gentle enough to fly on a mountain road.
    crests: { every: 420, height: 0.75, length: 30, turn: 0.6, search: 300, level: 0.02 },
    embankment: { height: 0.15, width: 0.28, from: 0.02, lip: 0.3 },
  },
  twistiness: 1.6,
  straights: 0.06,
  // Legs short enough that two stacked legs' far ends are under 200 m of road apart, the
  // hairpins wide enough that their corridors stay apart (see `Lacets.RADIUS_MIN`).
  lacets: { first: 260, span: 220, between: 380, radius: [17, 21], leg: [50, 66], grade: 0.075 },
  // Thick mixed woods close to the road and on into the distance, tall grass along the verges
  // and over the hillsides.
  scenery: {
    trees: 110,
    broadleaf: 150,
    bushes: 40,
    rocks: 12,
    houses: 0.8,
    meanOffset: 18,
    crowding: 0.85,
    deepWood: 140,
    grass: 560,
    meadow: 700,
    // About a third of the road plunges through thick broadleaf forest, in runs of a few hundred metres.
    groves: {
      share: 0.45,
      length: 240,
      boost: 3.5,
      grow: 0.2,
      crowding: 0.7,
      deep: 260,
      reach: 70,
    },
  },
  parSpeed: 13.5,
};

const PINEWOOD: StageTypeDef = {
  ...WOODLAND,
  id: 'pinewood',
  surface: 'gravel',
  // Detailed pines in five greens, from deep to sunlit.
  palette: { ...FOREST_PALETTE, pines: ['#28543a', '#2f5e3c', '#3d6e46', '#4a7a45', '#5b8a4c'] },
  // A dense pine wood the road cuts through: many tall pines standing close together right up to
  // the verges, fewer broadleaves among them.
  scenery: {
    ...WOODLAND.scenery,
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
  ...WOODLAND,
  id: 'autumnal',
  surface: 'mud',
  palette: FOREST_AUTUMN,
  // A built-up lane: the ground falls away 0.55 m across the verges on either side.
  terrain: {
    ...WOODLAND.terrain,
    crests: { every: 220, height: 0.75, length: 30 },
    embankment: { height: 0.55, width: 2.4 },
  },
  // Mud tyres: 30 % more grip (just under gravel's), so the drive bites on the climbs instead of
  // spinning. Mud's own drag still holds the weakest cars back; steering is unchanged.
  handling: { grip: 1.3, steer: 1, lock: 1 },
  // A single-track mud lane, 6 m across: narrower than a village's old-town streets.
  roadHalfWidth: 3,
  // Taller, thicker autumn woods than the summer woodland's, with fallen leaves on the grass.
  scenery: {
    ...WOODLAND.scenery,
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
    // Snowfields: blue-shadowed down the hollows, sunlit on the crests, wind crust in patches, grey
    // rock in beds on the steep faces, and grit-stained snow by the road.
    meadows: {
      lush: '#a3b6cf',
      meadow: '#d8e0e9',
      sunlit: '#f7f5ee',
      olive: '#b9c5d3',
      rockDark: '#545a63',
      rockLight: '#a3a8b0',
      earth: '#bbb5aa',
    },
  },
  // Mountains with ridged crests and knolls, and crowd benches where the spectators gather.
  // Frozen rivers in the valleys, two or three a stage, bridged where the road dips to them.
  terrain: {
    amplitude: 34,
    frequency: 1 / 230,
    ridges: 0.45,
    rugged: 2.4,
    benches: true,
    rivers: { min: 2, halfWidth: 4, depth: 1.6, clearance: 4.5, reach: 360 },
  },
  // Winter tyres: 35 % more grip on the snow-dusted tarmac, so the cars climb the passes instead of
  // spinning their wheels; still short of the Arctic's studs. Steering is unchanged.
  handling: { grip: 1.35, steer: 1, lock: 1 },
  twistiness: 1.4,
  baseLength: 1500,
  // The Arctic's crowd too: groups in winter clothes on the verges, the start and the checkpoints.
  // A dense winter wood (`AlpineKits`): tiered snow pines and snowy bushes, no broadleaves.
  scenery: {
    // A thick wood of tiered snow pines by the road, carrying on up the hillsides out of sight.
    trees: 170,
    broadleaf: 0,
    bushes: 10,
    rocks: 14,
    deepWood: 140,
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
    // Parkland grass in broad patches of lusher and drier green.
    grassPatches: { lush: '#4c8639', dry: '#adc46b' },
  },
  // Gentle parkland: low, broad hills round the circuits.
  terrain: { amplitude: 9, frequency: 1 / 360 },
  twistiness: 0,
  baseLength: 2000,
  // Woods all round the circuit beyond the fences, and further off.
  scenery: {
    trees: 80,
    broadleaf: 64,
    bushes: 22,
    rocks: 0,
    houses: 0,
    spectators: 0,
    deepWood: 70,
  },
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
  // A city's only greenery is its street trees: no wild trees or bushes on the hills between.
  scenery: { trees: 0, broadleaf: 0, bushes: 0, rocks: 0, houses: 0 },
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
    // The road a little up on its bed, banks and all: half the Autumnal's lift.
    embankment: { height: 0.3, width: 2.4 },
    crests: { every: 190, height: 1.1, length: 36 },
  },
  // Studded tyres on packed snow: far more grip than the Alpine's dusting gives, and quicker, deeper steering.
  handling: { grip: 1.45, steer: 1.25, lock: 1.2 },
  // Long flowing bends and straights for the crests, not the Alpine's switchbacks.
  twistiness: 0.65,
  baseLength: 1900,
  // A wood of tall spruces only: no stock pines or birches among them.
  scenery: {
    trees: 0,
    broadleaf: 0,
    bushes: 8,
    rocks: 2,
    houses: 0.4,
    spruces: 260,
    spectators: 2.2,
  },
  parSpeed: 16,
  // Open country only: the snowed-over road never runs through a village.
  towns: false,
};

/**
 * Lakeland: Swedish summer. Rounded wooded mountains over long lakes; the
 * road rolls over the shoulders of the hills and spends most of its length
 * winding along the lakes, now and then crossing one on a long bridge (`Lakes`). A
 * single-track road as narrow as the Autumnal's, in stretches of worn
 * tarmac and of mud lane (`SurfaceSpans`), the bridges always tarmac. Pine
 * woods with birches among them, tall grass, Falu-red farmhouses, and a high,
 * bright sun.
 */
const LAKELAND: StageTypeDef = {
  id: 'lakeland',
  seedKey: 'lakeland',
  surface: 'tarmac',
  offroad: 'grass',
  weathers: [['clear', 1]],
  sunny: true,
  palette: {
    sky: '#bfe0f2',
    fog: '#cfe6f0',
    // Heath and dry earth more than meadow: brown-olive ground with green in the hollows.
    grassLow: '#6b7f3f',
    grassHigh: '#9c9258',
    rock: '#8a8d8c',
    shoulder: '#8e7650',
    foliage: '#22492f',
    foliageAlt: '#2c5636',
    // Oaks, lindens and birches: deep summer greens.
    canopy: '#335a28',
    canopyAlt: '#45652c',
    trunk: '#4e3a28',
    boulder: '#8f9290',
    // Spruce and pine greens, deep to sunlit.
    pines: ['#18392a', '#1f4430', '#264d33', '#2e5937', '#3a653d'],
    meadows: {
      lush: '#4d6e34',
      meadow: '#76763f',
      sunlit: '#a79a62',
      olive: '#857246',
      rockDark: '#686c6b',
      rockLight: '#b0b3ae',
      earth: '#7f6243',
      shore: '#9a9384',
    },
    vergeBlend: 0.55,
    // Falu red walls and grey sheet-metal roofs (the white trim is the Swedish house's own,
    // `SwedishHouseGeometry`).
    houses: {
      walls: ['#9a2a1e', '#86231a'],
      roofs: ['#7f878d', '#6c747a'],
    },
  },
  // Low, rounded hills rather than Greenvale's sharp ridges: little climbing, wide valley floors
  // for the lakes.
  terrain: {
    amplitude: 18,
    frequency: 1 / 360,
    ridges: 0.15,
    rugged: 1.2,
    banked: true,
    benches: true,
    // The Autumnal's built-up lane: the ground falls away across the verges, tarmac and mud alike.
    embankment: { height: 0.55, width: 2.4 },
  },
  // Mud tyres on the mud stretches only, gripping nearly as well as on gravel-free tarmac: the mud
  // is a firm farm track, not the Autumnal's slither. Tarmac grips as it always does.
  handling: { grip: 1, steer: 1, lock: 1, surfaceGrip: { mud: 1.6 } },
  // Flowing bends round the lakes, no hairpin stacks.
  twistiness: 1,
  straights: 0.15,
  wornTarmac: true,
  // A single-track lane, as narrow as the Autumnal's.
  roadHalfWidth: 3,
  // Short mud stretches between long tarmac ones.
  surfaceSpans: { alt: 'mud', main: [380, 700], other: [100, 200] },
  lakes: { lakeside: 15, bridges: 1, water: '#2f7fa8' },
  baseLength: 1900,
  // Mixed woods: pines of every build (tall, full, sparse, young) spaced by their reach, among
  // oaks, chestnuts, lindens and stone pines and round bushes (`RallyKits`' Lakeland woods), tall
  // grass over the hillsides, farmhouses dotted about.
  scenery: {
    trees: 230,
    broadleaf: 120,
    bushes: 40,
    rocks: 10,
    // Generous: red farmhouses all over, though sites too sloped for a house are skipped.
    houses: 5,
    // Ordinary-sized trees: no towering pines.
    treeScale: 0.9,
    clearance: 2.4,
    meanOffset: 14,
    // Full, young and sparse pines, none of the Pinewood's tall build, not even beside the road.
    pineWood: {
      reach: { full: 2.6, tall: 2.35, sparse: 1.8, young: 2 },
      mix: { full: 0.5, tall: 0, young: 0.3, sparse: 0.2 },
      roadside: 0,
    },
    deepWood: 170,
    crowding: 1,
    saplings: 60,
    grass: 420,
    meadow: 600,
  },
  parSpeed: 14,
  // Open country: farmhouses on the hillsides, no villages on the road.
  towns: false,
};

/**
 * Moorland: a Welsh forest rally in the rain. Wet slate-grey gravel over
 * open moorland (tan bracken and brown heather, bright wet green in the
 * hollows, slate outcrops), through dark spruce plantations that the road
 * plunges into and out of (pine `groves`), a grey lake now and then in a
 * valley. It always rains: the grip drops a little (`RAIN_GRIP`), the mist
 * closes in, and three to five watersplashes lie right across the road in
 * its dips (`Watersplashes`), slowing every car that wades them.
 */
const MOORLAND: StageTypeDef = {
  id: 'moorland',
  seedKey: 'moorland',
  surface: 'gravel',
  offroad: 'grass',
  weathers: [['rain', 1]],
  palette: {
    sky: '#9ea6a9',
    fog: '#a8afb0',
    // Wet green low down, bracken and heather browns up the slopes.
    grassLow: '#5f7d3c',
    grassHigh: '#8b6c44',
    rock: '#5d6265',
    // Peaty brown beside the track, not the gravel's grey, so the road reads against it.
    shoulder: '#5c5040',
    foliage: '#1d3a2b',
    foliageAlt: '#24412f',
    // Birches and rowans on the plantation edges, bracken-brown bushes.
    canopy: '#6f6a3a',
    canopyAlt: '#8a5a33',
    trunk: '#463a2e',
    boulder: '#666b6e',
    // Sitka spruce: the darkest greens in the game.
    pines: ['#142a1e', '#183022', '#1d3627', '#223c2b', '#294430'],
    meadows: {
      lush: '#527338',
      meadow: '#6f7440',
      sunlit: '#9b8150',
      olive: '#7d5a38',
      rockDark: '#4b5053',
      rockLight: '#868c8f',
      earth: '#4d4334',
      shore: '#6f6c64',
    },
    // The shoulder's dirt runs well out into the moor, ragged face by face.
    vergeBlend: 0.9,
  },
  // Rolling moorland hills with crags breaking through, banked like the Lakeland's; low ragged
  // earth banks along the track's edges, where the grader threw the spoil.
  terrain: {
    amplitude: 26,
    frequency: 1 / 320,
    ridges: 0.3,
    rugged: 1.8,
    banked: true,
    benches: true,
    earthBanks: { height: 0.35, width: 2.1 },
  },
  twistiness: 1.15,
  straights: 0.16,
  // A narrow forestry track, 5.5 m across: narrower than the Lakeland's lane.
  roadHalfWidth: 2.75,
  // A grey lake in a valley now and then, beside the road, never bridged.
  lakes: { lakeside: 1, bridges: 0, water: '#55666d' },
  splashes: { count: [6, 10], length: [7, 12] },
  // A forestry track: no paint.
  unlined: true,
  farms: true,
  baseLength: 1900,
  // Open moor (a few pines, bracken bushes, slate rocks, tall dry grass everywhere) broken by
  // dense spruce plantations the road runs through for a few hundred metres at a time.
  scenery: {
    trees: 18,
    broadleaf: 6,
    bushes: 30,
    rocks: 16,
    // Open hill country: no farmhouses on the moor.
    houses: 0,
    treeScale: 1.2,
    clearance: 2.2,
    meanOffset: 16,
    pineWood: {
      reach: { full: 2.6, tall: 2.35, sparse: 1.8, young: 2 },
      mix: { full: 0.75, tall: 0.1, young: 0.1, sparse: 0.05 },
      roadside: 5,
    },
    crowding: 0.9,
    grass: 520,
    meadow: 1000,
    spectators: 1.6,
    groves: {
      kind: 'tree',
      share: 0.4,
      length: 300,
      boost: 14,
      grow: 0.15,
      crowding: 0.8,
      deep: 520,
      reach: 90,
    },
  },
  parSpeed: 14,
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
  lakeland: LAKELAND,
  moorland: MOORLAND,
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
 * Alpine, Forest, Coastal, Arctic, Autumnal, Desert, Lakeland, Moorland. No
 * type runs twice in a row, round the wrap too, and stage 1 remains Pinewood
 * as before. Lakeland came last (save v14) so the first seven rally stages
 * kept theirs, and Moorland after it (save v15) for the first eight.
 */
export const RALLY_CYCLE: readonly StageTypeId[] = [
  'pinewood',
  'alpine',
  'forest',
  'coastal',
  'arctic',
  'autumnal',
  'desert',
  'lakeland',
  'moorland',
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

/** Rain takes this share off every tyre's grip: wet gravel, a slick road. */
export const RAIN_GRIP = 0.9;

/**
 * The grip multiplier a stage runs on (`SimEnv.gripScale`): its type's
 * handling, less in the rain. Shared by the driving session and the
 * autopilot so the two always agree.
 */
export function stageGripScale(stageType: StageTypeId, weather: Weather): number {
  const grip = STAGE_TYPES[stageType].handling?.grip ?? 1;
  return grip * (weather === 'rain' ? RAIN_GRIP : 1);
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
