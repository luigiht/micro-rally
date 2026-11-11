import type { VehiclePose } from '../vehicle/interpolatePose';

/**
 * Live positions between the two drivers of a session. The sender samples
 * its car ten times a second of its own run clock and keeps the last second
 * of samples (`LiveOutbox`); each exchange with the server carries that whole
 * window, so a lost exchange loses nothing. The receiver merges the windows
 * into a short track and plays it back a little behind the newest sample
 * (`GhostTrack`), which hides batching and network jitter. Pure data: no
 * clocks, timers or networking here.
 */

/** Numbers per sample: t, x, y, z, groundHeight, yaw, pitch, roll, speed, steerAngle, latAccel, brake, progress. */
export const LIVE_FIELDS = 13;
/** Seconds of the sender's run clock between samples. */
export const LIVE_SAMPLE_DT = 0.1;
/** Samples per message: the last 1.2 s. */
export const LIVE_WINDOW = 12;
/** A record the server hasn't heard about for this long means its driver has left the stage. */
export const LIVE_STALE_MS = 4000;
/** Run IDs are short random tokens; this caps what the server accepts. */
const MAX_RUN_LENGTH = 32;
/** More stages than any session has; keeps junk out of the server. */
const MAX_STAGE = 64;

/** One driver's latest window on the stage they're driving. */
export interface LiveRecord {
  stageIndex: number;
  /** New for every run of the stage (a restart starts a new one), so the receiver can start over. */
  run: string;
  /** `LIVE_FIELDS` numbers per sample, oldest first, times rising. */
  samples: number[];
}

/** Validate a record from the wire; null when malformed. */
export function parseLiveRecord(raw: unknown): LiveRecord | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const { stageIndex, run, samples } = raw as Record<string, unknown>;
  if (!Number.isInteger(stageIndex) || (stageIndex as number) < 0) return null;
  if ((stageIndex as number) >= MAX_STAGE) return null;
  if (typeof run !== 'string' || run.length === 0 || run.length > MAX_RUN_LENGTH) return null;
  if (!Array.isArray(samples) || samples.length % LIVE_FIELDS !== 0) return null;
  if (samples.length > LIVE_FIELDS * LIVE_WINDOW) return null;
  if (!samples.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  for (let i = LIVE_FIELDS; i < samples.length; i += LIVE_FIELDS)
    if (samples[i]! <= samples[i - LIVE_FIELDS]!) return null;
  return { stageIndex: stageIndex as number, run, samples: samples as number[] };
}

/** Millimetres and milliradians are plenty, and keep the JSON short. */
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** The sender's side: a sample every `LIVE_SAMPLE_DT` of run clock, the last `LIVE_WINDOW` kept. */
export class LiveOutbox {
  private readonly ring = new Float64Array(LIVE_FIELDS * LIVE_WINDOW);
  private count = 0;
  private head = 0;
  private nextT = 0;

  /** True when a sample is due at run clock `t`. */
  due(t: number): boolean {
    return this.count === 0 || t >= this.nextT;
  }

  /** Record the car at run clock `t`; allocation-free, so it can run every frame. */
  push(t: number, pose: Readonly<VehiclePose>, brake: number, progress: number): void {
    if (!this.due(t)) return;
    const r = this.ring;
    let i = this.head * LIVE_FIELDS;
    r[i++] = t;
    r[i++] = pose.x;
    r[i++] = pose.y;
    r[i++] = pose.z;
    r[i++] = pose.groundHeight;
    r[i++] = pose.yaw;
    r[i++] = pose.pitch;
    r[i++] = pose.roll;
    r[i++] = pose.speed;
    r[i++] = pose.steerAngle;
    r[i++] = pose.latAccel;
    r[i++] = brake;
    r[i] = progress;
    this.head = (this.head + 1) % LIVE_WINDOW;
    this.count = Math.min(this.count + 1, LIVE_WINDOW);
    // A long frame skips ahead rather than queuing samples to catch up.
    this.nextT = Math.max(this.nextT + LIVE_SAMPLE_DT, t);
  }

  /** The window to send, oldest sample first (allocates; called a few times a second). */
  window(): number[] {
    const out: number[] = [];
    const first = (this.head - this.count + LIVE_WINDOW) % LIVE_WINDOW;
    for (let n = 0; n < this.count; n++) {
      const base = ((first + n) % LIVE_WINDOW) * LIVE_FIELDS;
      for (let f = 0; f < LIVE_FIELDS; f++) out.push(round3(this.ring[base + f]!));
    }
    return out;
  }

  clear(): void {
    this.count = 0;
    this.head = 0;
    this.nextT = 0;
  }
}

/** Samples the receiver keeps: 6.4 s, far more than the delay needs. */
const CAPACITY = 64;
/** Seconds the playback trails the newest sample: covers the window cadence plus a slow exchange. */
export const GHOST_DELAY = 0.9;
/** Further than this from where it should be, the playhead jumps instead of catching up. */
const SNAP = 2;
/** How hard the playback rate leans into closing the gap to its target, per second of gap. */
const CATCH_UP = 0.5;
/** Two samples further apart than this (metres) are a teleport (back to a checkpoint): no blending across. */
const TELEPORT = 15;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

