import { PAVEMENT_WIDTH, type Arm, type Junction } from './Town';
import { createRoadHit, type RoadSample } from './RoadPath';
import { halfWidthAt, type RoadWidthSource } from './RoadWidth';
import { ringOuterRadius, type Roundabout } from './Roundabout';
import { MIN_STUB_LENGTH, type StubSite } from './TownSideStreets';
import { at, type Pt, type Site } from './TownTerraces';

/**
 * How a city's side streets end. A village's stubs stop short of everything
 * with a building across the end; a city's run long, so they meet other
 * roads: one that reaches the route runs on to the route's axis and ends in
 * a T junction there (a crossroads with one side street, so the junction
 * machinery gives it a mouth, kerb returns and an opening in the ribbon);
 * one that reaches another side street runs on to that street's carriageway,
 * through a square mouth in its pavement, open-ended (`StubSite.open`); two that face each other
 * down the same line meet in the middle; and only one that reaches a ring
 * keeps a village end.
 */

/**
 * A side street's far end (its pavement across and the building closing it)
 * reaches this far beyond its carriageway; the street is cut back so that
 * much of it, and a gap, stays off every other road.
 */
const STUB_END_REACH = 11;
const STUB_ROAD_GAP = 1;
/** An open street's plate stops this short of the carriageway edge of the side street it meets. */
const OPEN_END_GAP = 0.05;
/** A street's terraces stop this far short of the route's pavement where it ends in a T junction. */
const T_END_CLEAR = 4;
/** No T junction within this of the route's start or finish. */
const T_END_MARGIN = 60;
/** Two streets face each other when their headings are within this of opposite and their axes this close. */
const HEAD_ON_ANGLE = 0.15;
const HEAD_ON_OFFSET = 1.5;

const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

/**
 * Fit a city's side streets to the other roads they would run into. One
 * that reaches the route's carriageway (a grid's parallel legs can be closer
 * than a street is long) runs on to that road's pavement and stops there,
 * open-ended, so the grid reads as streets joining streets rather than ending
 * in a wall. One that reaches a ring stops short of it with its end building,
 * never shorter than `MIN_STUB_LENGTH`.
 */
export function clipStubsToRoads(
  site: Site,
  stubs: readonly StubSite[],
  stage: RoadWidthSource,
  roundabouts: readonly Roundabout[],
): void {
  const hit = createRoadHit();
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  for (const s of stubs) {
    const corridor = s.hw + PAVEMENT_WIDTH;
    // Past the street's own junction (and its own ring, for a ring's exit), where the route is close by right.
    const start = Math.max(MIN_STUB_LENGTH, 2 * corridor + STUB_END_REACH + 4);
    const routeGap = (t: number): number => {
      const p = at(s.j, s.heading, t, 0);
      return stage.path.nearest(p.x, p.z, 60, hit)
        ? hit.distance - halfWidthAt(stage, hit.along) - PAVEMENT_WIDTH
        : Infinity;
    };
    const ringClash = (t: number): boolean => {
      const p = at(s.j, s.heading, t, 0);
      for (const r of roundabouts) {
        const d = Math.hypot(p.x - r.x, p.z - r.z);
        const own = Math.hypot(s.j.x - r.x, s.j.z - r.z) < ringOuterRadius(r) + 0.1;
        if (!own && d < ringOuterRadius(r) + PAVEMENT_WIDTH + corridor + STUB_ROAD_GAP) return true;
      }
      return false;
    };
    for (let t = start; t <= s.length + STUB_END_REACH; t += 1) {
      if (ringClash(t)) {
        s.length = Math.max(MIN_STUB_LENGTH, Math.min(s.length, t - STUB_END_REACH - 1));
        break;
      }
      if (routeGap(t) < corridor + STUB_ROAD_GAP) {
        // Walk on to the route's axis (the nearest the street's axis comes to it) and make a T
        // junction there: the route arriving and leaving, and this street as its one blocked arm.
        // The axis crosses the route's centreline where the hit's lateral offset changes sign;
        // interpolate between the two steps either side, so the junction sits on both axes.
        let end = NaN;
        let prevU = t;
        let prevLat = NaN;
        for (let u = t; u < t + corridor + STUB_ROAD_GAP + 30; u += 0.25) {
          const q = at(s.j, s.heading, u, 0);
          if (!stage.path.nearest(q.x, q.z, 60, hit)) break;
          const lat = hit.lateral;
          if (!Number.isNaN(prevLat) && Math.sign(lat) !== Math.sign(prevLat) && lat !== prevLat) {
            end = prevU + ((u - prevU) * Math.abs(prevLat)) / (Math.abs(prevLat) + Math.abs(lat));
            break;
          }
          prevU = u;
          prevLat = lat;
        }
        if (Number.isNaN(end)) {
          s.length = Math.max(MIN_STUB_LENGTH, Math.min(s.length, t - STUB_END_REACH - 1));
          break;
        }
        const p = at(s.j, s.heading, end, 0);
        // No T within the start's or the finish's stretch of road (the gantries stand there).
        const nearEnd =
          stage.path.nearest(p.x, p.z, 60, hit) &&
          (hit.along < T_END_MARGIN || hit.along > stage.path.length - T_END_MARGIN);
        if (nearEnd || !stage.path.nearest(p.x, p.z, 60, hit) || hit.distance > 0.5) {
          s.length = Math.max(MIN_STUB_LENGTH, Math.min(s.length, t - STUB_END_REACH - 1));
          break;
        }
        stage.path.sample(hit.along, sample);
        const hw = halfWidthAt(stage, hit.along);
        const arms: Arm[] = [
          { heading: sample.heading + Math.PI, halfWidth: hw, role: 'in' },
          { heading: sample.heading, halfWidth: hw, role: 'out' },
          { heading: s.heading + Math.PI, halfWidth: s.hw, role: 'blocked' },
        ];
        // The junction sits on the street's axis (on the route's to within the step's interpolation).
        const junction: Junction = { x: p.x, z: p.z, arms };
        site.junctions.push(junction);
        // The street runs exactly to the junction's centre, so its plate meets the mouth there.
        s.length = end;
        s.open = true;
        s.endClear = hw + PAVEMENT_WIDTH + T_END_CLEAR;
        break;
      }
    }
  }
}

