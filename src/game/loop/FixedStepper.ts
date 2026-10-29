export const PHYSICS_HZ = 120;

/** Fixed-timestep accumulator. `advance` returns the render interpolation alpha (0..1). */
export class FixedStepper {
  private acc = 0;

  constructor(
    readonly stepSize = 1 / PHYSICS_HZ,
    readonly maxStepsPerFrame = 12,
  ) {}

  advance(frameDt: number, step: (dt: number) => void): number {
    this.acc += Math.min(Math.max(frameDt, 0), 0.25);
    let n = 0;
    while (this.acc >= this.stepSize && n < this.maxStepsPerFrame) {
      step(this.stepSize);
      this.acc -= this.stepSize;
      n++;
    }
    // Spiral-of-death guard: drop time we could not simulate.
    if (n === this.maxStepsPerFrame) this.acc = Math.min(this.acc, this.stepSize);
    return this.acc / this.stepSize;
  }

  reset(): void {
    this.acc = 0;
  }
}
