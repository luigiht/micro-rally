import { describe, expect, it } from 'vitest';
import { CAR_CATALOG, carPrice, carStats, isCatalogCar } from '@/game/economy/cars';
import {
  applyUpgrades,
  nextUpgradePrice,
  sanitizeUpgrades,
  UPGRADES,
  withUpgrade,
} from '@/game/economy/upgrades';
import { parseSaveFile, SAVE_VERSION } from '@/game/save/SaveFile';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { snapshotSave, useGameStore } from '@/state/gameStore';

describe('upgrades', () => {
  it('prices climb per level and stop at the max', () => {
    for (const def of UPGRADES) {
      let levels = {};
      let last = 0;
      for (let i = 0; i < def.maxLevel; i++) {
        const price = nextUpgradePrice(levels, def.id)!;
        expect(price).toBeGreaterThan(last);
        expect(price % 10).toBe(0);
        last = price;
        levels = withUpgrade(levels, def.id);
      }
      expect(nextUpgradePrice(levels, def.id)).toBeNull();
      expect(withUpgrade(levels, def.id)[def.id]).toBe(def.maxLevel);
    }
  });

  it('applies to the spec in the expected directions', () => {
    const base = CAR_SPECS.hatchback;
    const tuned = applyUpgrades(base, {
      engine: 3,
      turbo: 1,
      tyres: 2,
      suspension: 1,
      brakes: 2,
      gearbox: 2,
      weight: 2,
    });
    expect(tuned.peakTorque).toBeCloseTo(base.peakTorque * 1.3, 5);
    expect(tuned.turboForce).toBeGreaterThan(0);
    expect(base.turboForce).toBe(0);
    expect(tuned.tyreGrip).toBeGreaterThan(base.tyreGrip);
    expect(tuned.suspensionStiffness).toBeGreaterThan(base.suspensionStiffness);
    expect(tuned.brakeDecel).toBeGreaterThan(base.brakeDecel);
    expect(tuned.shiftTime).toBeLessThan(base.shiftTime);
    expect(tuned.mass).toBeCloseTo(base.mass * 0.9, 5);
    expect(applyUpgrades(base, {})).toEqual(base);
  });

  it('sanitizes loaded levels', () => {
    expect(sanitizeUpgrades({ engine: 99, tyres: 1.7, bogus: 2, brakes: -1 })).toEqual({
      engine: 3,
      tyres: 1,
    });
  });
});

