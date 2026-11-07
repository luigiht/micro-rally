import { type BufferGeometry, Color } from 'three';
import { box, merge } from './HouseGeometry';

/**
 * A city's pavement furniture: traffic lights, benches, litter bins,
 * hydrants, bollards, the kerbed pit a street tree stands in, and manhole
 * covers on the carriageway. Every kit is one non-indexed, vertex-coloured
 * geometry merged from boxes (flat shaded, nothing finer than ~4 cm so it
 * reads from 40 m), built for an instanced `KindKit` with
 * `vertexColors: true`. No part is pure white, so an instance tint leaves
 * the palette alone; parts nest 1–2 cm into each other and visible faces
 * never share a plane. Each stands on y = 0 and faces the road with -z.
 */
const POST = new Color('#3a3944');
const DARK = new Color('#2b2a33');
const WOOD = new Color('#8a6a4a');
const IRON = new Color('#2f3136');
const GREEN = new Color('#3f6b45');
const RED = new Color('#c8372f');
const CHROME = new Color('#c9ccd1');
const KERB = new Color('#9d9a92');
const SOIL = new Color('#5a4634');
const LENS = new Color('#1d1d22');
const WHITE = new Color('#f4f1e8');

/** Traffic light: a post with a hooded three-lens head facing -z. Bounding box: x ±0.2, y [0, 3.4], z [-0.26, 0.14]. */
export function trafficLightGeometry(): BufferGeometry {
  return merge([
    box(0.4, 0.08, 0.4, 0, 0.04, 0, POST),
    box(0.14, 2.5, 0.14, 0, 1.3, 0, POST),
    box(0.4, 1.1, 0.26, 0, 2.85, -0.07, DARK),
    box(0.3, 0.26, 0.08, 0, 3.17, -0.22, LENS),
    box(0.3, 0.26, 0.08, 0, 2.85, -0.22, LENS),
    box(0.3, 0.26, 0.08, 0, 2.53, -0.22, LENS),
    box(0.44, 0.06, 0.3, 0, 3.37, -0.1, DARK),
  ]);
}

/** The three lenses of the traffic light alone, 1 cm proud of the head, in a pale that a glow kit colours. */
export function trafficLensGlowGeometry(): BufferGeometry {
  return merge([
    box(0.22, 0.18, 0.04, 0, 3.17, -0.27, WHITE),
    box(0.22, 0.18, 0.04, 0, 2.85, -0.27, WHITE),
    box(0.22, 0.18, 0.04, 0, 2.53, -0.27, WHITE),
  ]);
}

/** Park bench: slatted seat and back on two iron ends, facing -z. Bounding box: x ±0.9, y [0, 0.9], z [-0.3, 0.3]. */
export function benchGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (const x of [-0.75, 0.75]) {
    parts.push(box(0.08, 0.42, 0.5, x, 0.21, 0, IRON), box(0.08, 0.5, 0.08, x, 0.65, 0.24, IRON));
  }
  for (const z of [-0.2, -0.05, 0.1]) parts.push(box(1.8, 0.05, 0.12, 0, 0.45, z, WOOD));
  for (const y of [0.62, 0.78]) parts.push(box(1.8, 0.1, 0.05, 0, y, 0.27, WOOD));
  return parts.length ? merge(parts) : merge([box(1, 1, 1, 0, 0.5, 0, WOOD)]);
}

/** Litter bin: a dark green drum on a short post with a domed lid. Bounding box: x ±0.26, y [0, 1.0], z ±0.26. */
export function binGeometry(): BufferGeometry {
  return merge([
    box(0.3, 0.06, 0.3, 0, 0.03, 0, POST),
    box(0.1, 0.3, 0.1, 0, 0.18, 0, POST),
    box(0.5, 0.6, 0.5, 0, 0.6, 0, GREEN),
    box(0.4, 0.06, 0.4, 0, 0.92, 0, DARK),
    box(0.26, 0.06, 0.26, 0, 0.97, 0, DARK),
    box(0.52, 0.12, 0.05, 0, 0.62, -0.26, CHROME),
  ]);
}

/** Fire hydrant: a red barrel with a cap and two side nozzles. Bounding box: x ±0.26, y [0, 0.8], z ±0.14. */
export function hydrantGeometry(): BufferGeometry {
  return merge([
    box(0.3, 0.1, 0.3, 0, 0.05, 0, DARK),
    box(0.22, 0.55, 0.22, 0, 0.36, 0, RED),
    box(0.26, 0.08, 0.26, 0, 0.64, 0, RED),
    box(0.14, 0.14, 0.14, 0, 0.73, 0, RED),
    box(0.1, 0.1, 0.1, -0.2, 0.42, 0, CHROME),
    box(0.1, 0.1, 0.1, 0.2, 0.42, 0, CHROME),
    box(0.1, 0.1, 0.08, 0, 0.45, -0.13, CHROME),
  ]);
}

/** Bollard: a dark post with a pale band. Bounding box: x ±0.1, y [0, 0.9], z ±0.1. */
export function bollardGeometry(): BufferGeometry {
  return merge([
    box(0.2, 0.75, 0.2, 0, 0.375, 0, IRON),
    box(0.22, 0.08, 0.22, 0, 0.78, 0, WHITE),
    box(0.18, 0.08, 0.18, 0, 0.86, 0, IRON),
  ]);
}

/** Tree pit: a 1.6 m square kerb with dark soil inside, 12 cm high. Bounding box: x ±0.8, y [0, 0.12], z ±0.8. */
export function treePitGeometry(): BufferGeometry {
  return merge([
    box(1.6, 0.12, 0.2, 0, 0.06, -0.7, KERB),
    box(1.6, 0.12, 0.2, 0, 0.06, 0.7, KERB),
    box(0.2, 0.11, 1.2, -0.7, 0.055, 0, KERB),
    box(0.2, 0.11, 1.2, 0.7, 0.055, 0, KERB),
    box(1.22, 0.08, 1.22, 0, 0.04, 0, SOIL),
  ]);
}

/** Manhole cover: a 0.7 m dark plate 3 cm proud of the deck, with a rim. Bounding box: x ±0.38, y [0, 0.03], z ±0.38. */
export function manholeGeometry(): BufferGeometry {
  return merge([box(0.76, 0.02, 0.76, 0, 0.01, 0, DARK), box(0.6, 0.03, 0.6, 0, 0.015, 0, IRON)]);
}
