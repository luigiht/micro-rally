import { describe, expect, it } from 'vitest';
import { isSoftwareRenderer } from '@/lib/gpu';

describe('software renderer detection', () => {
  it('recognises the software rasterisers headless and GPU-less browsers fall back to', () => {
    for (const name of [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
      'Google SwiftShader',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'Mesa OffScreen',
      'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0)',
      'Software Rasterizer',
    ]) {
      expect(isSoftwareRenderer(name), name).toBe(true);
    }
  });

  it('leaves hardware renderers alone', () => {
    for (const name of [
      'Apple M2',
      'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'Mali-G78 MP20',
      'Adreno (TM) 740',
      '',
    ]) {
      expect(isSoftwareRenderer(name), name).toBe(false);
    }
  });
});
