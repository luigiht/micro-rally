import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import type { River } from '@/game/stage/Rivers';

/**
 * The frozen rivers' ice (`Rivers`): one ribbon per river along its line at
 * its ice level, a little wider than the channel's floor so its edges tuck
 * under the banks, narrowing to nothing where the river fades into the
 * ground at either end. Cut into pieces across and along, each pale blue
 * ice, clearer darker ice, or a drift of snow, a shade lighter or darker, so
 * the ice reads frozen rather than painted. One mesh, vertex colours, a
 * faint sheen.
 */

/** The ice is drawn this hair over its level (the channel's floor lies a little under it), and reaches this share of the river's half width. */
const LIFT = 0.02;
const WIDE = 1.12;
/** Pieces across the ice, and along each step of the river's line. */
const BANDS = 4;
const SPLIT = 2;
const ICE = new Color('#b3d2e6');
const CLEAR = new Color('#86b3d1');
const DRIFT = new Color('#eef3f7');
/** Shares of the pieces that are clear ice and drifted snow (more snow toward the banks). */
const CLEAR_SHARE = 0.22;
const DRIFT_SHARE = 0.16;
const DRIFT_EDGE = 0.22;
const JITTER = 0.05;

function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The ice's left edge offset at point `i` of a river: its line's normal times the half width there. */
function across(r: River, i: number): [number, number] {
  const p = r.points;
  const a = p[Math.max(0, i - 1)]!;
  const b = p[Math.min(p.length - 1, i + 1)]!;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const w = r.halfWidth * WIDE * p[i]!.fade;
  return [(dz / len) * w, (-dx / len) * w];
}

export class FrozenRiverBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: MeshStandardMaterial;

  constructor(rivers: readonly River[]) {
    this.group.name = 'frozen-rivers';
    const pos: number[] = [];
    const col: number[] = [];
    const tone = new Color();
    rivers.forEach((r, ri) => {
      const p = r.points;
      for (let i = 0; i + 1 < p.length; i++) {
        const [ax, az] = across(r, i);
        const [bx, bz] = across(r, i + 1);
        for (let s = 0; s < SPLIT; s++) {
          const t0 = s / SPLIT;
          const t1 = (s + 1) / SPLIT;
          const lerp = (u: number, a: number, b: number) => a + (b - a) * u;
          // The line, its edge offset and its level at a share of the way along this step.
          const at = (u: number) => ({
            x: lerp(u, p[i]!.x, p[i + 1]!.x),
            z: lerp(u, p[i]!.z, p[i + 1]!.z),
            ox: lerp(u, ax, bx),
            oz: lerp(u, az, bz),
            y: lerp(u, p[i]!.level, p[i + 1]!.level) + LIFT,
          });
          const q0 = at(t0);
          const q1 = at(t1);
          for (let b = 0; b < BANDS; b++) {
            const f0 = (b / BANDS) * 2 - 1;
            const f1 = ((b + 1) / BANDS) * 2 - 1;
            const corner = (q: typeof q0, f: number): [number, number, number] => [
              q.x + q.ox * f,
              q.y,
              q.z + q.oz * f,
            ];
            const a0 = corner(q0, f0);
            const a1 = corner(q0, f1);
            const b0 = corner(q1, f0);
            const b1 = corner(q1, f1);
            // Wound to face up: (a0, b0, a1) and (a1, b0, b1) turn counter-clockwise seen from above.
            pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
            const h = hash01(ri, i * SPLIT + s, b);
            const edge = b === 0 || b === BANDS - 1 ? DRIFT_EDGE : 0;
            if (h < DRIFT_SHARE + edge) tone.copy(DRIFT);
            else if (h < DRIFT_SHARE + edge + CLEAR_SHARE) tone.copy(CLEAR);
            else tone.copy(ICE);
            tone.multiplyScalar(1 + (hash01(ri + 7, i * SPLIT + s, b) - 0.5) * 2 * JITTER);
            for (let v = 0; v < 6; v++) col.push(tone.r, tone.g, tone.b);
          }
        }
      }
    });
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(Float32Array.from(pos), 3));
    this.geometry.setAttribute('color', new BufferAttribute(Float32Array.from(col), 3));
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.3,
      metalness: 0.05,
    });
    const mesh = new Mesh(this.geometry, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
