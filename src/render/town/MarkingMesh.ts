import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import type { GroundQuery } from '@/game/stage/Town';

/** Rectangles are laid in pieces this long along their axis, so they follow the deck. */
const PIECE = 2;

/**
 * One vertex-coloured mesh of flat rectangles painted on the deck: the
 * crossings' stripes and the parking bays' lines. Each rectangle is given in
 * a local frame (an origin, a heading, an along range and an across range)
 * and laid in pieces, every corner on the deck the field reports there plus
 * a lift. `finish` builds the mesh with the markings' depth offset.
 */
export class MarkingMesh {
  readonly group = new Group();
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly idx: number[] = [];
  private geometry: BufferGeometry | null = null;
  private material: MeshStandardMaterial | null = null;

  constructor(
    name: string,
    private readonly field: GroundQuery,
  ) {
    this.group.name = name;
  }

  /** A rectangle from `a0` to `a1` along heading `h` from (cx, cz), between `l0` and `l1` across (left positive), `lift` over the deck. */
  rect(
    cx: number,
    cz: number,
    h: number,
    a0: number,
    a1: number,
    l0: number,
    l1: number,
    lift: number,
    c: Color,
  ): void {
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const lx = Math.cos(h);
    const lz = -Math.sin(h);
    const lo = Math.min(l0, l1);
    const hi = Math.max(l0, l1);
    const at = (a: number, l: number): [number, number, number] => {
      const x = cx + fx * a + lx * l;
      const z = cz + fz * a + lz * l;
      return [x, this.field.deckAt(x, z) + lift, z];
    };
    for (let a = a0; a < a1 - 1e-6; a += PIECE) {
      const b = Math.min(a1, a + PIECE);
      const base = this.pos.length / 3;
      for (const [x, y, z] of [at(a, lo), at(b, lo), at(b, hi), at(a, hi)]) {
        this.pos.push(x, y, z);
        this.col.push(c.r, c.g, c.b);
      }
      // Counter-clockwise seen from above: along first, then across to the left.
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  /** Build the mesh; call once after every rectangle is laid. */
  finish(): void {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    g.setAttribute('color', new BufferAttribute(Float32Array.from(this.col), 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    this.geometry = g;
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const mesh = new Mesh(g, this.material);
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  dispose(): void {
    this.geometry?.dispose();
    this.material?.dispose();
  }
}
