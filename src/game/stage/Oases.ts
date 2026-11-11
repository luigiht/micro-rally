import { hashSeed, mulberry32 } from '../rng';
import { STAGE_TYPES } from './regions';
import { createRoadHit, type RoadSample } from './RoadPath';
import type { Prop } from './SceneryScatter';
import type { TerrainField, TerrainPad } from './TerrainField';
import { plateauDistance } from './Town';

/**
 * Oases on a dune stage: hollows flattened into the sand off the road, each
 * with a pool of water, a ring of date palms and some scrub. Planned from the
 * stage seed along the road, so the main thread and the terrain worker agree.
 */
export interface Oasis {
  x: number;
  z: number;
  /** Floor of the hollow. */
  y: number;
  radius: number;
}

/** The water stands this far above the hollow's floor; the floor sits this far below the dunes around it. */
export const OASIS_WATER_ABOVE = 0.45;
export const OASIS_BOWL = 1.4;
/** The hollow blends back to the dunes over this much beyond its radius. */
export const OASIS_BLEND = 9;
/** An oasis keeps this far from every part of the road (beyond its half width), a town, and the next oasis. */
const ROAD_CLEARANCE = 22;
const OFFSET_MIN = 30;
const OFFSET_SPAN = 35;
const SPACING_MIN = 80;
const TOWN_CLEARANCE = 60;
const FIRST_AT = 180;
const END_MARGIN = 160;
/** A site whose rim rises and falls more than this across is too sloped for a pool. */
const RIM_SLOPE_MAX = 4;
/** Spots tried per step along the road. */
const TRIES = 5;

export function planOases(field: TerrainField): Oasis[] {
  const stage = field.stage;
  const def = STAGE_TYPES[stage.stageType].oases;
  if (!def) return [];
  const rand = mulberry32(hashSeed(stage.seed, 'oases'));
  const path = stage.path;
  const hit = createRoadHit();
  const s: RoadSample = { x: 0, z: 0, heading: 0 };
  const out: Oasis[] = [];
  for (
    let d = FIRST_AT + rand() * def.every;
    d < path.length - END_MARGIN;
    d += def.every * (0.7 + rand() * 0.6)
  ) {
    path.sample(d, s);
    // Several spots either side are tried; the first level one, clear of the road, a town and other oases, is taken.
    for (let attempt = 0; attempt < TRIES; attempt++) {
      const side = rand() < 0.5 ? -1 : 1;
      const off = (stage.halfWidth + OFFSET_MIN + rand() * OFFSET_SPAN) * side;
      const x = s.x + Math.cos(s.heading) * off;
      const z = s.z - Math.sin(s.heading) * off;
      const radius = def.radius * (0.8 + rand() * 0.4);
      if (path.nearest(x, z, stage.halfWidth + ROAD_CLEARANCE, hit)) continue;
      if (stage.town && plateauDistance(stage.town, x, z) < TOWN_CLEARANCE) continue;
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < SPACING_MIN)) continue;
      // The floor sits under the lowest point of the rim, so the water stands below the sand all round;
      // a site that slopes more than a bowl's depth across is left alone.
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = 0; k < 8; k++) {
        const a = (Math.PI * 2 * k) / 8;
        const ring = radius + OASIS_BLEND / 2;
        const h = field.baseHeight(x + Math.cos(a) * ring, z + Math.sin(a) * ring);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
      if (hi - lo > RIM_SLOPE_MAX) continue;
      out.push({ x, z, y: lo - OASIS_BOWL, radius });
      break;
    }
  }
  return out;
}

/** The level pads that sink each hollow into the dunes. */
export function oasisPads(oases: readonly Oasis[]): TerrainPad[] {
  return oases.map((o) => ({ x: o.x, z: o.z, y: o.y, radius: o.radius, blend: OASIS_BLEND }));
}

/** Date palms round each pool's rim and scrub at the water's edge; placed once the pads are set, so they stand on the hollow's slope. */
export function oasisProps(oases: readonly Oasis[], field: TerrainField): Prop[] {
  const stage = field.stage;
  const def = STAGE_TYPES[stage.stageType].oases;
  if (!def) return [];
  const rand = mulberry32(hashSeed(stage.seed, 'palms'));
  const out: Prop[] = [];
  for (const o of oases) {
    const n = def.palms + Math.floor(rand() * 3) - 1;
    const start = rand() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a = start + (Math.PI * 2 * k) / n + (rand() - 0.5) * 0.5;
      const r = o.radius + 1.5 + rand() * 4.5;
      const x = o.x + Math.cos(a) * r;
      const z = o.z + Math.sin(a) * r;
      out.push({
        kind: 'palm',
        x,
        y: field.heightAt(x, z),
        z,
        scale: 0.85 + rand() * 0.45,
        rotation: rand() * Math.PI * 2,
        variant: rand() < 0.5 ? 0 : 1,
      });
    }
    const bushes = 4 + Math.floor(rand() * 3);
    for (let k = 0; k < bushes; k++) {
      const a = rand() * Math.PI * 2;
      const r = o.radius + 0.6 + rand() * 3;
      const x = o.x + Math.cos(a) * r;
      const z = o.z + Math.sin(a) * r;
      out.push({
        kind: 'bush',
        x,
        y: field.heightAt(x, z),
        z,
        scale: 0.7 + rand() * 0.6,
        rotation: rand() * Math.PI * 2,
        variant: rand() < 0.5 ? 0 : 1,
      });
    }
  }
  return out;
}

/** True inside a pool or on its rim, where the wild scatter must not grow. */
export function inOasis(oases: readonly Oasis[], x: number, z: number): boolean {
  return oases.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + 1.5);
}
