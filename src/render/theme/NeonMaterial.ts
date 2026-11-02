import type { MeshStandardMaterial } from 'three';

/**
 * Neon on lit, merged geometry: a face whose vertex colour has any channel
 * above one is drawn as emission instead of lit surface, so builders paint
 * neon simply by baking HDR colours (`themeColor`) into the colour attribute,
 * and the bloom pass (threshold 1) lifts exactly those faces. `vColor` is a
 * vec4 in three r186, so channels are read by name; the guard matches the one
 * `color_pars_fragment` declares it under.
 */
export const NEON_CHUNK = /* glsl */ `
#include <color_fragment>
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
  float neon = step( 1.001, max( vColor.r, max( vColor.g, vColor.b ) ) );
  totalEmissiveRadiance += vColor.rgb * neon;
  diffuseColor.rgb *= 1.0 - neon;
#endif
`;

/** Make a standard material treat HDR vertex colours as neon. Returns the same material. */
export function patchNeon<T extends MeshStandardMaterial>(material: T): T {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', NEON_CHUNK);
  };
  material.customProgramCacheKey = () => 'neon';
  return material;
}
