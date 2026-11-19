import { Box3 } from 'three';
import { describe, expect, it } from 'vitest';
import { groves } from '@/game/stage/Groves';
import { lacetGround, RADIUS_MIN } from '@/game/stage/Lacets';
import { createRoadHit } from '@/game/stage/RoadPath';
import { standable } from '@/game/stage/Spectators';
import { STAGE_TYPES, stageScenery } from '@/game/stage/regions';
import type { StageDef } from '@/game/stage/StageGenerator';
import { scatterGrass } from '@/game/stage/TallGrass';
import { TerrainField } from '@/game/stage/TerrainField';
import { wornTone } from '@/render/road/SurfaceDetail';
import {
  BROADLEAF_FORMS,
  broadleafGeometry,
  bushGeometry,
  CONIFER_FORMS,
  coniferGeometry,
  type GreenvaleColours,
} from '@/render/scenery/GreenvaleTreeGeometry';
import { hexToLinear, terrainColors } from '@/render/terrain/meshTerrainChunk';
import { valleyFaceColor, type ValleyFace } from '@/render/terrain/valleyFaceColor';
import { Color } from 'three';
import { stageV13, worldV13 } from './stageIndex';

const greenvale = (seed: number, nth = 1) => stageV13(seed, 'forest', nth);
const pinewood = (seed: number, nth = 1) => stageV13(seed, 'pinewood', nth);

/** Total turning per kilometre of road, radians. */
function turnPerKm(stage: StageDef): number {
  const { headings, length } = stage.path;
  let turn = 0;
  for (let i = 1; i < headings.length; i++) {
    const d = headings[i]! - headings[i - 1]!;
    turn += Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
  }
  return turn / (length / 1000);
}

describe('Greenvale roads', () => {
  it('climb or drop the hillsides in hairpin stacks, and nowhere else does', () => {
    let stacks = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const stage = greenvale(seed);
      for (const l of stage.lacets ?? []) {
        stacks++;
        expect(l.radius).toBeGreaterThanOrEqual(RADIUS_MIN);
        expect(l.to - l.from).toBeGreaterThan(250);
        // Two hairpins the opposite ways: the road turns through well over two half-turns, and
        // leaves the stack on the heading it took into it.
        const { headings, spacing } = stage.path;
        let turn = 0;
        for (let i = Math.ceil(l.from / spacing) + 1; i <= Math.floor(l.to / spacing); i++) {
          const d = headings[i]! - headings[i - 1]!;
          turn += Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
        }
        expect(turn).toBeGreaterThan(2 * Math.PI);
        // The hills step across it, the way the stack climbs.
        const step = lacetGround([l], l.exit.x, l.exit.z) - lacetGround([l], l.entry.x, l.entry.z);
        expect(Math.sign(step)).toBe(Math.sign(l.rise));
        expect(Math.abs(step)).toBeGreaterThan(Math.abs(l.rise) * 0.8);
      }
      expect(pinewood(seed).lacets).toBeUndefined();
    }
    expect(stacks).toBeGreaterThanOrEqual(6);
  });

  it('bend harder and climb higher than the summer woodland roads', () => {
    let gv = 0;
    let pw = 0;
    let gvRelief = 0;
    let pwRelief = 0;
    const relief = (stage: StageDef) => {
      const field = new TerrainField(stage);
      let lo = Infinity;
      let hi = -Infinity;
      for (let d = 0; d < stage.path.length; d += 10) {
        const y = field.roadHeightAt(d);
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
      return hi - lo;
    };
    for (let seed = 1; seed <= 5; seed++) {
      gv += turnPerKm(greenvale(seed));
      pw += turnPerKm(pinewood(seed));
      gvRelief += relief(greenvale(seed));
      pwRelief += relief(pinewood(seed));
    }
    expect(gv).toBeGreaterThan(pw * 1.3);
    expect(gvRelief).toBeGreaterThan(pwRelief * 1.3);
    expect(STAGE_TYPES.forest.straights).toBeLessThan(0.2);
  });

  it('wears thick mixed woods and tall grass', () => {
    const gv = worldV13(2, 'forest', 1);
    const perKm = (props: readonly { kind: string }[], kinds: string[], length: number) =>
      props.filter((p) => kinds.includes(p.kind)).length / (length / 1000);
    const trees = perKm(gv.props, ['tree', 'broadleaf'], gv.stage.path.length);
    const autumnal = worldV13(2, 'autumnal', 1);
    expect(trees).toBeGreaterThan(
      perKm(autumnal.props, ['tree', 'broadleaf'], autumnal.stage.path.length) * 1.5,
    );
    expect(gv.props.filter((p) => p.kind === 'broadleaf').length).toBeGreaterThan(100);
    const grass = scatterGrass(gv.field, gv.props);
    expect(grass.length / (gv.stage.path.length / 100)).toBeGreaterThan(400);
  });
});

