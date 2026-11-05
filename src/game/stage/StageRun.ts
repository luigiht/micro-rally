import type { SpawnPose } from '../vehicle/VehicleSim';
import { CheckpointTracker } from './Checkpoints';
import { lapTimes } from './CircuitStage';
import { createRoadHit, type RoadHit, type RoadSample } from './RoadPath';
import type { StageDef } from './StageGenerator';

export type RunPhase = 'countdown' | 'running' | 'finished';

export const COUNTDOWN_SECONDS = 3;
export const TREE_PENALTY_SECONDS = 2;
export const REPAIR_FEE = 25;
const HIT_SPEED = 3;
const HIT_COOLDOWN = 1;
const RESPAWN_BACKOFF = 6;

/** Stage timing state machine: countdown → running → finished. Advanced in fixed sim steps. */
export class StageRun {
  phase: RunPhase = 'countdown';
  countdown = COUNTDOWN_SECONDS;
  /** Driving time, excluding penalties. */
  time = 0;
  penalties = 0;
  repairCost = 0;
  hits = 0;
  readonly splits: number[] = [];
  /** Driving time (no penalties) at each gate passed: a replay's clock, to know which lap it is on. */
  readonly passTimes: number[] = [];
  /** Gates counted as passed before the run started (the `?spawn=` aid); `splits` begin after them. */
  private skipped = 0;
  private readonly tracker: CheckpointTracker;
  private hitCooldown = 0;
  private readonly sample: RoadSample = { x: 0, z: 0, heading: 0 };
  private readonly hit: RoadHit = createRoadHit();
  private progressValue = 0;

  constructor(readonly stage: StageDef) {
    this.tracker = new CheckpointTracker(stage.gates);
  }

  get totalTime(): number {
    return this.time + this.penalties;
  }

  get gatesPassed(): number {
    return this.tracker.next;
  }

  get canDrive(): boolean {
    return this.phase !== 'countdown';
  }

  /** Where each gate sits along the stage as a 0..1 fraction; the finish is 1. */
  get gateFractions(): number[] {
    return this.stage.gates.map((g) => this.fraction(g.distance));
  }

  /**
   * How far along the stage the car is (0..1), from the nearest centreline
   * point. Holds the last value while the car is far off the road, so cutting
   * a bend never jolts the bar. On a circuit the lap is unwrapped: of the
   * points one lap apart, the one within half a lap of the last gate passed.
   */
  progressAt(x: number, z: number, gatesPassed = this.tracker.next): number {
    if (this.stage.path.nearest(x, z, this.stage.halfWidth * 6, this.hit)) {
      this.progressValue = this.fraction(this.raceDistance(this.hit.along, gatesPassed));
    }
    return this.progressValue;
  }

  /** Gates the run had passed `elapsed` seconds of driving after the start signal: a replay's view of the run. */
  gatesPassedAt(elapsed: number): number {
    let n = 0;
    while (n < this.passTimes.length && this.passTimes[n]! <= elapsed) n++;
    return this.skipped + n;
  }

  /** The lap a replay is on at `elapsed` seconds, 1-based. */
  lapAt(elapsed: number): number {
    return this.lapAfter(this.gatesPassedAt(elapsed));
  }

  /** A lap position (`along` on the closed path) as race distance, next to the last gate passed. */
  private raceDistance(along: number, gatesPassed: number): number {
    const circuit = this.stage.circuit;
    if (!circuit) return along;
    const passed = gatesPassed - 1;
    const ref = passed >= 0 ? this.stage.gates[passed]!.distance : this.stage.startDistance;
    const lap = circuit.lapLength;
    return along + Math.round((ref - along) / lap) * lap;
  }

  /** The lap being driven, 1-based (1 on an open stage). */
  get lap(): number {
    return this.lapAfter(this.tracker.next);
  }

  private lapAfter(gatesPassed: number): number {
    if (!this.stage.circuit) return 1;
    const done = this.stage.gates
      .slice(0, gatesPassed)
      .filter((g) => g.kind === 'lap' || g.kind === 'finish').length;
    return Math.min(this.stage.circuit.laps, done + 1);
  }

  /** Times of the laps completed so far (empty on an open stage). */
  get laps(): number[] {
    return this.stage.circuit ? lapTimes(this.stage.gates.slice(this.skipped), this.splits) : [];
  }

  /** Fastest completed lap, or null before the first. */
  get bestLap(): number | null {
    const laps = this.laps;
    return laps.length > 0 ? Math.min(...laps) : null;
  }

  /** Start-to-finish fraction for a road distance, clamped to 0..1. */
  private fraction(along: number): number {
    const f = (along - this.stage.startDistance) / this.stage.length;
    return f < 0 ? 0 : f > 1 ? 1 : f;
  }

  tick(dt: number): void {
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.phase = 'running';
      }
    } else if (this.phase === 'running') {
      this.time += dt;
      this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    }
  }

  /** Feed each sim step's movement; returns the gate index passed, or -1. */
  onMove(px: number, pz: number, x: number, z: number): number {
    if (this.phase !== 'running') return -1;
    const gate = this.tracker.update(px, pz, x, z);
    if (gate >= 0) {
      this.splits.push(this.totalTime);
      this.passTimes.push(this.time);
      if (this.tracker.finished) this.phase = 'finished';
    }
    return gate;
  }

  /** Returns true when the impact counts as a hit (time penalty + repair fee). */
  onImpact(speed: number): boolean {
    if (this.phase !== 'running' || speed < HIT_SPEED || this.hitCooldown > 0) return false;
    this.hits++;
    this.penalties += TREE_PENALTY_SECONDS;
    this.repairCost += REPAIR_FEE;
    this.hitCooldown = HIT_COOLDOWN;
    return true;
  }

  /**
   * Development aid for spawning part-way along a stage: count every
   * checkpoint before `along` metres as passed, so the finish still counts.
   */
  skipGatesBefore(along: number): void {
    this.tracker.next = this.stage.gates.filter(
      (g) => g.kind !== 'finish' && g.distance < along,
    ).length;
    this.skipped = this.tracker.next;
  }

  /** Pose just before the last passed gate (or the start line). */
  respawnPose(out: SpawnPose): SpawnPose {
    const passed = this.tracker.next - 1;
    if (passed < 0) {
      out.x = this.stage.spawn.x;
      out.z = this.stage.spawn.z;
      out.yaw = this.stage.spawn.yaw;
      return out;
    }
    const gate = this.stage.gates[passed]!;
    this.stage.path.sample(gate.distance + RESPAWN_BACKOFF, this.sample);
    out.x = this.sample.x;
    out.z = this.sample.z;
    out.yaw = this.sample.heading;
    return out;
  }
}
