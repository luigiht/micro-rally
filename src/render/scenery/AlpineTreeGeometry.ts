import { type BufferGeometry, CylinderGeometry, IcosahedronGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * The Alpine's bare broadleaves and snowy bushes, after a low-poly winter
 * tree set (used as a reference only), about the stock trees' size; its
 * tiered pines are in `SnowPineGeometry`. The bush's green is white for the
 * pine tint; its snow and the bare tree's wood are kits of their own.
 *
 * - A bare tree: a leaning trunk with branches spiralling up it, each with a
 *   twig.
 * - A snowy bush: the stock bush under a cap of snow.
 */

function mergeAll(parts: BufferGeometry[]): BufferGeometry {
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  for (const p of flat) if (p.getAttribute('uv')) p.deleteAttribute('uv');
  const merged = mergeGeometries(flat)!;
  for (const g of new Set([...parts, ...flat])) g.dispose();
  return merged;
}

/** A round clump of leaves: its middle and radius. */
interface Crown {
  x: number;
  y: number;
  z: number;
  r: number;
}
/** The cap of snow over a bush: an ellipsoid set high on it, a hair wider, covering its upper third. */
const CAP_RISE = 0.45;
const CAP_HEIGHT = 0.6;
const CAP_WIDE = 1.04;

/** A round limb from `from` to `to`, `r` thick at its foot. */
function limb(
  from: readonly number[],
  to: readonly number[],
  r: number,
  sides = 5,
): BufferGeometry {
  const [x0, y0, z0] = from as [number, number, number];
  const [x1, y1, z1] = to as [number, number, number];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dy, dz);
  // Tip +Y over to the limb's direction: tilt about Z, then swing about Y.
  const tilt = Math.acos(dy / len);
  const yaw = Math.atan2(dz, dx);
  return new CylinderGeometry(r * 0.6, r, len, sides)
    .translate(0, len / 2, 0)
    .rotateZ(-tilt)
    .rotateY(-yaw)
    .translate(x0, y0, z0);
}

/** The bare tree: a trunk leaning a little, branches spiralling up it by the golden angle, a twig on each. */
const BARE_HEIGHT = 4.4;
const BARE_LEAN = 0.35;
const BARE_BRANCHES = [
  { at: 0.38, len: 1.5, rise: 0.55 },
  { at: 0.5, len: 1.35, rise: 0.6 },
  { at: 0.61, len: 1.2, rise: 0.65 },
  { at: 0.72, len: 1.0, rise: 0.7 },
  { at: 0.82, len: 0.85, rise: 0.75 },
  { at: 0.9, len: 0.65, rise: 0.8 },
] as const;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function bareTreeGeometry(): BufferGeometry {
  const top: [number, number, number] = [BARE_LEAN, BARE_HEIGHT, 0];
  const parts = [limb([0, 0, 0], top, 0.2, 6)];
  BARE_BRANCHES.forEach((b, i) => {
    const foot: [number, number, number] = [BARE_LEAN * b.at, BARE_HEIGHT * b.at, 0];
    const a = i * GOLDEN + 0.4;
    // `rise` is the branch's slope: how far up it climbs for each metre out.
    const out = b.len / Math.hypot(1, b.rise);
    const tip: [number, number, number] = [
      foot[0] + Math.cos(a) * out,
      foot[1] + out * b.rise,
      foot[2] + Math.sin(a) * out,
    ];
    parts.push(limb(foot, tip, 0.075 * (1 - b.at * 0.5), 4));
    // A twig from two thirds along, turned off the branch and climbing more steeply.
    const mid: [number, number, number] = [
      foot[0] + (tip[0] - foot[0]) * 0.6,
      foot[1] + (tip[1] - foot[1]) * 0.6,
      foot[2] + (tip[2] - foot[2]) * 0.6,
    ];
    const ta = a + (i % 2 ? 0.7 : -0.7);
    const tl = b.len * 0.4;
    parts.push(
      limb(
        mid,
        [mid[0] + Math.cos(ta) * tl * 0.6, mid[1] + tl * 0.8, mid[2] + Math.sin(ta) * tl * 0.6],
        0.035,
        4,
      ),
    );
  });
  return mergeAll(parts);
}

/** The stock bush (`rallyKits`), and its cap of snow. */
const BUSH: Crown = { x: 0, y: 0.45, z: 0, r: 0.9 };

export function snowyBushGreen(): BufferGeometry {
  return new IcosahedronGeometry(BUSH.r, 0).translate(BUSH.x, BUSH.y, BUSH.z);
}

export function snowyBushSnow(): BufferGeometry {
  return new IcosahedronGeometry(1, 0)
    .scale(BUSH.r * CAP_WIDE, BUSH.r * CAP_HEIGHT, BUSH.r * CAP_WIDE)
    .translate(BUSH.x, BUSH.y + BUSH.r * CAP_RISE, BUSH.z);
}
