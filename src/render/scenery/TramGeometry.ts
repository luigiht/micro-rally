import { BoxGeometry, type BufferGeometry, Color, Matrix4, Vector3 } from 'three';
import { TRAM_WIRE_HEIGHT } from '@/game/stage/Tram';
import { TRAM_LENGTH, TRAM_WIDTH } from '@/game/stage/TramService';
import { box, merge, paint } from './HouseGeometry';

/**
 * A modern low-floor tram in the game's flat-shaded box style, after the
 * white-and-blue articulated trams of the reference: three sections joined
 * by ribbed bellows; a white upper body and roof over a blue lower band
 * with a dark skirt; a continuous window band in pale frames with double
 * doors framed the same; roof pods with slatted grilles and a Z-frame
 * pantograph on the middle section; and detailed cabs: a raked windscreen
 * between chamfered corner facets, a dark destination band above it, a
 * wiper, mirrors on arms, a bumper with a coupler, headlights at the nose
 * and tail lights at the back. Nose toward +z, standing on the rails at
 * y = 0. 24 m long, 2.65 m wide, 4.4 m to the pantograph head. One
 * non-indexed, vertex-coloured geometry.
 */
export const TRAM = {
  length: TRAM_LENGTH,
  width: TRAM_WIDTH,
  height: 5.3,
  sections: 3,
  bellows: 0.6,
} as const;

const WHITE = new Color('#e9ecef');
const BLUE = new Color('#2a4a9a');
const GLASS = new Color('#3b4a58');
const FRAME = new Color('#f4f5f6');
const ROOF = new Color('#d9dcdf');
const GRILLE = new Color('#2f3136');
const SLAT = new Color('#4a4d53');
const SKIRT = new Color('#2b2a33');
const BELLOWS = new Color('#2b2a33');
const RIB = new Color('#3a3944');
const HEAD = new Color('#fff6d0');
const TAIL = new Color('#d9343a');
const DISPLAY = new Color('#1b1d22');
const AMBER = new Color('#f2a63a');
const IRON = new Color('#3a3944');

const FLOOR = 0.4;
const BELT_Y = 1.15;
const GLASS_Y0 = 1.35;
const GLASS_Y1 = 2.65;
const ROOF_Y = 3.15;

/** A box tilted about x (negative drops its -z end), then turned about y. */
function tilted(
  w: number,
  h: number,
  d: number,
  rx: number,
  ry: number,
  x: number,
  y: number,
  z: number,
  c: Color,
) {
  return paint(new BoxGeometry(w, h, d).rotateX(rx).rotateY(ry).translate(x, y, z), c);
}

/** A window: pale frame proud of the body, glass a hair prouder, on both flanks at `z`. */
function windows(z: number, w: number, bodyW: number): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  for (const side of [-1, 1] as const) {
    const x = side * (bodyW / 2);
    out.push(
      box(
        0.06,
        GLASS_Y1 - GLASS_Y0 + 0.16,
        w + 0.16,
        x + side * 0.02,
        (GLASS_Y0 + GLASS_Y1) / 2,
        z,
        FRAME,
      ),
      box(0.06, GLASS_Y1 - GLASS_Y0, w, x + side * 0.05, (GLASS_Y0 + GLASS_Y1) / 2, z, GLASS),
    );
  }
  return out;
}

/** A double door: framed from the floor to the window head, two glazed leaves with a seam, on both flanks at `z`. */
function doors(z: number, bodyW: number): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const h = GLASS_Y1 - FLOOR - 0.1;
  const y = FLOOR + 0.05 + h / 2;
  for (const side of [-1, 1] as const) {
    const x = side * (bodyW / 2);
    out.push(
      box(0.06, h + 0.12, 1.7, x + side * 0.02, y, z, FRAME),
      box(0.06, h - 0.1, 0.72, x + side * 0.05, y, z - 0.41, GLASS),
      box(0.06, h - 0.1, 0.72, x + side * 0.05, y, z + 0.41, GLASS),
      box(0.07, h, 0.06, x + side * 0.055, y, z, FRAME),
      box(0.07, 0.9, 1.56, x + side * 0.06, FLOOR + 0.5, z, BLUE),
    );
  }
  return out;
}

