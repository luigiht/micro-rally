import type { Gate } from './Checkpoints';

export const MARKER_SPACING = 20;
/** No marker post within this distance along the road of a checkpoint board. */
export const MARKER_CLEARANCE = 1.2;

/** A stretch of road [from, to] along which no posts stand (a town, where kerbs and buildings take over). */
export type MarkerSkip = readonly [number, number];

/** An open stage's start and finish controls: their stopwatch boards stand this far before the line. */
export const CONTROL_BOARD_LEAD = 1;

/** The stretch round a start or finish line's boards where no marker post stands, as at a checkpoint's boards. */
export function controlBoardSkip(lineDistance: number): MarkerSkip {
  const at = lineDistance - CONTROL_BOARD_LEAD;
  return [at - MARKER_CLEARANCE, at + MARKER_CLEARANCE];
}

/**
 * Distances along the road for the paired verge marker posts: one pair every
 * `MARKER_SPACING` metres, skipping any that would stand where a checkpoint's
 * time-control boards are, so the board is never pierced by a post, and any
 * inside a `skip` span.
 */
export function markerDistances(
  pathLength: number,
  gates: readonly Gate[],
  skip: readonly MarkerSkip[] = [],
): number[] {
  const boards = gates.filter((g) => g.kind === 'checkpoint').map((g) => g.distance);
  const out: number[] = [];
  for (let d = MARKER_SPACING / 2; d < pathLength; d += MARKER_SPACING) {
    if (boards.some((b) => Math.abs(b - d) < MARKER_CLEARANCE)) continue;
    if (skip.some(([a, b]) => d >= a && d <= b)) continue;
    out.push(d);
  }
  return out;
}
