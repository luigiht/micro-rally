import { describe, expect, it } from 'vitest';
import { RALLY_CYCLE, REGIONS } from '@/game/stage/regions';
import { stageIndexOf } from './stageIndex';
import { createRoadHit } from '@/game/stage/RoadPath';
import { scatterScenery } from '@/game/stage/SceneryScatter';
import { generateStage, stageHasTown, stageRegion } from '@/game/stage/StageGenerator';
import { createStageWorld } from '@/game/stage/StageWorld';
import { TerrainField } from '@/game/stage/TerrainField';
import { SeaWallBuilder } from '@/render/road/SeaWallBuilder';
import { meshTerrainChunk, terrainColors } from '@/render/terrain/meshTerrainChunk';
import { SeaPlane } from '@/render/terrain/SeaPlane';
import { dayTheme } from '@/render/theme/WorldTheme';

/** The first Coast stage of the cycle, and one on the hardest difficulty loop. */
const COAST_INDEX = stageIndexOf('coast');
/** A Coast stage of a later difficulty loop. */
const LATE_COAST_INDEX = stageIndexOf('coast', undefined, 0, 42);
const SEEDS = [1, 2, 3, 4, 5, 6];
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Turns of 150° or more within 90 m: the hairpins of the stacks. */
function hairpinTurns(headings: ArrayLike<number>, spacing: number): number {
  const win = Math.round(90 / spacing);
  let turns = 0;
  for (let i = 0; i + win < headings.length; i++) {
    if (Math.abs(wrap(headings[i + win]! - headings[i]!)) > 2.6) {
      turns++;
      i += win;
    }
  }
  return turns;
}

interface Station {
  x: number;
  z: number;
  /** Unit vector to the left of travel. */
  lx: number;
  lz: number;
}

/** Points along the road, clear of the start and the runout. */
function stations(field: TerrainField, every = 60): Station[] {
  const path = field.stage.path;
  const s = { x: 0, z: 0, heading: 0 };
  const out: Station[] = [];
  for (let d = 150; d < path.length - 150; d += every) {
    path.sample(d, s);
    out.push({ x: s.x, z: s.z, lx: Math.cos(s.heading), lz: -Math.sin(s.heading) });
  }
  return out;
}

const fields = new Map<number, TerrainField>();
function fieldFor(seed: number): TerrainField {
  let f = fields.get(seed);
  if (!f) {
    f = new TerrainField(generateStage(seed, COAST_INDEX));
    fields.set(seed, f);
  }
  return f;
}

describe('region cycle', () => {
  it('never shows a region twice running, mixes every rally region, and keeps villages to forest and alpine', () => {
    for (let i = 1; i < 200; i++)
      expect(stageRegion(i).region, `stage ${i + 1}`).not.toBe(stageRegion(i - 1).region);
    for (const id of ['forest', 'alpine', 'coast', 'desert', 'arctic'])
      expect(RALLY_CYCLE.some((s) => s.region === id)).toBe(true);
    expect(stageRegion(0).region).toBe('forest');
    expect(stageRegion(1).region).toBe('alpine');
    expect(stageRegion(COAST_INDEX).region).toBe('coast');
    const townRegions = new Set<string>();
    for (let i = 0; i < 48; i++) {
      if (!stageHasTown(i)) continue;
      townRegions.add(stageRegion(i).region);
    }
    expect([...townRegions].sort()).toEqual(['alpine', 'forest']);
  });
});

