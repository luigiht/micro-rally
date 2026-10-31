import { create } from 'zustand';
import { carPrice, type CatalogCarId } from '@/game/economy/cars';
import {
  nextUpgradePrice,
  withUpgrade,
  type UpgradeId,
  type UpgradeLevels,
} from '@/game/economy/upgrades';
import { SAVE_VERSION, type SaveFile, type StageRecord } from '@/game/save/SaveFile';
import { frontierStage } from '@/game/stage/StageHistory';

export type { StageRecord };

export interface StageResult {
  stageIndex: number;
  time: number;
  splits: number[];
  prize: number;
  repairCost: number;
  parTime: number;
  newRecord: boolean;
  previousBest: number | null;
}

interface GameState {
  /** Null until the player starts or resumes a game from the splash screen. */
  gameId: string | null;
  driverName: string;
  gameSeed: number;
  money: number;
  stageIndex: number;
  /** Bumped to restart the current stage. */
  attempt: number;
  records: Record<number, StageRecord>;
  carId: CatalogCarId;
  ownedCars: CatalogCarId[];
  upgrades: UpgradeLevels;
  startGame: (gameId: string, driverName: string) => void;
  loadGame: (save: SaveFile, driverName?: string) => void;
  leaveGame: () => void;
  completeStage: (r: Omit<StageResult, 'newRecord' | 'previousBest'>) => StageResult;
  retry: () => void;
  nextStage: () => void;
  /** Drive a completed stage again (or the current one); false if it isn't unlocked yet. */
  driveStage: (index: number) => boolean;
  /** Garage: each returns false when the player can't afford it (or it's maxed / owned). */
  buyUpgrade: (id: UpgradeId) => boolean;
  buyCar: (id: CatalogCarId) => boolean;
  selectCar: (id: CatalogCarId) => void;
}

function randomSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0]!;
}

const NO_GAME = {
  gameId: null,
  driverName: '',
  money: 0,
  stageIndex: 0,
  attempt: 0,
  records: {} as Record<number, StageRecord>,
  carId: 'hatchback' as CatalogCarId,
  ownedCars: ['hatchback'] as CatalogCarId[],
  upgrades: {} as UpgradeLevels,
};

/** Meta-game state; persisted through `snapshotSave` / `loadGame`. */
export const useGameStore = create<GameState>()((set, get) => ({
  ...NO_GAME,
  gameSeed: randomSeed(),
  startGame: (gameId, driverName) =>
    set({ ...NO_GAME, gameId, driverName, gameSeed: randomSeed() }),
  loadGame: (save, driverName) =>
    set({
      gameId: save.gameId,
      driverName: driverName ?? save.driverName,
      gameSeed: save.gameSeed,
      money: save.money,
      stageIndex: save.stageIndex,
      records: save.records,
      carId: save.carId,
      ownedCars: save.ownedCars,
      upgrades: save.upgrades,
      attempt: 0,
    }),
  leaveGame: () => set({ ...NO_GAME }),
  completeStage: (r) => {
    const prev = get().records[r.stageIndex];
    const newRecord = !prev || r.time < prev.best;
    set((s) => ({
      money: Math.max(0, s.money + r.prize - r.repairCost),
      records: newRecord
        ? { ...s.records, [r.stageIndex]: { best: r.time, splits: r.splits } }
        : s.records,
    }));
    return { ...r, newRecord, previousBest: prev?.best ?? null };
  },
  retry: () => set((s) => ({ attempt: s.attempt + 1 })),
  nextStage: () => set((s) => ({ stageIndex: s.stageIndex + 1, attempt: s.attempt + 1 })),
  driveStage: (index) => {
    const s = get();
    if (!Number.isInteger(index) || index < 0) return false;
    if (index > frontierStage(s.stageIndex, s.records)) return false;
    set({ stageIndex: index, attempt: s.attempt + 1 });
    return true;
  },
  buyUpgrade: (id) => {
    const s = get();
    const price = nextUpgradePrice(s.upgrades, id);
    if (price === null || price > s.money) return false;
    set({ money: s.money - price, upgrades: withUpgrade(s.upgrades, id) });
    return true;
  },
  buyCar: (id) => {
    const s = get();
    const price = carPrice(id);
    if (s.ownedCars.includes(id) || price > s.money) return false;
    set({ money: s.money - price, ownedCars: [...s.ownedCars, id], carId: id });
    return true;
  },
  selectCar: (id) => {
    if (get().ownedCars.includes(id)) set({ carId: id });
  },
}));

/** The persistable part of the state, or null when no game is active. */
export function snapshotSave(
  s: Pick<
    GameState,
    | 'gameId'
    | 'driverName'
    | 'gameSeed'
    | 'money'
    | 'stageIndex'
    | 'records'
    | 'carId'
    | 'ownedCars'
    | 'upgrades'
  >,
  now = Date.now(),
): SaveFile | null {
  if (!s.gameId) return null;
  return {
    version: SAVE_VERSION,
    gameId: s.gameId,
    driverName: s.driverName,
    gameSeed: s.gameSeed,
    money: s.money,
    stageIndex: s.stageIndex,
    records: s.records,
    carId: s.carId,
    ownedCars: s.ownedCars,
    upgrades: s.upgrades,
    updatedAt: now,
  };
}
