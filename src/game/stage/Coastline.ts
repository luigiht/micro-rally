import type { BoxObstacle } from '../vehicle/Collisions';
import { type AxisPoint, type CoastShape, type CoastSurface } from './CoastShape';
import type { RoadSample } from './RoadPath';
import type { StageDef } from './StageGenerator';

/**
 * A Coast stage's ground and its walls, for the terrain and the renderer:
 * the `CoastShape`'s land read in world coordinates, and the runs of wall
 * along whichever side of the road the ground falls away. Pure TS,
 * deterministic from the stage, so the main thread and the terrain worker
 * agree.
 */

/** Wall centre line this far beyond the road edge: the marker posts (1.4 m) stand in front of it. */
export const SEAWALL_OFFSET = 2.1;
export const SEAWALL_HALF = 0.28;
/** The wall stands where the ground this far beyond the road edge lies at least `WALL_DROP` below the road's. */
const WALL_PROBE = 10;
const WALL_DROP = 3;
const WALL_GATE_CLEARANCE = 10;
const WALL_MIN_RUN = 12;
const WALL_MIN_GAP = 6;

/** Left (+1) or right (−1) of travel. */
export type RoadSide = 1 | -1;

export interface CoastWall {
  from: number;
  to: number;
  side: RoadSide;
}

/** A point on a wall line with the road's heading there. */
export interface WallPoint {
  x: number;
  z: number;
  heading: number;
}

/** One run of wall between two points on its line. */
export interface WallSegment {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export class Coastline {
  readonly halfWidth: number;
  readonly seaLevel: number;
  /** Where the walls stand, as distances along the road, per side. */
  readonly walls: readonly CoastWall[];
  private readonly ax: AxisPoint = { u: 0, v: 0 };
  private readonly scratch: RoadSample = { x: 0, z: 0, heading: 0 };

  constructor(
    readonly stage: StageDef,
    readonly shape: CoastShape,
  ) {
    this.halfWidth = stage.halfWidth;
    this.seaLevel = shape.seaLevel;
    this.walls = this.buildWalls();
  }

  /** The bare ground, before the road bed is cut in. */
  ground(x: number, z: number): number {
    const a = this.shape.toAxis(x, z, this.ax);
    return this.shape.ground(a.u, a.v, x, z);
  }

  /** 1 on the cliff band and the outcrops, 0 on sand and scrub. */
  rockiness(x: number, z: number): number {
    const a = this.shape.toAxis(x, z, this.ax);
    return this.shape.rockiness(a.u, a.v, x, z);
  }

  /** Rock, scree and dry grass here, for the terrain's colouring. */
  surface(x: number, z: number, out: CoastSurface): CoastSurface {
    const a = this.shape.toAxis(x, z, this.ax);
    return this.shape.surface(a.u, a.v, x, z, out);
  }

  /** Metres inland of the water line; negative at sea. */
  shoreDistance(x: number, z: number): number {
    const a = this.shape.toAxis(x, z, this.ax);
    return a.v - this.shape.shore(a.u);
  }

  /** Steepness of the bare ground: rise per metre, over a 3 m span. */
  slopeAt(x: number, z: number): number {
    const dx = this.ground(x + 1.5, z) - this.ground(x - 1.5, z);
    const dz = this.ground(x, z + 1.5) - this.ground(x, z - 1.5);
    return Math.hypot(dx, dz) / 3;
  }

  /** The point on the wall line `along` the road on `side`, `inset` metres back toward the road. */
  wallPoint(
    along: number,
    side: RoadSide,
    inset = 0,
    out: WallPoint = { x: 0, z: 0, heading: 0 },
  ): WallPoint {
    const s = this.scratch;
    this.stage.path.sample(along, s);
    const off = (this.halfWidth + SEAWALL_OFFSET - inset) * side;
    out.x = s.x + Math.cos(s.heading) * off;
    out.z = s.z - Math.sin(s.heading) * off;
    out.heading = s.heading;
    return out;
  }

  /** Runs of wall per side: where the ground falls away beside the road and no gate stands. */
  private buildWalls(): CoastWall[] {
    const path = this.stage.path;
    const step = path.spacing;
    const keepOut = [this.stage.startDistance, ...this.stage.gates.map((g) => g.distance)];
    const count = Math.floor(path.length / step) + 1;
    const want: Record<RoadSide, Uint8Array> = {
      1: new Uint8Array(count),
      [-1]: new Uint8Array(count),
    };
    const s = this.scratch;
    const probe = this.halfWidth + WALL_PROBE;
    for (let i = 0; i < count; i++) {
      const along = i * step;
      if (keepOut.some((k) => Math.abs(k - along) < WALL_GATE_CLEARANCE)) continue;
      path.sample(along, s);
      const here = this.ground(s.x, s.z);
      const lx = Math.cos(s.heading);
      const lz = -Math.sin(s.heading);
      for (const side of [1, -1] as const) {
        const there = this.ground(s.x + lx * probe * side, s.z + lz * probe * side);
        if (here - there >= WALL_DROP) want[side][i] = 1;
      }
    }
    const out: CoastWall[] = [];
    for (const side of [1, -1] as const) {
      const flags = want[side];
      const runs: CoastWall[] = [];
      for (let i = 0; i < count; i++) {
        if (!flags[i]) continue;
        let j = i;
        while (j + 1 < count && flags[j + 1]) j++;
        runs.push({ from: i * step, to: j * step, side });
        i = j;
      }
      // Close gaps too short to read as a break (gate breaks are wider), then drop stubs too short to build.
      const merged: CoastWall[] = [];
      for (const run of runs) {
        const prev = merged[merged.length - 1];
        if (prev && run.from - prev.to < WALL_MIN_GAP) prev.to = run.to;
        else merged.push({ ...run });
      }
      out.push(...merged.filter((w) => w.to - w.from >= WALL_MIN_RUN));
    }
    return out;
  }

  /** The wall lines, `step` metres a piece. */
  wallSegments(step: number): WallSegment[] {
    const out: WallSegment[] = [];
    const a = { x: 0, z: 0, heading: 0 };
    const b = { x: 0, z: 0, heading: 0 };
    for (const w of this.walls) {
      for (let d = w.from; d < w.to; d += step) {
        this.wallPoint(d, w.side, 0, a);
        this.wallPoint(Math.min(w.to, d + step), w.side, 0, b);
        out.push({ x0: a.x, z0: a.z, x1: b.x, z1: b.z });
      }
    }
    return out;
  }
}

/** The walls as oriented boxes the car bounces off, so the drop behind them is never driven. */
export function seaWallObstacles(coast: Coastline): BoxObstacle[] {
  return coast.wallSegments(4).map((s) => {
    const dx = s.x1 - s.x0;
    const dz = s.z1 - s.z0;
    return {
      x: (s.x0 + s.x1) / 2,
      z: (s.z0 + s.z1) / 2,
      hx: SEAWALL_HALF,
      hz: Math.hypot(dx, dz) / 2 + 0.2,
      yaw: Math.atan2(dx, dz),
    };
  });
}
