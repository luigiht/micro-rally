import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from 'three';
import type { Surface } from '@/game/vehicle/surfaces';
import { WHEEL_COUNT, type WheelContact } from '@/game/vehicle/wheelContacts';

export interface SkidMarkOptions {
  /** Quads in the ring buffer shared by all four wheels; the oldest are recycled. */
  capacity: number;
  /** Mark width in metres (the tyres are 0.26 m wide). */
  width: number;
  /** Height above the ground query (which already includes the road ribbon's lift). */
  lift: number;
  /** A mark stays solid this long, then fades out over `fadeSeconds`. */
  holdSeconds: number;
  fadeSeconds: number;
}

export const DEFAULT_SKID_MARKS: Readonly<SkidMarkOptions> = {
  capacity: 2048,
  width: 0.24,
  lift: 0.02,
  holdSeconds: 8,
  fadeSeconds: 22,
};

/** Sample spacing: dense in curves, sparse on straights (heading change forces a sample). */
const MIN_STEP = 0.3;
const MAX_STEP = 1.2;
const TURN_STEP = 0.07;
/** A jump this long between frames (respawn) starts a new strip instead of a streak. */
const BREAK_DISTANCE = 4;
const RISE_RATE = 10;
const DECAY_RATE = 4;
const MIN_INTENSITY = 0.03;

/** What a sliding tyre leaves on each surface: rubber on tarmac, churned ground elsewhere. */
const INK: Readonly<Record<Surface, { color: string; opacity: number }>> = {
  tarmac: { color: '#17171b', opacity: 0.5 },
  gravel: { color: '#8b6a4a', opacity: 0.5 },
  grass: { color: '#46602a', opacity: 0.6 },
  mud: { color: '#2f2012', opacity: 0.65 },
  snow: { color: '#aebccb', opacity: 0.75 },
};

