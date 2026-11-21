import { hashSeed, mulberry32 } from '../rng';
import type { BoxObstacle } from '../vehicle/Collisions';
import { createRoadHit, type RoadSample } from './RoadPath';
import { edgeObstacles } from './Rivers';
import type { StageDef } from './StageGenerator';

/**
 * Lakes (the Lakeland's): big still water in the valleys, laid after the
 * road so the road never changes. Two kinds. A lakeside lake fills a valley
 * floor beside a low stretch of road, its near shore running along the road
 * just past its corridor. A bridge lake straddles a low stretch of road, which
 * crosses it on a long bridge at its own (already smoothed) height, the water
 * a clearance under the deck.
 *
 * Each lake is star-shaped about its centre: a seeded, wobbly ellipse whose
 * radius at each of `RAYS` headings is cut back to where a ray from the
 * centre first comes near another stretch of road or another lake, or climbs
 * out of the valley. So "inside" and "how far from the shore" are each a look
 * at one sector, the water is a fan, and the shoreline follows the ground.
 * Pure TS, deterministic from the stage, so the main thread and the terrain
 * worker agree.
 */

export interface LakeStyle {
  /** At most this many lakes beside the road a stage. */
  lakeside: number;
  /** At most this many lakes the road bridges a stage, one more from the second loop on; none ever at 0. */
  bridges: number;
  /** The water's colour. */
  water: string;
}

export interface Lake {
  cx: number;
  cz: number;
  /** Shore points, one per ray (`RAYS`), counter-clockwise from +x. */
  xs: Float64Array;
  zs: Float64Array;
  /** The furthest shore point from the centre. */
  reach: number;
  /** The water's surface. */
  level: number;
  /** Where the lake meets the road: the stretch the bridge spans (road distances), on a bridge lake. */
  bridge?: { from: number; to: number };
  /** The road distance the lake was laid against (the crossing, or the stretch it runs beside). */
  along: number;
}

/** What the planner reads of the ground and the road. */
export interface LakeGround {
  stage: StageDef;
  groundHeight(x: number, z: number): number;
  roadHeightAt(along: number): number;
  /** How far past the carriageway's edge a road's corridor reaches. */
  corridor: number;
}

/** Shore rays per lake, and the step a ray is marched in. */
export const RAYS = 64;
const STEP = 3;
const SECTOR = (2 * Math.PI) / RAYS;
/** Over this band outside the shore the ground eases down to just over the water (`lakeGround`). */
export const RIM = 7;
/** The shore stands this far over the water, and the bed falls `DEPTH` under it over `SHELF` metres in. */
const SHORE_LIFT = 0.4;
const DEPTH = 3.6;
const SHELF = 26;
/** Outside the shore, where the ground lies under the water, a levee this wide at its crest falls away at this slope. */
const LEVEE_TOP = 3;
const LEVEE_SLOPE = 0.5;
/** A lakeside lake's water lies this far under the lowest road within `SIDE_LEVEL` metres of where it is laid. */
const SIDE_DROP = 1.2;
const SIDE_LEVEL = 60;
/** A bridge lake's water lies this far under the bridge deck's lowest point. */
const CLEARANCE = 4.5;
/** A shore never climbs further than this over the water: the lake fills the valley floor, not the hillside. */
const SIDE_RISE = 5;
const BRIDGE_RISE = 6;
/** A shore stops short where any road within this far of it lies less than `ROAD_OVER` over the water: no water ever stands above a road beside it. */
const LOW_ROAD = 45;
const ROAD_OVER = 0.8;
const LOW_STEP = 6;
/** Near its own crossing the ground under the road does not stop a bridge lake's rays. */
const BRIDGE_CORE = 22;
/** Lakes keep this far from each other, and a lakeside lake this far along the road from any other lake. */
const LAKE_GAP = 30;
const ALONG_GAP = 150;
/** A lakeside lake is laid at most this far along the road from another lakeside lake's: one after another round the road. */
const SIDE_ALONG_GAP = 60;
/**
 * A lakeside lake's shore keeps this far past the carriageway's edge, from
 * this stretch of road and every other: the road's flat verge, then the rim
 * easing the ground down to the water, so the road runs along the water's
 * edge without the rim ever reaching the verge.
 */
