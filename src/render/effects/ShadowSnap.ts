import { Vector3 } from 'three';

const UP = new Vector3(0, 1, 0);

/**
 * Steps a directional light's target in whole shadow-map texels across the
 * plane facing the light. A shadow camera that follows the car by fractions
 * of a texel resamples every shadow edge each frame, which reads as flicker
 * (worst on bright snow); moved texel by texel the edges stay put.
 * The axes match the shadow camera's own (looking from the light down to its
 * target with +y up), so the steps line up with the map's texels.
 */
export class ShadowSnap {
  private readonly ax = new Vector3();
  private readonly ay = new Vector3();

  /** `toLight` points from the target to the light; `texel` is the frustum width over the map size. */
  constructor(
    toLight: readonly [number, number, number],
    private readonly texel: number,
  ) {
    const az = new Vector3(...toLight).normalize();
    this.ax.crossVectors(UP, az).normalize();
    this.ay.crossVectors(az, this.ax);
  }

  /** Moves `target` in place to the nearest texel corner, leaving its depth along the light alone. */
  snap(target: Vector3): Vector3 {
    const u = target.dot(this.ax);
    const v = target.dot(this.ay);
    target.addScaledVector(this.ax, Math.round(u / this.texel) * this.texel - u);
    return target.addScaledVector(this.ay, Math.round(v / this.texel) * this.texel - v);
  }
}
