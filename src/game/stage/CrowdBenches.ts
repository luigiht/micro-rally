import { crowdSpans } from './CrowdSpans';
import type { RoadSample } from './RoadPath';
import type { StageDef } from './StageGenerator';
import { plateauDistance } from './Town';

/**
 * Crowd benches: where the crowds gather (the start, every checkpoint and
 * jump, the finish: `crowdSpans`), a stage type with `terrain.benches`
 * levels the ground either side of the road into a bench at the gravel
 * shoulder's height. It is level across and climbs with the road along it,
 * so the crowd stands on the flat behind its berm with a clear view of the
 * cars, however steep the hillside. The hill is cut back behind a bench or
 * built out under it, easing back into the ground over `BENCH_BLEND`. A
 * side where another stretch of road (a hairpin's other leg) or a village
 * comes near is left as it is. Pure TS.
 */

export interface Bench {
  /** Road distances the bench runs between, before its ends ease out. */
  from: number;
  to: number;
  /** Which sides are levelled (left of travel is positive lateral). */
  left: boolean;
  right: boolean;
}

/** The bench runs from this far past the carriageway's edge (just past the verge strip) to this far, flat. */
export const BENCH_IN = 3.6;
export const BENCH_OUT = 14;
/** Over this much it rises from the verge strip's edge, and eases back into the hill beyond its outer edge. */
const BENCH_IN_RAMP = 0.5;
const BENCH_BLEND = 4;
/** It runs this much past either end of the crowd, then eases out along the road over this much. */
const BENCH_MARGIN = 4;
const END_RAMP = 8;
/**
 * A side is left as it is where another stretch of road comes within its own
 * corridor (half width, flat margin and blend: `corridor` past its edge) and
 * this margin of the bench.
 */
const OTHER_ROAD = 2;
/** And this far outside a village's footprint. */
const TOWN_GAP = 5;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** The benches for a stage's crowds, given the crests the road bed raised. */
export function planBenches(
  stage: StageDef,
  crestsAt: readonly number[],
  corridor: number,
): Bench[] {
  const path = stage.path;
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const reach = stage.halfWidth + BENCH_OUT + BENCH_BLEND;
  // Clear when no other stretch of road (nor this one, doubling back round a tight bend) comes
  // within its corridor of the bench's middle or its outer foot, and no village either.
  const clear = (from: number, to: number, side: 1 | -1): boolean => {
    for (let d = from; d <= to + 1e-6; d += Math.max(1, (to - from) / 4)) {
      path.sample(d, sample);
      for (const out of [stage.halfWidth + (BENCH_IN + BENCH_OUT) / 2, reach]) {
        const x = sample.x + Math.cos(sample.heading) * out * side;
        const z = sample.z - Math.sin(sample.heading) * out * side;
        let other = false;
        path.visitNear(x, z, stage.halfWidth + corridor + OTHER_ROAD, (along, distance) => {
          if (Math.abs(along - d) > reach * 2 || distance < out - 1) other = true;
        });
        if (other) return false;
        // A village keeps its own ground (its terraces would win anyway).
        if (stage.town && plateauDistance(stage.town, x, z) < TOWN_GAP) return false;
      }
    }
    return true;
  };
  return crowdSpans(stage, crestsAt, false).map((c) => {
    const from = Math.max(0, c.from - BENCH_MARGIN);
    const to = Math.min(path.length, c.to + BENCH_MARGIN);
    return { from, to, left: clear(from, to, 1), right: clear(from, to, -1) };
  });
}

/**
 * How fully the ground at `along` and `lateral` (from the road's centre
 * line, where the carriageway is `hw` either side) lies on a bench, 0..1.
 */
export function benchWeight(
  benches: readonly Bench[],
  along: number,
  lateral: number,
  hw: number,
): number {
  const beyond = Math.abs(lateral) - hw;
  if (beyond <= BENCH_IN - BENCH_IN_RAMP || beyond >= BENCH_OUT + BENCH_BLEND) return 0;
  let w = 0;
  for (const b of benches) {
    if (along <= b.from - END_RAMP || along >= b.to + END_RAMP) continue;
    if (lateral > 0 ? !b.left : !b.right) continue;
    w = Math.max(
      w,
      smoothstep(b.from - END_RAMP, b.from, along) * (1 - smoothstep(b.to, b.to + END_RAMP, along)),
    );
  }
  if (w === 0) return 0;
  return (
    w *
    smoothstep(BENCH_IN - BENCH_IN_RAMP, BENCH_IN, beyond) *
    (1 - smoothstep(BENCH_OUT, BENCH_OUT + BENCH_BLEND, beyond))
  );
}