const SIDE_SHORE = 4 + RIM;
/** Lakes keep this far from the start and finish, a bridge this far from any gate. */
const ENDS = 120;
const GATE_GAP = 70;
const LACET_GAP = 40;
/** A bridge lake's semi-axes: across the road and along it. */
const BRIDGE_ACROSS: readonly [number, number] = [90, 170];
const BRIDGE_ALONG: readonly [number, number] = [38, 64];
/** A lakeside lake's semi-axes: along the road and out from it. */
const SIDE_ALONG: readonly [number, number] = [160, 300];
const SIDE_OUT: readonly [number, number] = [70, 150];
/** Over this far either side of where a lakeside lake is laid the road must turn this much for the lake to fill the inside of the bend. */
const BEND_REACH = 90;
const BEND_TURN = 0.35;
/** The road may turn at most this much (radians) over this far either side of a bridge lake's crossing. */
const BRIDGE_TURN = 0.8;
const BRIDGE_REACH = 55;
/** A lake is kept only if it is this big: mean shore radius (less for a bridge's, hemmed in by the valley), and the share of rays reaching `MIN_RAY`. */
const MIN_MEAN = 42;
const MIN_MEAN_BRIDGE = 30;
const MIN_RAY = 18;
const MIN_SHARE = 0.7;
/** Every bridge abutment reaches this far past where the shore's rim leaves the road. */
const ABUTMENT = 6;
/** Candidate stretches are tried this many metres apart; no stage tries more than this many lakes. */
const SCAN_STEP = 40;
const MAX_TRIES = 36;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Every lake of a stage: the bridge lakes first, then the lakeside ones. */
export function planLakes(ground: LakeGround, style: LakeStyle, loop: number): Lake[] {
  const rand = mulberry32(hashSeed(ground.stage.seed, 'lakes'));
  const lakes: Lake[] = [];
  // A type that bridges no lakes never does, whatever the loop (the Moorland's lakes lie off the road).
  const bridges = style.bridges > 0 ? style.bridges + (loop >= 2 ? 1 : 0) : 0;
  let tries = 0;
  for (const along of bridgeCandidates(ground)) {
    if (lakes.length >= bridges || tries >= MAX_TRIES) break;
    if (lakes.some((l) => Math.abs(l.along - along) < ALONG_GAP)) continue;
    tries++;
    const lake = bridgeLake(ground, along, lakes, rand);
    if (lake) lakes.push(lake);
  }
  const placedBridges = lakes.length;
  for (const along of sideCandidates(ground)) {
    if (lakes.length - placedBridges >= style.lakeside || tries >= MAX_TRIES * 3) break;
    if (lakes.some((l) => Math.abs(l.along - along) < (l.bridge ? ALONG_GAP : SIDE_ALONG_GAP)))
      continue;
    tries++;
    const lake = sideLake(ground, along, lakes, rand);
    if (lake) lakes.push(lake);
  }
  return lakes;
}

/** Whether road distance `d` may carry a lake (`gates` also for a bridge). */
function allowedAt(stage: StageDef, d: number, gates: boolean): boolean {
  const finish = stage.startDistance + stage.length;
  if (d < stage.startDistance + ENDS || d > finish - ENDS) return false;
  if (gates && stage.gates.some((g) => Math.abs(g.distance - d) < GATE_GAP)) return false;
  return !(stage.lacets ?? []).some((l) => d > l.from - LACET_GAP && d < l.to + LACET_GAP);
}

/** The stretches straight enough for a bridge, lowest against the road round them first. */
function bridgeCandidates(ground: LakeGround): number[] {
  const { stage } = ground;
  const out: { d: number; lift: number }[] = [];
  const a: RoadSample = { x: 0, z: 0, heading: 0 };
  const b: RoadSample = { x: 0, z: 0, heading: 0 };
  for (let d = stage.startDistance + ENDS; d < stage.startDistance + stage.length - ENDS; d += 10) {
    if (!allowedAt(stage, d, true)) continue;
    stage.path.sample(d - BRIDGE_REACH, a);
    stage.path.sample(d + BRIDGE_REACH, b);
    if (Math.abs(wrap(b.heading - a.heading)) > BRIDGE_TURN) continue;
    let low = Infinity;
    for (let e = -160; e <= 160; e += 10) low = Math.min(low, ground.roadHeightAt(d + e));
    out.push({ d, lift: ground.roadHeightAt(d) - low });
  }
  return out.sort((p, q) => p.lift - q.lift).map((c) => c.d);
}

