/** Box-filter half window (samples) for smoothing the road profile, and the steepest grade the road takes. */
const SMOOTH_WINDOW = 15;
const MAX_GRADE = 0.12;

/**
 * The road profile from the ground under each sample: two box-filter passes
 * (about a gaussian) and a grade limit run both ways. On a closed lap the
 * windows and the limiter wrap round the seam (the last sample repeats the
 * first), twice round so a limit set near the seam carries all the way, and
 * the profile meets itself without a step. Pure TS.
 */
export function smoothRoadProfile(
  raw: Float64Array,
  spacing: number,
  closed: boolean,
): Float64Array {
  const count = raw.length;
  const n = closed ? count - 1 : count;
  const at = (k: number) => (closed ? ((k % n) + n) % n : k);
  let a = raw;
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float64Array(count);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      let m = 0;
      for (let k = i - SMOOTH_WINDOW; k <= i + SMOOTH_WINDOW; k++) {
        if (closed || (k >= 0 && k < count)) {
          sum += a[at(k)]!;
          m++;
        }
      }
      b[i] = sum / m;
    }
    a = b;
  }
  const step = MAX_GRADE * spacing;
  const rounds = closed ? 2 : 1;
  for (let r = 0; r < rounds; r++) {
    for (let i = 1; i < (closed ? n + 1 : count); i++) {
      const p = a[at(i - 1)]!;
      a[at(i)] = Math.min(p + step, Math.max(p - step, a[at(i)]!));
    }
    for (let i = (closed ? n : count) - 2; i >= (closed ? -1 : 0); i--) {
      const p = a[at(i + 1)]!;
      a[at(i)] = Math.min(p + step, Math.max(p - step, a[at(i)]!));
    }
  }
  if (closed) a[count - 1] = a[0]!;
  return a;
}
