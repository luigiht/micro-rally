import { Color, MeshStandardMaterial, type MeshStandardMaterialParameters } from 'three';
import type { ThemeColor } from './WorldTheme';

export function themeHex(c: ThemeColor): string {
  return typeof c === 'string' ? c : c.hex;
}

export function themeGlow(c: ThemeColor): number {
  return typeof c === 'string' ? 0 : c.glow;
}

/**
 * The colour to bake into vertex attributes: the hex, scaled by its glow when
 * that exceeds one, so a neon face carries HDR values the shader patch and
 * bloom react to. A faint glow (< 1) cannot be baked and is left lit.
 */
export function themeColor(c: ThemeColor, out = new Color()): Color {
  out.set(themeHex(c));
  const glow = themeGlow(c);
  if (glow > 1) out.multiplyScalar(glow);
  return out;
}

/** A flat-shaded standard material in a theme colour; any glow adds the colour itself as emission. */
export function themedMaterial(
  c: ThemeColor,
  extra: MeshStandardMaterialParameters = {},
): MeshStandardMaterial {
  const glow = themeGlow(c);
  return new MeshStandardMaterial({
    color: themeHex(c),
    flatShading: true,
    emissive: glow > 0 ? themeHex(c) : '#000000',
    emissiveIntensity: glow,
    ...extra,
  });
}
