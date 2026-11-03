/**
 * Flat silhouettes from SVG path data, for logos that stand proud of a body
 * panel. A minimal reader covers the commands icon paths use (M L H V C S Z,
 * absolute and relative), flattens every cubic into a few chords so the
 * outline stays low-poly, and the extruder turns each closed subpath into a
 * thin slab along x with outward-wound caps and walls: SVG right maps to +z
 * (toward the nose, so a right-facing icon faces forward on either flank) and
 * SVG up to +y, centred on the icon's box. Holes are
 * not supported; the icons are solid.
 */
import { ShapeUtils, Vector2 } from 'three';

export type Point2 = readonly [number, number];

type V3 = [number, number, number];

const COMMANDS = /([MmLlHhVvCcSsZz])([^MmLlHhVvCcSsZz]*)/g;
const NUMBERS = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

/** Closed subpaths of `d` as polygons in SVG units (y down), each cubic as `curveSteps` chords. */
export function svgPathPolygons(d: string, curveSteps = 4): Point2[][] {
  const polygons: [number, number][][] = [];
  let poly: [number, number][] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  // Second control point of the last cubic, for the S shorthand's reflection.
  let ctrl: [number, number] | null = null;

  const close = () => {
    const first = poly[0];
    const last = poly[poly.length - 1];
    if (
      poly.length > 1 &&
      first &&
      last &&
      Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-9
    )
      poly.pop();
    if (poly.length >= 3) polygons.push(poly);
    poly = [];
  };
  const lineTo = (nx: number, ny: number) => {
    if (poly.length === 0) poly.push([x, y]);
    poly.push([nx, ny]);
    x = nx;
    y = ny;
    ctrl = null;
  };
  const cubicTo = (x1: number, y1: number, x2: number, y2: number, nx: number, ny: number) => {
    if (poly.length === 0) poly.push([x, y]);
    for (let i = 1; i <= curveSteps; i++) {
      const t = i / curveSteps;
      const u = 1 - t;
      poly.push([
        u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * nx,
        u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ny,
      ]);
    }
    x = nx;
    y = ny;
    ctrl = [x2, y2];
  };

  for (const m of d.matchAll(COMMANDS)) {
    const cmd = m[1]!;
    const n = (m[2]!.match(NUMBERS) ?? []).map(Number);
    const rel = cmd === cmd.toLowerCase();
    let i = 0;
    switch (cmd.toUpperCase()) {
      case 'M': {
        let first = true;
        while (i + 1 < n.length) {
          const nx = (rel ? x : 0) + n[i]!;
          const ny = (rel ? y : 0) + n[i + 1]!;
          i += 2;
          if (first) {
            close();
            poly = [[nx, ny]];
            x = startX = nx;
            y = startY = ny;
            ctrl = null;
            first = false;
          } else lineTo(nx, ny);
        }
        break;
      }
      case 'L':
        while (i + 1 < n.length) {
          lineTo((rel ? x : 0) + n[i]!, (rel ? y : 0) + n[i + 1]!);
          i += 2;
        }
        break;
      case 'H':
        while (i < n.length) lineTo((rel ? x : 0) + n[i++]!, y);
        break;
      case 'V':
        while (i < n.length) lineTo(x, (rel ? y : 0) + n[i++]!);
        break;
      case 'C':
        while (i + 5 < n.length) {
          const ox = rel ? x : 0;
          const oy = rel ? y : 0;
          cubicTo(
            ox + n[i]!,
            oy + n[i + 1]!,
            ox + n[i + 2]!,
            oy + n[i + 3]!,
            ox + n[i + 4]!,
            oy + n[i + 5]!,
          );
          i += 6;
        }
        break;
      case 'S':
        while (i + 3 < n.length) {
          const ox = rel ? x : 0;
          const oy = rel ? y : 0;
          const x1 = ctrl ? 2 * x - ctrl[0] : x;
          const y1 = ctrl ? 2 * y - ctrl[1] : y;
          cubicTo(x1, y1, ox + n[i]!, oy + n[i + 1]!, ox + n[i + 2]!, oy + n[i + 3]!);
          i += 4;
        }
        break;
      case 'Z':
        if (poly.length > 0) {
          x = startX;
          y = startY;
        }
        close();
        break;
    }
  }
  close();
  return polygons;
}

/** Bounding box of a set of polygons. */
export function polygonsBox(polygons: readonly (readonly Point2[])[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const poly of polygons)
    for (const [px, py] of poly) {
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
  return { minX, maxX, minY, maxY };
}

/**
 * Non-indexed triangles (xyz per vertex) of the polygons extruded
 * ±thickness/2 along x, scaled from SVG units to metres about the box centre
 * with SVG right as +z and SVG up as +y. Every face is wound outward.
 */
export function silhouettePositions(
  polygons: readonly (readonly Point2[])[],
  scale: number,
  thickness: number,
): Float32Array {
  const box = polygonsBox(polygons);
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const h = thickness / 2;
  const out: number[] = [];

  const tri = (a: V3, b: V3, c: V3, expected: V3) => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (Math.hypot(nx, ny, nz) < 1e-12) return;
    const flip = nx * expected[0] + ny * expected[1] + nz * expected[2] < 0;
    for (const p of flip ? [a, c, b] : [a, b, c]) out.push(p[0], p[1], p[2]);
  };

  for (const poly of polygons) {
    // (z, y) per point.
    const pts = poly.map(([sx, sy]) => [(sx - cx) * scale, (cy - sy) * scale] as const);
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const [z0, y0] = pts[i]!;
      const [z1, y1] = pts[(i + 1) % pts.length]!;
      area += z0 * y1 - z1 * y0;
    }
    const ccw = area >= 0 ? 1 : -1;
    const faces = ShapeUtils.triangulateShape(
      pts.map(([z, y]) => new Vector2(z, y)),
      [],
    );
    for (const [i, j, k] of faces) {
      const A = pts[i!]!;
      const B = pts[j!]!;
      const C = pts[k!]!;
      tri([h, A[1], A[0]], [h, B[1], B[0]], [h, C[1], C[0]], [1, 0, 0]);
      tri([-h, A[1], A[0]], [-h, B[1], B[0]], [-h, C[1], C[0]], [-1, 0, 0]);
    }
    for (let i = 0; i < pts.length; i++) {
      const [z0, y0] = pts[i]!;
      const [z1, y1] = pts[(i + 1) % pts.length]!;
      // Outward edge normal in the (z, y) plane: (dy, −dz) for a counter-clockwise outline.
      const expected: V3 = [0, -(z1 - z0) * ccw, (y1 - y0) * ccw];
      tri([h, y0, z0], [h, y1, z1], [-h, y1, z1], expected);
      tri([h, y0, z0], [-h, y1, z1], [-h, y0, z0], expected);
    }
  }
  return new Float32Array(out);
}
