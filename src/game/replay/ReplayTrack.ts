import type { VehiclePose } from '../vehicle/interpolatePose';
import type { VehicleState } from '../vehicle/VehicleSim';

/** Floats per sample, in the order `record` writes them. */
const FIELDS = 18;
const INITIAL_SAMPLES = 4096;

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
 * The car's run, recorded one sample per fixed sim step from the start
 * signal until a few seconds past the finish, and played back as a pose at
 * any time, blended between the two samples either side. Pure data: the
 * driving session records into it and reads from it; nothing here knows
 * about rendering. Samples live in one flat buffer that doubles when full,
 * so a run costs a few megabytes at most and recording never allocates per
 * step once the buffer has grown.
 */
export class ReplayTrack {
  private data = new Float32Array(FIELDS * INITIAL_SAMPLES);
  private count = 0;

  /** `dt` is the fixed step the samples are spaced at. */
  constructor(readonly dt: number) {}

  get samples(): number {
    return this.count;
  }

  /** Seconds of driving recorded: the time of the last sample. */
  get duration(): number {
    return Math.max(0, this.count - 1) * this.dt;
  }

  clear(): void {
    this.count = 0;
  }

  record(s: Readonly<VehicleState>): void {
    if ((this.count + 1) * FIELDS > this.data.length) {
      const grown = new Float32Array(this.data.length * 2);
      grown.set(this.data);
      this.data = grown;
    }
    const d = this.data;
    let i = this.count * FIELDS;
    d[i++] = s.x;
    d[i++] = s.y;
    d[i++] = s.z;
    d[i++] = s.groundHeight;
    d[i++] = s.yaw;
    d[i++] = s.pitch;
    d[i++] = s.roll;
    d[i++] = s.vx;
    d[i++] = s.vz;
    d[i++] = s.speed;
    d[i++] = s.yawRate;
    d[i++] = s.latAccel;
    d[i++] = s.steerAngle;
    d[i++] = s.wheelAngle;
    d[i++] = s.rpm;
    d[i++] = s.gear;
    d[i++] = s.grounded ? 1 : 0;
    d[i] = s.turboActive ? 1 : 0;
    this.count++;
  }

  /** The pose `time` seconds into the run (clamped to the track), blended between the samples either side. */
  sampleAt(time: number, out: VehiclePose): VehiclePose {
    if (this.count === 0) return out;
    const last = this.count - 1;
    const f = Math.min(Math.max(time / this.dt, 0), last);
    const i = Math.min(Math.floor(f), Math.max(0, last - 1));
    const j = Math.min(i + 1, last);
    const t = f - i;
    const a = i * FIELDS;
    const b = j * FIELDS;
    const d = this.data;
    out.x = lerp(d[a]!, d[b]!, t);
    out.y = lerp(d[a + 1]!, d[b + 1]!, t);
    out.z = lerp(d[a + 2]!, d[b + 2]!, t);
    out.groundHeight = lerp(d[a + 3]!, d[b + 3]!, t);
    out.yaw = lerpAngle(d[a + 4]!, d[b + 4]!, t);
    out.pitch = lerp(d[a + 5]!, d[b + 5]!, t);
    out.roll = lerp(d[a + 6]!, d[b + 6]!, t);
    out.vx = lerp(d[a + 7]!, d[b + 7]!, t);
    out.vz = lerp(d[a + 8]!, d[b + 8]!, t);
    out.speed = lerp(d[a + 9]!, d[b + 9]!, t);
    out.yawRate = lerp(d[a + 10]!, d[b + 10]!, t);
    out.latAccel = lerp(d[a + 11]!, d[b + 11]!, t);
    out.steerAngle = lerp(d[a + 12]!, d[b + 12]!, t);
    out.wheelAngle = lerpAngle(d[a + 13]!, d[b + 13]!, t);
    out.rpm = lerp(d[a + 14]!, d[b + 14]!, t);
    out.gear = d[b + 15]!;
    out.grounded = d[b + 16]! > 0.5;
    out.turboActive = d[b + 17]! > 0.5;
    return out;
  }
}
