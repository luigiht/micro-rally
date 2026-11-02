import { describe, expect, it } from 'vitest';
import { createRoadHit } from '@/game/stage/RoadPath';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { generateStage, type StageDef } from '@/game/stage/StageGenerator';
import { FILLET, type Arm, type Junction } from '@/game/stage/Town';
import { junctionKerbs, routeEdge, routeOpenings } from '@/game/stage/TownKerbs';

const stages: StageDef[] = [generateStage(6, 2), generateStage(3, 5), generateStage(8, 2)];

/** Signed position of (x, z) along an arm and across it (left positive). */
function armFrame(j: Junction, a: Arm, x: number, z: number) {
  const dx = x - j.x;
  const dz = z - j.z;
  return {
    along: dx * Math.sin(a.heading) + dz * Math.cos(a.heading),
    across: dx * Math.cos(a.heading) - dz * Math.sin(a.heading),
  };
}

describe('junction kerbs', () => {
  it('runs every kerb unbroken, with unit normals, never inside a carriageway', () => {
    const hit = createRoadHit();
    for (const stage of stages) {
      const town = stage.town!;
      expect(town.junctions.length).toBeGreaterThan(2);
      for (const j of town.junctions) {
        const { outlines } = junctionKerbs(j, stage, stage.halfWidth);
        // Three wedges touch a blocked arm at a corner, four at a crossroads.
        expect([3, 4]).toContain(outlines.length);
        for (const o of outlines) {
          expect(o.points.length).toBeGreaterThan(6);
          o.points.forEach((p, i) => {
            expect(Math.hypot(p.nx, p.nz)).toBeCloseTo(1, 6);
            if (i > 0) {
              const q = o.points[i - 1]!;
              expect(Math.hypot(p.x - q.x, p.z - q.z), `${stage.seed}`).toBeLessThan(2.1);
            }
            if (stage.path.nearest(p.x, p.z, 20, hit))
              expect(hit.distance, `${stage.seed} route`).toBeGreaterThan(
                halfWidthAt(stage, hit.along) - 0.06,
              );
            for (const a of j.arms) {
              if (a.role !== 'blocked') continue;
              const f = armFrame(j, a, p.x, p.z);
              if (f.along > 0.05) expect(Math.abs(f.across)).toBeGreaterThan(a.halfWidth - 0.06);
            }
          });
        }
      }
    }
  });

  it('hands the ribbon over at opening ends that lie on a kerb outline, a kerb return wide of each mouth', () => {
    for (const stage of stages) {
      const town = stage.town!;
      for (const j of town.junctions) {
        const { outlines, openings } = junctionKerbs(j, stage, stage.halfWidth);
        const stubs = j.arms.filter((a) => a.role === 'blocked');
        for (const side of [1, -1] as const) {
          for (const o of side === 1 ? openings.left : openings.right) {
            // At least a kerb return each side of the narrowest mouth.
            expect(o.to - o.from).toBeGreaterThan(stubs[0]!.halfWidth + 2 * FILLET);
            for (const d of [o.from, o.to]) {
              const e = routeEdge(stage, d, side, 0);
              const near = outlines.some((k) =>
                k.points.some((p) => Math.hypot(p.x - e.x, p.z - e.z) < 0.05),
              );
              expect(near, `${stage.seed} opening end at ${d.toFixed(1)}`).toBe(true);
            }
          }
        }
      }
      const all = routeOpenings(town, stage);
      for (const list of [all.left, all.right])
        for (let i = 1; i < list.length; i++)
          expect(list[i]!.from).toBeGreaterThan(list[i - 1]!.to);
    }
  });

  it('paves exactly up to every kerb: the surface is tarmac just inside each kerb point and ground just outside', () => {
    for (const stage of stages) {
      for (const j of stage.town!.junctions) {
        const { outlines, surface } = junctionKerbs(j, stage, stage.halfWidth);
        const hit = createRoadHit();
        for (const o of outlines)
          for (const p of o.points.slice(1, -1)) {
            // Points on the route's own edge are the ribbon's business; the rest are the surface's.
            // (An outline's ends sit on a side street's cut or the ribbon's edge, where others take over.)
            const inside = { x: p.x - p.nx * 0.3, z: p.z - p.nz * 0.3 };
            const onRoute =
              stage.path.nearest(inside.x, inside.z, 20, hit) &&
              hit.distance < halfWidthAt(stage, hit.along) + 0.05;
            if (!onRoute)
              expect(surface.distance(inside.x, inside.z), `${stage.seed}`).toBeLessThan(-0.1);
            expect(
              surface.distance(p.x + p.nx * 0.3, p.z + p.nz * 0.3),
              `${stage.seed}`,
            ).toBeGreaterThan(0.1);
          }
      }
    }
  });

  it('samples the route edge the way the ribbon does: vertex headings at samples', () => {
    const stage = stages[0]!;
    const p = stage.path;
    const i = Math.round((stage.town!.from + 20) / p.spacing);
    const e = routeEdge(stage, i * p.spacing, 1, 0);
    const hw = halfWidthAt(stage, i * p.spacing);
    expect(e.x).toBeCloseTo(p.xs[i]! + Math.cos(p.headings[i]!) * hw, 9);
    expect(e.z).toBeCloseTo(p.zs[i]! - Math.sin(p.headings[i]!) * hw, 9);
  });
});
