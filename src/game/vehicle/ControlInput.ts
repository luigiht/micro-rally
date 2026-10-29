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
