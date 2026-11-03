/**
 * Free-standing wheel-arch fender: a thick half-ring shell around an axle,
 * open underneath, lofted from an outer outline given as angles around the
 * axle. Rally-raid buggies wear these as separate mudguards standing proud of
 * a narrow tub; the lofted hull (`CarHull.ts`) can cut an arch into a body
 * but cannot stand one above it. The cross-section is a flat-topped ring
 * piece with a chamfer on its outer top edge, so the dome reads rounded in
 * flat shading. Output matches `HullMesh` so the same mesh component draws
 * it, and this module stays free of three.js and unit-testable.
 */
import type { HullMesh } from './CarHull';

export interface FenderSpec {
  /** Axle position along the car and height above the ground. */
  z: number;
  axleY: number;
  /** Arch radius, a little more than the tyre (the hull's well radius). */
  inner: number;
  /**
   * Outer surface as [angle, radius] pairs, ascending by angle: degrees
   * around the axle from straight up, positive toward the nose, so −90 is
   * level with the hub behind it and 90 level with it ahead.
   */
  outline: readonly (readonly [number, number])[];
  /** The shell spans |x| from `xIn` to `xOut`, mirrored on both sides of the car. */
  xIn: number;
  xOut: number;
  /** Chamfer on the outer top edge. */
  bevel: number;
  colors: { body: string; trim: string };
}

type V3 = [number, number, number];

const DEG = Math.PI / 180;

/** sRGB hex → linear RGB, which is what a vertex colour attribute holds. */
function hexToRgb(hex: string): V3 {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)];
}

/** Outer radius at `angleDeg`, interpolated along the outline and clamped to its ends. */
export function fenderRadiusAt(spec: FenderSpec, angleDeg: number): number {
  const o = spec.outline;
  if (angleDeg <= o[0]![0]) return o[0]![1];
  for (let i = 0; i < o.length - 1; i++) {
    const [a0, r0] = o[i]!;
    const [a1, r1] = o[i + 1]!;
    if (angleDeg <= a1) return r0 + ((r1 - r0) * (angleDeg - a0)) / (a1 - a0 || 1);
  }
  return o[o.length - 1]![1];
}

/**
 * A point on the fender's outer surface at `angleDeg`, lifted `lift` along the
 * surface normal, with the angle in radians a part is rotated about x so its
 * +y axis lies along that normal. Parts seat themselves on the dome with this.
 */
export function fenderPoint(
  spec: FenderSpec,
  angleDeg: number,
  lift = 0,
): { y: number; z: number; tilt: number } {
  const a = angleDeg * DEG;
  const r = fenderRadiusAt(spec, angleDeg) + lift;
  return { y: spec.axleY + r * Math.cos(a), z: spec.z + r * Math.sin(a), tilt: a };
}

export function buildFenderShell(spec: FenderSpec): HullMesh {
  const pos: number[] = [];
  const col: number[] = [];
  const body = hexToRgb(spec.colors.body);
  const trim = hexToRgb(spec.colors.trim);

  function tri(a: V3, b: V3, c: V3, expected: V3, color: V3): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (Math.hypot(nx, ny, nz) < 1e-9) return;
    const flip = nx * expected[0] + ny * expected[1] + nz * expected[2] < 0;
    for (const p of flip ? [a, c, b] : [a, b, c]) {
      pos.push(p[0], p[1], p[2]);
      col.push(color[0], color[1], color[2]);
    }
  }

  function quad(a: V3, b: V3, c: V3, d: V3, expected: V3, color: V3): void {
    tri(a, b, c, expected, color);
    tri(a, c, d, expected, color);
  }

  const { inner, xIn, xOut, bevel } = spec;
  const rings = spec.outline.map(([deg, outer]) => {
    const a = deg * DEG;
    return { dy: Math.cos(a), dz: Math.sin(a), outer };
  });

  for (const sgn of [1, -1] as const) {
    // Cross-section loop at ring k: arch inboard, up the inboard wall, across
    // the top, down the chamfer and the outboard wall, back along the arch.
    const loop = (k: number): V3[] => {
      const { dy, dz, outer } = rings[k]!;
      const at = (r: number, x: number): V3 => [x * sgn, spec.axleY + r * dy, spec.z + r * dz];
      return [
        at(inner, xIn),
        at(outer, xIn),
        at(outer, xOut - bevel),
        at(outer - bevel, xOut),
        at(inner, xOut),
      ];
    };
    const loops = rings.map((_, k) => loop(k));
    for (let k = 0; k < rings.length - 1; k++) {
      const p0 = loops[k]!;
      const p1 = loops[k + 1]!;
      const dy = rings[k]!.dy + rings[k + 1]!.dy;
      const dz = rings[k]!.dz + rings[k + 1]!.dz;
      const normals: V3[] = [
        [-sgn, 0, 0],
        [0, dy, dz],
        [sgn, dy, dz],
        [sgn, 0, 0],
        [0, -dy, -dz],
      ];
      for (let j = 0; j < 5; j++) {
        const n = (j + 1) % 5;
        quad(p0[j]!, p1[j]!, p1[n]!, p0[n]!, normals[j]!, j === 4 ? trim : body);
      }
    }
    // End caps face along the arch, away from the shell.
    for (const [k, dir] of [
      [0, -1],
      [rings.length - 1, 1],
    ] as const) {
      const p = loops[k]!;
      const { dy, dz } = rings[k]!;
      const expected: V3 = [0, -dz * dir, dy * dir];
      for (let i = 1; i < p.length - 1; i++) tri(p[0]!, p[i]!, p[i + 1]!, expected, body);
    }
  }

  return {
    positions: new Float32Array(pos),
    colors: new Float32Array(col),
    glowStart: pos.length / 3,
  };
}
