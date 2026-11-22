import {
  BufferAttribute,
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { merge, paint } from './HouseGeometry';

/**
 * The Savanna's animals as low-poly models, each facing +z with its feet on
 * y = 0, vertex-coloured so one instanced mesh draws a whole herd: a giraffe
 * (sloping back, long neck rising forward, a head with muzzle, ears and
 * ossicones, a short mane, jointed legs, a tufted tail) in a coat of brown
 * patches on cream, and a zebra (a barrel body, an arched neck under a
 * standing mane, a long head with a dark muzzle, jointed legs, a tufted
 * tail) striped black on white, the stripes running round the body and
 * across the legs. Pure geometry; `SavannaDressingBuilder` instances them.
 */

type V3 = readonly [number, number, number];

const UP = new Vector3(0, 1, 0);

/** A tapered limb from `a` to `b`, `r0` thick at `a` and `r1` at `b`, `sides` round. */
function limb(a: V3, b: V3, r0: number, r1: number, sides = 6): BufferGeometry {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const g = new CylinderGeometry(r1, r0, len, sides).translate(0, len / 2, 0);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, d.normalize()));
  return g.translate(a[0], a[1], a[2]);
}

/** An ellipsoid of radii (rx, ry, rz) centred at `c`, low-poly. */
function blob(c: V3, rx: number, ry: number, rz: number, w = 8, h = 6): BufferGeometry {
  return new SphereGeometry(1, w, h).scale(rx, ry, rz).translate(c[0], c[1], c[2]);
}

/** Colour every face of `g` by `pick(centroid)`: `b` where it holds, else `a`. */
function pattern(
  g: BufferGeometry,
  a: Color,
  b: Color,
  pick: (x: number, y: number, z: number) => boolean,
): BufferGeometry {
  const flat = g.index ? g.toNonIndexed() : g;
  const pos = flat.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  for (let f = 0; f < pos.count / 3; f++) {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let k = 0; k < 3; k++) {
      cx += pos.getX(f * 3 + k) / 3;
      cy += pos.getY(f * 3 + k) / 3;
      cz += pos.getZ(f * 3 + k) / 3;
    }
    const c = pick(cx, cy, cz) ? b : a;
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (f * 3 + k) * 3);
  }
  flat.setAttribute('color', new BufferAttribute(col, 3));
  return flat;
}

/** A fixed 0..1 value per integer cell. */
function cell(i: number, j: number, k: number): number {
  let h = Math.imul((i * 73856093) ^ (j * 19349663) ^ (k * 83492791), 2654435761);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const CREAM = new Color('#e3c48a');
const PATCH = new Color('#8a4f24');
const HOOF = new Color('#2b2420');
const DARK = new Color('#4a3424');

/** A giraffe's coat: brown patches in a cream net, the patches a cell a few hand-spans across. */
const giraffeCoat = (g: BufferGeometry, size = 0.22) =>
  pattern(g, CREAM, PATCH, (x, y, z) => {
    const i = Math.floor(x / size + 50);
    const j = Math.floor(y / size + 50);
    const k = Math.floor(z / size + 50);
    // Most cells are a patch; the cream lines between them are the cells left out.
    return cell(i, j, k) < 0.7;
  });

/** A giraffe facing +z, about 4.8 m to the top of its head. */
export function giraffeGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  // Body: deep at the shoulders, sloping down to the rump.
  parts.push(giraffeCoat(blob([0, 2.25, 0.25], 0.42, 0.46, 0.62, 9, 7)));
  parts.push(giraffeCoat(blob([0, 2.0, -0.45], 0.38, 0.38, 0.5, 9, 7)));
  // Neck: two tapering spans, rising steeply forward from the shoulders.
  parts.push(giraffeCoat(limb([0, 2.35, 0.55], [0, 3.35, 0.95], 0.24, 0.17, 7), 0.16));
  parts.push(giraffeCoat(limb([0, 3.3, 0.93], [0, 4.25, 1.25], 0.17, 0.11, 7), 0.14));
  // A short dark mane down the back of the neck.
  parts.push(paint(limb([0, 2.5, 0.42], [0, 4.15, 1.08], 0.05, 0.035, 4), DARK));
  // Head: the skull, the long muzzle sloping down, ears and the two ossicones.
  parts.push(paint(blob([0, 4.42, 1.35], 0.13, 0.14, 0.2, 7, 5), CREAM));
  parts.push(paint(limb([0, 4.42, 1.42], [0, 4.25, 1.78], 0.1, 0.07, 6), CREAM));
  parts.push(paint(blob([0, 4.24, 1.8], 0.075, 0.06, 0.06, 6, 4), DARK));
  for (const x of [-1, 1]) {
    parts.push(paint(limb([0.08 * x, 4.5, 1.3], [0.24 * x, 4.58, 1.22], 0.03, 0.015, 4), CREAM));
    parts.push(paint(limb([0.05 * x, 4.52, 1.28], [0.06 * x, 4.72, 1.24], 0.025, 0.02, 4), DARK));
    parts.push(paint(blob([0.06 * x, 4.74, 1.24], 0.035, 0.035, 0.035, 5, 3), DARK));
  }
  // Legs: thigh to knee, knee to hoof, the forelegs longer; dark hooves.
  for (const [z, top, knee] of [
    [0.48, 2.0, 1.05],
    [-0.62, 1.8, 0.95],
  ] as const) {
    for (const x of [-0.2, 0.2]) {
      parts.push(giraffeCoat(limb([x, top, z], [x, knee, z + 0.04], 0.11, 0.075, 6), 0.14));
      parts.push(paint(limb([x, knee, z + 0.04], [x, 0.1, z], 0.07, 0.05, 6), CREAM));
      parts.push(paint(limb([x, 0.1, z], [x, 0, z], 0.06, 0.065, 6), HOOF));
    }
  }
  // Tail: a thin switch ending in a dark tuft.
  parts.push(paint(limb([0, 2.15, -0.92], [0, 1.25, -1.0], 0.03, 0.02, 4), CREAM));
  parts.push(paint(blob([0, 1.15, -1.0], 0.05, 0.12, 0.05, 5, 4), DARK));
  return merge(parts);
}