describe('Greenvale groves', () => {
  it('run the road through thick broadleaf forest now and then', () => {
    const w = worldV13(989380427, 'forest', 0);
    const def = stageScenery('forest').groves!;
    const at = groves(w.stage.seed, def);
    const hit = createRoadHit();
    let inside = 0;
    let outside = 0;
    for (const p of w.props) {
      if (p.kind !== 'broadleaf' || !w.stage.path.nearest(p.x, p.z, 40, hit)) continue;
      const g = at(hit.along);
      if (g > 0.9) inside++;
      else if (g < 0.1) outside++;
    }
    // Per metre of road in and out of the groves.
    let inLen = 0;
    let outLen = 0;
    for (let d = 0; d < w.stage.path.length; d += 2) {
      const g = at(d);
      if (g > 0.9) inLen += 2;
      else if (g < 0.1) outLen += 2;
    }
    expect(inLen / w.stage.path.length).toBeGreaterThan(0.2);
    expect(outLen / w.stage.path.length).toBeGreaterThan(0.2);
    expect(inside / inLen).toBeGreaterThan((outside / outLen) * 1.8);
    expect(stageScenery('pinewood').groves).toBeUndefined();
  });
});

describe('Greenvale spectators', () => {
  it('stand on level ground, never at a brink, with a view of the road, and still turn out', () => {
    for (const seed of [1, 2]) {
      const w = worldV13(seed, 'forest', 1);
      const people = w.props.filter((p) => p.kind === 'spectator');
      expect(people.length).toBeGreaterThan(100);
      const hit = createRoadHit();
      // The berms are heaped once everyone stands; read the ground as it was.
      const bare = new TerrainField(w.stage);
      for (const p of people) {
        expect(w.stage.path.nearest(p.x, p.z, 40, hit)).toBe(true);
        // Placed from a road distance a metre or two off the nearest on a bend.
        expect([-3, -2, -1, 0, 1, 2, 3].some((e) => standable(bare, p.x, p.z, hit.along + e))).toBe(
          true,
        );
        const y = bare.heightAt(p.x, p.z);
        for (const [dx, dz] of [
          [0.9, 0],
          [-0.9, 0],
          [0, 0.9],
          [0, -0.9],
        ] as const)
          expect(Math.abs(bare.heightAt(p.x + dx, p.z + dz) - y)).toBeLessThanOrEqual(0.3 + 1e-9);
      }
    }
  });
});

