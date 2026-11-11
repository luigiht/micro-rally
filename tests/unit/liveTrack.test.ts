import { describe, expect, it } from 'vitest';
import {
  GHOST_DELAY,
  GhostTrack,
  LIVE_FIELDS,
  LIVE_SAMPLE_DT,
  LIVE_WINDOW,
  LiveOutbox,
  parseLiveRecord,
} from '@/game/multiplayer/LiveTrack';
import { createVehiclePose } from '@/game/vehicle/interpolatePose';

/** A car driving straight down +z at `speed` m/s: its pose at run clock `t`. */
function poseAt(t: number, speed = 20) {
  const p = createVehiclePose();
  p.z = speed * t;
  p.speed = speed;
  return p;
}

/** The sender's windows for a run sampled every frame of `frame` seconds up to `until`. */
function drive(outbox: LiveOutbox, until: number, frame = 1 / 60) {
  for (let t = 0; t <= until + 1e-9; t += frame) outbox.push(t, poseAt(t), 0, t / 100);
}

describe('LiveOutbox', () => {
  it('samples ten times a second of run clock and keeps the last window', () => {
    const outbox = new LiveOutbox();
    drive(outbox, 3);
    const w = outbox.window();
    expect(w.length).toBe(LIVE_FIELDS * LIVE_WINDOW);
    const times = w.filter((_, i) => i % LIVE_FIELDS === 0);
    // The newest sample is the last one due at or before t = 3.
    expect(3 - times.at(-1)!).toBeLessThan(LIVE_SAMPLE_DT + 1 / 60);
    for (let i = 1; i < times.length; i++)
      expect(times[i]! - times[i - 1]!).toBeCloseTo(LIVE_SAMPLE_DT, 1);
    // z rides in the fourth slot, rounded to the millimetre (as is t, hence the tolerance).
    expect(w[3]).toBeCloseTo(20 * times[0]!, 1);
    expect(Math.abs(w[3]! * 1000 - Math.round(w[3]! * 1000))).toBeLessThan(1e-6);
    expect(parseLiveRecord({ stageIndex: 0, run: 'r', samples: w })).not.toBeNull();
  });

  it('starts empty again when cleared', () => {
    const outbox = new LiveOutbox();
    drive(outbox, 1);
    outbox.clear();
    expect(outbox.window()).toEqual([]);
    expect(outbox.due(0)).toBe(true);
  });
});

describe('parseLiveRecord', () => {
  const ok = { stageIndex: 1, run: 'abc', samples: new Array<number>(LIVE_FIELDS).fill(0) };

  it('accepts a well-formed window and refuses junk', () => {
    expect(parseLiveRecord(ok)).toEqual(ok);
    expect(parseLiveRecord({ ...ok, stageIndex: -1 })).toBeNull();
    expect(parseLiveRecord({ ...ok, run: '' })).toBeNull();
    expect(parseLiveRecord({ ...ok, run: 'x'.repeat(33) })).toBeNull();
    expect(parseLiveRecord({ ...ok, samples: [1, 2, 3] })).toBeNull();
    expect(parseLiveRecord({ ...ok, samples: [...ok.samples.slice(1), Number.NaN] })).toBeNull();
    const tooMany = new Array<number>(LIVE_FIELDS * (LIVE_WINDOW + 1)).fill(0);
    expect(parseLiveRecord({ ...ok, samples: tooMany })).toBeNull();
    // Times must rise.
    expect(parseLiveRecord({ ...ok, samples: [...ok.samples, ...ok.samples] })).toBeNull();
    expect(parseLiveRecord(null)).toBeNull();
  });
});

describe('GhostTrack', () => {
  /** Receive the sender's window every `every` seconds while the local frames tick at 60 Hz. */
  function play(seconds: number, every = 0.25) {
    const outbox = new LiveOutbox();
    const ghost = new GhostTrack();
    const out = createVehiclePose();
    const frame = 1 / 60;
    let sinceSend = every;
    let lastZ = Number.NaN;
    let backwards = false;
    for (let t = 0; t <= seconds; t += frame) {
      outbox.push(t, poseAt(t), 0, 0);
      sinceSend += frame;
      if (sinceSend >= every) {
        ghost.ingest('run-1', outbox.window());
        sinceSend = 0;
      }
      ghost.advance(frame);
      if (ghost.sample(out, frame)) {
        if (out.z < lastZ - 1e-6) backwards = true;
        lastZ = out.z;
      }
    }
    return { ghost, out, backwards, senderZ: poseAt(seconds).z };
  }

  it('plays the other car back smoothly, about the delay behind', () => {
    const { out, backwards, senderZ } = play(6);
    expect(backwards).toBe(false);
    const lagSeconds = (senderZ - out.z) / 20;
    expect(lagSeconds).toBeGreaterThan(GHOST_DELAY - 0.35);
    expect(lagSeconds).toBeLessThan(GHOST_DELAY + 0.35);
    expect(out.speed).toBeCloseTo(20);
  });

  it('turns the wheels by the distance covered', () => {
    const ghost = new GhostTrack();
    const outbox = new LiveOutbox();
    drive(outbox, 1);
    ghost.ingest('r', outbox.window());
    const out = createVehiclePose();
    ghost.advance(0);
    ghost.sample(out, 0.5, 0.25);
    expect(out.wheelAngle).toBeCloseTo((20 * 0.5) / 0.25);
  });

  it('holds the last pose when samples stop, and starts over for a new run', () => {
    const ghost = new GhostTrack();
    const outbox = new LiveOutbox();
    drive(outbox, 2);
    const window = outbox.window();
    ghost.ingest('a', window);
    const out = createVehiclePose();
    for (let i = 0; i < 600; i++) ghost.advance(1 / 60);
    ghost.sample(out);
    // Parked on the newest sample's position (z is the fourth field).
    expect(out.z).toBe(window[window.length - LIVE_FIELDS + 3]);

    const fresh = new LiveOutbox();
    fresh.push(0, poseAt(0), 0, 0);
    ghost.ingest('b', fresh.window());
    ghost.advance(1 / 60);
    ghost.sample(out);
    expect(out.z).toBe(0);
  });

  it('jumps rather than slides across a teleport back to a checkpoint', () => {
    const ghost = new GhostTrack();
    const near = poseAt(1);
    const far = poseAt(1.1);
    far.z = near.z - 200;
    const samples: number[] = [];
    for (const [t, p] of [
      [1, near],
      [1.1, far],
    ] as const) {
      const o = new LiveOutbox();
      o.push(t, p, 0, 0);
      samples.push(...o.window());
    }
    ghost.ingest('r', samples);
    ghost.advance(0);
    const out = createVehiclePose();
    ghost.sample(out);
    expect([near.z, far.z]).toContain(out.z);
  });

  it('shows nothing before any sample arrives', () => {
    const ghost = new GhostTrack();
    ghost.advance(1);
    expect(ghost.sample(createVehiclePose())).toBe(false);
    expect(ghost.empty).toBe(true);
  });
});
