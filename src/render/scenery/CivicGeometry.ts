import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { HOUSE_SLAB_TOP } from '@/game/stage/SceneryScatter';
import { box, gableGeometry, paint, window } from './HouseGeometry';

/**
 * The two civic town kits, as part lists that BuildingGeometry merges (and
 * puts a foundation under): a narrow three-storey tower with a balcony under a
 * hipped roof, and a hall with arched windows, a columned portico and a clock
 * cupola. Same conventions as HouseGeometry: the origin is the footprint
 * centre at ground level, the door faces -z, pure white takes the instance
 * tint (walls or roof) and every other colour is fixed.
 */
const FLOOR = HOUSE_SLAB_TOP;
/** The roof soffit sits this far below the wall top so roof and wall overlap. */
const ROOF_SEAT = 0.12;
const EAVE = 0.22;

const WHITE = new Color('#ffffff');
const SLAB = new Color('#8c8a86');
const DOOR = new Color('#5a3a22');
const WINDOW = new Color('#7fa3bd');
const FRAME = new Color('#f7f3ea');
const BRICK = new Color('#8d5a4a');
const CAP = new Color('#4a4744');

type V = [number, number, number];

/** Non-indexed triangle fans from polygons listed clockwise from outside; emitted reversed (three.js CCW front). */
function triangles(polys: V[][]): number[] {
  const out: number[] = [];
  for (const p of polys)
    for (let i = 1; i + 1 < p.length; i++) out.push(...p[0]!, ...p[i + 1]!, ...p[i]!);
  return out;
}

/**
 * Closed hipped roof (`w` ≥ `d`): flat soffit at `y0`, vertical eave faces of
 * height `eave`, two trapezoid slopes toward ±z meeting a ridge along x of
 * length `w - d`, and two triangular hips at ±x. A square base gives a pyramid.
 */
export function hipRoofGeometry(
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
  const rx = Math.max(0, hw - hd);
  // Slopes degenerate to triangles when the ridge has no length.
  const slope = (a: V, b: V, c: V, dd: V): V[] => (rx > 1e-6 ? [a, b, c, dd] : [a, b, c]);
  const polys: V[][] = [
    // soffit (faces down)
    [
      [-hw, y0, -hd],
      [-hw, y0, hd],
      [hw, y0, hd],
      [hw, y0, -hd],
    ],
    // eave faces: -z, +z, -x, +x
    [
      [-hw, y0, -hd],
      [hw, y0, -hd],
      [hw, ye, -hd],
      [-hw, ye, -hd],
    ],
    [
      [hw, y0, hd],
      [-hw, y0, hd],
      [-hw, ye, hd],
      [hw, ye, hd],
    ],
    [
      [-hw, y0, hd],
      [-hw, y0, -hd],
      [-hw, ye, -hd],
      [-hw, ye, hd],
    ],
    [
      [hw, y0, -hd],
      [hw, y0, hd],
      [hw, ye, hd],
      [hw, ye, -hd],
    ],
    // slopes
    slope([-hw, ye, -hd], [hw, ye, -hd], [rx, yr, 0], [-rx, yr, 0]),
    slope([hw, ye, hd], [-hw, ye, hd], [-rx, yr, 0], [rx, yr, 0]),
    // hips
    [
      [-hw, ye, hd],
      [-hw, ye, -hd],
      [-rx, yr, 0],
    ],
    [
      [hw, ye, -hd],
      [hw, ye, hd],
      [rx, yr, 0],
    ],
  ];
  const pos = new Float32Array(triangles(polys));
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.computeVertexNormals();
  g.translate(x, 0, z);
  return paint(g, color);
}

/**
 * Tall civic window (1.2 × 2.8) with an arched head approximated by a
 * narrower box on top. `wall` is the wall plane on the `facing` axis, `sign`
 * its outward direction, `u` the position along the wall.
 */
