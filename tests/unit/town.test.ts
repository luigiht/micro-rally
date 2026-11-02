import { describe, expect, it } from 'vitest';
import { createRoadHit } from '@/game/stage/RoadPath';
import {
  FORCED_STUB_MARGIN,
  MIN_STUB_LENGTH,
  streetGround,
  STUB_LENGTH,
} from '@/game/stage/TownSideStreets';
import { generateStage, stageBrief, type StageDef } from '@/game/stage/StageGenerator';
import { markerDistances } from '@/game/stage/RoadMarkers';
import { propObstacles, scatterScenery } from '@/game/stage/SceneryScatter';
import { ROAD_BED_DROP, ROAD_LIFT, TerrainField } from '@/game/stage/TerrainField';
import {
  buildingBaseHeight,
  buildingCorners,
  FRONT_SETBACK,
  KERB_LIFT,
  onTownStreet,
  plateauDistance,
  streetDistance,
  townBlocks,
  townObstacles,
  townProps,
  type TownDef,
  JUNCTION_REACH,
} from '@/game/stage/Town';
import { apart } from '@/game/stage/TownTerraces';
import { hasTown, NARROW_HALF_WIDTH } from '@/game/stage/TownPlan';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { createStageWorld } from '@/game/stage/StageWorld';
import openRoad from './fixtures/openRoad.json';

/** A synthetic town laid on the route of a generated stage (index 0, never a real town) around distance `at`, with one blocked side street. */
function withTown(seed: number, index: number, at: number): { stage: StageDef; town: TownDef } {
  const stage = generateStage(seed, index);
  const s = { x: 0, z: 0, heading: 0 };
  stage.path.sample(at, s);
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const lx = Math.cos(s.heading);
  const lz = -Math.sin(s.heading);
  const town: TownDef = {
    x: s.x,
    z: s.z,
    heading: s.heading,
    // Wide enough that the approach ramps finish before the route interval starts.
    halfU: 170,
    halfV: 90,
    from: at - 80,
    to: at + 80,
    streets: [
      // A side street leaving the route to the left at the town centre, 30 m long.
      { x0: s.x, z0: s.z, x1: s.x + lx * 30, z1: s.z + lz * 30, halfWidth: 4, route: false },
    ],
    buildings: [
      {
        style: 'shop',
        x: s.x + lx * 12,
        z: s.z + lz * 12,
        yaw: s.heading,
        hx: 4,
        hz: 3,
        variant: 0,
      },
    ],
    cones: [{ x: s.x + lx * 28, z: s.z + lz * 28, yaw: s.heading + Math.PI / 2, halfLength: 3.5 }],
    arrows: [],
    junctions: [],
    walls: [],
    plantings: [],
  };
  stage.town = town;
  void fx;
  void fz;
  return { stage, town };
}

