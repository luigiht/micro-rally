import { BoxGeometry, BufferAttribute, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HOUSE_SLAB_TOP } from '@/game/stage/SceneryScatter';

/**
 * A detailed low-poly cottage in two instanced parts: walls (slab, door with
 * canopy and step, sills, shutters, windows, chimney — vertex-coloured so an
 * instance tint recolours only the render) and the roof (solid gable with
 * eaves and soffit, dormer roof, ridge cap — tinted separately). Footprint
 * 6 × 4.5 m at scale 1, long axis along x, door on the -z face.
 */
const W = 6;
const D = 4.5;
const WALL_H = 2.8;
const FLOOR = HOUSE_SLAB_TOP;
const ROOF_H = 1.9;
const OVERHANG = 0.45;
/** Vertical thickness of the roof at the eaves (fascia). */
const EAVE = 0.22;
/** The soffit sits this far below the wall top so roof and wall overlap. */
const ROOF_SEAT = 0.12;

const WHITE = new Color('#ffffff');
const SLAB = new Color('#8c8a86');
const DOOR = new Color('#5a3a22');
const WINDOW = new Color('#7fa3bd');
const FRAME = new Color('#f7f3ea');
const SHUTTER = new Color('#4f6b4a');
const BRICK = new Color('#8d5a4a');
const CAP = new Color('#4a4744');

function paint(g: BufferGeometry, color: Color): BufferGeometry {
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: Color) {
  return paint(new BoxGeometry(w, h, d).translate(x, y, z), color);
}

type V = [number, number, number];

/** Non-indexed triangles from quads/triangles listed clockwise from outside; emitted reversed (three.js CCW front). */
function faces(polys: V[][]): number[] {
  const out: number[] = [];
  for (const p of polys) {
    const fan: [number, number, number][] =
      p.length === 3
        ? [[0, 1, 2]]
        : [
            [0, 1, 2],
            [0, 2, 3],
          ];
    for (const [a, b, c] of fan) out.push(...p[a]!, ...p[c]!, ...p[b]!);
  }
  return out;
}

/**
 * Closed gable roof: a pentagonal prism along z (flat soffit at `y0`, vertical
 * eave faces of height `eave`, two slopes meeting at the ridge, two gable
 * ends). Corners are listed clockwise from outside; `faces` flips them.
 */
export function gableGeometry(
  w: number,
  d: number,
  h: number,
  eave: number,
  y0: number,
  color: Color,
  x = 0,
  z = 0,
): BufferGeometry {
  const hw = w / 2;
  const hd = d / 2;
  const ye = y0 + eave;
  const yr = y0 + h;
  const quads: V[][] = [
    // soffit (faces down)
    [
      [-hw, y0, -hd],
      [-hw, y0, hd],
      [hw, y0, hd],
      [hw, y0, -hd],
    ],
    // -z eave face
    [
      [-hw, y0, -hd],
      [hw, y0, -hd],
      [hw, ye, -hd],
      [-hw, ye, -hd],
    ],
    // +z eave face
    [
      [hw, y0, hd],
      [-hw, y0, hd],
      [-hw, ye, hd],
      [hw, ye, hd],
    ],
    // -z slope
    [
      [-hw, ye, -hd],
      [hw, ye, -hd],
      [hw, yr, 0],
      [-hw, yr, 0],
    ],
    // +z slope
    [
      [hw, ye, hd],
      [-hw, ye, hd],
      [-hw, yr, 0],
      [hw, yr, 0],
    ],
    // -x gable end (pentagon as quad + triangle)
    [
      [-hw, y0, hd],
      [-hw, y0, -hd],
      [-hw, ye, -hd],
      [-hw, ye, hd],
    ],
    [
      [-hw, ye, hd],
      [-hw, ye, -hd],
      [-hw, yr, 0],
    ],
    // +x gable end
    [
      [hw, y0, -hd],
      [hw, y0, hd],
      [hw, ye, hd],
      [hw, ye, -hd],
    ],
    [
      [hw, ye, -hd],
      [hw, ye, hd],
      [hw, yr, 0],
    ],
  ];
  const pos = new Float32Array(faces(quads));
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.computeVertexNormals();
  g.translate(x, 0, z);
  return paint(g, color);
}

/** Merge as non-indexed (the gable is unindexed and flat shading wants faces anyway). */
function merge(parts: BufferGeometry[]): BufferGeometry {
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const merged = mergeGeometries(flat);
  if (!merged) throw new Error('house geometry parts have mismatched attributes');
  for (const p of parts) p.dispose();
  for (const p of flat) if (!parts.includes(p)) p.dispose();
  return merged;
}