describe('Greenvale jumps', () => {
  it('lay a jump or more on every stage, on a levelled run-up, the road never past its grade', () => {
    let jumps = 0;
    for (let seed = 1; seed <= 6; seed++)
      for (const nth of [0, 1]) {
        const stage = stageV13(seed, 'forest', nth);
        const field = new TerrainField(stage);
        expect(field.crestsAt.length).toBeGreaterThan(0);
        jumps += field.crestsAt.length;
        for (let d = 2; d < stage.path.length; d += 2)
          expect(Math.abs(field.roadHeightAt(d) - field.roadHeightAt(d - 2))).toBeLessThanOrEqual(
            0.25,
          );
        const finish = stage.startDistance + stage.length;
        for (const c of field.crestsAt) {
          expect(c).toBeLessThan(finish);
          for (const l of stage.lacets ?? []) expect(c < l.from || c > l.to).toBe(true);
          // A hump: its top stands well over the run-up's line through its ends.
          const top = field.roadHeightAt(c);
          const ends = (field.roadHeightAt(c - 15) + field.roadHeightAt(c + 15)) / 2;
          expect(top - ends).toBeGreaterThan(0.6);
        }
      }
    expect(jumps).toBeGreaterThan(18);
  });

  it('draw a crowd on either side', () => {
    const w = worldV13(1, 'forest', 0);
    expect(w.field.crestsAt.length).toBeGreaterThan(0);
    const hit = createRoadHit();
    for (const c of w.field.crestsAt) {
      const n = w.props.filter(
        (p) =>
          p.kind === 'spectator' &&
          w.stage.path.nearest(p.x, p.z, 40, hit) &&
          hit.along > c - 26 &&
          hit.along < c + 10,
      ).length;
      expect(n).toBeGreaterThan(5);
    }
  });
});

describe('Greenvale crowds', () => {
  it('turn out at the start, every checkpoint and the finish, on benches level with the road', () => {
    for (const seed of [1, 2, 3]) {
      const w = worldV13(seed, 'forest', 1);
      const { stage } = w;
      // Checkpoints stand at a stack's foot or top, never on it.
      for (const g of stage.gates)
        for (const l of stage.lacets ?? [])
          expect(g.distance <= l.from - 29 || g.distance >= l.to + 29).toBe(true);
      const hit = createRoadHit();
      const along = w.props
        .filter((p) => p.kind === 'spectator')
        .map((p) => (stage.path.nearest(p.x, p.z, 40, hit) ? hit.along : -1e9));
      const near = (d: number, before: number, after: number) =>
        along.filter((a) => a > d - before && a < d + after).length;
      expect(near(stage.startDistance, 25, 35)).toBeGreaterThan(30);
      for (const g of stage.gates)
        if (g.kind === 'finish') expect(near(g.distance, 45, 25)).toBeGreaterThan(60);
        else expect(near(g.distance, 22, 18)).toBeGreaterThan(10);
      // Beside the first checkpoint, wherever it is benched, the ground is level across at the
      // shoulder's height (the deck less the asphalt's 15 cm edge), the berm aside.
      const bare = new TerrainField(stage);
      const g = stage.gates[0]!;
      const sample = { x: 0, z: 0, heading: 0 };
      stage.path.sample(g.distance - 12, sample);
      const shoulder = bare.roadHeightAt(g.distance - 12) + 0.08 - 0.15;
      let benched = 0;
      for (const side of [1, -1]) {
        const h = (e: number) =>
          bare.heightAt(
            sample.x + Math.cos(sample.heading) * (stage.halfWidth + e) * side,
            sample.z - Math.sin(sample.heading) * (stage.halfWidth + e) * side,
          );
        if (Math.abs(h(10) - shoulder) > 0.05) continue;
        benched++;
        for (const e of [8, 9, 11, 12, 13]) expect(h(e)).toBeCloseTo(shoulder, 1);
      }
      expect(benched).toBeGreaterThan(0);
    }
  });
});

