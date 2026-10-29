import { create } from 'zustand';

export interface StageRecord {
  best: number;
  splits: number[];
}

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
  gameSeed: number;
  money: number;
  stageIndex: number;
  /** Bumped to restart the current stage. */
  attempt: number;
  records: Record<number, StageRecord>;
  completeStage: (r: Omit<StageResult, 'newRecord' | 'previousBest'>) => StageResult;
  retry: () => void;
  nextStage: () => void;
}

function randomSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0]!;
}

/** Meta-game state. Persistence arrives in milestone 6. */
export const useGameStore = create<GameState>()((set, get) => ({
  gameSeed: randomSeed(),
  money: 0,
  stageIndex: 0,
  attempt: 0,
  records: {},
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
}));
