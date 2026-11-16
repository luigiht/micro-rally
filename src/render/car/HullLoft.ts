import type { HullStation } from './CarHull';

/**
 * Dense hull stations from a few measured keyframes: every dimension runs
 * along the car on a monotone cubic through its keys (smooth, and never
 * overshooting a key, so a nose or a tail rounds off without bulging), and
 * stations are laid every `step` metres plus at every key and every extra
 * break. Each segment's flags (glass, screen, pillar paint) come from
 * `flags`, asked with the segment's ends, so windows and screens start and
 * stop exactly at their breaks. Pure, free of three.js.
 */

/** The station dimensions a loft interpolates. */
const FIELDS = [
  'floor',
  'sill',
  'belt',
  'roof',
  'xSill',
  'xBody',
  'xBelt',
  'xRoof',
  'crown',
  'bow',
] as const;
type Field = (typeof FIELDS)[number];

export type LoftKey = { z: number } & Partial<Record<Field, number>>;

/** Monotone cubic (Fritsch–Carlson) through `xs`/`ys`, held flat past the ends. */
export function monotone(xs: readonly number[], ys: readonly number[]): (x: number) => number {
  const n = xs.length;
  if (n === 1) return () => ys[0]!;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]!));
  const m: number[] = [d[0]!];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2);
  m.push(d[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const h = Math.hypot(a, b);
    if (h > 3) {
      m[i] = (3 * a * d[i]!) / h;
      m[i + 1] = (3 * b * d[i]!) / h;
    }
  }
  return (x) => {
    if (x <= xs[0]!) return ys[0]!;
    if (x >= xs[n - 1]!) return ys[n - 1]!;
    let i = 0;
    while (xs[i + 1]! < x) i++;
    const h = xs[i + 1]! - xs[i]!;
    const t = (x - xs[i]!) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i]! +
      (t3 - 2 * t2 + t) * h * m[i]! +
      (-2 * t3 + 3 * t2) * ys[i + 1]! +
      (t3 - t2) * h * m[i + 1]!
    );
  };
}

export interface LoftOptions {
  /** Longest gap between stations, m. */
  step: number;
  /** Extra stations (where windows, screens and pillars start and stop). */
  breaks?: readonly number[];
  /** The flags for the segment from `z0` to the next station `z1`. */
  flags?: (z0: number, z1: number) => Partial<HullStation>;
}

/**
 * Stations from `keys` (ascending z). Each field is interpolated through the
 * keys that give it; `floor`, `sill`, `belt`, `roof`, `xSill`, `xBody` and
 * `xRoof` must each be given by at least one key.
 */
export function loft(keys: readonly LoftKey[], options: LoftOptions): HullStation[] {
  const curves = {} as Record<Field, (z: number) => number>;
  for (const f of FIELDS) {
    const given = keys.filter((k) => k[f] !== undefined);
    if (given.length === 0) {
      if (f === 'crown' || f === 'bow') curves[f] = () => 0;
      else if (f === 'xBelt') curves[f] = (z) => curves.xBody(z);
      else throw new Error(`loft: no key gives ${f}`);
      continue;
    }
    curves[f] = monotone(
      given.map((k) => k.z),
      given.map((k) => k[f]!),
    );
  }
  const z0 = keys[0]!.z;
  const z1 = keys[keys.length - 1]!.z;
  const at = new Set<number>();
  const add = (z: number) => {
    if (z >= z0 - 1e-6 && z <= z1 + 1e-6) at.add(Math.round(z * 1e4) / 1e4);
  };
  for (const k of keys) add(k.z);
  for (const b of options.breaks ?? []) add(b);
  const fixed = [...at].sort((a, b) => a - b);
  const zs: number[] = [];
  for (let i = 0; i < fixed.length - 1; i++) {
    const a = fixed[i]!;
    const b = fixed[i + 1]!;
    const n = Math.max(1, Math.ceil((b - a) / options.step - 1e-9));
    for (let k = 0; k < n; k++) zs.push(a + ((b - a) * k) / n);
  }
  zs.push(fixed[fixed.length - 1]!);
  return zs.map((z, i) => {
    const s: HullStation = {
      z,
      floor: curves.floor(z),
      sill: curves.sill(z),
      belt: curves.belt(z),
      roof: curves.roof(z),
      xSill: curves.xSill(z),
      xBody: curves.xBody(z),
      xBelt: curves.xBelt(z),
      xRoof: curves.xRoof(z),
      crown: curves.crown(z),
      bow: curves.bow(z),
    };
    const next = zs[i + 1];
    return next === undefined ? s : { ...s, ...options.flags?.(z, next) };
  });
}
