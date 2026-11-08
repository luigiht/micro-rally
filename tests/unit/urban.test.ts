import { describe, expect, it } from 'vitest';
import { selfApproachOk, START_DISTANCE } from '@/game/stage/Centreline';
import { parseSaveFile, SAVE_VERSION } from '@/game/save/SaveFile';
import { REGION_CYCLE, REGIONS } from '@/game/stage/regions';
import { createRoadHit } from '@/game/stage/RoadPath';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { ringLaneRadius, ringOuterRadius, ringSweep } from '@/game/stage/Roundabout';
import { scatterScenery } from '@/game/stage/SceneryScatter';
import { generateStage, stageHasTown, stageRegion } from '@/game/stage/StageGenerator';
import { createStageWorld } from '@/game/stage/StageWorld';
import { TerrainField } from '@/game/stage/TerrainField';
import { KERB_LIFT, townObstacles, townProps } from '@/game/stage/Town';
import { junctionReach } from '@/game/stage/TownJunctions';
import { MEDIAN_HALF, medianLift } from '@/game/stage/Median';
import { CITY_STUB_LENGTH, JUNCTION_HOLD, LANE_TAPER } from '@/game/stage/UrbanGenerator';
import { RAIL_LIFT, TRAM_BED_HALF, TRAM_GAUGE, tramLift } from '@/game/stage/Tram';
import { planUrban } from '@/game/stage/UrbanPlan';

/** The first city of the cycle, and a later one on a higher difficulty loop. */
const URBAN_INDEX = 6;
const LATE_URBAN_INDEX = 24;
const SEEDS = [1, 2, 3, 4, 5, 6];
const URBAN = REGIONS.urban.urban!;

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
  it('has three cities in eighteen stages, none where a circuit lands, none with a village of its own', () => {
    expect(REGION_CYCLE).toHaveLength(18);
    expect(REGION_CYCLE.filter((r) => r === 'urban')).toHaveLength(3);
    for (let i = 1; i < 18; i += 2) expect(REGION_CYCLE[i]).not.toBe('urban');
    expect(stageRegion(URBAN_INDEX).region).toBe('urban');
    expect(stageRegion(LATE_URBAN_INDEX).region).toBe('urban');
    for (let i = 0; i < 60; i++)
      if (stageRegion(i).region === 'urban') expect(stageHasTown(i)).toBe(false);
  });

  it('is deterministic', () => {
    const a = generateStage(3, URBAN_INDEX);
    const b = generateStage(3, URBAN_INDEX);
    expect(Array.from(a.path.xs)).toEqual(Array.from(b.path.xs));
    expect(a.town!.buildings).toEqual(b.town!.buildings);
    expect(a.town!.trams).toEqual(b.town!.trams);
  });
});

