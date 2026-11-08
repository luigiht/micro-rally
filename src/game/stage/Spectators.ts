import { hashSeed, mulberry32 } from '../rng';
import { REGIONS } from './regions';
import { createRoadHit, type RoadSample } from './RoadPath';
import type { Prop } from './SceneryScatter';
import type { TerrainField } from './TerrainField';
import { townBlocks } from './Town';

/** Jacket colours and poses a spectator's variant picks from: `variant % jackets`, then the pose. */
export const SPECTATOR_JACKETS = 6;
export const SPECTATOR_POSES = 6;
/** Wild props this close to a spectator are dropped. */
export const SPECTATOR_CLEAR = 2.2;

/** Roadside groups: five or six people, the first this far into the stage, standing this far past the banks. */
const GROUP_MIN = 5;
const GROUP_MAX = 6;
const FIRST = 80;
const BACK = 1.2;
/** Crowds: people about a stride apart down the front row, the second row this far behind it. */
const STRIDE = 1.15;
const ROW_GAP = 1.3;
/** The control boards and the arches' posts stand in a gap this long either side of their line. */
const GATE_GAP = 4;
/** In a crowd, no pose-and-jacket pairing comes up twice within this many people dealt in a row. */
const DEAL_APART = 6;
/** Groups keep this far from a crowd's ends, so the two never pile up. */
const CROWD_MARGIN = 10;

/**
 * A stretch of road lined on both sides: front-row places `spacing` strides
 * apart, `rows` the chance one has someone behind it.
 */
interface Crowd {
  from: number;
  to: number;
  rows: number;
  spacing: number;
  gap?: number;
}

/**
 * Where the crowds gather: round the start, at each checkpoint, along the
 * run-up and landing of every crest the car can jump, and down the run-in
 * to the finish, in road order, trimmed so none overlaps the one before.
 */
function crowds(field: TerrainField): Crowd[] {
  const stage = field.stage;
  const start = stage.startDistance;
  // The finish draws the biggest crowd; the start, the checkpoints and the jumps half as thick.
  const list: Crowd[] = [{ from: start - 25, to: start + 35, rows: 0.8, spacing: 2, gap: start }];
  for (const g of stage.gates) {
    const d = g.distance;
    if (g.kind === 'finish') list.push({ from: d - 45, to: d + 25, rows: 0.8, spacing: 1, gap: d });
    else list.push({ from: d - 22, to: d + 18, rows: 0.4, spacing: 2, gap: d });
  }
  for (const c of field.crestsAt) list.push({ from: c - 26, to: c + 10, rows: 0.25, spacing: 2 });
  list.sort((a, b) => a.from - b.from);
  let end = 2;
  const out: Crowd[] = [];
  for (const c of list) {
    const from = Math.max(c.from, end);
    const to = Math.min(c.to, stage.path.length - 2);
    if (to - from < STRIDE * c.spacing) continue;
    out.push({ ...c, from, to });
    end = to;
  }
  return out;
}

/**
 * The spectators down a stage: crowds at the start, the checkpoints, the
 * jumps and the finish (`crowds`), and between them `perHundred` groups
 * per 100 m, five or six people a stride apart, on either side, no two in a
 * group striking the same pose or wearing the same jacket. All
 * stand just behind the snow banks (or the verge) facing the road, never
 * inside a town's buildings nor where another stretch of road passes close.
 */
