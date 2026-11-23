import { hashSeed, mulberry32, pickWeighted } from '../rng';
import type { Surface } from '../vehicle/surfaces';
import type { SpawnPose } from '../vehicle/VehicleSim';
import type { Gate } from './Checkpoints';
import {
  RALLY_CYCLE,
  STAGE_TYPES,
  stageSlot,
  STAGES_PER_LOOP,
  type StageTypeDef,
  type StageTypeId,
  type Weather,
  reliefAmplitude,
} from './regions';
import { SPLASH_PAR_SECONDS, splashCount } from './Watersplashes';
import { planSurfaceSpans, type SurfaceSpan } from './SurfaceSpans';
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
import type { Lacet, StageLacet } from './Lacets';
import { CoastShape } from './CoastShape';
import { buildWidths, halfWidthAt } from './RoadWidth';
import { layoutTown } from './TownGenerator';
import { hasTown, planTown, TOWN_EVERY } from './TownPlan';
import { planUrban } from './UrbanPlan';

export { ROAD_SPACING } from './Centreline';
/** Checkpoint boards keep this far clear of a town's route interval. */
const TOWN_GATE_CLEARANCE = 40;
const MIN_GATE_GAP = 60;
/**
 * Checkpoint boards keep this far clear of a hairpin stack (`Lacets`), so
 * their crowds have the hillside to themselves: at its foot or its top.
 */
const STACK_GATE_CLEARANCE = 30;
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
  water: 0.6,
  fechfech: 0.85,
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
  stageType: StageTypeId;
  /** Difficulty loop, stepping every `STAGES_PER_LOOP` stages (harder, longer variants). */
  loop: number;
  /** Procedural place name (a proper noun, not translated). */
  name: string;
  surface: Surface;
  weather: Weather;
  /** Start line to finish line, metres. */
  length: number;
  parTime: number;
  /** Run late in the day (`stageAtDusk`): the stage type's twilight light and the car's lamps lit. */
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
  /** The hairpin stacks the road climbs (`Lacets`), where the region lays them; the ground steps up across each. */
  lacets?: StageLacet[];
  /** Where the road changes surface along its length (`SurfaceSpans`), on stage types that do; `surface` throughout elsewhere. */
  surfaces?: SurfaceSpan[];
}

/** The stage's slot (`stageSlot`: a city, a circuit or the rally mix) and its difficulty loop, which steps on its own cadence. */
export function stageTypeAt(index: number): { stageType: StageTypeId; loop: number } {
  return { stageType: stageSlot(index), loop: Math.floor(index / STAGES_PER_LOOP) };
}

/** A town on every third stage (`hasTown`), except Coastal and Desert types. */
export function stageHasTown(index: number): boolean {
  return hasTown(index) && STAGE_TYPES[stageTypeAt(index).stageType].towns;
}

/** Whether the `ordinal`th (from 0) stage of a type runs late: every `dusk.every`th of them, the rest by day. */
function lateRun(def: StageTypeDef, ordinal: number): boolean {
  return def.dusk !== undefined && ordinal % def.dusk.every === def.dusk.every - 1;
}

/** Whether the stage at `index` runs late (`StageTypeDef.dusk`): the Arctic's third, sixth…, the Coast's second, fourth… */
export function stageAtDusk(index: number): boolean {
  const { stageType } = stageTypeAt(index);
  if (!STAGE_TYPES[stageType].dusk) return false;
  let ordinal = 0;
  for (let j = 0; j < index; j++) if (stageTypeAt(j).stageType === stageType) ordinal++;
  return lateRun(STAGE_TYPES[stageType], ordinal);
}

/**
 * What runs at a stage index: its type, its difficulty loop (roads grow
 * longer and tighter every `STAGES_PER_LOOP` stages), and whether it carries
 * a town and runs at dusk. The career follows the calendar
 * (`calendarSlot`); a multiplayer session cycles through the types its host
 * picked (`cycleSlot`). Plain data, so it can be posted to the terrain worker.
 */
export interface StageSlot {
  stageType: StageTypeId;
  loop: number;
  town: boolean;
  dusk: boolean;
}

/** The career calendar's slot: cities, circuits and the rally mix. */
export function calendarSlot(index: number): StageSlot {
  const { stageType, loop } = stageTypeAt(index);
  return { stageType, loop, town: stageHasTown(index), dusk: stageAtDusk(index) };
}

