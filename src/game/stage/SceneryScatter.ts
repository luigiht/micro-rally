import { circuitTrackside, grandstandSpot, outermostBarrier } from './CircuitTrackside';
import { hashSeed, mulberry32 } from '../rng';
import type { Obstacle } from '../vehicle/Collisions';
import { inOasis, oasisPads, oasisProps, planOases } from './Oases';
import { parkedCars, parkingStretches } from './ParkingBays';
import { streetFurniture } from './StreetFurniture';
import { REGIONS } from './regions';
import { createRoadHit, type RoadSample } from './RoadPath';
import { ISLAND_PAD_BLEND } from './Roundabout';
import { ROAD_LIFT, type TerrainField } from './TerrainField';
import {
  buildingBaseHeight,
  KERB_LIFT,
  PAVEMENT_WIDTH,
  plateauDistance,
  TERRACE_BLEND,
  TERRACE_FRONT,
  TERRACE_MARGIN,
  townBlocks,
  townProps,
} from './Town';

export type PropKind =
  | 'tree'
  | 'broadleaf'
  | 'palm'
  | 'bush'
  | 'rock'
  | 'house'
  | 'townhouse'
  | 'shop'
  | 'tower'
  | 'hall'
  | 'block'
  | 'office'
  | 'tenement'
  | 'arcade'
  | 'cone'
  | 'arrowLeft'
  | 'arrowRight'
  | 'lamp'
  | 'parkedCar'
  | 'trafficLight'
  | 'bench'
  | 'bin'
  | 'hydrant'
  | 'bollard'
  | 'treePit'
  | 'manhole';

export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  variant: number;
  /** Tilt about the prop's own x axis after the heading, for things that lie along a slope (parked cars). */
  pitch?: number;
}

const STEP = 4;
const MIN_CLEARANCE = 3;
const MEAN_OFFSET = 28;
const MAX_OFFSET = 160;

/** Houses: never near the road, spread out, and only on fairly level ground. */
const HOUSE_STEP = 10;
const HOUSE_CLEARANCE = 14;
const HOUSE_MEAN_OFFSET = 30;
const HOUSE_MAX_OFFSET = 120;
const HOUSE_SPACING = 24;
/** Max height difference across the footprint; the foundation (1.25 m deep) hides it on the downhill side. */
const HOUSE_MAX_RISE = 1.0;
/** Half extents of the slab (6.6 × 5.1 m) at scale 1, used to level the house and clear its footprint. */
const HOUSE_HALF_X = 3.3;
const HOUSE_HALF_Z = 2.55;
/** The slab top (door sill and step) sits this far above the house origin; the pad is levelled here. */
export const HOUSE_SLAB_TOP = 0.15;
/** Level pad radius around a house (× scale); the terrain blends back to the hills beyond it. */
const HOUSE_PAD_RADIUS = 4.6;
/** Other props this close to a house centre (× scale) are removed. */
const HOUSE_CLEAR_RADIUS = 5;
/** House footprint as three circles along its long (local x) axis, in metres at scale 1. */
export const HOUSE_COLLIDER = { radius: 2.4, spread: 1.8 } as const;

/** A roundabout island's terrain pad lies this far under its kerb-high meshes. */
const ISLAND_PAD_BELOW = 0.03;

/** Farmhouses stay this far outside a town's footprint; wild scenery only keeps off its streets, buildings and walls. */
const TOWN_HOUSE_CLEARANCE = 40;

/** Canopy radius (× scale) used to keep trees from growing into each other. */
export const CANOPY_RADIUS: Readonly<Partial<Record<PropKind, number>>> = {
  tree: 1.4,
  broadleaf: 2.2,
  palm: 1.8,
};
const CANOPY_CELL = 6;

/** Spatial hash of placed canopies so each new tree checks only its neighbourhood. */
class CanopyGrid {
  private readonly cells = new Map<number, Prop[]>();

  private key(cx: number, cz: number): number {
    return (cx + 0x8000) * 0x10000 + (cz + 0x8000);
  }

  add(p: Prop): void {
    const k = this.key(Math.floor(p.x / CANOPY_CELL), Math.floor(p.z / CANOPY_CELL));
    const list = this.cells.get(k);
    if (list) list.push(p);
    else this.cells.set(k, [p]);
  }