const TOP = FLOOR + WALL_H;
/** Dormer on the front (-z) slope, left of the door. */
const DORMER = { w: 1.3, h: 1.1, d: 1.2, x: -1.5 } as const;
/** Where the front slope sits at the dormer's back wall, so the dormer rests on it. */
const dormerBaseY = TOP - ROOF_SEAT + EAVE + ROOF_H * 0.3;
const dormerZ = -(D / 2 + OVERHANG) * 0.55;

function window(x: number, y: number, z: number, facing: 'z' | 'x', sign: 1 | -1) {
  const out = sign * 0.02;
  const glass = sign * 0.04;
  if (facing === 'z')
    return [
      box(1.0, 1.0, 0.08, x, y, z + out, FRAME),
      box(0.8, 0.8, 0.1, x, y, z + glass, WINDOW),
      box(1.2, 0.08, 0.16, x, y - 0.5, z + out, FRAME),
    ];
  return [
    box(0.08, 1.0, 1.0, x + out, y, z, FRAME),
    box(0.1, 0.8, 0.8, x + glass, y, z, WINDOW),
    box(0.16, 0.08, 1.2, x + out, y - 0.5, z, FRAME),
  ];
}

export function houseWallsGeometry(): BufferGeometry {
  const front = -D / 2;
  const parts = [
    // Slab with a deep foundation: buried on level ground, showing as a stone base on a slope.
    box(W + 0.6, 1.4, D + 0.6, 0, FLOOR - 0.7, 0, SLAB),
    box(W, WALL_H, D, 0, FLOOR + WALL_H / 2, 0, WHITE),
    // Door with frame, step and a little canopy on two posts.
    box(1.1, 2.2, 0.08, 0.9, FLOOR + 1.1, front - 0.02, FRAME),
    box(0.9, 2.0, 0.1, 0.9, FLOOR + 1.0, front - 0.04, DOOR),
    box(0.06, 0.06, 0.06, 1.2, FLOOR + 1.0, front - 0.1, CAP),
    box(1.4, 0.16, 0.8, 0.9, FLOOR + 0.08, front - 0.4, SLAB),
    box(1.6, 0.1, 0.9, 0.9, FLOOR + 2.35, front - 0.45, FRAME),
    box(0.08, 2.3, 0.08, 0.2, FLOOR + 1.15, front - 0.82, FRAME),
    box(0.08, 2.3, 0.08, 1.6, FLOOR + 1.15, front - 0.82, FRAME),
    // Front window with shutters, one window on the back, one on each gable end.
    ...window(-1.4, FLOOR + 1.6, front, 'z', -1),
    box(0.3, 1.0, 0.06, -2.05, FLOOR + 1.6, front - 0.02, SHUTTER),
    box(0.3, 1.0, 0.06, -0.75, FLOOR + 1.6, front - 0.02, SHUTTER),
    ...window(1.4, FLOOR + 1.6, D / 2, 'z', 1),
    ...window(-W / 2, FLOOR + 1.6, 0, 'x', -1),
    ...window(W / 2, FLOOR + 1.6, 0, 'x', 1),
    // Dormer box and its window.
    box(DORMER.w, DORMER.h, DORMER.d, DORMER.x, dormerBaseY + DORMER.h / 2, dormerZ, WHITE),
    box(0.7, 0.6, 0.08, DORMER.x, dormerBaseY + 0.55, dormerZ - DORMER.d / 2 - 0.02, FRAME),
    box(0.5, 0.45, 0.1, DORMER.x, dormerBaseY + 0.55, dormerZ - DORMER.d / 2 - 0.04, WINDOW),
    // Chimney through the back slope with a cap.
    box(0.6, 1.7, 0.6, W / 2 - 1.2, TOP + ROOF_H * 0.5, 0.9, BRICK),
    box(0.72, 0.12, 0.72, W / 2 - 1.2, TOP + ROOF_H * 0.5 + 0.9, 0.9, CAP),
  ];
  return merge(parts);
}

export function houseRoofGeometry(): BufferGeometry {
  const y0 = TOP - ROOF_SEAT;
  return merge([
    gableGeometry(W + OVERHANG * 2, D + OVERHANG * 2, ROOF_H + EAVE, EAVE, y0, WHITE),
    box(W + OVERHANG * 2 + 0.1, 0.12, 0.3, 0, y0 + ROOF_H + EAVE, 0, WHITE),
    gableGeometry(
      DORMER.w + 0.3,
      DORMER.d + 0.2,
      0.6,
      0.1,
      dormerBaseY + DORMER.h - 0.05,
      WHITE,
      DORMER.x,
      dormerZ,
    ),
  ]);
}