/** Every stretch of road, lowest against its surroundings first. */
function sideCandidates(ground: LakeGround): number[] {
  const { stage } = ground;
  const out: { d: number; lift: number }[] = [];
  for (
    let d = stage.startDistance + ENDS;
    d < stage.startDistance + stage.length - ENDS;
    d += SCAN_STEP
  ) {
    if (!allowedAt(stage, d, false)) continue;
    let low = Infinity;
    for (let e = -200; e <= 200; e += 20) low = Math.min(low, ground.roadHeightAt(d + e));
    out.push({ d, lift: ground.roadHeightAt(d) - low });
  }
  return out.sort((p, q) => p.lift - q.lift).map((c) => c.d);
}

/** A wobbly ellipse's radius at heading `theta`: semi-axes `along` (at heading `phi`) and `across`. */
function shapeRadius(
  theta: number,
  phi: number,
  along: number,
  across: number,
  phases: readonly number[],
): number {
  const u = Math.cos(theta - phi) / along;
  const v = Math.sin(theta - phi) / across;
  const wobble =
    1 +
    0.12 * Math.sin(2 * theta + phases[0]!) +
    0.08 * Math.sin(3 * theta + phases[1]!) +
    0.05 * Math.sin(5 * theta + phases[2]!);
  return wobble / Math.sqrt(u * u + v * v);
}

/**
 * The lake about (cx, cz): each ray marched out to the shape's radius or
 * until `blocked`, then smoothed so no lone ray runs out as a finger.
 * Null where it comes out too small.
 */
function castShore(
  cx: number,
  cz: number,
  shape: (theta: number) => number,
  blocked: (x: number, z: number, run: number) => boolean,
  minMean: number,
): { xs: Float64Array; zs: Float64Array; reach: number } | null {
  if (blocked(cx, cz, 0)) return null;
  const radii = new Float64Array(RAYS);
  for (let k = 0; k < RAYS; k++) {
    const theta = k * SECTOR;
    const dx = Math.cos(theta);
    const dz = Math.sin(theta);
    const most = shape(theta);
    let r = 0;
    for (let run = STEP; run <= most; run += STEP) {
      if (blocked(cx + dx * run, cz + dz * run, run)) break;
      r = run;
    }
    radii[k] = r;
  }
  // A ray may run no further than its longer neighbour and a little more: no fingers.
  for (let pass = 0; pass < 2; pass++)
    for (let k = 0; k < RAYS; k++) {
      const prev = radii[(k + RAYS - 1) % RAYS]!;
      const next = radii[(k + 1) % RAYS]!;
      radii[k] = Math.min(radii[k]!, Math.max(prev, next) + 12);
    }
  let mean = 0;
  let long = 0;
  for (const r of radii) {
    mean += r / RAYS;
    if (r >= MIN_RAY) long++;
  }
  if (mean < minMean || long < MIN_SHARE * RAYS) return null;
  const xs = new Float64Array(RAYS);
  const zs = new Float64Array(RAYS);
  let reach = 0;
  for (let k = 0; k < RAYS; k++) {
    // Never quite at the centre, so every sector keeps its triangle.
    const r = Math.max(2, radii[k]!);
    xs[k] = cx + Math.cos(k * SECTOR) * r;
    zs[k] = cz + Math.sin(k * SECTOR) * r;
    reach = Math.max(reach, r);
  }
  return { xs, zs, reach };
}

/**
 * A test for whether (x, z) lies within `LOW_ROAD` of road that stands less
 * than `ROAD_OVER` over water at `level`, for a lake about (cx, cz) reaching
 * at most `radius`: the road within reach sampled once, the low points kept.
 * Road distances in `skip` (a bridge lake's own crossing) are left out.
 */
