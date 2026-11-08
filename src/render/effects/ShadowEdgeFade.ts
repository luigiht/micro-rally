import { ShaderChunk } from 'three';

/** How much of the shadow map's width, at each edge, the shadows fade over. */
export const SHADOW_EDGE_FADE = 0.15;

const RETURN = '\t\t\treturn mix( 1.0, shadow, shadowIntensity );';
const FADED = `\t\t\tvec2 shadowEdge = min( shadowCoord.xy, 1.0 - shadowCoord.xy );
\t\t\tfloat shadowFade = smoothstep( 0.0, ${SHADOW_EDGE_FADE.toFixed(2)}, min( shadowEdge.x, shadowEdge.y ) );
\t\t\treturn mix( 1.0, shadow, shadowIntensity * shadowFade );`;

/**
 * Directional (and spot) shadows fade out toward the edge of the shadow map
 * instead of stopping on a hard line, so as the frustum follows the car the
 * shadows coming into it grow in rather than pop. Patches three's shared
 * `getShadow` (point-light shadows, indented differently, are left alone)
 * before any material compiles; safe to call more than once.
 */
export function installShadowEdgeFade(): boolean {
  const chunk = ShaderChunk.shadowmap_pars_fragment;
  if (chunk.includes('shadowFade')) return true;
  if (!chunk.includes(RETURN)) return false;
  ShaderChunk.shadowmap_pars_fragment = chunk.split(RETURN).join(FADED);
  return true;
}
