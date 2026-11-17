import { describe, expect, it } from 'vitest';
import {
  AIR_BONUS_PER_SECOND,
  airBonus,
  paceFactor,
  PRIZE_PER_KM,
  stagePrize,
} from '@/game/economy/prize';

const base = { lengthM: 2000, surface: 'gravel' as const, parTime: 120, loop: 0 };

describe('prize formula', () => {
  it('pays par-pace runs by length and surface', () => {
    expect(stagePrize({ ...base, time: 120 })).toBe(Math.round(PRIZE_PER_KM * 2 * 1.15));
    expect(stagePrize({ ...base, lengthM: 4000, time: 240, parTime: 240 })).toBe(
      2 * stagePrize({ ...base, time: 120 }),
    );
    expect(stagePrize({ ...base, surface: 'snow', time: 120 })).toBeGreaterThan(
      stagePrize({ ...base, surface: 'tarmac', time: 120 }),
    );
  });

  it('rewards beating par, caps the bonus and floors slow runs', () => {
    expect(paceFactor(96, 120)).toBeCloseTo(1.25);
    expect(paceFactor(60, 120)).toBeCloseTo(1.25);
    expect(paceFactor(180, 120)).toBeCloseTo(0.65);
    expect(paceFactor(1000, 120)).toBeCloseTo(0.3);
  });

  it('applies loop, sponsor and lucky multipliers', () => {
    const plain = stagePrize({ ...base, time: 120 });
    expect(stagePrize({ ...base, time: 120, loop: 1 })).toBe(Math.round(plain * 1.25));
    expect(stagePrize({ ...base, time: 120, sponsorBonus: 0.1 })).toBe(Math.round(plain * 1.1));
    expect(stagePrize({ ...base, time: 120, lucky: true })).toBe(plain * 5);
  });
});

describe('air bonus', () => {
  it('pays per second in the air, growing 25% per loop', () => {
    expect(airBonus(0, 0)).toBe(0);
    expect(airBonus(2, 0)).toBe(2 * AIR_BONUS_PER_SECOND);
    expect(airBonus(2, 2)).toBe(Math.round(2 * AIR_BONUS_PER_SECOND * 1.5));
  });
});
