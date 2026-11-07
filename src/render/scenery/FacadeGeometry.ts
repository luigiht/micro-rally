import { BoxGeometry, type BufferGeometry, Color } from 'three';
import { box, paint } from './HouseGeometry';

/**
 * Façade parts the city kits share, all boxes in the flat-shaded style of
 * HouseGeometry: framed casements with lintel and sill, stepped arches,
 * cornices, quoins, a striped awning and a fire escape. Every part stands
 * 2–8 cm proud of the wall plane and at least 1 cm clear of its neighbours,
 * so nothing z-fights and the outward-face test sees each box on its own.
 * A `Face` names a wall plane: its axis, outward sign and position.
 */
export interface Face {
  facing: 'z' | 'x';
  sign: 1 | -1;
  wall: number;
}

export const GLASS = new Color('#7fa3bd');
export const GLASS_DARK = new Color('#56738c');
export const FRAME = new Color('#e9e6df');
export const STONE = new Color('#cfc8b8');
export const CAP = new Color('#4a4744');
export const RAIL = new Color('#5a5c60');
export const IRON = new Color('#2f3136');
export const BRICK = new Color('#8d5a4a');
export const AWNING_RED = new Color('#d9343a');
export const AWNING_GREEN = new Color('#3f7a4a');
export const AWNING_PALE = new Color('#f4f1ea');

/** A box `w` along the wall, `h` high, `t` thick, centred `u` along, `y` up and `out` beyond `f.wall`. */
export function onWall(
  f: Face,
  u: number,
  y: number,
  w: number,
  h: number,
  t: number,
  out: number,
  c: Color,
): BufferGeometry {
  const n = f.wall + f.sign * out;
  return f.facing === 'z' ? box(w, h, t, u, y, n, c) : box(t, h, w, n, y, u, c);
}

/** A strip window: a frame on the wall plane with glass just proud of it. */
export function strip(
  f: Face,
  u: number,
  y: number,
  w: number,
  h: number,
  glass: Color = GLASS,
): BufferGeometry[] {
  return [
    onWall(f, u, y, w + 0.2, h + 0.2, 0.08, 0.02, FRAME),
    onWall(f, u, y, w, h, 0.1, 0.04, glass),
  ];
}

/** A casement: frame and glass under a stone lintel, over a sill. `w` × `h` is the glass. */
export function casement(
  f: Face,
  u: number,
  y: number,
  w = 1.2,
  h = 1.5,
  glass: Color = GLASS,
): BufferGeometry[] {
  return [
    ...strip(f, u, y, w, h, glass),
    onWall(f, u, y + h / 2 + 0.22, w + 0.5, 0.2, 0.18, 0.07, STONE),
    onWall(f, u, y - h / 2 - 0.16, w + 0.4, 0.12, 0.22, 0.09, STONE),
  ];
}

/**
 * An arched opening: jambs and a stepped head (two springers and a keystone)
 * in `stone`, around a tall glass pane; `w` × `h` is the opening below the
 * arch. Boxes only, so it stays in the style.
 */
export function archBay(
  f: Face,
  u: number,
  y: number,
  w = 2.0,
  h = 2.6,
  stone: Color = STONE,
  glass: Color = GLASS_DARK,
): BufferGeometry[] {
  const top = y + h / 2;
  return [
    onWall(f, u, y + 0.15, w, h + 0.3, 0.1, 0.04, glass),
    onWall(f, u - w / 2 - 0.1, y, 0.2, h, 0.08, 0.06, stone),
    onWall(f, u + w / 2 + 0.1, y, 0.2, h, 0.08, 0.06, stone),
    onWall(f, u - w / 4 - 0.05, top + 0.2, w / 2 + 0.1, 0.22, 0.08, 0.07, stone),
    onWall(f, u + w / 4 + 0.05, top + 0.2, w / 2 + 0.1, 0.22, 0.08, 0.07, stone),
    onWall(f, u, top + 0.5, 0.5, 0.36, 0.08, 0.08, stone),
  ];
}

/** A cornice right round a `w` × `d` block at height `y`, `proud` beyond the walls and `h` tall. */
export function cornice(
  w: number,
  d: number,
  y: number,
  proud = 0.25,
  h = 0.3,
  c: Color = STONE,
  z = 0,
): BufferGeometry[] {
  return [
    box(w + 2 * proud, h, proud, 0, y, z - d / 2 - proud / 2, c),
    box(w + 2 * proud, h, proud, 0, y, z + d / 2 + proud / 2, c),
    box(proud, h - 0.02, d, -(w / 2) - proud / 2, y, z, c),
    box(proud, h - 0.02, d, w / 2 + proud / 2, y, z, c),
  ];
}

