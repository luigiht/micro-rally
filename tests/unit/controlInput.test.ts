import { describe, expect, it } from 'vitest';
import {
  createControlInput,
  mergeControlInput,
  resetControlInput,
} from '@/game/vehicle/ControlInput';

describe('mergeControlInput', () => {
  it('takes the stronger pedal, sums steer within ±1 and ORs buttons', () => {
    const kb = createControlInput();
    const touch = createControlInput();
    const out = createControlInput();
    kb.throttle = 0.4;
    touch.throttle = 1;
    kb.steer = -1;
    touch.steer = -1;
    touch.handbrake = true;
    mergeControlInput(kb, touch, out);
    expect(out.throttle).toBe(1);
    expect(out.steer).toBe(-1);
    expect(out.handbrake).toBe(true);
    expect(out.turbo).toBe(false);
  });

  it('moves edge-triggered shifts to the output and clears the sources', () => {
    const kb = createControlInput();
    const touch = createControlInput();
    const out = createControlInput();
    kb.shiftUp = true;
    touch.shiftDown = true;
    mergeControlInput(kb, touch, out);
    expect(out.shiftUp).toBe(true);
    expect(out.shiftDown).toBe(true);
    expect(kb.shiftUp).toBe(false);
    expect(touch.shiftDown).toBe(false);
  });

  it('resetControlInput zeroes every field', () => {
    const i = createControlInput();
    i.throttle = 1;
    i.steer = 0.5;
    i.turbo = true;
    resetControlInput(i);
    expect(i).toEqual(createControlInput());
  });
});
