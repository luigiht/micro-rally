import { create } from 'zustand';
import type { CatalogCarId } from '@/game/economy/cars';
import type { StageTypeId } from '@/game/stage/regions';
import { DEFAULT_AUTOPILOT_KMH, DEV_AUTOPILOT_KMH } from '@/lib/autopilotFlag';
import { useGameStore } from './gameStore';
import { useUiStore } from './uiStore';

/** Fastest speed the launcher offers, km/h. */
export const MAX_AUTOPILOT_KMH = 220;

interface AutopilotState {
  /** A demo run is on: the car drives itself through stage after stage. */
  running: boolean;
  carId: CatalogCarId;
  stageType: StageTypeId;
  /** Top speed, km/h. */
  kmh: number;
  /** The window is tucked away (Hide, or P) while the rest of the HUD stays, for recordings. */
  windowHidden: boolean;
  pick: (p: Partial<Pick<AutopilotState, 'carId' | 'stageType' | 'kmh'>>) => void;
  start: () => void;
  stop: () => void;
  toggleWindow: () => void;
}

function randomSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0]!;
}

/**
 * The `?autopilot` launcher's demo: a throwaway game with no Game ID (so
 * nothing is saved), every stage of the picked type, in the picked car with
 * no upgrades. Each start draws a fresh seed, so each run shows new roads.
 */
export const useAutopilotStore = create<AutopilotState>()((set, get) => ({
  running: false,
  carId: 'hatchback',
  stageType: 'forest',
  kmh: DEV_AUTOPILOT_KMH ?? DEFAULT_AUTOPILOT_KMH,
  windowHidden: false,
  pick: (p) => set(p),
  toggleWindow: () => set((s) => ({ windowHidden: !s.windowHidden })),
  start: () => {
    const { carId, stageType } = get();
    const ui = useUiStore.getState();
    ui.closePanel();
    ui.stopReplay();
    useGameStore.setState((s) => ({
      gameId: null,
      driverName: '',
      gameSeed: randomSeed(),
      stageIndex: 0,
      stageTypes: [stageType],
      attempt: s.attempt + 1,
      carId,
      ownedCars: [carId],
      upgrades: {},
      money: 0,
      records: {},
    }));
    set({ running: true });
  },
  stop: () => {
    const ui = useUiStore.getState();
    ui.closePanel();
    ui.stopReplay();
    useGameStore.getState().leaveGame();
    set({ running: false, windowHidden: false });
  },
}));
