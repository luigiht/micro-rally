'use client';

import { forceShotKind, SHOT_KINDS, type ShotKind } from './cameras/CinematicShots';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Group } from 'three';
import { REGIONS } from '@/game/stage/regions';
import { createStageWorld } from '@/game/stage/StageWorld';
import { TEST_TRACK, testTrackTerrain } from '@/game/stage/TestTrack';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import { DEFAULT_STAGE_RENDER, StageRenderer } from '@/render/stage/StageRenderer';
import { dayTheme, flatTheme, NIGHTCITY_THEME } from '@/render/theme/WorldTheme';
import { useGameStore } from '@/state/gameStore';
import { useUiStore } from '@/state/uiStore';
import { DriveRig } from './DriveRig';
import type { DriveWorld } from './DrivingSession';
import { TestTrackView } from './TestTrackView';

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

function StageDrive({ gameSeed, stageIndex }: { gameSeed: number; stageIndex: number }) {
  const world = useMemo(() => createStageWorld(gameSeed, stageIndex), [gameSeed, stageIndex]);
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
  const nightcity = useUiStore((s) => s.nightcity);
  const theme = nightcity
    ? NIGHTCITY_THEME
    : dayTheme(REGIONS[world.stage.region], world.stage.dusk === true);

  useEffect(() => {
    // Read the flag imperatively so a stage that mounts while Nightcity is on starts dark.
    const initial = useUiStore.getState().nightcity
      ? NIGHTCITY_THEME
      : dayTheme(REGIONS[world.stage.region], world.stage.dusk === true);
    const r = new StageRenderer(world, DEFAULT_STAGE_RENDER, initial);
    group.current?.add(r.group);
    renderer.current = r;
    return () => {
      r.dispose();
      renderer.current = null;
    };
  }, [world]);

  // N re-dresses the stage in place; the run (keyed above) is untouched.
  useEffect(() => {
    renderer.current?.setTheme(theme);
  }, [theme]);

  const onPose = useCallback((pose: Readonly<VehiclePose>, clock: number) => {
    renderer.current?.update(pose.x, pose.z, clock);
  }, []);

  return (
    <DriveRig world={drive} theme={theme} onPose={onPose}>
      <group ref={group} />
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
  const testTrack = useTestTrackFlag();
  const nightcity = useUiStore((s) => s.nightcity);

  if (testTrack) {
    return (
      <DriveRig world={TEST_WORLD} theme={nightcity ? NIGHTCITY_THEME : TEST_THEME}>
        <TestTrackView />
      </DriveRig>
    );
  }
  return (
    <StageDrive
      key={`${gameSeed}-${stageIndex}-${attempt}`}
      gameSeed={gameSeed}
      stageIndex={stageIndex}
    />
  );
}