describe('Greenvale ground', () => {
  const tones = terrainColors(STAGE_TYPES.forest.palette).valley!;
  const face = (over: Partial<ValleyFace>): ValleyFace => ({
    x: 10,
    z: 10,
    h: 0,
    ny: 0.99,
    hollow: 0,
    road: 0,
    hashA: 0.5,
    hashB: 0.5,
    ...over,
  });
  const colour = (f: ValleyFace) => {
    const out = [0, 0, 0];
    valleyFaceColor(tones, f, out);
    return out as [number, number, number];
  };

  it('is lush down the hollows, sunlit on the crests, grey on the steep faces and brown by the road', () => {
    const hollow = colour(face({ hollow: 5 }));
    const crest = colour(face({ hollow: -5 }));
    // Green either way, the hollow deeper and the crest brighter and warmer.
    for (const c of [hollow, crest]) expect(c[1]).toBeGreaterThan(c[0] * 1.2);
    expect(hollow[1]).toBeLessThan(crest[1]);
    expect(crest[0] / crest[1]).toBeGreaterThan(hollow[0] / hollow[1]);
    // Rock: near-neutral grey.
    const rock = colour(face({ ny: 0.6 }));
    expect(Math.abs(rock[1] - rock[0])).toBeLessThan(rock[1] * 0.1);
    expect(Math.abs(rock[2] - rock[0])).toBeLessThan(rock[1] * 0.15);
    // By the road: earthier, its red above its blue and nearer its green.
    const verge = colour(face({ road: 0.9 }));
    const open = colour(face({}));
    expect(verge[0] / verge[1]).toBeGreaterThan((open[0] / open[1]) * 1.3);
    expect(verge[0]).toBeGreaterThan(verge[2]);
  });

  it('is only the Greenvale’s', () => {
    expect(terrainColors(STAGE_TYPES.pinewood.palette).valley).toBeUndefined();
    expect(tones.earth).toEqual(hexToLinear(STAGE_TYPES.forest.palette.meadows!.earth));
  });
});

describe('Greenvale tarmac', () => {
  it('polishes the wheel tracks, lays rubber through the bends and patches a lane now and then', () => {
    const hw = 4.5;
    // Bands across a 9 m road: edge, track, between, track, crown… (see `laneBands`).
    let track = 0;
    let between = 0;
    let straight = 0;
    let bend = 0;
    let patched = 0;
    const n = 2000;
    for (let k = 0; k < n; k++) {
      track += wornTone(hw, 1, k, 0);
      between += wornTone(hw, 2, k, 0);
      straight += wornTone(hw, 3, k, 0);
      bend += wornTone(hw, 3, k, 0.08);
      if (Math.abs(wornTone(hw, 2, k, 0) - wornTone(hw, 2, k + 1, 0)) > 0.12) patched++;
    }
    expect(track / n).toBeLessThan((between / n) * 0.95);
    expect(bend / n).toBeLessThan((straight / n) * 0.85);
    expect(patched).toBeGreaterThan(0);
    expect(wornTone(hw, 40, 5, 0)).toBe(1);
    expect(wornTone(hw, 1, 77, 0.03)).toBe(wornTone(hw, 1, 77, 0.03));
  });
});

describe('Greenvale trees', () => {
  const colours: GreenvaleColours = {
    leaf: new Color('#4f9140'),
    leafAlt: new Color('#6b9a3a'),
    needle: new Color('#2f6c45'),
    needleAlt: new Color('#2b583b'),
    bark: new Color('#6b4d33'),
  };
  const box = new Box3();

  it('keep their crowns within reach of their trunks, and stand on the ground', () => {
    const cases = [
      ...BROADLEAF_FORMS.map((f) => [broadleafGeometry(f, colours, 1), 2.9, 7.5] as const),
      ...CONIFER_FORMS.map((f) => [coniferGeometry(f, colours, 1), 1.9, 8.2] as const),
      [bushGeometry(colours, 1), 1.6, 1.6] as const,
    ];
    for (const [g, reach, height] of cases) {
      box.setFromBufferAttribute(g.getAttribute('position') as never);
      expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThan(reach);
      expect(box.max.y).toBeLessThan(height);
      expect(box.min.y).toBeLessThanOrEqual(0.2);
      expect(g.getAttribute('color').count).toBe(g.getAttribute('position').count);
      g.dispose();
    }
  });

  it('stand in for themselves far off with a fraction of the facets', () => {
    for (const f of BROADLEAF_FORMS) {
      const near = broadleafGeometry(f, colours, 1);
      const far = broadleafGeometry(f, colours, 0);
      expect(far.getAttribute('position').count).toBeLessThan(
        near.getAttribute('position').count * 0.5,
      );
      near.dispose();
      far.dispose();
    }
  });
});
