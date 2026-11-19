import { hashSeed, mulberry32 } from '../rng';
import type { Surface } from '../vehicle/surfaces';
import { START_DISTANCE } from './Centreline';

/**
 * A road that changes surface along its length (the Lakeland's): stretches
 * of the stage type's own surface alternating with another (worn tarmac and
 * a mud lane). Drawn from the stage seed on a stream of their own, so the
 * brief and the walk keep theirs, and from the stage length alone, so a list
 * can price the par without building the road. Pure TS.
 */

export interface SurfaceSpanStyle {
  /** The surface that alternates with the stage type's own. */
  alt: Surface;
  /** Metres each stretch of the own surface runs, shortest and longest. */
  main: readonly [number, number];
  /** Metres each stretch of `alt` runs, shortest and longest. */
  other: readonly [number, number];
}

/** One stretch of road on one surface, in road distances (the path's own, from its first sample). */
export interface SurfaceSpan {
  from: number;
  to: number;
  surface: Surface;
}

/** A stretch left shorter than this by a run laid over it takes the run's surface. */
const MIN_STRETCH = 80;

/** An `alt` stretch never starts this close to the finish: the run-in is the own surface. */
const FINISH_CLEAR = 150;

/**
 * The stretches from the start of the path to past its end: the own surface
 * first (through the start line and its first stretch), then alternating,
 * the last stretch the own surface on to Infinity.
 */
export function planSurfaceSpans(
  seed: number,
  length: number,
  own: Surface,
  style: SurfaceSpanStyle,
): SurfaceSpan[] {
  const rand = mulberry32(hashSeed(seed, 'surfaces'));
  const between = (r: readonly [number, number]) => r[0] + rand() * (r[1] - r[0]);
  const finish = START_DISTANCE + length;
  const spans: SurfaceSpan[] = [];
  let at = START_DISTANCE + between(style.main);
  spans.push({ from: 0, to: at, surface: own });
  while (at < finish - FINISH_CLEAR) {
    const to = Math.min(at + between(style.other), finish - FINISH_CLEAR / 2);
    spans.push({ from: at, to, surface: style.alt });
    const next = to + between(style.main);
    spans.push({ from: to, to: next, surface: own });
    at = next;
  }
  spans[spans.length - 1]!.to = Infinity;
  return spans;
}

/** The surface of the stretch at road distance `along` (the last stretch's past the end). */
export function surfaceAlong(spans: readonly SurfaceSpan[], along: number): Surface {
  // A handful of stretches a stage: a scan is as quick as a search.
  for (const s of spans) if (along < s.to) return s.surface;
  return spans[spans.length - 1]!.surface;
}

/** `spans` with each tarmac run laid over them (bridges): the road under a run is `surface` whatever it was. */
export function overlaySpans(
  spans: readonly SurfaceSpan[],
  runs: readonly { from: number; to: number }[],
  surface: Surface,
): SurfaceSpan[] {
  let out = spans.map((s) => ({ ...s }));
  for (const run of runs) {
    const next: SurfaceSpan[] = [];
    for (const s of out) {
      if (s.to <= run.from || s.from >= run.to) {
        next.push(s);
        continue;
      }
      if (s.from < run.from) next.push({ from: s.from, to: run.from, surface: s.surface });
      next.push({ from: Math.max(s.from, run.from), to: Math.min(s.to, run.to), surface });
      if (s.to > run.to) next.push({ from: run.to, to: s.to, surface: s.surface });
    }
    out = next;
  }
  // A stub of another surface left beside a run (a few metres of mud past a bridge) goes over to
  // the run's surface too, so no stretch is too short to read as one.
  if (runs.length > 0)
    for (const s of out)
      if (s.surface !== surface && s.to - s.from < MIN_STRETCH) s.surface = surface;
  // Neighbours on the same surface merge into one stretch.
  const merged: SurfaceSpan[] = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && last.surface === s.surface && Math.abs(last.to - s.from) < 1e-9) last.to = s.to;
    else merged.push(s);
  }
  return merged;
}
