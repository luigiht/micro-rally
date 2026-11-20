import { CAR_SPECS, type CarId, type CarSpec } from '../vehicle/CarSpec';

/** Cars on sale in the dealership, in showroom order. */
export const CATALOG_IDS = [
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
  'berlinette',
] as const;
export type CatalogCarId = (typeof CATALOG_IDS)[number];

export interface CarListing {
  id: CatalogCarId;
  price: number;
  /** Shown with a "Special" tag in the dealership: a one-off outside the rally-car ladder. */
  special?: boolean;
}

export const CAR_CATALOG: readonly CarListing[] = [
  { id: 'hatchback', price: 0 },
  { id: 'coupe', price: 4500 },
  { id: 't16', price: 6500 },
  { id: 'saloon', price: 8000 },
  { id: 'wrc', price: 11000 },
  { id: 'groupb', price: 14000 },
  { id: 's1', price: 18000 },
  { id: 'focus', price: 21000 },
  { id: 'dakar', price: 26000, special: true },
  { id: 'lemans', price: 29000, special: true },
  { id: 'buggy', price: 32000, special: true },
  { id: 'berlinette', price: 35000, special: true },
];

/**
 * Cars taken out of the game. Their ids can still turn up in saves and
 * multiplayer sessions from before: a save that owned one gets its price
 * back, and a session seat that picked one drives `replacement` instead.
 *
 * - `satory`, the Satory WRC (a mid-2000s three-door World Rally Car):
 *   hidden from the dealership in decision 268, removed in decision 271.
 *   Its spec (`CarSpec.ts`), hull (`render/car/SatoryShape.ts`), livery
 *   (`render/car/SatoryLivery.ts`), body (`bodies/SatoryHatchBody.tsx`),
 *   interior and names last live in commit ee331c7.
 */
export const RETIRED_CARS: Readonly<
  Record<string, { readonly refund: number; readonly replacement: CatalogCarId }>
> = {
  satory: { refund: 23500, replacement: 'wrc' },
};

export function isCatalogCar(id: string): id is CatalogCarId {
  return (CATALOG_IDS as readonly string[]).includes(id);
}

export function carPrice(id: CarId): number {
  return CAR_CATALOG.find((c) => c.id === id)?.price ?? Infinity;
}

/** Showroom bars, 0..1, derived from the physics so they can't drift from the truth. */
export function carStats(spec: CarSpec): { power: number; grip: number; agility: number } {
  const clamp = (v: number) => Math.max(0.05, Math.min(1, v));
  return {
    power: clamp(spec.peakTorque / 480),
    // The free hatch's 1.1 reads as medium (0.5), the grippiest car's 1.35 as full.
    grip: clamp((spec.tyreGrip - 0.85) / 0.5),
    agility: clamp(1 - (spec.mass - 800) / 900 + (0.6 - spec.cgHeight) * 0.5),
  };
}

export { CAR_SPECS };
