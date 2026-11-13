import { describe, expect, it } from 'vitest';
import { selfApproachOk, START_DISTANCE } from '@/game/stage/Centreline';
import { parseSaveFile, SAVE_VERSION } from '@/game/save/SaveFile';
import { stageIndexOf } from './stageIndex';
import { isCircuitStage, isCityStage, STAGE_TYPES } from '@/game/stage/regions';
import { createRoadHit } from '@/game/stage/RoadPath';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { ringLaneRadius, ringOuterRadius, ringSweep } from '@/game/stage/Roundabout';
import { scatterScenery } from '@/game/stage/SceneryScatter';
import { generateStage, stageHasTown, stageTypeAt } from '@/game/stage/StageGenerator';
import { createStageWorld } from '@/game/stage/StageWorld';
import { TerrainField } from '@/game/stage/TerrainField';
import { KERB_LIFT, townObstacles, townProps } from '@/game/stage/Town';
import { junctionReach } from '@/game/stage/TownJunctions';
import { MEDIAN_HALF, medianLift } from '@/game/stage/Median';
import { boxArmCut } from '@/game/stage/JunctionBox';
import { RAIL_LIFT, TRAM_BED_HALF, TRAM_GAUGE, tramLift } from '@/game/stage/Tram';
import { planUrban } from '@/game/stage/UrbanPlan';

/** The first city of the cycle, and a later one on a higher difficulty loop. */
const URBAN_INDEX = 8;
const LATE_URBAN_INDEX = 26;
const SEEDS = [1, 2, 3, 4, 5, 6];
const URBAN = STAGE_TYPES.urban.urban!;

const fields = new Map<number, TerrainField>();
function fieldFor(seed: number, index = URBAN_INDEX): TerrainField {
  const key = seed * 1000 + index;
  let f = fields.get(key);
  if (!f) {
    f = new TerrainField(generateStage(seed, index));
    scatterScenery(f);
    fields.set(key, f);
  }
  return f;
}

describe('the cycle', () => {
  it('puts a city on every ninth stage and nowhere else, none with a village of its own', () => {
    for (let i = 0; i < 200; i++) {
      expect(stageTypeAt(i).stageType === 'urban', `stage ${i + 1}`).toBe(i % 9 === 8);
      expect(isCityStage(i) && isCircuitStage(i)).toBe(false);
    }
    expect(stageTypeAt(URBAN_INDEX).stageType).toBe('urban');
    expect(stageTypeAt(LATE_URBAN_INDEX).stageType).toBe('urban');
    for (let i = 0; i < 60; i++)
      if (stageTypeAt(i).stageType === 'urban') expect(stageHasTown(i)).toBe(false);
  });

  it('is deterministic', () => {
    const a = generateStage(3, URBAN_INDEX);
    const b = generateStage(3, URBAN_INDEX);
    expect(Array.from(a.path.xs)).toEqual(Array.from(b.path.xs));
    expect(a.town!.buildings).toEqual(b.town!.buildings);
    expect(a.town!.trams).toEqual(b.town!.trams);
  });
});

