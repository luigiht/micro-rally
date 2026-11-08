import { describe, expect, it } from 'vitest';
import { scatterScenery, type Prop } from '@/game/stage/SceneryScatter';
import { SPECTATOR_JACKETS, SPECTATOR_POSES } from '@/game/stage/Spectators';
import { REGIONS, spectatorOutfit } from '@/game/stage/regions';
import { createRoadHit } from '@/game/stage/RoadPath';
import { createStageWorld } from '@/game/stage/StageWorld';
import { stageIndexOf } from './stageIndex';
import { rallyKits } from '@/render/scenery/kits/RallyKits';
import {
  SPECTATOR_POSE_COUNT,
  spectatorBodyGeometry,
  spectatorJacketGeometry,
  spectatorPose,
} from '@/render/scenery/SpectatorGeometry';

const ARCTIC_INDEX = stageIndexOf('arctic');
const spectatorsOf = (seed: number) =>
  scatterScenery(createStageWorld(seed, ARCTIC_INDEX).field).filter((p) => p.kind === 'spectator');

describe('Arctic spectators', () => {
  it('stand in groups down the stage, in every jacket and pose', () => {
    const spectators = [1, 2, 3].flatMap(spectatorsOf);
    expect(spectators.length).toBeGreaterThan(60);
    const jackets = new Set(spectators.map((s) => s.variant % SPECTATOR_JACKETS));
    const poses = new Set(spectators.map((s) => spectatorPose(s.variant)));
    expect(jackets.size).toBe(SPECTATOR_JACKETS);
    expect(poses.size).toBe(SPECTATOR_POSES);
    for (const s of spectators) {
      expect(s.variant).toBeGreaterThanOrEqual(0);
      expect(s.variant).toBeLessThan(SPECTATOR_JACKETS * SPECTATOR_POSES);
    }
  });

  it('crowd round the start, every checkpoint, every jump and the finish, never on the road', () => {
    for (const seed of [1, 2, 3]) {
      const { field, stage } = createStageWorld(seed, ARCTIC_INDEX);
      const spectators = spectatorsOf(seed);
      const hit = createRoadHit();
      const along = spectators.map((p) => {
        expect(stage.path.nearest(p.x, p.z, 40, hit)).toBe(true);
        // Behind the banks, clear of the carriageway and the snow heaped beside it.
        expect(hit.distance).toBeGreaterThan(
          stage.halfWidth + 0.6 + REGIONS.arctic.terrain.banks!.width,
        );
        return hit.along;
      });
      const near = (d: number, before: number, after: number) =>
        along.filter((a) => a > d - before && a < d + after).length;
      // The start, the checkpoints and the jumps draw half the finish's density.
      const start = near(stage.startDistance, 25, 35);
      expect(start).toBeGreaterThan(50);
      expect(start).toBeLessThan(110);
      for (const g of stage.gates) {
        const n = near(g.distance, 22, 18);
        if (g.kind === 'finish') expect(n).toBeGreaterThan(80);
        else {
          expect(n).toBeGreaterThan(20);
          expect(n).toBeLessThan(60);
        }
        // The boards and the arch keep their gap.
        expect(near(g.distance, 2, 2)).toBe(0);
      }
      expect(field.crestsAt.length).toBeGreaterThan(0);
      for (const c of field.crestsAt) {
        expect(near(c, 26, 10)).toBeGreaterThan(20);
        expect(near(c, 26, 10)).toBeLessThan(75);
      }
      // A crowd, not a stadium: several hundred figures over the whole stage.
      expect(spectators.length).toBeLessThan(1000);
    }
  });

  it('stand between the crowds in groups of five or six, no two alike in pose or jacket', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { field, stage } = createStageWorld(seed, ARCTIC_INDEX);
      // The crowds' stretches, widened by the groups' margin and half a group.
      const crowds = [
        [stage.startDistance - 25, stage.startDistance + 35],
        ...stage.gates.map((g) =>
          g.kind === 'finish'
            ? [g.distance - 45, g.distance + 25]
            : [g.distance - 22, g.distance + 18],
        ),
        ...field.crestsAt.map((c) => [c - 26, c + 10]),
      ];
      const hit = createRoadHit();
      const placed = spectatorsOf(seed).map((p) => {
        stage.path.nearest(p.x, p.z, 40, hit);
        return { p, along: hit.along, side: Math.sign(hit.lateral) };
      });
      const loose = placed
        .filter(({ along }) => crowds.every(([a, b]) => along < a! - 5 || along > b! + 5))
        .sort((a, b) => a.along - b.along);
      const groups: Prop[][] = [];
      let prev: (typeof loose)[number] | null = null;
      for (const s of loose) {
        if (!prev || s.along - prev.along > 8 || s.side !== prev.side) groups.push([]);
        groups[groups.length - 1]!.push(s.p);
        prev = s;
      }
      // In the crowds, the next few people along either side never repeat a pose-and-jacket pairing.
      for (const side of [1, -1]) {
        const lined = placed
          .filter((s) => s.side === side && !loose.includes(s))
          .sort((a, b) => a.along - b.along);
        for (let i = 1; i < lined.length; i++)
          if (lined[i]!.along - lined[i - 1]!.along < 3)
            expect(lined[i]!.p.variant).not.toBe(lined[i - 1]!.p.variant);
      }
      expect(groups.length).toBeGreaterThan(10);
      const full = groups.filter((g) => g.length >= 5);
      expect(full.length / groups.length).toBeGreaterThan(0.85);
      for (const g of groups) {
        expect(g.length).toBeLessThanOrEqual(6);
        expect(new Set(g.map((p) => spectatorPose(p.variant))).size).toBe(g.length);
        expect(new Set(g.map((p) => p.variant % SPECTATOR_JACKETS)).size).toBe(g.length);
      }
    }
  });

  it('build every pose in both outfits: standing about 1.75 m, sitting on the ground about 1 m', () => {
    expect(SPECTATOR_POSE_COUNT).toBe(SPECTATOR_POSES);
    let seated = 0;
    for (const outfit of ['winter', 'casual'] as const) {
      for (let pose = 0; pose < SPECTATOR_POSE_COUNT; pose++) {
        const body = spectatorBodyGeometry(pose, outfit);
        const top = spectatorJacketGeometry(pose, outfit);
        body.computeBoundingBox();
        top.computeBoundingBox();
        const box = body.boundingBox!;
        expect(box.min.y).toBeCloseTo(0, 2);
        expect(box.max.x - box.min.x).toBeLessThan(1.2);
        if (box.max.y < 1.4) {
          // Sitting: head about a metre up, the top lowered with it, the knees out toward the road.
          seated++;
          expect(box.max.y).toBeGreaterThan(0.9);
          expect(top.boundingBox!.max.y).toBeLessThan(1.1);
          expect(box.min.z).toBeLessThan(-0.6);
        } else {
          // Head (and any raised hand) between 1.7 m and 2.0 m.
          expect(box.max.y).toBeGreaterThan(1.7);
          expect(box.max.y).toBeLessThan(2.0);
        }
        expect(top.getAttribute('color')).toBeDefined();
        body.dispose();
        top.dispose();
      }
    }
    expect(seated).toBe(4);
    // Casual figures wear no mittens: their hands are skin, not the dark glove.
    const glove = (g: ReturnType<typeof spectatorBodyGeometry>) => {
      const c = g.getAttribute('color');
      let n = 0;
      for (let i = 0; i < c.count; i++)
        if (Math.abs(c.getX(i) - c.getY(i)) < 0.01 && c.getX(i) < 0.03) n++;
      return n;
    };
    expect(glove(spectatorBodyGeometry(0, 'casual'))).toBeLessThan(glove(spectatorBodyGeometry(0)));
  });

  it('come to Forest stages only on mud, dressed for a mild day', () => {
    const picks: [number, number][] = [
      [1, stageIndexOf('forest', 'mud')],
      [1, stageIndexOf('forest', 'gravel')],
      [2, stageIndexOf('forest', 'tarmac')],
    ];
    let mud = 0;
    for (const [seed, index] of picks) {
      const { field, stage } = createStageWorld(seed, index);
      const n = scatterScenery(field).filter((p) => p.kind === 'spectator').length;
      if (stage.surface === 'mud') {
        mud++;
        expect(n, `seed ${seed}`).toBeGreaterThan(100);
      } else expect(n, `seed ${seed} ${stage.surface}`).toBe(0);
    }
    expect(mud).toBeGreaterThan(0);
    expect(spectatorOutfit({ region: 'forest' })).toBe('casual');
    expect(spectatorOutfit({ region: 'arctic' })).toBe('winter');
  }, 30_000);

  it('draw each spectator with exactly one body kit and one jacket kit', () => {
    const kits = rallyKits(REGIONS.arctic.palette, false, true);
    for (let variant = 0; variant < SPECTATOR_JACKETS * SPECTATOR_POSES; variant++) {
      const p: Prop = { kind: 'spectator', x: 0, y: 0, z: 0, scale: 1, rotation: 0, variant };
      const drawn = kits.filter((k) => k.sources.includes('spectator') && (k.accept?.(p) ?? true));
      expect(drawn).toHaveLength(2);
      expect(drawn.filter((k) => k.tint !== null)).toHaveLength(1);
    }
    for (const k of kits) {
      k.geometry.dispose();
      k.material.dispose();
    }
  });
});
