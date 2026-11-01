import { hashSeed, mulberry32, pickWeighted } from '../rng';
import type { Surface } from '../vehicle/surfaces';
import type { SpawnPose } from '../vehicle/VehicleSim';
import type { Gate } from './Checkpoints';
import { REGION_ORDER, REGIONS, STAGES_PER_REGION, type RegionId, type Weather } from './regions';
import { RoadPath, type RoadSample } from './RoadPath';
import type { TownDef } from './Town';
import { buildWidths, hasTown, layoutTown, type TownTrace } from './TownGenerator';
import { planTown, townSpan, type TownPlan } from './TownPlan';

export const ROAD_SPACING = 2;
const CONTROL_STEP = 20;
const START_DISTANCE = 30;
const RUNOUT = 140;
const MAX_DEVIATION = 1.25;
/** Straight run into a town so the first corner is seen coming. */
const TOWN_APPROACH = 60;
/** Checkpoint boards keep this far clear of a town's route interval. */
const TOWN_GATE_CLEARANCE = 40;
const MIN_GATE_GAP = 60;

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

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * Heading random walk on a 20 m control polygon, smoothed with Catmull-Rom.
 * With a town plan the walk straightens for `TOWN_APPROACH`, then lays the
 * town's legs on the grid (one block, a right-angle turn at each corner, one
 * block out) and resumes on the heading it arrived with; `trace` records
 * where that happened.
 */
function buildCentreline(
  rand: () => number,
  total: number,
  twist: number,
  plan: TownPlan | null,
): { path: RoadPath; trace: TownTrace | null } {
  const theta0 = rand() * Math.PI * 2;
  let heading = theta0;
  let curv = 0;
  let bendCurv = 0;
  let bendLeft = 0;
  let bendSign = rand() < 0.5 ? -1 : 1;
  let x = 0;
  let z = 0;
  let trace: TownTrace | null = null;
  const ctrl: number[] = [
    x - Math.sin(heading) * CONTROL_STEP,
    z - Math.cos(heading) * CONTROL_STEP,
    x,
    z,
  ];
  for (let d = 0; d < total + CONTROL_STEP * 3; d += CONTROL_STEP) {
    if (plan && d === plan.entryAt) {
      trace = { entry: { x, z, heading }, legs: [], exit: { x, z } };
      let h = heading;
      for (const leg of plan.legs) {
        const points = [{ x, z }];
        const headingIn = h;
        if (leg.kind === 'straight') {
          for (let k = 0; k < leg.length / CONTROL_STEP; k++) {
            x += Math.sin(h) * CONTROL_STEP;
            z += Math.cos(h) * CONTROL_STEP;
            ctrl.push(x, z);
          }
          points.push({ x, z });
        } else {
          // Arc as short chords so the spline hugs the bend and no chord turns more than ~20°.
          const steps = Math.max(5, Math.ceil(leg.length / 5));
          const dA = leg.sweep / steps;
          const chord = 2 * leg.radius * Math.sin(Math.abs(dA) / 2);
          for (let k = 0; k < steps; k++) {
            x += Math.sin(h + dA / 2) * chord;
            z += Math.cos(h + dA / 2) * chord;
            h += dA;
            ctrl.push(x, z);
            points.push({ x, z });
          }
        }
        trace.legs.push({
          kind: leg.kind,
          points,
          headingIn,
          headingOut: h,
          turn: leg.turn,
          halfWidth: leg.halfWidth,
          radius: leg.radius,
          sweep: leg.sweep,
          length: leg.length,
        });
        h += leg.turn;
      }
      trace.exit = { x, z };
      heading = h;
      d += townSpan(plan) - CONTROL_STEP;
      curv = 0;
      bendCurv = 0;
      bendLeft = 1;
      continue;
    }
    const approaching = plan !== null && d >= plan.entryAt - TOWN_APPROACH && d < plan.entryAt;
    if (approaching) {
      bendCurv = 0;
      curv = 0;
      bendLeft = 1;
    }
    if (d > START_DISTANCE + CONTROL_STEP && !approaching) {
      if (bendLeft <= 0) {
        if (rand() < 0.2) {
          bendCurv = 0;
          bendLeft = 1 + Math.floor(rand() * 2);
        } else {
          // Mostly alternate direction so bends chain into S-curves.
          if (rand() < 0.7) bendSign = -bendSign;
          bendCurv = bendSign * (0.18 + Math.pow(rand(), 0.7) * 0.55) * (0.5 + twist * 0.6);
          bendLeft = 1 + Math.floor(rand() * 3);
        }
      }
      bendLeft--;
      curv += (bendCurv - curv) * 0.85;
      heading += curv;
      const dev = heading - theta0;
      if (Math.abs(dev) > MAX_DEVIATION) {
        heading = theta0 + Math.sign(dev) * MAX_DEVIATION;
        curv = 0;
        bendSign = -Math.sign(dev);
        bendLeft = 0;
      }
    }
    x += Math.sin(heading) * CONTROL_STEP;
    z += Math.cos(heading) * CONTROL_STEP;
    ctrl.push(x, z);
  }

  const dense: number[] = [];
  const n = ctrl.length / 2;
  for (let i = 1; i < n - 2; i++) {
    for (let s = 0; s < 12; s++) {
      const t = s / 12;
      dense.push(
        catmullRom(ctrl[(i - 1) * 2]!, ctrl[i * 2]!, ctrl[(i + 1) * 2]!, ctrl[(i + 2) * 2]!, t),
        catmullRom(
          ctrl[(i - 1) * 2 + 1]!,
          ctrl[i * 2 + 1]!,
          ctrl[(i + 1) * 2 + 1]!,
          ctrl[(i + 2) * 2 + 1]!,
          t,
        ),
      );
    }
  }
  return { path: RoadPath.fromPolyline(dense, ROAD_SPACING), trace };
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
): StageBrief {
  const def = REGIONS[region];
  const surface = pickWeighted(rand, def.surfaces);
  const weather = pickWeighted(rand, def.weathers);
  const name =
    NAME_HEADS[Math.floor(rand() * NAME_HEADS.length)]! +
    NAME_TAILS[Math.floor(rand() * NAME_TAILS.length)]!;
  const length = Math.round(def.baseLength * (1 + 0.25 * loop) * (0.85 + rand() * 0.3));
  const parTime = Math.round(length / (def.parSpeed * SURFACE_PAR[surface]));
  return { seed, index, region, loop, name, surface, weather, length, parTime };
}

/** Name, surface, length and par of a stage without building its road (for lists). */
export function stageBrief(gameSeed: number, index: number): StageBrief {
  const { region, loop } = stageRegion(index);
  const seed = hashSeed(gameSeed, region, index);
  return drawBrief(mulberry32(seed), seed, index, region, loop);
}

/** Deterministic stage from (game seed, global stage index). */
export function generateStage(gameSeed: number, index: number): StageDef {
  const { region, loop } = stageRegion(index);
  const def = REGIONS[region];
  const seed = hashSeed(gameSeed, region, index);
  const rand = mulberry32(seed);
  const brief = drawBrief(rand, seed, index, region, loop);
  const { surface, length } = brief;
  const twist = def.twistiness * (1 + 0.15 * Math.min(loop, 4));
  const halfWidth = surface === 'tarmac' ? 4.5 : 4;
  // The town draws from its own seed so the brief and the walk keep their streams.
  const plan = hasTown(seed, index) ? planTown(seed, START_DISTANCE, length, halfWidth) : null;
  const { path, trace } = buildCentreline(rand, START_DISTANCE + length + RUNOUT, twist, plan);
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
