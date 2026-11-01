import { hashSeed, mulberry32, pickWeighted } from '../rng';
import type { Surface } from '../vehicle/surfaces';
import type { SpawnPose } from '../vehicle/VehicleSim';
import type { Gate } from './Checkpoints';
import { REGION_ORDER, REGIONS, STAGES_PER_REGION, type RegionId, type Weather } from './regions';
import type { RoadPath, RoadSample } from './RoadPath';
import type { TownDef } from './Town';
import { buildCentreline, RUNOUT, selfApproachOk, START_DISTANCE } from './Centreline';
import { buildWidths } from './RoadWidth';
import { layoutTown } from './TownGenerator';
import { hasTown, planTown } from './TownPlan';

export { ROAD_SPACING } from './Centreline';
/** Checkpoint boards keep this far clear of a town's route interval. */
const TOWN_GATE_CLEARANCE = 40;
const MIN_GATE_GAP = 60;
/** Four slow corners and narrow streets cost about this much against par. */
const TOWN_PAR_SECONDS = 12;

const SURFACE_PAR: Readonly<Record<Surface, number>> = {
  tarmac: 1.12,
  gravel: 1,
  mud: 0.85,
  snow: 0.82,
  grass: 0.8,
};

const NAME_HEADS = [
  'Pine',
  'Moss',
  'Birch',
  'Fen',
  'Ash',
  'Holl',
  'Alder',
  'Will',
  'Bram',
  'Thorn',
  'Elm',
  'Corr',
  'Linn',
  'Ross',
  'Vern',
  'Dal',
  'Mar',
  'Tor',
  'Kess',
  'Oak',
];
const NAME_TAILS = [
  'wood',
  'ley',
  'dale',
  'ford',
  'moor',
  'brook',
  'holt',
  'wick',
  'ridge',
  'combe',
  'hurst',
  'stead',
  'fell',
  'mere',
];

/** The cheap part of a stage, drawn from the RNG before the road: enough to list it. */
export interface StageBrief {
  seed: number;
  index: number;
  region: RegionId;
  /** How many times the region loop has wrapped (harder, longer variants). */
  loop: number;
  /** Procedural place name (a proper noun, not translated). */
  name: string;
  surface: Surface;
  weather: Weather;
  /** Start line to finish line, metres. */
  length: number;
  parTime: number;
}

export interface StageDef extends StageBrief {
  halfWidth: number;
  startDistance: number;
  path: RoadPath;
  gates: Gate[];
  spawn: SpawnPose;
  /** Town section the route threads through, on some stages. */
  town?: TownDef;
  /** Half width per path sample where it varies from `halfWidth` (narrow town streets); absent when constant. */
  widths?: Float64Array;
}

export function stageRegion(index: number): { region: RegionId; loop: number } {
  const perLoop = STAGES_PER_REGION * REGION_ORDER.length;
  const loop = Math.floor(index / perLoop);
  const region = REGION_ORDER[Math.floor((index % perLoop) / STAGES_PER_REGION)]!;
  return { region, loop };
}

/** Keep checkpoint boards out of the town and in order; the finish stays where the brief put it. */
function placeGates(
  path: RoadPath,
  length: number,
  halfWidth: number,
  town: TownDef | undefined,
): Gate[] {
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const checkpoints = Math.min(6, Math.max(2, Math.round(length / 450)));
  const finish = START_DISTANCE + length;
  const distances: number[] = [];
  for (let k = 1; k <= checkpoints; k++) {
    let distance = START_DISTANCE + (length * k) / (checkpoints + 1);
    if (
      town &&
      distance > town.from - TOWN_GATE_CLEARANCE &&
      distance < town.to + TOWN_GATE_CLEARANCE
    )
      distance =
        distance < (town.from + town.to) / 2
          ? town.from - TOWN_GATE_CLEARANCE
          : town.to + TOWN_GATE_CLEARANCE;
    const prev = distances[distances.length - 1];
    if (prev !== undefined && distance < prev + MIN_GATE_GAP) distance = prev + MIN_GATE_GAP;
    if (distance <= finish - MIN_GATE_GAP) distances.push(distance);
  }
  distances.push(finish);
  return distances.map((distance, i) => {
    path.sample(distance, sample);
    return {
      kind: i === distances.length - 1 ? 'finish' : 'checkpoint',
      distance,
      x: sample.x,
      z: sample.z,
      heading: sample.heading,
      halfWidth: halfWidth + 3,
    };
  });
}