/**
 * A run of stages cycling through `types` in order: stage `index` is
 * `types[index % types.length]`. As in the calendar, a town stands on every
 * third rally stage of a type that has towns, and a type that runs late runs
 * its own share of its stages late (`StageTypeDef.dusk`).
 */
export function cycleSlot(types: readonly StageTypeId[], index: number): StageSlot {
  const typeAt = (j: number) => types[j % types.length]!;
  const stageType = typeAt(index);
  const def = STAGE_TYPES[stageType];
  const rally = (t: StageTypeId) => RALLY_CYCLE.includes(t);
  let rallyBefore = 0;
  let sameBefore = 0;
  for (let j = 0; j < index; j++) {
    if (rally(typeAt(j))) rallyBefore++;
    if (typeAt(j) === stageType) sameBefore++;
  }
  return {
    stageType,
    loop: Math.floor(index / STAGES_PER_LOOP),
    town: rally(stageType) && def.towns && rallyBefore % TOWN_EVERY === TOWN_EVERY - 1,
    dusk: lateRun(def, sameBefore),
  };
}

/**
 * A checkpoint board stands at least this far along the road from a city
 * junction or a roundabout's ring, so it never stands in a mouth or on the
 * ring.
 */
const JUNCTION_GATE_CLEARANCE = 25;