function lowRoadTest(
  ground: LakeGround,
  cx: number,
  cz: number,
  radius: number,
  level: number,
  skip?: { from: number; to: number },
): (x: number, z: number) => boolean {
  const { path } = ground.stage;
  const at: RoadSample = { x: 0, z: 0, heading: 0 };
  const near = (radius + LOW_ROAD) ** 2;
  const xs: number[] = [];
  const zs: number[] = [];
  for (let d = 0; d < path.length; d += LOW_STEP) {
    if (skip && d > skip.from && d < skip.to) continue;
    path.sample(d, at);
    if ((at.x - cx) ** 2 + (at.z - cz) ** 2 > near) continue;
    if (ground.roadHeightAt(d) >= level + ROAD_OVER) continue;
    xs.push(at.x);
    zs.push(at.z);
  }
  const r2 = LOW_ROAD * LOW_ROAD;
  return (x, z) => {
    for (let i = 0; i < xs.length; i++) if ((x - xs[i]!) ** 2 + (z - zs[i]!) ** 2 < r2) return true;
    return false;
  };
}

/** Near another lake (within `LAKE_GAP` of its shore, or in it). */
function nearLakes(lakes: readonly Lake[], x: number, z: number): boolean {
  return lakes.some((l) => lakeShoreDistance(l, x, z) > -LAKE_GAP);
}

function between(rand: () => number, r: readonly [number, number]): number {
  return r[0] + rand() * (r[1] - r[0]);
}

/** A lake the road crosses at `along` on a bridge, or null where the ground will not hold one. */
function bridgeLake(
  ground: LakeGround,
  along: number,
  lakes: readonly Lake[],
  rand: () => number,
): Lake | null {
  const { stage } = ground;
  const at: RoadSample = { x: 0, z: 0, heading: 0 };
  stage.path.sample(along, at);
  const alongAxis = between(rand, BRIDGE_ALONG);
  const across = between(rand, BRIDGE_ACROSS);
  const phases = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
  // The water stands a clearance under the lowest deck anywhere the bridge might reach.
  let deck = Infinity;
  for (let e = -alongAxis - 40; e <= alongAxis + 40; e += 2)
    deck = Math.min(deck, ground.roadHeightAt(along + e));
  const level = deck - CLEARANCE;
  // Headings here run from +x counter-clockwise in (x, z); the road's heading is from +z toward +x.
  const phi = Math.atan2(Math.cos(at.heading), Math.sin(at.heading));
  const gap = stage.halfWidth + ground.corridor + RIM + 1;
  const hit = createRoadHit();
  const own = alongAxis + 40;
  const low = lowRoadTest(ground, at.x, at.z, across * 1.3, level, {
    from: along - own,
    to: along + own,
  });
  const shore = castShore(
    at.x,
    at.z,
    (theta) => shapeRadius(theta, phi, alongAxis, across, phases),
    (x, z, run) => {
      if (stage.path.nearest(x, z, gap, hit) && Math.abs(hit.along - along) > own) return true;
      if (low(x, z)) return true;
      if (nearLakes(lakes, x, z)) return true;
      return run > BRIDGE_CORE && ground.groundHeight(x, z) > level + BRIDGE_RISE;
    },
    MIN_MEAN_BRIDGE,
  );
  if (!shore) return null;
  const lake: Lake = { cx: at.x, cz: at.z, ...shore, level, along };
  // The bridge spans the road from where the rim first reaches it to where it leaves it.
  const out: RoadSample = { x: 0, z: 0, heading: 0 };
  const reaches = (d: number) => {
    stage.path.sample(d, out);
    const ox = Math.cos(out.heading) * stage.halfWidth;
    const oz = -Math.sin(out.heading) * stage.halfWidth;
    return (
      lakeShoreDistance(lake, out.x, out.z) > -RIM ||
      lakeShoreDistance(lake, out.x + ox, out.z + oz) > -RIM ||
      lakeShoreDistance(lake, out.x - ox, out.z - oz) > -RIM
    );
  };
  let from = along;
  while (from > along - own && reaches(from - 1)) from -= 1;
  let to = along;
  while (to < along + own && reaches(to + 1)) to += 1;
  lake.bridge = { from: from - ABUTMENT, to: to + ABUTMENT };
  // A bridge must keep clear of the gates and the start and finish, abutments and all.
  if (!allowedAt(stage, lake.bridge.from, true) || !allowedAt(stage, lake.bridge.to, true))
    return null;
  // And the lake meets the road on its bridge only: nowhere else may its shore reach the road.
  for (let d = 0; d < stage.path.length; d += 2)
    if ((d < lake.bridge.from || d > lake.bridge.to) && reaches(d)) return null;
  return lake;
}

