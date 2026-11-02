import { type BufferGeometry, Color } from 'three';
import { box, merge } from '../HouseGeometry';

/**
 * Neon signs and glow bollards where the bushes stood. A sign is a dark frame
 * on two posts with its panel 2 cm proud of the frame; the panel is the glow
 * kit, tinted per instance. Three variants by size, all facing -z, so the kit
 * turns each one toward the road.
 */
const FRAME = new Color('#1c1f2b');
const POST = new Color('#232736');
const WHITE = new Color('#ffffff');

interface Sign {
  w: number;
  h: number;
  y: number;
}

const SIGNS: readonly Sign[] = [
  { w: 3.0, h: 1.6, y: 2.6 },
  { w: 1.4, h: 2.6, y: 2.4 },
  { w: 2.0, h: 0.9, y: 1.9 },
];

export const SIGN_VARIANTS = SIGNS.length;

export function signBodyGeometry(variant: number): BufferGeometry {
  const s = SIGNS[variant % SIGNS.length]!;
  const postX = Math.max(0.3, s.w / 2 - 0.3);
  return merge([
    box(0.12, s.y, 0.12, postX, s.y / 2, 0, POST),
    box(0.12, s.y, 0.12, -postX, s.y / 2, 0, POST),
    box(s.w + 0.2, s.h + 0.2, 0.12, 0, s.y + s.h / 2, 0, FRAME),
  ]);
}

export function signGlowGeometry(variant: number): BufferGeometry {
  const s = SIGNS[variant % SIGNS.length]!;
  return merge([
    box(s.w, s.h, 0.03, 0, s.y + s.h / 2, -0.075, WHITE),
    // A thin lit rule under the panel, like a neon tube.
    box(s.w * 0.8, 0.06, 0.03, 0, s.y - 0.12, -0.075, WHITE),
  ]);
}

export function bollardBodyGeometry(): BufferGeometry {
  return merge([box(0.3, 1.0, 0.3, 0, 0.4, 0, POST), box(0.36, 0.08, 0.36, 0, 0.94, 0, FRAME)]);
}

export function bollardGlowGeometry(): BufferGeometry {
  return merge([box(0.34, 0.1, 0.34, 0, 0.8, 0, WHITE)]);
}
