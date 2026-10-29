import type { CarSpec } from '../vehicle/CarSpec';

export const UPGRADE_IDS = [
  'engine',
  'turbo',
  'tyres',
  'suspension',
  'brakes',
  'gearbox',
  'weight',
] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

/** Purchased level per upgrade; absent means 0. */
export type UpgradeLevels = Partial<Record<UpgradeId, number>>;

export interface UpgradeDef {
  id: UpgradeId;
  maxLevel: number;
  /** Price of level 1; each further level costs `growth`× the previous. */
  basePrice: number;
  growth: number;
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'engine', maxLevel: 3, basePrice: 600, growth: 1.6 },
  { id: 'turbo', maxLevel: 2, basePrice: 900, growth: 1.8 },
  { id: 'tyres', maxLevel: 3, basePrice: 400, growth: 1.6 },
  { id: 'suspension', maxLevel: 3, basePrice: 450, growth: 1.6 },
  { id: 'brakes', maxLevel: 2, basePrice: 350, growth: 1.7 },
  { id: 'gearbox', maxLevel: 2, basePrice: 500, growth: 1.7 },
  { id: 'weight', maxLevel: 2, basePrice: 700, growth: 1.9 },
];

export function upgradeDef(id: UpgradeId): UpgradeDef {
  return UPGRADES.find((u) => u.id === id)!;
}

export function upgradeLevel(levels: UpgradeLevels, id: UpgradeId): number {
  return levels[id] ?? 0;
}

/** Price of the next level, rounded to $10, or null when maxed out. */
export function nextUpgradePrice(levels: UpgradeLevels, id: UpgradeId): number | null {
  const def = upgradeDef(id);
  const level = upgradeLevel(levels, id);
  if (level >= def.maxLevel) return null;
  return Math.round((def.basePrice * def.growth ** level) / 10) * 10;
}

/** Levels after buying one more of `id` (no money check). */
export function withUpgrade(levels: UpgradeLevels, id: UpgradeId): UpgradeLevels {
  return { ...levels, [id]: Math.min(upgradeDef(id).maxLevel, upgradeLevel(levels, id) + 1) };
}

/** Clamp every level into range and drop unknown keys (used when loading saves). */
export function sanitizeUpgrades(raw: Record<string, unknown>): UpgradeLevels {
  const out: UpgradeLevels = {};
  for (const def of UPGRADES) {
    const v = raw[def.id];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      out[def.id] = Math.min(def.maxLevel, Math.floor(v));
    }
  }
  return out;
}

/** The car as it drives: base spec with every purchased level applied. */
export function applyUpgrades(spec: CarSpec, levels: UpgradeLevels): CarSpec {
  const l = (id: UpgradeId) => upgradeLevel(levels, id);
  const turbo = l('turbo');
  return {
    ...spec,
    peakTorque: spec.peakTorque * (1 + 0.1 * l('engine')),
    turboForce: turbo > 0 ? 0.25 + 0.15 * (turbo - 1) : spec.turboForce,
    tyreGrip: spec.tyreGrip * (1 + 0.06 * l('tyres')),
    corneringFront: spec.corneringFront * (1 + 0.05 * l('tyres')),
    corneringRear: spec.corneringRear * (1 + 0.05 * l('tyres')),
    suspensionStiffness: spec.suspensionStiffness * (1 + 0.08 * l('suspension')),
    suspensionDamping: spec.suspensionDamping * (1 + 0.1 * l('suspension')),
    stability: Math.min(0.9, spec.stability + 0.1 * l('suspension')),
    brakeDecel: spec.brakeDecel * (1 + 0.12 * l('brakes')),
    shiftTime: Math.max(0.05, spec.shiftTime * (1 - 0.3 * l('gearbox'))),
    drivetrainEfficiency: Math.min(0.95, spec.drivetrainEfficiency + 0.02 * l('gearbox')),
    mass: spec.mass * (1 - 0.05 * l('weight')),
  };
}