describe('Coast stages', () => {
  it('are tarmac, without a town, grade-limited, and climb at least one hairpin stack', () => {
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      const stage = field.stage;
      expect(stage.region).toBe('coast');
      expect(stage.surface).toBe('tarmac');
      expect(stage.town).toBeUndefined();
      expect(stage.path.length).toBeGreaterThan(stage.startDistance + stage.length);
      for (let d = 0; d < stage.path.length - 2; d += 2)
        expect(Math.abs(field.roadHeightAt(d + 2) - field.roadHeightAt(d))).toBeLessThanOrEqual(
          0.25,
        );
      // Somewhere the road doubles back on itself, twice: a hairpin stack.
      expect(hairpinTurns(stage.path.headings, stage.path.spacing)).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps the water beyond the beach, and beside the road one side falls while the other climbs', () => {
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      const coast = field.coast!;
      const shape = coast.shape;
      const path = field.stage.path;
      const hit = createRoadHit();
      const open = (x: number, z: number) => !path.nearest(x, z, field.corridor, hit);
      for (let u = 100; u <= 1500; u += 100) {
        const [sx, sz] = shape.toWorld(u, shape.shore(u) - 60);
        expect(field.heightAt(sx, sz)).toBeLessThan(coast.seaLevel);
        const bw = shape.beachWidth(u);
        if (bw < 6) continue;
        // Mid-beach is dry sand, unless a low shelf road runs so close that its verge blends onto it.
        const [bx, bz] = shape.toWorld(u, shape.shore(u) + bw / 2);
        if (!open(bx, bz)) continue;
        const sand = field.heightAt(bx, bz);
        expect(sand).toBeGreaterThan(coast.seaLevel - 0.2);
        expect(sand).toBeLessThan(coast.seaLevel + 1.4);
      }
      let falls = 0;
      let climbs = 0;
      let n = 0;
      for (const st of stations(field)) {
        const road = field.heightAt(st.x, st.z);
        expect(road).toBeGreaterThan(coast.seaLevel + 3);
        const l = [st.x + st.lx * 40, st.z + st.lz * 40] as const;
        const r = [st.x - st.lx * 40, st.z - st.lz * 40] as const;
        if (!open(...l) || !open(...r)) continue;
        n++;
        const hl = field.heightAt(...l);
        const hr = field.heightAt(...r);
        if (Math.min(hl, hr) < road - 3) falls++;
        if (Math.max(hl, hr) > road + 2) climbs++;
      }
      expect(n).toBeGreaterThan(5);
      expect(falls / n).toBeGreaterThan(0.85);
      expect(climbs / n).toBeGreaterThan(0.85);
    }
  });

  it('stands walls where the ground falls away, on both sides over a stage, clear of the gates, and colliding', () => {
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      const coast = field.coast!;
      const { path, gates, startDistance } = field.stage;
      const count = Math.floor(path.length / 2) + 1;
      const covered = new Uint8Array(count);
      for (const w of coast.walls) {
        expect(w.to - w.from).toBeGreaterThanOrEqual(12);
        for (const g of [startDistance, ...gates.map((g) => g.distance)])
          expect(w.from > g + 9.9 || w.to < g - 9.9).toBe(true);
        for (let i = Math.ceil(w.from / 2); i <= Math.floor(w.to / 2); i++) covered[i] = 1;
      }
      const share = covered.reduce((a, b) => a + b, 0) / count;
      expect(share).toBeGreaterThan(0.45);
      expect(share).toBeLessThan(0.97);
      expect(coast.walls.some((w) => w.side === 1)).toBe(true);
      expect(coast.walls.some((w) => w.side === -1)).toBe(true);
      const world = createStageWorld(seed, COAST_INDEX);
      expect(world.obstacles.boxes.length).toBeGreaterThan(50);
    }
  });

  it('grows rocks above the water, scrub off the wet sand, and trees on gentle ground above the beach', () => {
    for (const seed of SEEDS.slice(0, 3)) {
      const field = fieldFor(seed);
      const coast = field.coast!;
      const props = scatterScenery(field);
      let trees = 0;
      for (const p of props) {
        expect(p.kind).not.toBe('house');
        if (p.kind === 'rock') expect(p.y).toBeGreaterThanOrEqual(coast.seaLevel - 0.6);
        else if (p.kind === 'bush') {
          expect(coast.shoreDistance(p.x, p.z)).toBeGreaterThanOrEqual(2);
          expect(coast.slopeAt(p.x, p.z)).toBeLessThanOrEqual(1.4);
        } else if (p.kind === 'tree' || p.kind === 'broadleaf') {
          trees++;
          expect(p.y).toBeGreaterThanOrEqual(coast.seaLevel + 3);
          expect(coast.slopeAt(p.x, p.z)).toBeLessThanOrEqual(0.9);
          expect(coast.rockiness(p.x, p.z)).toBeLessThanOrEqual(0.6);
        }
      }
      expect(trees).toBeGreaterThan(20);
    }
  });

  it('paints the cliff band rock whatever its tilt, the beach sand and the water line wet sand', () => {
    const region = REGIONS.coast;
    const colors = terrainColors(region.palette, region.coast);
    expect(colors.sand).toBeDefined();
    const field = fieldFor(1);
    const coast = field.coast!;
    const shape = coast.shape;
    // A tall stretch of cliff: the band is rock from top to bottom, the beach below it is not.
    let u = 100;
    while (shape.cliffHeight(u) < 13 && u < 1500) u += 20;
    expect(shape.cliffHeight(u)).toBeGreaterThanOrEqual(13);
    const sample = { height: 0, roadBlend: 0, roadDistance: 0, rock: 0 };
    const bandV = shape.shore(u) + shape.beachWidth(u) + shape.cliffWidth(u) / 2;
    const [cx, cz] = shape.toWorld(u, bandV);
    field.sample(cx, cz, sample);
    expect(sample.rock).toBeGreaterThan(0.99);
    const [bx, bz] = shape.toWorld(u, shape.shore(u) + 2);
    field.sample(bx, bz, sample);
    expect(sample.rock).toBe(0);
    // Mesh the chunks around the beach and the water line and look for the sand colours.
    const near = (c: readonly number[], t: readonly number[]) =>
      c.every((v, i) => Math.abs(v - t[i]!) <= t[i]! * 0.08 + 0.002);
    const chunks = new Set<string>();
    for (const v of [shape.shore(u) - 12, shape.shore(u) + 3, shape.shore(u) + 10]) {
      const [x, z] = shape.toWorld(u, v);
      chunks.add(`${Math.floor(x / 64)},${Math.floor(z / 64)}`);
    }
    let sand = 0;
    let wet = 0;
    for (const key of chunks) {
      const [cx2, cz2] = key.split(',').map(Number) as [number, number];
      const data = meshTerrainChunk(field, colors, region.terrain.amplitude, cx2, cz2, 64, 32);
      for (let i = 0; i < data.colors.length; i += 9) {
        const c = [data.colors[i]!, data.colors[i + 1]!, data.colors[i + 2]!];
        if (near(c, colors.sand!)) sand++;
        if (near(c, colors.sandWet!)) wet++;
      }
    }
    expect(sand).toBeGreaterThan(0);
    expect(wet).toBeGreaterThan(0);
  });

  it('dresses the hillside mostly in grass, with rock and gravel patches, and the cliff band in rock', () => {
    const region = REGIONS.coast;
    const colors = terrainColors(region.palette, region.coast);
    const scree = colors.coast!.scree;
    const ax = { u: 0, v: 0 };
    const tally = { inland: 0, green: 0, gravel: 0, cliff: 0, cliffBare: 0 };
    const isGreen = (r: number, g: number, b: number) => g > r * 1.05 && g > b;
    for (const seed of [1, 2]) {
      const field = fieldFor(seed);
      const shape = field.coast!.shape;
      const chunks = new Set<string>();
      for (let u = 300; u <= 1200; u += 300) {
        const road = shape.shore(u) + shape.roadInland(u);
        for (const dv of [-12, 60]) {
          const [x, z] = shape.toWorld(u, road + dv);
          chunks.add(`${Math.floor(x / 64)},${Math.floor(z / 64)}`);
        }
      }
      for (const key of chunks) {
        const [cx, cz] = key.split(',').map(Number) as [number, number];
        const data = meshTerrainChunk(field, colors, region.terrain.amplitude, cx, cz, 64, 32);
        const { positions: p, colors: c } = data;
        for (let i = 0; i < p.length; i += 9) {
          shape.toAxis(
            (p[i]! + p[i + 3]! + p[i + 6]!) / 3,
            (p[i + 2]! + p[i + 5]! + p[i + 8]!) / 3,
            ax,
          );
          const shore = shape.shore(ax.u);
          const [r, g, b] = [c[i]!, c[i + 1]!, c[i + 2]!];
          const t = ax.v - shore - shape.beachWidth(ax.u);
          if (shape.cliffHeight(ax.u) > 12 && t > 2 && t < shape.cliffWidth(ax.u) - 2) {
            tally.cliff++;
            if (!isGreen(r, g, b)) tally.cliffBare++;
          }
          // The hillside proper: 20 m and more inland of the shore road.
          if (ax.v - shore - shape.roadInland(ax.u) < 20) continue;
          tally.inland++;
          if (isGreen(r, g, b)) tally.green++;
          else if (Math.abs(r / g - scree[0] / scree[1]) < 0.06) tally.gravel++;
        }
      }
    }
    expect(tally.inland).toBeGreaterThan(5000);
    expect(tally.green / tally.inland).toBeGreaterThan(0.55);
    expect(tally.green / tally.inland).toBeLessThan(0.9);
    expect(tally.gravel / tally.inland).toBeGreaterThan(0.03);
    expect(tally.cliff).toBeGreaterThan(200);
    expect(tally.cliffBare / tally.cliff).toBeGreaterThan(0.85);
  });

  it('uses the region sea and a default sea for inland themes', () => {
    expect(dayTheme(REGIONS.coast).sea).toBe(REGIONS.coast.coast!.sea);
    expect(dayTheme(REGIONS.forest).sea).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('lays the wall line along its side of the road at the wall offset, hairpins included', () => {
    for (const seed of SEEDS) {
      const coast = fieldFor(seed).coast!;
      const hit = createRoadHit();
      for (const w of coast.walls) {
        for (let d = w.from; d <= w.to; d += 6) {
          const pt = coast.wallPoint(d, w.side);
          expect(coast.stage.path.nearest(pt.x, pt.z, 20, hit)).toBe(true);
          expect(Math.abs(hit.distance - (coast.halfWidth + 2.1))).toBeLessThan(0.5);
          expect(Math.sign(hit.lateral)).toBe(w.side);
        }
      }
    }
  });

  it('keeps every stacked leg and the way down clear of the road below, on late loops too', () => {
    for (const seed of SEEDS) {
      for (const stage of [fieldFor(seed).stage, generateStage(seed, LATE_COAST_INDEX)]) {
        const { path, halfWidth } = stage;
        const hit = createRoadHit();
        const s = { x: 0, z: 0, heading: 0 };
        // Out past the verge and most of the blend, the ground is still this stretch of road's.
        const reach = halfWidth + 9;
        for (let d = 100; d < path.length - 100; d += 4) {
          path.sample(d, s);
          for (const side of [1, -1]) {
            const x = s.x + Math.cos(s.heading) * reach * side;
            const z = s.z - Math.sin(s.heading) * reach * side;
            expect(path.nearest(x, z, 60, hit)).toBe(true);
            expect(Math.abs(hit.along - d), `seed ${seed} at ${d} m`).toBeLessThan(60);
          }
        }
      }
    }
  });

  it('cuts the hillside back from the road instead of standing a wall at its edge, hairpins included', () => {
    // The last stage was reported from a game (stage 39 of 6MXS43EN): a 16 m wall at a hairpin's verge.
    const stages = [
      ...SEEDS.slice(0, 3).flatMap((seed) => [
        fieldFor(seed).stage,
        generateStage(seed, LATE_COAST_INDEX),
      ]),
      generateStage(1101485805, 38),
    ];
    for (const stage of stages) {
      expect(stage.region).toBe('coast');
      const field = new TerrainField(stage);
      const { path, halfWidth } = stage;
      const s = { x: 0, z: 0, heading: 0 };
      // 6 m beyond the verge's flat margin the ground stands no more than 1.2 per metre above the deck.
      const out = halfWidth + 3 + 6;
      for (let d = 100; d < path.length - 100; d += 4) {
        path.sample(d, s);
        const deck = field.roadHeightAt(d);
        for (const side of [1, -1]) {
          const x = s.x + Math.cos(s.heading) * out * side;
          const z = s.z - Math.sin(s.heading) * out * side;
          expect(field.heightAt(x, z) - deck, `seed ${stage.seed} at ${d} m`).toBeLessThan(7.5);
        }
      }
    }
  });

  it('turns through its hairpins without a kink: no heading step over 10° in 2 m, on late loops too', () => {
    for (const seed of SEEDS) {
      for (const stage of [fieldFor(seed).stage, generateStage(seed, LATE_COAST_INDEX)]) {
        const { headings } = stage.path;
        let worst = 0;
        for (let i = 1; i < headings.length; i++)
          worst = Math.max(worst, Math.abs(wrap(headings[i]! - headings[i - 1]!)));
        expect((worst * 180) / Math.PI).toBeLessThan(10);
      }
    }
  });

  it('keeps late-loop roads grade-limited with their hairpin stacks', () => {
    for (const seed of SEEDS.slice(0, 3)) {
      const field = new TerrainField(generateStage(seed, LATE_COAST_INDEX));
      expect(field.stage.region).toBe('coast');
      expect(field.stage.loop).toBeGreaterThanOrEqual(4);
      const { path } = field.stage;
      for (let d = 0; d < path.length - 2; d += 2)
        expect(Math.abs(field.roadHeightAt(d + 2) - field.roadHeightAt(d))).toBeLessThanOrEqual(
          0.25,
        );
      expect(hairpinTurns(path.headings, path.spacing)).toBeGreaterThanOrEqual(2);
    }
  });

  it('lie with the sea on either hand of travel, varying from stage to stage', () => {
    const sides = new Set<number>();
    for (const seed of [...SEEDS, 7, 8, 9, 10, 11, 12]) {
      const field = fieldFor(seed);
      const shape = field.coast!.shape;
      sides.add(shape.side);
      // The water lies on the side of travel opposite the land: right of the road when `side` is +1.
      const path = field.stage.path;
      const hit = createRoadHit();
      let agree = 0;
      let n = 0;
      for (let u = 200; u <= 1400; u += 100) {
        const [sx, sz] = shape.toWorld(u, shape.shore(u) - 20);
        if (!path.nearest(sx, sz, 200, hit)) continue;
        n++;
        if (Math.sign(hit.lateral) === -shape.side) agree++;
      }
      // A hairpin stack's middle leg runs back along the shore with the sea on its other hand.
      expect(n).toBeGreaterThan(5);
      expect(agree / n).toBeGreaterThan(0.7);
    }
    expect([...sides].sort()).toEqual([-1, 1]);
  });

  it('give each stage its own shore, and sharper headlands on later loops', () => {
    const cornersPerKm = (seed: number, index: number) => {
      const { headings, spacing, length } = generateStage(seed, index).path;
      const step = Math.round(10 / spacing);
      let corners = 0;
      let inCorner = false;
      for (let i = step; i < headings.length; i += step) {
        const tight = Math.abs(wrap(headings[i]! - headings[i - step]!)) / 10 > 1 / 120;
        if (tight && !inCorner) corners++;
        inCorner = tight;
      }
      return corners / (length / 1000);
    };
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const early = seeds.map((s) => cornersPerKm(s, COAST_INDEX));
    const late = seeds.map((s) => cornersPerKm(s, LATE_COAST_INDEX));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(Math.max(...early, ...late) - Math.min(...early, ...late)).toBeGreaterThan(6);
    expect(mean(late)).toBeGreaterThan(mean(early));
  });

  it('builds the wall mesh and a sea plane that follows the car', () => {
    const field = fieldFor(2);
    const wall = new SeaWallBuilder(field.coast!, field, dayTheme(REGIONS.coast).seawall);
    expect(wall.group.children).toHaveLength(1);
    wall.dispose();
    const sea = new SeaPlane(0, '#3b8fb5');
    sea.update(10, 20);
    expect(sea.group.children[0]!.position.x).toBe(10);
    expect(sea.group.children[0]!.position.z).toBe(20);
    sea.dispose();
  });
});
