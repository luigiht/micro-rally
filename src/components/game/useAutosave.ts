'use client';

import { useEffect } from 'react';
import type { SaveFile } from '@/game/save/SaveFile';
import { snapshotSave, useGameStore } from '@/state/gameStore';
import { getSaveManager } from '@/state/saveStore';

const DEBOUNCE_MS = 2500;
const INTERVAL_MS = 60_000;

/**
 * Persists progress: right away on mount, a moment after it changes, every
 * minute (which also retries a failed upload), when the tab is hidden and on
 * unmount. Reads the store imperatively; nothing here re-renders.
 */
export function useAutosave(): void {
  useEffect(() => {
    const manager = getSaveManager();
    let last: SaveFile | null = snapshotSave(useGameStore.getState());
    let dirty = last !== null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = (keepalive = false) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (!last || (!dirty && !manager.hasPendingUpload)) return;
      dirty = false;
      void manager.save({ ...last, updatedAt: Date.now() }, { keepalive });
    };
    const schedule = () => {
      timer ??= setTimeout(() => flush(), DEBOUNCE_MS);
    };

    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (!s.gameId) return;
      const same =
        s.gameId === prev.gameId &&
        s.driverName === prev.driverName &&
        s.gameSeed === prev.gameSeed &&
        s.money === prev.money &&
        s.stageIndex === prev.stageIndex &&
        s.records === prev.records;
      if (same) return;
      last = snapshotSave(s);
      dirty = true;
      schedule();
    });
    const interval = setInterval(() => flush(), INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush(true);
    };
    const onPageHide = () => flush(true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    flush();

    return () => {
      unsubscribe();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      flush();
    };
  }, []);
}
