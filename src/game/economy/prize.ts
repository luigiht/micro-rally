import type { Surface } from '../vehicle/surfaces';

export const PRIZE_PER_KM = 120;

export const SURFACE_DIFFICULTY: Readonly<Record<Surface, number>> = {
  tarmac: 1,
  gravel: 1.15,
  grass: 1.1,
  mud: 1.3,
  snow: 1.35,
};

/**
 * Pace multiplier from finishing time vs par: up to +25% for beating par by
 * 20%, sliding to a 0.3 floor at double par.
 */
export function paceFactor(time: number, par: number): number {
  const r = time / par;
  if (r <= 1) return 1 + Math.min(0.25, (1 - r) * 1.25);
  return Math.max(0.3, 1 - (r - 1) * 0.7);
}

export interface PrizeInput {
  lengthM: number;
  surface: Surface;
  parTime: number;
  time: number;
  loop: number;
  /** Fractional bonus from the Sponsor Deal upgrade, e.g. 0.1 = +10%. */
  sponsorBonus?: number;
  /** True when the Lucky Charm roll paid out (5×). */
  lucky?: boolean;
}

export function stagePrize(p: PrizeInput): number {
  const base =
    PRIZE_PER_KM *
    (p.lengthM / 1000) *
    SURFACE_DIFFICULTY[p.surface] *
    paceFactor(p.time, p.parTime) *
    (1 + 0.25 * p.loop);
  return Math.round(base * (1 + (p.sponsorBonus ?? 0)) * (p.lucky ? 5 : 1));
}
