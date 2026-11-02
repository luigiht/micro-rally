import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CinematicCameraRig } from '@/components/game/cameras/CinematicCameraRig';
import {
  anglesFrom,
  createDirector,
  isFixed,
  isNeutral,
  nextShot,
  openingPosition,
  trackingPosition,
  wrapAngle,
  type Pt3,
  type Shot,
  type ShotKind,
} from '@/components/game/cameras/CinematicShots';
import { RoadPath } from '@/game/stage/RoadPath';
import type { RoadWidthSource } from '@/game/stage/RoadWidth';
import type { TerrainQuery } from '@/game/vehicle/Terrain';
import { createVehiclePose, type VehiclePose } from '@/game/vehicle/interpolatePose';

const flat: TerrainQuery = { heightAt: () => 0, surfaceAt: () => 'tarmac' };
/** A straight stage road running up +z for two kilometres. */
const road: RoadWidthSource = { halfWidth: 4, path: RoadPath.fromPolyline([0, 0, 0, 2000], 4) };
const DEG = Math.PI / 180;

function moving(x: number, z: number, yaw: number, speed: number): VehiclePose {
  const t = createVehiclePose();
  t.x = x;
  t.y = 0.5;
  t.z = z;
  t.yaw = yaw;
  t.speed = speed;
  t.vx = Math.sin(yaw) * speed;
  t.vz = Math.cos(yaw) * speed;
  return t;
}

function frameFor(target: VehiclePose, reducedMotion = false) {
  return {
    camera: new PerspectiveCamera(60, 16 / 9, 0.1, 500),
    target,
    dt: 1 / 60,
    reducedMotion,
  };
}

type Frame = ReturnType<typeof frameFor>;

/** One 60 Hz step of the car along its heading, turning at `yawRate` rad/s. */
function step(f: Frame, yawRate = 0): void {
  const t = f.target;
  t.yaw += yawRate / 60;
  t.vx = Math.sin(t.yaw) * t.speed;
  t.vz = Math.cos(t.yaw) * t.speed;
  t.x += t.vx / 60;
  t.z += t.vz / 60;
}

/** True when the car's body sits inside the camera's frame. */
function inFrame(f: Frame): boolean {
  f.camera.updateMatrixWorld();
  const p = new Vector3(f.target.x, f.target.y, f.target.z).project(f.camera);
  return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z < 1;
}

function carDistance(f: Frame): number {
  return f.camera.position.distanceTo(new Vector3(f.target.x, f.target.y, f.target.z));
}

/** Draw shots from a fresh director until one of `kind` comes up. */
function shotOfKind(kind: ShotKind, t: VehiclePose, seed = 3): Shot {
  const d = createDirector(seed);
  for (let i = 0; i < 400; i++) {
    const shot = nextShot(d, t, null, road, flat, 1, false);
    if (shot.kind === kind) return shot;
  }
  throw new Error(`no ${kind} in 400 draws`);
}