function arch(facing: 'z' | 'x', sign: 1 | -1, wall: number, u: number, y: number) {
  const out = wall + sign * 0.02;
  const glass = wall + sign * 0.04;
  const head = y + 1.4 + 0.25;
  // (width along the wall, height, depth, along, up, outward, colour)
  const specs: [number, number, number, number, number, number, Color][] = [
    [1.2, 2.8, 0.08, u, y, out, FRAME],
    [1.0, 2.6, 0.1, u, y, glass, WINDOW],
    [0.8, 0.5, 0.08, u, head, out, FRAME],
    [0.6, 0.3, 0.1, u, head, glass, WINDOW],
    [1.4, 0.1, 0.16, u, y - 1.4, out, FRAME],
  ];
  return specs.map(([w, h, t, a, b, n, c]) =>
    facing === 'z' ? box(w, h, t, a, b, n, c) : box(t, h, w, n, b, a, c),
  );
}

/* ----------------------------------------------------------------- tower */

/** Footprint 6 × 6, three storeys of 2.8 m under a pyramid roof. */
const TOWER = { w: 6, d: 6, wall: 8.4, roof: 2.6, overhang: 0.4 } as const;
const towerTop = FLOOR + TOWER.wall;
/** Height of the tower's eave line (the bottom of the slopes). */
const towerEave = towerTop - ROOF_SEAT + EAVE;

export function towerWallParts(): BufferGeometry[] {
  const { w, d, wall } = TOWER;
  const front = -d / 2;
  return [
    box(w, wall, d, 0, FLOOR + wall / 2, 0, WHITE),
    // Door right of centre on a step, ground-floor window to its left.
    box(1.2, 2.3, 0.08, 0.9, FLOOR + 1.35, front - 0.02, FRAME),
    box(1.0, 2.1, 0.1, 0.9, FLOOR + 1.25, front - 0.04, DOOR),
    box(1.6, 0.2, 0.3, 0.9, FLOOR + 0.1, front - 0.15, SLAB),
    ...window(-1.2, FLOOR + 1.6, front, 'z', -1),
    // Second floor: French window onto a balcony (slab, two posts just inside its edge, top rail).
    box(2.0, 0.16, 0.45, 0, FLOOR + 2.88, front - 0.225, SLAB),
    box(1.1, 1.9, 0.08, 0, FLOOR + 3.91, front - 0.02, FRAME),
    box(0.9, 1.7, 0.1, 0, FLOOR + 3.91, front - 0.04, WINDOW),
    box(0.1, 0.9, 0.1, -0.93, FLOOR + 3.41, front - 0.38, CAP),
    box(0.1, 0.9, 0.1, 0.93, FLOOR + 3.41, front - 0.38, CAP),
    box(2.0, 0.1, 0.1, 0, FLOOR + 3.86, front - 0.38, CAP),
    // Third-floor window, then one per upper storey on each side and the back.
    ...window(0, FLOOR + 7.0, front, 'z', -1),
    ...window(-w / 2, FLOOR + 4.4, 0.5, 'x', -1),
    ...window(-w / 2, FLOOR + 7.0, 0.5, 'x', -1),
    ...window(w / 2, FLOOR + 4.4, 0.5, 'x', 1),
    ...window(w / 2, FLOOR + 7.0, 0.5, 'x', 1),
    ...window(1.2, FLOOR + 4.4, d / 2, 'z', 1),
    ...window(-1.2, FLOOR + 7.0, d / 2, 'z', 1),
    // Chimney through the back slope, topping out level with the apex.
    box(0.7, 2.2, 0.7, 1.5, towerEave + 1.5, 1.5, BRICK),
    box(0.84, 0.12, 0.84, 1.5, towerEave + 2.6, 1.5, CAP),
  ];
}

export function towerRoofParts(): BufferGeometry[] {
  const { w, d, roof, overhang } = TOWER;
  const y0 = towerTop - ROOF_SEAT;
  const apex = y0 + roof + EAVE;
  return [
    hipRoofGeometry(w + overhang * 2, d + overhang * 2, roof + EAVE, EAVE, y0, WHITE),
    box(0.16, 0.6, 0.16, 0, apex + 0.1, 0, CAP),
  ];
}

/* ------------------------------------------------------------------ hall */

/**
 * Footprint 12 × 9. The 6.5 m block stands 0.9 m back from the footprint
 * front so the portico steps come forward onto the plinth.
 */
const HALL = { w: 12, d: 8.1, z: 0.45, wall: 6.5, roof: 2.4, overhang: 0.4 } as const;
const hallTop = FLOOR + HALL.wall;
const hallFront = HALL.z - HALL.d / 2;
/** The portico floor: three 0.2 m steps above the plinth. */
const porchFloor = FLOOR + 0.6;