describe('town plateau', () => {
  it('measures distance to the plateau rectangle in the town frame', () => {
    const town = withTown(7, 0, 600).town;
    expect(plateauDistance(town, town.x, town.z)).toBe(0);
    const lx = Math.cos(town.heading);
    const lz = -Math.sin(town.heading);
    expect(plateauDistance(town, town.x + lx * 100, town.z + lz * 100)).toBeCloseTo(10, 6);
    expect(onTownStreet(town, town.x + lx * 15, town.z + lz * 15)).toBe(true);
    expect(
      onTownStreet(
        town,
        town.x + lx * 15 + Math.sin(town.heading) * 6,
        town.z + lz * 15 + Math.cos(town.heading) * 6,
      ),
    ).toBe(false);
  });

  it('tames the hills under the town instead of flattening them', () => {
    for (const seed of [3, 11, 27]) {
      const { stage, town } = withTown(seed, 0, 700);
      const field = new TerrainField(stage);
      const lx = Math.cos(town.heading);
      const lz = -Math.sin(town.heading);
      // Inside the footprint the ground keeps a share of the hills' relief around the town's reference height.
      let relief = 0;
      for (let v = -60; v <= 60; v += 20) {
        const x = town.x + lx * v;
        const z = town.z + lz * v;
        const g = field.groundHeight(x, z) - field.townY;
        const h = field.baseHeight(x, z) - field.townY;
        expect(Math.abs(g), `${seed}@${v}`).toBeLessThanOrEqual(
          field.townRelief * Math.abs(h) + 1e-6,
        );
        relief = Math.max(relief, Math.abs(g));
      }
      expect(relief).toBeGreaterThan(0);
      // The hills take over again well beyond the blend.
      const far = { x: town.x - lx * 200, z: town.z - lz * 200 };
      expect(field.groundHeight(far.x, far.z)).toBeCloseTo(field.baseHeight(far.x, far.z), 6);
    }
  });
  it('keeps the route trench and verge rules inside the town and still limits the grade', () => {
    const { stage, town } = withTown(5, 0, 650);
    const field = new TerrainField(stage);
    const s = { x: 0, z: 0, heading: 0 };
    const bed = { height: 0, roadBlend: 0, roadDistance: 0 };
    for (let d = town.from + 10; d <= town.to - 10; d += 7) {
      // Where a side street leaves the route its verge becomes the street, so skip the junction itself.
      if (Math.abs(d - 650) < 12) continue;
      stage.path.sample(d, s);
      const road = field.roadHeightAt(d);
      field.sample(s.x, s.z, bed);
      expect(bed.height).toBeLessThanOrEqual(road - ROAD_BED_DROP + 0.03);
      const off = stage.halfWidth + 2;
      field.sample(s.x + Math.cos(s.heading) * off, s.z - Math.sin(s.heading) * off, bed);
      expect(Math.abs(bed.height - (road + ROAD_LIFT))).toBeLessThan(0.08);
    }
    for (let d = 2; d < stage.path.length; d += 2)
      expect(Math.abs(field.roadHeightAt(d) - field.roadHeightAt(d - 2))).toBeLessThanOrEqual(0.25);
  });

  it('cuts side streets into the slope, level with the route where they meet it', () => {
    const { stage, town } = withTown(9, 0, 600);
    const field = new TerrainField(stage);
    const lx = Math.cos(town.heading);
    const lz = -Math.sin(town.heading);
    const junction = field.heightAt(town.x, town.z);
    expect(field.heightAt(town.x + lx * 1, town.z + lz * 1)).toBeCloseTo(junction, 1);
    // Out along the stub the deck follows the ground, gently.
    const far = field.heightAt(town.x + lx * 25, town.z + lz * 25);
    expect(Math.abs(far - junction)).toBeLessThanOrEqual(25 * 0.08 + ROAD_LIFT);
    expect(field.surfaceAt(town.x + lx * 20, town.z + lz * 20)).toBe('tarmac');
    // On the route inside the town the surface is paved too, whatever the stage is made of.
    expect(field.surfaceAt(town.x, town.z)).toBe('tarmac');
    // Off every street the ground is the region's off-road surface.
    expect(field.surfaceAt(town.x + lx * 45, town.z + lz * 45)).not.toBe('tarmac');
  });
});

describe('town scenery and colliders', () => {
  it('keeps wild scenery off the streets and buildings but lets it fill the rest of the village', () => {
    const { stage, town } = withTown(99, 0, 700);
    const field = new TerrainField(stage);
    const props = scatterScenery(field);
    expect(props.length).toBeGreaterThan(200);
    const wild = new Set(['tree', 'broadleaf', 'bush', 'rock']);
    const inside = props.filter((p) => wild.has(p.kind) && plateauDistance(town, p.x, p.z) === 0);
    expect(inside.length).toBeGreaterThan(5);
    expect(inside.filter((p) => townBlocks(town, p.x, p.z))).toEqual([]);
    // The town's own props are there instead.
    expect(props.some((p) => p.kind === 'shop')).toBe(true);
    expect(props.filter((p) => p.kind === 'cone').length).toBeGreaterThanOrEqual(4);
    const nearHouses = props.filter(
      (p) => p.kind === 'house' && plateauDistance(town, p.x, p.z) < 40,
    );
    expect(nearHouses).toEqual([]);
  });

  it('turns buildings and garden walls into oriented box colliders; cones only mark the street', () => {
    const { stage, town } = withTown(99, 0, 700);
    const boxes = townObstacles(town);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toMatchObject({ hx: 4, hz: 3, yaw: town.heading });
    const field = new TerrainField(stage);
    const cones = townProps(town, field).filter((p) => p.kind === 'cone');
    expect(cones.length).toBeGreaterThanOrEqual(4);
    expect(propObstacles(cones)).toEqual([]);
  });
});

