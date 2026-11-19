import { BoxGeometry, BufferAttribute, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { HOUSE_SLAB_TOP } from '@/game/stage/SceneryScatter';
import { box, merge, paint } from './HouseGeometry';

/**
 * A Swedish farmhouse (the Lakeland's): Falu-red board walls with red gable
 * ends, white corner boards, eave boards and window frames with crossbars, a
 * small porch on white posts at the door, a grey sheet-metal roof with white
 * fascia and bargeboards, a brick chimney. Same 6 × 4.5 m footprint and
 * collider as the stock cottage (`HouseGeometry`), door on the -z face. Its
 * colours are baked in, so each colour pair (`StagePalette.houses`) is its
 * own geometry: an instance tint would turn the white trim red too.
 */
const W = 6;
const D = 4.5;
const WALL_H = 3.1;
const FLOOR = HOUSE_SLAB_TOP;
const TOP = FLOOR + WALL_H;
const ROOF_H = 2.3;
/** The roof overhangs the long walls by this much and the gable ends by `OVER_X`. */
const OVER = 0.45;
const OVER_X = 0.3;
const ROOF_T = 0.14;
/** Where the roof's underside meets the wall's top at the long walls: the eave line sits under it. */
const RUN = D / 2 + OVER;
const EAVE_Y = TOP - (ROOF_H * OVER) / RUN;

const TRIM = new Color('#f4f1ea');
const GLASS = new Color('#5f7f96');
const SLAB = new Color('#7d7b77');
const DOOR = new Color('#ece6da');
const DECK = new Color('#8a8a86');
const BRICK = new Color('#8a4334');
const CAP = new Color('#4a4744');

/** A triangle, both faces, in one colour. */
function triangle(a: number[], b: number[], c: number[], colour: Color): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([...a, ...b, ...c, ...a, ...c, ...b]), 3),
  );
  g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(12), 2));
  g.computeVertexNormals();
  return paint(g, colour);
}

/** A box `w × h × d` tipped about x by `tilt`, centred on (x, y, z). */
function tilted(
  w: number,
  h: number,
  d: number,
  tilt: number,
  x: number,
  y: number,
  z: number,
  colour: Color,
): BufferGeometry {
  return paint(new BoxGeometry(w, h, d).rotateX(tilt).translate(x, y, z), colour);
}

/** A tall window on a long wall (`facing` z) or a gable end (x): white frame, glass, crossbars and sill. */
function window(x: number, y: number, z: number, facing: 'z' | 'x', sign: 1 | -1, tall = 1.3) {
  const out = sign * 0.03;
  const glass = sign * 0.05;
  const parts: [number, number, number, number, number, Color][] = [
    // [across, height, at-across, at-height, out, colour]
    [0.95, tall + 0.15, 0, 0, out, TRIM],
    [0.75, tall - 0.05, 0, 0, glass, GLASS],
    [0.07, tall - 0.05, 0, 0, glass * 1.4, TRIM],
    [0.75, 0.07, 0, tall * 0.15, glass * 1.4, TRIM],
    [1.15, 0.08, 0, -(tall + 0.15) / 2, out * 2.5, TRIM],
  ];
  return parts.map(([a, h, da, dh, o, c]) =>
    facing === 'z'
      ? box(a, h, 0.08, x + da, y + dh, z + o, c)
      : box(0.08, h, a, x + o, y + dh, z + da, c),
  );
}

