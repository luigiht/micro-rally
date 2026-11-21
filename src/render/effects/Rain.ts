import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  type Vector3,
} from 'three';

/**
 * Falling rain or snow round the camera: a box of thin streaks (or round flakes) that stays centred on
 * the camera, each streak falling and wrapping round the box in the vertex
 * shader from a time uniform, so a frame costs one draw call and two uniform
 * writes, with no buffer touched after the first. Each streak is a narrow
 * quad turned to face the camera about the vertical, leaning a little with
 * the wind; it fades into the fog like the scenery behind it.
 */

export interface RainOptions {
  /** Streaks in the box. */
  count: number;
  /** Fall speed, m/s, and the wind's push across it. */
  fall: number;
  wind: number;
  /** One streak's length and width, metres. */
  length: number;
  width: number;
  opacity: number;
  /** How far each drop drifts side to side as it falls, metres (snow); 0 for rain. */
  sway: number;
  /** Round flakes instead of streaks fading up their length. */
  flakes: boolean;
  color: string;
}

export const DEFAULT_RAIN: RainOptions = {
  count: 2600,
  fall: 11,
  wind: 1.6,
  length: 0.75,
  width: 0.018,
  opacity: 0.32,
  sway: 0,
  flakes: false,
  color: '#d4dadd',
};

/** Snow: round white flakes drifting down slowly, swaying as they fall. */
export const DEFAULT_SNOW: RainOptions = {
  count: 2600,
  fall: 1.4,
  wind: 0.5,
  length: 0.13,
  width: 0.065,
  opacity: 0.9,
  sway: 0.6,
  flakes: true,
  color: '#f6f8fa',
};

/** Snow under reduced motion: a quarter of the flakes, slower, barely swaying. */
export const REDUCED_SNOW: Partial<RainOptions> = {
  count: 650,
  fall: 0.8,
  sway: 0.15,
  opacity: 0.75,
};

/**
 * Under reduced motion: a quarter of the streaks, falling at half the speed,
 * shorter and fainter, so it still reads as rain without a field of motion.
 */
export const REDUCED_RAIN: Partial<RainOptions> = {
  count: 650,
  fall: 5.5,
  length: 0.45,
  opacity: 0.22,
};

/** The box round the camera the streaks fill, metres (x, y, z). */
const BOX: readonly [number, number, number] = [60, 30, 60];

const VERTEX = /* glsl */ `
  attribute vec3 aSeed;
  attribute vec2 aCorner;
  uniform float uTime;
  uniform vec3 uCamera;
  uniform vec3 uBox;
  uniform float uFall;
  uniform float uWind;
  uniform float uLength;
  uniform float uWidth;
  uniform float uSway;
  varying float vAlong;
  varying vec2 vCorner;
  varying float vNear;
  #include <fog_pars_vertex>
  void main() {
    // The streak's place in a box that tiles the world, wrapped to the one round the camera.
    vec3 drift = vec3(uWind * uTime, -uFall * uTime, 0.3 * uWind * uTime);
    vec3 p = aSeed * uBox + drift;
    p = mod(p - uCamera + 0.5 * uBox, uBox) - 0.5 * uBox + uCamera;
    // Snow sways as it falls, each flake on its own phase.
    p.x += uSway * sin(uTime * 1.3 + aSeed.y * 40.0);
    p.z += uSway * cos(uTime * 1.1 + aSeed.x * 40.0);
    // Face the camera about the vertical; lean down-wind as it falls.
    vec3 toCamera = uCamera - p;
    vec3 side = normalize(vec3(toCamera.z, 0.0, -toCamera.x) + vec3(1e-4, 0.0, 0.0));
    vec3 down = normalize(vec3(uWind, -uFall, 0.3 * uWind));
    vec3 world = p + side * aCorner.x * uWidth - down * aCorner.y * uLength;
    vAlong = aCorner.y;
    vCorner = vec2(aCorner.x, aCorner.y * 2.0 - 1.0);
    // A streak passing right by the lens would fill the screen: those fade out.
    vNear = smoothstep(1.5, 5.0, length(toCamera));
    vec4 mvPosition = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uFlakes;
  varying float vAlong;
  varying vec2 vCorner;
  varying float vNear;
  #include <fog_pars_fragment>
  void main() {
    // Rain: brightest at the leading drop, trailing off up the streak. Snow: a soft round flake.
    float streak = 1.0 - vAlong;
    float flake = 1.0 - smoothstep(0.55, 1.0, length(vCorner));
    float alpha = uOpacity * mix(streak, flake, uFlakes) * vNear;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;

export class Rain {
  readonly mesh: Mesh;
  private readonly geometry = new BufferGeometry();
  private readonly material: ShaderMaterial;

  constructor(options: Partial<RainOptions> = {}) {
    const o = { ...DEFAULT_RAIN, ...options };
    const n = o.count;
    const seeds = new Float32Array(n * 12);
    const corners = new Float32Array(n * 8);
    const index = new Uint32Array(n * 6);
    // A fixed scatter (a small LCG): the same rain every time, no draw on any game stream.
    let s = 0x2545f491;
    const next = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const cornerPattern = [-1, 0, 1, 0, 1, 1, -1, 1];
    for (let q = 0; q < n; q++) {
      const sx = next();
      const sy = next();
      const sz = next();
      for (let v = 0; v < 4; v++) seeds.set([sx, sy, sz], (q * 4 + v) * 3);
      corners.set(cornerPattern, q * 8);
      const b = q * 4;
      index.set([b, b + 1, b + 2, b, b + 2, b + 3], q * 6);
    }
    // Positions are computed in the shader; this attribute only sizes the draw.
    this.geometry.setAttribute('position', new BufferAttribute(new Float32Array(n * 12), 3));
    this.geometry.setAttribute('aSeed', new BufferAttribute(seeds, 3));
    this.geometry.setAttribute('aCorner', new BufferAttribute(corners, 2));
    this.geometry.setIndex(new BufferAttribute(index, 1));
    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uCamera: { value: [0, 0, 0] },
          uBox: { value: [...BOX] },
          uFall: { value: o.fall },
          uWind: { value: o.wind },
          uLength: { value: o.length },
          uWidth: { value: o.width },
          uColor: { value: new Color(o.color) },
          uOpacity: { value: o.opacity },
          uSway: { value: o.sway },
          uFlakes: { value: o.flakes ? 1 : 0 },
        },
      ]),
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'rain';
    // The streaks move in the shader: the mesh's own bounds mean nothing.
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  /** Advance the rain to `time` seconds round the camera at `camera`. */
  update(time: number, camera: Vector3): void {
    const u = this.material.uniforms;
    u.uTime!.value = time;
    const c = u.uCamera!.value as number[];
    c[0] = camera.x;
    c[1] = camera.y;
    c[2] = camera.z;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
