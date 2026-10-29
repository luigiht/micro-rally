import type { PerspectiveCamera } from 'three';
import { FixedStepper } from '@/game/loop/FixedStepper';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import { createVehiclePose, interpolatePose } from '@/game/vehicle/interpolatePose';
import type { TerrainQuery } from '@/game/vehicle/Terrain';
import { DEFAULT_ENV, VehicleSim, type SpawnPose } from '@/game/vehicle/VehicleSim';
import { useTelemetryStore } from '@/state/telemetryStore';
import type { CameraRig, CameraRigFrame } from './cameras/CameraRig';
import { ChaseCameraRig } from './cameras/ChaseCameraRig';
import { KeyboardControls, type KeyAction } from './input/KeyboardControls';

const TELEMETRY_INTERVAL = 0.1;

interface RenderInfo {
  calls: number;
  triangles: number;
}

/** Imperative driving runtime: sim stepping, input, camera rig and telemetry. Lives outside React state. */
export class DrivingSession {
  readonly sim: VehicleSim;
  readonly pose = createVehiclePose();
  private readonly stepper = new FixedStepper();
  private readonly keyboard: KeyboardControls;
  private rig: CameraRig;
  private readonly frame: CameraRigFrame;
  private needsSnap = true;
  private telemetryElapsed = 0;
  private telemetryFrames = 0;
  private canvas: HTMLElement | null = null;

  private readonly stepFn = (dt: number) => {
    this.sim.step(dt, this.keyboard.input, this.terrain, DEFAULT_ENV);
  };

  constructor(
    spec: CarSpec,
    private readonly terrain: TerrainQuery,
    private readonly spawn: SpawnPose,
    camera: PerspectiveCamera,
  ) {
    this.sim = new VehicleSim(spec);
    this.sim.reset(spawn, terrain);
    this.keyboard = new KeyboardControls(this.handleAction);
    this.rig = new ChaseCameraRig(terrain);
    this.frame = { camera, target: this.pose, dt: 0, reducedMotion: false };
  }

  attach(win: Window, canvas: HTMLElement): void {
    this.keyboard.attach(win);
    this.canvas = canvas;
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  dispose(win: Window): void {
    this.keyboard.detach(win);
    this.canvas?.removeEventListener('wheel', this.handleWheel);
    this.canvas = null;
    this.rig.dispose();
  }

  tick(dt: number, reducedMotion: boolean, info: RenderInfo): void {
    const alpha = this.stepper.advance(dt, this.stepFn);
    interpolatePose(this.pose, this.sim.prev, this.sim.state, alpha);

    this.frame.dt = dt;
    this.frame.reducedMotion = reducedMotion;
    if (this.needsSnap) {
      this.rig.snap(this.frame);
      this.needsSnap = false;
    } else {
      this.rig.update(this.frame);
    }
    this.publishTelemetry(dt, info);
  }

  resetCar(): void {
    this.sim.reset(this.spawn, this.terrain);
    this.stepper.reset();
    this.needsSnap = true;
  }

  private readonly handleAction = (action: KeyAction): void => {
    if (action === 'reset') this.resetCar();
    else if (action === 'debug') useTelemetryStore.getState().toggleDebug();
  };

  private readonly handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.rig.zoom(e.deltaY);
  };

  private publishTelemetry(dt: number, info: RenderInfo): void {
    this.telemetryElapsed += dt;
    this.telemetryFrames++;
    if (this.telemetryElapsed < TELEMETRY_INTERVAL) return;
    const s = this.sim.state;
    useTelemetryStore.setState({
      telemetry: {
        fps: Math.round(this.telemetryFrames / this.telemetryElapsed),
        drawCalls: info.calls,
        triangles: info.triangles,
        speedKmh: Math.abs(s.speed) * 3.6,
        gear: s.gear,
        rpm: s.rpm,
        surface: s.surface,
        airborne: !s.grounded,
        slip: s.slipRear,
      },
    });
    this.telemetryElapsed = 0;
    this.telemetryFrames = 0;
  }
}