export function swedishHouseWallsGeometry(red: Color): BufferGeometry {
  const front = -D / 2;
  const back = D / 2;
  const apex = EAVE_Y + ROOF_H;
  const parts: BufferGeometry[] = [
    // A deep foundation, showing as a grey stone base on a slope.
    box(W + 0.4, 1.4, D + 0.4, 0, FLOOR - 0.7, 0, SLAB),
    box(W, WALL_H, D, 0, FLOOR + WALL_H / 2, 0, red),
    // Red gable ends up under the roof.
    ...[-1, 1].map((s) =>
      triangle(
        [(s * W) / 2, TOP - 0.01, front],
        [(s * W) / 2, TOP - 0.01, back],
        [(s * W) / 2, apex - 0.05, 0],
        red,
      ),
    ),
    // White corner boards, and eave boards along the top of the long walls.
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) =>
        box(0.18, WALL_H, 0.18, (sx * W) / 2, FLOOR + WALL_H / 2, (sz * D) / 2, TRIM),
      ),
    ),
    box(W + 0.1, 0.2, 0.08, 0, TOP - 0.1, front - 0.03, TRIM),
    box(W + 0.1, 0.2, 0.08, 0, TOP - 0.1, back + 0.03, TRIM),
    // Front: the door under a porch on white posts, a window either side.
    box(1.1, 2.25, 0.08, 1.0, FLOOR + 1.12, front - 0.03, TRIM),
    box(0.85, 2.05, 0.1, 1.0, FLOOR + 1.02, front - 0.05, DOOR),
    box(0.06, 0.06, 0.06, 1.3, FLOOR + 1.0, front - 0.12, CAP),
    box(1.9, 0.22, 1.3, 1.0, FLOOR + 0.11, front - 0.65, DECK),
    box(1.9, 0.12, 0.12, 1.0, FLOOR + 1.0, front - 1.24, TRIM),
    ...[0.1, 1.9].map((x) => box(0.12, 2.5, 0.12, x, FLOOR + 1.25, front - 1.24, TRIM)),
    tilted(2.2, 0.1, 1.5, 0.25, 1.0, FLOOR + 2.55, front - 0.7, CAP),
    ...window(-1.7, FLOOR + 1.55, front, 'z', -1),
    ...window(-0.3, FLOOR + 1.55, front, 'z', -1),
    // Back: two windows.
    ...window(-1.3, FLOOR + 1.55, back, 'z', 1),
    ...window(1.3, FLOOR + 1.55, back, 'z', 1),
    // Gable ends: a window below and a loft window up in the gable.
    ...[-1, 1].flatMap((s) => [
      ...window((s * W) / 2, FLOOR + 1.55, 0, 'x', s as 1 | -1),
      ...window((s * W) / 2, TOP + 0.75, 0, 'x', s as 1 | -1, 0.9),
    ]),
    // Brick chimney through the ridge.
    box(0.55, 1.8, 0.55, -W / 2 + 1.6, apex - 0.1, 0.2, BRICK),
    box(0.68, 0.12, 0.68, -W / 2 + 1.6, apex + 0.8, 0.2, CAP),
  ];
  return merge(parts);
}

export function swedishHouseRoofGeometry(metal: Color): BufferGeometry {
  const slope = Math.atan2(ROOF_H, RUN);
  const length = Math.hypot(ROOF_H, RUN);
  const width = W + 2 * OVER_X;
  const midY = EAVE_Y + ROOF_H / 2 + ROOF_T / 2;
  const parts: BufferGeometry[] = [];
  for (const side of [-1, 1] as const) {
    // A slope from the eave up to the ridge, its underside on the wall tops.
    parts.push(tilted(width, ROOF_T, length, side * slope, 0, midY, (side * RUN) / 2, metal));
    // White fascia along the eave.
    parts.push(box(width + 0.04, 0.2, 0.06, 0, EAVE_Y - 0.02, side * (RUN + 0.02), TRIM));
    // White bargeboards up both rakes of this slope.
    for (const end of [-1, 1])
      parts.push(
        tilted(
          0.07,
          0.24,
          length,
          side * slope,
          (end * width) / 2,
          midY - 0.02,
          (side * RUN) / 2,
          TRIM,
        ),
      );
  }
  // A ridge cap a shade darker than the sheets.
  const ridge = metal.clone().multiplyScalar(0.82);
  parts.push(box(width, 0.12, 0.3, 0, EAVE_Y + ROOF_H + ROOF_T, 0, ridge));
  return merge(parts);
}
