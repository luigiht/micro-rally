import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from 'three';

/**
 * Spray thrown up by tyres wading a watersplash. A ring of soft round
 * billboards: `emit` writes one particle's birth (where, which way, when, how
 * big, how muddy) into the next slot and uploads just that slot; the vertex
 * shader flies it under gravity from those alone, growing and fading it over
 * its life. One draw call, fixed buffers, nothing allocated per frame.
 */

export interface SprayOptions {
  /** Particles alive at most (the ring's size). */
  capacity: number;
  /** Seconds a particle lives. */
  life: number;
}

export const DEFAULT_SPRAY: SprayOptions = { capacity: 1400, life: 1.1 };

const GRAVITY = 9.81;
const WHITE = '#eef1ef';
const MUD = '#7d6d57';

const VERTEX = /* glsl */ `
  attribute vec3 aOrigin;
  attribute vec3 aVelocity;
  attribute vec2 aCorner;
  attribute float aBirth;
  attribute float aSize;
  attribute float aMud;
  uniform float uTime;
  uniform float uLife;
  uniform float uGravity;
  varying vec2 vCorner;
  varying float vAlpha;
  varying float vMud;
  #include <fog_pars_vertex>
  void main() {
    float t = uTime - aBirth;
    float k = t / uLife;
    vCorner = aCorner;
    vMud = aMud;
    // Unborn or spent: collapse off screen.
    if (t < 0.0 || k > 1.0) {
      vAlpha = 0.0;
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec3 p = aOrigin + aVelocity * t - vec3(0.0, 0.5 * uGravity * t * t, 0.0);
    // Water never falls through the road: it settles at the height it left.
    p.y = max(p.y, aOrigin.y - 0.05);
    vAlpha = (1.0 - k) * (1.0 - k) * smoothstep(0.0, 0.06, t);
    float size = aSize * (0.45 + 1.6 * k);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    mvPosition.xy += aCorner * size;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uWhite;
  uniform vec3 uMud;
  varying vec2 vCorner;
  varying float vAlpha;
  varying float vMud;
  #include <fog_pars_fragment>
  void main() {
    float r = length(vCorner);
    float alpha = vAlpha * (1.0 - smoothstep(0.35, 1.0, r)) * 0.8;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(mix(uWhite, uMud, vMud), alpha);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;

export class WaterSpray {
  readonly mesh: Mesh;
  readonly options: Readonly<SprayOptions>;
  private readonly geometry = new BufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly origin: BufferAttribute;
  private readonly velocity: BufferAttribute;
  private readonly birth: BufferAttribute;
  private readonly size: BufferAttribute;
  private readonly mud: BufferAttribute;
  private head = 0;
  /** Slots written since the last `flush`: the first, and how many in a row. */
  private dirtyFrom = -1;
  private dirtyCount = 0;

  constructor(options: Partial<SprayOptions> = {}) {
    this.options = { ...DEFAULT_SPRAY, ...options };
    const n = this.options.capacity;
    const attr = (width: number) =>
      new BufferAttribute(new Float32Array(n * 4 * width), width).setUsage(DynamicDrawUsage);
    this.origin = attr(3);
    this.velocity = attr(3);
    this.birth = attr(1);
    this.size = attr(1);
    this.mud = attr(1);
    // Every slot starts spent.
    (this.birth.array as Float32Array).fill(-1e6);
    const corners = new Float32Array(n * 8);
    const index = new Uint32Array(n * 6);
    const pattern = [-1, -1, 1, -1, 1, 1, -1, 1];
    for (let q = 0; q < n; q++) {
      corners.set(pattern, q * 8);
      const b = q * 4;
      index.set([b, b + 1, b + 2, b, b + 2, b + 3], q * 6);
    }
    this.geometry.setAttribute('position', new BufferAttribute(new Float32Array(n * 12), 3));
    this.geometry.setAttribute('aOrigin', this.origin);
    this.geometry.setAttribute('aVelocity', this.velocity);
    this.geometry.setAttribute('aBirth', this.birth);
    this.geometry.setAttribute('aSize', this.size);
    this.geometry.setAttribute('aMud', this.mud);
    this.geometry.setAttribute('aCorner', new BufferAttribute(corners, 2));
    this.geometry.setIndex(new BufferAttribute(index, 1));
    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uLife: { value: this.options.life },
          uGravity: { value: GRAVITY },
          uWhite: { value: new Color(WHITE) },
          uMud: { value: new Color(MUD) },
        },
      ]),
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'waterSpray';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
  }

  /** The clock the particles fly by (seconds; the same clock `emit` is stamped with). */
  setTime(time: number): void {
    this.material.uniforms.uTime!.value = time;
  }

  /** Throw one particle from (x, y, z) with velocity (vx, vy, vz) at `time`; `mud` 0 white water … 1 brown. */
  emit(
    time: number,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    mud: number,
  ): void {
    const q = this.head;
    this.head = (q + 1) % this.options.capacity;
    const o = this.origin.array as Float32Array;
    const v = this.velocity.array as Float32Array;
    const b = this.birth.array as Float32Array;
    const s = this.size.array as Float32Array;
    const m = this.mud.array as Float32Array;
    for (let c = 0; c < 4; c++) {
      const i = q * 4 + c;
      o[i * 3] = x;
      o[i * 3 + 1] = y;
      o[i * 3 + 2] = z;
      v[i * 3] = vx;
      v[i * 3 + 1] = vy;
      v[i * 3 + 2] = vz;
      b[i] = time;
      s[i] = size;
      m[i] = mud;
    }
    // Mark the run of slots written since the last flush (it may wrap round the ring once).
    if (this.dirtyFrom < 0) this.dirtyFrom = q;
    this.dirtyCount = Math.min(this.options.capacity, this.dirtyCount + 1);
  }

  /** Upload what `emit` wrote since the last flush: one or two ranges per attribute. */
  flush(): void {
    if (this.dirtyFrom < 0) return;
    const n = this.options.capacity;
    const from = this.dirtyFrom;
    const count = this.dirtyCount;
    const first = Math.min(count, n - from);
    this.upload(this.origin, 3, from, first, count - first);
    this.upload(this.velocity, 3, from, first, count - first);
    this.upload(this.birth, 1, from, first, count - first);
    this.upload(this.size, 1, from, first, count - first);
    this.upload(this.mud, 1, from, first, count - first);
    this.dirtyFrom = -1;
    this.dirtyCount = 0;
  }

  private upload(a: BufferAttribute, width: number, from: number, first: number, wrapped: number) {
    a.addUpdateRange(from * 4 * width, first * 4 * width);
    if (wrapped > 0) a.addUpdateRange(0, wrapped * 4 * width);
    a.needsUpdate = true;
  }

  /** Drop every live particle (a restart or a replay starting). */
  clear(): void {
    (this.birth.array as Float32Array).fill(-1e6);
    this.birth.clearUpdateRanges();
    this.birth.needsUpdate = true;
    this.dirtyFrom = -1;
    this.dirtyCount = 0;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
