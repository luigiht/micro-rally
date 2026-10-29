import type { SpawnPose } from '../vehicle/VehicleSim';
import { CheckpointTracker } from './Checkpoints';
import type { RoadSample } from './RoadPath';
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
  private readonly tracker: CheckpointTracker;
  private hitCooldown = 0;
  private readonly sample: RoadSample = { x: 0, z: 0, heading: 0 };

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