/** A roof pod: a dark grille box with three pale slats, on the roof at `z`. */
function pod(z: number): BufferGeometry[] {
  const out = [box(1.7, 0.3, 1.9, 0, ROOF_Y + 0.17, z, GRILLE)];
  for (const dz of [-0.55, 0, 0.55]) out.push(box(1.5, 0.04, 0.12, 0, ROOF_Y + 0.33, z + dz, SLAT));
  return out;
}

/** A square tube of side `t` from one point to another, painted `c`. */
function tube(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
  c: Color,
) {
  const a = new Vector3(...from);
  const b = new Vector3(...to);
  const len = a.distanceTo(b);
  const g = new BoxGeometry(t, t, len);
  // lookAt points the geometry's +z from `target` to `eye`: from `a` to `b`.
  const m = new Matrix4().lookAt(b, a, new Vector3(0, 1, 0));
  g.applyMatrix4(m);
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return paint(g, c);
}

/**
 * A single-arm pantograph on the roof at `z`, raised to the contact wire
 * (`TRAM_WIRE_HEIGHT` over the rails), after the reference profile: a wide
 * flat base plate; from a pivot at its back, two close-set tubes and a thin
 * guide rod rise steeply to the knee block over the plate's front; from the
 * knee the long upper arm, two wide-set tubes converging on the head,
 * folds back over the plate so the head stands well behind it; the head is
 * a long bow carrying two contact strips, its horns curving down and out.
 */
function pantograph(z: number): BufferGeometry[] {
  const base = ROOF_Y + 0.34;
  const headTop = TRAM_WIRE_HEIGHT;
  const headY = headTop - 0.06;
  const pivot: [number, number, number] = [0, base + 0.1, z - 0.45];
  const rise = headY - 0.06 - pivot[1];
  const knee: [number, number, number] = [0, pivot[1] + rise * 0.62, z + 0.5];
  const head: [number, number, number] = [0, headY - 0.06, z - 1.6];
  const out: BufferGeometry[] = [
    // Base plate and the pivot block at its back.
    box(1.6, 0.1, 1.0, 0, base - 0.05, z, GRILLE),
    box(1.5, 0.04, 0.9, 0, base + 0.02, z, IRON),
    box(0.4, 0.14, 0.2, 0, pivot[1], pivot[2], IRON),
    // Lower arm: two close-set tubes and a thinner guide rod a little behind and below them.
    tube([-0.1, pivot[1], pivot[2]], [-0.1, knee[1], knee[2]], 0.06, IRON),
    tube([0.1, pivot[1], pivot[2]], [0.1, knee[1], knee[2]], 0.06, IRON),
    tube([0, pivot[1] - 0.04, pivot[2] - 0.14], [0, knee[1] - 0.1, knee[2] - 0.14], 0.035, SLAT),
    box(0.5, 0.12, 0.26, 0, knee[1], knee[2], IRON),
    // Upper arm: two tubes from the knee's ends converging on the head.
    tube([-0.22, knee[1], knee[2]], [-0.04, head[1], head[2]], 0.05, IRON),
    tube([0.22, knee[1], knee[2]], [0.04, head[1], head[2]], 0.05, IRON),
    // Head: a bow with two contact strips.
    box(0.14, 0.1, 0.16, 0, headY - 0.04, head[2], IRON),
    box(1.7, 0.04, 0.44, 0, headY - 0.01, head[2], IRON),
    box(1.9, 0.06, 0.07, 0, headTop - 0.03, head[2] - 0.15, GRILLE),
    box(1.9, 0.06, 0.07, 0, headTop - 0.03, head[2] + 0.15, GRILLE),
  ];
  // Horns curving down and out at the ends of each strip, in two pieces.
  for (const sx of [-1, 1] as const)
    for (const sz of [-1, 1] as const) {
      const zz = head[2] + sz * 0.15;
      out.push(
        tube([sx * 0.95, headTop - 0.05, zz], [sx * 1.2, headTop - 0.2, zz], 0.04, IRON),
        tube([sx * 1.2, headTop - 0.2, zz], [sx * 1.3, headTop - 0.42, zz], 0.04, IRON),
      );
    }
  return out;
}

