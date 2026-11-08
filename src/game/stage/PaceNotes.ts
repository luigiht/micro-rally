import type { RoadPath } from './RoadPath';
import type { StageDef } from './StageGenerator';

/**
 * Rally pace notes read off the road's own geometry, as a co-driver's book
 * would grade it: each corner gets a side and a grade from its tightest
 * sustained radius and its total change of heading. On the numbered scale 1
 * is the tightest and 6 barely a bend; corners too sharp for the scale are
 * named instead: a square (a junction-like right angle), an acute (sharper
 * than square, the road folding back on a point) and a hairpin (the road
 * doubling back). A corner that holds its turn far longer than its grade
 * suggests is `long`, and corners with no road between them are linked:
 * `into` when the next is tighter, `and` when it is not.
 */
export type PaceGrade = 'acute' | 'hairpin' | 'square' | 1 | 2 | 3 | 4 | 5 | 6;
export type PaceSide = 'left' | 'right';
export type PaceLink = 'into' | 'and' | null;

export interface PaceNote {
  side: PaceSide;
  grade: PaceGrade;
  long: boolean;
  /** Road distances (path metres) where the corner starts and ends. */
  start: number;
  end: number;
  /** How the next corner follows on: null when there is road between them. */
  link: PaceLink;
}

/** Severity, tightest first: the grades in the order the icons run from red to green. */
export const PACE_GRADES: readonly PaceGrade[] = ['acute', 'hairpin', 'square', 1, 2, 3, 4, 5, 6];
export function severity(grade: PaceGrade): number {
  return PACE_GRADES.indexOf(grade);
}

/** Curvature is averaged over this much road, so a corner's radius is the one it holds, not a kink. */
const SMOOTH = 10;
/** Radii (metres) at or under which each numbered grade applies; wider than the last is no call. */
const GRADE_RADII: readonly [PaceGrade, number][] = [
  [1, 13],
  [2, 20],
  [3, 30],
  [4, 48],
  [5, 75],
  [6, 120],
];
const NO_CALL_RADIUS = 120;
/** A corner must turn at least this much (radians) in total to be called. */
const MIN_TURN = (14 * Math.PI) / 180;
/** Same-side stretches of road separated by less than this are one corner. */
const MERGE_GAP = 8;
/** Named corners: how far they turn and how tight they must be. */
const HAIRPIN_TURN = (150 * Math.PI) / 180;
const ACUTE_TURN = (115 * Math.PI) / 180;
const SQUARE_TURN = (70 * Math.PI) / 180;
/** Hairpins include the open ones, doubling back on a wider arc: the Alpine's and the coast's switchbacks. */
const HAIRPIN_RADIUS = 26;
const ACUTE_RADIUS = 16;
/** A square turns on the spot: tight and short, a right angle with no arc to carry speed. */
const SQUARE_RADIUS = 12;
const SQUARE_MAX_TURN = (110 * Math.PI) / 180;
/** A numbered corner turning more than this is called long. */
const LONG_TURN = (100 * Math.PI) / 180;
/** Corners closer than this are called together. */
const LINK_GAP = 20;

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Heading change per metre along each segment, smoothed over `SMOOTH` metres. */
function curvatures(path: RoadPath): Float64Array {
  const n = path.count - 1;
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++)
    raw[i] = wrapAngle(path.headings[i + 1]! - path.headings[i]!) / path.spacing;
  const half = Math.max(1, Math.round(SMOOTH / path.spacing / 2));
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      const k = path.closed ? (j + n) % n : j;
      if (k < 0 || k >= n) continue;
      sum += raw[k]!;
      count++;
    }
    out[i] = sum / count;
  }
  return out;
}

function grade(turn: number, radius: number): PaceGrade | null {
  if (turn >= HAIRPIN_TURN && radius <= HAIRPIN_RADIUS) return 'hairpin';
  if (turn >= ACUTE_TURN && radius <= ACUTE_RADIUS) return 'acute';
  if (turn >= SQUARE_TURN && turn < SQUARE_MAX_TURN && radius <= SQUARE_RADIUS) return 'square';
  if (radius > NO_CALL_RADIUS) return null;
  for (const [g, r] of GRADE_RADII) if (radius <= r) return g;
  return null;
}

interface Run {
  from: number;
  to: number;
  sign: number;
}

/**
 * The pace notes for a road path between `from` and `to` (path metres), in
 * road order. On a closed path (a circuit lap) the whole lap is read.
 */
export function paceNotesFor(path: RoadPath, from = 0, to = path.length): PaceNote[] {
  const k = curvatures(path);
  const sp = path.spacing;
  const threshold = 1 / NO_CALL_RADIUS;
  // Stretches curving one way tighter than the widest graded radius.
  const runs: Run[] = [];
  for (let i = 0; i < k.length; i++) {
    const sign = Math.abs(k[i]!) >= threshold ? Math.sign(k[i]!) : 0;
    const last = runs[runs.length - 1];
    if (sign === 0) continue;
    if (last && last.sign === sign && i - last.to <= MERGE_GAP / sp) last.to = i + 1;
    else runs.push({ from: i, to: i + 1, sign });
  }
  const notes: PaceNote[] = [];
  for (const r of runs) {
    let turn = 0;
    let tightest = 0;
    for (let i = r.from; i < r.to; i++) {
      turn += k[i]! * sp;
      tightest = Math.max(tightest, Math.abs(k[i]!));
    }
    turn = Math.abs(turn);
    if (turn < MIN_TURN) continue;
    const g = grade(turn, 1 / tightest);
    if (g === null) continue;
    const start = r.from * sp;
    const end = r.to * sp;
    if (end < from || start > to) continue;
    notes.push({
      // Heading grows toward the left of travel (see RoadPath: left = (cos h, −sin h)).
      side: r.sign > 0 ? 'left' : 'right',
      grade: g,
      long: typeof g === 'number' && turn >= LONG_TURN,
      start,
      end,
      link: null,
    });
  }
  for (let i = 0; i + 1 < notes.length; i++) {
    const a = notes[i]!;
    const b = notes[i + 1]!;
    if (b.start - a.end <= LINK_GAP)
      a.link = severity(b.grade) < severity(a.grade) ? 'into' : 'and';
  }
  return notes;
}

/** A stage's pace notes: from the start line to the finish, or round one lap of a circuit. */
export function stagePaceNotes(stage: StageDef): PaceNote[] {
  if (stage.circuit) return paceNotesFor(stage.path);
  const finish = stage.gates[stage.gates.length - 1]?.distance ?? stage.path.length;
  return paceNotesFor(stage.path, stage.startDistance - 20, finish);
}

/**
 * The note to show at road distance `along`: the first corner not yet driven
 * through, and how far off it starts (0 once inside it). On a circuit
 * (`lapLength` > 0) the notes repeat every lap. Null past the last corner.
 */
export function nextPaceNote(
  notes: readonly PaceNote[],
  along: number,
  lapLength = 0,
): { index: number; distance: number } | null {
  if (notes.length === 0) return null;
  if (lapLength > 0) {
    const lap = Math.floor(along / lapLength);
    const at = along - lap * lapLength;
    for (let i = 0; i < notes.length; i++)
      if (notes[i]!.end > at) return { index: i, distance: Math.max(0, notes[i]!.start - at) };
    // Past the lap's last corner: the first of the next lap.
    return { index: 0, distance: notes[0]!.start + lapLength - at };
  }
  for (let i = 0; i < notes.length; i++)
    if (notes[i]!.end > along) return { index: i, distance: Math.max(0, notes[i]!.start - along) };
  return null;
}