export function scatterSpectators(field: TerrainField, perHundred: number): Prop[] {
  const stage = field.stage;
  const rand = mulberry32(hashSeed(stage.seed, 'spectators'));
  const path = stage.path;
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const hit = createRoadHit();
  const banks = REGIONS[stage.region].terrain.banks;
  const verge = stage.halfWidth + 0.6 + (banks ? banks.width : 2);
  const back = verge + BACK;
  const out: Prop[] = [];

  const stand = (d: number, side: 1 | -1, off: number, variant: number): void => {
    path.sample(d, sample);
    const x = sample.x + Math.cos(sample.heading) * off * side;
    const z = sample.z - Math.sin(sample.heading) * off * side;
    if (stage.town && townBlocks(stage.town, x, z)) return;
    // Another stretch of road (a hairpin's other leg) inside the banks: nobody stands on it.
    if (path.nearest(x, z, verge, hit)) return;
    // Facing the road: from the left of travel the road lies to the right, so the front (−z)
    // turns by heading + π/2; from the right, heading − π/2; a little head-turn either way.
    out.push({
      kind: 'spectator',
      x,
      y: field.heightAt(x, z),
      z,
      scale: 0.92 + rand() * 0.12,
      rotation: sample.heading + (side * Math.PI) / 2 + (rand() - 0.5) * 0.5,
      variant,
    });
  };

  // Crowds deal from a shuffled deck of every pose-and-jacket pairing, skipping any of the last
  // few dealt when a fresh deck starts, so no pairing repeats among neighbours.
  const deck: number[] = [];
  const recent: number[] = [];
  const deal = (): number => {
    if (deck.length === 0) deck.push(...shuffled(SPECTATOR_JACKETS * SPECTATOR_POSES, rand));
    let i = deck.length - 1;
    while (i > 0 && recent.includes(deck[i]!)) i--;
    const card = deck.splice(i, 1)[0]!;
    recent.push(card);
    if (recent.length > DEAL_APART) recent.shift();
    return card;
  };

  const lined = crowds(field);
  for (const c of lined) {
    for (const side of [1, -1] as const) {
      const step = STRIDE * c.spacing;
      for (let d = c.from + rand() * step * 0.5; d < c.to; d += step * (0.8 + 0.4 * rand())) {
        if (c.gap !== undefined && Math.abs(d - c.gap) < GATE_GAP) continue;
        stand(d, side, back + rand() * 0.5, deal());
        if (rand() < c.rows)
          stand(d + step * (rand() - 0.5), side, back + ROW_GAP + rand() * 0.5, deal());
      }
    }
  }

  let side: 1 | -1 = rand() < 0.5 ? 1 : -1;
  for (
    let d = FIRST + rand() * 40;
    d < path.length - 60;
    d += (100 / perHundred) * (0.6 + 0.8 * rand())
  ) {
    if (rand() < 0.6) side = -side as 1 | -1;
    if (lined.some((c) => d > c.from - CROWD_MARGIN && d < c.to + CROWD_MARGIN)) continue;
    const n = GROUP_MIN + Math.floor(rand() * (GROUP_MAX - GROUP_MIN + 1));
    // Each member a different pose and a different jacket.
    const poses = shuffled(SPECTATOR_POSES, rand);
    const jackets = shuffled(SPECTATOR_JACKETS, rand);
    // Along the road a stride apart, a little in and out of line.
    for (let i = 0; i < n; i++)
      stand(
        d + (i - (n - 1) / 2) * 0.9 + (rand() - 0.5) * 0.3,
        side,
        back + rand() * 1.4,
        jackets[i]! + SPECTATOR_JACKETS * poses[i]!,
      );
  }
  return out;
}

/** 0 … n − 1 in a seeded random order (Fisher–Yates). */
function shuffled(n: number, rand: () => number): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A test for "a spectator stands within `SPECTATOR_CLEAR` of here", hashed so it stays quick for big crowds. */
export function nearSpectator(spectators: readonly Prop[]): (x: number, z: number) => boolean {
  const cells = new Map<string, Prop[]>();
  const key = (cx: number, cz: number) => `${cx},${cz}`;
  for (const s of spectators) {
    const k = key(Math.floor(s.x / SPECTATOR_CLEAR), Math.floor(s.z / SPECTATOR_CLEAR));
    const list = cells.get(k);
    if (list) list.push(s);
    else cells.set(k, [s]);
  }
  return (x, z) => {
    const cx = Math.floor(x / SPECTATOR_CLEAR);
    const cz = Math.floor(z / SPECTATOR_CLEAR);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const s of cells.get(key(cx + i, cz + j)) ?? [])
          if (Math.hypot(s.x - x, s.z - z) < SPECTATOR_CLEAR) return true;
    return false;
  };
}
