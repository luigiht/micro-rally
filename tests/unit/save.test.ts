import { describe, expect, it } from 'vitest';
import { createGameId, formatGameId, isValidGameId, normalizeGameId } from '@/game/save/GameId';
import {
  newestSave,
  parseSaveFile,
  sanitizeDriverName,
  SAVE_VERSION,
  type SaveFile,
} from '@/game/save/SaveFile';
import { snapshotSave, useGameStore } from '@/state/gameStore';

describe('GameId', () => {
  it('generates 8 valid Crockford chars from the random source', () => {
    const id = createGameId((n) => Uint8Array.from({ length: n }, (_, i) => i * 37));
    expect(id).toHaveLength(8);
    expect(isValidGameId(id)).toBe(true);
    expect(createGameId()).not.toBe(createGameId());
  });

  it('normalizes separators, case and look-alike letters', () => {
    expect(normalizeGameId(' ab1o-il7u ')).toBe('AB10117V');
    expect(normalizeGameId('abcd-efgh-extra')).toBe('ABCDEFGH');
    expect(isValidGameId('ABCDEFGH')).toBe(true);
    expect(isValidGameId('ABCDEFG')).toBe(false);
    expect(isValidGameId('ABCDEFGI')).toBe(false);
  });

  it('formats partial and full IDs for display', () => {
    expect(formatGameId('abc')).toBe('ABC');
    expect(formatGameId('abcde')).toBe('ABCD-E');
    expect(formatGameId('ABCDEFGH')).toBe('ABCD-EFGH');
  });
});

const VALID: SaveFile = {
  version: SAVE_VERSION,
  gameId: 'ABCD2345',
  driverName: 'Ada',
  gameSeed: 42,
  money: 1500,
  stageIndex: 2,
  records: { 0: { best: 95.2, splits: [20, 40, 60] } },
  carId: 'hatchback',
  ownedCars: ['hatchback'],
  upgrades: {},
  updatedAt: 1_700_000_000_000,
};

describe('SaveFile', () => {
  it('round-trips through JSON', () => {
    expect(parseSaveFile(JSON.parse(JSON.stringify(VALID)))).toEqual(VALID);
  });

  it('rejects malformed input instead of throwing', () => {
    expect(parseSaveFile(null)).toBeNull();
    expect(parseSaveFile({ ...VALID, version: 99 })).toBeNull();
    expect(parseSaveFile({ ...VALID, gameId: 'short' })).toBeNull();
    expect(parseSaveFile({ ...VALID, money: 'lots' })).toBeNull();
    expect(parseSaveFile({ ...VALID, records: { 0: { best: 1, splits: ['x'] } } })).toBeNull();
    expect(parseSaveFile({ ...VALID, records: { '-1': { best: 1, splits: [] } } })).toBeNull();
  });

  it('clamps and sanitizes values', () => {
    const s = parseSaveFile({ ...VALID, money: -5.7, stageIndex: 3.9, driverName: '  A   B  ' })!;
    expect(s.money).toBe(0);
    expect(s.stageIndex).toBe(3);
    expect(s.driverName).toBe('A B');
    expect(sanitizeDriverName('x'.repeat(40))).toHaveLength(24);
  });

  it('picks the newest save', () => {
    const older = { ...VALID, updatedAt: 1 };
    const newer = { ...VALID, updatedAt: 2 };
    expect(newestSave(older, null, newer)).toBe(newer);
    expect(newestSave(null, null)).toBeNull();
  });
});

describe('gameStore persistence', () => {
  it('snapshots progress and restores it', () => {
    const store = useGameStore.getState();
    expect(snapshotSave(store)).toBeNull();
    store.startGame('ABCD2345', 'Ada');
    useGameStore.getState().completeStage({
      stageIndex: 0,
      time: 90,
      splits: [30, 60],
      prize: 400,
      repairCost: 50,
      parTime: 100,
    });
    const snap = snapshotSave(useGameStore.getState(), 123)!;
    expect(snap).toMatchObject({
      gameId: 'ABCD2345',
      driverName: 'Ada',
      money: 350,
      updatedAt: 123,
    });
    expect(snap.records[0]!.best).toBe(90);

    useGameStore.getState().leaveGame();
    expect(useGameStore.getState().gameId).toBeNull();
    useGameStore.getState().loadGame(snap, 'Grace');
    const s = useGameStore.getState();
    expect(s.money).toBe(350);
    expect(s.driverName).toBe('Grace');
    expect(s.gameSeed).toBe(snap.gameSeed);
  });
});
