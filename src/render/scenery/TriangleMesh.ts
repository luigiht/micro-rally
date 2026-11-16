import { BufferAttribute, BufferGeometry, Color } from 'three';

/**
 * Hand-built low-poly meshes in vertex colours (the snow pines, the
 * spruces): triangles each wound to face a given way, coloured as they are
 * laid, built into one non-indexed geometry; and a stable jitter for the
 * shapes' irregularities.
 */

export type V3 = [number, number, number];

/** A stable −1..1 from integers. */
export function jitter(a: number, b: number, c: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Coloured triangles, each wound to face along `facing` (a direction it should look toward). */
export class Triangles {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  colour = new Color();

  tri(a: V3, b: V3, c: V3, facing: V3): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const flip = nx * facing[0] + ny * facing[1] + nz * facing[2] < 0;
    this.pos.push(...a, ...(flip ? c : b), ...(flip ? b : c));
    for (let i = 0; i < 3; i++) this.col.push(this.colour.r, this.colour.g, this.colour.b);
  }

  quad(a: V3, b: V3, c: V3, d: V3, facing: V3): void {
    this.tri(a, b, c, facing);
    this.tri(a, c, d, facing);
  }

  /** Every triangle of `g` as it is wound, in the current colour; `g` is disposed. */
  add(g: BufferGeometry): void {
    const flat = g.index ? g.toNonIndexed() : g;
    const p = flat.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.col.push(this.colour.r, this.colour.g, this.colour.b);
    }
    if (flat !== g) flat.dispose();
    g.dispose();
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    g.setAttribute('color', new BufferAttribute(Float32Array.from(this.col), 3));
    g.computeVertexNormals();
    return g;
  }
}
