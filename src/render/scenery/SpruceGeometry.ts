import { type BufferGeometry, ConeGeometry, CylinderGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * A tall Finnish spruce, after the low-poly snowy pine in `context/environment`
 * (used as a reference only) and the photographs: a thin trunk the whole
 * height, with irregular whorls of foliage on it, each an octagonal truncated
 * cone of its own width and depth, set a little off the axis and turned, with
 * gaps between them where the trunk shows, narrowing to a tip near 14 m. Two
 * silhouettes: the snowy trees (even variants) and the bare ones (odd), so
 * the forest wall never repeats one cone. In instanced parts so each takes
 * the right colour: the trunk in the palette's trunk colour, the foliage
 * white for the pine tint, and, on the snowy trees, a white snow sleeve
 * round every whorl's top, a snowed tip and a drift round the foot.
 */
interface Whorl {
  y: number;
  h: number;
  r: number;
  dx: number;
  dz: number;
  turn: number;
}
const SPRUCE_TOP = 13.6;
export const SPRUCE_SNOWY: readonly Whorl[] = [
  { y: 1.3, h: 1.6, r: 2.5, dx: -0.1, dz: 0.15, turn: 0.45 },
  { y: 3.1, h: 1.3, r: 1.9, dx: 0.15, dz: -0.1, turn: 0.2 },
  { y: 4.6, h: 1.1, r: 1.45, dx: -0.2, dz: 0.1, turn: 0.6 },
  { y: 5.9, h: 1.55, r: 1.95, dx: 0.1, dz: 0.2, turn: 0.1 },
  { y: 7.7, h: 1.0, r: 1.15, dx: -0.1, dz: -0.2, turn: 0.4 },
  { y: 8.9, h: 1.3, r: 1.5, dx: 0.2, dz: 0.05, turn: 0.3 },
  { y: 10.4, h: 0.9, r: 0.9, dx: -0.1, dz: 0.1, turn: 0.5 },
  { y: 11.5, h: 1.1, r: 0.95, dx: 0.1, dz: -0.05, turn: 0.2 },
  // Clear of the whorl below: touching, its snow's top and this whorl's foot would share a plane.
  { y: 12.7, h: 0.85, r: 0.6, dx: 0.0, dz: 0.05, turn: 0.3 },
];
export const SPRUCE_BARE: readonly Whorl[] = [
  { y: 1.6, h: 1.4, r: 2.2, dx: 0.15, dz: -0.15, turn: 0.1 },
  { y: 3.3, h: 1.2, r: 1.6, dx: -0.15, dz: 0.15, turn: 0.3 },
  { y: 4.8, h: 1.7, r: 2.15, dx: 0.2, dz: -0.1, turn: 0.1 },
  { y: 6.9, h: 1.0, r: 1.25, dx: -0.1, dz: -0.2, turn: 0.5 },
  { y: 8.2, h: 1.45, r: 1.6, dx: 0.15, dz: 0.2, turn: 0.2 },
  { y: 9.9, h: 0.9, r: 1.0, dx: -0.2, dz: 0.0, turn: 0.6 },
  { y: 11.1, h: 1.2, r: 1.05, dx: 0.1, dz: 0.1, turn: 0.4 },
  { y: 12.5, h: 1.0, r: 0.6, dx: -0.05, dz: 0.05, turn: 0.2 },
];
/** How much narrower a whorl's top is than its base. */
const WHORL_TAPER = 0.42;
/** The snow sleeve round each whorl's top: this tall, this much proud of the foliage. */
const SNOW_SLEEVE = 0.45;
const SNOW_PROUD = 1.07;

function whorlGeometry(w: Whorl, rTop: number, rBottom: number, h: number, y: number) {
  return new CylinderGeometry(rTop, rBottom, h, 8).rotateY(w.turn).translate(w.dx, y + h / 2, w.dz);
}

export function spruceTrunkGeometry(): BufferGeometry {
  return new CylinderGeometry(0.09, 0.32, SPRUCE_TOP, 6).translate(0, SPRUCE_TOP / 2, 0);
}
/** A whorl's radius where its snow sleeve starts. */
function sleeveRadius(w: Whorl): number {
  const rTop = w.r * WHORL_TAPER;
  return w.r + ((rTop - w.r) * (w.h - SNOW_SLEEVE)) / w.h;
}
/**
 * The green of the whorls and the tip. On a snowy tree each whorl stops
 * where its snow sleeve starts and the sleeve carries on above it, and the
 * snowed tip stands alone: stacked, never one surface laid over another, so
 * no two faces share a plane and fight for depth.
 */
export function spruceFoliageGeometry(whorls: readonly Whorl[], snowy: boolean): BufferGeometry {
  const parts = whorls.map((w) =>
    snowy
      ? whorlGeometry(w, sleeveRadius(w), w.r, w.h - SNOW_SLEEVE, w.y)
      : whorlGeometry(w, w.r * WHORL_TAPER, w.r, w.h, w.y),
  );
  if (!snowy) parts.push(new ConeGeometry(0.42, 1.4, 8).translate(0, SPRUCE_TOP - 0.1, 0));
  const merged = mergeGeometries(parts)!;
  for (const g of parts) g.dispose();
  return merged;
}
export function spruceSnowGeometry(whorls: readonly Whorl[]): BufferGeometry {
  // A sleeve on top of each whorl's green, flaring a hair proud of it so it reads as a lip of
  // snow; the tip under snow, and a mound of drifted snow round the foot.
  const parts = whorls.map((w) => {
    const rTop = w.r * WHORL_TAPER;
    const rAt = sleeveRadius(w);
    return whorlGeometry(
      w,
      rTop * SNOW_PROUD,
      rAt * SNOW_PROUD,
      SNOW_SLEEVE,
      w.y + w.h - SNOW_SLEEVE,
    );
  });
  parts.push(new ConeGeometry(0.44, 1.44, 8).translate(0, SPRUCE_TOP - 0.06, 0));
  parts.push(new CylinderGeometry(1.1, 1.45, 0.32, 8).translate(0, 0.16, 0));
  const merged = mergeGeometries(parts)!;
  for (const g of parts) g.dispose();
  return merged;
}
