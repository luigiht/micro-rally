import type { PerspectiveCamera } from 'three';
import { stagePrize } from '@/game/economy/prize';
import { FixedStepper } from '@/game/loop/FixedStepper';
import { StageRun } from '@/game/stage/StageRun';
import type { StageDef } from '@/game/stage/StageGenerator';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import { resolveObstacleCollisions, type ObstacleGrid } from '@/game/vehicle/Collisions';
import { createControlInput, mergeControlInput } from '@/game/vehicle/ControlInput';
import { createVehiclePose, interpolatePose } from '@/game/vehicle/interpolatePose';
import type { TerrainQuery } from '@/game/vehicle/Terrain';
import { DEFAULT_ENV, VehicleSim, type SpawnPose } from '@/game/vehicle/VehicleSim';
import { useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { INITIAL_STAGE_HUD, useStageHudStore } from '@/state/stageHudStore';
import { useTelemetryStore } from '@/state/telemetryStore';
import { useUiStore } from '@/state/uiStore';
import type { CameraMode, CameraRig, CameraRigFrame } from './cameras/CameraRig';
import { createCameraRig } from './cameras/createCameraRig';
import { KeyboardControls, type KeyAction } from './input/KeyboardControls';
import { TOUCH_INPUT } from './input/touchInput';

const HUD_INTERVAL = 0.1;

/** What the car drives on. `stage` is absent on the free-roam test track. */
export interface DriveWorld {
  terrain: TerrainQuery;
  spawn: SpawnPose;
  obstacles?: ObstacleGrid;
  stage?: StageDef;
}

interface RenderInfo {
  calls: number;
  triangles: number;
}

/** Imperative driving runtime: sim stepping, input, stage timing, camera rig and HUD publishing. */
export class DrivingSession {
  readonly sim: VehicleSim;
  readonly pose = createVehiclePose();
  readonly run: StageRun | null;
  private readonly stepper = new FixedStepper();
  private readonly keyboard: KeyboardControls;
  private readonly coast = createControlInput();
  private readonly merged = createControlInput();
  private readonly cabinDrop: number;
  private readonly respawn: SpawnPose = { x: 0, z: 0, yaw: 0 };
  private rig: CameraRig;
  private readonly frame: CameraRigFrame;
  private needsSnap = true;
  private hudElapsed = 0;
  private hudFrames = 0;
  private finishedReported = false;
  private canvas: HTMLElement | null = null;

  private readonly stepFn = (dt: number) => {
    const run = this.run;
    const s = this.sim.state;
    if (run) {
      run.tick(dt);
      if (!run.canDrive) return;
    }
    const input =
      run?.phase === 'finished'
        ? this.coast
        : mergeControlInput(this.keyboard.input, TOUCH_INPUT, this.merged);
    const px = s.x;
    const pz = s.z;
    this.sim.step(dt, input, this.world.terrain, DEFAULT_ENV);
    if (this.world.obstacles) {
      const impact = resolveObstacleCollisions(s, this.world.obstacles);
      if (impact > 0) run?.onImpact(impact);
    }
    run?.onMove(px, pz, s.x, s.z);
  };

  constructor(
    spec: CarSpec,
    private readonly world: DriveWorld,
    camera: PerspectiveCamera,
  ) {
    this.sim = new VehicleSim(spec);
    this.cabinDrop = spec.cabinDrop;
    this.sim.reset(world.spawn, world.terrain);
    this.run = world.stage ? new StageRun(world.stage) : null;
    this.coast.brake = 0.35;
    this.keyboard = new KeyboardControls(this.handleAction);
    this.rig = createCameraRig(
      useSettingsStore.getState().camera,
      world.terrain,
      world.spawn.yaw,
      spec.cabinDrop,
    );
    this.frame = { camera, target: this.pose, dt: 0, reducedMotion: false };
    useStageHudStore.setState({
      ...INITIAL_STAGE_HUD,
      gateCount: world.stage?.gates.length ?? 0,
      gateFractions: this.run?.gateFractions ?? [],
      stage: world.stage
        ? {
            index: world.stage.index,
            name: world.stage.name,
            region: world.stage.region,
            surface: world.stage.surface,
            length: world.stage.length,
            parTime: world.stage.parTime,
          }
        : null,
    });
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

  /** The active view; DriveRig hides the car's cabin while it's the cockpit. */
  get cameraMode(): CameraMode {
    return this.rig.mode;
  }

  tick(dt: number, reducedMotion: boolean, info: RenderInfo): void {
    this.syncCameraRig();
    // An open HUD panel pauses the sim; the camera keeps rendering the frozen pose.
    const paused = useUiStore.getState().panel !== null;
    const alpha = paused ? 1 : this.stepper.advance(dt, this.stepFn);
    interpolatePose(this.pose, this.sim.prev, this.sim.state, alpha);

    this.frame.dt = dt;
    this.frame.reducedMotion = reducedMotion;
    if (this.needsSnap) {
      this.rig.snap(this.frame);
      this.needsSnap = false;
    } else {
      this.rig.update(this.frame);
    }
    if (this.run?.phase === 'finished' && !this.finishedReported) this.reportFinish();
    this.publishHud(dt, info);
  }

  /** Swap rigs when the setting changes (C key or Settings); the new rig snaps on its first frame. */
  private syncCameraRig(): void {
    const wanted = useSettingsStore.getState().camera;
    if (wanted === this.rig.mode) return;
    this.rig.dispose();
    this.rig = createCameraRig(wanted, this.world.terrain, this.world.spawn.yaw, this.cabinDrop);
    this.needsSnap = true;
  }

  resetCar(): void {
    const pose = this.run ? this.run.respawnPose(this.respawn) : this.world.spawn;
    this.sim.reset(pose, this.world.terrain);
    this.stepper.reset();
    this.needsSnap = true;
  }

  private reportFinish(): void {
    const run = this.run!;
    const stage = run.stage;
    this.finishedReported = true;
    const prize = stagePrize({
      lengthM: stage.length,
      surface: stage.surface,
      parTime: stage.parTime,
      time: run.totalTime,
      loop: stage.loop,
    });
    const result = useGameStore.getState().completeStage({
      stageIndex: stage.index,
      time: run.totalTime,
      splits: [...run.splits],
      prize,
      repairCost: run.repairCost,
      parTime: stage.parTime,
    });
    useStageHudStore.setState({ phase: 'finished', time: run.totalTime, result });
  }

  private readonly handleAction = (action: KeyAction): void => {
    if (action === 'reset') {
      if (!this.run || this.run.phase === 'running') this.resetCar();
    } else if (action === 'camera') {
      useSettingsStore.getState().cycleCamera();
    } else if (action === 'debug') {
      useTelemetryStore.getState().toggleDebug();
    } else if (action === 'pause') {
      const ui = useUiStore.getState();
      if (ui.panel) ui.closePanel();
      else ui.openPanel('game');
    }
  };

  private readonly handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.rig.zoom(e.deltaY);
  };

  private publishHud(dt: number, info: RenderInfo): void {
    this.hudElapsed += dt;
    this.hudFrames++;
    if (this.hudElapsed < HUD_INTERVAL) return;
    const s = this.sim.state;
    useTelemetryStore.setState({
      telemetry: {
        fps: Math.round(this.hudFrames / this.hudElapsed),
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
    const run = this.run;
    if (run && run.phase !== 'finished') {
      useStageHudStore.setState({
        phase: run.phase,
        countdown: run.countdown,
        time: run.totalTime,
        gatesPassed: run.gatesPassed,
        progress: run.progressAt(s.x, s.z),
        penalties: run.penalties,
        hits: run.hits,
      });
    }
    this.hudElapsed = 0;
    this.hudFrames = 0;
  }
}
