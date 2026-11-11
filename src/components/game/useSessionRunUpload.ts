'use client';

import { useEffect } from 'react';
import { submitRun } from '@/state/sessionStore';
import { useStageHudStore } from '@/state/stageHudStore';

/**
 * Multiplayer: when the stage being driven finishes, send its time and
 * splits to the session. Watches the HUD store's result (set once per run
 * at the finish line); nothing here re-renders.
 */
export function useSessionRunUpload(): void {
  useEffect(
    () =>
      useStageHudStore.subscribe((s, prev) => {
        if (s.result && !prev.result) submitRun(s.result.time, s.result.splits);
      }),
    [],
  );
}
