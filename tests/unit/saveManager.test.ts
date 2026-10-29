import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, type SaveFile } from '@/game/save/SaveFile';
import { LocalSaveBackend, type SaveBackend, type StorageLike } from '@/lib/save/SaveBackend';
import { SaveManager, type SyncStatus } from '@/lib/save/SaveManager';

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

class FakeRemote implements SaveBackend {
  stored = new Map<string, SaveFile>();
  online = true;
  async load(id: string) {
    if (!this.online) throw new Error('offline');
    return this.stored.get(id) ?? null;
  }
  async save(file: SaveFile) {
    if (!this.online) throw new Error('offline');
    this.stored.set(file.gameId, file);
  }
}

const base: SaveFile = {
  version: SAVE_VERSION,
  gameId: 'ABCD2345',
  driverName: 'Ada',
  gameSeed: 1,
  money: 0,
  stageIndex: 0,
  records: {},
  carId: 'hatchback',
  ownedCars: ['hatchback'],
  upgrades: {},
  updatedAt: 10,
};

describe('SaveManager', () => {
  it('writes locally and online, remembering the last game', async () => {
    const statuses: SyncStatus[] = [];
    const local = new LocalSaveBackend(memoryStorage());
    const remote = new FakeRemote();
    const m = new SaveManager(local, remote, (s) => statuses.push(s));
    await m.save(base);
    expect(local.loadSync(base.gameId)).toEqual(base);
    expect(remote.stored.get(base.gameId)).toEqual(base);
    expect(local.lastGameId).toBe(base.gameId);
    expect(statuses).toEqual(['saving', 'online']);
    expect(m.hasPendingUpload).toBe(false);
  });

  it('keeps the save on the device when the server is unreachable, then retries', async () => {
    const statuses: SyncStatus[] = [];
    const local = new LocalSaveBackend(memoryStorage());
    const remote = new FakeRemote();
    remote.online = false;
    const m = new SaveManager(local, remote, (s) => statuses.push(s));
    await m.save(base);
    expect(local.loadSync(base.gameId)).toEqual(base);
    expect(statuses.at(-1)).toBe('offline');
    expect(m.hasPendingUpload).toBe(true);
    remote.online = true;
    await m.save({ ...base, updatedAt: 11 });
    expect(m.hasPendingUpload).toBe(false);
    expect(remote.stored.get(base.gameId)?.updatedAt).toBe(11);
  });

  it('loads the newest of local and online, tolerating a dead server', async () => {
    const local = new LocalSaveBackend(memoryStorage());
    const remote = new FakeRemote();
    await local.save({ ...base, money: 5, updatedAt: 5 });
    remote.stored.set(base.gameId, { ...base, money: 9, updatedAt: 9 });
    const m = new SaveManager(local, remote);
    expect((await m.load(base.gameId))?.money).toBe(9);
    remote.online = false;
    expect((await m.load(base.gameId))?.money).toBe(5);
    expect(await m.load('ZZZZ2345')).toBeNull();
  });
});