/** A cab at `end` (+1 nose, -1 tail): chamfered corners, raked screen, display band, wiper, mirrors, bumper, lights. */
function cab(end: 1 | -1, W: number, zFace: number): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const rake = -end * 0.3;
  const zc = zFace - end * 0.3;
  // The face: a lower blue apron and a raked windscreen in a pale frame, the display band over it.
  out.push(
    tilted(W - 0.7, FLOOR + 0.35, 0.3, 0, 0, 0, FLOOR + 0.3, zFace - end * 0.1, BLUE),
    tilted(W - 0.6, GLASS_Y1 - 1.0, 0.26, rake, 0, 0, (1.0 + GLASS_Y1) / 2, zc, FRAME),
    tilted(W - 0.8, GLASS_Y1 - 1.1, 0.26, rake, 0, 0, (1.1 + GLASS_Y1) / 2, zc + end * 0.03, GLASS),
    box(W - 0.6, 0.42, 0.3, 0, ROOF_Y - 0.26, zc - end * 0.08, DISPLAY),
    box(W - 1.0, 0.2, 0.05, 0, ROOF_Y - 0.26, zc + end * 0.1, AMBER),
    box(W - 0.4, 0.24, 0.5, 0, ROOF_Y + 0.06, zc - end * 0.25, WHITE),
    // Wiper: a thin dark arm across the lower screen.
    tilted(0.05, 0.8, 0.04, rake, 0, 0.25, 1.6, zc + end * 0.16, IRON),
  );
  // Chamfered corner facets: the cab's sides turn in toward the face.
  for (const side of [-1, 1] as const) {
    out.push(
      tilted(
        0.5,
        ROOF_Y - FLOOR,
        0.12,
        0,
        side * end * 0.6,
        side * (W / 2 - 0.2),
        (FLOOR + ROOF_Y) / 2,
        zc - end * 0.15,
        WHITE,
      ),
      tilted(
        0.44,
        GLASS_Y1 - GLASS_Y0,
        0.14,
        0,
        side * end * 0.6,
        side * (W / 2 - 0.2),
        (GLASS_Y0 + GLASS_Y1) / 2,
        zc - end * 0.13,
        GLASS,
      ),
      tilted(
        0.5,
        BELT_Y - FLOOR,
        0.13,
        0,
        side * end * 0.6,
        side * (W / 2 - 0.2),
        (FLOOR + BELT_Y) / 2,
        zc - end * 0.14,
        BLUE,
      ),
      // Mirror on an arm, by the cab's side window.
      box(0.3, 0.05, 0.05, side * (W / 2 + 0.15), 2.3, zc - end * 0.9, IRON),
      box(0.12, 0.3, 0.2, side * (W / 2 + 0.3), 2.2, zc - end * 0.9, SKIRT),
      // Headlights or tail lights, a pair low on the face.
      box(
        0.32,
        0.18,
        0.08,
        side * (W / 2 - 0.55),
        FLOOR + 0.5,
        zFace + end * 0.04,
        end > 0 ? HEAD : TAIL,
      ),
      box(
        0.14,
        0.1,
        0.06,
        side * (W / 2 - 0.3),
        FLOOR + 0.5,
        zFace + end * 0.03,
        end > 0 ? TAIL : HEAD,
      ),
    );
  }
  // Bumper and coupler.
  out.push(
    box(W - 0.5, 0.18, 0.2, 0, FLOOR + 0.05, zFace + end * 0.08, SKIRT),
    box(0.3, 0.14, 0.3, 0, FLOOR - 0.05, zFace + end * 0.1, IRON),
  );
  return out;
}