/** Draws the brief in RNG order; `generateStage` continues with the same stream. */
function drawBrief(
  rand: () => number,
  seed: number,
  index: number,
  region: RegionId,
  loop: number,
  town: boolean,
): StageBrief {
  const def = REGIONS[region];
  const surface = pickWeighted(rand, def.surfaces);
  const weather = pickWeighted(rand, def.weathers);
  const name =
    NAME_HEADS[Math.floor(rand() * NAME_HEADS.length)]! +
    NAME_TAILS[Math.floor(rand() * NAME_TAILS.length)]!;
  const length = Math.round(def.baseLength * (1 + 0.25 * loop) * (0.85 + rand() * 0.3));
  const parTime =
    Math.round(length / (def.parSpeed * SURFACE_PAR[surface])) + (town ? TOWN_PAR_SECONDS : 0);
  return { seed, index, region, loop, name, surface, weather, length, parTime };
}

/** Name, surface, length and par of a stage without building its road (for lists). */
export function stageBrief(gameSeed: number, index: number): StageBrief {
  const { region, loop } = stageRegion(index);
  const seed = hashSeed(gameSeed, region, index);
  return drawBrief(mulberry32(seed), seed, index, region, loop, hasTown(gameSeed, index));
}

/** The stage's RNG stream positioned after the brief's five draws, where the walk starts. */
function resume(seed: number): () => number {
  const rand = mulberry32(seed);
  for (let i = 0; i < 5; i++) rand();
  return rand;
}

/** Deterministic stage from (game seed, global stage index). */
export function generateStage(gameSeed: number, index: number): StageDef {
  const { region, loop } = stageRegion(index);
  const def = REGIONS[region];
  const seed = hashSeed(gameSeed, region, index);
  const withTown = hasTown(gameSeed, index);
  const brief = drawBrief(mulberry32(seed), seed, index, region, loop, withTown);
  const { surface, length } = brief;
  const twist = def.twistiness * (1 + 0.15 * Math.min(loop, 4));
  const halfWidth = surface === 'tarmac' ? 4.5 : 4;
  const total = START_DISTANCE + length + RUNOUT;
  // The town draws from its own seed so the brief and the walk keep their streams. The walk is
  // rebuilt with the plan mirrored if the town fouls the open road around it, and without a town
  // if that fails too, so the stage's own invariants always hold.
  const plan = withTown ? planTown(seed, START_DISTANCE, length, halfWidth) : null;
  let built = buildCentreline(resume(seed), total, twist, plan);
  const fouls = (c: typeof built) => {
    if (!c.trace) return false;
    const t = layoutTown(c.trace, c.path, seed);
    return !selfApproachOk(c.path, t.from - 420, t.to + 420);
  };
  if (plan && fouls(built)) built = buildCentreline(resume(seed), total, twist, plan, true);
  if (plan && fouls(built)) built = buildCentreline(resume(seed), total, twist, null);
  const { path, trace } = built;
  const town = trace ? layoutTown(trace, path, seed) : undefined;
  const widths = town ? buildWidths(path, town, halfWidth) : undefined;
  const gates = placeGates(path, length, halfWidth, town);

  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  path.sample(START_DISTANCE - 4, sample);
  return {
    ...brief,
    halfWidth,
    startDistance: START_DISTANCE,
    path,
    gates,
    spawn: { x: sample.x, z: sample.z, yaw: sample.heading },
    ...(town ? { town } : {}),
    ...(widths ? { widths } : {}),
  };
}
