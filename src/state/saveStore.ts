import { create } from 'zustand';
import { LocalSaveBackend, RemoteSaveBackend } from '@/lib/save/SaveBackend';
import { SaveManager, type SyncStatus } from '@/lib/save/SaveManager';

interface SaveState {
  status: SyncStatus;
  changedAt: number | null;
}

/** Sync status shown in the Game panel; written by the SaveManager. */
export const useSaveStore = create<SaveState>()(() => ({ status: 'idle', changedAt: null }));

let manager: SaveManager | null = null;

/** The browser's SaveManager (Web Storage + the online API). Client-side only. */
export function getSaveManager(): SaveManager {
  if (!manager) {
    manager = new SaveManager(
      new LocalSaveBackend(window.localStorage),
      new RemoteSaveBackend(),
      (status) => useSaveStore.setState({ status, changedAt: Date.now() }),
    );
  }
  return manager;
}