describe('cars', () => {
  it('lists the starter car free and the coupé for sale, with stats in range', () => {
    expect(carPrice('hatchback')).toBe(0);
    expect(carPrice('coupe')).toBeGreaterThan(0);
    expect(isCatalogCar('pickup')).toBe(false);
    for (const c of CAR_CATALOG) {
      const stats = carStats(CAR_SPECS[c.id]);
      for (const v of Object.values(stats)) {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(carStats(CAR_SPECS.coupe).power).toBeGreaterThan(carStats(CAR_SPECS.hatchback).power);
    expect(carStats(CAR_SPECS.groupb).power).toBeGreaterThan(carStats(CAR_SPECS.saloon).power);
    expect(carStats(CAR_SPECS.s1).power).toBeGreaterThan(carStats(CAR_SPECS.groupb).power);
    expect(CAR_CATALOG.map((c) => c.id)).toEqual([
      'hatchback',
      'coupe',
      't16',
      'saloon',
      'wrc',
      'groupb',
      's1',
      'focus',
      'dakar',
      'lemans',
      'buggy',
    ]);
    for (let i = 1; i < CAR_CATALOG.length; i++) {
      expect(CAR_CATALOG[i]!.price).toBeGreaterThan(CAR_CATALOG[i - 1]!.price);
    }
    // The three one-offs close the list and are the only special listings.
    expect(CAR_CATALOG.slice(-3).map((c) => c.id)).toEqual(['dakar', 'lemans', 'buggy']);
    expect(CAR_CATALOG.filter((c) => c.special).map((c) => c.id)).toEqual([
      'dakar',
      'lemans',
      'buggy',
    ]);
  });
});

describe('garage in the store', () => {
  it('buys upgrades and cars only when affordable, and persists them', () => {
    const store = useGameStore.getState();
    store.startGame('GRGE2345', 'Ada');
    expect(useGameStore.getState().buyUpgrade('tyres')).toBe(false);
    expect(useGameStore.getState().buyCar('coupe')).toBe(false);

    useGameStore.setState({ money: 5000 });
    expect(useGameStore.getState().buyUpgrade('tyres')).toBe(true);
    expect(useGameStore.getState().upgrades.tyres).toBe(1);
    expect(useGameStore.getState().money).toBe(5000 - 400);
    expect(useGameStore.getState().buyCar('coupe')).toBe(true);
    expect(useGameStore.getState().carId).toBe('coupe');
    expect(useGameStore.getState().money).toBe(100);
    expect(useGameStore.getState().buyCar('coupe')).toBe(false);
    useGameStore.getState().selectCar('hatchback');
    expect(useGameStore.getState().carId).toBe('hatchback');

    const snap = snapshotSave(useGameStore.getState(), 1)!;
    expect(snap.version).toBe(SAVE_VERSION);
    expect(snap.ownedCars).toEqual(['hatchback', 'coupe']);
    expect(parseSaveFile(JSON.parse(JSON.stringify(snap)))).toEqual(snap);
    useGameStore.getState().leaveGame();
  });

  it('migrates v1 saves to the hatchback with no upgrades', () => {
    const v1 = {
      version: 1,
      gameId: 'ABCD2345',
      driverName: 'Ada',
      gameSeed: 1,
      money: 10,
      stageIndex: 0,
      records: {},
      updatedAt: 5,
    };
    const save = parseSaveFile(v1)!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.carId).toBe('hatchback');
    expect(save.ownedCars).toEqual(['hatchback']);
    expect(save.upgrades).toEqual({});
    // A selected car the player doesn't own falls back to the hatchback.
    expect(
      parseSaveFile({ ...v1, version: 2, carId: 'coupe', ownedCars: ['hatchback'], upgrades: {} })!
        .carId,
    ).toBe('hatchback');
  });

  it('drops v2 records set on stages that are circuits now, keeping the rest', () => {
    const rec = { best: 90, splits: [30, 60, 90] };
    const v2 = {
      version: 2,
      gameId: 'ABCD2345',
      driverName: 'Ada',
      gameSeed: 1,
      money: 10,
      stageIndex: 9,
      records: { 0: rec, 6: rec, 8: rec, 9: rec, 19: rec },
      carId: 'hatchback',
      ownedCars: ['hatchback'],
      upgrades: {},
      updatedAt: 5,
    };
    const save = parseSaveFile(v2)!;
    expect(save.version).toBe(SAVE_VERSION);
    // 9 and 19 go here (circuits now); 6 with the v4 migration (the first Desert became a city),
    // and 0 and 8 with v7's fixed schedule (Forest gravel's surface fixed; a city at stage 9).
    expect(Object.keys(save.records)).toEqual([]);
  });

  it('drops v3 records set on Coast stages, whose roads changed, keeping the rest', () => {
    const rec = { best: 90, splits: [30, 60, 90] };
    const v3 = {
      version: 3,
      gameId: 'ABCD2345',
      driverName: 'Ada',
      gameSeed: 1,
      money: 10,
      stageIndex: 8,
      // 4 and 7 are Coast stages; 9 is a circuit, whose record v3 already kept.
      records: { 0: rec, 3: rec, 4: rec, 6: rec, 7: rec, 9: rec },
      carId: 'hatchback',
      ownedCars: ['hatchback'],
      upgrades: {},
      updatedAt: 5,
    };
    const save = parseSaveFile(v3)!;
    expect(save.version).toBe(SAVE_VERSION);
    // 6 then goes with the v4 migration (the first Desert stage is the first city now), 3
    // with the v5 one (the second Alpine is the first Arctic) and 0 with v7's fixed Forest surface;
    // the circuit's record outlives them all.
    expect(
      Object.keys(save.records)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([9]);
  });

  it('drops v4 records at indices whose region changed with the fifteen-stage cycle, keeping the rest', () => {
    const rec = { best: 90, splits: [30, 60, 90] };
    const v4 = {
      version: 4,
      gameId: 'ABCD2345',
      driverName: 'Ada',
      gameSeed: 1,
      money: 10,
      stageIndex: 16,
      // 0–5 keep their regions; 6 (desert → urban), 7 (coast → desert), 12 (forest → urban) and
      // 15 (alpine → forest) change; 8 stays alpine and 9 is a circuit in both cycles.
      records: { 0: rec, 3: rec, 5: rec, 6: rec, 7: rec, 8: rec, 9: rec, 12: rec, 15: rec },
      carId: 'hatchback',
      ownedCars: ['hatchback'],
      upgrades: {},
      updatedAt: 5,
    };
    const save = parseSaveFile(v4)!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(
      Object.keys(save.records)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([9]);
  });

  it('drops v6 records where the fixed schedule changed the type or surface', () => {
    const rec = { best: 90, splits: [30, 60, 90] };
    const save = parseSaveFile({
      version: 6,
      gameId: 'ABCD2345',
      driverName: 'Ada',
      gameSeed: 1,
      money: 10,
      stageIndex: 20,
      // 0 Forest (surface now fixed), 4 Coast → Arctic, 8 Alpine → city, 9 and 19 circuits,
      // 13 Arctic stays comparable, 27 Alpine is dropped now its surface is fixed to snow.
      records: { 0: rec, 4: rec, 8: rec, 9: rec, 13: rec, 19: rec, 27: rec },
      carId: 'hatchback',
      ownedCars: ['hatchback'],
      upgrades: {},
      updatedAt: 5,
    })!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(
      Object.keys(save.records)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([9, 13, 19]);
  });

  it('shares one grip setup across the dealership', () => {
    const base = CAR_SPECS.hatchback;
    for (const c of CAR_CATALOG) {
      const spec = CAR_SPECS[c.id];
      expect(spec.tyreGrip).toBe(base.tyreGrip);
      expect(spec.corneringFront).toBe(base.corneringFront);
      expect(spec.corneringRear).toBe(base.corneringRear);
      expect(spec.stability).toBe(base.stability);
      expect(spec.aeroGrip).toBe(base.aeroGrip);
    }
  });
});
