import { describe, expect, it } from 'vitest';
import {
  nextPaceNote,
  paceNotesFor,
  PACE_GRADES,
  severity,
  stagePaceNotes,
} from '@/game/stage/PaceNotes';
import { RoadPath } from '@/game/stage/RoadPath';
import { generateStage } from '@/game/stage/StageGenerator';

const SPACING = 2;
const deg = (d: number) => (d * Math.PI) / 180;

/** A road from bends: [radius (m), turn (deg, + = left)] pieces, or a straight of `radius` metres when turn is 0. */
function road(pieces: readonly (readonly [number, number])[], closed = false): RoadPath {
  const xs = [0];
  const zs = [0];
  let h = 0;
  for (const [r, turn] of pieces) {
    const length = turn === 0 ? r : ((Math.abs(deg(turn)) * r) as number);
    const steps = Math.max(1, Math.round(length / SPACING));
    const k = turn === 0 ? 0 : Math.sign(turn) / r;
    for (let i = 0; i < steps; i++) {
      h += k * SPACING;
      xs.push(xs[xs.length - 1]! + Math.sin(h) * SPACING);
      zs.push(zs[zs.length - 1]! + Math.cos(h) * SPACING);
    }
  }
  return new RoadPath(Float64Array.from(xs), Float64Array.from(zs), SPACING, closed);
}
const corner = (radius: number, turn: number) =>
  paceNotesFor(
    road([
      [80, 0],
      [radius, turn],
      [80, 0],
    ]),
  );

describe('pace notes', () => {
  it('call nothing on a straight or a sweep too open to grade', () => {
    expect(paceNotesFor(road([[300, 0]]))).toEqual([]);
    expect(corner(200, 40)).toEqual([]);
    expect(corner(60, 8)).toEqual([]);
  });

  it('grade a corner by its tightest radius, 1 tightest to 6 barely a bend, on the right side', () => {
    expect(corner(100, 45).map((n) => [n.side, n.grade])).toEqual([['left', 6]]);
    expect(corner(60, 60).map((n) => [n.side, n.grade])).toEqual([['left', 5]]);
    expect(corner(40, -70).map((n) => [n.side, n.grade])).toEqual([['right', 4]]);
    expect(corner(25, -60).map((n) => [n.side, n.grade])).toEqual([['right', 3]]);
    expect(corner(17, 60).map((n) => [n.side, n.grade])).toEqual([['left', 2]]);
    expect(corner(11, -65).map((n) => [n.side, n.grade])).toEqual([['right', 1]]);
  });

  it('name the corners too sharp for the scale', () => {
    expect(corner(8, 90)[0]!.grade).toBe('square');
    expect(corner(12, -130)[0]!.grade).toBe('acute');
    expect(corner(14, 180)[0]!.grade).toBe('hairpin');
    // An open hairpin, a switchback on a wider arc, is still a hairpin.
    expect(corner(22, -175)[0]!.grade).toBe('hairpin');
  });

  it('call a corner long when it turns far more than its grade suggests', () => {
    const [n] = corner(40, 130);
    expect(n!.grade).toBe(4);
    expect(n!.long).toBe(true);
    expect(corner(40, 70)[0]!.long).toBe(false);
  });

  it('link corners with no road between: into a tighter one, and otherwise', () => {
    const notes = paceNotesFor(
      road([
        [60, 0],
        [40, 60],
        [17, -70],
        [4, 0],
        [40, 60],
        [200, 0],
        [40, -60],
      ]),
    );
    expect(notes.map((n) => [n.side, n.grade, n.link])).toEqual([
      ['left', 4, 'into'],
      ['right', 2, 'and'],
      ['left', 4, null],
      ['right', 4, null],
    ]);
  });

  it('show the next corner ahead, hold it through the corner, then move on', () => {
    const notes = corner(40, 70).concat(
      paceNotesFor(
        road([
          [300, 0],
          [40, -70],
          [80, 0],
        ]),
      ).map((n) => n),
    );
    const [a] = notes;
    expect(nextPaceNote(notes, 0)).toEqual({ index: 0, distance: a!.start });
    expect(nextPaceNote(notes, (a!.start + a!.end) / 2)).toEqual({ index: 0, distance: 0 });
    expect(nextPaceNote(notes, a!.end + 1)!.index).toBe(1);
    expect(nextPaceNote(notes, 10_000)).toBeNull();
    expect(nextPaceNote([], 0)).toBeNull();
  });

  it('repeat every lap on a circuit, the first corner coming round after the last', () => {
    const notes = corner(40, 70);
    const lap = 400;
    const n = notes[0]!;
    expect(nextPaceNote(notes, lap * 2 + 10, lap)).toEqual({ index: 0, distance: n.start - 10 });
    expect(nextPaceNote(notes, lap + n.end + 5, lap)).toEqual({
      index: 0,
      distance: n.start + lap - (n.end + 5),
    });
  });

  it('read every generated stage into ordered calls covering every grade between them', () => {
    expect(severity('acute')).toBe(0);
    expect(severity(6)).toBe(PACE_GRADES.length - 1);
    const seen = new Set<string>();
    for (const seed of [1, 2]) {
      for (let index = 0; index < 18; index++) {
        const stage = generateStage(seed, index);
        const notes = stagePaceNotes(stage);
        expect(notes.length, `${seed}/${index}`).toBeGreaterThan(stage.circuit ? 3 : 10);
        for (let i = 1; i < notes.length; i++)
          expect(notes[i]!.start).toBeGreaterThanOrEqual(notes[i - 1]!.end);
        for (const n of notes) seen.add(String(n.grade));
      }
    }
    for (const g of [1, 2, 3, 4, 5, 6, 'square', 'hairpin', 'acute'])
      expect(seen).toContain(String(g));
    // 36 stages, cities among them: about a second here, several on a CI runner.
  }, 30_000);
});