/** Distance from `p` to the axis of `s` between its junction and its end, and where along it the foot lies. */
function axisDistance(s: StubSite, p: Pt): { d: number; t: number } {
  const ux = Math.sin(s.heading);
  const uz = Math.cos(s.heading);
  const t = (p.x - s.j.x) * ux + (p.z - s.j.z) * uz;
  const tc = Math.min(s.length, Math.max(0, t));
  return { d: Math.hypot(p.x - (s.j.x + ux * tc), p.z - (s.j.z + uz * tc)), t };
}

/**
 * Join the side streets the fitting cut short of one another. Walking on
 * from a cut street's end along its axis: where it would meet another
 * street's side it runs on to that street's pavement and opens; where it
 * meets another cut street head on, both run on to meet in the middle.
 */
export function joinStubs(stubs: readonly StubSite[], stage: RoadWidthSource): void {
  const road = createRoadHit();
  for (const a of stubs) {
    if (a.open || a.length >= a.full - 1e-6) continue;
    const ux = Math.sin(a.heading);
    const uz = Math.cos(a.heading);
    for (let t = a.length; t <= a.full + STUB_END_REACH; t += 0.5) {
      const p = at(a.j, a.heading, t, 0);
      // Never across the route: a street the clipping left short of it stays short.
      if (
        stage.path.nearest(p.x, p.z, 60, road) &&
        road.distance < halfWidthAt(stage, road.along) + PAVEMENT_WIDTH + a.hw + PAVEMENT_WIDTH
      )
        break;
      let hit: StubSite | null = null;
      let headOn: StubSite | null = null;
      for (const b of stubs) {
        if (b === a || Math.hypot(b.j.x - a.j.x, b.j.z - a.j.z) < 1e-6) continue;
        const { d, t: tb } = axisDistance(b, p);
        const facing = Math.abs(wrap(a.heading - b.heading - Math.PI)) < HEAD_ON_ANGLE;
        if (facing) {
          // Lateral offset between the two axes.
          const off = Math.abs((a.j.x - b.j.x) * uz - (a.j.z - b.j.z) * ux);
          if (off < HEAD_ON_OFFSET && d < b.hw + PAVEMENT_WIDTH + STUB_END_REACH) headOn = b;
          continue;
        }
        if (d < b.hw + OPEN_END_GAP && tb > b.hw + PAVEMENT_WIDTH && tb < b.length - 2) hit = b;
      }
      if (headOn) {
        // Meet half way between the two ends, both open, unless the route runs between them.
        const toB = Math.hypot(headOn.j.x - a.j.x, headOn.j.z - a.j.z);
        const meet = (a.length + (toB - headOn.length)) / 2;
        let clear = true;
        for (let u = Math.min(a.length, meet); u <= Math.max(toB - headOn.length, meet); u += 1) {
          const q = at(a.j, a.heading, u, 0);
          if (
            stage.path.nearest(q.x, q.z, 60, road) &&
            road.distance < halfWidthAt(stage, road.along) + PAVEMENT_WIDTH + a.hw + PAVEMENT_WIDTH
          ) {
            clear = false;
            break;
          }
        }
        if (!clear) break;
        a.length = meet;
        headOn.length = toB - meet;
        a.open = true;
        headOn.open = true;
        break;
      }
      if (hit) {
        // The plate runs to the other street's carriageway edge; its pavements stop at the other's
        // pavement, which opens for it (see `TownStreetBuilder`).
        a.length = t;
        a.open = true;
        a.endClear = PAVEMENT_WIDTH + 1;
        break;
      }
    }
  }
}
