import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { buildCarHull, wellsFor } from '../car/CarHull';
import { GROUPB_STATIONS, WRC_STATIONS } from '../car/HullShapes';
import { paint } from './HouseGeometry';

/**
 * The city's parked cars: the drivable cars' own lofted hulls (the Riviera
 * WRC hatch and the Tempesta Group B, `HullShapes`) in plain paint, without
 * their wings and liveries, on round wheels like theirs, with mirrors,
 * plates and lights. The body is pure white so the instance tint paints it;
 * glass, trim, tyres and rims keep their colours. Standing on y = 0 with
 * the nose toward +z, as the drivable cars do. Non-indexed, vertex-coloured.
 * The lights come as a separate geometry for the night kits' glow.
 */
export type ParkedCarModel = 'wrc' | 'groupb';
export const PARKED_CAR_MODELS: readonly ParkedCarModel[] = ['wrc', 'groupb'];

const TRIM = '#2b2a33';
const GLASS = '#4d6f8c';
const TYRE = new Color('#2b2a33');
const RIM = new Color('#c9ccd1');
const PLATE = new Color('#eeeadb');
const MIRROR = new Color('#2b2a33');
const HEAD = new Color('#fff6d0');
const TAIL = new Color('#d9343a');

const STATIONS = { wrc: WRC_STATIONS, groupb: GROUPB_STATIONS } as const;

/** Nose and tail z, and the belt height and half width there, from the stations. */
function ends(model: ParkedCarModel) {
  const st = [...STATIONS[model]].sort((a, b) => a.z - b.z);
  return { tail: st[0]!, nose: st[st.length - 1]! };
}

/** Bare the geometry to positions and colours, like the hull soup, so the parts merge; normals come back at the end. */
function bare(g: BufferGeometry): BufferGeometry {
  const flat = g.index ? g.toNonIndexed() : g;
  flat.deleteAttribute('uv');
  flat.deleteAttribute('normal');
  return flat;
}

/** A box painted one colour. */
function block(w: number, h: number, d: number, x: number, y: number, z: number, c: Color) {
  return bare(paint(new BoxGeometry(w, h, d).translate(x, y, z), c));
}

/** A wheel like the drivable cars': a 12-facet tyre, an 8-facet rim 2 cm proud on the outside, a hub bar. */
function wheel(x: number, z: number, r: number): BufferGeometry[] {
  const out = x > 0 ? 1 : -1;
  const width = r * 0.8;
  const tyre = bare(
    paint(new CylinderGeometry(r, r, width, 12).rotateZ(Math.PI / 2).translate(x, r, z), TYRE),
  );
  const rim = bare(
    paint(
      new CylinderGeometry(r * 0.6, r * 0.6, width, 8)
        .rotateZ(Math.PI / 2)
        .translate(x + 0.02 * out, r, z),
      RIM,
    ),
  );
  return [tyre, rim, block(0.02, r * 1.1, 0.08, x + (width / 2 + 0.01) * out, r, z, TYRE)];
}

export function parkedCarBodyGeometry(model: ParkedCarModel): BufferGeometry {
  const spec = CAR_SPECS[model];
  const hull = buildCarHull({
    stations: STATIONS[model],
    colors: { body: '#ffffff', trim: TRIM, glass: GLASS },
    wells: wellsFor(spec),
  });
  const soup = new BufferGeometry();
  soup.setAttribute('position', new BufferAttribute(hull.positions, 3));
  soup.setAttribute('color', new BufferAttribute(hull.colors, 3));
  const { tail, nose } = ends(model);
  const half = spec.trackWidth / 2;
  const r = spec.wheelRadius;
  const parts: BufferGeometry[] = [
    soup,
    ...wheel(half, spec.cgToFront, r),
    ...wheel(-half, spec.cgToFront, r),
    ...wheel(half, -spec.cgToRear, r),
    ...wheel(-half, -spec.cgToRear, r),
    // Mirrors on the A pillars, number plates on the nose and tail.
    block(0.18, 0.1, 0.16, -(nose.xBody + 0.1), nose.belt + 0.22, 0.6, MIRROR),
    block(0.18, 0.1, 0.16, nose.xBody + 0.1, nose.belt + 0.22, 0.6, MIRROR),
    block(0.44, 0.11, 0.03, 0, (nose.floor + nose.belt) / 2, nose.z + 0.02, PLATE),
    block(0.44, 0.11, 0.03, 0, (tail.floor + tail.belt) / 2 + 0.1, tail.z - 0.02, PLATE),
  ];
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('parked car parts have mismatched attributes');
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}

/** Headlights at the nose (+z) and tail lights at the back, 2 cm proud of the hull's end faces, for a glow kit to colour. */
export function parkedCarLightsGeometry(model: ParkedCarModel): BufferGeometry {
  const { tail, nose } = ends(model);
  const parts = [
    block(0.3, 0.14, 0.05, -(nose.xBody - 0.3), nose.belt - 0.12, nose.z + 0.02, HEAD),
    block(0.3, 0.14, 0.05, nose.xBody - 0.3, nose.belt - 0.12, nose.z + 0.02, HEAD),
    block(0.32, 0.14, 0.05, -(tail.xBody - 0.3), tail.belt - 0.16, tail.z - 0.02, TAIL),
    block(0.32, 0.14, 0.05, tail.xBody - 0.3, tail.belt - 0.16, tail.z - 0.02, TAIL),
  ];
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('parked car lights have mismatched attributes');
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}
