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

/**
 * Low-poly roadside spectators after the faceted crowd in
 * `context/low-poly-people` (a reference only, not shipped): tapered
 * five-sided limbs between posed joints, a faceted head, hands up in one of
 * six poses (fist pump, clapping, both arms up, hands on the head, arms
 * crossed against the cold, waving), dressed for the snow. About 1.75 m
 * tall at scale 1, facing −z, the figure's right at +x.
 *
 * Each pose is two instanced parts, because an instance colour multiplies
 * every vertex colour: the body (skin, trousers, boots, gloves, scarf,
 * headwear) in fixed vertex colours, and the jacket, white with darker
 * cuffs, stripes and zip, for the jacket tint. Pose and jacket both come
 * from the prop's variant (`spectatorPose`, `variant % jackets`).
 */
type V3 = readonly [number, number, number];
type Headwear = 'beanie' | 'cap' | 'hood' | 'earmuffs';

interface Arm {
  elbow: V3;
  hand: V3;
}
interface Pose {
  /** Right (+x) then left arm. */
  arms: readonly [Arm, Arm];
  /** Half the distance between the feet. */
  stance: number;
  skin: string;
  trousers: string;
  boots: string;
  head: Headwear;
  /** Hat, cap, earmuff or hair colour. */
  hat: string;
  hair: string;
  scarf: string | null;
  /** A dark stripe round each upper sleeve, as on the reference's yellow top. */
  stripes: boolean;
}

const POSES: readonly Pose[] = [
  {
    // Fist pump: right arm high, left hanging.
    arms: [
      { elbow: [0.29, 1.64, -0.03], hand: [0.31, 1.9, -0.06] },
      { elbow: [-0.27, 1.13, 0.02], hand: [-0.24, 0.88, -0.05] },
    ],
    stance: 0.12,
    skin: '#e8b89a',
    trousers: '#2d3340',
    boots: '#3b6fd8',
    head: 'beanie',
    hat: '#c43a32',
    hair: '#3a2a20',
    scarf: '#f1ede4',
    stripes: false,
  },
  {
    // Clapping, hands together in front of the chest.
    arms: [
      { elbow: [0.25, 1.15, -0.05], hand: [0.04, 1.3, -0.2] },
      { elbow: [-0.25, 1.15, -0.05], hand: [-0.04, 1.3, -0.2] },
    ],
    stance: 0.13,
    skin: '#f0c9ae',
    trousers: '#34407a',
    boots: '#e9c23a',
    head: 'earmuffs',
    hat: '#e0e4ea',
    hair: '#a8452e',
    scarf: null,
    stripes: true,
  },
  {
    // Both arms up, cheering.
    arms: [
      { elbow: [0.34, 1.65, -0.03], hand: [0.27, 1.91, -0.1] },
      { elbow: [-0.34, 1.65, -0.03], hand: [-0.27, 1.91, -0.1] },
    ],
    stance: 0.16,
    skin: '#8d5a3c',
    trousers: '#4a4640',
    boots: '#5cc94a',
    head: 'cap',
    hat: '#2f6fb0',
    hair: '#1f1a17',
    scarf: null,
    stripes: false,
  },
  {
    // Hands on the head: "did you see that?"
    arms: [
      { elbow: [0.4, 1.58, -0.06], hand: [0.13, 1.74, -0.02] },
      { elbow: [-0.4, 1.58, -0.06], hand: [-0.13, 1.74, -0.02] },
    ],
    stance: 0.14,
    skin: '#c99272',
    trousers: '#1f2a44',
    boots: '#2a2d33',
    head: 'hood',
    hat: '#2a2d33',
    hair: '#2b1f19',
    scarf: '#d8343a',
    stripes: false,
  },
  {
    // Arms crossed against the cold.
    arms: [
      { elbow: [0.25, 1.15, -0.06], hand: [-0.05, 1.22, -0.17] },
      { elbow: [-0.25, 1.15, -0.06], hand: [0.05, 1.24, -0.18] },
    ],
    stance: 0.11,
    skin: '#e3ad8c',
    trousers: '#3a3f47',
    boots: '#4fd0d6',
    head: 'beanie',
    hat: '#2f6fb0',
    hair: '#6b4a2e',
    scarf: '#e9b53a',
    stripes: true,
  },
  {
    // Waving to the car, the other hand on the hip.
    arms: [
      { elbow: [0.43, 1.48, -0.08], hand: [0.5, 1.72, -0.2] },
      { elbow: [-0.36, 1.12, 0.03], hand: [-0.2, 0.98, -0.03] },
    ],
    stance: 0.13,
    skin: '#f2d0b8',
    trousers: '#5a3a2a',
    boots: '#d8343a',
    head: 'beanie',
    hat: '#e9b53a',
    hair: '#d9b46a',
    scarf: '#3f8a4a',
    stripes: false,
  },
];

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

/** Where the sleeve ends and the glove starts. */
function wrist(arm: Arm): V3 {
  return lerp3(arm.elbow, arm.hand, 0.82);
}

function headwear(pose: Pose): BufferGeometry[] {
  const hat = new Color(pose.hat);
  const hair = new Color(pose.hair);
  const rim = hat.clone().multiplyScalar(0.7);
  const parts: BufferGeometry[] = [];
  if (pose.head !== 'beanie' && pose.head !== 'hood') {
    // A faceted cap of hair over the crown and the back of the head.
    parts.push(ball(0.118, [0, HEAD_Y + 0.05, 0.02], hair, 1, 0.78, 1.04));
  }
  switch (pose.head) {
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
        // A ponytail.
        segment([0, HEAD_Y + 0.06, 0.1], [0, HEAD_Y - 0.12, 0.14], 0.04, 0.022, hair, 5),
      );
      break;
    case 'hood':
      // The hood itself is part of the jacket; a fringe of hair shows under it.
      parts.push(box(0.16, 0.035, 0.04, 0, HEAD_Y + 0.085, -0.085, hair));
      break;
  }
  return parts;
}