export function hallWallParts(): BufferGeometry[] {
  const { w, d, z, wall } = HALL;
  const front = hallFront;
  const back = z + d / 2;
  const sides = [-1, 1] as const;
  return [
    box(w, wall, d, 0, FLOOR + wall / 2, z, WHITE),
    // Cornice band under the eaves.
    box(w + 0.2, 0.3, d + 0.2, 0, hallTop - 0.35, z, FRAME),
    // Arched windows: two each side of the portico, three per flank, three at the back.
    ...sides.flatMap((s) => [
      ...arch('z', -1, front, s * 2.9, FLOOR + 3.1),
      ...arch('z', -1, front, s * 4.7, FLOOR + 3.1),
      ...arch('x', s, s * (w / 2), -1.6, FLOOR + 3.1),
      ...arch('x', s, s * (w / 2), 0.45, FLOOR + 3.1),
      ...arch('x', s, s * (w / 2), 2.5, FLOOR + 3.1),
      ...arch('z', 1, back, s * 3.6, FLOOR + 3.1),
    ]),
    ...arch('z', 1, back, 0, FLOOR + 3.1),
    // Portico: entablature carried by two columns with bases and capitals.
    box(4.6, 0.4, 1.2, 0, FLOOR + 4.6, front - 0.2, WHITE),
    ...sides.flatMap((s) => [
      box(0.45, 3.8, 0.45, s * 1.6, porchFloor + 1.9, front - 0.5, FRAME),
      box(0.6, 0.15, 0.6, s * 1.6, porchFloor + 0.075, front - 0.5, SLAB),
      box(0.6, 0.15, 0.6, s * 1.6, porchFloor + 3.7, front - 0.5, SLAB),
    ]),
    // Double door with a fanlight, on three steps.
    box(2.5, 3.4, 0.08, 0, porchFloor + 1.7, front - 0.02, FRAME),
    box(1.0, 2.7, 0.1, -0.6, porchFloor + 1.35, front - 0.04, DOOR),
    box(1.0, 2.7, 0.1, 0.6, porchFloor + 1.35, front - 0.04, DOOR),
    box(2.1, 0.5, 0.1, 0, porchFloor + 3.05, front - 0.04, WINDOW),
    box(4.6, 0.2, 0.75, 0, FLOOR + 0.5, front - 0.375, SLAB),
    box(4.8, 0.2, 0.23, 0, FLOOR + 0.3, front - 0.865, SLAB),
    box(5.0, 0.2, 0.22, 0, FLOOR + 0.1, front - 1.09, SLAB),
  ];
}

export function hallRoofParts(): BufferGeometry[] {
  const { w, d, z, roof, overhang } = HALL;
  const y0 = hallTop - ROOF_SEAT;
  const ridge = y0 + roof + EAVE;
  const cupolaRoof = ridge + 0.45;
  const vane = cupolaRoof + 0.9 + 0.12;
  return [
    gableGeometry(w + overhang * 2, d + overhang * 2, roof + EAVE, EAVE, y0, WHITE, 0, z),
    box(w + overhang * 2 + 0.1, 0.12, 0.3, 0, ridge, z, WHITE),
    // Pediment over the portico: a gable turned so its end faces the street.
    gableGeometry(1.4, 4.6, 1.5, 0.2, FLOOR + 4.75, WHITE)
      .rotateY(Math.PI / 2)
      .translate(0, 0, hallFront - 0.3),
    // Clock cupola astride the ridge: box, dark bezel with a pale face, pyramid roof, vane.
    box(1.3, 1.4, 1.3, 0, ridge - 0.2, z, FRAME),
    box(0.7, 0.7, 0.08, 0, ridge + 0.05, z - 0.65 - 0.02, CAP),
    box(0.5, 0.5, 0.1, 0, ridge + 0.05, z - 0.65 - 0.04, FRAME),
    hipRoofGeometry(1.7, 1.7, 0.9 + 0.12, 0.12, cupolaRoof, WHITE, 0, z),
    box(0.1, 0.9, 0.1, 0, vane + 0.3, z, CAP),
    box(0.6, 0.1, 0.1, 0, vane + 0.6, z, CAP),
  ];
}