describe('cinematic director', () => {
  it('keeps the 180° and 30° rules, rests the helicopter, caps trackside runs and uses every shot', () => {
    const t = moving(0, 100, 0, 22);
    const seen = new Set<ShotKind>();
    for (const seed of [1, 2, 3]) {
      const d = createDirector(seed);
      let prev: Shot | null = null;
      let from: Pt3 | null = null;
      let run = 0;
      let sinceHelicopter = 99;
      for (let i = 0; i < 200; i++) {
        const shot = nextShot(d, t, from, road, flat, 1, false);
        seen.add(shot.kind);
        expect(shot.duration).toBeGreaterThan(3);
        expect(shot.duration).toBeLessThan(13);
        if (prev && !isNeutral(prev.kind)) expect(shot.side).toBe(prev.side);
        if (prev && prev.kind !== 'trackside') expect(shot.kind).not.toBe(prev.kind);
        run = shot.kind === 'trackside' ? run + 1 : 0;
        expect(run).toBeLessThanOrEqual(2);
        if (shot.kind === 'helicopter') {
          expect(sinceHelicopter).toBeGreaterThanOrEqual(3);
          sinceHelicopter = 0;
        } else sinceHelicopter++;
        if (from) {
          const a = anglesFrom(t, from);
          const b = anglesFrom(t, openingPosition(shot, t, { x: 0, y: 0, z: 0 }));
          const turned = Math.abs(wrapAngle(b.bearing - a.bearing)) >= 30 * DEG - 1e-9;
          const lifted = Math.abs(b.elevation - a.elevation) >= 30 * DEG - 1e-9;
          expect(turned || lifted, `${prev?.kind} → ${shot.kind}`).toBe(true);
        }
        // The car drives on 150 m before the next cut; a fixed camera is then behind it, a tracking one still beside it.
        t.z += 150;
        from = isFixed(shot.kind)
          ? { x: shot.x, y: shot.y, z: shot.z }
          : trackingPosition(shot, t, t.yaw, 0, 1, { x: 0, y: 0, z: 0 });
        prev = shot;
      }
    }
    expect(seen.size).toBe(5);
  });

  it('stands a trackside camera on the verge ahead, further ahead the faster the car goes', () => {
    const slow = shotOfKind('trackside', moving(0, 100, 0, 10));
    const fast = shotOfKind('trackside', moving(0, 100, 0, 40));
    for (const shot of [slow, fast]) {
      // On the verge: inside the 3 m the scenery keeps clear of trees beside the carriageway.
      expect(Math.abs(shot.x)).toBeGreaterThanOrEqual(road.halfWidth + 1.2);
      expect(Math.abs(shot.x)).toBeLessThanOrEqual(road.halfWidth + 2.8);
      expect(shot.y).toBeGreaterThanOrEqual(1.6);
      expect(shot.minFov).toBe(14);
      expect(shot.maxFov).toBe(50);
    }
    expect(slow.z).toBeCloseTo(100 + 56, 0);
    expect(fast.z).toBeCloseTo(100 + 104, 0);
  });

  it('lifts a trackside camera over a hill between it and the car', () => {
    const hilly: TerrainQuery = {
      heightAt: (_x, z) => (z > 120 && z < 160 ? 12 : 0),
      surfaceAt: () => 'tarmac',
    };
    const d = createDirector(3);
    const t = moving(0, 100, 0, 25);
    let shot: Shot | null = null;
    for (let i = 0; i < 400 && !shot; i++) {
      const s = nextShot(d, t, null, road, hilly, 1, false);
      if (s.kind === 'trackside') shot = s;
    }
    // The camera stands past the hill (z ≈ 180) and must see over it to the car at z = 100.
    expect(shot!.y).toBeGreaterThan(12);
  });

  it('under reduced motion holds the lens, grounds the helicopter and cuts less often', () => {
    const d = createDirector(5);
    const t = moving(0, 100, 0, 25);
    for (let i = 0; i < 60; i++) {
      const shot = nextShot(d, t, null, road, flat, 1, true);
      expect(shot.minFov).toBe(shot.maxFov);
      expect(shot.orbit).toBe(0);
      expect(shot.duration).toBeGreaterThanOrEqual(4 * 1.4 - 1e-9);
    }
  });
});

