import { MeshStandardMaterial, ShaderLib, type WebGLProgramParametersWithUniforms } from 'three';
import { describe, expect, it } from 'vitest';
import { NEON_CHUNK, patchNeon } from '@/render/theme/NeonMaterial';

describe('NeonMaterial', () => {
  it('rewrites the colour chunk into an emissive test on HDR vertex colours', () => {
    const m = patchNeon(new MeshStandardMaterial({ vertexColors: true }));
    const shader = {
      vertexShader: '',
      fragmentShader:
        'void main() {\n#include <color_fragment>\n#include <emissivemap_fragment>\n}',
    } as WebGLProgramParametersWithUniforms;
    m.onBeforeCompile(shader, null as never);
    const f = shader.fragmentShader;
    expect(f).toContain('#include <color_fragment>');
    expect(f).toContain('#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )');
    expect(f).toContain('totalEmissiveRadiance += vColor.rgb * neon');
    expect(f).toContain('diffuseColor.rgb *= 1.0 - neon');
    expect(f.indexOf(NEON_CHUNK.trim())).toBeLessThan(f.indexOf('emissivemap_fragment'));
    expect(m.customProgramCacheKey()).toBe('neon');
  });

  it("three's standard fragment shader declares the emissive sum before the colour chunk", () => {
    const f = ShaderLib.standard.fragmentShader;
    const emissive = f.indexOf('totalEmissiveRadiance = emissive');
    const color = f.indexOf('#include <color_fragment>');
    expect(emissive).toBeGreaterThan(0);
    expect(emissive).toBeLessThan(color);
    expect(f.indexOf('#include <emissivemap_fragment>')).toBeGreaterThan(color);
  });
});
