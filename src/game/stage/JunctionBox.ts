import {
  arc,
  at,
  crescentOf,
  stubEdge,
  stubRun,
  surfaceOf,
  type KerbOutline,
  type KerbPoint,
  type Pt,
} from './KerbShapes';
import { createRoadHit } from './RoadPath';
import type { RoadWidthSource } from './RoadWidth';
import { FILLET, type Arm, type Junction } from './Town';
import type { JunctionKerbs, Openings } from './TownKerbs';
import { alongArm, CUT_MARGIN, junctionTurn, offsetCorner, stubCut, wedges } from './TownJunctions';
import { tangentLength } from './TownPlan';

/**
 * A city corner as a square junction: every arm straight, the route's arms
 * included, with the same `FILLET` kerb return between each pair of
 * neighbouring arms, as at any crossroads off the route. The route's corner
 * arc rounds at its half width plus `FILLET` (`CityRoute.cornerRadius`), so
 * its inner edge is that kerb return exactly and its outer edge lies on the
 * junction's paving. The ribbon leaves both its verges to the junction from
 * the arriving arm's cut to the leaving arm's, so the pavements run round
 * every corner at one width with nothing of the ribbon's own across them.
 */

/** Where two arms carry straight on (a wedge this close to a half turn), the kerb tapers between their edges over this either side. */
const TAPER = 3;
const STRAIGHT = (170 * Math.PI) / 180;
const REFLEX = (190 * Math.PI) / 180;

/** How far along an arm a boxed junction's paving reaches: a blocked arm's cut, or for a route arm past the arc's tangent too. */
export function boxArmCut(j: Junction, arm: Arm, routeHalfWidth: number): number {
  const cut = stubCut(j, arm, routeHalfWidth);
  if (arm.role === 'blocked') return cut;
  return Math.max(cut, tangentLength(junctionTurn(j), j.radius) + CUT_MARGIN);
}

/** The kerbs, paving and ribbon openings of a boxed junction. */
export function boxKerbs(
  j: Junction,
  stage: RoadWidthSource,
  routeHalfWidth: number,
): JunctionKerbs {
  const cuts = new Map(j.arms.map((a) => [a, boxArmCut(j, a, routeHalfWidth)]));
  const outlines: KerbOutline[] = [];
  const polygons: Pt[][] = [];
  const axis = (arm: Arm, t: number) => at(j, arm.heading, t, 0);
  const edge = (arm: Arm, sign: 1 | -1, t: number): Pt => {
    const p = stubEdge(j, arm, sign, t);
    return { x: p.x, z: p.z };
  };
  for (const w of wedges(j)) {
    const cutA = cuts.get(w.a)!;
    const cutB = cuts.get(w.b)!;
    if (w.angle < STRAIGHT) {
      // A kerb return between the two edges, as between any two side streets.
      const c = offsetCorner(j, w.a, w.b, w.a.halfWidth + FILLET, w.b.halfWidth + FILLET);
      const ta = Math.min(cutA - 0.1, alongArm(j, w.a, c.x, c.z));
      const tb = Math.min(cutB - 0.1, alongArm(j, w.b, c.x, c.z));
      const points = stubRun(j, w.a, 1, cutA, ta);
      const from = points.length - 1;
      arc(c, FILLET, points[from]!, stubEdge(j, w.b, -1, tb), points);
      points.push(stubEdge(j, w.b, -1, tb));
      polygons.push(crescentOf(points, from, { x: w.px, z: w.pz }));
      points.push(...stubRun(j, w.b, -1, tb, cutB).slice(1));
      outlines.push({ points });
    } else if (w.angle < REFLEX) {
      // Straight on: one kerb line, tapering across the junction where the widths differ.
      outlines.push({
        points: [...stubRun(j, w.a, 1, cutA, TAPER), ...stubRun(j, w.b, -1, TAPER, cutB)],
      });
      polygons.push([
        axis(w.a, TAPER),
        edge(w.a, 1, TAPER),
        edge(w.b, -1, TAPER),
        axis(w.b, TAPER),
      ]);
    } else {
      // The outside of a corner with no street on it: the two edges meet square, and the
      // pavement turns round the corner in a fan.
      const corner = { x: w.px, z: w.pz };
      const ta = alongArm(j, w.a, corner.x, corner.z);
      const tb = alongArm(j, w.b, corner.x, corner.z);
      const points = stubRun(j, w.a, 1, cutA, ta);
      const na = points[points.length - 1]!;
      const nb = stubEdge(j, w.b, -1, tb);
      const turn = Math.atan2(na.nx * nb.nz - na.nz * nb.nx, na.nx * nb.nx + na.nz * nb.nz);
      const h0 = Math.atan2(na.nx, na.nz);
      for (let k = 1; k < 8; k++) {
        const h = h0 + (turn * k) / 8;
        const p: KerbPoint = { x: corner.x, z: corner.z, nx: Math.sin(h), nz: Math.cos(h) };
        // A hair along the turn, so each facet of the fan has a length to lay its band on.
        points.push({ ...p, x: p.x - p.nx * 1e-3 * k, z: p.z - p.nz * 1e-3 * k });
      }
      points.push(...stubRun(j, w.b, -1, tb, cutB));
      outlines.push({ points });
      polygons.push([{ x: j.x, z: j.z }, edge(w.a, 1, 0), corner, edge(w.b, -1, 0)]);
    }
  }
  // Each arm's own paving, from just behind the junction's centre to its cut.
  for (const arm of j.arms) {
    const cut = cuts.get(arm)!;
    polygons.push([edge(arm, 1, -0.5), edge(arm, -1, -0.5), edge(arm, -1, cut), edge(arm, 1, cut)]);
  }
  // The ribbon gives both verges to the junction from the arriving arm's cut to the leaving arm's.
  const openings: Openings = { left: [], right: [] };
  const inArm = j.arms.find((a) => a.role === 'in');
  const outArm = j.arms.find((a) => a.role === 'out');
  if (inArm && outArm) {
    const hit = createRoadHit();
    const along = (arm: Arm) => {
      const p = axis(arm, cuts.get(arm)!);
      return stage.path.nearest(p.x, p.z, 60, hit) ? hit.along : NaN;
    };
    const from = along(inArm);
    const to = along(outArm);
    if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
      openings.left.push({ from, to });
      openings.right.push({ from, to });
    }
  }
  return { outlines, openings, surface: surfaceOf(j, polygons), aprons: [], cuts };
}
