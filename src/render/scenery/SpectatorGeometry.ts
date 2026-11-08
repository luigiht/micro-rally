import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  Quaternion,
  Vector3,
} from 'three';
import { SPECTATOR_JACKETS, SPECTATOR_POSES } from '@/game/stage/Spectators';
import { box, merge, paint } from './HouseGeometry';
import {
  lookFor,
  POSE_COUNT,
  type Arm,
  type Look,
  type Outfit,
  type V3,
} from './SpectatorWardrobe';

/**
 * Low-poly roadside spectators after the faceted crowd in
 * `context/low-poly-people` (a reference only, not shipped): tapered
 * five-sided limbs between posed joints, a faceted head, hands up in one of
 * six poses (fist pump, clapping, both arms up, hands on the head, arms
 * crossed, waving), dressed for the snow or for a mild day
 * (`SpectatorWardrobe`). About 1.75 m tall at scale 1, facing −z, the
 * figure's right at +x.
 *
 * Each pose is two instanced parts, because an instance colour multiplies
 * every vertex colour: the body (skin, legs, shoes, hands, scarf,
 * headwear) in fixed vertex colours, and the top (a padded jacket, or a
 * T-shirt or long-sleeved top), white with darker trim, for the tint. Pose and jacket both come
 * from the prop's variant (`spectatorPose`, `variant % jackets`).
 */

const WHITE = new Color('#ffffff');
/** Cuffs, hem, stripes and zip: a darker shade of whatever the jacket is tinted. */
const SHADE = new Color('#4a4a4a');
const SOLE = new Color('#f1ede4');
const GLOVE = new Color('#2a2d33');

const SHOULDER_Y = 1.38;
const SHOULDER_X = 0.2;
const HIP_Y = 0.93;
const HIP_X = 0.095;
const HEAD_Y = 1.62;
/** Seated figures sit on the ground: the hips this high, the upper body lowered to match. */
const SEAT_HIP_Y = 0.15;
const SEAT_DROP = HIP_Y - SEAT_HIP_Y;
const CAMERA = new Color('#24252b');
const LENS = new Color('#6f7b86');

const UP = new Vector3(0, 1, 0);

/**
 * A tapered prism from `a` (radius `ra`) to `b` (radius `rb`): a faceted limb
 * segment, open-ended since joints, boots, mittens and the body hide its ends.
 */
function segment(a: V3, b: V3, ra: number, rb: number, color: Color, sides = 5): BufferGeometry {
  const from = new Vector3(...a);
  const dir = new Vector3(...b).sub(from);
  const len = dir.length();
  const g = new CylinderGeometry(rb, ra, len, sides, 1, true);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, dir.normalize()));
  g.translate(from.x + (b[0] - a[0]) / 2, from.y + (b[1] - a[1]) / 2, from.z + (b[2] - a[2]) / 2);
  return paint(g, color);
}

