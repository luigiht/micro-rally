export type CarId = 'hatchback' | 'coupe' | 'pickup' | 'monster';

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
  tyreGrip: 1,
  corneringFront: 9,
  corneringRear: 9.5,
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

export const CAR_SPECS: Readonly<Record<CarId, CarSpec>> = {
  hatchback: { ...BASE, id: 'hatchback' },
  coupe: {
    ...BASE,
    id: 'coupe',
    mass: 1050,
    cgToFront: 1.05,
    cgToRear: 1.15,
    cgHeight: 0.48,
    trackWidth: 1.56,
    wheelRadius: 0.33,
    peakTorque: 270,
    dragCoeff: 0.65,
    frontDrive: 0,
    tyreGrip: 1.04,
    corneringRear: 8,
    yawInertiaScale: 1.3,
    maxSteer: 0.5,
    stability: 0.3,
    cabinDrop: -0.12,
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
    tyreGrip: 1.12,
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
    tyreGrip: 1.15,
    corneringRear: 9,
    brakeDecel: 10,
    stability: 0.6,
    aeroGrip: 0.05,
  },
};
