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
    expect(CAR_CATALOG.map((c) => c.id)).toEqual(['hatchback', 'coupe', 'saloon', 'groupb']);
    for (let i = 1; i < CAR_CATALOG.length; i++) {
      expect(CAR_CATALOG[i]!.price).toBeGreaterThan(CAR_CATALOG[i - 1]!.price);
    }
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
    expect(save.version).toBe(2);
    expect(save.carId).toBe('hatchback');
    expect(save.ownedCars).toEqual(['hatchback']);
    expect(save.upgrades).toEqual({});
    // A selected car the player doesn't own falls back to the hatchback.
    expect(
      parseSaveFile({ ...v1, version: 2, carId: 'coupe', ownedCars: ['hatchback'], upgrades: {} })!
        .carId,
    ).toBe('hatchback');
  });
});