/** Path distances of the junctions a city's route drives through, where its checkpoints keep off; in order. */
function junctionDistances(path: RoadPath, town: TownDef): number[] {
  const hit = createRoadHit();
  const out: number[] = [];
  for (const j of town.junctions)
    if (j.arms.some((a) => a.role !== 'blocked') && path.nearest(j.x, j.z, 60, hit))
      out.push(hit.along);
  return out.sort((a, b) => a - b);
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
  stacks: readonly StageLacet[] = [],
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
    // Off a hairpin stack, to whichever end is nearer.
    for (const s of stacks) {
      const lo = s.from - STACK_GATE_CLEARANCE;
      const hi = s.to + STACK_GATE_CLEARANCE;
      if (distance > lo && distance < hi) distance = distance < (lo + hi) / 2 ? lo : hi;
    }
    const prev = distances[distances.length - 1];
    if (prev !== undefined && distance < prev + MIN_GATE_GAP) distance = prev + MIN_GATE_GAP;
    // The spacing may have put it back on a stack: on past it, forward only.
    for (const s of stacks)
      if (distance > s.from - STACK_GATE_CLEARANCE && distance < s.to + STACK_GATE_CLEARANCE)
        distance = s.to + STACK_GATE_CLEARANCE;
    // The spacing may have put it back on a junction: move it on past that junction, forward only,
    // so it keeps its gap.
    if (town && whole)
      for (const j of junctions)
        // In order, so each move can only meet the junctions after it.
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

/** Each stack with the road distances where it leaves the stage axis and where it rejoins it. */
function lacetSpans(path: RoadPath, lacets: readonly Lacet[]): StageLacet[] {
  const hit = createRoadHit();
  const along = (p: { x: number; z: number }) =>
    path.nearest(p.x, p.z, 10, hit) ? hit.along : NaN;
  return lacets.map((l) => ({ ...l, from: along(l.entry), to: along(l.exit) }));
}

/**
 * Seconds a decent run spends between the start and finish lines at the
 * type's par speed, each stretch at its own surface's pace where the road
 * changes surface (`SurfaceSpans`, drawn from the seed and length alone),
 * plus a few seconds' wading through any watersplashes.
 */
function drivingTime(def: StageTypeDef, seed: number, length: number): number {
  // Each watersplash costs a little wading (`Watersplashes`), counted from the seed alone.
  const wading = def.splashes ? splashCount(seed, def.splashes) * SPLASH_PAR_SECONDS : 0;
  const own = length / (def.parSpeed * SURFACE_PAR[def.surface]) + wading;
  if (!def.surfaceSpans) return own;
  const from = START_DISTANCE;
  const to = START_DISTANCE + length;
  let time = 0;
  for (const s of planSurfaceSpans(seed, length, def.surface, def.surfaceSpans)) {
    const run = Math.min(to, s.to) - Math.max(from, s.from);
    if (run > 0) time += run / (def.parSpeed * SURFACE_PAR[s.surface]);
  }
  return time + wading;
}

/** Draws the brief in RNG order; `generateStage` continues with the same stream. */
function drawBrief(
  rand: () => number,
  seed: number,
  index: number,
  stageType: StageTypeId,
  loop: number,
  town: boolean,
  dusk: boolean,
  layout: CircuitLayout | null,
): StageBrief {
  const def = STAGE_TYPES[stageType];
  // Keep the historical surface draw reserved so stage seeds retain their other draws.
  rand();
  const surface = def.surface;
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
    : Math.round(drivingTime(def, seed, length)) + (town ? TOWN_PAR_SECONDS : 0);
  return {
    seed,
    index,
    stageType,
    loop,
    name,
    surface,
    weather,
    length,
    parTime,
    ...(dusk ? { dusk: true as const } : {}),
  };
}

/** A circuit stage's layout, drawn from the stream after the brief's five draws. */
function circuitLayout(stageType: StageTypeId, seed: number): CircuitLayout | null {
  return stageType === 'circuit' ? generateCircuit(resume(seed)) : null;
}

/**
 * Name, surface, length and par of a stage without building its road (for
 * lists); a circuit's layout is drawn to know its lap. `slot` defaults to
 * the career calendar's.
 */
export function stageBrief(
  gameSeed: number,
  index: number,
  slot: StageSlot = calendarSlot(index),
): StageBrief {
  const { stageType, loop, town, dusk } = slot;
  const seed = hashSeed(gameSeed, STAGE_TYPES[stageType].seedKey, index);
  return drawBrief(
    mulberry32(seed),
    seed,
    index,
    stageType,
    loop,
    town,
    dusk,
    circuitLayout(stageType, seed),
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
    gates: circuitGates(path, startDistance, CIRCUIT_LAPS, CIRCUIT_HALF_WIDTH, layout.crossing),
    spawn: { x: sample.x, z: sample.z, yaw: sample.heading },
    circuit: {
      laps: CIRCUIT_LAPS,
      lapLength: path.length,
      style: layout.style,
      mainStraight: layout.mainStraight,
      relief: layout.relief,
      crossing: layout.crossing,
    },
  };
}

/** Deterministic stage from (game seed, stage index), in the calendar's slot unless given another. */
export function generateStage(
  gameSeed: number,
  index: number,
  slot: StageSlot = calendarSlot(index),
): StageDef {
  const { stageType, loop, dusk } = slot;
  const def = STAGE_TYPES[stageType];
  const seed = hashSeed(gameSeed, def.seedKey, index);
  const withTown = slot.town;
  const layout = circuitLayout(stageType, seed);
  const brief = drawBrief(mulberry32(seed), seed, index, stageType, loop, withTown, dusk, layout);
  if (layout) return circuitStage(brief, layout);
  const { surface, length } = brief;
  const twist = def.twistiness * (1 + 0.15 * Math.min(loop, 4));
  // The corniche is a lane wider: dark tarmac between pale verges reads narrower than a gravel
  // road whose shoulders blend into it, and the Autumnal mud lane narrower still. A city's base
  // width is its widest boulevard; every narrower street is a narrowing of it (see `buildWidths`).
  const halfWidth = def.urban
    ? def.urban.lanes.four
    : def.coast
      ? 5.5
      : (def.roadHalfWidth ?? (surface === 'tarmac' ? 4.5 : 4));
  const total = START_DISTANCE + length + RUNOUT;
  const style = {
    ...(def.straights !== undefined ? { straights: def.straights } : {}),
    ...(def.lacets ? { lacets: def.lacets } : {}),
  };
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
        lacets: [],
      }
    : buildCentreline(resume(seed), total, twist, plan, false, style);
  const fouls = (c: typeof built) => {
    if (!c.trace) return false;
    const t = layoutTown(c.trace, c.path, seed, halfWidth);
    return !selfApproachOk(c.path, t.from - 420, t.to + 420);
  };
  if (withTown && plan && fouls(built))
    built = buildCentreline(resume(seed), total, twist, plan, true, style);
  if (withTown && plan && fouls(built))
    built = buildCentreline(resume(seed), total, twist, null, false, style);
  const { path, trace, lacets } = built;
  const town = trace ? layoutTown(trace, path, seed, halfWidth, def.urban, plan?.city) : undefined;
  const widths = town ? (town.widths ?? buildWidths(path, town, halfWidth)) : undefined;
  const stacks = lacetSpans(path, lacets);
  const gates = placeGates(path, length, halfWidth, town, widths, stacks);

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
    ...(stacks.length > 0 ? { lacets: stacks } : {}),
    ...(def.surfaceSpans
      ? { surfaces: planSurfaceSpans(seed, length, def.surface, def.surfaceSpans) }
      : {}),
  };
}