const VERTEX = /* glsl */ `
  attribute float aIntensity;
  attribute float aBirth;
  attribute float aSide;
  uniform float uTime;
  uniform float uHold;
  uniform float uFade;
  varying float vAlpha;
  varying float vSide;
  varying vec3 vColor;
  #include <fog_pars_vertex>
  void main() {
    float age = uTime - aBirth;
    vAlpha = aIntensity * (1.0 - smoothstep(uHold, uHold + uFade, age));
    vSide = aSide;
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying float vSide;
  varying vec3 vColor;
  #include <fog_pars_fragment>
  void main() {
    float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
    float alpha = vAlpha * edge;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vColor, alpha);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;

interface WheelTrail {
  active: boolean;
  hasDirection: boolean;
  x: number;
  y: number;
  z: number;
  leftX: number;
  leftZ: number;
  rightX: number;
  rightZ: number;
  dirX: number;
  dirZ: number;
  /** Smoothed 0..1 scrub level. */
  level: number;
  /** Intensity and time written at the strip's latest sample. */
  written: number;
  birth: number;
}

function createTrail(): WheelTrail {
  return {
    active: false,
    hasDirection: false,
    x: 0,
    y: 0,
    z: 0,
    leftX: 0,
    leftZ: 0,
    rightX: 0,
    rightZ: 0,
    dirX: 0,
    dirZ: 1,
    level: 0,
    written: 0,
    birth: 0,
  };
}

/**
 * Tyre marks: one mesh holding a ring buffer of quads, one strip per wheel, fading
 * from the oldest end in the shader. World-space, allocation-free after construction.
 */
export class SkidMarks {
  readonly mesh: Mesh;
  private readonly geometry = new BufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly positions: BufferAttribute;
  private readonly colors: BufferAttribute;
  private readonly intensity: BufferAttribute;
  private readonly birth: BufferAttribute;
  private readonly trails: WheelTrail[] = [];
  private readonly ink = new Map<Surface, Color>();
  private head = 0;
  private written = 0;
  readonly options: Readonly<SkidMarkOptions>;

  constructor(options: Partial<SkidMarkOptions> = {}) {
    this.options = { ...DEFAULT_SKID_MARKS, ...options };
    const n = this.options.capacity;
    this.positions = new BufferAttribute(new Float32Array(n * 12), 3).setUsage(DynamicDrawUsage);
    this.colors = new BufferAttribute(new Float32Array(n * 12), 3).setUsage(DynamicDrawUsage);
    this.intensity = new BufferAttribute(new Float32Array(n * 4), 1).setUsage(DynamicDrawUsage);
    this.birth = new BufferAttribute(new Float32Array(n * 4), 1).setUsage(DynamicDrawUsage);
    const side = new Float32Array(n * 4);
    const index = new Uint32Array(n * 6);
    for (let q = 0; q < n; q++) {
      const v = q * 4;
      side[v] = -1;
      side[v + 1] = 1;
      side[v + 2] = 1;
      side[v + 3] = -1;
      index.set([v, v + 1, v + 2, v, v + 2, v + 3], q * 6);
    }
    this.geometry.setAttribute('position', this.positions);
    this.geometry.setAttribute('color', this.colors);
    this.geometry.setAttribute('aIntensity', this.intensity);
    this.geometry.setAttribute('aBirth', this.birth);
    this.geometry.setAttribute('aSide', new BufferAttribute(side, 1));
    this.geometry.setIndex(new BufferAttribute(index, 1));
    this.geometry.setDrawRange(0, 0);
    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uHold: { value: this.options.holdSeconds },
          uFade: { value: this.options.fadeSeconds },
        },
      ]),
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      fog: true,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'skidMarks';
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.renderOrder = 1;
    for (let i = 0; i < WHEEL_COUNT; i++) this.trails.push(createTrail());
    for (const key of Object.keys(INK) as Surface[]) {
      this.ink.set(key, new Color(INK[key].color));
    }
  }

  /** Quads written so far (for tests and the debug overlay). */
  get quadCount(): number {
    return this.written;
  }

  /** Call once per frame with the four contacts, the surface under the car and the sim clock. */
  update(contacts: readonly WheelContact[], surface: Surface, time: number, dt: number): void {
    this.material.uniforms.uTime!.value = time;
    const ink = INK[surface];
    const color = this.ink.get(surface)!;
    for (let i = 0; i < WHEEL_COUNT; i++) {
      const c = contacts[i]!;
      const t = this.trails[i]!;
      const rate = c.intensity > t.level ? RISE_RATE : DECAY_RATE;
      t.level += (c.intensity - t.level) * (1 - Math.exp(-rate * dt));
      const y = c.y + this.options.lift;
      if (t.active) {
        const dx = c.x - t.x;
        const dz = c.z - t.z;
        const dist = Math.hypot(dx, dz);
        if (dist > BREAK_DISTANCE) {
          t.active = false;
        } else if (t.level < MIN_INTENSITY && c.intensity < MIN_INTENSITY) {
          // Close the strip with a quad that tapers to nothing.
          if (t.hasDirection && dist > 0.05)
            this.sample(t, c.x, y, c.z, dx, dz, dist, 0, time, color);
          t.active = false;
        } else if (dist >= MIN_STEP) {
          let take = !t.hasDirection || dist >= MAX_STEP;
          if (!take) {
            const cross = Math.abs(t.dirX * dz - t.dirZ * dx) / dist;
            take = cross >= TURN_STEP;
          }
          if (take) {
            const level = t.level * ink.opacity;
            this.sample(t, c.x, y, c.z, dx, dz, dist, level, time, color);
          }
        }
      }
      if (!t.active && t.level >= MIN_INTENSITY) {
        t.active = true;
        t.hasDirection = false;
        t.x = c.x;
        t.y = y;
        t.z = c.z;
        t.written = t.level * ink.opacity;
        t.birth = time;
      }
    }
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }

  private sample(
    t: WheelTrail,
    x: number,
    y: number,
    z: number,
    dx: number,
    dz: number,
    dist: number,
    level: number,
    time: number,
    color: Color,
  ): void {
    const hw = this.options.width / 2;
    const dirX = dx / dist;
    const dirZ = dz / dist;
    const sideX = dirZ * hw;
    const sideZ = -dirX * hw;
    if (!t.hasDirection) {
      t.leftX = t.x + sideX;
      t.leftZ = t.z + sideZ;
      t.rightX = t.x - sideX;
      t.rightZ = t.z - sideZ;
    }
    const q = this.head;
    const v = q * 4;
    const pos = this.positions;
    pos.setXYZ(v, t.leftX, t.y, t.leftZ);
    pos.setXYZ(v + 1, t.rightX, t.y, t.rightZ);
    pos.setXYZ(v + 2, x - sideX, y, z - sideZ);
    pos.setXYZ(v + 3, x + sideX, y, z + sideZ);
    for (let k = 0; k < 4; k++) this.colors.setXYZ(v + k, color.r, color.g, color.b);
    this.intensity.setX(v, t.written);
    this.intensity.setX(v + 1, t.written);
    this.intensity.setX(v + 2, level);
    this.intensity.setX(v + 3, level);
    this.birth.setX(v, t.birth);
    this.birth.setX(v + 1, t.birth);
    this.birth.setX(v + 2, time);
    this.birth.setX(v + 3, time);
    pos.addUpdateRange(v * 3, 12);
    this.colors.addUpdateRange(v * 3, 12);
    this.intensity.addUpdateRange(v, 4);
    this.birth.addUpdateRange(v, 4);
    pos.needsUpdate = true;
    this.colors.needsUpdate = true;
    this.intensity.needsUpdate = true;
    this.birth.needsUpdate = true;

    this.head = (q + 1) % this.options.capacity;
    this.written++;
    this.geometry.setDrawRange(0, Math.min(this.written, this.options.capacity) * 6);

    t.x = x;
    t.y = y;
    t.z = z;
    t.leftX = x + sideX;
    t.leftZ = z + sideZ;
    t.rightX = x - sideX;
    t.rightZ = z - sideZ;
    t.dirX = dirX;
    t.dirZ = dirZ;
    t.hasDirection = true;
    t.written = level;
    t.birth = time;
  }
}
