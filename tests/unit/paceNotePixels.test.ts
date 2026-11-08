import { describe, expect, it } from 'vitest';
import { CARD, paceNotePixels, pixelPath } from '@/components/hud/paceNotePixels';
import { PACE_GRADES } from '@/game/stage/PaceNotes';

describe('pace-note pixel cards', () => {
  it('draw every grade inside the frame, a right-hander the left-hander mirrored, numbers only on the scale', () => {
    for (const grade of PACE_GRADES) {
      const left = paceNotePixels(grade, 'left');
      const right = paceNotePixels(grade, 'right');
      expect(left.arrow.length).toBeGreaterThan(20);
      for (const [x, y] of left.arrow) {
        // Inside the frame's two-pixel ring.
        expect(x).toBeGreaterThanOrEqual(2);
        expect(y).toBeGreaterThanOrEqual(2);
        expect(x).toBeLessThan(CARD - 2);
        expect(y).toBeLessThan(CARD - 2);
      }
      const mirrored = new Set(left.arrow.map(([x, y]) => `${CARD - 1 - x},${y}`));
      expect(new Set(right.arrow.map(([x, y]) => `${x},${y}`))).toEqual(mirrored);
      expect(left.digit.length > 0).toBe(typeof grade === 'number');
    }
  });

  it('notch the frame corners and merge pixel runs into one path', () => {
    const { frame } = paceNotePixels(3, 'left');
    const at = new Set(frame.map(([x, y]) => `${x},${y}`));
    expect(at.has('0,0')).toBe(false);
    expect(at.has('1,1')).toBe(true);
    expect(at.has('10,0')).toBe(true);
    expect(
      pixelPath([
        [0, 0],
        [1, 0],
        [2, 0],
        [5, 0],
      ]),
    ).toBe('M0 0h3v1h-3zM5 0h1v1h-1z');
  });
});
