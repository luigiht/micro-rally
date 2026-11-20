import { valueNoise } from './valleyFaceColor';

/**
 * Broad patches of lusher and drier grass broken up by smaller tufts
 * (`StagePalette.grassPatches`): one pattern shared by the terrain mesher
 * and the road's verge strips, so the two meet in the same patch at every
 * point and no seam shows between them. Pure: runs in the worker.
 */

/** Patches and the tufts breaking them up, metres across. */
const PATCH = 24;
const TUFT = 7;

/** How far (x, z) leans toward the lush and the dry green, each 0..1. */
export function grassPatchShares(x: number, z: number, out: { lush: number; dry: number }): void {
  const patch = valueNoise(x, z, PATCH, 61) + (valueNoise(x, z, TUFT, 67) - 0.5) * 0.35;
  out.lush = 0.9 * Math.min(1, Math.max(0, (patch - 0.5) / 0.22));
  out.dry = 0.8 * Math.min(1, Math.max(0, (0.46 - patch) / 0.22));
}