  /** True when a canopy of `radius` at (x, z) would overlap one already placed. */
  overlaps(x: number, z: number, radius: number): boolean {
    const cx = Math.floor(x / CANOPY_CELL);
    const cz = Math.floor(z / CANOPY_CELL);
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cz - 1; j <= cz + 1; j++) {
        const list = this.cells.get(this.key(i, j));
        if (!list) continue;
        for (const q of list) {
          const r = radius + CANOPY_RADIUS[q.kind]! * q.scale;
          if ((q.x - x) ** 2 + (q.z - z) ** 2 < r * r) return true;
        }
      }
    }
    return false;
  }
}

/** Buildings and garden walls collide as oriented boxes (see `townObstacles`); cones only mark a closed street, so of the town's own props only lamp posts get a circle. */
const COLLIDER_RADIUS: Readonly<Record<PropKind, number>> = {
  tree: 0.45,
  broadleaf: 0.4,
  palm: 0.3,
  bush: 0,
  rock: 0.85,
  house: 0,
  townhouse: 0,
  shop: 0,
  tower: 0,
  hall: 0,
  block: 0,
  office: 0,
  tenement: 0,
  arcade: 0,
  cone: 0,
  arrowLeft: 0,
  arrowRight: 0,
  lamp: 0.15,
  parkedCar: 0,
  trafficLight: 0.15,
  bench: 0.35,
  bin: 0.2,
  hydrant: 0.15,
  bollard: 0.12,
  treePit: 0,
  manhole: 0,
};
/** A parked car collides as two circles along its length (local z, nose at +z). */
export const CAR_COLLIDER = { radius: 0.95, spread: 1.1 } as const;

/** The cars parked in a city's bays, each on the deck of its street, as props. */
function cityCars(stage: TerrainField['stage'], field: TerrainField): Prop[] {
  const town = stage.town;
  const def = REGIONS[stage.region].urban;
  if (!town?.city || !def) return [];
  return parkedCars(parkingStretches(town, stage, def), stage.seed).map((c) => {
    // The car lies along the street's slope: pitched by the deck's rise from its tail to its nose.
    const nx = Math.sin(c.yaw);
    const nz = Math.cos(c.yaw);
    const half = CAR_COLLIDER.spread;
    const nose = field.deckAt(c.x + nx * half, c.z + nz * half);
    const tail = field.deckAt(c.x - nx * half, c.z - nz * half);
    return {
      kind: 'parkedCar',
      x: c.x,
      y: (nose + tail) / 2,
      z: c.z,
      scale: 1,
      rotation: c.yaw,
      variant: c.variant,
      // A positive pitch about x drops +z, so a climbing nose takes a negative pitch.
      pitch: -Math.atan2(nose - tail, 2 * half),
    };
  });
}

