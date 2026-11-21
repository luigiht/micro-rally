import type { StageDef } from './StageGenerator';

/**
 * The road's dips, for whatever lies in them: the Alpine's river crossings
 * (`Rivers`), the Moorland's watersplashes (`Watersplashes`). Read off the
 * finished road profile, so nothing laid in them moves the road. Pure TS.
 */

export interface RoadGround {
  stage: StageDef;
  roadHeightAt(along: number): number;
}

export interface LowPointRules {
  /** Keep this far from the start and the finish, from every checkpoint gate, and from a town. */
  ends: number;
  gateGap: number;
  townGap: number;
}

/** A low point is the lowest road within this much either way; its depth, how far it sits under the road this far either way. */
const LOW_WINDOW = 30;
const PROMINENCE_WINDOW = 150;
/** Fallback spots are tried every this many metres of road, ranked by how far each stands above the lowest road this far either way. */
const REST_STEP = 20;
const LIFT_WINDOW = 100;

/**
 * Candidate spots along the road: its dips by how deep they are (`dips`),
 * then every other allowed stretch from the lowest up (`rest`), as road
 * distances.
 */
export function roadLowPoints(
  ground: RoadGround,
  rules: LowPointRules,
): { dips: number[]; rest: number[] } {
  const stage = ground.stage;
  const sp = stage.path.spacing;
  const finish = stage.startDistance + stage.length;
  const keep = [stage.startDistance, ...stage.gates.map((g) => g.distance)];
  const town = stage.town;
  const allowed = (d: number) =>
    d > stage.startDistance + rules.ends &&
    d < finish - rules.ends &&
    keep.every((k) => Math.abs(k - d) > rules.gateGap) &&
    !(town && d > town.from - rules.townGap && d < town.to + rules.townGap);
  const n = Math.floor(stage.path.length / sp);
  const h = Array.from({ length: n }, (_, i) => ground.roadHeightAt(i * sp));
  const lows: { d: number; prominence: number }[] = [];
  const w = Math.round(LOW_WINDOW / sp);
  const pw = Math.round(PROMINENCE_WINDOW / sp);
  for (let i = w; i < n - w; i++) {
    const d = i * sp;
    if (!allowed(d)) continue;
    let low = true;
    for (let j = i - w; j <= i + w && low; j++) if (h[j]! < h[i]!) low = false;
    if (!low) continue;
    let left = h[i]!;
    let right = h[i]!;
    for (let j = Math.max(0, i - pw); j < i; j++) left = Math.max(left, h[j]!);
    for (let j = i + 1; j <= Math.min(n - 1, i + pw); j++) right = Math.max(right, h[j]!);
    lows.push({ d, prominence: Math.min(left, right) - h[i]! });
  }
  lows.sort((a, b) => b.prominence - a.prominence);
  // The rest by how far each stands above the lowest road near it: the nearest thing to a dip first.
  const lift = (d: number) => {
    let low = Infinity;
    for (let e = -LIFT_WINDOW; e <= LIFT_WINDOW; e += sp)
      low = Math.min(low, ground.roadHeightAt(d + e));
    return ground.roadHeightAt(d) - low;
  };
  const rest: { d: number; lift: number }[] = [];
  for (let d = stage.startDistance + rules.ends; d < finish - rules.ends; d += REST_STEP)
    if (allowed(d)) rest.push({ d, lift: lift(d) });
  rest.sort((a, b) => a.lift - b.lift);
  return { dips: lows.map((l) => l.d), rest: rest.map((r) => r.d) };
}