export function tramGeometry(): BufferGeometry {
  const { length: L, width: W, sections, bellows } = TRAM;
  const secLen = (L - bellows * (sections - 1)) / sections;
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < sections; i++) {
    const zc = -L / 2 + secLen / 2 + i * (secLen + bellows);
    const first = i === 0;
    const last = i === sections - 1;
    // The cab sections give up their outer end to the cab's face.
    const cabLen = 0.6;
    const bodyLen = secLen - (first ? cabLen : 0) - (last ? cabLen : 0);
    const bodyZ = zc + (first ? cabLen / 2 : 0) - (last ? cabLen / 2 : 0);
    parts.push(
      box(W, BELT_Y - FLOOR, bodyLen, 0, (FLOOR + BELT_Y) / 2, bodyZ, BLUE),
      box(W, GLASS_Y0 - BELT_Y + 0.02, bodyLen, 0, (BELT_Y + GLASS_Y0) / 2, bodyZ, WHITE),
      box(W - 0.08, GLASS_Y1 - GLASS_Y0, bodyLen, 0, (GLASS_Y0 + GLASS_Y1) / 2, bodyZ, WHITE),
      box(W, ROOF_Y - GLASS_Y1, bodyLen, 0, (GLASS_Y1 + ROOF_Y) / 2, bodyZ, WHITE),
      box(W - 0.2, 0.12, bodyLen - 0.1, 0, ROOF_Y + 0.06, bodyZ, ROOF),
      box(W + 0.02, 0.26, bodyLen, 0, FLOOR - 0.12, bodyZ, SKIRT),
      box(W + 0.03, 0.06, bodyLen, 0, BELT_Y + 0.01, bodyZ, FRAME),
    );
    // Windows and doors along the flanks: the end sections carry a door near the cab, the middle one two.
    const doorZs = first
      ? [bodyZ + bodyLen / 2 - 1.3]
      : last
        ? [bodyZ - bodyLen / 2 + 1.3]
        : [bodyZ - 2.1, bodyZ + 2.1];
    for (const dz of doorZs) parts.push(...doors(dz, W));
    const windowZs: number[] = [];
    for (let z = bodyZ - bodyLen / 2 + 1.0; z < bodyZ + bodyLen / 2 - 0.9; z += 1.5)
      if (doorZs.every((d) => Math.abs(z - d) > 1.65)) windowZs.push(z);
    for (const z of windowZs) parts.push(...windows(z, 1.3, W));
    // Roof pods, two per section; bogie boxes under the floor.
    for (const dz of [-secLen / 4 + 0.3, secLen / 4 - 0.3]) {
      parts.push(...pod(zc + dz));
      parts.push(box(W - 0.6, FLOOR - 0.14, 1.6, 0, (FLOOR - 0.14) / 2, zc + dz, SKIRT));
    }
    if (i === 1) parts.push(...pantograph(zc + 1.2));
    // Ribbed bellows between sections.
    if (i < sections - 1) {
      const bz = zc + secLen / 2 + bellows / 2;
      parts.push(
        box(W - 0.24, ROOF_Y - FLOOR + 0.1, bellows + 0.1, 0, (FLOOR + ROOF_Y) / 2, bz, BELLOWS),
      );
      for (const dz of [-0.2, 0, 0.2])
        parts.push(box(W - 0.16, ROOF_Y - FLOOR, 0.08, 0, (FLOOR + ROOF_Y) / 2, bz + dz, RIB));
    }
  }
  parts.push(...cab(1, W, L / 2 - 0.1), ...cab(-1, W, -L / 2 + 0.1));
  return merge(parts);
}