function bodyGeometry(pose: Pose): BufferGeometry {
  const skin = new Color(pose.skin);
  const trousers = new Color(pose.trousers);
  const boots = new Color(pose.boots);
  const parts: BufferGeometry[] = [];

  for (const side of [1, -1] as const) {
    const hip: V3 = [HIP_X * side, HIP_Y, 0];
    const ankle: V3 = [pose.stance * side, 0.11, 0];
    const knee: V3 = [((HIP_X + pose.stance) / 2 + 0.01) * side, 0.5, -0.03];
    parts.push(
      segment(hip, knee, 0.088, 0.068, trousers, 6),
      ball(0.068, knee, trousers),
      segment(knee, ankle, 0.066, 0.05, trousers, 6),
      // Boot: a chunky upper over a pale sole, toe forward.
      box(0.12, 0.11, 0.25, ankle[0], 0.075, -0.04, boots),
      box(0.13, 0.03, 0.27, ankle[0], 0.015, -0.045, SOLE),
      box(0.1, 0.05, 0.06, ankle[0], 0.1, -0.15, boots),
    );
    const arm = pose.arms[side === 1 ? 0 : 1];
    // Mittened hand, a touch bigger than the wrist.
    parts.push(segment(wrist(arm), arm.hand, 0.045, 0.05, GLOVE, 5), ball(0.05, arm.hand, GLOVE));
  }
  // Seat of the trousers under the jacket's hem.
  parts.push(box(0.3, 0.16, 0.19, 0, HIP_Y + 0.02, 0, trousers));
  // Neck and the faceted head, a little longer than wide.
  parts.push(segment([0, 1.42, 0], [0, 1.53, 0], 0.052, 0.048, skin, 6));
  parts.push(
    paint(
      new IcosahedronGeometry(0.108, 0).scale(0.95, 1.22, 1.02).translate(0, HEAD_Y, -0.005),
      skin,
    ),
  );
  if (pose.scarf) {
    const scarf = new Color(pose.scarf);
    parts.push(
      paint(new CylinderGeometry(0.085, 0.11, 0.09, 6).translate(0, 1.46, 0), scarf),
      box(0.07, 0.22, 0.03, 0.06, 1.33, -0.135, scarf),
    );
  }
  parts.push(...headwear(pose));
  return merge(parts);
}

function jacketGeometry(pose: Pose): BufferGeometry {
  const parts: BufferGeometry[] = [
    // Padded torso, broader at the chest, a flat face forward.
    paint(
      new CylinderGeometry(0.205, 0.175, 0.52, 6)
        .rotateY(Math.PI / 6)
        .scale(1, 1, 0.66)
        .translate(0, 1.17, 0),
      WHITE,
    ),
    // Ribbed hem, collar and a zip down the front.
    paint(
      new CylinderGeometry(0.182, 0.182, 0.07, 6)
        .rotateY(Math.PI / 6)
        .scale(1, 1, 0.7)
        .translate(0, 0.94, 0),
      SHADE,
    ),
    paint(new CylinderGeometry(0.08, 0.12, 0.07, 6).translate(0, 1.43, 0), WHITE),
    box(0.025, 0.46, 0.012, 0, 1.17, -0.118, SHADE),
  ];
  if (pose.head === 'hood') {
    parts.push(
      ball(0.14, [0, HEAD_Y + 0.025, 0.04], WHITE, 1, 1.08, 0.95),
      paint(new CylinderGeometry(0.11, 0.13, 0.08, 6).translate(0, 1.45, 0.02), WHITE),
    );
  }
  for (const side of [1, -1] as const) {
    const arm = pose.arms[side === 1 ? 0 : 1];
    const s = shoulder(side);
    const w = wrist(arm);
    parts.push(
      ball(0.085, s, WHITE),
      segment(s, arm.elbow, 0.07, 0.06, WHITE),
      ball(0.06, arm.elbow, WHITE),
      segment(arm.elbow, lerp3(arm.elbow, w, 0.82), 0.06, 0.052, WHITE),
      // Cuff.
      segment(lerp3(arm.elbow, w, 0.8), w, 0.056, 0.056, SHADE),
    );
    if (pose.stripes) {
      parts.push(
        segment(lerp3(s, arm.elbow, 0.5), lerp3(s, arm.elbow, 0.62), 0.068, 0.067, SHADE),
        segment(lerp3(s, arm.elbow, 0.7), lerp3(s, arm.elbow, 0.8), 0.066, 0.065, SHADE),
      );
    }
  }
  return merge(parts);
}

/** Which of the six poses a spectator prop strikes. */
export function spectatorPose(variant: number): number {
  return Math.floor(variant / SPECTATOR_JACKETS) % SPECTATOR_POSES;
}

/** Skin, trousers, boots, gloves, scarf and headwear for `pose`, in fixed colours. */
export function spectatorBodyGeometry(pose: number): BufferGeometry {
  return bodyGeometry(POSES[pose % POSES.length]!);
}

/** The jacket for `pose`, white with darker trim, for the instance tint. */
export function spectatorJacketGeometry(pose: number): BufferGeometry {
  return jacketGeometry(POSES[pose % POSES.length]!);
}

export const SPECTATOR_POSE_COUNT = POSES.length;
