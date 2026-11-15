import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
} from 'three';

/**
 * The Alpine's ground clutter beside its tiered snow pines: boulders and
 * stumps under caps of snow, each one mesh in vertex colours.
 */

type V3 = [number, number, number];

const SNOW = new Color('#eef2f5');
/** Snow in its own shade: a touch blue where it faces away from the sky. */
const SNOW_SHADE = new Color('#cfdae6');

/** A stable 0..1 from integers. */
function hash(a: number, b: number, c = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Triangles with a colour each, built into one non-indexed geometry. */
class Mesh {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  readonly colour = new Color();

  tri(a: V3, b: V3, c: V3): void {
    this.pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) this.col.push(this.colour.r, this.colour.g, this.colour.b);
  }

  /** Every triangle of `g` (disposed), each coloured by `paint` from how much it faces the sky (−1..1). */
  add(g: BufferGeometry, paint: (up: number, face: number, out: Color) => void): void {
    const flat = g.index ? g.toNonIndexed() : g;
    const p = flat.getAttribute('position');
    for (let i = 0; i + 2 < p.count; i += 3) {
      const a: V3 = [p.getX(i), p.getY(i), p.getZ(i)];
      const b: V3 = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)];
      const c: V3 = [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
      const ux = b[0] - a[0];
      const uy = b[1] - a[1];
      const uz = b[2] - a[2];
      const vx = c[0] - a[0];
      const vy = c[1] - a[1];
      const vz = c[2] - a[2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      paint(ny / (Math.hypot(nx, ny, nz) || 1), i / 3, this.colour);
      this.tri(a, b, c);
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

/** A boulder under a cap of snow: its grey body, its snow on whatever faces the sky. */
export function snowyBoulderGeometry(rock: Color): BufferGeometry {
  const m = new Mesh();
  m.add(new DodecahedronGeometry(0.9, 0).translate(0, 0.25, 0), (up, f, out) => {
    if (up > 0.3) out.copy(SNOW).lerp(SNOW_SHADE, (1 - up) * 0.7);
    else out.copy(rock).multiplyScalar(0.85 + 0.3 * hash(31, f));
  });
  return m.build();
}

/** A stump with a cap of snow and two roots running into the ground. */
export function snowyStumpGeometry(bark: Color): BufferGeometry {
  const m = new Mesh();
  const wood = (_u: number, f: number, out: Color) =>
    out.copy(bark).multiplyScalar(0.85 + 0.3 * hash(41, f));
  m.add(new CylinderGeometry(0.34, 0.42, 0.7, 7).translate(0, 0.3, 0), wood);
  for (const [a, len] of [
    [0.4, 0.75],
    [2.7, 0.6],
  ] as const)
    m.add(
      new CylinderGeometry(0.06, 0.14, len, 5)
        .rotateZ(Math.PI / 2 - 0.35)
        .translate(len / 2, 0.08, 0)
        .rotateY(a),
      wood,
    );
  m.add(new CylinderGeometry(0.36, 0.38, 0.14, 7).translate(0, 0.72, 0), (up, _f, out) =>
    out.copy(up < -0.5 ? bark : SNOW),
  );
  return m.build();
}
