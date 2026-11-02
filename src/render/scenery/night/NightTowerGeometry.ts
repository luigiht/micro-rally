import { type BufferGeometry, Color } from 'three';
import { box, merge } from '../HouseGeometry';

/**
 * Nightcity's towers stand where the trees stood. A tree's collider is a
 * 0.45 m trunk, so every tower is a slim core up to `CANTILEVER` (clear of the
 * truck's roof) carrying a cantilevered block above: the car passes under
 * the overhang and nothing it can drive through is drawn. Three tiers by
 * distance from the road keep the near corridor low for the isometric and
 * cinematic cameras. Each tier is two instanced kits: the dark body (lit)
 * and the glow (unlit white, tinted per instance in a neon hue): window
 * bands and corner strips 2 cm proud of the walls, so nothing z-fights.
 */
export type TowerTier = 'kiosk' | 'mid' | 'tall';

/** The block starts here: the Dakar truck is 3.1 m tall. */
export const CANTILEVER = 3.4;
/** Core half-width: inside the tree collider at scale 1. */
export const CORE_HALF = 0.36;

const BODY = new Color('#1e2230');
const BODY_DARK = new Color('#161925');
const CORE = new Color('#232736');
const WHITE = new Color('#ffffff');

interface Block {
  w: number;
  d: number;
  y0: number;
  y1: number;
}

const TIERS: Readonly<Record<TowerTier, Block[]>> = {
  kiosk: [{ w: 3.2, d: 2.8, y0: CANTILEVER, y1: 6.0 }],
  mid: [
    { w: 4.4, d: 4.0, y0: CANTILEVER, y1: 14 },
    { w: 3.0, d: 2.8, y0: 14, y1: 17.5 },
  ],
  tall: [
    { w: 5.0, d: 5.0, y0: CANTILEVER, y1: 24 },
    { w: 3.6, d: 3.6, y0: 24, y1: 34 },
  ],
};

/** Rows of lit windows every `step` metres up the block on all four faces, 2 cm proud: about one window per 1.3 m of face. */
function bands(b: Block, step: number, out: BufferGeometry[]): void {
  const row = (face: number, along: 'x' | 'z', y: number, side: number) => {
    const n = Math.max(1, Math.round(face / 1.3));
    const pitch = (face - 0.6) / n;
    const w = pitch * 0.62;
    for (let i = 0; i < n; i++) {
      const c = -(face - 0.6) / 2 + pitch * (i + 0.5);
      if (along === 'z') out.push(box(w, 0.42, 0.02, c, y, side * (b.d / 2 + 0.02), WHITE));
      else out.push(box(0.02, 0.42, w, side * (b.w / 2 + 0.02), y, c, WHITE));
    }
  };
  for (let y = b.y0 + 1.2; y < b.y1 - 0.6; y += step) {
    row(b.w, 'z', y, 1);
    row(b.w, 'z', y, -1);
    row(b.d, 'x', y, 1);
    row(b.d, 'x', y, -1);
  }
}

/** Thin strips up the four corners of a block. */
function corners(b: Block, out: BufferGeometry[]): void {
  const h = b.y1 - b.y0 - 0.2;
  const y = (b.y0 + b.y1) / 2;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      out.push(box(0.05, h, 0.05, sx * (b.w / 2 + 0.02), y, sz * (b.d / 2 + 0.02), WHITE));
    }
  }
}

export function towerBodyGeometry(tier: TowerTier): BufferGeometry {
  const blocks = TIERS[tier];
  const top = blocks[blocks.length - 1]!;
  const parts: BufferGeometry[] = [
    // Core from the ground into the first block, with a wider foot sunk into the slope.
    box(CORE_HALF * 2.2, 0.8, CORE_HALF * 2.2, 0, 0.1, 0, CORE),
    box(CORE_HALF * 2, CANTILEVER + 0.4, CORE_HALF * 2, 0, (CANTILEVER + 0.4) / 2 - 0.3, 0, CORE),
  ];
  blocks.forEach((b, i) => {
    parts.push(box(b.w, b.y1 - b.y0, b.d, 0, (b.y0 + b.y1) / 2, 0, i % 2 === 0 ? BODY : BODY_DARK));
    // A darker soffit slab under the overhang so the underside reads as structure.
    parts.push(box(b.w + 0.3, 0.25, b.d + 0.3, 0, b.y0 + 0.1, 0, BODY_DARK));
  });
  // Roof plant and an antenna on the tall tier.
  parts.push(box(top.w * 0.4, 0.6, top.d * 0.4, top.w * 0.15, top.y1 + 0.3, -top.d * 0.1, CORE));
  if (tier === 'tall') parts.push(box(0.12, 4, 0.12, -top.w * 0.25, top.y1 + 2, 0.2, CORE));
  return merge(parts);
}

export function towerGlowGeometry(tier: TowerTier): BufferGeometry {
  const blocks = TIERS[tier];
  const top = blocks[blocks.length - 1]!;
  const parts: BufferGeometry[] = [];
  for (const b of blocks) {
    bands(b, tier === 'kiosk' ? 1.4 : 2.4, parts);
    corners(b, parts);
  }
  // A sign plate on the kiosk's street face; a beacon on the tall tier's antenna.
  if (tier === 'kiosk')
    parts.push(box(top.w * 0.7, 0.5, 0.03, 0, (top.y0 + top.y1) / 2, -top.d / 2 - 0.03, WHITE));
  if (tier === 'tall') parts.push(box(0.3, 0.3, 0.3, -top.w * 0.25, top.y1 + 4.1, 0.2, WHITE));
  return merge(parts);
}

/** A slim pylon with a lit ring and a strip up one side: the city's lamps and masts, where the other trees stood. */
export const MAST_H = 9;

export function mastBodyGeometry(): BufferGeometry {
  return merge([
    box(0.5, 0.6, 0.5, 0, 0.1, 0, CORE),
    box(0.26, MAST_H, 0.26, 0, MAST_H / 2, 0, CORE),
    box(0.9, 0.12, 0.9, 0, MAST_H - 0.3, 0, BODY_DARK),
  ]);
}

export function mastGlowGeometry(): BufferGeometry {
  return merge([
    box(0.7, 0.16, 0.7, 0, MAST_H - 0.1, 0, WHITE),
    box(0.04, MAST_H * 0.6, 0.04, 0.16, MAST_H * 0.55, 0, WHITE),
  ]);
}