/** Deterministic roadside scenery along the stage. */
export function scatterScenery(field: TerrainField): Prop[] {
  // Start from the bare hills so a re-run on the same field is identical.
  field.setPads([]);
  const stage = field.stage;
  const density = REGIONS[stage.region].scenery;
  const rand = mulberry32(hashSeed(stage.seed, 'scenery'));
  const path = stage.path;
  const hit = createRoadHit();
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const props: Prop[] = [];
  const canopies = new CanopyGrid();
  const coast = field.coast;
  // On a circuit nothing stands inside the fences: props start past the outermost barrier.
  const trackside = circuitTrackside(stage);
  const clearance = trackside ? outermostBarrier(trackside) - stage.halfWidth + 4 : MIN_CLEARANCE;
  const stand = trackside ? grandstandSpot(stage, trackside) : null;
  const kinds: readonly [PropKind, number][] = [
    ['tree', density.trees],
    ['broadleaf', density.broadleaf],
    ['bush', density.bushes],
    ['rock', density.rocks],
  ];

  for (let d = 0; d < path.length; d += STEP) {
    // Slow wobble so trees clump into copses and clearings.
    const clump =
      0.35 + 1.3 * (0.5 + 0.5 * Math.sin(d * 0.011 + stage.seed * 1e-9) * Math.cos(d * 0.0047));
    for (const [kind, perHundred] of kinds) {
      const expected = ((perHundred * STEP) / 100) * (kind === 'rock' ? 1 : clump);
      let n = Math.floor(expected) + (rand() < expected % 1 ? 1 : 0);
      while (n-- > 0) {
        path.sample(d + rand() * STEP, sample);
        const side = rand() < 0.5 ? -1 : 1;
        const offset = Math.min(
          MAX_OFFSET,
          stage.halfWidth + clearance + -Math.log(1 - rand()) * MEAN_OFFSET,
        );
        const x = sample.x + Math.cos(sample.heading) * offset * side;
        const z = sample.z - Math.sin(sample.heading) * offset * side;
        const scale = kind === 'rock' || kind === 'bush' ? 0.6 + rand() * 0.8 : 0.7 + rand() * 0.8;
        const rotation = rand() * Math.PI * 2;
        const variant = rand() < 0.5 ? 0 : 1;
        // Keep every part of the road (including other bends) clear, and the town plateau.
        if (path.nearest(x, z, stage.halfWidth + clearance, hit)) continue;
        if (stand && Math.hypot(x - stand.x, z - stand.z) < stand.radius) continue;
        if (stage.town && townBlocks(stage.town, x, z)) continue;
        if (coast) {
          // Rocks anywhere above the water; scrub from the dry sand inland on anything but a cliff face;
          // trees above the beach on gentle ground that is not bare rock.
          const y = field.heightAt(x, z);
          if (kind === 'rock') {
            if (y < coast.seaLevel - 0.6) continue;
          } else if (kind === 'bush') {
            if (coast.shoreDistance(x, z) < 2 || coast.slopeAt(x, z) > 1.4) continue;
          } else if (
            y < coast.seaLevel + 3 ||
            coast.slopeAt(x, z) > 0.9 ||
            coast.rockiness(x, z) > 0.6
          )
            continue;
        }
        // Trees keep their canopies apart; a rejected spot is simply skipped.
        const canopy = CANOPY_RADIUS[kind];
        if (canopy !== undefined && canopies.overlaps(x, z, canopy * scale)) continue;
        const prop: Prop = { kind, x, y: field.heightAt(x, z), z, scale, rotation, variant };
        if (canopy !== undefined) canopies.add(prop);
        props.push(prop);
      }
    }
  }
  const houses = scatterHouses(field);
  // Oases sink their hollows into the dunes alongside the house pads; their palms come once the pads are set.
  const oases = planOases(field);
  field.oases = oases;
  // Flatten a pad under each house so the slab, door sill and step meet level ground,
  // and a terrace under each town building so it steps down the hill on level footing.
  // The pad is pulled back from the facade (local -z) so its blend stops at the pavement's edge.
  const inset = (TERRACE_FRONT + TERRACE_MARGIN) / 2;
  const terraces = (stage.town?.buildings ?? []).map((b) => ({
    x: b.x + Math.sin(b.yaw) * inset,
    z: b.z + Math.cos(b.yaw) * inset,
    y: buildingBaseHeight(b, field),
    radius: Math.hypot(b.hx, b.hz) + TERRACE_MARGIN,
    hx: b.hx + TERRACE_MARGIN,
    hz: b.hz + TERRACE_MARGIN - inset,
    yaw: b.yaw,
    blend: TERRACE_BLEND,
  }));
  // A roundabout's island stands a kerb above the ring's deck, level: the pad covers the grass core
  // inside the island's pavement band, a little under the island's own grass disc and pavement
  // meshes, so the terrain's coarse facets never show through their round edges.
  const islands = (stage.town?.roundabouts ?? []).map((r) => ({
    x: r.x,
    z: r.z,
    y: field.roadHeightAt(r.from) + ROAD_LIFT + KERB_LIFT - ISLAND_PAD_BELOW,
    radius: r.islandRadius - PAVEMENT_WIDTH - 0.4,
    blend: ISLAND_PAD_BLEND,
  }));
  field.setPads([
    ...houses.map((h) => ({
      x: h.x,
      z: h.z,
      y: h.y + HOUSE_SLAB_TOP,
      radius: HOUSE_PAD_RADIUS * h.scale,
    })),
    ...terraces,
    ...islands,
    ...oasisPads(oases),
  ]);
  // Nothing grows through a house or in a pool: drop trees, bushes and rocks inside their footprints.
  const kept = props.filter(
    (p) =>
      houses.every((h) => Math.hypot(h.x - p.x, h.z - p.z) >= HOUSE_CLEAR_RADIUS * h.scale) &&
      !inOasis(oases, p.x, p.z),
  );
  kept.push(...houses, ...oasisProps(oases, field));
  if (stage.town)
    kept.push(
      ...townProps(stage.town, field, density.broadleaf > density.trees ? 'broadleaf' : 'tree'),
      ...cityCars(stage, field),
      ...(stage.town.city ? streetFurniture(stage.town, stage, field, stage.seed) : []),
    );
  return kept;
}