/** A lake in the valley beside the road at `along`, or null where the ground will not hold one. */
function sideLake(
  ground: LakeGround,
  along: number,
  lakes: readonly Lake[],
  rand: () => number,
): Lake | null {
  const { stage } = ground;
  const at: RoadSample = { x: 0, z: 0, heading: 0 };
  stage.path.sample(along, at);
  let alongAxis = between(rand, SIDE_ALONG);
  const out = between(rand, SIDE_OUT);
  const phases = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
  const gap = stage.halfWidth + SIDE_SHORE;
  // The water lies just under the road here; on a falling road the lake runs only as far along as
  // the road stays over it, so it never stands above the road further on.
  let road = Infinity;
  for (let e = -SIDE_LEVEL; e <= SIDE_LEVEL; e += 10)
    road = Math.min(road, ground.roadHeightAt(along + e));
  const level = road - SIDE_DROP;
  let reach = 0;
  while (
    reach < alongAxis &&
    ground.roadHeightAt(along + reach + 10) > level + 0.5 &&
    ground.roadHeightAt(along - reach - 10) > level + 0.5
  )
    reach += 10;
  alongAxis = Math.min(alongAxis, reach + out * 0.4);
  if (alongAxis < SIDE_ALONG[0] * 0.6) return null;
  // Left of travel is (cos h, −sin h). On a bend the lake fills its inside, so the road sweeps
  // round the water's edge; on a straight it lies on whichever side the ground is lower.
  const lx = Math.cos(at.heading);
  const lz = -Math.sin(at.heading);
  const a: RoadSample = { x: 0, z: 0, heading: 0 };
  const b: RoadSample = { x: 0, z: 0, heading: 0 };
  stage.path.sample(along - BEND_REACH, a);
  stage.path.sample(along + BEND_REACH, b);
  // Travel is (sin h, cos h): as the heading grows it swings toward (cos h, −sin h), so a growing
  // heading bends toward side +1.
  const turn = wrap(b.heading - a.heading);
  const probe = gap + out * 0.7;
  const left = ground.groundHeight(at.x + lx * probe, at.z + lz * probe);
  const right = ground.groundHeight(at.x - lx * probe, at.z - lz * probe);
  const lower = left < right ? 1 : -1;
  const first = Math.abs(turn) > BEND_TURN ? Math.sign(turn) : lower;
  const sides = [first, -first];
  const phi = Math.atan2(Math.cos(at.heading), Math.sin(at.heading));
  const hit = createRoadHit();
  for (const side of sides) {
    const cx = at.x + lx * side * (gap + out * 0.85);
    const cz = at.z + lz * side * (gap + out * 0.85);
    const low = lowRoadTest(ground, cx, cz, Math.max(alongAxis, out) * 1.3, level);
    const shore = castShore(
      cx,
      cz,
      (theta) => shapeRadius(theta, phi, alongAxis, out, phases),
      (x, z) =>
        stage.path.nearest(x, z, gap, hit) ||
        low(x, z) ||
        nearLakes(lakes, x, z) ||
        ground.groundHeight(x, z) > level + SIDE_RISE,
      MIN_MEAN,
    );
    if (shore) return { cx, cz, ...shore, level, along };
  }
  return null;
}

/**
 * Signed distance from the lake's shore at (x, z): positive inside, negative
 * outside. Exact for the shore segment of the point's own sector and its two
 * neighbours, which is every one that matters within a rim's width of it.
 */
