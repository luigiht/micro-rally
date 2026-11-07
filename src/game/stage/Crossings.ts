import type { RoadSample } from './RoadPath';
import { halfWidthAt, type RoadWidthSource } from './RoadWidth';
import { onRoundabout, ringHandoff } from './Roundabout';
import { TRAM_BED_HALF, type TramLine } from './Tram';
import { townFade, type Junction, type TownDef } from './Town';
import { stubCut } from './TownJunctions';
import { junctionKerbs } from './TownKerbs';

/**
 * Pedestrian crossings at a city's junctions: a zebra band across every
 * arm just outside the junction's own paved reach, with a stop line beyond
 * it on the approach. Pure data, worked out from the town and the route
 * whenever a builder or a test asks (nothing is stored on `TownDef`), so the
 * generator is untouched and the rules live in one place.
 */
export interface ArmCrossing {
  /** The band's centre on the arm's axis. */
  x: number;
  z: number;
  /** The arm's heading, away from the junction. */
  heading: number;
  /** Half width of the carriageway there. */
  halfWidth: number;
}

/** The band's depth along the arm, the stripe width and pitch across it. */
export const ZEBRA_DEPTH = 2.4;
export const ZEBRA_STRIPE = 0.5;
export const ZEBRA_PITCH = 1.0;
/** The band starts this far past the junction's paved reach, and the stop line lies this far past the band. */
export const CROSSING_GAP = 1.2;
export const STOP_GAP = 1.0;
export const STOP_LINE = 0.3;
/** Everything a crossing lays reaches this far from the junction's reach. */
export const CROSSING_EXTENT = CROSSING_GAP + ZEBRA_DEPTH + STOP_GAP + STOP_LINE;
/** A tram running down an arm keeps a crossing off it. */
const TRAM_CLEAR = TRAM_BED_HALF + ZEBRA_DEPTH / 2 + 0.3;

/** Distance from (x, z) to a tram line's segment. */
function tramDistance(t: TramLine, x: number, z: number): number {
  const dx = t.x1 - t.x0;
  const dz = t.z1 - t.z0;
  const len2 = dx * dx + dz * dz;
  let u = len2 > 0 ? ((x - t.x0) * dx + (z - t.z0) * dz) / len2 : 0;
  u = Math.min(1, Math.max(0, u));
  return Math.hypot(x - (t.x0 + dx * u), z - (t.z0 + dz * u));
}

/**
 * Where each junction's paving spans the route, as path distances: from
 * where the ribbon first hands its verge to the junction on either side to
 * where it takes it back, so a crossing laid beyond it meets plain kerbs.
 */
function routeZones(town: TownDef, stage: RoadWidthSource): Map<Junction, [number, number]> {
  const out = new Map<Junction, [number, number]>();
  for (const j of town.junctions) {
    const k = junctionKerbs(j, stage, stage.halfWidth);
    const all = [...k.openings.left, ...k.openings.right];
    if (all.length === 0) continue;
    out.set(j, [Math.min(...all.map((o) => o.from)), Math.max(...all.map((o) => o.to))]);
  }
  return out;
}

/** Every crossing of the town's junctions, route arms and blocked side streets alike. */
export function junctionCrossings(town: TownDef, stage: RoadWidthSource): ArmCrossing[] {
  const out: ArmCrossing[] = [];
  const path = stage.path;
  const zones = routeZones(town, stage);
  const rings = town.roundabouts ?? [];
  const handoffs = rings.map((r) => ringHandoff(r, stage));
  const trams = town.trams ?? [];
  const s: RoadSample = { x: 0, z: 0, heading: 0 };
  const blocked = (x: number, z: number) => trams.some((t) => tramDistance(t, x, z) < TRAM_CLEAR);
  for (const j of town.junctions) {
    const zone = zones.get(j);
    if (!zone) continue;
    for (const arm of j.arms) {
      if (arm.role === 'blocked') {
        const cut = stubCut(j, arm, stage.halfWidth);
        const centre = cut + CROSSING_GAP + ZEBRA_DEPTH / 2;
        const street = town.streets.find(
          (st) =>
            !st.route &&
            Math.hypot(st.x0 - j.x, st.z0 - j.z) < 1e-3 &&
            Math.abs(
              Math.atan2(
                Math.sin(Math.atan2(st.x1 - st.x0, st.z1 - st.z0) - arm.heading),
                Math.cos(Math.atan2(st.x1 - st.x0, st.z1 - st.z0) - arm.heading),
              ),
            ) < 0.01,
        );
        if (!street) continue;
        const len = Math.hypot(street.x1 - street.x0, street.z1 - street.z0);
        if (len < cut + CROSSING_EXTENT + 2) continue;
        const x = j.x + Math.sin(arm.heading) * centre;
        const z = j.z + Math.cos(arm.heading) * centre;
        if (blocked(x, z)) continue;
        out.push({ x, z, heading: arm.heading, halfWidth: arm.halfWidth });
        continue;
      }
      // The route's arms: the band sits past the reach on the arriving side ('in') or the leaving side.
      const sign = arm.role === 'in' ? -1 : 1;
      const d = (sign < 0 ? zone[0] : zone[1]) + sign * (CROSSING_GAP + ZEBRA_DEPTH / 2);
      if (d < town.from || d > town.to || townFade(town, d) < 1) continue;
      if (onRoundabout(rings, d, 2 * stage.halfWidth)) continue;
      if (handoffs.some((h) => d > h.from - CROSSING_EXTENT && d < h.to + CROSSING_EXTENT))
        continue;
      // Not on another junction's paving, nor on a neighbour's crossing (its band and stop line).
      if (
        [...zones.entries()].some(
          ([k, [a, b]]) => k !== j && d > a - CROSSING_EXTENT && d < b + CROSSING_EXTENT,
        )
      )
        continue;
      path.sample(d, s);
      if (blocked(s.x, s.z)) continue;
      out.push({
        x: s.x,
        z: s.z,
        heading: sign > 0 ? s.heading : s.heading + Math.PI,
        halfWidth: halfWidthAt(stage, d),
      });
    }
  }
  return out;
}
