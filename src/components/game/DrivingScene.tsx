'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Group } from 'three';
import { REGIONS } from '@/game/stage/regions';
import { createStageWorld } from '@/game/stage/StageWorld';
import { TEST_TRACK, testTrackTerrain } from '@/game/stage/TestTrack';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import { StageRenderer } from '@/render/stage/StageRenderer';
import { useGameStore } from '@/state/gameStore';
import { DriveRig } from './DriveRig';
import type { DriveWorld } from './DrivingSession';
import { TestTrackView } from './TestTrackView';

const TEST_WORLD: DriveWorld = { terrain: testTrackTerrain, spawn: TEST_TRACK.spawn };

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

function StageDrive({ gameSeed, stageIndex }: { gameSeed: number; stageIndex: number }) {
  const world = useMemo(() => createStageWorld(gameSeed, stageIndex), [gameSeed, stageIndex]);
  const drive = useMemo<DriveWorld>(() => {
    const at = DEV_SPAWN === 'town' ? (world.stage.town?.from ?? 120) - 120 : DEV_SPAWN;
    let spawn = world.stage.spawn;
    if (at !== null && at > 0) {
      const s = { x: 0, z: 0, heading: 0 };
      world.stage.path.sample(at, s);
      spawn = { x: s.x, z: s.z, yaw: s.heading };
    }
    return { terrain: world.field, spawn, obstacles: world.obstacles, stage: world.stage };
  }, [world]);
  const group = useRef<Group>(null);
  const renderer = useRef<StageRenderer | null>(null);

  useEffect(() => {
    const r = new StageRenderer(world);
    group.current?.add(r.group);
    renderer.current = r;
    return () => {
      r.dispose();
      renderer.current = null;
    };
  }, [world]);

  const onPose = useCallback((pose: Readonly<VehiclePose>) => {
    renderer.current?.update(pose.x, pose.z);
  }, []);

  const palette = REGIONS[world.stage.region].palette;
  return (
    <DriveRig world={drive} sky={palette.sky} fog={palette.fog} onPose={onPose}>
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

  if (testTrack) {
    return (
      <DriveRig world={TEST_WORLD} sky="#cfe3e8" fog="#cfe3e8">
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
