import { describe, expect, it } from 'vitest';
import { PinchZoom, pinchDelta } from '@/components/game/input/PinchZoom';

type Handler = (e: TouchEvent) => void;

/** A canvas stand-in: its style and the touch handlers added to it. */
function fakeCanvas() {
  const handlers = new Map<string, Handler>();
  const el = {
    style: { touchAction: 'auto' },
    addEventListener: (type: string, h: Handler) => handlers.set(type, h),
    removeEventListener: (type: string) => handlers.delete(type),
  };
  return { el: el as unknown as HTMLElement, handlers };
}

/** A touch event with fingers at these x positions (one row), cancelable. */
function touches(...xs: number[]) {
  let prevented = false;
  const list = xs.map((x) => ({ clientX: x, clientY: 100 }));
  const e = {
    targetTouches: list as unknown as TouchList,
    cancelable: true,
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as TouchEvent;
  return { e, prevented: () => prevented };
}

describe('pinch zoom', () => {
  it('maps the spread change onto the wheel zoom: spreading zooms in, pinching zooms out', () => {
    // The rigs scale distance by exp(delta × 0.001): twice the spread, half the distance.
    expect(Math.exp(pinchDelta(100, 200) * 0.001)).toBeCloseTo(0.5);
    expect(Math.exp(pinchDelta(200, 100) * 0.001)).toBeCloseTo(2);
    expect(pinchDelta(100, 100)).toBe(0);
    expect(pinchDelta(0, 100)).toBe(0);
  });

  it('zooms with two fingers on the canvas, never with one', () => {
    const { el, handlers } = fakeCanvas();
    const deltas: number[] = [];
    const pinch = new PinchZoom((d) => deltas.push(d));
    pinch.attach(el);
    expect(el.style.touchAction).toBe('none');

    // One finger dragging: no zoom.
    handlers.get('touchstart')!(touches(100).e);
    handlers.get('touchmove')!(touches(160).e);
    expect(deltas).toEqual([]);

    // A second finger lands, then they spread from 100 px apart to 200.
    handlers.get('touchstart')!(touches(100, 200).e);
    const move = touches(50, 250);
    handlers.get('touchmove')!(move.e);
    expect(move.prevented()).toBe(true);
    expect(deltas).toHaveLength(1);
    expect(Math.exp(deltas[0]! * 0.001)).toBeCloseTo(0.5);

    // A finger lifts: the pinch stops.
    handlers.get('touchend')!(touches(50).e);
    handlers.get('touchmove')!(touches(80).e);
    expect(deltas).toHaveLength(1);

    pinch.detach();
    expect(el.style.touchAction).toBe('auto');
    expect(handlers.size).toBe(0);
  });
});