/** Quoin stones up the four corners of a `w` × `d` block from `y0` to `y1`, alternating long and short. */
export function quoins(
  w: number,
  d: number,
  y0: number,
  y1: number,
  c: Color = STONE,
): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const course = 0.6;
  for (let y = y0 + course / 2, k = 0; y + course / 2 <= y1; y += course, k++) {
    const long = k % 2 === 0;
    for (const sx of [-1, 1] as const)
      for (const sz of [-1, 1] as const) {
        // Alternate courses wrap the corner the other way so the joints stagger.
        const lx = long ? 0.7 : 0.45;
        const lz = long ? 0.45 : 0.7;
        out.push(
          box(lx, course - 0.04, 0.1, sx * (w / 2 - lx / 2 + 0.02), y, sz * (d / 2 + 0.03), c),
          box(0.1, course - 0.06, lz, sx * (w / 2 + 0.03), y, sz * (d / 2 - lz / 2 + 0.02), c),
        );
      }
  }
  return out;
}

/** A striped awning over a shop front, `w` wide, pitched down and out from the wall at `y`. */
export function awning(
  f: Face,
  u: number,
  y: number,
  w: number,
  dark: Color = AWNING_RED,
  depth = 0.52,
  tilt = -0.5,
): BufferGeometry[] {
  const stripes = Math.max(3, Math.round(w / 0.6) | 1);
  const sw = w / stripes;
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < stripes; i++) {
    const even = i % 2 === 0;
    const a = u - w / 2 + sw / 2 + sw * i;
    // Dark stripes are a little thicker so no two stripes share a vertex.
    const t = even ? 0.12 : 0.08;
    const g = new BoxGeometry(sw, t, depth);
    if (f.facing === 'z') {
      g.rotateX(f.sign > 0 ? -tilt : tilt);
      g.translate(a, y, f.wall + f.sign * ((depth / 2) * Math.cos(tilt) - 0.06));
    } else {
      g.rotateZ(f.sign > 0 ? tilt : -tilt);
      g.translate(f.wall + f.sign * ((depth / 2) * Math.cos(tilt) - 0.06), y, a);
    }
    parts.push(paint(g, even ? dark : AWNING_PALE));
  }
  return parts;
}

/**
 * A fire escape down a flank: a landing with a rail at every storey from the
 * top down to the first, and a stair run between landings, all in iron, at
 * most `reach` proud of the wall.
 */
export function fireEscape(
  f: Face,
  u: number,
  storey: number,
  storeys: number,
  floor: number,
  reach = 0.45,
): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const landingW = 2.6;
  for (let s = 1; s < storeys; s++) {
    const y = floor + s * storey + 0.08;
    parts.push(
      onWall(f, u, y, landingW, 0.06, reach - 0.04, reach / 2, IRON),
      onWall(f, u, y + 0.5, landingW, 0.04, 0.04, reach - 0.04, IRON),
      onWall(f, u - landingW / 2 + 0.02, y + 0.25, 0.04, 0.5, 0.04, reach - 0.04, IRON),
      onWall(f, u + landingW / 2 - 0.02, y + 0.25, 0.04, 0.5, 0.04, reach - 0.04, IRON),
    );
    if (s < storeys - 1) {
      // The stair climbs along the wall from this landing's end to the next landing.
      const run = landingW - 0.3;
      const len = Math.hypot(run, storey);
      const dir = s % 2 === 0 ? 1 : -1;
      // The run lies along the wall: along x for a z face, along z for an x face.
      const g =
        f.facing === 'z'
          ? new BoxGeometry(len, 0.05, reach - 0.12).rotateZ(dir * Math.atan2(storey, run))
          : new BoxGeometry(reach - 0.12, 0.05, len).rotateX(-dir * Math.atan2(storey, run));
      if (f.facing === 'z') g.translate(u, y + storey / 2, f.wall + f.sign * (reach / 2 + 0.02));
      else g.translate(f.wall + f.sign * (reach / 2 + 0.02), y + storey / 2, u);
      parts.push(paint(g, IRON));
    }
  }
  return parts;
}
