import { hashSeed, mulberry32, pickWeighted } from '../rng';
import type { Surface } from '../vehicle/surfaces';
import type { SpawnPose } from '../vehicle/VehicleSim';
import type { Gate } from './Checkpoints';
import {
  REGIONS,
  stageSlot,
  STAGES_PER_LOOP,
  isCircuitStage,
  type RegionId,
  type Weather,
  reliefAmplitude,
} from './regions';
import { generateCircuit, type CircuitLayout } from './CircuitGenerator';
import {
  CIRCUIT_HALF_WIDTH,
  CIRCUIT_LAPS,
  GRID,
  STANDING_START_SECONDS,
  circuitGates,
  circuitName,
  type CircuitInfo,
} from './CircuitStage';
import { createRoadHit, type RoadPath, type RoadSample } from './RoadPath';
import type { TownDef } from './Town';
import {
  buildCentreline,
  type Centreline,
  RUNOUT,
  selfApproachOk,
  START_DISTANCE,
} from './Centreline';
import { buildCoastRoad } from './CoastRoad';
import { CoastShape } from './CoastShape';
import { buildWidths, halfWidthAt } from './RoadWidth';
import { layoutTown } from './TownGenerator';
import { hasTown, planTown } from './TownPlan';
import { planUrban } from './UrbanPlan';

export { ROAD_SPACING } from './Centreline';
/** Checkpoint boards keep this far clear of a town's route interval. */
const TOWN_GATE_CLEARANCE = 40;
const MIN_GATE_GAP = 60;
/** Four slow corners and narrow streets cost about this much against par. */
const TOWN_PAR_SECONDS = 12;

const SURFACE_PAR: Readonly<Record<Surface, number>> = {
  tarmac: 1.12,
  track: 1.2,
  gravel: 1,
  mud: 0.85,
  snow: 0.82,
  grass: 0.8,
  sand: 0.9,
  dune: 0.8,
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
  /** Difficulty loop, stepping every `STAGES_PER_LOOP` stages (harder, longer variants). */
  loop: number;
  /** Procedural place name (a proper noun, not translated). */
  name: string;
  surface: Surface;
  weather: Weather;
  /** Start line to finish line, metres. */
  length: number;
  parTime: number;
  /** Run after sunset (`stageAtDusk`): a twilight sky and the car's lamps lit. */
  dusk?: true;
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
  /** Set on circuit stages: the path is one closed lap and the gates repeat once per lap. */
  circuit?: CircuitInfo;
}

/** The stage's slot (`stageSlot`: a city, a circuit or the rally mix) and its difficulty loop, which steps on its own cadence. */
export function stageRegion(index: number): { region: RegionId; loop: number; surface?: Surface } {
  return { ...stageSlot(index), loop: Math.floor(index / STAGES_PER_LOOP) };
}

/** A town on every third stage (`hasTown`), except in regions that build none: the coast and the desert. */
export function stageHasTown(index: number): boolean {
  return hasTown(index) && REGIONS[stageRegion(index).region].towns;
}

/** In a region that runs at dusk, every this-many'th of its stages does; the rest run by day. */
export const DUSK_EVERY = 3;

/** Whether the stage at `index` runs at dusk: the third, sixth… stage of a region with `dusk`. */
export function stageAtDusk(index: number): boolean {
  const { region } = stageRegion(index);
  if (!REGIONS[region].dusk) return false;
  let ordinal = 0;
  for (let j = 0; j < index; j++) if (stageRegion(j).region === region) ordinal++;
  return ordinal % DUSK_EVERY === DUSK_EVERY - 1;
}

/**
 * A checkpoint board stands at least this far along the road from a city
 * junction or a roundabout's ring, so it never stands in a mouth or on the
 * ring.
 */
const JUNCTION_GATE_CLEARANCE = 25;

/** Path distances of a city's junctions, where its checkpoints keep off. */
function junctionDistances(path: RoadPath, town: TownDef): number[] {
  const hit = createRoadHit();
  const out: number[] = [];
  for (const j of town.junctions) if (path.nearest(j.x, j.z, 60, hit)) out.push(hit.along);
  return out;
}

