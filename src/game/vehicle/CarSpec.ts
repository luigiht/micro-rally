export type CarId =
  'hatchback' | 'coupe' | 'saloon' | 'wrc' | 'groupb' | 's1' | 'pickup' | 'monster';

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
    cabinDrop: -0.1,
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
