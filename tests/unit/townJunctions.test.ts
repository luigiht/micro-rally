import { describe, expect, it } from 'vitest';
import { FILLET, FRONT_SETBACK, JUNCTION_REACH, type Junction } from '@/game/stage/Town';
import { alongArm, sortedArms, stubCut, wedges } from '@/game/stage/TownJunctions';
import { apart, polylineFacade } from '@/game/stage/TownTerraces';

const crossroads: Junction = {
  x: 10,
  z: -5,
  arms: [
    { heading: Math.PI, halfWidth: 4.5, role: 'in' },
    { heading: 0, halfWidth: 4.5, role: 'out' },
    { heading: Math.PI / 2, halfWidth: 4.5, role: 'blocked' },
    { heading: -Math.PI / 2, halfWidth: 4.5, role: 'blocked' },
  ],
};

/** A left turn of `turn` radians: back arm, exit arm, straight-on and across blocked. */
const corner = (turn: number): Junction => ({
  x: 0,
  z: 0,
  arms: [
    { heading: Math.PI, halfWidth: 4.5, role: 'in' },
    { heading: turn, halfWidth: 4.5, role: 'out' },
    { heading: 0, halfWidth: 4, role: 'blocked' },
    { heading: turn + Math.PI, halfWidth: 4, role: 'blocked' },
  ],
});

describe('junction geometry', () => {
  it('sorts the arms by heading and bounds a wedge between each pair, all the way round', () => {
    for (const j of [crossroads, corner(Math.PI / 2), corner(Math.PI / 4), corner(-1.9)]) {
      const arms = sortedArms(j);
      expect(arms).toHaveLength(4);
      const ws = wedges(j);
      expect(ws).toHaveLength(4);
      expect(ws.reduce((sum, w) => sum + w.angle, 0)).toBeCloseTo(Math.PI * 2, 9);
      for (const w of ws) expect(w.angle).toBeGreaterThan(0.7);
    }
  });

  it('puts the facade corner of a square wedge a pavement beyond both carriageway edges', () => {
    const w = wedges(crossroads).find((w) => w.a.role === 'out' && w.b.role === 'blocked')!;
    // Left of the forward arm (+x) and right of the stub heading +x... the wedge ahead-left.
    expect(alongArm(crossroads, w.a, w.kx, w.kz)).toBeCloseTo(4.5 + FRONT_SETBACK, 9);
    expect(alongArm(crossroads, w.b, w.kx, w.kz)).toBeCloseTo(4.5 + FRONT_SETBACK, 9);
    expect(alongArm(crossroads, w.a, w.px, w.pz)).toBeCloseTo(4.5, 9);
  });

  it('cuts a blocked arm past its kerb returns, further the more acutely it meets the route', () => {
    const square = stubCut(crossroads, crossroads.arms[2]!, 4.5);
    expect(square).toBeCloseTo(4.5 + JUNCTION_REACH, 9);
    expect(square).toBeGreaterThan(4.5 + FILLET + 1);
    const sharp = corner(Math.PI / 4);
    const acute = stubCut(sharp, sharp.arms[2]!, 4.5);
    expect(acute).toBeGreaterThan(square);
    expect(acute).toBeLessThan(22);
  });
});

describe('facades', () => {
  it('stands houses on a straight facade with their corners on the line and the door toward the street', () => {
    const f = polylineFacade(
      [
        { x: 0, z: 0 },
        { x: 0, z: 40 },
      ],
      1,
    );
    expect(f.length).toBeCloseTo(40, 9);
    const h = f.house(10, 4, 3.5)!;
    expect(h.end).toBeCloseTo(18, 9);
    // Left of travel (+z) is +x: the house stands 3.5 m into +x, facing -x.
    expect(h.x).toBeCloseTo(3.5, 9);
    expect(h.z).toBeCloseTo(14, 9);
    expect(Math.sin(h.yaw)).toBeCloseTo(1, 9);
    expect(f.cross({ x: -3, z: 20 }, Math.PI / 2, 2)!.s).toBeCloseTo(18, 9);
  });

  it('refuses a front that would bulge over the pavement on a tight outer bend, allows it on the inside', () => {
    const arc = (r: number) =>
      Array.from({ length: 21 }, (_, i) => {
        const a = (i / 20) * (Math.PI / 2);
        return { x: r * Math.sin(a), z: r * (1 - Math.cos(a)) };
      });
    // Houses on the right of a left-bending arc stand outside it: the chord sags toward the road.
    expect(polylineFacade(arc(6), -1).house(0.5, 5, 4)).toBeNull();
    expect(polylineFacade(arc(30), -1).house(0.5, 5, 4)).not.toBeNull();
    // On the inside the front is recessed, which is allowed.
    expect(polylineFacade(arc(6), 1).house(0.5, 3, 3)).not.toBeNull();
  });

  it('separates footprints by a gap along some edge axis', () => {
    const a = { style: 'shop', x: 0, z: 0, yaw: 0, hx: 5, hz: 4, variant: 0 } as const;
    expect(apart(a, { ...a, x: 10.5 }, 0.4)).toBe(true);
    expect(apart(a, { ...a, x: 10.2 }, 0.4)).toBe(false);
    expect(apart(a, { ...a, x: 9, z: 9, yaw: 0.6 }, 0.4)).toBe(true);
  });
});