/** `distance` moved past the nearest junction zone or ring it falls in, forward if it is past the middle, back otherwise. */
function nudgeOffJunctions(distance: number, junctions: readonly number[], town: TownDef): number {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const j of junctions) {
      if (Math.abs(distance - j) >= JUNCTION_GATE_CLEARANCE) continue;
      distance = distance >= j ? j + JUNCTION_GATE_CLEARANCE : j - JUNCTION_GATE_CLEARANCE;
      moved = true;
    }
    for (const r of town.roundabouts ?? []) {
      const lo = r.from - JUNCTION_GATE_CLEARANCE;
      const hi = r.to + JUNCTION_GATE_CLEARANCE;
      if (distance <= lo || distance >= hi) continue;
      distance = distance >= (lo + hi) / 2 ? hi : lo;
      moved = true;
    }
    if (!moved) break;
  }
  return distance;
}

/**
 * Keep checkpoint boards out of the town and in order; the finish stays
 * where the brief put it. A city is the whole stage, so there its boards
 * stand between junctions instead, each as wide as the street there.
 */
function placeGates(
  path: RoadPath,
  length: number,
  halfWidth: number,
  town: TownDef | undefined,
  widths: Float64Array | undefined,
): Gate[] {
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const checkpoints = Math.min(6, Math.max(2, Math.round(length / 450)));
  const finish = START_DISTANCE + length;
  const distances: number[] = [];
  const whole = town !== undefined && town.from <= START_DISTANCE + TOWN_GATE_CLEARANCE;
  const junctions = town && whole ? junctionDistances(path, town) : [];
  for (let k = 1; k <= checkpoints; k++) {
    let distance = START_DISTANCE + (length * k) / (checkpoints + 1);
    if (
      town &&
      !whole &&
      distance > town.from - TOWN_GATE_CLEARANCE &&
      distance < town.to + TOWN_GATE_CLEARANCE
    )
      distance =
        distance < (town.from + town.to) / 2
          ? town.from - TOWN_GATE_CLEARANCE
          : town.to + TOWN_GATE_CLEARANCE;
    if (town && whole) distance = nudgeOffJunctions(distance, junctions, town);
    const prev = distances[distances.length - 1];
    if (prev !== undefined && distance < prev + MIN_GATE_GAP) distance = prev + MIN_GATE_GAP;
    // The spacing may have put it back on a junction: move it on past that junction, forward only,
    // so it keeps its gap.
    if (town && whole)
      for (const j of junctions)
        if (Math.abs(distance - j) < JUNCTION_GATE_CLEARANCE)
          distance = j + JUNCTION_GATE_CLEARANCE;
    if (distance <= finish - MIN_GATE_GAP) distances.push(distance);
  }
  distances.push(finish);
  const source = { halfWidth, path, ...(widths ? { widths } : {}) };
  return distances.map((distance, i) => {
    path.sample(distance, sample);
    return {
      kind: i === distances.length - 1 ? 'finish' : 'checkpoint',
      distance,
      x: sample.x,
      z: sample.z,
      heading: sample.heading,
      halfWidth: halfWidthAt(source, distance) + 3,
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
  layout: CircuitLayout | null,
  fixed?: Surface,
): StageBrief {
  const def = REGIONS[region];
  // The draw is made either way, so a fixed surface leaves the rest of the stream as it was.
  const drawn = pickWeighted(rand, def.surfaces);
  const surface = fixed ?? drawn;
  const weather = pickWeighted(rand, def.weathers);
  const head = rand();
  const tail = rand();
  const name = layout
    ? circuitName(head, tail)
    : NAME_HEADS[Math.floor(head * NAME_HEADS.length)]! +
      NAME_TAILS[Math.floor(tail * NAME_TAILS.length)]!;
  const jitter = rand();
  // A circuit's length is the race: every lap of the layout drawn after the brief.
  const length = layout
    ? Math.round(CIRCUIT_LAPS * layout.path.length)
    : Math.round(def.baseLength * (1 + 0.25 * loop) * (0.85 + jitter * 0.3));
  const parTime = layout
    ? Math.round(length / (def.parSpeed * SURFACE_PAR[surface])) + STANDING_START_SECONDS
    : Math.round(length / (def.parSpeed * SURFACE_PAR[surface])) + (town ? TOWN_PAR_SECONDS : 0);
  return {
    seed,
    index,
    region,
    loop,
    name,
    surface,
    weather,
    length,
    parTime,
    ...(stageAtDusk(index) ? { dusk: true as const } : {}),
  };
}

/** A circuit stage's layout, drawn from the stream after the brief's five draws. */
function circuitLayout(index: number, seed: number): CircuitLayout | null {
  return isCircuitStage(index) ? generateCircuit(resume(seed)) : null;
}

/** Name, surface, length and par of a stage without building its road (for lists); a circuit's layout is drawn to know its lap. */
export function stageBrief(gameSeed: number, index: number): StageBrief {
  const { region, loop, surface } = stageRegion(index);
  const seed = hashSeed(gameSeed, region, index);
  return drawBrief(
    mulberry32(seed),
    seed,
    index,
    region,
    loop,
    stageHasTown(index),
    circuitLayout(index, seed),
    surface,
  );
}

/** The stage's RNG stream positioned after the brief's five draws, where the walk starts. */
function resume(seed: number): () => number {
  const rand = mulberry32(seed);
  for (let i = 0; i < 5; i++) rand();
  return rand;
}

/** A circuit race: one closed lap as the path, gates unrolled over every lap, the car on pole behind the line. */
function circuitStage(brief: StageBrief, layout: CircuitLayout): StageDef {
  const { path, startDistance } = layout;
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  path.sample(startDistance - GRID.first - GRID.carBack, sample);
  // Pole is the first slot, on the left of the centre line.
  sample.x += Math.cos(sample.heading) * GRID.stagger;
  sample.z -= Math.sin(sample.heading) * GRID.stagger;
  return {
    ...brief,
    halfWidth: CIRCUIT_HALF_WIDTH,
    startDistance,
    path,
    gates: circuitGates(path, startDistance, CIRCUIT_LAPS, CIRCUIT_HALF_WIDTH),
    spawn: { x: sample.x, z: sample.z, yaw: sample.heading },
    circuit: {
      laps: CIRCUIT_LAPS,
      lapLength: path.length,
      style: layout.style,
      mainStraight: layout.mainStraight,
      relief: layout.relief,
    },
  };
}

/** Deterministic stage from (game seed, global stage index). */
export function generateStage(gameSeed: number, index: number): StageDef {
  const { region, loop, surface: fixedSurface } = stageRegion(index);
  const def = REGIONS[region];
  const seed = hashSeed(gameSeed, region, index);
  const withTown = stageHasTown(index);
  const layout = circuitLayout(index, seed);
  const brief = drawBrief(
    mulberry32(seed),
    seed,
    index,
    region,
    loop,
    withTown,
    layout,
    fixedSurface,
  );
  if (layout) return circuitStage(brief, layout);
  const { surface, length } = brief;
  const twist = def.twistiness * (1 + 0.15 * Math.min(loop, 4));
  // The corniche is a lane wider: dark tarmac between pale verges reads narrower than a gravel
  // road whose shoulders blend into it. A city's base width is its widest boulevard; every
  // narrower street is a narrowing of it (see `buildWidths`).
  const halfWidth = def.urban
    ? def.urban.lanes.four
    : def.coast
      ? 5.5
      : surface === 'tarmac'
        ? 4.5
        : 4;
  const total = START_DISTANCE + length + RUNOUT;
  // The town draws from its own seed so the brief and the walk keep their streams. The walk is
  // rebuilt with the plan mirrored if the town fouls the open road around it, and without a town
  // if that fails too, so the stage's own invariants always hold. A city's plan covers the whole
  // road and is validated as a whole, so it is laid as drawn.
  const plan = withTown
    ? planTown(seed, START_DISTANCE, length, halfWidth)
    : def.urban
      ? planUrban(seed, total, loop, def.urban)
      : null;
  // A coast road is drawn on the coast's ground (shore-following, with hairpin stacks) rather than walked.
  let built: Centreline = def.coast
    ? {
        path: buildCoastRoad(
          resume(seed),
          total,
          new CoastShape(
            seed,
            def.coast.seaLevel,
            reliefAmplitude(def, loop),
            def.terrain.frequency,
            loop,
          ),
        ).path,
        trace: null,
      }
    : buildCentreline(resume(seed), total, twist, plan);
  const fouls = (c: typeof built) => {
    if (!c.trace) return false;
    const t = layoutTown(c.trace, c.path, seed, halfWidth);
    return !selfApproachOk(c.path, t.from - 420, t.to + 420);
  };
  if (withTown && plan && fouls(built))
    built = buildCentreline(resume(seed), total, twist, plan, true);
  if (withTown && plan && fouls(built)) built = buildCentreline(resume(seed), total, twist, null);
  const { path, trace } = built;
  const town = trace ? layoutTown(trace, path, seed, halfWidth, def.urban) : undefined;
  const widths = town ? (town.widths ?? buildWidths(path, town, halfWidth)) : undefined;
  const gates = placeGates(path, length, halfWidth, town, widths);

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
