import { boxArmCut } from '../JunctionBox';
import type { RoadPath } from '../RoadPath';
import { ringOuterRadius, type Roundabout } from '../Roundabout';
import { FRONT_SETBACK, type Junction } from '../Town';
import { normHeading, wedges, type Wedge } from '../TownJunctions';
import { at, type Facade, type Pt } from '../TownTerraces';
import type { NetworkNode, NodeArm } from './CityNetwork';

/**
 * A city's frontage: the line every building front stands on, the back edge
 * of every pavement, as chains walked round the city's street graph with the
 * buildings on their left. Each street side runs a pavement's width off its
 * carriageway (the route's side is its facade, which follows the ribbon); at
 * a junction the chain turns the corner of the block, where the pavement's
 * back edge meets itself in a point, since a kerb return's radius is a
 * pavement's width. Every block's frontage closes into a loop, and so does
 * the city's outside; the only open chains end where the route leaves the
 * city at its start and finish. `CityFrontageFill` builds along every metre.
 */

export interface FrontageChain {
  pts: Pt[];
  /** A loop: its last point joins its first. */
  closed: boolean;
}

export interface FrontageInput {
  nodes: ReadonlyMap<number, NetworkNode>;
  route: readonly number[];
  facades: { left: Facade; right: Facade };
  path: RoadPath;
  /** The stage's base half width, as junction kerbs take it. */
  base: number;
  /** How far in from the route's ends the frontage starts and stops. */
  endSetback: number;
}

/** Wedges this close to a half turn carry straight on; wider ones turn round the outside of a corner. */
const STRAIGHT_LO = (165 * Math.PI) / 180;
const STRAIGHT_HI = (195 * Math.PI) / 180;
/** Arcs (a ring's, an outside corner's) are laid in pieces about this long. */
const ARC_STEP = 1;
/** A route arm's facade is searched this far either side of its straight frontage's point on a ring's circle, this finely. */
const RING_SEARCH = 30;
const RING_STEP = 0.5;
/** A ring's corner arc may sweep this much past its wedge before it is taken for the long way round. */
const RING_SLACK = 0.1;

const left = (h: number): Pt => ({ x: Math.cos(h), z: -Math.sin(h) });

export function frontageChains(input: FrontageInput): FrontageChain[] {
  const { nodes, route } = input;
  const routeAt = new Map(route.map((n, k) => [n, k]));
  const terminal = (n: number) => nodes.get(n)!.arms.length === 1 && !nodes.get(n)!.junction;
  const visited = new Set<string>();
  const key = (n: number, i: number) => `${n}:${i}`;
  const reverse = (v: number, u: number) => nodes.get(v)!.arms.findIndex((a) => a.to === u);
  const routeEdge = (u: number, v: number) => {
    const ku = routeAt.get(u);
    const kv = routeAt.get(v);
    return ku !== undefined && kv !== undefined && Math.abs(ku - kv) === 1;
  };
  const corners = new Corners(input);
  const chains: FrontageChain[] = [];

  // The pieces of a street side between two points on it: the route's facade between them, or
  // nothing for a straight side street (its corners are on its frontage line).
  const side = (u: number, v: number, from: Pt, to: Pt): Pt[] => {
    if (!routeEdge(u, v)) return [];
    const forward = routeAt.get(v)! > routeAt.get(u)!;
    const facade = forward ? input.facades.left : input.facades.right;
    const s0 = facade.nearest(from.x, from.z).s;
    const s1 = facade.nearest(to.x, to.z).s;
    if (forward ? s1 <= s0 : s0 <= s1) return [];
    const pts = forward ? facade.trace(s0, s1) : facade.trace(s1, s0).reverse();
    return pts.slice(1, -1);
  };

  const walk = (n0: number, i0: number): FrontageChain => {
    const pts: Pt[] = terminal(n0)
      ? [corners.end(n0, 'leave')]
      : corners.at(n0, i0, (i0 + 1) % nodes.get(n0)!.arms.length);
    let n = n0;
    let i = i0;
    for (;;) {
      visited.add(key(n, i));
      const v = nodes.get(n)!.arms[i]!.to;
      const r = reverse(v, n);
      if (r < 0) return { pts, closed: false };
      if (terminal(v)) {
        const end = corners.end(v, 'arrive');
        pts.push(...side(n, v, pts[pts.length - 1]!, end), end);
        return { pts, closed: false };
      }
      const count = nodes.get(v)!.arms.length;
      const a = (r - 1 + count) % count;
      if (v === n0 && a === i0) {
        pts.push(...side(n, v, pts[pts.length - 1]!, pts[0]!));
        return { pts, closed: true };
      }
      const corner = corners.at(v, a, r);
      pts.push(...side(n, v, pts[pts.length - 1]!, corner[0]!), ...corner);
      n = v;
      i = a;
      if (visited.has(key(n, i))) return { pts, closed: false };
    }
  };

  // The open chains first, from the route's two ends, then every loop left.
  for (const [n, node] of nodes)
    if (terminal(n) && !visited.has(key(n, 0)) && node.arms.length === 1) chains.push(walk(n, 0));
  for (const [n, node] of nodes)
    node.arms.forEach((_, i) => {
      if (!visited.has(key(n, i))) chains.push(walk(n, i));
    });
  return chains.filter((c) => c.pts.length >= 2);
}

