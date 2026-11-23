import { Color, ShaderChunk, ShaderLib } from 'three';
import type { SkyGradient } from '../theme/WorldTheme';

/**
 * The twilight dome's colour in direction `d` (unit, world space): `zenith` overhead, `horizon`
 * at the horizon, an afterglow (`glow`, then `glowHot` low down) toward `sunset`. Shared by
 * `SkyDome` and the fog, so ground fading into the distance fades into the sky behind it.
 */
export const SKY_GRADIENT_GLSL = /* glsl */ `
vec3 skyGradient( vec3 d, vec3 zenith, vec3 horizon, vec3 glow, vec3 glowHot, vec3 sunset ) {
  float up = d.y;
  vec3 col = mix( horizon, zenith, smoothstep( 0.0, 0.6, up ) );
  vec2 flat2 = d.xz;
  float len = length( flat2 );
  float toward = len > 0.0001 ? max( dot( flat2 / len, sunset.xz ), 0.0 ) : 0.0;
  float low = smoothstep( -0.04, 0.03, up );
  col = mix( col, glow, pow( toward, 3.0 ) * ( 1.0 - smoothstep( 0.0, 0.32, up ) ) * low * 0.85 );
  col = mix( col, glowHot, pow( toward, 10.0 ) * ( 1.0 - smoothstep( 0.0, 0.1, up ) ) * low * 0.9 );
  return col;
}
`;

/**
 * One array every built-in material shares by reference (three clones a uniform's plain typed
 * array by reference): zenith, horizon, glow, glowHot as vec4s, the sunset direction in the
 * fifth; `[3]` (zenith.w) is 1 while a sky dome is up, 0 for the stock flat fog.
 */
const SKY_FOG = new Float32Array(20);
const tmp = new Color();

const PARS_VERTEX = /* glsl */ `
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogView;
#endif
`;

const VERTEX = /* glsl */ `
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogView = mvPosition.xyz;
#endif
`;

const PARS_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
	uniform vec3 fogColor;
	uniform vec4 skyFog[ 5 ];
	varying float vFogDepth;
	varying vec3 vFogView;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
	${SKY_GRADIENT_GLSL}
#endif
`;

// Fog mixes in after tone mapping and the output conversion; the dome's colour goes through
// both, as the dome itself does, so the two meet without a seam.
const FRAGMENT = /* glsl */ `
#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	vec3 fogTint = fogColor;
	if ( skyFog[ 0 ].w > 0.5 ) {
		vec3 fogDir = normalize( ( vec4( vFogView, 0.0 ) * viewMatrix ).xyz );
		vec4 sky = vec4( skyGradient( fogDir, skyFog[ 0 ].rgb, skyFog[ 1 ].rgb, skyFog[ 2 ].rgb, skyFog[ 3 ].rgb, skyFog[ 4 ].xyz ), 1.0 );
		#if defined( TONE_MAPPING )
			sky.rgb = toneMapping( sky.rgb );
		#endif
		fogTint = linearToOutputTexel( sky ).rgb;
	}
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint, fogFactor );
#endif
`;

/**
 * Under a gradient sky (dusk, sunset, the Savanna's morning) distance fog takes the dome's colour
 * in each view direction instead of one flat colour, so far hills and the road beyond the fog's
 * reach melt into the sky rather than standing on it as pale silhouettes. Patches three's fog
 * chunks and gives every built-in shader the shared `skyFog` uniform, before any material
 * compiles; custom shaders that include the fog chunks read it as zero (stock fog). Idempotent.
 */
export function installSkyFog(): void {
  if (ShaderChunk.fog_pars_fragment.includes('skyFog')) return;
  ShaderChunk.fog_pars_vertex = PARS_VERTEX;
  ShaderChunk.fog_vertex = VERTEX;
  ShaderChunk.fog_pars_fragment = PARS_FRAGMENT;
  ShaderChunk.fog_fragment = FRAGMENT;
  for (const shader of Object.values(ShaderLib))
    if ('fogColor' in shader.uniforms) shader.uniforms.skyFog = { value: SKY_FOG };
}

/** Point the fog at `sky` (and the sun's bearing), or back to its flat colour when there is none. */
export function setSkyFog(sky: SkyGradient | undefined, sunset: readonly number[]): void {
  if (!sky) {
    SKY_FOG[3] = 0;
    return;
  }
  [sky.zenith, sky.horizon, sky.glow, sky.glowHot].forEach((hex, i) => {
    tmp.set(hex);
    SKY_FOG.set([tmp.r, tmp.g, tmp.b, i === 0 ? 1 : 0], i * 4);
  });
  const len = Math.hypot(sunset[0]!, sunset[2]!) || 1;
  SKY_FOG.set([sunset[0]! / len, 0, sunset[2]! / len, 0], 16);
}
