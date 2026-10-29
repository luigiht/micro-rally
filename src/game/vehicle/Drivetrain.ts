import type { CarSpec } from './CarSpec';

const RPM_PER_RAD_S = 60 / (2 * Math.PI);
export const REVERSE_GEAR = -1;

/** Engine torque (Nm) at full throttle; zero past the rev limiter. */
export function torqueAt(spec: CarSpec, rpm: number): number {
  if (rpm > spec.redlineRpm) return 0;
  const f = Math.max(0, rpm / spec.redlineRpm);
  const curve = spec.torqueCurve;
  for (let i = 1; i < curve.length; i++) {
    const b = curve[i]!;
    if (f <= b[0]) {
      const a = curve[i - 1]!;
      const t = (f - a[0]) / (b[0] - a[0]);
      return spec.peakTorque * (a[1] + (b[1] - a[1]) * t);
    }
  }
  return spec.peakTorque * curve[curve.length - 1]![1];
}

export function gearRatio(spec: CarSpec, gear: number): number {
  if (gear === REVERSE_GEAR) return spec.reverseRatio;
  return spec.gearRatios[gear - 1] ?? spec.gearRatios[0]!;
}

/** Engine rpm locked to the wheels for a given road speed and gear. */
export function wheelLockedRpm(spec: CarSpec, speed: number, gear: number): number {
  const wheelRadS = Math.abs(speed) / spec.wheelRadius;
  return wheelRadS * gearRatio(spec, gear) * spec.finalDrive * RPM_PER_RAD_S;
}

/** Forward drive force (N) at the contact patch for engine rpm, gear and throttle. */
export function driveForce(spec: CarSpec, rpm: number, gear: number, throttle: number): number {
  const ratio = gearRatio(spec, gear) * spec.finalDrive;
  return (torqueAt(spec, rpm) * throttle * ratio * spec.drivetrainEfficiency) / spec.wheelRadius;
}

/** Automatic gearbox: returns the gear to use (forward gears only). */
export function autoShift(spec: CarSpec, speed: number, gear: number): number {
  if (gear < 1) return gear;
  const upRpm = spec.redlineRpm * spec.shiftUpFraction;
  const rpm = wheelLockedRpm(spec, speed, gear);
  if (rpm > upRpm && gear < spec.gearRatios.length) return gear + 1;
  if (
    gear > 1 &&
    rpm < spec.redlineRpm * 0.45 &&
    wheelLockedRpm(spec, speed, gear - 1) < upRpm * 0.72
  ) {
    return gear - 1;
  }
  return gear;
}