/** The corner of a block at each node, buildings on the left of the chain round it. */
class Corners {
  private readonly routeAt: Map<number, number>;

  constructor(private readonly input: FrontageInput) {
    this.routeAt = new Map(input.route.map((n, k) => [n, k]));
  }

  /**
   * At node `n`, the chain arriving down arm `b` (along its right side) and
   * leaving up arm `a` (along its left side), `a` just before `b` in heading
   * order: the corner's points, first to last.
   */
  at(n: number, a: number, b: number): Pt[] {
    const node = this.input.nodes.get(n)!;
    const armA = node.arms[a]!;
    const armB = node.arms[b]!;
    if (node.ring) return this.ring(n, node.ring, armA, armB);
    const j = node.junction!;
    const w = wedges(j).find((q) => q.a === armA.arm && q.b === armB.arm)!;
    if (j.box) return this.box(j, w, armA, armB);
    if (armA.route || armB.route) return this.routeCorner(j, w, armA, armB);
    return [this.wedgeCorner(j, w, false)].flat();
  }

  /** Where the frontage starts (`leave`) or stops (`arrive`) at one of the route's ends, on the route's facade. */
  end(n: number, how: 'leave' | 'arrive'): Pt {
    const { route, facades, endSetback } = this.input;
    const atStart = n === route[0];
    // Leaving the start or arriving at the finish runs with the route: its left facade.
    const facade = atStart === (how === 'leave') ? facades.left : facades.right;
    return facade.point(atStart ? endSetback : facade.length - endSetback);
  }

