import { CAR_SPECS, type CarId, type CarSpec } from '../vehicle/CarSpec';

/** Cars on sale in the dealership, in showroom order. */
export const CATALOG_IDS = ['hatchback', 'coupe', 'saloon', 'wrc', 'groupb', 's1'] as const;
export type CatalogCarId = (typeof CATALOG_IDS)[number];

export interface CarListing {
  id: CatalogCarId;
  price: number;
}

export const CAR_CATALOG: readonly CarListing[] = [
  { id: 'hatchback', price: 0 },
  { id: 'coupe', price: 4500 },
  { id: 'saloon', price: 8000 },
  { id: 'wrc', price: 11000 },
  { id: 'groupb', price: 14000 },
  { id: 's1', price: 18000 },
];

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
    grip: clamp((spec.tyreGrip - 0.7) / 0.5),
    agility: clamp(1 - (spec.mass - 800) / 900 + (0.6 - spec.cgHeight) * 0.5),
  };
}

export { CAR_SPECS };
