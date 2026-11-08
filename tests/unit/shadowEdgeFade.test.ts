import { ShaderChunk } from 'three';
import { describe, expect, it } from 'vitest';
import { installShadowEdgeFade } from '@/render/effects/ShadowEdgeFade';

describe('shadow edge fade', () => {
  it("fades every directional getShadow toward the map's edge, leaves point shadows alone, and patches once", () => {
    const before = ShaderChunk.shadowmap_pars_fragment;
    const plain = before.split('return mix( 1.0, shadow, shadowIntensity );').length - 1;
    expect(installShadowEdgeFade()).toBe(true);
    const after = ShaderChunk.shadowmap_pars_fragment;
    const faded = after.split('shadowIntensity * shadowFade').length - 1;
    // PCF, VSM and basic directional shadows; the two point-light variants keep their hard return.
    expect(faded).toBe(3);
    expect(after.split('return mix( 1.0, shadow, shadowIntensity );').length - 1).toBe(plain - 3);
    expect(installShadowEdgeFade()).toBe(true);
    expect(ShaderChunk.shadowmap_pars_fragment).toBe(after);
  });
});
