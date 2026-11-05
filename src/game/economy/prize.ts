import type { Surface } from '../vehicle/surfaces';

/**
 * Prize per kilometre at par pace on tarmac. Tuned so that a stage of the
 * usual 1.5–2 km pays about $1500 at par and $1200 at 1.3× par: three or
 * four stages buy the first dealership car ($4500), and the dearer cars
 * follow every four to seven as the +25%-per-loop bonus grows. Upgrade
 * levels ($350–1600) are small change beside that, bought between cars.
 */
export const PRIZE_PER_KM = 800;

export const SURFACE_DIFFICULTY: Readonly<Record<Surface, number>> = {
  tarmac: 1,
  track: 1,
  gravel: 1.15,
  grass: 1.1,
  mud: 1.3,
  snow: 1.35,
  sand: 1.2,
  dune: 1.3,
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

/**
 * A circuit race pays this share of its distance's worth: three laps run to
 * five or six kilometres of wide, grippy tarmac, so it pays like about two
 * rally stages rather than three.
 */
export const CIRCUIT_PRIZE_FACTOR = 0.6;

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
  /** A circuit race (see `CIRCUIT_PRIZE_FACTOR`). */
  circuit?: boolean;
}

export function stagePrize(p: PrizeInput): number {
  const base =
    PRIZE_PER_KM *
    (p.lengthM / 1000) *
    SURFACE_DIFFICULTY[p.surface] *
    paceFactor(p.time, p.parTime) *
    (1 + 0.25 * p.loop) *
    (p.circuit ? CIRCUIT_PRIZE_FACTOR : 1);
  return Math.round(base * (1 + (p.sponsorBonus ?? 0)) * (p.lucky ? 5 : 1));
}
