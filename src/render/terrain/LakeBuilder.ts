import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { RAYS, type Lake } from '@/game/stage/Lakes';

/**
 * The lakes' water (`Lakes`): each lake a fan from its centre out to its
 * shore points at its level, its sectors cut into rings so the water can
 * shade a touch deeper toward the middle and glint here and there, as a
 * low-poly lake does. The shore stands just over the water, so the fan's rim
 * tucks under the bank without a skirt. One mesh, vertex colours, a little
 * sheen.
 */

/** Rings from the centre to the shore, as shares of each shore ray. */
const RINGS = [0, 0.2, 0.4, 0.58, 0.74, 0.88, 1];
/** How much darker the middle is than the shallows, and the spread of each facet's shade. */
const DEEP = 0.82;
const JITTER = 0.025;
/** A share of the facets catches the sun. */
const GLINT_SHARE = 0.03;
const GLINT = 1.12;
/** The shallows toward the shore pale toward the pebbles under them: this colour, this much on each ring outward. */
const SHALLOW = new Color('#83958f');
const SHALLOWS = [0, 0, 0, 0.06, 0.2, 0.5];

function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class LakeBuilder {
  readonly group = new Group();
  private readonly geometry = new BufferGeometry();
  private readonly material: MeshStandardMaterial;

  constructor(lakes: readonly Lake[], water: string) {
    this.group.name = 'lakes';
    const base = new Color(water);
    const pos: number[] = [];
    const col: number[] = [];
    const tint = new Color();
    lakes.forEach((lake, n) => {
      const y = lake.level;
      const at = (k: number, ring: number): [number, number, number] => {
        const t = RINGS[ring]!;
        const i = k % RAYS;
        return [lake.cx + (lake.xs[i]! - lake.cx) * t, y, lake.cz + (lake.zs[i]! - lake.cz) * t];
      };
      const face = (a: number[], b: number[], c: number[], k: number, ring: number, f: number) => {
        // Deeper toward the middle, each facet a shade of its own, a few catching the sun.
        const depth = DEEP + (1 - DEEP) * RINGS[ring + 1]!;
        const r = hash01(n, k * 8 + ring, f);
        const glint = r < GLINT_SHARE ? GLINT : 1;
        const shade = depth * (1 - JITTER + 2 * JITTER * hash01(n + 7, k, ring * 2 + f)) * glint;
        tint
          .copy(base)
          .lerp(SHALLOW, SHALLOWS[ring] ?? 0)
          .multiplyScalar(shade);
        // Wound counter-clockwise seen from above (+y up): shore points run counter-clockwise in (x, z).
        for (const p of [a, c, b]) {
          pos.push(p[0]!, p[1]!, p[2]!);
          col.push(tint.r, tint.g, tint.b);
        }
      };
      for (let k = 0; k < RAYS; k++) {
        for (let ring = 0; ring + 1 < RINGS.length; ring++) {
          const p0 = at(k, ring);
          const p1 = at(k + 1, ring);
          const q0 = at(k, ring + 1);
          const q1 = at(k + 1, ring + 1);
          if (ring === 0) face(p0, q0, q1, k, ring, 0);
          else {
            face(p0, q0, q1, k, ring, 0);
            face(p0, q1, p1, k, ring, 1);
          }
        }
      }
    });
    this.geometry.setAttribute('position', new BufferAttribute(Float32Array.from(pos), 3));
    this.geometry.setAttribute('color', new BufferAttribute(Float32Array.from(col), 3));
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.35,
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
