import { BoxGeometry, BufferAttribute, type BufferGeometry, Color } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Street furniture for the town sections: traffic cones across the side
 * streets the route must not take, direction boards at each turn and a plain
 * town lamp. Every kit is one non-indexed, vertex-coloured geometry merged
 * from boxes (flat shaded, nothing finer than ~6 cm so it reads from 40 m),
 * built for an instanced `KindKit` with `vertexColors: true`. No part is pure
 * white, so an instance tint leaves the palette alone. Parts nest into each
 * other with a 1-2 cm overlap and visible faces never share a plane, so
 * nothing z-fights.
 */
const WHITE = new Color('#f4f1e8');
const DARK = new Color('#2b2a33');
const YELLOW = new Color('#f2c14e');
const POST = new Color('#3a3944');
const LAMP = new Color('#fff1c9');

export type ArrowTurn = 'left' | 'right';

/** A w × h × d box painted one flat colour, turned `rotZ` about its centre, then centred at (x, y, z). */
function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: Color,
  rotZ = 0,
): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  if (rotZ !== 0) g.rotateZ(rotZ);
  g.translate(x, y, z);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = color.r;
    col[i * 3 + 1] = color.g;
    col[i * 3 + 2] = color.b;
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

/** Merge the boxes as one non-indexed geometry (flat shading wants split faces anyway). */
function merge(parts: BufferGeometry[]): BufferGeometry {
  const flat = parts.map((p) => p.toNonIndexed());
  const merged = mergeGeometries(flat);
  if (!merged) throw new Error('street furniture parts have mismatched attributes');
  for (const p of parts) p.dispose();
  for (const p of flat) p.dispose();
  return merged;
}

const CONE = new Color('#f26b1d');

/**
 * Traffic cone marking a closed street: a dark square base plate and three
 * stacked square tiers, orange below and above a white band, each tier
 * tucked 1 cm into the one under it. Standing on y = 0.
 * Bounding box: x [-0.21, 0.21], y [0, 0.57], z [-0.21, 0.21].
 */
export function coneGeometry(): BufferGeometry {
  return merge([
    box(0.42, 0.05, 0.42, 0, 0.025, 0, DARK),
    box(0.3, 0.2, 0.3, 0, 0.15, 0, CONE),
    box(0.26, 0.12, 0.26, 0, 0.3, 0, WHITE),
    box(0.18, 0.22, 0.18, 0, 0.46, 0, CONE),
  ]);
}

const BOARD_W = 1.4;
const BOARD_H = 0.8;
/** Height of the board's bottom edge above the ground. */
const BOARD_BOTTOM = 0.7;
const BOARD_BORDER = 0.07;
const ARROW_T = 0.16;
const HEAD_LEN = 0.36;
/** Head bars are centred this far back from, and above/below, the shaft tip. */
const HEAD_BACK = 0.12;

/**
 * Rally direction board read while approaching from -z (the face is the -z
 * side): a yellow board with a dark border strip wrapping its top and bottom
 * edges, a thick dark arrow (shaft plus two 45° head bars) pointing to +x for
 * a left turn and -x for a right turn, on two dark posts behind the board.
 * The arrow front sits 4-5 cm proud of the board face, the strips 3 cm, and
 * the arrow's back faces are buried inside the board, so no layer z-fights.
 * The two variants are built with mirrored x positions and angles rather than
 * a negative scale, so both keep counter-clockwise winding.
 * Bounding box: x [-0.7, 0.7], y [0, 1.5], z [-0.08, 0.1]; the board itself
 * spans y [0.7, 1.5].
 */
export function arrowBoardGeometry(turn: ArrowTurn): BufferGeometry {
  const dir = turn === 'left' ? 1 : -1;
  const cy = BOARD_BOTTOM + BOARD_H / 2;
  const top = BOARD_BOTTOM + BOARD_H;
  const tilt = (dir * Math.PI) / 4;
  return merge([
    // Yellow face, inset 2 cm so its edges never share a plane with the border strips.
    box(BOARD_W - 0.04, BOARD_H - 0.04, 0.06, 0, cy, 0, YELLOW),
    box(BOARD_W, BOARD_BORDER, 0.1, 0, top - BOARD_BORDER / 2, -0.01, DARK),
    box(BOARD_W, BOARD_BORDER, 0.1, 0, BOARD_BOTTOM + BOARD_BORDER / 2, -0.01, DARK),
    // Shaft runs from the tail to the tip; the head bars meet it there, each 5 mm prouder than the last.
    box(0.96, ARROW_T, 0.07, dir * 0.02, cy, -0.035, DARK),
    box(HEAD_LEN, ARROW_T, 0.07, dir * 0.32, cy + HEAD_BACK, -0.04, DARK, -tilt),
    box(HEAD_LEN, ARROW_T, 0.07, dir * 0.32, cy - HEAD_BACK, -0.045, DARK, tilt),
    box(0.08, 1.3, 0.08, -0.56, 0.65, 0.06, DARK),
    box(0.08, 1.3, 0.08, 0.56, 0.65, 0.06, DARK),
  ]);
}

const LAMP_H = 4.2;

/**
 * Town lamp: a dark grey post on a slightly wider base, a short arm toward -x
 * and a warm cream lamp head hanging under a dark cap at its end. Standing on
 * y = 0.
 * Bounding box: x [-1.03, 0.16], y [0, 4.2], z [-0.18, 0.18].
 */
export function lampPostGeometry(): BufferGeometry {
  return merge([
    box(0.32, 0.5, 0.32, 0, 0.25, 0, POST),
    box(0.16, LAMP_H - 0.4, 0.16, 0, (LAMP_H + 0.4) / 2, 0, POST),
    box(0.9, 0.1, 0.1, -0.45, LAMP_H - 0.15, 0, POST),
    box(0.4, 0.22, 0.3, -0.8, LAMP_H - 0.24, 0, LAMP),
    box(0.46, 0.06, 0.36, -0.8, LAMP_H - 0.11, 0, POST),
  ]);
}
