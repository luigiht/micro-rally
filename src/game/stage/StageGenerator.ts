import { hashSeed, mulberry32, pickWeighted } from '../rng';
import type { Surface } from '../vehicle/surfaces';
import type { SpawnPose } from '../vehicle/VehicleSim';
import type { Gate } from './Checkpoints';
import { REGION_ORDER, REGIONS, STAGES_PER_REGION, type RegionId, type Weather } from './regions';
import { RoadPath, type RoadSample } from './RoadPath';

export const ROAD_SPACING = 2;
const CONTROL_STEP = 20;
const START_DISTANCE = 30;
const RUNOUT = 140;
const MAX_DEVIATION = 1.25;

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

export interface StageDef {
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
  halfWidth: number;
  startDistance: number;
  path: RoadPath;
  gates: Gate[];
  parTime: number;
  spawn: SpawnPose;
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

function buildCentreline(rand: () => number, total: number, twist: number): RoadPath {
  const theta0 = rand() * Math.PI * 2;
  let heading = theta0;
  let curv = 0;
  let bendCurv = 0;
  let bendLeft = 0;
  let bendSign = rand() < 0.5 ? -1 : 1;
  let x = 0;
  let z = 0;
  const ctrl: number[] = [
    x - Math.sin(heading) * CONTROL_STEP,
    z - Math.cos(heading) * CONTROL_STEP,
    x,
    z,
  ];
  for (let d = 0; d < total + CONTROL_STEP * 3; d += CONTROL_STEP) {
    if (d > START_DISTANCE + CONTROL_STEP) {
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
  return RoadPath.fromPolyline(dense, ROAD_SPACING);
}

/** Deterministic stage from (game seed, global stage index). */
export function generateStage(gameSeed: number, index: number): StageDef {
  const { region, loop } = stageRegion(index);
  const def = REGIONS[region];
  const seed = hashSeed(gameSeed, region, index);
  const rand = mulberry32(seed);

  const surface = pickWeighted(rand, def.surfaces);
  const weather = pickWeighted(rand, def.weathers);
  const name =
    NAME_HEADS[Math.floor(rand() * NAME_HEADS.length)]! +
    NAME_TAILS[Math.floor(rand() * NAME_TAILS.length)]!;
  const length = Math.round(def.baseLength * (1 + 0.25 * loop) * (0.85 + rand() * 0.3));
  const twist = def.twistiness * (1 + 0.15 * Math.min(loop, 4));
  const path = buildCentreline(rand, START_DISTANCE + length + RUNOUT, twist);
  const halfWidth = surface === 'tarmac' ? 4.5 : 4;

  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const checkpoints = Math.min(6, Math.max(2, Math.round(length / 450)));
  const gates: Gate[] = [];
  for (let k = 1; k <= checkpoints + 1; k++) {
    const distance = START_DISTANCE + (length * k) / (checkpoints + 1);
    path.sample(distance, sample);
    gates.push({
      kind: k === checkpoints + 1 ? 'finish' : 'checkpoint',
      distance,
      x: sample.x,
      z: sample.z,
      heading: sample.heading,
      halfWidth: halfWidth + 3,
    });
  }

  path.sample(START_DISTANCE - 4, sample);
  return {
    seed,
    index,
    region,
    loop,
    name,
    surface,
    weather,
    length,
    halfWidth,
    startDistance: START_DISTANCE,
    path,
    gates,
    parTime: Math.round(length / (def.parSpeed * SURFACE_PAR[surface])),
    spawn: { x: sample.x, z: sample.z, yaw: sample.heading },
  };
}
