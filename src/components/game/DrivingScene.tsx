'use client';

import { forceShotKind, SHOT_KINDS, type ShotKind } from './cameras/CinematicShots';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { CatalogCarId } from '@/game/economy/cars';
import { STAGE_TYPES, type StageTypeId } from '@/game/stage/regions';
import { calendarSlot, cycleSlot, type StageSlot } from '@/game/stage/StageGenerator';
import { createStageWorld } from '@/game/stage/StageWorld';
import { TEST_TRACK, testTrackTerrain } from '@/game/stage/TestTrack';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import { isSoftwareRenderer, rendererName } from '@/lib/gpu';
import {
  DEFAULT_STAGE_RENDER,
  SOFTWARE_STAGE_RENDER,
  StageRenderer,
} from '@/render/stage/StageRenderer';
import { dayTheme, flatTheme } from '@/render/theme/WorldTheme';
import { useGameStore } from '@/state/gameStore';
import { getLiveRelay } from '@/state/opponentStore';
import { opponentOf, useSessionStore } from '@/state/sessionStore';
import { useStageHudStore } from '@/state/stageHudStore';
import { DriveRig } from './DriveRig';
import type { DriveWorld, DrivingSession } from './DrivingSession';
import { OpponentCar } from './OpponentCar';
import { TestTrackView } from './TestTrackView';

/** The live relay samples the stage progress with each pose, for the other driver's progress bar. */
const readProgress = () => useStageHudStore.getState().progress;

interface Opponent {
  name: string;
  carId: CatalogCarId;
}

const TEST_WORLD: DriveWorld = { terrain: testTrackTerrain, spawn: TEST_TRACK.spawn };
const TEST_THEME = flatTheme('#cfe3e8', '#cfe3e8');

/**
 * Development aid: `?spawn=<metres>` starts the car that far along the road
 * and `?spawn=town` 120 m before the stage's town (for inspecting a stretch).
 * Read once when the module loads, before the app rewrites the URL with the
 * Game ID.
 */
const DEV_SPAWN: number | 'town' | null = (() => {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('spawn');
  if (raw === 'town') return 'town';
  const d = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(d) && d > 0 ? d : null;
})();

/**
 * Development aid: `?autopilot` lets the car drive itself down the stage (for
 * recordings), at up to `?autopilot=<km/h>` (108 by default). Off in production.
 */
const DEV_AUTOPILOT: number | null = (() => {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('autopilot');
  if (raw === null) return null;
  const kmh = Number(raw);
  return (Number.isFinite(kmh) && kmh > 0 ? kmh : 108) / 3.6;
})();

/** Development aid: `?shot=<kind>` holds the cinematic camera on one shot kind (for recordings). */
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  const kind = new URLSearchParams(window.location.search).get('shot');
  if (kind && (SHOT_KINDS as readonly string[]).includes(kind)) forceShotKind(kind as ShotKind);
}

function StageDrive({
  gameSeed,
  stageIndex,
  slot,
  opponent,
}: {
  gameSeed: number;
  stageIndex: number;
  /** What runs at this index: the calendar's slot, or a session's. */
  slot: StageSlot;
  /** Multiplayer: the other driver, shown live when they're on this stage too. */
  opponent: Opponent | null;
}) {
  const world = useMemo(
    () => createStageWorld(gameSeed, stageIndex, slot),
    [gameSeed, stageIndex, slot],
  );
  const drive = useMemo<DriveWorld>(() => {
    const at =
      DEV_SPAWN === 'town' ? Math.max(0, (world.stage.town?.from ?? 120) - 120) : DEV_SPAWN;
    let spawn = world.stage.spawn;
    if (at !== null && at > 0) {
      const s = { x: 0, z: 0, heading: 0 };
      world.stage.path.sample(at, s);
      spawn = { x: s.x, z: s.z, yaw: s.heading };
    }
    return {
      terrain: world.field,
      spawn,
      obstacles: world.obstacles,
      ...(world.trams ? { trams: world.trams } : {}),
      stage: world.stage,
      ...(at !== null && at > 0 ? { startAlong: at } : {}),
      ...(DEV_AUTOPILOT !== null ? { autopilot: DEV_AUTOPILOT } : {}),
    };
  }, [world]);
  const group = useRef<Group>(null);
  const renderer = useRef<StageRenderer | null>(null);
  const self = useRef<Readonly<VehiclePose> | null>(null);
  const theme = dayTheme(STAGE_TYPES[world.stage.stageType], world.stage.dusk === true);
  // Software WebGL gets the light stage: the full one would crawl there.
  const gl = useThree((s) => s.gl);
  const renderOptions = useMemo(
    () =>
      isSoftwareRenderer(rendererName(gl.getContext()))
        ? SOFTWARE_STAGE_RENDER
        : DEFAULT_STAGE_RENDER,
    [gl],
  );

  useEffect(() => {
    const r = new StageRenderer(world, renderOptions, theme);
    group.current?.add(r.group);
    renderer.current = r;
    return () => {
      r.dispose();
      renderer.current = null;
    };
  }, [world, theme, renderOptions]);

  const onPose = useCallback(
    (pose: Readonly<VehiclePose>, clock: number, session: DrivingSession) => {
      renderer.current?.update(pose.x, pose.z, clock);
      self.current = pose;
      // A no-op outside multiplayer; a replay isn't live driving.
      if (!session.replaying) getLiveRelay().record(clock, pose, session.braking, readProgress);
    },
    [],
  );

  return (
    <DriveRig world={drive} theme={theme} onPose={onPose}>
      <group ref={group} />
      {opponent && <OpponentCar carId={opponent.carId} name={opponent.name} self={self} />}
    </DriveRig>
  );
}

function subscribeNoop(): () => void {
  return () => {};
}

/** `?track=test` opens the flat proving ground used for tuning the car. */
function useTestTrackFlag(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => new URLSearchParams(window.location.search).get('track') === 'test',
    () => false,
  );
}

export function DrivingScene() {
  const gameSeed = useGameStore((s) => s.gameSeed);
  const stageIndex = useGameStore((s) => s.stageIndex);
  const attempt = useGameStore((s) => s.attempt);
  // A session cycles through its host's stage types; the career follows the calendar.
  const typesKey = useGameStore((s) => s.stageTypes?.join(',') ?? '');
  const slot = useMemo(
    () =>
      typesKey
        ? cycleSlot(typesKey.split(',') as StageTypeId[], stageIndex)
        : calendarSlot(stageIndex),
    [typesKey, stageIndex],
  );
  const testTrack = useTestTrackFlag();
  // Two primitive reads: a selector building an object would re-render on every store change.
  const opponentName = useSessionStore((s) =>
    s.screen === 'drive' ? (opponentOf(s)?.name ?? null) : null,
  );
  const opponentCar = useSessionStore((s) =>
    s.screen === 'drive' ? (opponentOf(s)?.carId ?? null) : null,
  );
  const opponent = useMemo<Opponent | null>(
    () => (opponentName && opponentCar ? { name: opponentName, carId: opponentCar } : null),
    [opponentName, opponentCar],
  );

  if (testTrack) {
    return (
      <DriveRig world={TEST_WORLD} theme={TEST_THEME}>
        <TestTrackView />
      </DriveRig>
    );
  }
  return (
    <StageDrive
      key={`${gameSeed}-${stageIndex}-${typesKey}-${attempt}`}
      gameSeed={gameSeed}
      stageIndex={stageIndex}
      slot={slot}
      opponent={opponent}
    />
  );
}