/** Terrain height at the house's slab corners, rotated with it. */
function houseCornerHeights(
  field: TerrainField,
  x: number,
  z: number,
  rotation: number,
  scale: number,
): number[] {
  const ax = Math.cos(rotation);
  const az = -Math.sin(rotation);
  const bx = Math.sin(rotation);
  const bz = Math.cos(rotation);
  const hx = HOUSE_HALF_X * scale;
  const hz = HOUSE_HALF_Z * scale;
  const out: number[] = [];
  for (const [u, v] of [
    [hx, hz],
    [-hx, hz],
    [hx, -hz],
    [-hx, -hz],
  ]) {
    out.push(field.heightAt(x + ax * u! + bx * v!, z + az * u! + bz * v!));
  }
  return out;
}

/**
 * Houses: sparse, set back from every part of the road, apart from each other,
 * on fairly level ground. The origin is set so the slab top lands at the mean
 * ground height of the footprint, which `scatterScenery` then flattens into a
 * pad; the foundation covers any blend below it.
 */
function scatterHouses(field: TerrainField): Prop[] {
  const stage = field.stage;
  const perHundred = REGIONS[stage.region].scenery.houses;
  const rand = mulberry32(hashSeed(stage.seed, 'houses'));
  const path = stage.path;
  const hit = createRoadHit();
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const placed: Prop[] = [];
  const minOffset = stage.halfWidth + HOUSE_CLEARANCE;
  for (let d = 0; d < path.length; d += HOUSE_STEP) {
    const expected = (perHundred * HOUSE_STEP) / 100;
    if (rand() >= expected) continue;
    path.sample(d + rand() * HOUSE_STEP, sample);
    const side = rand() < 0.5 ? -1 : 1;
    const offset = Math.min(
      HOUSE_MAX_OFFSET,
      minOffset + -Math.log(1 - rand()) * HOUSE_MEAN_OFFSET,
    );
    const x = sample.x + Math.cos(sample.heading) * offset * side;
    const z = sample.z - Math.sin(sample.heading) * offset * side;
    const scale = 0.9 + rand() * 0.3;
    const jitter = (rand() - 0.5) * 0.8;
    const variant = rand() < 0.5 ? 0 : 1;
    if (path.nearest(x, z, minOffset, hit)) continue;
    if (stage.town && plateauDistance(stage.town, x, z) < TOWN_HOUSE_CLEARANCE) continue;
    // Face the nearest stretch of road, give or take: the door is on local -z,
    // which a Y rotation of `heading ± π/2` turns back across the verge.
    path.nearest(x, z, HOUSE_MAX_OFFSET * 2, hit);
    path.sample(hit.along, sample);
    const rotation = sample.heading + (Math.sign(hit.lateral) * Math.PI) / 2 + jitter;
    if (placed.some((h) => Math.hypot(h.x - x, h.z - z) < HOUSE_SPACING * scale)) continue;
    const corners = houseCornerHeights(field, x, z, rotation, scale);
    if (Math.max(...corners) - Math.min(...corners) > HOUSE_MAX_RISE * scale) continue;
    const ground = corners.reduce((a, b) => a + b, 0) / corners.length;
    placed.push({ kind: 'house', x, y: ground - HOUSE_SLAB_TOP, z, scale, rotation, variant });
  }
  return placed;
}

export function propObstacles(props: readonly Prop[]): Obstacle[] {
  const out: Obstacle[] = [];
  for (const p of props) {
    if (p.kind === 'house') {
      // Local +x in world space for a Y rotation (matches the mesh's rotation.y).
      const ax = Math.cos(p.rotation);
      const az = -Math.sin(p.rotation);
      const r = HOUSE_COLLIDER.radius * p.scale;
      for (const k of [-1, 0, 1]) {
        const o = HOUSE_COLLIDER.spread * p.scale * k;
        out.push({ x: p.x + ax * o, z: p.z + az * o, r });
      }
      continue;
    }
    if (p.kind === 'parkedCar') {
      const ax = Math.sin(p.rotation);
      const az = Math.cos(p.rotation);
      for (const k of [-1, 1]) {
        const o = CAR_COLLIDER.spread * k;
        out.push({ x: p.x + ax * o, z: p.z + az * o, r: CAR_COLLIDER.radius });
      }
      continue;
    }
    const r = COLLIDER_RADIUS[p.kind];
    if (r > 0) out.push({ x: p.x, z: p.z, r: r * p.scale });
  }
  return out;
}
