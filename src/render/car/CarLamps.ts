import {
  Box3,
  type BufferAttribute,
  Color,
  Group,
  Matrix4,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
  SpotLight,
  Vector3,
} from 'three';

const HEAD = '#fff3d6';
const TAIL = '#ff2a1a';
/** Each brake lamp's beam while braking: candela, reach, cone half-angle, edge softness, aim back and down. */
const BRAKE_BEAM_INTENSITY = 10;
const BRAKE_BEAM_DISTANCE = 3;
const BRAKE_BEAM_ANGLE = 0.6;
const BRAKE_BEAM_PENUMBRA = 0.9;
const BRAKE_BEAM_AIM: readonly [number, number] = [1, -1.6];
/** Each headlamp's beam: candela, metres of reach, cone half-angle, edge softness, aim ahead and down. */
const BEAM_INTENSITY = 480;
const BEAM_DISTANCE = 90;
const BEAM_ANGLE = 0.5;
const BEAM_PENUMBRA = 0.65;
const BEAM_AIM: readonly [number, number] = [26, -1.6];
/** The body's own tail lamps brighten this much under braking. */
const BRAKE_BOOST = 2.6;
/** Plain painted lamps (no glow of their own) glow this much after dark, and this much braking. */
const PAINTED_IDLE = 0.35;
const PAINTED_BRAKING = 1.6;
/** Tail lamps lie in the rear quarter of the body; an unlit red part this small (bounding radius, m) is a lamp, not livery. */
const TAIL_ZONE = 0.25;
const SMALL_PART = 0.2;

const box = new Box3();
const part = new Box3();
const toFrame = new Matrix4();
const local = new Matrix4();
const v = new Vector3();
const scale = new Vector3();

/** A lamp red (linear): strong red with little green or blue, which rules out the oranges and pinks. */
function tailRed(r: number, g: number, b: number): boolean {
  return r > 0.12 && g < 0.12 * r && b < 0.15 * r;
}

/** Red lamp faces painted into a hull: their vertices in its colour attribute, and the colours they had. */
interface FaceLamp {
  colors: BufferAttribute;
  vertices: number[];
  base: Float32Array;
}

/** A modelled lamp part, lit by its material. */
interface PartLamp {
  material: MeshStandardMaterial | MeshBasicMaterial;
  color: Color;
  emissive: Color | null;
  emissiveIntensity: number;
  /** Painted only, with no glow of its own: given one after dark. */
  painted: boolean;
}

/**
 * A car's lamps for driving after dark, on the lamps its body already
 * carries: two spotlight beams down the road from the nose, and the body's
 * own red tail lamps brightened under braking, each throwing a red beam back
 * from where it sits. Tail lamps are found by colour in the rear quarter: a hull's
 * glowing faces (its second, unlit material group) and lit lamp parts, or
 * small painted red parts on a body that has none of those, so a red
 * livery never counts. Imperative: the car model adds the group to its
 * sprung body, so the beams lean and pitch with it, calls `setBraking`
 * every frame, and `dispose` gives the body its colours back.
 */
export class CarLamps {
  readonly group = new Group();
  private readonly beams = [0, 1].map(
    () => new SpotLight(HEAD, BEAM_INTENSITY, BEAM_DISTANCE, BEAM_ANGLE, BEAM_PENUMBRA, 2),
  );
  /** Always present (dark until braking), so braking never changes the light count and recompiles shaders. */
  private readonly brakeBeams = [0, 1].map(
    () => new SpotLight(TAIL, 0, BRAKE_BEAM_DISTANCE, BRAKE_BEAM_ANGLE, BRAKE_BEAM_PENUMBRA, 2),
  );
  /** Each side's tail lamps (+x, −x) in the body's frame, for the brake beams. */
  private readonly tailSides: [Box3, Box3] = [new Box3(), new Box3()];
  private cx = 0;
  private faces: FaceLamp[] = [];
  private parts: PartLamp[] = [];
  private braking = -1;

  constructor() {
    this.group.name = 'car-lamps';
    for (const b of [...this.beams, ...this.brakeBeams]) this.group.add(b, b.target);
  }

