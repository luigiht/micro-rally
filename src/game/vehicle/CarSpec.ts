export type CarId =
  | 'hatchback'
  | 'coupe'
  | 't16'
  | 'saloon'
  | 'wrc'
  | 'groupb'
  | 's1'
  | 'focus'
  | 'dakar'
  | 'lemans'
  | 'buggy'
  | 'pickup'
  | 'monster';

/** Tunable physics parameters for one car (SI units). */
export interface CarSpec {
  id: CarId;
  mass: number;
  cgToFront: number;
  cgToRear: number;
  cgHeight: number;
  trackWidth: number;
  /** Yaw inertia = mass * yawInertiaScale. */
  yawInertiaScale: number;
  wheelRadius: number;
  /** Steering lock at standstill, radians. */
  maxSteer: number;
  /** Speed (m/s) at which steering lock is halved. */
  steerFalloffSpeed: number;
  peakTorque: number;
  idleRpm: number;
  redlineRpm: number;
  /** [rpm / redline, torque / peak] points, ascending. */
  torqueCurve: readonly (readonly [number, number])[];
  gearRatios: readonly number[];
  reverseRatio: number;
  finalDrive: number;
  drivetrainEfficiency: number;
  /** Upshift point as a fraction of redline. */
  shiftUpFraction: number;
  shiftTime: number;
  /** Fraction of drive torque sent to the front axle (0 RWD, 1 FWD). */
  frontDrive: number;
  tyreGrip: number;
  /** Cornering stiffness per radian, normalised by axle load. */
  corneringFront: number;
  corneringRear: number;
  brakeDecel: number;
  handbrakeRearGrip: number;
  dragCoeff: number;
  rollingResistance: number;
  /** Spring rate per kg (1/s²). */
  suspensionStiffness: number;
  /** Damper rate per kg (1/s). */
  suspensionDamping: number;
  /** 0..1, how much load (and grip) variation over bumps is filtered out. */
  stability: number;
  /** Extra drive force fraction while boosting; 0 = no turbo fitted. */
  turboForce: number;
  turboDuration: number;
  turboRecharge: number;
  /** Grip gain per (m/s)² / 1000 from downforce. */
  aeroGrip: number;
  /** Visual only: how much lower this car's cabin (and first-person eye) sits than the hatchback's. */
  cabinDrop: number;
  /** Visual only: how far forward the cabin (and first-person eye) sits relative to the hatchback's. */
  cabinForward: number;
  /** Visual only: how much bigger the body is than a car's, so chase and showroom cameras stand further back. */
  bodyScale: number;
}

const BASE: Omit<CarSpec, 'id'> = {
  mass: 1000,
  cgToFront: 1.2,
  cgToRear: 1.3,
  cgHeight: 0.55,
  trackWidth: 1.5,
  yawInertiaScale: 1.6,
  wheelRadius: 0.32,
  maxSteer: 0.55,
  steerFalloffSpeed: 22,
  peakTorque: 200,
  idleRpm: 900,
  redlineRpm: 7000,
  torqueCurve: [
    [0, 0.55],
    [0.3, 0.8],
    [0.6, 1.0],
    [0.8, 0.95],
    [1.0, 0.78],
  ],
  gearRatios: [3.3, 2.1, 1.5, 1.15, 0.92],
  reverseRatio: 3.2,
  finalDrive: 4.1,
  drivetrainEfficiency: 0.85,
  shiftUpFraction: 0.92,
  shiftTime: 0.18,
  frontDrive: 0.6,
  tyreGrip: 1.1,
  corneringFront: 14,
  corneringRear: 16,
  brakeDecel: 9,
  handbrakeRearGrip: 0.4,
  dragCoeff: 0.8,
  rollingResistance: 12,
  suspensionStiffness: 380,
  suspensionDamping: 22,
  stability: 0.4,
  turboForce: 0,
  turboDuration: 3,
  turboRecharge: 12,
  aeroGrip: 0.02,
  cabinDrop: 0,
  cabinForward: 0,
  bodyScale: 1,
};