const WHITE = new Color('#ece8de');
const BLACK = new Color('#1c1a1a');
const MUZZLE = new Color('#2a2624');

/** Stripes round the body: bands across the run of `along`, `width` apart, wider on the rump. */
const stripes = (g: BufferGeometry, along: 'z' | 'y', width: number) =>
  pattern(g, WHITE, BLACK, (x, y, z) => {
    const t = along === 'z' ? z + 0.12 * Math.sin(y * 9) : y + 0.05 * Math.sin(z * 11);
    return Math.floor(t / width + 100.5) % 2 === 0;
  });

/** A zebra facing +z, about 1.9 m to the top of its head. */
export function zebraGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  // Barrel body, a little deeper at the chest.
  parts.push(stripes(blob([0, 1.05, 0.05], 0.32, 0.34, 0.72, 10, 8), 'z', 0.11));
  // Neck arching up and forward, under a standing black-and-white mane.
  parts.push(stripes(limb([0, 1.2, 0.55], [0, 1.65, 0.85], 0.17, 0.12, 7), 'y', 0.09));
  parts.push(stripes(limb([0, 1.42, 0.5], [0, 1.85, 0.82], 0.035, 0.03, 4), 'y', 0.07));
  // Head: the long face sloping down to a dark muzzle; upright ears.
  parts.push(stripes(limb([0, 1.75, 0.88], [0, 1.45, 1.28], 0.11, 0.08, 7), 'y', 0.07));
  parts.push(paint(blob([0, 1.43, 1.3], 0.085, 0.08, 0.09, 6, 4), MUZZLE));
  for (const x of [-1, 1])
    parts.push(paint(limb([0.06 * x, 1.82, 0.86], [0.1 * x, 2.0, 0.82], 0.04, 0.015, 4), WHITE));
  // Legs: thigh to knee, knee to hoof, banded across; black hooves.
  for (const z of [0.48, -0.52]) {
    for (const x of [-0.16, 0.16]) {
      parts.push(stripes(limb([x, 1.0, z], [x, 0.5, z + 0.02], 0.09, 0.06, 6), 'y', 0.08));
      parts.push(stripes(limb([x, 0.5, z + 0.02], [x, 0.08, z], 0.055, 0.045, 6), 'y', 0.06));
      parts.push(paint(limb([x, 0.08, z], [x, 0, z], 0.05, 0.055, 6), BLACK));
    }
  }
  // Tail: a striped switch with a black tuft.
  parts.push(stripes(limb([0, 1.2, -0.7], [0, 0.6, -0.78], 0.03, 0.02, 4), 'y', 0.06));
  parts.push(
    paint(new ConeGeometry(0.05, 0.2, 5).rotateX(Math.PI).translate(0, 0.52, -0.79), BLACK),
  );
  return merge(parts);
}
