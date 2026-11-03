/**
 * Graphics capability probe for decoration that can be skipped. The splash's
 * attract-mode drive is pure ornament: where WebGL is missing or rendered in
 * software (SwiftShader in a headless Chrome, llvmpipe on a machine without
 * a usable GPU, a browser with acceleration switched off) every frame costs
 * hundreds of milliseconds of main thread, so the page shows a still
 * backdrop there instead. The game itself always gets its canvas.
 */

const SOFTWARE_RENDERERS =
  /swiftshader|llvmpipe|softpipe|software ?rasterizer|microsoft basic render|mesa offscreen/i;

/** Whether a WebGL renderer name belongs to a software rasteriser. */
export function isSoftwareRenderer(name: string): boolean {
  return SOFTWARE_RENDERERS.test(name);
}

export interface GraphicsProbe {
  webgl: boolean;
  renderer: string;
  software: boolean;
}

/** Opens and discards a WebGL context to read the renderer's name. Browser only. */
export function probeGraphics(): GraphicsProbe {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ??
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return { webgl: false, renderer: '', software: true };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(
      info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { webgl: true, renderer, software: isSoftwareRenderer(renderer) };
  } catch {
    return { webgl: false, renderer: '', software: true };
  }
}

/** Whether the splash should run its live drive rather than keep a still backdrop. */
export function canAnimateSplash(): boolean {
  const probe = probeGraphics();
  return probe.webgl && !probe.software;
}
