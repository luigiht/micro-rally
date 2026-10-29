import { describe, expect, it } from 'vitest';
import { FixedStepper } from '@/game/loop/FixedStepper';

describe('FixedStepper', () => {
  it('steps at a fixed rate and returns the leftover as alpha', () => {
    const stepper = new FixedStepper(0.01);
    let steps = 0;
    const alpha = stepper.advance(0.035, () => steps++);
    expect(steps).toBe(3);
    expect(alpha).toBeCloseTo(0.5, 5);
  });

  it('caps steps per frame to avoid a spiral of death', () => {
    const stepper = new FixedStepper(0.01, 5);
    let steps = 0;
    stepper.advance(0.2, () => steps++);
    expect(steps).toBe(5);
    steps = 0;
    stepper.advance(0, () => steps++);
    expect(steps).toBeLessThanOrEqual(1);
  });
});
