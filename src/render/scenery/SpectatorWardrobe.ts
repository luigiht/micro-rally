/**
 * What the roadside spectators wear and how they stand: nine poses (six
 * standing and cheering; one sitting on the ground, hands on the knees; one
 * sitting and one standing with a camera up to the eye), each with
 * its own figure (skin, stance, arms), dressed either for the snow (the
 * Arctic's padded jackets, beanies, hoods, earmuffs, scarves, mittens and
 * boots) or for a mild day (the Forest's mud rally: T-shirts and long
 * sleeves, jeans or shorts, trainers, caps, bare heads and ponytails). The
 * shapes are drawn by `SpectatorGeometry`.
 */
export type V3 = readonly [number, number, number];
export type Headwear = 'beanie' | 'cap' | 'hood' | 'earmuffs' | 'hair' | 'ponytail';
export type Outfit = 'winter' | 'casual';

export interface Arm {
  elbow: V3;
  hand: V3;
}
/** A pose: the figure and its winter clothes. */
export interface Pose {
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
  /** Sitting on the ground, knees up, rather than standing. Arms are given in the standing frame. */
  seated?: boolean;
  /** Holding a camera up to the eye. */
  camera?: boolean;
}

/** One figure dressed: what the geometry draws. */
export interface Look {
  arms: readonly [Arm, Arm];
  stance: number;
  skin: string;
  head: Headwear;
  hat: string;
  hair: string;
  /** Trousers, or shorts with bare shins below the knee. */
  legs: string;
  shorts: boolean;
  /** Snow boots or trainers, by outfit. */
  shoes: string;
  scarf: string | null;
  stripes: boolean;
  /** Mittens on a padded sleeve; a long or short sleeve with a bare hand. */
  sleeves: 'mitten' | 'long' | 'short';
  outfit: Outfit;
  seated: boolean;
  camera: boolean;
}

export const POSES: readonly Pose[] = [
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
  {
    // Sitting on the ground, knees up, hands on the knees.
    arms: [
      { elbow: [0.26, 1.2, -0.12], hand: [0.13, 1.27, -0.32] },
      { elbow: [-0.26, 1.2, -0.12], hand: [-0.13, 1.27, -0.32] },
    ],
    stance: 0.12,
    skin: '#e8b89a',
    trousers: '#3a3f47',
    boots: '#e9c23a',
    head: 'beanie',
    hat: '#3f8a4a',
    hair: '#3a2a20',
    scarf: '#d8343a',
    stripes: false,
    seated: true,
  },
  {
    // Sitting, taking a picture: the camera up to the eye, elbows out.
    arms: [
      { elbow: [0.23, 1.42, -0.1], hand: [0.075, 1.6, -0.19] },
      { elbow: [-0.23, 1.42, -0.1], hand: [-0.075, 1.6, -0.19] },
    ],
    stance: 0.12,
    skin: '#c99272',
    trousers: '#2d3340',
    boots: '#d8343a',
    head: 'hood',
    hat: '#2a2d33',
    hair: '#1f1a17',
    scarf: null,
    stripes: true,
    seated: true,
    camera: true,
  },
  {
    // Standing, taking a picture.
    arms: [
      { elbow: [0.23, 1.42, -0.1], hand: [0.075, 1.6, -0.19] },
      { elbow: [-0.23, 1.42, -0.1], hand: [-0.075, 1.6, -0.19] },
    ],
    stance: 0.14,
    skin: '#f0c9ae',
    trousers: '#1f2a44',
    boots: '#4fd0d6',
    head: 'beanie',
    hat: '#d8343a',
    hair: '#6b4a2e',
    scarf: '#f1ede4',
    stripes: false,
    camera: true,
  },
];

/** The same six figures on a mild day, pose by pose. */
const CASUAL: readonly Pick<
  Look,
  'head' | 'hat' | 'hair' | 'legs' | 'shorts' | 'shoes' | 'sleeves'
>[] = [
  // Fist pump: a T-shirt, jeans, white trainers and a cap.
  {
    head: 'cap',
    hat: '#2f6fb0',
    hair: '#3a2a20',
    legs: '#3b5b86',
    shorts: false,
    shoes: '#ece7dc',
    sleeves: 'short',
  },
  // Clapping: a ponytail, black jeans, red trainers.
  {
    head: 'ponytail',
    hat: '#a8452e',
    hair: '#a8452e',
    legs: '#2d3340',
    shorts: false,
    shoes: '#d8343a',
    sleeves: 'short',
  },
  // Arms up: long sleeves, chinos, a red cap.
  {
    head: 'cap',
    hat: '#d8343a',
    hair: '#1f1a17',
    legs: '#b49a6a',
    shorts: false,
    shoes: '#2a2d33',
    sleeves: 'long',
  },
  // Hands on the head: bare-headed in long sleeves and jeans.
  {
    head: 'hair',
    hat: '#2b1f19',
    hair: '#2b1f19',
    legs: '#3b5b86',
    shorts: false,
    shoes: '#ece7dc',
    sleeves: 'long',
  },
  // Arms crossed: shorts and teal trainers.
  {
    head: 'hair',
    hat: '#6b4a2e',
    hair: '#6b4a2e',
    legs: '#5f6b3a',
    shorts: true,
    shoes: '#4fd0d6',
    sleeves: 'short',
  },
  // Waving: a blonde ponytail, navy trousers, yellow trainers.
  {
    head: 'ponytail',
    hat: '#d9b46a',
    hair: '#d9b46a',
    legs: '#1f2a44',
    shorts: false,
    shoes: '#e9b53a',
    sleeves: 'short',
  },
  // Sitting, hands on the knees: a green cap, jeans.
  {
    head: 'cap',
    hat: '#3f8a4a',
    hair: '#3a2a20',
    legs: '#3b5b86',
    shorts: false,
    shoes: '#ece7dc',
    sleeves: 'short',
  },
  // Sitting with a camera: a ponytail, long sleeves.
  {
    head: 'ponytail',
    hat: '#2b1f19',
    hair: '#2b1f19',
    legs: '#2d3340',
    shorts: false,
    shoes: '#d8343a',
    sleeves: 'long',
  },
  // Standing with a camera: shorts, bare-headed.
  {
    head: 'hair',
    hat: '#a8452e',
    hair: '#a8452e',
    legs: '#5f6b3a',
    shorts: true,
    shoes: '#2a2d33',
    sleeves: 'short',
  },
];

/** Pose `index` dressed for `outfit`. */
export function lookFor(index: number, outfit: Outfit): Look {
  const p = POSES[index % POSES.length]!;
  const base = {
    arms: p.arms,
    stance: p.stance,
    skin: p.skin,
    outfit,
    seated: p.seated === true,
    camera: p.camera === true,
  };
  if (outfit === 'casual')
    return { ...base, ...CASUAL[index % CASUAL.length]!, scarf: null, stripes: false };
  return {
    ...base,
    head: p.head,
    hat: p.hat,
    hair: p.hair,
    legs: p.trousers,
    shorts: false,
    shoes: p.boots,
    scarf: p.scarf,
    stripes: p.stripes,
    sleeves: 'mitten',
  };
}

export const POSE_COUNT = POSES.length;