describe('CinematicCameraRig', () => {
  it('opens on a shot that frames the car', () => {
    const rig = new CinematicCameraRig(flat, road);
    const f = frameFor(moving(0, 100, 0, 25));
    rig.snap(f);
    expect(rig.current).not.toBeNull();
    expect(inFrame(f)).toBe(true);
    expect(f.camera.fov).toBeGreaterThanOrEqual(14);
    expect(f.camera.fov).toBeLessThanOrEqual(72);
  });

  it('pans a trackside camera with the car, widens the lens as it nears and cuts once it has passed', () => {
    const rig = new CinematicCameraRig(flat, road);
    const f = frameFor(moving(0, 100, 0, 25));
    rig.snap(f);
    const shot = shotOfKind('trackside', f.target);
    rig.cutTo(shot, f);
    expect(shot.z).toBeGreaterThan(f.target.z + 40);
    const fov0 = f.camera.fov;
    expect(fov0).toBeGreaterThanOrEqual(14);
    expect(fov0).toBeLessThanOrEqual(50);
    // Up to 20 m short of the camera the car stays in frame and the lens zooms out.
    while (f.target.z < shot.z - 20) {
      step(f);
      rig.update(f);
      expect(rig.current).toBe(shot);
      expect(inFrame(f), `z=${f.target.z.toFixed(1)}`).toBe(true);
    }
    expect(f.camera.fov).toBeGreaterThan(fov0 + 5);
    expect(f.camera.position.x).toBe(shot.x);
    expect(f.camera.position.z).toBe(shot.z);
    // Nine metres past the camera the shot still holds; a few metres more and the director cuts.
    while (f.target.z < shot.z + 9) {
      step(f);
      rig.update(f);
    }
    expect(rig.current).toBe(shot);
    for (let i = 0; i < 8 && rig.current === shot; i++) {
      step(f);
      rig.update(f);
    }
    expect(rig.current).not.toBe(shot);
    expect(inFrame(f)).toBe(true);
  });

  it('rides the tracking shots with the car through a bend, keeping it in frame and off the ground', () => {
    for (const kind of ['helicopter', 'lowChase', 'sideDolly', 'frontReverse'] as const) {
      const rig = new CinematicCameraRig(flat, road);
      const f = frameFor(moving(0, 100, 0, 20));
      rig.snap(f);
      rig.cutTo(shotOfKind(kind, f.target), f);
      expect(rig.current!.kind).toBe(kind);
      for (let i = 0; i < 210; i++) {
        step(f, 0.25);
        rig.update(f);
        if (i > 30) expect(inFrame(f), `${kind} frame ${i}`).toBe(true);
        expect(f.camera.position.y, kind).toBeGreaterThan(0.4);
        const d = carDistance(f);
        expect(d, kind).toBeGreaterThan(2);
        expect(d, kind).toBeLessThan(60);
      }
      expect(rig.current!.kind).toBe(kind);
    }
  });

  it('cuts to a new shot when a tracking shot runs its time', () => {
    const rig = new CinematicCameraRig(flat, road);
    const f = frameFor(moving(0, 100, 0, 20));
    rig.snap(f);
    const shot = shotOfKind('lowChase', f.target);
    rig.cutTo(shot, f);
    for (let i = 0; i < Math.ceil(shot.duration * 60) + 2; i++) {
      step(f);
      rig.update(f);
    }
    expect(rig.current).not.toBe(shot);
    expect(rig.current!.kind).not.toBe('lowChase');
  });

  it('under reduced motion keeps a trackside lens fixed and the helicopter on a steady bearing', () => {
    const rig = new CinematicCameraRig(flat, road);
    const f = frameFor(moving(0, 100, 0, 25), true);
    rig.snap(f);
    const d = createDirector(9);
    let trackside: Shot | null = null;
    let helicopter: Shot | null = null;
    while (!trackside || !helicopter) {
      const s = nextShot(d, f.target, null, road, flat, 1, true);
      if (s.kind === 'trackside') trackside = s;
      if (s.kind === 'helicopter') helicopter = s;
    }
    rig.cutTo(trackside, f);
    const fov = f.camera.fov;
    for (let i = 0; i < 120; i++) {
      step(f);
      rig.update(f);
      expect(f.camera.fov).toBe(fov);
    }
    rig.cutTo(helicopter, f);
    // Four seconds for the damped follow to settle in behind the car, then two more on the same bearing.
    for (let i = 0; i < 240; i++) {
      step(f);
      rig.update(f);
    }
    const before = anglesFrom(f.target, f.camera.position).bearing;
    for (let i = 0; i < 120; i++) {
      step(f);
      rig.update(f);
    }
    expect(anglesFrom(f.target, f.camera.position).bearing).toBeCloseTo(before, 2);
  });

  it('the wheel zooms the tracking shots out', () => {
    const near = new CinematicCameraRig(flat, road);
    const far = new CinematicCameraRig(flat, road);
    const f = frameFor(moving(0, 100, 0, 20));
    const shot = shotOfKind('lowChase', f.target);
    near.snap(f);
    near.cutTo(shot, f);
    const d0 = carDistance(f);
    far.zoom(1000);
    far.snap(f);
    far.cutTo(shot, f);
    expect(carDistance(f)).toBeGreaterThan(d0 * 1.5);
  });

  it('works without a stage road, as on the test track', () => {
    const rig = new CinematicCameraRig(flat);
    const f = frameFor(moving(10, -40, Math.PI / 3, 18));
    rig.snap(f);
    let framed = 0;
    for (let i = 0; i < 600; i++) {
      step(f, 0.1);
      rig.update(f);
      if (inFrame(f)) framed++;
    }
    expect(framed).toBeGreaterThan(540);
  });
});