  /** The frontage corner of a wedge between two straight arms. */
  private wedgeCorner(j: Junction, w: Wedge, box: boolean): Pt | Pt[] {
    if (w.angle < STRAIGHT_LO) return { x: w.kx, z: w.kz };
    if (w.angle <= STRAIGHT_HI) {
      const p = at(j, w.a.heading, 0, w.a.halfWidth + FRONT_SETBACK);
      const q = at(j, w.b.heading, 0, -(w.b.halfWidth + FRONT_SETBACK));
      return { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
    }
    // The outside of a corner: square where the kerbs are (off the route), round a boxed
    // junction's fan of pavement about its carriageway corner.
    if (!box) return { x: w.kx, z: w.kz };
    const nb = left(w.b.heading + Math.PI);
    const na = left(w.a.heading);
    const h0 = Math.atan2(nb.x, nb.z);
    const sweep = Math.atan2(
      Math.sin(Math.atan2(na.x, na.z) - h0),
      Math.cos(Math.atan2(na.x, na.z) - h0),
    );
    const steps = Math.max(2, Math.ceil((Math.abs(sweep) * FRONT_SETBACK) / ARC_STEP));
    const out: Pt[] = [];
    for (let k = 0; k <= steps; k++) {
      const h = h0 + (sweep * k) / steps;
      out.push({ x: w.px + Math.sin(h) * FRONT_SETBACK, z: w.pz + Math.cos(h) * FRONT_SETBACK });
    }
    return out;
  }

  /** A square junction (`JunctionBox`): straight arms, each route arm's frontage from where its paving ends. */
  private box(j: Junction, w: Wedge, a: NodeArm, b: NodeArm): Pt[] {
    const out: Pt[] = [];
    const base = this.input.base;
    if (b.route)
      out.push(at(j, w.b.heading, boxArmCut(j, w.b, base), -(w.b.halfWidth + FRONT_SETBACK)));
    out.push(...[this.wedgeCorner(j, w, true)].flat());
    if (a.route)
      out.push(at(j, w.a.heading, boxArmCut(j, w.a, base), w.a.halfWidth + FRONT_SETBACK));
    return out;
  }

  /**
   * A corner on the route away from a square junction (a crossroads it drives
   * straight through, or round a slight bend): where the side street's
   * frontage meets the route's facade, or across a side of the route with
   * no street on it, the facade itself.
   */
  private routeCorner(j: Junction, w: Wedge, a: NodeArm, b: NodeArm): Pt[] {
    // The wedge lies left of `a` and right of `b`; an arm pointing back up the route has the route's right on its left.
    const route = a.route ? w.a : w.b;
    const facade =
      (route === w.a) === (route.role === 'out')
        ? this.input.facades.left
        : this.input.facades.right;
    if (a.route && b.route) {
      const p = facade.nearest(j.x, j.z);
      return [{ x: p.x, z: p.z }];
    }
    const stub = a.route ? w.b : w.a;
    const sign = stub === w.a ? 1 : -1;
    const k = facade.cross(j, stub.heading, sign * (stub.halfWidth + FRONT_SETBACK));
    if (k) return [{ x: k.x, z: k.z }];
    const p = facade.nearest(w.kx, w.kz);
    return [{ x: p.x, z: p.z }];
  }

  /**
   * A ring's corner: round the circle a pavement's width beyond its outer
   * edge from where the arriving arm's frontage meets it to where the
   * leaving arm's does; across the route's own passage, its facade, which
   * follows that circle.
   */
  private ring(n: number, r: Roundabout, a: NodeArm, b: NodeArm): Pt[] {
    const rf = ringOuterRadius(r) + FRONT_SETBACK;
    const ha = normHeading(a.heading);
    const span = normHeading(normHeading(b.heading) - ha) || Math.PI * 2;
    if (a.route && b.route) {
      const s = { x: 0, z: 0, heading: 0 };
      this.input.path.sample((r.from + r.to) / 2, s);
      const mid = normHeading(Math.atan2(s.x - r.x, s.z - r.z) - ha);
      if (mid < span) {
        const facade = this.routeFacade(n, a, 'left');
        const p = facade.nearest(s.x, s.z);
        return [{ x: p.x, z: p.z }];
      }
    }
    // A narrow wedge's pavements meet before they reach the circle: the corner is where they cross.
    const meet = this.ringWedgeMeet(n, r, a, b, rf);
    if (meet) return [meet];
    // From b's crossing back round the wedge to a's: headings fall from b to a, never further
    // than the wedge spans. A route arm's crossing just past its mouth would swap the two and send
    // the arc the long way round the ring: then the arms' straight lines, else a straight join.
    const arcOf = (straight: boolean) => {
      const pb = this.ringMeet(n, r, b, 'right', rf, straight);
      const pa = this.ringMeet(n, r, a, 'left', rf, straight);
      const hb = Math.atan2(pb.x - r.x, pb.z - r.z);
      const sweep = -normHeading(hb - Math.atan2(pa.x - r.x, pa.z - r.z));
      return { pa, pb, hb, sweep };
    };
    let arc = arcOf(false);
    if (-arc.sweep > span + RING_SLACK) arc = arcOf(true);
    const { pa, pb, hb } = arc;
    const sweep = -arc.sweep > span + RING_SLACK ? 0 : arc.sweep;
    const steps = Math.max(1, Math.ceil((Math.abs(sweep) * rf) / ARC_STEP));
    const out: Pt[] = [pb];
    for (let k = 1; k < steps; k++) {
      const h = hb + (sweep * k) / steps;
      out.push({ x: r.x + Math.sin(h) * rf, z: r.z + Math.cos(h) * rf });
    }
    out.push(pa);
    return out;
  }

  /** An arm's frontage near a ring on `side`: a side street's straight line, or the route's facade there. */
  private armFrontage(n: number, r: Roundabout, arm: NodeArm, side: 'left' | 'right'): Pt[] {
    const off = (side === 'left' ? 1 : -1) * (arm.halfWidth + FRONT_SETBACK);
    const line = [at(r, arm.heading, 0, off), at(r, arm.heading, RING_SEARCH * 2, off)];
    if (!arm.route) return line;
    const facade = this.routeFacade(n, arm, side);
    const s0 = facade.nearest(line[1]!.x, line[1]!.z).s;
    const sNear = facade.nearest(r.x, r.z).s;
    return s0 < sNear
      ? facade.trace(Math.max(0, s0 - RING_SEARCH), sNear)
      : facade.trace(sNear, Math.min(facade.length, s0 + RING_SEARCH));
  }

  /** Where wedge (a, b)'s two frontages cross beyond the ring's circle, if they do. */
  private ringWedgeMeet(n: number, r: Roundabout, a: NodeArm, b: NodeArm, rf: number): Pt | null {
    const pa = this.armFrontage(n, r, a, 'left');
    const pb = this.armFrontage(n, r, b, 'right');
    let best: Pt | null = null;
    let bestD = rf;
    for (let i = 1; i < pa.length; i++)
      for (let k = 1; k < pb.length; k++) {
        const c = segmentMeet(pa[i - 1]!, pa[i]!, pb[k - 1]!, pb[k]!);
        if (!c) continue;
        const d = Math.hypot(c.x - r.x, c.z - r.z);
        if (d > bestD) {
          bestD = d;
          best = c;
        }
      }
    return best;
  }

  /** The route's facade along route arm `arm` of node `n`, on the arm's `side`. */
  private routeFacade(n: number, arm: NodeArm, side: 'left' | 'right'): Facade {
    // The arm leaving with the route has the route's left on its left; the one pointing back, its right.
    const leaving = this.routeAt.get(arm.to)! > this.routeAt.get(n)!;
    const { facades } = this.input;
    return leaving === (side === 'left') ? facades.left : facades.right;
  }

  /**
   * Where an arm's frontage on `side` meets the ring's frontage circle of
   * radius `rf`: a side street's straight line a pavement off its axis; the
   * route's facade, which bends off that line through the deflections, where
   * it crosses the circle nearest that line's point (along the passage it
   * hugs the circle, so only a crossing close by is the arm's own).
   */
  private ringMeet(
    n: number,
    r: Roundabout,
    arm: NodeArm,
    side: 'left' | 'right',
    rf: number,
    straightOnly = false,
  ): Pt {
    const off = (side === 'left' ? 1 : -1) * (arm.halfWidth + FRONT_SETBACK);
    const straight = at(r, arm.heading, Math.sqrt(Math.max(0, rf * rf - off * off)), off);
    if (!arm.route || straightOnly) return straight;
    const facade = this.routeFacade(n, arm, side);
    const s0 = facade.nearest(straight.x, straight.z).s;
    const gap = (s: number) => {
      const p = facade.point(s);
      return Math.hypot(p.x - r.x, p.z - r.z) - rf;
    };
    let best: number | null = null;
    for (
      let s = Math.max(0, s0 - RING_SEARCH);
      s + RING_STEP <= Math.min(facade.length, s0 + RING_SEARCH);
      s += RING_STEP
    ) {
      const g0 = gap(s);
      const g1 = gap(s + RING_STEP);
      if (g0 * g1 > 0) continue;
      const at0 = s + (RING_STEP * g0) / (g0 - g1 || 1);
      if (best === null || Math.abs(at0 - s0) < Math.abs(best - s0)) best = at0;
    }
    return best === null ? straight : facade.point(best);
  }
}

/** Where segments `a`–`b` and `c`–`d` cross, if they do. */
function segmentMeet(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const rx = b.x - a.x;
  const rz = b.z - a.z;
  const sx = d.x - c.x;
  const sz = d.z - c.z;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * sz - (c.z - a.z) * sx) / den;
  const u = ((c.x - a.x) * rz - (c.z - a.z) * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + rx * t, z: a.z + rz * t };
}
