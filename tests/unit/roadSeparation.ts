import type { StageDef } from '@/game/stage/StageGenerator';

/** Two road samples within the same hairpin stack's span (`Lacets`), give or take this, are its stacked legs. */
const STACK_MARGIN = 20;

/**
 * The nearest two samples at least 200 m apart along the road come to each
 * other: on the open road, and between the stacked legs of a hairpin stack
 * (where they stand two hairpin radii apart by design), with the stacks'
 * tightest share of two radii.
 */
export function roadSeparation(stage: StageDef): { open: number; stacked: number; share: number } {
  const p = stage.path;
  const spans = (stage.lacets ?? []).map((l) => ({
    from: l.from - STACK_MARGIN,
    to: l.to + STACK_MARGIN,
    radius: l.radius,
  }));
  let open = Infinity;
  let stacked = Infinity;
  let share = Infinity;
  for (let i = 0; i < p.count; i += 4)
    for (let j = i + 100; j < p.count; j += 4) {
      const d = Math.hypot(p.xs[i]! - p.xs[j]!, p.zs[i]! - p.zs[j]!);
      const a = i * p.spacing;
      const b = j * p.spacing;
      const stack = spans.find((s) => a >= s.from && a <= s.to && b >= s.from && b <= s.to);
      if (!stack) open = Math.min(open, d);
      else {
        stacked = Math.min(stacked, d);
        share = Math.min(share, d / (2 * stack.radius));
      }
    }
  return { open, stacked, share };
}