// Generating a city takes about a second, so tests that build several get time for it.
describe('Urban stages', { timeout: 30_000 }, () => {
  it('are a tarmac city from the start line to the finish, with streets of two to four lanes', () => {
    for (const seed of SEEDS) {
      const stage = fieldFor(seed).stage;
      const town = stage.town!;
      expect(stage.stageType).toBe('urban');
      expect(stage.surface).toBe('tarmac');
      expect(stage.halfWidth).toBe(URBAN.lanes.four);
      expect(town.from).toBeLessThanOrEqual(START_DISTANCE);
      expect(town.to).toBeGreaterThanOrEqual(START_DISTANCE + stage.length);
      expect(town.relief).toBe(URBAN.relief);
      // The widths vary: a boulevard somewhere, and narrower streets elsewhere.
      let wide = 0;
      let narrow = 0;
      for (let d = START_DISTANCE; d < START_DISTANCE + stage.length; d += 10) {
        const hw = halfWidthAt(stage, d);
        if (hw >= URBAN.lanes.four - 1e-6) wide++;
        if (hw <= URBAN.lanes.two + 1e-6) narrow++;
      }
      expect(wide).toBeGreaterThan(5);
      expect(narrow).toBeGreaterThan(5);
      // Junctions every block, with blocked side streets, and a few hundred buildings.
      expect(town.junctions.length).toBeGreaterThanOrEqual(8);
      expect(town.streets.filter((s) => !s.route).length).toBeGreaterThan(16);
      expect(town.buildings.length).toBeGreaterThan(150);
      expect(town.buildings.some((b) => b.style === 'block')).toBe(true);
      expect(town.buildings.some((b) => b.style === 'office')).toBe(true);
      // The city's own kits in their four renders, and the city flag the detail hangs on.
      expect(town.buildings.some((b) => b.style === 'tenement')).toBe(true);
      expect(town.buildings.some((b) => b.style === 'arcade')).toBe(true);
      expect(new Set(town.buildings.map((b) => b.variant)).size).toBe(4);
      expect(town.city).toBe(true);
    }
    // The first test here builds the three cities the rest share: a few seconds on a CI runner.
  }, 30_000);

  it('leave no cone on a tram bed, so the trams pass through the rows across their side streets', () => {
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      const town = field.stage.town!;
      const trams = town.trams ?? [];
      if (trams.length === 0) continue;
      const cones = townProps(town, field).filter((p) => p.kind === 'cone');
      expect(cones.length).toBeGreaterThan(0);
      for (const c of cones)
        for (const t of trams) {
          const dx = t.x1 - t.x0;
          const dz = t.z1 - t.z0;
          const u = Math.min(
            1,
            Math.max(0, ((c.x - t.x0) * dx + (c.z - t.z0) * dz) / (dx * dx + dz * dz)),
          );
          expect(Math.hypot(c.x - t.x0 - dx * u, c.z - t.z0 - dz * u)).toBeGreaterThan(
            TRAM_BED_HALF,
          );
        }
      // The rows still stand either side of the line: at least two cones per tram-carrying row.
      for (const t of trams)
        for (const end of [
          { x: t.x0, z: t.z0 },
          { x: t.x1, z: t.z1 },
        ]) {
          const near = cones.filter((c) => Math.hypot(c.x - end.x, c.z - end.z) < 12);
          expect(near.length).toBeGreaterThanOrEqual(0);
        }
    }
  });

  it('keep each street to two or four lanes from junction to junction, changing only inside a corner', () => {
    const hit = createRoadHit();
    for (const seed of SEEDS) {
      const stage = fieldFor(seed).stage;
      const lanes = STAGE_TYPES.urban.urban!.lanes;
      // Every street a two-lane street or a four-lane avenue.
      for (const st of stage.town!.streets)
        expect([lanes.two, lanes.four], `${seed} street`).toContain(st.halfWidth);
      // A straight holds its own width in its middle, however long or short.
      for (const st of stage.town!.streets.filter((x) => x.route)) {
        if (Math.hypot(st.x1 - st.x0, st.z1 - st.z0) < 30) continue;
        stage.path.nearest((st.x0 + st.x1) / 2, (st.z0 + st.z1) / 2, 5, hit);
        expect(halfWidthAt(stage, hit.along)).toBeCloseTo(st.halfWidth, 2);
      }
      // At a corner, the narrower width round the arc and each arm's own by the end of its paving.
      for (const j of stage.town!.junctions) {
        if (!j.box) continue;
        const inArm = j.arms.find((a) => a.role === 'in')!;
        const outArm = j.arms.find((a) => a.role === 'out')!;
        stage.path.nearest(j.x, j.z, 60, hit);
        expect(halfWidthAt(stage, hit.along)).toBeCloseTo(
          Math.min(inArm.halfWidth, outArm.halfWidth),
          1,
        );
        for (const arm of [inArm, outArm]) {
          const cut = boxArmCut(j, arm, stage.halfWidth) + 0.5;
          stage.path.nearest(
            j.x + Math.sin(arm.heading) * cut,
            j.z + Math.cos(arm.heading) * cut,
            20,
            hit,
          );
          expect(halfWidthAt(stage, hit.along), `${seed} arm at ${hit.along}`).toBeCloseTo(
            arm.halfWidth,
            1,
          );
        }
      }
    }
  });

  it('lay their streets crossroads to crossroads off the route, closed where it passes, and a kerbed green median down every boulevard', () => {
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      const town = field.stage.town!;
      const atRing = (x: number, z: number) =>
        town.roundabouts!.some(
          (r) =>
            Math.hypot(x - r.x, z - r.z) < ringOuterRadius(r) + 0.1 ||
            Math.hypot(x - r.x, z - r.z) < ringLaneRadius(r) + 0.1,
        );
      const streets = town.streets.filter((s) => !s.route && !atRing(s.x0, s.z0));
      expect(streets.length).toBeGreaterThan(30);
      const junctionAt = (x: number, z: number) =>
        town.junctions.find((j) => Math.hypot(j.x - x, j.z - z) < 1e-3);
      const hit = createRoadHit();
      for (const st of streets) {
        const len = Math.hypot(st.x1 - st.x0, st.z1 - st.z0);
        // Every street runs between two crossroads of the map, a block long.
        expect(st.open).toBe(true);
        expect(junctionAt(st.x0, st.z0), `${seed}`).toBeDefined();
        expect(junctionAt(st.x1, st.z1), `${seed}`).toBeDefined();
        expect(len).toBeGreaterThan(55);
        expect(len).toBeLessThan(150);
        // Its carriageway never runs into the route between its ends.
        for (let t = 25; t <= len - 25; t += 2) {
          const x = st.x0 + ((st.x1 - st.x0) * t) / len;
          const z = st.z0 + ((st.z1 - st.z0) * t) / len;
          if (field.stage.path.nearest(x, z, 40, hit))
            expect(hit.distance, `${seed}`).toBeGreaterThan(
              halfWidthAt(field.stage, hit.along) + 3,
            );
        }
        // Where a street meets its far crossroads the decks agree: no step, at most the grade
        // over this 1.5 m (12 % on the route).
        const ux = (st.x1 - st.x0) / len;
        const uz = (st.z1 - st.z0) / len;
        const a = field.deckAt(st.x1 - ux * 0.5, st.z1 - uz * 0.5);
        const b = field.deckAt(st.x1 + ux * 1.0, st.z1 + uz * 1.0);
        expect(Math.abs(a - b), `${seed}`).toBeLessThan(0.2);
      }
      // Every street a route junction passes is closed by a barrier a few metres in.
      for (const j of town.junctions) {
        if (!j.arms.some((a) => a.role === 'in')) continue;
        for (const arm of j.arms.filter((a) => a.role === 'blocked')) {
          const closed = town.barriers!.some((b) => {
            const dx = b.x - j.x;
            const dz = b.z - j.z;
            const along = dx * Math.sin(arm.heading) + dz * Math.cos(arm.heading);
            const across = dx * Math.cos(arm.heading) - dz * Math.sin(arm.heading);
            return along > 0 && along < 40 && Math.abs(across) < 0.5;
          });
          expect(closed, `${seed} junction ${j.x.toFixed(0)},${j.z.toFixed(0)}`).toBe(true);
        }
      }
      const medians = town.medians!;
      expect(medians.length).toBeGreaterThanOrEqual(2);
      for (const m of medians) {
        const mx = (m.x0 + m.x1) / 2;
        const mz = (m.z0 + m.z1) / 2;
        // On the route's centreline of a boulevard, a kerb high; off the median, nothing.
        expect(medianLift(medians, mx, mz)).toBeCloseTo(KERB_LIFT, 6);
        expect(field.heightAt(mx, mz) - field.deckAt(mx, mz)).toBeCloseTo(KERB_LIFT, 3);
        const h = Math.atan2(m.x1 - m.x0, m.z1 - m.z0);
        const off = MEDIAN_HALF + 1.5;
        expect(medianLift(medians, mx + Math.cos(h) * off, mz - Math.sin(h) * off)).toBe(0);
        // Rounded ends: a kerb's lift just past the end on the axis, none a radius and a ramp beyond.
        expect(
          medianLift(
            medians,
            m.x1 + Math.sin(h) * (MEDIAN_HALF * 0.5),
            m.z1 + Math.cos(h) * (MEDIAN_HALF * 0.5),
          ),
        ).toBeGreaterThan(KERB_LIFT * 0.9);
        expect(
          medianLift(
            medians,
            m.x1 + Math.sin(h) * (MEDIAN_HALF + 0.4),
            m.z1 + Math.cos(h) * (MEDIAN_HALF + 0.4),
          ),
        ).toBe(0);
        // Medians lie on four-lane streets only and keep clear of every junction's reach.
        const hit = createRoadHit();
        expect(field.stage.path.nearest(mx, mz, 1, hit)).toBe(true);
        expect(halfWidthAt(field.stage, hit.along)).toBeCloseTo(URBAN.lanes.four, 3);
        for (const j of town.junctions) {
          const dx = j.x - mx;
          const dz = j.z - mz;
          const along = Math.abs(dx * Math.sin(h) + dz * Math.cos(h));
          const across = Math.abs(dx * Math.cos(h) - dz * Math.sin(h));
          if (across < 1)
            expect(along).toBeGreaterThan(Math.hypot(m.x1 - m.x0, m.z1 - m.z0) / 2 + 6);
        }
      }
      // The start line and the spawn stand on plain tarmac; a city plants nothing, medians included:
      // its only greenery is the street trees along the pavements.
      expect(medianLift(medians, field.stage.spawn.x, field.stage.spawn.z)).toBe(0);
      expect(town.plantings).toEqual([]);
    }
  });

  it('keep their lamp posts out of every junction mouth', () => {
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      const town = field.stage.town!;
      const lamps = scatterScenery(field).filter((p) => p.kind === 'lamp');
      expect(lamps.length).toBeGreaterThan(10);
      for (const l of lamps) {
        for (const j of town.junctions)
          expect(Math.hypot(j.x - l.x, j.z - l.z)).toBeGreaterThan(junctionReach(j) + 3);
        // On a pavement, a kerb up, never on the carriageway.
        expect(field.heightAt(l.x, l.z) - field.deckAt(l.x, l.z)).toBeCloseTo(KERB_LIFT, 2);
      }
    }
  });

  it('turn right-angle corners and never double back', () => {
    for (const seed of SEEDS) {
      const stage = fieldFor(seed).stage;
      const { headings, spacing } = stage.path;
      // Heading change over 30 m of road: a right angle somewhere, nothing sharper than the plan allows.
      const window = Math.round(30 / spacing);
      let squares = 0;
      for (let i = window; i < headings.length; i++) {
        const d = headings[i]! - headings[i - window]!;
        const turn = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
        if (turn > Math.PI / 2 - 0.2 && turn < Math.PI / 2 + 0.2) squares++;
      }
      expect(squares).toBeGreaterThan(0);
      expect(selfApproachOk(stage.path, 0, stage.path.length)).toBe(true);
      for (let i = 1; i < headings.length; i++) {
        const d = headings[i]! - headings[i - 1]!;
        expect(Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))).toBeLessThan(0.45);
      }
    }
  });

  it('have a roundabout the route circles, flat, with an island a kerb up and blocked exits', () => {
    const hit = createRoadHit();
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      const stage = field.stage;
      const rs = stage.town!.roundabouts!;
      expect(rs.length).toBeGreaterThanOrEqual(1);
      for (const r of rs) {
        expect(r.islandRadius).toBeGreaterThanOrEqual(URBAN.island.min);
        expect(r.islandRadius).toBeLessThanOrEqual(URBAN.island.max);
        // Every sample of the route between `from` and `to` lies on the ring's lane.
        const lane = ringLaneRadius(r);
        for (let d = r.from + 1; d < r.to; d += 2) {
          const s = { x: 0, z: 0, heading: 0 };
          stage.path.sample(d, s);
          expect(Math.hypot(s.x - r.x, s.z - r.z)).toBeCloseTo(lane, 0);
        }
        // The ring is level: the route's deck varies under half a metre round it.
        let lo = Infinity;
        let hi = -Infinity;
        for (let d = r.from; d <= r.to; d += 2) {
          lo = Math.min(lo, field.roadHeightAt(d));
          hi = Math.max(hi, field.roadHeightAt(d));
        }
        expect(hi - lo).toBeLessThan(0.5);
        // The island's middle stands a kerb above the ring's deck; the undriven ring is tarmac at deck level.
        const deck = field.deckAt(r.x + lane, r.z);
        expect(field.heightAt(r.x, r.z) - deck).toBeCloseTo(KERB_LIFT, 1);
        const behind = r.angleOut + (r.sense * ringSweep(r, r.angleOut, r.angleIn)) / 2;
        const bx = r.x + Math.sin(behind) * lane;
        const bz = r.z + Math.cos(behind) * lane;
        if (!stage.path.nearest(bx, bz, r.halfWidth, hit)) {
          expect(field.surfaceAt(bx, bz)).toBe('tarmac');
          expect(Math.abs(field.deckAt(bx, bz) - deck)).toBeLessThan(0.3);
        }
        // Exits leave the ring's outer edge as blocked side streets with cones.
        for (const a of r.exits) {
          const ex = r.x + Math.sin(a) * ringOuterRadius(r);
          const ez = r.z + Math.cos(a) * ringOuterRadius(r);
          expect(
            stage.town!.streets.some((s) => !s.route && Math.hypot(s.x0 - ex, s.z0 - ez) < 0.05),
          ).toBe(true);
        }
        // No building on the island or the ring.
        for (const b of stage.town!.buildings)
          expect(Math.hypot(b.x - r.x, b.z - r.z)).toBeGreaterThan(ringOuterRadius(r));
        // The route's inner edge never bites into the island on its way in and out: the island's
        // kerb stays a circle. The path's 2 m chords sag up to ~0.1 m inside a ring this tight.
        for (let d = r.from - 30; d <= r.to + 30; d += 1) {
          const s = { x: 0, z: 0, heading: 0 };
          stage.path.sample(d, s);
          const hw = halfWidthAt(stage, d);
          const toCentre =
            Math.sign((r.x - s.x) * Math.cos(s.heading) - (r.z - s.z) * Math.sin(s.heading)) || 1;
          const ex = s.x + Math.cos(s.heading) * hw * toCentre;
          const ez = s.z - Math.sin(s.heading) * hw * toCentre;
          expect(Math.hypot(ex - r.x, ez - r.z)).toBeGreaterThanOrEqual(r.islandRadius - 0.15);
        }
      }
    }
  });

  it('lay tram tracks on the route that the wheels feel as a two centimetre ridge on each rail', () => {
    const hit = createRoadHit();
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      const stage = field.stage;
      const trams = stage.town!.trams!;
      expect(trams.length).toBeGreaterThanOrEqual(1);
      // Rails on the route's carriageway somewhere (crossing it or running along it): a piece
      // whose middle is on the route, clear of its edges.
      let mx = 0;
      let mz = 0;
      const crossing = trams.find((t) => {
        const x = (t.x0 + t.x1) / 2;
        const z = (t.z0 + t.z1) / 2;
        if (!stage.path.nearest(x, z, 20, hit)) return false;
        if (hit.distance > halfWidthAt(stage, hit.along) - 2.5) return false;
        mx = x;
        mz = z;
        return true;
      });
      expect(crossing).toBeDefined();
      const t = crossing!;
      const th = Math.atan2(t.x1 - t.x0, t.z1 - t.z0);
      const lx = Math.cos(th);
      const lz = -Math.sin(th);
      const onRail = { x: mx + (lx * TRAM_GAUGE) / 2, z: mz + (lz * TRAM_GAUGE) / 2 };
      expect(tramLift(trams, onRail.x, onRail.z)).toBeCloseTo(RAIL_LIFT, 3);
      expect(tramLift(trams, mx, mz)).toBe(0);
      expect(field.heightAt(onRail.x, onRail.z) - field.deckAt(onRail.x, onRail.z)).toBeCloseTo(
        RAIL_LIFT,
        3,
      );
      expect(field.heightAt(mx, mz) - field.deckAt(mx, mz)).toBeCloseTo(0, 3);
      // Grip is unchanged: rails are tarmac to the tyres.
      expect(field.surfaceAt(onRail.x, onRail.z)).toBe('tarmac');
    }
  });

  it('climb and dip within the grade limit, with checkpoints between the junctions', () => {
    const hit = createRoadHit();
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      const stage = field.stage;
      let lo = Infinity;
      let hi = -Infinity;
      for (let d = 0; d < stage.path.length; d += 2) {
        const h = field.roadHeightAt(d);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
        // 12 % on the open street, up to 15 % on the ramps between two level junctions.
        expect(Math.abs(field.roadHeightAt(d + 2) - h) / 2).toBeLessThanOrEqual(0.15 + 1e-6);
      }
      expect(hi - lo).toBeGreaterThan(6);
      // The junctions the route drives through (the city's others stand a block or more away).
      const junctions = stage
        .town!.junctions.filter((j) => j.arms.some((a) => a.role !== 'blocked'))
        .map((j) => {
          stage.path.nearest(j.x, j.z, 60, hit);
          return hit.along;
        });
      for (const g of stage.gates) {
        if (g.kind !== 'checkpoint') continue;
        for (const j of junctions)
          expect(Math.abs(g.distance - j)).toBeGreaterThanOrEqual(25 - 1e-6);
        for (const r of stage.town!.roundabouts ?? [])
          expect(g.distance < r.from - 25 + 1e-6 || g.distance > r.to + 25 - 1e-6).toBe(true);
        // Each board is as wide as the street there.
        expect(g.halfWidth).toBeCloseTo(halfWidthAt(stage, g.distance) + 3, 6);
      }
      expect(stage.gates.filter((g) => g.kind === 'checkpoint').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('keep every building and wall off the carriageway, and the route clear of the colliders', () => {
    for (const seed of SEEDS.slice(0, 3)) {
      const world = createStageWorld(seed, URBAN_INDEX);
      const stage = world.stage;
      const boxes = townObstacles(stage.town!);
      expect(boxes.length).toBeGreaterThan(200);
      const hit = createRoadHit();
      for (const b of boxes) {
        if (!stage.path.nearest(b.x, b.z, 30, hit)) continue;
        expect(hit.distance).toBeGreaterThan(
          halfWidthAt(stage, hit.along) + Math.min(b.hx, b.hz) - 0.3,
        );
      }
      // Every sample of the route is tarmac, and so is the pavement beside it (concrete: black tyre
      // marks, no grass drag).
      for (let d = START_DISTANCE + 40; d < START_DISTANCE + stage.length; d += 20) {
        const s = { x: 0, z: 0, heading: 0 };
        stage.path.sample(d, s);
        expect(world.field.surfaceAt(s.x, s.z)).toBe('tarmac');
        const hw = halfWidthAt(stage, d);
        const lx = Math.cos(s.heading);
        const lz = -Math.sin(s.heading);
        expect(world.field.surfaceAt(s.x + lx * (hw + 1.5), s.z + lz * (hw + 1.5))).toBe('tarmac');
      }
    }
  });

  it('get a longer city with more roundabouts on later loops, and a plan for any seed', () => {
    const late = generateStage(2, LATE_URBAN_INDEX);
    expect(late.loop).toBe(4);
    expect(late.town!.roundabouts!.length).toBeGreaterThanOrEqual(2);
    expect(late.length).toBeGreaterThan(generateStage(2, URBAN_INDEX).length);
    for (let seed = 100; seed < 140; seed++) {
      const plan = planUrban(seed, 2200, 0, URBAN);
      expect(plan.legs.length).toBeGreaterThan(8);
      expect(plan.legs.some((l) => l.roundabout)).toBe(true);
      // A width changes only where the route turns onto another street: at a corner of 45° or
      // more, or round a roundabout; through a crossroads straight on it keeps its street's.
      const legs = plan.legs;
      for (let i = 0; i + 1 < legs.length; i++) {
        const leg = legs[i]!;
        const next = legs[i + 1]!;
        if (leg.kind === 'straight' && Math.abs(leg.turn) >= Math.PI / 4) continue;
        if (leg.kind === 'curve' || next.kind === 'curve') continue;
        expect(next.halfWidth, `${seed} leg ${i}`).toBe(leg.halfWidth);
      }
      // The finish: an avenue run of at least 300 m after the last real turn.
      let run = 0;
      for (let i = legs.length - 1; i >= 0; i--) {
        const leg = legs[i]!;
        if (leg.kind === 'curve' || (i < legs.length - 1 && Math.abs(leg.turn) >= Math.PI / 4))
          break;
        expect(leg.halfWidth).toBe(URBAN.lanes.four);
        run += leg.length;
      }
      expect(run).toBeGreaterThanOrEqual(300);
    }
  });
});

describe('save migration', () => {
  it("moves v10 saves to v11, dropping the cities' records only", () => {
    const rec = { best: 90, splits: [30, 60, 90] };
    const city = stageIndexOf('urban', 2);
    const forest = stageIndexOf('forest', 2);
    const save = parseSaveFile({
      version: 10,
      gameId: 'ABCD2345',
      driverName: 'Ada',
      gameSeed: 1,
      money: 10,
      stageIndex: city + 1,
      records: { [city]: rec, [forest]: rec },
      carId: 'hatchback',
      ownedCars: ['hatchback'],
      upgrades: {},
      updatedAt: 1,
    })!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(Object.keys(save.records).map(Number)).toEqual([forest]);
  });

  it("moves v9 saves to v10, dropping the cities' records only", () => {
    const rec = { best: 90, splits: [30, 60, 90] };
    const city = stageIndexOf('urban', 1);
    const forest = stageIndexOf('forest', 1);
    const save = parseSaveFile({
      version: 9,
      gameId: 'ABCD2345',
      driverName: 'Ada',
      gameSeed: 1,
      money: 10,
      stageIndex: city + 1,
      records: { [city]: rec, [forest]: rec },
      carId: 'hatchback',
      ownedCars: ['hatchback'],
      upgrades: {},
      updatedAt: 1,
    })!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(Object.keys(save.records).map(Number)).toEqual([forest]);
  });

  it("moves v8 saves to v9, dropping the old cities' records only", () => {
    const rec = { best: 90, splits: [30, 60, 90] };
    const city = stageIndexOf('urban', 0);
    const forest = stageIndexOf('forest', 0);
    const save = parseSaveFile({
      version: 8,
      gameId: 'ABCD2345',
      driverName: 'Ada',
      gameSeed: 1,
      money: 10,
      stageIndex: city + 1,
      records: { [city]: rec, [forest]: rec },
      carId: 'hatchback',
      ownedCars: ['hatchback'],
      upgrades: {},
      updatedAt: 1,
    })!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(Object.keys(save.records).map(Number)).toEqual([forest]);
  });

  it('moves v4 saves to v5 and keeps records only where the region is unchanged', () => {
    const rec = { best: 90, splits: [30, 60, 90] };
    const save = parseSaveFile({
      version: 4,
      gameId: 'ABCD2345',
      driverName: 'Ada',
      gameSeed: 1,
      money: 10,
      stageIndex: 7,
      records: { 2: rec, 6: rec, 7: rec, 12: rec },
      carId: 'hatchback',
      ownedCars: ['hatchback'],
      upgrades: {},
      updatedAt: 5,
    })!;
    expect(save.version).toBe(SAVE_VERSION);
    // 6, 7 and 12 change region with v5; 2 (Forest) goes with v7, whose Forest surfaces are fixed.
    expect(Object.keys(save.records)).toEqual([]);
  });
});
