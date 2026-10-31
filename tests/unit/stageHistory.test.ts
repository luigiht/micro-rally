import { describe, expect, it } from 'vitest';
import { generateStage, stageBrief } from '@/game/stage/StageGenerator';
import { frontierStage, stageWindow } from '@/game/stage/StageHistory';
import { snapshotSave, useGameStore } from '@/state/gameStore';

const rec = (best: number) => ({ best, splits: [] });

describe('stageBrief', () => {
  it('matches the full stage without building the road', () => {
    for (let index = 0; index < 8; index++) {
      const full = generateStage(7, index);
      const brief = stageBrief(7, index);
      expect(brief).toEqual({
        seed: full.seed,
        index: full.index,
        region: full.region,
        loop: full.loop,
        name: full.name,
        surface: full.surface,
        weather: full.weather,
        length: full.length,
        parTime: full.parTime,
      });
    }
  });
});

describe('frontierStage', () => {
  it('is the stage being driven on a fresh game', () => {
    expect(frontierStage(0, {})).toBe(0);
    expect(frontierStage(5, {})).toBe(5);
  });

  it('is one past the last completed stage while replaying an earlier one', () => {
    expect(frontierStage(1, { 0: rec(90), 1: rec(80), 2: rec(70), 3: rec(60) })).toBe(4);
    expect(frontierStage(2, { 0: rec(90), 1: rec(80) })).toBe(2);
  });
});

describe('stageWindow', () => {
  it('shows everything when the list fits', () => {
    expect(stageWindow(3, 2, 0, 6)).toEqual({ start: 0, hidden: 0 });
  });

  it('keeps the newest page and counts the rest as hidden', () => {
    expect(stageWindow(20, 19, 0, 6)).toEqual({ start: 14, hidden: 14 });
    expect(stageWindow(20, 19, 6, 6)).toEqual({ start: 8, hidden: 8 });
    expect(stageWindow(20, 19, 18, 6)).toEqual({ start: 0, hidden: 0 });
  });

  it('widens to include the stage being driven', () => {
    expect(stageWindow(20, 3, 0, 6)).toEqual({ start: 3, hidden: 3 });
  });
});

describe('gameStore.driveStage', () => {
  it('drives completed stages again, refuses locked ones, and keeps the frontier', () => {
    const store = useGameStore.getState();
    store.startGame('ABCD2345', 'Ada');
    const finish = (stageIndex: number) =>
      store.completeStage({
        stageIndex,
        time: 100,
        splits: [],
        prize: 10,
        repairCost: 0,
        parTime: 90,
      });
    finish(0);
    store.nextStage();
    finish(1);
    store.nextStage();
    expect(useGameStore.getState().stageIndex).toBe(2);

    const attempt = useGameStore.getState().attempt;
    expect(store.driveStage(0)).toBe(true);
    expect(useGameStore.getState().stageIndex).toBe(0);
    expect(useGameStore.getState().attempt).toBe(attempt + 1);
    expect(store.driveStage(3)).toBe(false);
    expect(store.driveStage(-1)).toBe(false);
    expect(store.driveStage(2)).toBe(true);

    store.driveStage(0);
    const save = snapshotSave(useGameStore.getState())!;
    expect(save.stageIndex).toBe(0);
    expect(frontierStage(save.stageIndex, save.records)).toBe(2);

    store.nextStage();
    expect(useGameStore.getState().stageIndex).toBe(1);
    store.leaveGame();
  });
});
