import type { PerspectiveCamera } from 'three';
import { stagePrize } from '@/game/economy/prize';
import { FixedStepper } from '@/game/loop/FixedStepper';
import { type ReplayMarks, ReplayTrack } from '@/game/replay/ReplayTrack';
import { StageRun } from '@/game/stage/StageRun';
import type { StageDef } from '@/game/stage/StageGenerator';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import {
  resolveBoxCollisions,
  resolveObstacleCollisions,
  type BoxObstacle,
  type ObstacleGrid,
} from '@/game/vehicle/Collisions';
import { tramBoxes, type TramTraffic } from '@/game/stage/TramService';
import { Autopilot, DEFAULT_AUTOPILOT } from '@/game/vehicle/Autopilot';
import { createControlInput, mergeControlInput } from '@/game/vehicle/ControlInput';
import { createVehiclePose, interpolatePose } from '@/game/vehicle/interpolatePose';
import type { TerrainQuery } from '@/game/vehicle/Terrain';
import { axleMarkIntensities } from '@/game/vehicle/wheelContacts';
import { DEFAULT_ENV, type SimEnv, VehicleSim, type SpawnPose } from '@/game/vehicle/VehicleSim';
import { STAGE_TYPES } from '@/game/stage/regions';
import { useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { stagePaceNotes } from '@/game/stage/PaceNotes';
import { INITIAL_STAGE_HUD, useStageHudStore } from '@/state/stageHudStore';
import { useTelemetryStore } from '@/state/telemetryStore';
import { useUiStore } from '@/state/uiStore';
import type { CameraMode, CameraRig, CameraRigFrame } from './cameras/CameraRig';
import { createCameraRig } from './cameras/createCameraRig';
import { KeyboardControls, type KeyAction } from './input/KeyboardControls';
import { TOUCH_INPUT } from './input/touchInput';

const HUD_INTERVAL = 0.1;
/** The replay keeps rolling this long past the finish line. */
const REPLAY_TAIL = 3;

/** What the car drives on. `stage` is absent on the free-roam test track. */
export interface DriveWorld {
  terrain: TerrainQuery;
  spawn: SpawnPose;
  obstacles?: ObstacleGrid;
  /** A city's trams: moving hitboxes posed from the run's clock. */
  trams?: TramTraffic;
  stage?: StageDef;
  /** Development spawn: metres along the stage the car starts at, so the checkpoints behind it count as passed. */
  startAlong?: number;
  /** Development aid: the autopilot drives, at up to this many m/s (recordings and demos). */
  autopilot?: number;
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
  private readonly track = new ReplayTrack(this.stepper.stepSize);
  private readonly axleMarks = { front: 0, rear: 0 };
  /** Seconds into the replay while one is playing; null while driving. */
  private replayTime: number | null = null;
  private tailLeft = 0;
  private readonly gateFractions: number[];
  private readonly keyboard: KeyboardControls;
  private readonly coast = createControlInput();
  private readonly merged = createControlInput();
  private readonly pilotInput = createControlInput();
  private autopilot: Autopilot | null = null;
  private cabinDrop: number;
  private cabinForward: number;
  private bodyScale: number;
  private readonly respawn: SpawnPose = { x: 0, z: 0, yaw: 0 };
  private rig: CameraRig;
  private readonly frame: CameraRigFrame;
  private needsSnap = true;
  private hudElapsed = 0;
  private hudFrames = 0;
  private finishedReported = false;
  private canvas: HTMLElement | null = null;
  /** Seconds of simulated time; stands still while a panel pauses the game. */
  time = 0;
  /** The brake input of the last physics step, 0..1, for the brake lamps. */
  braking = 0;
  private readonly tramHits: BoxObstacle[] = [];

  /** The clock the world's moving parts (the trams) follow: the replay's while one plays, else the run's. */
  get clock(): number {
    return this.replayClock ?? this.time;
  }

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
        : this.autopilot
          ? this.autopilot.drive(s, this.env, this.pilotInput)
          : mergeControlInput(this.keyboard.input, TOUCH_INPUT, this.merged);
    this.braking = input.brake;
    const px = s.x;
    const pz = s.z;
    this.sim.step(dt, input, this.world.terrain, this.env);
    let impact = 0;
    if (this.world.obstacles) impact = resolveObstacleCollisions(s, this.world.obstacles);
    if (this.world.trams) {
      const boxes = tramBoxes(
        this.world.trams.lines,
        this.world.trams.runs,
        this.time,
        this.tramHits,
      );
      impact = Math.max(impact, resolveBoxCollisions(s, boxes));
    }
    if (impact > 0) run?.onImpact(impact);
    run?.onMove(px, pz, s.x, s.z);
    this.recordStep(run, dt);
  };

  /** The sim's environment for this stage: the region's handling over the defaults. */
  private readonly env: Readonly<SimEnv>;

  constructor(
    spec: CarSpec,
    private readonly world: DriveWorld,
    camera: PerspectiveCamera,
  ) {
    this.sim = new VehicleSim(spec);
    if (world.autopilot && world.stage)
      this.autopilot = new Autopilot(
        world.stage.path,
        spec,
        { ...DEFAULT_AUTOPILOT, maxSpeed: world.autopilot },
        world.startAlong ?? world.stage.startDistance,
      );
    this.cabinDrop = spec.cabinDrop;
    this.cabinForward = spec.cabinForward;
    this.bodyScale = spec.bodyScale;
    this.sim.reset(world.spawn, world.terrain);
    this.run = world.stage ? new StageRun(world.stage) : null;
    const handling = world.stage ? STAGE_TYPES[world.stage.stageType].handling : undefined;
    this.env = handling
      ? {
          ...DEFAULT_ENV,
          gripScale: handling.grip,
          steerSensitivity: handling.steer,
          steerLock: handling.lock,
        }
      : DEFAULT_ENV;
    if (this.run && world.startAlong !== undefined) this.run.skipGatesBefore(world.startAlong);
    this.gateFractions = this.run?.gateFractions ?? [];
    useUiStore.getState().stopReplay();
    this.coast.brake = 0.35;
    this.keyboard = new KeyboardControls(this.handleAction);
    this.rig = this.buildRig(useSettingsStore.getState().camera);
    this.frame = { camera, target: this.pose, dt: 0, reducedMotion: false };
    useStageHudStore.setState({
      ...INITIAL_STAGE_HUD,
      gateCount: world.stage?.gates.length ?? 0,
      gateFractions: this.gateFractions,
      paceNotes: world.stage ? stagePaceNotes(world.stage) : [],
      along: this.run?.along ?? 0,
      stage: world.stage
        ? {
            index: world.stage.index,
            name: world.stage.name,
            stageType: world.stage.stageType,
            surface: world.stage.surface,
            length: world.stage.length,
            parTime: world.stage.parTime,
            laps: world.stage.circuit?.laps ?? 0,
            lapLength: world.stage.circuit?.lapLength ?? 0,
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
    useUiStore.getState().stopReplay();
  }

  /** Swap the car mid-run (garage purchase or selection); the stage clock keeps running. */
  setSpec(spec: CarSpec): void {
    this.sim.retune(spec);
    if (
      spec.cabinDrop === this.cabinDrop &&
      spec.cabinForward === this.cabinForward &&
      spec.bodyScale === this.bodyScale
    )
      return;
    this.cabinDrop = spec.cabinDrop;
    this.cabinForward = spec.cabinForward;
    this.bodyScale = spec.bodyScale;
    this.rig.dispose();
    this.rig = this.buildRig(this.rig.mode);
    this.needsSnap = true;
  }

  /** The active view; DriveRig hides the car's cabin while it's the interior. */
  get cameraMode(): CameraMode {
    return this.rig.mode;
  }

  /** True while the finished run plays back: the sim stands still and the car follows the recording. */
  get replaying(): boolean {
    return this.replayTime !== null;
  }

  /** Seconds into the replay, or null while driving: the clock the replay's tyre marks are stamped with. */
  get replayClock(): number | null {
    return this.replayTime;
  }

  /** The tyre marks the recording laid at this moment of the replay; null while driving. */
  replayMarks(out: ReplayMarks): ReplayMarks | null {
    if (this.replayTime === null) return null;
    return this.track.sampleMarks(this.replayTime, out);
  }

  /** A rig for `mode` around the current car; the cinematic rig also gets the stage to place its cameras beside its road. */
  private buildRig(mode: CameraMode): CameraRig {
    return createCameraRig(
      mode,
      this.world.terrain,
      this.world.spawn.yaw,
      this.cabinDrop,
      this.cabinForward,
      this.bodyScale,
      this.world.stage,
    );
  }

  tick(dt: number, reducedMotion: boolean, info: RenderInfo): void {
    this.syncCameraRig();
    this.syncReplay();
    // An open HUD panel pauses the sim (and a replay); the camera keeps rendering the frozen pose.
    const paused = useUiStore.getState().panel !== null;
    if (this.replayTime !== null && !paused) {
      this.replayTime += dt;
      // The recording has run out: straight back to the result panel, the car where the sim left it.
      if (this.replayTime > this.track.duration) {
        useUiStore.getState().stopReplay();
        this.syncReplay();
      }
    }
    if (this.replayTime !== null) {
      this.track.sampleAt(this.replayTime, this.pose);
    } else {
      const alpha = paused ? 1 : this.stepper.advance(dt, this.stepFn);
      if (!paused) this.time += dt;
      interpolatePose(this.pose, this.sim.prev, this.sim.state, alpha);
    }

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
    this.rig = this.buildRig(wanted);
    this.needsSnap = true;
  }

  /** Record the run for the replay: every step from the start signal to a few seconds past the finish. */
  private recordStep(run: StageRun | null, dt: number): void {
    if (!run) return;
    if (run.phase === 'running') {
      this.track.record(
        this.sim.state,
        axleMarkIntensities(this.sim.state, this.sim.spec, this.axleMarks),
      );
      this.tailLeft = REPLAY_TAIL;
    } else if (run.phase === 'finished' && this.tailLeft > 0) {
      this.track.record(
        this.sim.state,
        axleMarkIntensities(this.sim.state, this.sim.spec, this.axleMarks),
      );
      this.tailLeft -= dt;
    }
  }

  /**
   * Enter or leave the replay as the HUD asks (Watch replay, Exit replay, Esc) or
   * when the recording runs out. The camera snaps either way; leaving puts the car
   * back where the sim left it and the HUD back on the final time, and the result
   * panel shows again.
   */
  private syncReplay(): void {
    const ui = useUiStore.getState();
    const run = this.run;
    const wanted = ui.replay && run?.phase === 'finished' && this.track.samples > 1;
    if (ui.replay && !wanted) ui.stopReplay();
    if (wanted === (this.replayTime !== null)) return;
    this.replayTime = wanted ? 0 : null;
    this.needsSnap = true;
    if (wanted || !run) return;
    interpolatePose(this.pose, this.sim.prev, this.sim.state, 1);
    useStageHudStore.setState({
      time: run.totalTime,
      gatesPassed: this.gateFractions.length,
      progress: run.progressAt(this.pose.x, this.pose.z),
      along: run.along,
      lap: run.lap,
    });
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
      circuit: stage.circuit !== undefined,
    });
    const result = useGameStore.getState().completeStage({
      stageIndex: stage.index,
      time: run.totalTime,
      splits: [...run.splits],
      prize,
      repairCost: run.repairCost,
      parTime: stage.parTime,
    });
    useStageHudStore.setState({
      phase: 'finished',
      time: run.totalTime,
      result,
      lap: run.lap,
      lapTimes: run.laps,
      bestLap: run.bestLap,
    });
  }

  private readonly handleAction = (action: KeyAction): void => {
    if (action === 'reset') {
      if (!this.run || this.run.phase === 'running') this.resetCar();
    } else if (action === 'camera') {
      useSettingsStore.getState().cycleCamera();
    } else if (action === 'debug') {
      useTelemetryStore.getState().toggleDebug();
    } else if (action === 'hud') {
      useUiStore.getState().toggleHud();
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
    // In a replay the readout follows the recording, not the sim standing at the finish.
    const live = this.replayTime !== null ? this.pose : s;
    useTelemetryStore.setState({
      telemetry: {
        fps: Math.round(this.hudFrames / this.hudElapsed),
        drawCalls: info.calls,
        triangles: info.triangles,
        speedKmh: Math.abs(live.speed) * 3.6,
        gear: live.gear,
        rpm: live.rpm,
        surface: s.surface,
        airborne: !live.grounded,
        slip: s.slipRear,
      },
    });
    const run = this.run;
    if (run && this.replayTime !== null) {
      // The clock, checkpoints, lap and progress bar follow the recording as it plays: the gates
      // passed by this point of the run, so a circuit's lap unwraps as it did live.
      const gatesPassed = run.gatesPassedAt(this.replayTime);
      useStageHudStore.setState({
        time: this.replayTime,
        progress: run.progressAt(this.pose.x, this.pose.z, gatesPassed),
        along: run.along,
        gatesPassed,
        lap: run.lapAt(this.replayTime),
      });
    } else if (run && run.phase !== 'finished') {
      useStageHudStore.setState({
        phase: run.phase,
        countdown: run.countdown,
        time: run.totalTime,
        gatesPassed: run.gatesPassed,
        progress: run.progressAt(s.x, s.z),
        along: run.along,
        penalties: run.penalties,
        hits: run.hits,
        lap: run.lap,
        lapTimes: run.laps,
        bestLap: run.bestLap,
      });
    }
    this.hudElapsed = 0;
    this.hudFrames = 0;
  }
}
