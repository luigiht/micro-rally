import { hashSeed, mulberry32 } from '../rng';
import { REGIONS } from './regions';
import { createRoadHit, type RoadSample } from './RoadPath';
import type { Prop } from './SceneryScatter';
import type { TerrainMound } from './TerrainDetail';
import type { TerrainField } from './TerrainField';
import { townBlocks, townFade } from './Town';

/** Jacket colours and poses a spectator's variant picks from: `variant % jackets`, then the pose. */
export const SPECTATOR_JACKETS = 6;
export const SPECTATOR_POSES = 9;
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
 * Berms (mud and Alpine stages): earth heaped from this far past the carriageway's edge
 * (clear of the verge strip), this deep and high, in runs this long; the
 * crowd stands just behind, its eyes well above the crest.
 */
const BERM_FROM = 3.4;
const BERM_DEPTH = 3.6;
const BERM_HEIGHT = 0.7;
const BERM_RUN = 8;
const BERM_BACK = BERM_FROM + BERM_DEPTH + 0.4;

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
  /** The start, checkpoint and finish crowds stand behind a berm where the stage has them. */
  berm?: boolean;
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
  const list: Crowd[] = [
    { from: start - 25, to: start + 35, rows: 0.8, spacing: 2, gap: start, berm: true },
  ];
  for (const g of stage.gates) {
    const d = g.distance;
    if (g.kind === 'finish')
      list.push({ from: d - 45, to: d + 25, rows: 0.8, spacing: 1, gap: d, berm: true });
    else list.push({ from: d - 22, to: d + 18, rows: 0.4, spacing: 2, gap: d, berm: true });
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
 * group striking the same pose or wearing the same jacket. With `berms` (mud
 * and Alpine stages) the groups and the start, checkpoint and finish crowds stand a few metres
 * further back, behind a low berm of earth heaped between them and the road
 * (returned as `mounds` for the terrain). All
 * stand just behind the snow banks (or the verge) facing the road, never
 * inside a town's buildings nor where another stretch of road passes close.
 */
export function scatterSpectators(
  field: TerrainField,
  perHundred: number,
  berms = false,
): { people: Prop[]; mounds: TerrainMound[] } {
  const stage = field.stage;
  const rand = mulberry32(hashSeed(stage.seed, 'spectators'));
  const path = stage.path;
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const hit = createRoadHit();
  const banks = REGIONS[stage.region].terrain.banks;
  const verge = stage.halfWidth + 0.6 + (banks ? banks.width : 2);
  const back = verge + BACK;
  const out: Prop[] = [];
  const mounds: TerrainMound[] = [];
  const hw = stage.halfWidth;
  // Berms where the stage has them, but not along a village's pavements.
  const bermAt = (d: number) => berms && (!stage.town || townFade(stage.town, d) <= 0);
  const spine = hw + BERM_FROM + BERM_DEPTH / 2;
  const at = (d: number, side: 1 | -1, off: number): [number, number] => {
    path.sample(d, sample);
    return [
      sample.x + Math.cos(sample.heading) * off * side,
      sample.z - Math.sin(sample.heading) * off * side,
    ];
  };
  /** A berm along the road from `d0` to `d1` on `side`, unless another stretch of road runs under it. */
  const berm = (d0: number, d1: number, side: 1 | -1): void => {
    const [x0, z0] = at(d0, side, spine);
    const [x1, z1] = at(d1, side, spine);
    for (const [x, z, d] of [
      [x0, z0, d0],
      [x1, z1, d1],
    ] as const) {
      if (path.nearest(x, z, spine + BERM_DEPTH, hit) && Math.abs(hit.along - d) > BERM_RUN * 2)
        return;
      if (stage.town && townBlocks(stage.town, x, z)) return;
    }
    mounds.push({ x0, z0, x1, z1, radius: BERM_DEPTH / 2, height: BERM_HEIGHT });
  };

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
      if (c.berm)
        for (let a = c.from; a < c.to; a += BERM_RUN)
          if (bermAt(a)) berm(a, Math.min(a + BERM_RUN, c.to), side);
      for (let d = c.from + rand() * step * 0.5; d < c.to; d += step * (0.8 + 0.4 * rand())) {
        if (c.gap !== undefined && Math.abs(d - c.gap) < GATE_GAP) continue;
        const front = c.berm && bermAt(d) ? hw + BERM_BACK : back;
        stand(d, side, front + rand() * 0.5, deal());
        if (rand() < c.rows)
          stand(d + step * (rand() - 0.5), side, front + ROW_GAP + rand() * 0.5, deal());
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
    // Behind a berm of their own where the stage has them, a metre past either end of the group.
    const behind = bermAt(d);
    const half = ((n - 1) / 2) * 0.9;
    if (behind) berm(d - half - 1, d + half + 1, side);
    // Along the road a stride apart, a little in and out of line.
    for (let i = 0; i < n; i++)
      stand(
        d + (i - (n - 1) / 2) * 0.9 + (rand() - 0.5) * 0.3,
        side,
        behind ? hw + BERM_BACK + rand() * 0.6 : back + rand() * 1.4,
        jackets[i]! + SPECTATOR_JACKETS * poses[i]!,
      );
  }
  return { people: out, mounds };
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