/** A point `t` of the way from `a` to `b`. */
function lerp3(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function ball(r: number, at: V3, color: Color, sx = 1, sy = 1, sz = 1): BufferGeometry {
  return paint(new IcosahedronGeometry(r, 0).scale(sx, sy, sz).translate(...at), color);
}

function shoulder(side: 1 | -1): V3 {
  return [SHOULDER_X * side, SHOULDER_Y, 0];
}

/** Where the sleeve ends and the hand starts. */
function wrist(arm: Arm): V3 {
  return lerp3(arm.elbow, arm.hand, 0.82);
}

/** Where a short sleeve ends, halfway down the upper arm. */
function shortSleeve(side: 1 | -1, arm: Arm): V3 {
  return lerp3(shoulder(side), arm.elbow, 0.5);
}

function headwear(look: Look): BufferGeometry[] {
  const hat = new Color(look.hat);
  const hair = new Color(look.hair);
  const rim = hat.clone().multiplyScalar(0.7);
  const parts: BufferGeometry[] = [];
  if (look.head !== 'beanie' && look.head !== 'hood') {
    // A faceted cap of hair over the crown and the back of the head.
    parts.push(ball(0.118, [0, HEAD_Y + 0.05, 0.02], hair, 1, 0.78, 1.04));
  }
  const ponytail = () =>
    segment([0, HEAD_Y + 0.06, 0.1], [0, HEAD_Y - 0.12, 0.14], 0.04, 0.022, hair, 5);
  switch (look.head) {
    case 'beanie':
      parts.push(
        paint(new CylinderGeometry(0.085, 0.118, 0.12, 7).translate(0, HEAD_Y + 0.1, 0.005), hat),
        paint(new CylinderGeometry(0.122, 0.122, 0.04, 7).translate(0, HEAD_Y + 0.045, 0.005), rim),
        ball(0.042, [0, HEAD_Y + 0.185, 0.005], WHITE),
      );
      break;
    case 'cap':
      parts.push(
        paint(new CylinderGeometry(0.098, 0.118, 0.07, 7).translate(0, HEAD_Y + 0.09, 0.01), hat),
        box(0.15, 0.018, 0.1, 0, HEAD_Y + 0.058, -0.13, rim),
      );
      break;
    case 'earmuffs':
      parts.push(
        segment([-0.11, HEAD_Y + 0.01, 0.005], [0, HEAD_Y + 0.15, 0.005], 0.014, 0.014, rim, 4),
        segment([0, HEAD_Y + 0.15, 0.005], [0.11, HEAD_Y + 0.01, 0.005], 0.014, 0.014, rim, 4),
        ball(0.048, [-0.112, HEAD_Y - 0.005, 0.005], hat, 0.7, 1, 1),
        ball(0.048, [0.112, HEAD_Y - 0.005, 0.005], hat, 0.7, 1, 1),
        ponytail(),
      );
      break;
    case 'ponytail':
      parts.push(ponytail());
      break;
    case 'hood':
      // The hood itself is part of the jacket; a fringe of hair shows under it.
      parts.push(box(0.16, 0.035, 0.04, 0, HEAD_Y + 0.085, -0.085, hair));
      break;
    case 'hair':
      break;
  }
  return parts;
}

/** Snow boots (a chunky upper, pale sole and toe) or trainers (low, a white sole), the ankle at depth `z`. */
function shoe(x: number, z: number, look: Look): BufferGeometry[] {
  const c = new Color(look.shoes);
  if (look.outfit === 'winter')
    return [
      box(0.12, 0.11, 0.25, x, 0.075, z - 0.04, c),
      box(0.13, 0.03, 0.27, x, 0.015, z - 0.045, SOLE),
      box(0.1, 0.05, 0.06, x, 0.1, z - 0.15, c),
    ];
  return [
    box(0.105, 0.075, 0.24, x, 0.06, z - 0.045, c),
    box(0.115, 0.03, 0.26, x, 0.015, z - 0.05, SOLE),
  ];
}

/** Hip, knee and ankle for one leg: standing, or sitting with the knee drawn up and the foot flat. */
function legJoints(look: Look, side: 1 | -1): [V3, V3, V3] {
  if (look.seated)
    return [
      [HIP_X * side, SEAT_HIP_Y, -0.02],
      [0.13 * side, 0.45, -0.34],
      [0.12 * side, 0.11, -0.5],
    ];
  return [
    [HIP_X * side, HIP_Y, 0],
    [((HIP_X + look.stance) / 2 + 0.01) * side, 0.5, -0.03],
    [look.stance * side, 0.11, 0],
  ];
}

/** A compact camera held up to the eye, its lens toward the road. */
function camera(): BufferGeometry[] {
  return [
    box(0.15, 0.09, 0.06, 0, HEAD_Y - 0.01, -0.2, CAMERA),
    paint(
      new CylinderGeometry(0.03, 0.03, 0.06, 7)
        .rotateX(Math.PI / 2)
        .translate(0.025, HEAD_Y - 0.015, -0.255),
      LENS,
    ),
    box(0.03, 0.02, 0.02, -0.045, HEAD_Y + 0.045, -0.2, CAMERA),
  ];
}

function bodyGeometry(look: Look): BufferGeometry {
  const skin = new Color(look.skin);
  const legs = new Color(look.legs);
  const parts: BufferGeometry[] = [];
  // Everything above the hips, built standing and lowered onto the ground when seated.
  const upper: BufferGeometry[] = [];

  for (const side of [1, -1] as const) {
    const [hip, knee, ankle] = legJoints(look, side);
    if (look.shorts) {
      // Shorts to just above the knee, bare legs below.
      const hem = lerp3(hip, knee, 0.8);
      parts.push(
        segment(hip, hem, 0.09, 0.08, legs, 6),
        segment(hem, knee, 0.06, 0.056, skin, 6),
        ball(0.056, knee, skin),
        segment(knee, ankle, 0.055, 0.042, skin, 6),
      );
    } else {
      parts.push(
        segment(hip, knee, 0.088, 0.068, legs, 6),
        ball(0.068, knee, legs),
        segment(knee, ankle, 0.066, 0.05, legs, 6),
      );
    }
    parts.push(...shoe(ankle[0], ankle[2], look));
    const arm = look.arms[side === 1 ? 0 : 1];
    if (look.sleeves === 'mitten') {
      // Mittened hand, a touch bigger than the wrist.
      upper.push(segment(wrist(arm), arm.hand, 0.045, 0.05, GLOVE, 5), ball(0.05, arm.hand, GLOVE));
    } else if (look.sleeves === 'long') {
      upper.push(segment(wrist(arm), arm.hand, 0.04, 0.042, skin, 5), ball(0.042, arm.hand, skin));
    } else {
      // A bare arm from the T-shirt's sleeve to the hand.
      upper.push(
        segment(shortSleeve(side, arm), arm.elbow, 0.055, 0.05, skin, 5),
        ball(0.05, arm.elbow, skin),
        segment(arm.elbow, arm.hand, 0.048, 0.04, skin, 5),
        ball(0.042, arm.hand, skin),
      );
    }
  }
  // Seat of the trousers under the top's hem.
  upper.push(box(0.3, 0.16, 0.19, 0, HIP_Y + 0.02, 0, legs));
  // Neck and the faceted head, a little longer than wide.
  upper.push(segment([0, 1.42, 0], [0, 1.53, 0], 0.052, 0.048, skin, 6));
  upper.push(
    paint(
      new IcosahedronGeometry(0.108, 0).scale(0.95, 1.22, 1.02).translate(0, HEAD_Y, -0.005),
      skin,
    ),
  );
  if (look.scarf) {
    const scarf = new Color(look.scarf);
    upper.push(
      paint(new CylinderGeometry(0.085, 0.11, 0.09, 6).translate(0, 1.46, 0), scarf),
      box(0.07, 0.22, 0.03, 0.06, 1.33, -0.135, scarf),
    );
  }
  upper.push(...headwear(look));
  if (look.camera) upper.push(...camera());
  if (look.seated) for (const g of upper) g.translate(0, -SEAT_DROP, 0);
  return merge([...parts, ...upper]);
}

/** A six-sided torso band, its flat face forward. */
function torso(rTop: number, rBottom: number, h: number, y: number, depth: number, c: Color) {
  return paint(
    new CylinderGeometry(rTop, rBottom, h, 6)
      .rotateY(Math.PI / 6)
      .scale(1, 1, depth)
      .translate(0, y, 0),
    c,
  );
}

function jacketGeometry(look: Look): BufferGeometry {
  const winter = look.outfit === 'winter';
  const parts: BufferGeometry[] = winter
    ? [
        // Padded torso, broader at the chest; ribbed hem, collar and a zip down the front.
        torso(0.205, 0.175, 0.52, 1.17, 0.66, WHITE),
        torso(0.182, 0.182, 0.07, 0.94, 0.7, SHADE),
        paint(new CylinderGeometry(0.08, 0.12, 0.07, 6).translate(0, 1.43, 0), WHITE),
        box(0.025, 0.46, 0.012, 0, 1.17, -0.118, SHADE),
      ]
    : [
        // A slimmer top over the hips, a crew neck in the trim.
        torso(0.188, 0.168, 0.54, 1.16, 0.62, WHITE),
        torso(0.17, 0.17, 0.04, 0.9, 0.64, SHADE),
        paint(new CylinderGeometry(0.068, 0.09, 0.04, 6).translate(0, 1.43, 0), SHADE),
      ];
  if (look.head === 'hood') {
    parts.push(
      ball(0.14, [0, HEAD_Y + 0.025, 0.04], WHITE, 1, 1.08, 0.95),
      paint(new CylinderGeometry(0.11, 0.13, 0.08, 6).translate(0, 1.45, 0.02), WHITE),
    );
  }
  for (const side of [1, -1] as const) {
    const arm = look.arms[side === 1 ? 0 : 1];
    const s = shoulder(side);
    if (look.sleeves === 'short') {
      const end = shortSleeve(side, arm);
      parts.push(
        ball(0.075, s, WHITE),
        segment(s, lerp3(s, end, 0.85), 0.07, 0.066, WHITE),
        segment(lerp3(s, end, 0.85), end, 0.066, 0.066, SHADE),
      );
      continue;
    }
    const w = wrist(arm);
    const [r0, r1, r2] = winter ? [0.085, 0.07, 0.06] : [0.075, 0.062, 0.054];
    parts.push(
      ball(r0, s, WHITE),
      segment(s, arm.elbow, r1, r2, WHITE),
      ball(r2, arm.elbow, WHITE),
      segment(arm.elbow, lerp3(arm.elbow, w, 0.82), r2, r2 - 0.008, WHITE),
      // Cuff.
      segment(lerp3(arm.elbow, w, 0.8), w, r2 - 0.004, r2 - 0.004, SHADE),
    );
    if (look.stripes) {
      parts.push(
        segment(lerp3(s, arm.elbow, 0.5), lerp3(s, arm.elbow, 0.62), 0.068, 0.067, SHADE),
        segment(lerp3(s, arm.elbow, 0.7), lerp3(s, arm.elbow, 0.8), 0.066, 0.065, SHADE),
      );
    }
  }
  const top = merge(parts);
  return look.seated ? top.translate(0, -SEAT_DROP, 0) : top;
}

/** Which of the poses a spectator prop strikes. */
export function spectatorPose(variant: number): number {
  return Math.floor(variant / SPECTATOR_JACKETS) % SPECTATOR_POSES;
}

/** Skin, legs, shoes, hands, scarf and headwear for `pose` in `outfit`, in fixed colours. */
export function spectatorBodyGeometry(pose: number, outfit: Outfit = 'winter'): BufferGeometry {
  return bodyGeometry(lookFor(pose, outfit));
}

/** The top for `pose` in `outfit` (a padded jacket, or a T-shirt or long sleeves), white with darker trim, for the tint. */
export function spectatorJacketGeometry(pose: number, outfit: Outfit = 'winter'): BufferGeometry {
  return jacketGeometry(lookFor(pose, outfit));
}

export const SPECTATOR_POSE_COUNT = POSE_COUNT;