/** Grip (tyres, cornering stiffness, stability, aero) is shared by every car in the dealership; they differ in mass, power, drag and drive split. */
export const CAR_SPECS: Readonly<Record<CarId, CarSpec>> = {
  hatchback: { ...BASE, id: 'hatchback' },
  /** Low 1970s wedge: 2.16 m wheelbase, 1.5 m track, rear-drive. */
  coupe: {
    ...BASE,
    id: 'coupe',
    mass: 980,
    cgToFront: 1.0,
    cgToRear: 1.16,
    cgHeight: 0.46,
    trackWidth: 1.5,
    wheelRadius: 0.288,
    peakTorque: 280,
    dragCoeff: 0.62,
    frontDrive: 0,
    yawInertiaScale: 1.25,
    maxSteer: 0.5,
    cabinDrop: -0.3,
  },
  /** Mid-engined Group B hatch: 2.42 m wheelbase, 1.5 m track, rear-biased 4WD, quick to rotate. */
  t16: {
    ...BASE,
    id: 't16',
    mass: 940,
    cgToFront: 1.27,
    cgToRear: 1.15,
    cgHeight: 0.46,
    trackWidth: 1.5,
    wheelRadius: 0.32,
    peakTorque: 330,
    dragCoeff: 0.72,
    frontDrive: 0.35,
    brakeDecel: 10,
    yawInertiaScale: 1.2,
    maxSteer: 0.52,
    turboForce: 0.25,
    turboDuration: 2.5,
    cabinDrop: -0.12,
  },
  /** Turbocharged all-wheel-drive saloon: 2.5 m wheelbase, planted and forgiving. */
  saloon: {
    ...BASE,
    id: 'saloon',
    mass: 1230,
    cgToFront: 1.25,
    cgToRear: 1.25,
    cgHeight: 0.5,
    trackWidth: 1.5,
    wheelRadius: 0.339,
    peakTorque: 400,
    dragCoeff: 0.72,
    frontDrive: 0.5,
    brakeDecel: 10,
    yawInertiaScale: 1.7,
    turboForce: 0.2,
    cabinDrop: -0.22,
  },
  /** Mid-engined Group B machine: 2.58 m wheelbase, huge power, lively tail. */
  groupb: {
    ...BASE,
    id: 'groupb',
    mass: 960,
    cgToFront: 1.24,
    cgToRear: 1.34,
    cgHeight: 0.47,
    trackWidth: 1.41,
    wheelRadius: 0.319,
    peakTorque: 450,
    dragCoeff: 0.7,
    frontDrive: 0.35,
    brakeDecel: 10.5,
    yawInertiaScale: 1.2,
    maxSteer: 0.5,
    turboForce: 0.35,
    turboDuration: 2.5,
    cabinDrop: -0.04,
  },
  /** Turn-of-the-century World Rally Car hatch: 2.615 m wheelbase, 1.55 m track, restricted turbo, 50/50 drive. */
  wrc: {
    ...BASE,
    id: 'wrc',
    mass: 1230,
    cgToFront: 1.3,
    cgToRear: 1.315,
    cgHeight: 0.48,
    trackWidth: 1.55,
    wheelRadius: 0.33,
    peakTorque: 430,
    dragCoeff: 0.7,
    frontDrive: 0.5,
    brakeDecel: 10.5,
    yawInertiaScale: 1.6,
    turboForce: 0.25,
    turboDuration: 3,
    cabinDrop: -0.02,
  },
  /** Short-wheelbase Group B coupé with box flares: 2.22 m wheelbase, the most powerful car in the shop. */
  s1: {
    ...BASE,
    id: 's1',
    mass: 1090,
    cgToFront: 1.1,
    cgToRear: 1.12,
    cgHeight: 0.48,
    trackWidth: 1.5,
    wheelRadius: 0.33,
    peakTorque: 470,
    dragCoeff: 0.78,
    frontDrive: 0.45,
    brakeDecel: 10.5,
    yawInertiaScale: 1.15,
    maxSteer: 0.5,
    turboForce: 0.4,
    turboDuration: 2.5,
    cabinDrop: -0.1,
  },
  /** Mid-2000s World Rally Car hatch: 2.64 m wheelbase, 1.55 m track, 50/50 drive, a touch more punch than the Riviera. */
  focus: {
    ...BASE,
    id: 'focus',
    mass: 1230,
    cgToFront: 1.3,
    cgToRear: 1.34,
    cgHeight: 0.47,
    trackWidth: 1.55,
    wheelRadius: 0.33,
    peakTorque: 445,
    dragCoeff: 0.68,
    frontDrive: 0.5,
    brakeDecel: 10.5,
    yawInertiaScale: 1.55,
    turboForce: 0.28,
    turboDuration: 3,
    cabinDrop: -0.02,
  },
  /**
   * Cab-over Dakar rally truck: 3.9 m wheelbase, 2.05 m track, 0.6 m tyres,
   * slow-revving diesel torque through all four wheels. Game-weight rather
   * than real (2.6 t), with a low yaw inertia and quick steering so it turns
   * in far better than its size suggests; the driver sits 2.5 m up. Grip is
   * the shared dealership setup.
   */
  dakar: {
    ...BASE,
    id: 'dakar',
    mass: 2600,
    cgToFront: 2.0,
    cgToRear: 1.9,
    cgHeight: 0.85,
    trackWidth: 2.05,
    yawInertiaScale: 1.5,
    wheelRadius: 0.6,
    maxSteer: 0.55,
    steerFalloffSpeed: 24,
    peakTorque: 1500,
    idleRpm: 600,
    redlineRpm: 2600,
    torqueCurve: [
      [0, 0.7],
      [0.3, 1.0],
      [0.6, 0.95],
      [0.8, 0.85],
      [1.0, 0.6],
    ],
    gearRatios: [4.2, 2.6, 1.7, 1.2, 0.9, 0.72],
    finalDrive: 4.8,
    frontDrive: 0.5,
    brakeDecel: 9.5,
    dragCoeff: 2.2,
    rollingResistance: 18,
    suspensionStiffness: 330,
    suspensionDamping: 22,
    turboForce: 0.2,
    turboDuration: 4,
    cabinDrop: 1.25,
    cabinForward: 2.1,
    bodyScale: 2.0,
  },
  /**
   * 1970 Le Mans coupé: 2.3 m wheelbase, 1.6 m track, 0.31 m tyres, 800 kg,
   * a big naturally aspirated flat engine on the rear axle through five
   * gears, stiff springs, very little drag and the lowest centre of gravity
   * in the shop. The driver sits far forward and low (eye 0.88 m up, 0.3 m
   * ahead of the axle midpoint). Grip is the shared dealership setup.
   */
  lemans: {
    ...BASE,
    id: 'lemans',
    mass: 800,
    cgToFront: 1.11,
    cgToRear: 1.19,
    cgHeight: 0.38,
    trackWidth: 1.6,
    yawInertiaScale: 1.35,
    wheelRadius: 0.31,
    maxSteer: 0.5,
    steerFalloffSpeed: 26,
    peakTorque: 560,
    idleRpm: 1200,
    redlineRpm: 8400,
    torqueCurve: [
      [0, 0.5],
      [0.3, 0.7],
      [0.65, 1.0],
      [0.85, 0.97],
      [1.0, 0.85],
    ],
    gearRatios: [2.9, 1.95, 1.45, 1.15, 0.95],
    finalDrive: 3.9,
    frontDrive: 0,
    brakeDecel: 11.5,
    dragCoeff: 0.45,
    rollingResistance: 10,
    suspensionStiffness: 520,
    suspensionDamping: 26,
    cabinDrop: -0.26,
    cabinForward: 0.45,
  },
  /**
   * Two-wheel-drive rally-raid buggy: 3.0 m wheelbase, 1.8 m track, 0.47 m
   * tyres on long-travel springs, a big naturally aspirated V8 driving the
   * rear axle alone. Light for its size (1.45 t) but tall and draggy, with
   * the soft suspension soaking up bumps; the body stands 0.1 m higher over
   * its wheels than a car's would (`BUGGY_LIFT`), so the driver sits mid-car
   * 0.21 m higher than in a hatch. Grip is the shared dealership setup.
   */
  buggy: {
    ...BASE,
    id: 'buggy',
    mass: 1450,
    cgToFront: 1.55,
    cgToRear: 1.45,
    cgHeight: 0.72,
    trackWidth: 1.8,
    yawInertiaScale: 1.45,
    wheelRadius: 0.47,
    maxSteer: 0.5,
    steerFalloffSpeed: 24,
    peakTorque: 520,
    idleRpm: 1000,
    redlineRpm: 6800,
    torqueCurve: [
      [0, 0.65],
      [0.3, 0.9],
      [0.55, 1.0],
      [0.8, 0.95],
      [1.0, 0.8],
    ],
    gearRatios: [3.4, 2.3, 1.7, 1.3, 1.05, 0.88],
    finalDrive: 4.3,
    frontDrive: 0,
    brakeDecel: 9.5,
    dragCoeff: 1.4,
    rollingResistance: 15,
    suspensionStiffness: 240,
    suspensionDamping: 20,
    cabinDrop: 0.21,
    cabinForward: -0.1,
    bodyScale: 1.25,
  },
  pickup: {
    ...BASE,
    id: 'pickup',
    mass: 1500,
    cgHeight: 0.75,
    trackWidth: 1.7,
    peakTorque: 280,
    finalDrive: 4.3,
    dragCoeff: 1.6,
    rollingResistance: 16,
    frontDrive: 0.5,
    tyreGrip: 1.23,
    brakeDecel: 8,
    yawInertiaScale: 1.9,
    stability: 0.7,
  },
  monster: {
    ...BASE,
    id: 'monster',
    mass: 1100,
    peakTorque: 380,
    finalDrive: 3.7,
    dragCoeff: 0.75,
    frontDrive: 0.45,
    tyreGrip: 1.27,
    corneringRear: 15,
    brakeDecel: 10,
    stability: 0.6,
    aeroGrip: 0.05,
  },
};
