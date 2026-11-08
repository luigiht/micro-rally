import type { PaceGrade, PaceSide } from '@/game/stage/PaceNotes';

/**
 * The pace-note cards as pixel art on a 20 × 20 grid: a two-pixel frame with
 * notched corners, a dim dot in each inner corner, a chunky arrow for the
 * corner and, on the numbered scale, a 3 × 5 digit in the bottom-left corner
 * over an outline. Every arrow stroke runs straight or at 45°, so it stays
 * crisp. Arrows are drawn for a left-hander; a right-hander mirrors them.
 */
export const CARD = 20;
export type Px = readonly [number, number];

type Dir = readonly [number, number];

/** Each grade's arrow as a polyline of grid points, every leg straight or diagonal; the head points along the last leg. */
const ARROWS: Record<string, readonly Px[]> = {
  '6': [
    [10, 15],
    [10, 9],
    [9, 8],
    [9, 4],
  ],
  '5': [
    [11, 15],
    [11, 10],
    [8, 7],
    [8, 4],
  ],
  '4': [
    [12, 15],
    [12, 10],
    [6, 4],
  ],
  '3': [
    [13, 15],
    [13, 11],
    [8, 6],
    [5, 6],
  ],
  '2': [
    [12, 15],
    [12, 9],
    [10, 7],
    [5, 7],
  ],
  '1': [
    [12, 15],
    [12, 9],
    [10, 7],
    [7, 7],
    [4, 10],
  ],
  square: [
    [12, 15],
    [12, 7],
    [5, 7],
  ],
  hairpin: [
    [14, 15],
    [14, 8],
    [12, 6],
    [8, 6],
    [6, 8],
    [6, 14],
  ],
  acute: [
    [14, 15],
    [14, 5],
    [5, 14],
  ],
};

/** 3 × 5 digits for the numbered grades. */
const DIGITS: Record<string, readonly string[]> = {
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
};
const DIGIT_AT: Px = [1, 14];
const WING = 3;

function key(x: number, y: number): number {
  return y * CARD + x;
}

/** The ring of the frame: two pixels deep, its corners notched. */
function framePixels(): Px[] {
  const out: Px[] = [];
  for (let y = 0; y < CARD; y++)
    for (let x = 0; x < CARD; x++) {
      const edge = Math.min(x, y, CARD - 1 - x, CARD - 1 - y);
      const corner = Math.min(x, CARD - 1 - x) + Math.min(y, CARD - 1 - y);
      if (edge < 2 && corner >= 1 && !(edge === 0 && corner < 2)) out.push([x, y]);
    }
  return out;
}

const DOTS: readonly Px[] = [
  [3, 3],
  [CARD - 4, 3],
  [3, CARD - 4],
  [CARD - 4, CARD - 4],
];

/** The arrow's pixels: each leg stamped with a 2 × 2 brush, then the head's two wings swept back from the tip. */
function arrowPixels(points: readonly Px[]): Px[] {
  const set = new Set<number>();
  const stamp = (x: number, y: number) => {
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const)
      set.add(key(x + dx, y + dy));
  };
  const line = (from: Px, dir: Dir, steps: number) => {
    for (let i = 0; i <= steps; i++) stamp(from[0] + dir[0] * i, from[1] + dir[1] * i);
  };
  let last: Dir = [0, -1];
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = points[i]!;
    const [bx, by] = points[i + 1]!;
    const dx = bx - ax;
    const dy = by - ay;
    if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy))
      throw new Error('pace-note arrow legs must be straight or diagonal');
    last = [Math.sign(dx), Math.sign(dy)];
    line([ax, ay], last, Math.max(Math.abs(dx), Math.abs(dy)));
  }
  // The wings point back from the tip at 45° either side: the reverse direction turned ±45°.
  const [rx, ry] = [-last[0], -last[1]];
  const tip = points[points.length - 1]!;
  line(tip, [Math.sign(rx - ry), Math.sign(rx + ry)], WING);
  line(tip, [Math.sign(rx + ry), Math.sign(ry - rx)], WING);
  return [...set].map((k) => [k % CARD, Math.floor(k / CARD)] as const);
}

function digitPixels(grade: PaceGrade): { digit: Px[]; outline: Px[] } {
  const rows = DIGITS[String(grade)];
  if (!rows) return { digit: [], outline: [] };
  const digit: Px[] = [];
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '#') digit.push([DIGIT_AT[0] + x, DIGIT_AT[1] + y]);
    }),
  );
  const inDigit = new Set(digit.map(([x, y]) => key(x, y)));
  const outline = new Map<number, Px>();
  for (const [x, y] of digit)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const ox = x + dx;
        const oy = y + dy;
        if (ox < 0 || oy < 0 || ox >= CARD || oy >= CARD || inDigit.has(key(ox, oy))) continue;
        outline.set(key(ox, oy), [ox, oy]);
      }
  return { digit, outline: [...outline.values()] };
}

export interface CardPixels {
  frame: readonly Px[];
  dots: readonly Px[];
  arrow: readonly Px[];
  digit: readonly Px[];
  outline: readonly Px[];
}

const FRAME = framePixels();
const cache = new Map<string, CardPixels>();

/** Every pixel of one card, by layer; a right-hander's arrow is the left-hander's mirrored. */
export function paceNotePixels(grade: PaceGrade, side: PaceSide): CardPixels {
  const id = `${grade}:${side}`;
  let card = cache.get(id);
  if (!card) {
    const left = arrowPixels(ARROWS[String(grade)]!);
    const arrow = side === 'left' ? left : left.map(([x, y]) => [CARD - 1 - x, y] as const);
    card = { frame: FRAME, dots: DOTS, arrow, ...digitPixels(grade) };
    cache.set(id, card);
  }
  return card;
}

/** Pixels as one SVG path of unit squares, horizontal runs merged, for crisp rendering at any size. */
export function pixelPath(pixels: readonly Px[]): string {
  const rows = new Map<number, number[]>();
  for (const [x, y] of pixels) {
    const row = rows.get(y);
    if (row) row.push(x);
    else rows.set(y, [x]);
  }
  let d = '';
  for (const [y, xs] of rows) {
    xs.sort((a, b) => a - b);
    for (let i = 0; i < xs.length;) {
      let j = i;
      while (j + 1 < xs.length && xs[j + 1] === xs[j]! + 1) j++;
      d += `M${xs[i]} ${y}h${xs[j]! - xs[i]! + 1}v1h${-(xs[j]! - xs[i]! + 1)}z`;
      i = j + 1;
    }
  }
  return d;
}