export function lakeShoreDistance(lake: Lake, x: number, z: number): number {
  const dx = x - lake.cx;
  const dz = z - lake.cz;
  const d2 = dx * dx + dz * dz;
  const far = Math.sqrt(d2) - lake.reach;
  if (far > RIM + LAKE_GAP) return -far;
  let theta = Math.atan2(dz, dx);
  if (theta < 0) theta += 2 * Math.PI;
  const k = Math.min(RAYS - 1, Math.floor(theta / SECTOR));
  const { xs, zs } = lake;
  let best = Infinity;
  let inside = false;
  for (let j = -1; j <= 1; j++) {
    const a = (k + j + RAYS) % RAYS;
    const b = (a + 1) % RAYS;
    const ex = xs[b]! - xs[a]!;
    const ez = zs[b]! - zs[a]!;
    const len2 = ex * ex + ez * ez;
    let t = len2 > 0 ? ((x - xs[a]!) * ex + (z - zs[a]!) * ez) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - (xs[a]! + ex * t), z - (zs[a]! + ez * t));
    if (d < best) best = d;
    // The point's own sector says which side of the shore it is: left of a counter-clockwise edge is in.
    if (j === 0) inside = ex * (z - zs[a]!) - ez * (x - xs[a]!) > 0;
  }
  return inside ? best : -best;
}

/**
 * The ground at (x, z) given the ground `h` there before the lakes: inside a
 * lake its bed, falling from just over the water at the shore to `DEPTH`
 * under it over the shelf; over the rim outside, eased down to the shore
 * (or, where it lay under the water, held up by a levee). `h` elsewhere.
 */
export function lakeGround(lakes: readonly Lake[], x: number, z: number, h: number): number {
  let out = h;
  for (const lake of lakes) {
    const s = lakeShoreDistance(lake, x, z);
    const shore = lake.level + SHORE_LIFT;
    if (s >= 0) {
      // Dropping away at once and levelling off toward the middle, so the waterline follows the
      // shore's outline closely rather than wandering over a barely-drowned shelf.
      const t = Math.min(1, s / SHELF);
      const bed = shore - (SHORE_LIFT + DEPTH) * (1 - (1 - t) * (1 - t));
      out = Math.min(out, bed);
    } else if (out > shore) {
      if (s > -RIM) out = shore + (out - shore) * smoothstep(0, RIM, -s);
    } else {
      // Ground under the water outside: a levee holds the lake, its crest `LEVEE_TOP` wide, then
      // falling away until it meets the ground.
      out = Math.max(out, shore + LEVEE_SLOPE * Math.min(0, s + LEVEE_TOP));
    }
  }
  return out;
}

/**
 * 0..1 how near the waterline: the shore's pebbles, all over the shallow
 * shelf (whose faces break the water's surface here and there) and thinning
 * out over a few metres up the bank.
 */
export function lakeShore(lakes: readonly Lake[], x: number, z: number): number {
  let out = 0;
  for (const lake of lakes) {
    const s = lakeShoreDistance(lake, x, z);
    if (s < -RIM || s > SHELF) continue;
    out = Math.max(out, 1 - smoothstep(0, 6, -s));
  }
  return out;
}

/** The lake (x, z) lies in, or within `margin` of; null when none. */
export function lakeAt(lakes: readonly Lake[], x: number, z: number, margin = 0): Lake | null {
  for (const lake of lakes) if (lakeShoreDistance(lake, x, z) > -margin) return lake;
  return null;
}

/** A lake bridge's guard rails stand this far past the carriageway's edge (their middle), this thick. */
export const RAIL_OUT = 0.45;
export const RAIL_HALF = 0.08;
/** The deck slab reaches this far past the carriageway's edge: past the rails, so wheels ride it right up to them. */
export const DECK_OUT = RAIL_OUT + RAIL_HALF + 0.35;

/** The lake bridges' guard rails as colliders, along both edges of every span. */
export function lakeBridgeObstacles(
  stage: Pick<StageDef, 'path' | 'halfWidth'>,
  lakes: readonly Lake[],
): BoxObstacle[] {
  const spans = lakes.flatMap((l) => (l.bridge ? [l.bridge] : []));
  return edgeObstacles(stage, spans, stage.halfWidth + RAIL_OUT, RAIL_HALF);
}