const b0Kind = (town: TownDef) => town.buildings[0]!.style;

const GAME_SEEDS = new WeakMap<StageDef, number>();
const seedOf = (stage: StageDef) => GAME_SEEDS.get(stage)!;

/** Generated stages at index 1..3 for game seeds 1..60 that carry a town. */
function townStages(): StageDef[] {
  const out: StageDef[] = [];
  for (let seed = 1; seed <= 60; seed++) {
    const stage = generateStage(seed, 2);
    expect(stage.town).toBeDefined();
    GAME_SEEDS.set(stage, seed);
    out.push(stage);
  }
  return out;
}

describe('town generator', () => {
  it('puts a town on every third stage and nowhere else, whatever the game seed', () => {
    for (let index = 0; index < 18; index++) expect(hasTown(index)).toBe(index % 3 === 2);
    for (let seed = 1; seed <= 20; seed++) {
      expect(generateStage(seed, 0).town).toBeUndefined();
      expect(generateStage(seed, 1).town).toBeUndefined();
      expect(generateStage(seed, 2).town).toBeDefined();
    }
    for (const seed of [3, 7]) {
      expect(generateStage(seed, 5).town).toBeDefined();
      expect(generateStage(seed, 6).town).toBeUndefined();
    }
    // The brief knows too, and charges the town against par.
    for (let seed = 1; seed <= 30; seed++)
      for (const index of [1, 2]) {
        const stage = generateStage(seed, index);
        expect(stage.parTime).toBe(stageBrief(seed, index).parTime);
        if (stage.town)
          expect(stageBrief(seed, index).parTime).toBeGreaterThan(stage.length / 30 + 11);
      }
  });

  it('leaves open-road stages byte-identical to the pre-town generator', () => {
    for (const [key, fix] of Object.entries(openRoad)) {
      const [seed, index] = key.split('/').map(Number) as [number, number];
      const stage = generateStage(seed, index);
      expect(stage.town).toBeUndefined();
      expect(stage.path.length).toBeCloseTo(fix.length, 9);
      fix.xs.forEach((x, i) => expect(stage.path.xs[i]).toBeCloseTo(x, 9));
      fix.zs.forEach((z, i) => expect(stage.path.zs[i]).toBeCloseTo(z, 9));
    }
  });

  it('threads the route through town with sharp corners, tight curves and narrow streets', () => {
    const stages = townStages();
    expect(stages.length).toBeGreaterThan(30);
    const s = { x: 0, z: 0, heading: 0 };
    const hit = createRoadHit();
    let curved = 0;
    let narrow = 0;
    for (const stage of stages) {
      const town = stage.town!;
      const legs = town.streets.filter((st) => st.route);
      const stubs = town.streets.filter((st) => !st.route);
      const len = (st: (typeof legs)[number]) => Math.hypot(st.x1 - st.x0, st.z1 - st.z0);
      const heading = (st: (typeof legs)[number]) => Math.atan2(st.x1 - st.x0, st.z1 - st.z0);
      expect(legs.length).toBeGreaterThanOrEqual(3);
      // Every bend in the route, corners included, is laid as chords: no joint turns more than ~25°,
      // and the spline never kinks (the old sharp corners had 4.5 m apex radii that folded the ribbon).
      for (let i = 1; i < legs.length; i++) {
        const d = heading(legs[i]!) - heading(legs[i - 1]!);
        expect(Math.abs(Math.atan2(Math.sin(d), Math.cos(d))), `${stage.seed}`).toBeLessThan(0.45);
      }
      let worstStep = 0;
      for (let i = Math.ceil(town.from / 2) + 1; i <= Math.floor(town.to / 2); i++) {
        const d = stage.path.headings[i]! - stage.path.headings[i - 1]!;
        worstStep = Math.max(worstStep, Math.abs(Math.atan2(Math.sin(d), Math.cos(d))));
      }
      expect(worstStep, `${stage.seed}`).toBeLessThan(0.3);
      const corners = town.arrows.length;
      expect(corners).toBeGreaterThanOrEqual(1);
      // A crossroads on a long entry or exit leg adds a stub each side.
      const crossroads = (stubs.length - corners * 2) / 2;
      expect([0, 1, 2]).toContain(crossroads);
      expect(town.cones.length).toBe(stubs.length);
      expect(town.buildings.length).toBeGreaterThan(8);
      expect(town.from).toBeGreaterThan(stage.startDistance + 150);
      expect(town.to).toBeLessThan(stage.startDistance + stage.length - 100);
      if (legs.some((st) => len(st) < 15)) curved++;
      if (legs.some((st) => st.halfWidth < 4)) narrow++;
      if (stage.widths)
        expect(Math.min(...stage.widths)).toBeGreaterThanOrEqual(NARROW_HALF_WIDTH - 1e-9);
      // Every leg lies on the centreline.
      for (const leg of legs) {
        expect(stage.path.nearest(leg.x0, leg.z0, 1.5, hit), `${stage.seed}`).toBe(true);
        expect(stage.path.nearest(leg.x1, leg.z1, 1.5, hit)).toBe(true);
      }
      // The route leaves roughly on the heading it arrived with (measured on the straight legs).
      stage.path.sample(town.from - 10, s);
      const inHeading = s.heading;
      stage.path.sample(town.to - 30, s);
      expect(
        Math.abs(Math.atan2(Math.sin(s.heading - inHeading), Math.cos(s.heading - inHeading))),
      ).toBeLessThan(0.5);
    }
    expect(curved).toBeGreaterThan(5);
    expect(narrow).toBeGreaterThan(5);
  });

  it('keeps buildings off every street and apart, cones across the stubs, greenery clear, posts and gates out of town', () => {
    for (const stage of townStages()) {
      const town = stage.town!;
      const problems: string[] = [];
      // Behind the pavement of every street: the route's actual (tapered) edge, each side street's nominal one.
      const hit = createRoadHit();
      const intrudes = (x: number, z: number, slack: number) => {
        if (
          stage.path.nearest(x, z, 20, hit) &&
          hit.distance < halfWidthAt(stage, hit.along) + FRONT_SETBACK - slack
        )
          return true;
        return town.streets.some(
          (st) => !st.route && streetDistance(st, x, z) < st.halfWidth + FRONT_SETBACK - slack,
        );
      };
      for (const b of town.buildings) {
        for (const [x, z] of buildingCorners(b))
          if (intrudes(x, z, 0.06)) problems.push(`building in street ${stage.seed}`);
        if (plateauDistance(town, b.x, b.z) !== 0)
          problems.push(`building off plateau ${stage.seed}`);
      }
      // Terraces stand a party wall apart, never overlapping.
      for (let i = 0; i < town.buildings.length; i++)
        for (let j = i + 1; j < town.buildings.length; j++)
          if (!apart(town.buildings[i]!, town.buildings[j]!, 0.3))
            problems.push(`buildings overlap ${stage.seed}`);
      // Garden walls stay behind the pavements; every junction has four arms.
      for (const w of town.walls)
        if (intrudes(w.x0, w.z0, 0.15) || intrudes(w.x1, w.z1, 0.15))
          problems.push(`wall in street ${stage.seed}`);
      expect(town.walls.length).toBeGreaterThan(4);
      const stubs = town.streets.filter((st) => !st.route).length;
      expect(town.junctions.length).toBe(stubs / 2);
      for (const j of town.junctions) expect(j.arms).toHaveLength(4);
      for (const st of town.streets)
        if (plateauDistance(town, st.x0, st.z0) !== 0 || plateauDistance(town, st.x1, st.z1) !== 0)
          problems.push(`street off plateau ${stage.seed}`);
      for (const r of town.cones) {
        const stub = town.streets.find((st) => !st.route && streetDistance(st, r.x, r.z) < 1e-6);
        if (!stub) problems.push(`cones off their stub ${stage.seed}`);
        if (
          Math.hypot(r.x - stub!.x0, r.z - stub!.z0) >
          Math.hypot(stub!.x1 - stub!.x0, stub!.z1 - stub!.z0) - 3
        )
          problems.push(`cones past stub ${stage.seed}`);
        if (r.halfLength > stub!.halfWidth) problems.push(`cones on the pavement ${stage.seed}`);
      }
      // Corner greenery stands off every pavement and outside every building.
      expect(town.plantings.length).toBeGreaterThan(0);
      for (const p of town.plantings) {
        if (intrudes(p.x, p.z, -0.5)) problems.push(`planting in street ${stage.seed}`);
        for (const b of town.buildings)
          if (Math.hypot(b.x - p.x, b.z - p.z) < Math.min(b.hx, b.hz))
            problems.push(`planting in building ${stage.seed}`);
      }
      for (const g of stage.gates)
        if (g.kind === 'checkpoint' && g.distance > town.from - 39 && g.distance < town.to + 39)
          problems.push(`gate in town ${stage.seed}`);
      for (let k = 1; k < stage.gates.length; k++)
        if (stage.gates[k]!.distance <= stage.gates[k - 1]!.distance)
          problems.push(`gate order ${stage.seed}`);
      for (const d of markerDistances(stage.path.length, stage.gates, [[town.from, town.to]]))
        if (d >= town.from && d <= town.to) problems.push(`post in town ${stage.seed}`);
      expect(problems).toEqual([]);
    }
  });

  it('keeps side streets of different junctions apart, cutting the later one down, never below the minimum', () => {
    let shortened = 0;
    for (const stage of townStages()) {
      const town = stage.town!;
      const stubs = town.streets.filter((st) => !st.route);
      const problems: string[] = [];
      for (const st of stubs) {
        const len = Math.hypot(st.x1 - st.x0, st.z1 - st.z0);
        if (len < STUB_LENGTH - 1e-6) shortened++;
        // A corner's street forced below the minimum still keeps its junction's cut plus the margin.
        if (
          len < MIN_STUB_LENGTH - 1e-6 &&
          len < st.halfWidth + JUNCTION_REACH + FORCED_STUB_MARGIN - 1e-6
        )
          problems.push(`stub ${len.toFixed(1)} m`);
      }
      // Two streets with different mouths: their ground (pavements and the one across each end) stays
      // apart; only corner streets forced below the minimum may still touch.
      for (let i = 0; i < stubs.length; i++)
        for (let k = i + 1; k < stubs.length; k++) {
          const a = stubs[i]!;
          const b = stubs[k]!;
          if (Math.hypot(a.x0 - b.x0, a.z0 - b.z0) < 1e-6) continue;
          const la = Math.hypot(a.x1 - a.x0, a.z1 - a.z0);
          const lb = Math.hypot(b.x1 - b.x0, b.z1 - b.z0);
          const forced = la < MIN_STUB_LENGTH - 1e-6 || lb < MIN_STUB_LENGTH - 1e-6;
          if (!apart(streetGround(a), streetGround(b), forced ? 0 : 0.4))
            problems.push(`stubs ${i},${k} too close (${la.toFixed(1)} m, ${lb.toFixed(1)} m)`);
        }
      expect(problems, `${seedOf(stage)}/${stage.index}`).toEqual([]);
    }
    expect(shortened).toBeGreaterThan(0);
  });

  it('keeps the generator invariants: no self-approach, grade-limited streets, buildings on the ground', () => {
    for (const stage of townStages().slice(0, 12)) {
      const p = stage.path;
      let minSep = Infinity;
      for (let i = 0; i < p.count; i += 4)
        for (let j = i + 100; j < p.count; j += 4)
          minSep = Math.min(minSep, Math.hypot(p.xs[i]! - p.xs[j]!, p.zs[i]! - p.zs[j]!));
      expect(minSep, `${stage.seed}/${stage.index}`).toBeGreaterThan(50);
      const field = new TerrainField(stage);
      const town = stage.town!;
      const problems: string[] = [];
      for (let d = 2; d < p.length; d += 2)
        if (Math.abs(field.roadHeightAt(d) - field.roadHeightAt(d - 2)) > 0.25)
          problems.push(`grade at ${d}`);
      // Side streets follow the route's deck through the junction, then climb gently: no step anywhere along them.
      for (const st of town.streets) {
        if (st.route) continue;
        const dx = (st.x1 - st.x0) / 32;
        const dz = (st.z1 - st.z0) / 32;
        let prev = field.heightAt(st.x0, st.z0);
        for (let m = 1; m <= 32; m++) {
          const h = field.heightAt(st.x0 + dx * m, st.z0 + dz * m);
          if (Math.abs(h - prev) > 0.2)
            problems.push(`stub step ${stage.seed} at ${m}: ${(h - prev).toFixed(2)}`);
          prev = h;
        }
      }
      // Every building stands on a terrace levelled with the pavement at its door: the deck under
      // the back corners meets the base height exactly; the front corners sit a kerb above the deck,
      // give or take the fall of a steep street along a wide front (up to 12.5 % over a 10 m shop),
      // which the 1.75 m foundation absorbs.
      const props = scatterScenery(field);
      for (const b of town.buildings) {
        const base = buildingBaseHeight(b, field);
        const [br, bl, fr, fl] = buildingCorners(b);
        for (const [x, z] of [br!, bl!])
          if (Math.abs(field.deckAt(x, z) - base) > 0.03)
            problems.push(`terrace ${stage.seed}: ${(field.deckAt(x, z) - base).toFixed(2)}`);
        for (const [x, z] of [fr!, fl!])
          if (Math.abs(field.deckAt(x, z) + KERB_LIFT - base) > 0.65)
            problems.push(`door step ${stage.seed}: ${(field.deckAt(x, z) - base).toFixed(2)}`);
      }
      expect(props.filter((p) => p.kind === b0Kind(town)).length).toBeGreaterThan(0);
      expect(problems, `${stage.seed}/${stage.index}`).toEqual([]);
    }
  });

  it('keeps the route itself clear: both car circles miss every collider all the way through town', () => {
    for (const stage of townStages().slice(0, 20)) {
      const world = createStageWorld(seedOf(stage), stage.index);
      const town = world.stage.town!;
      const { obstacles, boxes } = world.obstacles;
      const s = { x: 0, z: 0, heading: 0 };
      const problems: string[] = [];
      for (let d = town.from - 60; d <= town.to + 60; d += 2) {
        world.stage.path.sample(d, s);
        for (const c of [-1, 1]) {
          const cx = s.x + Math.sin(s.heading) * c;
          const cz = s.z + Math.cos(s.heading) * c;
          for (const o of obstacles)
            if (Math.hypot(cx - o.x, cz - o.z) < o.r + 0.9 + 0.3) problems.push(`circle at ${d}`);
          for (const b of boxes) {
            const dx = cx - b.x;
            const dz = cz - b.z;
            const lx = dx * Math.cos(b.yaw) - dz * Math.sin(b.yaw);
            const lz = dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw);
            const ex = Math.max(0, Math.abs(lx) - b.hx);
            const ez = Math.max(0, Math.abs(lz) - b.hz);
            if (Math.hypot(ex, ez) < 0.9 + 0.3) problems.push(`box at ${d}`);
          }
        }
      }
      expect(problems, `${world.gameSeed}/${stage.index}`).toEqual([]);
    }
  });
});
