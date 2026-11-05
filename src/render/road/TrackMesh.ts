import { BoxGeometry, BufferAttribute, BufferGeometry, type Color } from 'three';

type V3 = readonly [number, number, number];

/** Unit box as a non-indexed triangle list, built once and stamped for every box. */
const UNIT_BOX = (() => {
  const g = new BoxGeometry(1, 1, 1).toNonIndexed();
  const a = Float32Array.from(g.getAttribute('position').array);
  g.dispose();
  return a;
})();

/**
 * A growing triangle soup with one flat colour per face, for the circuit's
 * trackside (kerbs, gravel, barriers, the start line and grandstand). Quads
 * are not welded, so neighbouring stripes keep hard colour edges; boxes are
 * stamped from one unit box, so their winding is always outward.
 */
export class TrackMesh {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];

  get empty(): boolean {
    return this.pos.length === 0;
  }

  private push(p: V3, c: Color): void {
    this.pos.push(p[0], p[1], p[2]);
    this.col.push(c.r, c.g, c.b);
  }

  /**
   * A quad across a ribbon between two cross-sections p and q (q further
   * along), each given by its right (`a`) and left (`b`) edge points: facing
   * up for a flat strip, toward the left for an upright one.
   */
  ribbon(pa: V3, pb: V3, qa: V3, qb: V3, c: Color): void {
    this.push(pa, c);
    this.push(qa, c);
    this.push(pb, c);
    this.push(qa, c);
    this.push(qb, c);
    this.push(pb, c);
  }

  /** An oriented box: centre, size (across, up, along), yaw about +y (heading). */
  box(
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    yaw: number,
    c: Color,
  ): void {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    for (let i = 0; i < UNIT_BOX.length; i += 3) {
      const x = UNIT_BOX[i]! * w;
      const y = UNIT_BOX[i + 1]! * h;
      const z = UNIT_BOX[i + 2]! * d;
      // Rotation about +y by `yaw` (forward (sin, cos), left (cos, −sin)).
      this.pos.push(cx + x * cos + z * sin, cy + y, cz - x * sin + z * cos);
      this.col.push(c.r, c.g, c.b);
    }
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    g.setAttribute('color', new BufferAttribute(Float32Array.from(this.col), 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}