  /** Aim the beams from the body's nose and find its tail lamps, in the coordinates of `frame` (the sprung body). */
  fit(frame: Object3D, body: Object3D): void {
    this.restore();
    frame.updateMatrixWorld(true);
    toFrame.copy(frame.matrixWorld).invert();
    box.makeEmpty();
    body.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      part
        .copy(mesh.geometry.boundingBox!)
        .applyMatrix4(local.multiplyMatrices(toFrame, mesh.matrixWorld));
      box.union(part);
    });
    if (box.isEmpty()) return;
    const size = box.getSize(new Vector3());
    const y = box.min.y + size.y * 0.32;
    // The bounds take in arches and mirrors, so the beams start well inside them.
    const x = size.x * 0.3;
    const cx = (box.min.x + box.max.x) / 2;
    this.beams.forEach((b, i) => {
      const bx = cx + (i === 0 ? x : -x);
      b.position.set(bx, y, box.max.z + 0.1);
      b.target.position.set(bx, y + BEAM_AIM[1], box.max.z + BEAM_AIM[0]);
    });
    const rear = box.min.z + size.z * TAIL_ZONE;
    this.cx = cx;
    for (const s of this.tailSides) s.makeEmpty();
    this.collect(body, rear, false);
    if (this.faces.length === 0 && this.parts.length === 0) this.collect(body, rear, true);
    // Each brake beam starts just behind its side's lamps (the generic spot when a body has none)
    // and shines back and down, away from the car's own tail.
    this.brakeBeams.forEach((b, i) => {
      const s = this.tailSides[i]!;
      if (s.isEmpty()) {
        b.position.set(cx + (i === 0 ? x : -x), y, box.min.z - 0.08);
      } else {
        s.getCenter(v);
        b.position.set(v.x, v.y, s.min.z - 0.08);
      }
      b.target.position.set(
        b.position.x,
        b.position.y + BRAKE_BEAM_AIM[1],
        b.position.z - BRAKE_BEAM_AIM[0],
      );
    });
    this.braking = -1;
    this.setBraking(0);
  }

  private collect(body: Object3D, rear: number, painted: boolean): void {
    body.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const g = mesh.geometry;
      const pos = g.getAttribute('position');
      if (!pos) return;
      local.multiplyMatrices(toFrame, mesh.matrixWorld);
      const col = g.getAttribute('color') as BufferAttribute | undefined;
      if (col) {
        if (painted) return;
        const lit = g.groups.find((gr) => gr.materialIndex === 1);
        if (!lit) return;
        const vertices: number[] = [];
        for (let i = lit.start; i + 2 < lit.start + lit.count && i + 2 < pos.count; i += 3) {
          const r = (col.getX(i) + col.getX(i + 1) + col.getX(i + 2)) / 3;
          const gg = (col.getY(i) + col.getY(i + 1) + col.getY(i + 2)) / 3;
          const b = (col.getZ(i) + col.getZ(i + 1) + col.getZ(i + 2)) / 3;
          if (!tailRed(r, gg, b)) continue;
          let z = 0;
          for (let k = 0; k < 3; k++) z += v.fromBufferAttribute(pos, i + k).applyMatrix4(local).z;
          if (z / 3 > rear) continue;
          vertices.push(i, i + 1, i + 2);
          for (let k = 0; k < 3; k++) {
            v.fromBufferAttribute(pos, i + k).applyMatrix4(local);
            this.tailSides[v.x >= this.cx ? 0 : 1].expandByPoint(v);
          }
        }
        if (vertices.length === 0) return;
        const base = new Float32Array(vertices.length * 3);
        vertices.forEach((vi, k) => {
          base[k * 3] = col.getX(vi);
          base[k * 3 + 1] = col.getY(vi);
          base[k * 3 + 2] = col.getZ(vi);
        });
        this.faces.push({ colors: col, vertices, base });
        return;
      }
      const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
        MeshStandardMaterial | MeshBasicMaterial | undefined;
      if (!mat?.color || !tailRed(mat.color.r, mat.color.g, mat.color.b)) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (v.copy(g.boundingSphere!.center).applyMatrix4(local).z > rear) return;
      const std = mat as MeshStandardMaterial;
      const lit =
        (mat as MeshBasicMaterial).isMeshBasicMaterial ||
        (std.emissiveIntensity > 0 && (std.emissive?.r ?? 0) > 0);
      const small = g.boundingSphere!.radius * mesh.getWorldScale(scale).x <= SMALL_PART;
      if (painted ? !small : !lit) return;
      if (this.parts.some((p) => p.material === mat)) return;
      v.copy(g.boundingSphere!.center).applyMatrix4(local);
      this.tailSides[v.x >= this.cx ? 0 : 1].expandByPoint(v);
      this.parts.push({
        material: mat,
        color: mat.color.clone(),
        emissive: std.emissive ? std.emissive.clone() : null,
        emissiveIntensity: std.emissiveIntensity ?? 0,
        painted,
      });
    });
  }

  /** 0 off, 1 full: the brake input this frame. */
  setBraking(level: number): void {
    const on = level > 0.05 ? 1 : 0;
    if (on === this.braking) return;
    this.braking = on;
    const k = on ? BRAKE_BOOST : 1;
    for (const f of this.faces) {
      // Red only: scaling all three channels tone-maps the lamp toward pink.
      f.vertices.forEach((vi, i) =>
        f.colors.setXYZ(vi, f.base[i * 3]! * k, f.base[i * 3 + 1]!, f.base[i * 3 + 2]!),
      );
      f.colors.needsUpdate = true;
    }
    for (const p of this.parts) {
      const std = p.material as MeshStandardMaterial;
      if (p.painted && std.emissive) {
        std.emissive.copy(p.color);
        std.emissiveIntensity = on ? PAINTED_BRAKING : PAINTED_IDLE;
      } else if (std.emissive) {
        std.emissiveIntensity = p.emissiveIntensity * k;
      } else {
        p.material.color.setRGB(p.color.r * k, p.color.g, p.color.b);
      }
    }
    for (const b of this.brakeBeams) b.intensity = on * BRAKE_BEAM_INTENSITY;
  }

  /** Give the body back the colours it had before the lamps were fitted. */
  private restore(): void {
    for (const f of this.faces) {
      f.vertices.forEach((vi, i) =>
        f.colors.setXYZ(vi, f.base[i * 3]!, f.base[i * 3 + 1]!, f.base[i * 3 + 2]!),
      );
      f.colors.needsUpdate = true;
    }
    for (const p of this.parts) {
      p.material.color.copy(p.color);
      const std = p.material as MeshStandardMaterial;
      if (std.emissive && p.emissive) std.emissive.copy(p.emissive);
      if (std.emissive) std.emissiveIntensity = p.emissiveIntensity;
    }
    this.faces = [];
    this.parts = [];
  }

  dispose(): void {
    this.restore();
    this.group.removeFromParent();
    for (const b of this.beams) b.dispose();
    for (const b of this.brakeBeams) b.dispose();
  }
}