describe('Urban stages', () => {
  it('are a tarmac city from the start line to the finish, with streets of two to four lanes', () => {
    for (const seed of SEEDS) {
      const stage = fieldFor(seed).stage;
      const town = stage.town!;
      expect(stage.region).toBe('urban');
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

  it('hold one width along every street and drop lanes before a narrower junction, never inside it', () => {
    const hit = createRoadHit();
    for (const seed of SEEDS) {
      const stage = fieldFor(seed).stage;
      // A street long enough to clear the lane drops at both ends holds its own width in the middle.
      for (const st of stage.town!.streets.filter((x) => x.route)) {
        const len = Math.hypot(st.x1 - st.x0, st.z1 - st.z0);
        if (len < 2 * (LANE_TAPER + 40)) continue;
        stage.path.nearest((st.x0 + st.x1) / 2, (st.z0 + st.z1) / 2, 5, hit);
        expect(halfWidthAt(stage, hit.along)).toBeCloseTo(st.halfWidth, 2);
      }
      // A junction corner is one width from kerb to kerb: both route arms agree, the ribbon holds
      // that width through the junction's reach and a margin, and only widens beyond, smoothly.
      for (const j of stage.town!.junctions) {
        const inArm = j.arms.find((a) => a.role === 'in')!;
        const outArm = j.arms.find((a) => a.role === 'out')!;
        expect(inArm.halfWidth).toBe(outArm.halfWidth);
        const turn = Math.atan2(
          Math.sin(outArm.heading - inArm.heading - Math.PI),
          Math.cos(outArm.heading - inArm.heading - Math.PI),
        );
        if (Math.abs(turn) < Math.PI / 4) continue;
        stage.path.nearest(j.x, j.z, 60, hit);
        const apex = hit.along;
        const hold = junctionReach(j) + JUNCTION_HOLD;
        for (const sign of [-1, 1]) {
          let prev = inArm.halfWidth;
          for (let d = 0; d <= hold + LANE_TAPER + 2; d += 1) {
            const hw = halfWidthAt(stage, apex + sign * d);
            if (d <= hold - 0.5)
              expect(hw, `${seed} apex ${apex.toFixed(0)}`).toBeCloseTo(inArm.halfWidth, 1);
            // Never a step: at most a lane's change over ten metres (a neighbouring corner's own
            // drop may begin inside this window, so the width need not rise all the way).
            expect(Math.abs(hw - prev)).toBeLessThan(0.4);
            prev = hw;
          }
        }
      }
    }
  });

  it('run their side streets far from the route and lay a kerbed green median down every boulevard', () => {
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      const town = field.stage.town!;
      const stubs = town.streets.filter(
        (s) =>
          !s.route &&
          !town.roundabouts!.some(
            (r) =>
              Math.hypot(s.x0 - r.x, s.z0 - r.z) < ringOuterRadius(r) + 0.1 ||
              Math.hypot(s.x0 - r.x, s.z0 - r.z) < ringLaneRadius(r) + 0.1,
          ),
      );
      const lens = stubs.map((s) => Math.hypot(s.x1 - s.x0, s.z1 - s.z0));
      expect(lens.filter((l) => l >= CITY_STUB_LENGTH - 1e-6).length).toBeGreaterThan(
        lens.length / 3,
      );
      for (const l of lens) expect(l).toBeGreaterThanOrEqual(20 - 1e-6);
      // No side street's carriageway runs into the route: a closed one keeps its end building
      // off the route's pavements, an open one stops at the pavement it meets.
      const hit = createRoadHit();
      let open = 0;
      for (const st of stubs) {
        const len = Math.hypot(st.x1 - st.x0, st.z1 - st.z0);
        if (st.open) open++;
        const tee = town.junctions.find((j) => Math.hypot(j.x - st.x1, j.z - st.z1) < 1e-3);
        if (tee) {
          // A street ending in a T junction on the route: the junction has the route and this one arm.
          expect(tee.arms.filter((a) => a.role === 'blocked')).toHaveLength(1);
          continue;
        }
        const reach = st.open ? len : len + 8;
        for (let t = 30; t <= reach; t += 2) {
          const x = st.x0 + ((st.x1 - st.x0) * t) / len;
          const z = st.z0 + ((st.z1 - st.z0) * t) / len;
          if (field.stage.path.nearest(x, z, 40, hit))
            expect(hit.distance, `${seed}`).toBeGreaterThan(
              halfWidthAt(field.stage, hit.along) + (st.open ? 3 : st.halfWidth + 3),
            );
        }
        // An open street's deck meets the other road's without a step.
        if (st.open) {
          const ux = (st.x1 - st.x0) / len;
          const uz = (st.z1 - st.z0) / len;
          const a = field.deckAt(st.x1 - ux * 0.5, st.z1 - uz * 0.5);
          const b = field.deckAt(st.x1 + ux * 1.0, st.z1 + uz * 1.0);
          expect(Math.abs(a - b), `${seed}`).toBeLessThan(0.15);
        }
      }
      expect(open).toBeGreaterThan(0);
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
      // The start line and the spawn stand on plain tarmac; bushes grow along every median's grass.
      expect(medianLift(medians, field.stage.spawn.x, field.stage.spawn.z)).toBe(0);
      const onMedians = town.plantings.filter(
        (p) => p.kind === 'bush' && medianLift(medians, p.x, p.z) > KERB_LIFT * 0.9,
      );
      expect(onMedians.length).toBeGreaterThanOrEqual(medians.length);
      for (const p of onMedians) expect(p.scale).toBeLessThan(0.7);
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
        // kerb stays a circle.
        for (let d = r.from - 30; d <= r.to + 30; d += 1) {
          const s = { x: 0, z: 0, heading: 0 };
          stage.path.sample(d, s);
          const hw = halfWidthAt(stage, d);
          const toCentre =
            Math.sign((r.x - s.x) * Math.cos(s.heading) - (r.z - s.z) * Math.sin(s.heading)) || 1;
          const ex = s.x + Math.cos(s.heading) * hw * toCentre;
          const ez = s.z - Math.sin(s.heading) * hw * toCentre;
          expect(Math.hypot(ex - r.x, ez - r.z)).toBeGreaterThanOrEqual(r.islandRadius - 0.1);
        }
      }
    }
  });

  it('cross tram tracks that the wheels feel as a two centimetre ridge on each rail', () => {
    const hit = createRoadHit();
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      const stage = field.stage;
      const trams = stage.town!.trams!;
      expect(trams.length).toBeGreaterThanOrEqual(1);
      // At least one line crosses the route square on.
      const crossing = trams.find((t) => {
        const mx = (t.x0 + t.x1) / 2;
        const mz = (t.z0 + t.z1) / 2;
        if (!stage.path.nearest(mx, mz, 3, hit)) return false;
        const h = stage.path.headings[hit.index]!;
        const th = Math.atan2(t.x1 - t.x0, t.z1 - t.z0);
        return Math.abs(Math.sin(th - h)) > 0.95;
      });
      expect(crossing).toBeDefined();
      const t = crossing!;
      const mx = (t.x0 + t.x1) / 2;
      const mz = (t.z0 + t.z1) / 2;
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
        expect(Math.abs(field.roadHeightAt(d + 2) - h) / 2).toBeLessThanOrEqual(0.12 + 1e-6);
      }
      expect(hi - lo).toBeGreaterThan(6);
      const junctions = stage.town!.junctions.map((j) => {
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
      // A width changes only after a junction corner: across a kink, an avenue curve or a
      // roundabout the next street is as wide as the last, and the finish boulevard follows a
      // junction corner.
      const legs = plan.legs;
      for (let i = 0; i + 1 < legs.length; i++) {
        const leg = legs[i]!;
        const next = legs[i + 1]!;
        if (leg.kind === 'straight' && Math.abs(leg.turn) >= Math.PI / 4) continue;
        if (leg.roundabout || next.roundabout) continue;
        expect(next.halfWidth, `${seed} leg ${i}`).toBe(leg.halfWidth);
      }
      const last = legs[legs.length - 1]!;
      expect(last.halfWidth).toBe(URBAN.lanes.four);
      expect(last.length).toBeGreaterThanOrEqual(300);
    }
  });
});

describe('save migration', () => {
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
    expect(Object.keys(save.records)).toEqual(['2']);
  });
});