/**
 * The receiver's side: the other car's recent samples and a playhead that
 * runs on the local frame clock, `GHOST_DELAY` behind the newest sample. It
 * eases faster or slower to hold that lag, holds the last pose when samples
 * stop (the other driver paused), and jumps when far off (first samples, a
 * long outage). Allocation-free per frame.
 */
export class GhostTrack {
  private readonly buf = new Float64Array(LIVE_FIELDS * CAPACITY);
  private count = 0;
  private first = 0;
  private run: string | null = null;
  private playhead = Number.NaN;
  /** Metres covered at the playhead, which spins the wheels. */
  distance = 0;
  /** Brake input at the playhead, 0..1, for the brake lamps. */
  brake = 0;
  /** Stage progress at the playhead, 0..1. */
  progress = 0;

  get empty(): boolean {
    return this.count === 0;
  }

  private t(n: number): number {
    return this.buf[((this.first + n) % CAPACITY) * LIVE_FIELDS]!;
  }

  private get newest(): number {
    return this.t(this.count - 1);
  }

  /** Merge a window from the server: samples newer than any held; a new run starts over. */
  ingest(run: string, samples: readonly number[]): void {
    if (run !== this.run) {
      this.clear();
      this.run = run;
    }
    for (let i = 0; i + LIVE_FIELDS <= samples.length; i += LIVE_FIELDS) {
      if (this.count > 0 && samples[i]! <= this.newest) continue;
      if (this.count === CAPACITY) {
        this.first = (this.first + 1) % CAPACITY;
        this.count--;
      }
      const base = ((this.first + this.count) % CAPACITY) * LIVE_FIELDS;
      for (let f = 0; f < LIVE_FIELDS; f++) this.buf[base + f] = samples[i + f]!;
      this.count++;
    }
  }

  clear(): void {
    this.count = 0;
    this.first = 0;
    this.run = null;
    this.playhead = Number.NaN;
    this.distance = 0;
  }

  /** Move the playhead on by a frame of `dt` seconds. */
  advance(dt: number): void {
    if (this.count === 0) return;
    const oldest = this.t(0);
    const newest = this.newest;
    const target = Math.max(oldest, newest - GHOST_DELAY);
    const gap = target - this.playhead;
    if (Number.isNaN(this.playhead) || Math.abs(gap) > SNAP) {
      this.playhead = target;
      return;
    }
    const rate = Math.min(1.5, Math.max(0.5, 1 + gap * CATCH_UP));
    this.playhead = Math.min(newest, Math.max(oldest, this.playhead + dt * rate));
  }

  /**
   * The pose at the playhead into `out`, false when there is nothing to show.
   * The wheels turn by the distance covered over this frame's `dt`.
   */
  sample(out: VehiclePose, dt = 0, wheelRadius = 0.3): boolean {
    if (this.count === 0 || Number.isNaN(this.playhead)) return false;
    let n = 0;
    while (n < this.count - 2 && this.t(n + 1) <= this.playhead) n++;
    const a = ((this.first + n) % CAPACITY) * LIVE_FIELDS;
    const b = ((this.first + Math.min(n + 1, this.count - 1)) % CAPACITY) * LIVE_FIELDS;
    const buf = this.buf;
    const span = buf[b]! - buf[a]!;
    let k = span > 0 ? Math.min(1, Math.max(0, (this.playhead - buf[a]!) / span)) : 1;
    const jump = Math.hypot(buf[b + 1]! - buf[a + 1]!, buf[b + 3]! - buf[a + 3]!);
    if (jump > TELEPORT) k = k < 1 ? 0 : 1;
    out.x = lerp(buf[a + 1]!, buf[b + 1]!, k);
    out.y = lerp(buf[a + 2]!, buf[b + 2]!, k);
    out.z = lerp(buf[a + 3]!, buf[b + 3]!, k);
    out.groundHeight = lerp(buf[a + 4]!, buf[b + 4]!, k);
    out.yaw = lerpAngle(buf[a + 5]!, buf[b + 5]!, k);
    out.pitch = lerp(buf[a + 6]!, buf[b + 6]!, k);
    out.roll = lerp(buf[a + 7]!, buf[b + 7]!, k);
    out.speed = lerp(buf[a + 8]!, buf[b + 8]!, k);
    out.steerAngle = lerp(buf[a + 9]!, buf[b + 9]!, k);
    out.latAccel = lerp(buf[a + 10]!, buf[b + 10]!, k);
    this.brake = lerp(buf[a + 11]!, buf[b + 11]!, k);
    this.progress = lerp(buf[a + 12]!, buf[b + 12]!, k);
    this.distance += out.speed * dt;
    out.wheelAngle = this.distance / wheelRadius;
    return true;
  }
}
