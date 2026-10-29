/** Driver controls for one sim step. Steer: -1 full left … +1 full right. */
export interface ControlInput {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  turbo: boolean;
  /** Manual gearbox edge-triggered requests; consumed by the sim. */
  shiftUp: boolean;
  shiftDown: boolean;
}

/** Zero every field in place (e.g. when a controller detaches). */
export function resetControlInput(input: ControlInput): void {
  input.throttle = 0;
  input.brake = 0;
  input.steer = 0;
  input.handbrake = false;
  input.turbo = false;
  input.shiftUp = false;
  input.shiftDown = false;
}

/**
 * Combine two controllers (e.g. keyboard + touch) into `out`. Pedals take the
 * stronger press, steer sums and clamps, buttons OR together. Edge-triggered
 * shift requests move to `out` and are cleared on the sources, so the sim can
 * consume them from the merged input.
 */
export function mergeControlInput(
  a: ControlInput,
  b: ControlInput,
  out: ControlInput,
): ControlInput {
  out.throttle = Math.max(a.throttle, b.throttle);
  out.brake = Math.max(a.brake, b.brake);
  out.steer = Math.max(-1, Math.min(1, a.steer + b.steer));
  out.handbrake = a.handbrake || b.handbrake;
  out.turbo = a.turbo || b.turbo;
  out.shiftUp = a.shiftUp || b.shiftUp;
  out.shiftDown = a.shiftDown || b.shiftDown;
  a.shiftUp = b.shiftUp = false;
  a.shiftDown = b.shiftDown = false;
  return out;
}

export function createControlInput(): ControlInput {
  return {
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    turbo: false,
    shiftUp: false,
    shiftDown: false,
  };
}
