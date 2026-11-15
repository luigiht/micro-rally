/**
 * Lacets: the hairpin stacks of a Riviera mountain road (the Greenvale's
 * Monte Carlo passes). The walk (`buildCentreline`) turns off the stage axis
 * into a first leg across the hillside, doubles back up the slope in a
 * hairpin, runs a second leg back across, doubles back again in a second
 * hairpin the other way, runs a shorter third leg and turns back onto the
 * axis: a Z that climbs (or drops) four hairpin radii along the axis. Legs are
 * straight, every turn a circular arc laid as short chords, so the spline
 * through them never kinks.
 *
 * The ground is made to suit: across each stack the hills step up (or down)
 * by `rise` along the axis, so the legs stand one above the next on a real
 * hillside and the road climbs between them at a few per cent. Far out to
 * either side the step's line wanders and its slope eases, so it reads as
 * the flank of a mountain rather than a ruled terrace. Pure TS.
 */

/** A region's hairpin stacks. */
export interface LacetStyle {
  /** Road distance before which no stack starts, plus up to `span` more, and at least `between` from one stack's exit to the next's entry. */
  first: number;
  between: number;
  span: number;
  /** Hairpin radius on the centreline, metres: at least `RADIUS_MIN`, so stacked legs' corridors never meet. */
  radius: readonly [number, number];
  /** First and second leg length, metres. */
  leg: readonly [number, number];
  /** The hillside climbs (or falls) so the road gains about this grade from leg to leg. */
  grade: number;
}

/** One laid stack: the first leg's start, the stage axis, the side it climbs out to, its size and the hillside's step. */
export interface Lacet {
  x: number;
  z: number;
  axis: number;
  /** +1: the legs run out to the right of the axis (heading + π/2), −1 to the left. */
  side: 1 | -1;
  radius: number;
  leg: number;
  /** How far the ground steps across the stack; negative where the road drops through it. */
  rise: number;
  /** Where the turn off the axis starts and where the turn back onto it ends. */
  entry: { x: number; z: number };
  exit: { x: number; z: number };
}

/** A stack on the finished road: where along it the stack starts and ends. */
export interface StageLacet extends Lacet {
  from: number;
  to: number;
}

/**
 * Two stacked legs stand twice the radius apart, centre to centre; each
 * needs its half width, flat margin and banked blend (4.5 + 3 + 9 m) clear of
 * the other's, as the coast's stacks do.
 */
export const RADIUS_MIN = 17;
/** The turn off the axis into the first leg and back onto it after the last. */
const ENTRY_RADIUS = 26;
const EXIT_RADIUS = 28;
/** The third leg stops this much short of the others, so the turn back to the axis clears the first hairpin. */
const LAST_LEG_SHORT = 25;
/** Arcs are laid as chords no longer than this; straights pin a control this far inside each end. */
const CHORD = 5;
const PIN = 1;
const STEP = 20;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Lays straights and arcs as spline controls from a pose, counting the road it draws. */
export class Pen {
  length = 0;

  constructor(
    public x: number,
    public z: number,
    public h: number,
    private readonly out: number[],
  ) {}

  private push(x: number, z: number): void {
    this.x = x;
    this.z = z;
    this.out.push(x, z);
  }

  /** A circular arc turning `sweep` radians (positive turns the heading up) at `radius`. */
  arc(radius: number, sweep: number): void {
    const steps = Math.max(5, Math.ceil((radius * Math.abs(sweep)) / CHORD));
    const dA = sweep / steps;
    const chord = 2 * radius * Math.sin(Math.abs(dA) / 2);
    for (let k = 0; k < steps; k++) {
      this.push(
        this.x + Math.sin(this.h + dA / 2) * chord,
        this.z + Math.cos(this.h + dA / 2) * chord,
      );
      this.h += dA;
    }
    this.length += radius * Math.abs(sweep);
  }

  /** A straight `length` long, pinned a metre inside each end so the spline stays on its line up to the arcs. */
  straight(length: number): void {
    const sx = this.x;
    const sz = this.z;
    const at = (d: number) => this.push(sx + Math.sin(this.h) * d, sz + Math.cos(this.h) * d);
    const steps = Math.max(1, Math.round(length / STEP));
    if (length > 2 * PIN) at(PIN);
    for (let k = 1; k < steps; k++) at((length * k) / steps);
    if (length > 2 * PIN) at(length - PIN);
    at(length);
    this.length += length;
  }
}

/** How much road a stack of this radius and leg lays, entry and exit turns included (at most, for a right-angle entry). */
export function lacetLength(radius: number, leg: number): number {
  return (
    (ENTRY_RADIUS * Math.PI) / 2 +
    3 * leg -
    LAST_LEG_SHORT +
    2 * Math.PI * radius +
    (EXIT_RADIUS * Math.PI) / 2
  );
}

/**
 * Lay one stack with `pen` from its pose, off the stage `axis` to `side`:
 * the turn into the first leg, leg, hairpin, leg, hairpin, the short last leg
 * and the turn back onto the axis. Returns the stack's record for the ground.
 */
export function layLacet(
  pen: Pen,
  axis: number,
  side: 1 | -1,
  radius: number,
  leg: number,
  rise: number,
): Lacet {
  const across = axis + (side * Math.PI) / 2;
  const entry = { x: pen.x, z: pen.z };
  pen.arc(ENTRY_RADIUS, wrap(across - pen.h));
  const start = { x: pen.x, z: pen.z };
  pen.straight(leg);
  // Each hairpin turns back through the axis direction, so the stack climbs along it.
  pen.arc(radius, -side * Math.PI);
  pen.straight(leg);
  pen.arc(radius, side * Math.PI);
  pen.straight(leg - LAST_LEG_SHORT);
  pen.arc(EXIT_RADIUS, wrap(axis - pen.h));
  pen.h = axis;
  return { ...start, axis, side, radius, leg, rise, entry, exit: { x: pen.x, z: pen.z } };
}

/** The step's rise for a stack laid with this radius and leg at `grade` from leg to leg (its sign is the caller's). */
export function lacetRise(radius: number, leg: number, grade: number): number {
  // Leg to leg the step climbs about 0.47 of its height over a leg and a hairpin of road.
  return (grade * (leg + Math.PI * radius)) / 0.47;
}

/** Past the stack's own span the step's line wanders this far along the axis, over this lateral wavelength. */
const WANDER = 60;
const WANDER_LENGTH = 170;
/** And its slope eases out to this many times as long, this far to either side. */
const EASE = 2.2;
const EASE_OVER = 220;

function hash01(k: number, salt: number): number {
  let h = Math.imul(k ^ Math.imul(salt, 0x9e3779b9), 374761393);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth −1..1 noise along a line. */
function lineNoise(t: number, salt: number): number {
  const k = Math.floor(t);
  const f = t - k;
  const a = hash01(k, salt);
  return (a + (hash01(k + 1, salt) - a) * (f * f * (3 - 2 * f))) * 2 - 1;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * The ground's step at (x, z) from every stack: across the stack the hills
 * rise smoothly from before the first leg to past the third (legs at about
 * 4 %, 50 % and 96 % of the way up); beyond its ends the step's line wanders
 * and its slope eases out.
 */
export function lacetGround(lacets: readonly Lacet[] | undefined, x: number, z: number): number {
  if (!lacets) return 0;
  let sum = 0;
  for (let i = 0; i < lacets.length; i++) {
    const l = lacets[i]!;
    const dx = x - l.x;
    const dz = z - l.z;
    const sa = Math.sin(l.axis);
    const ca = Math.cos(l.axis);
    const u = dx * sa + dz * ca;
    const w = l.side * (dx * ca - dz * sa);
    const r = l.radius;
    // Lateral distance outside the stack's own span (the hairpins bulge a radius past the legs).
    const off = Math.max(0, w - (l.leg + 2 * r), -2 * r - w);
    const out = smoothstep(0, EASE_OVER, off);
    const shift = WANDER * lineNoise(w / WANDER_LENGTH, 31 + i * 7) * smoothstep(0, 120, off);
    const half = 2.6 * r * (1 + (EASE - 1) * out);
    const mid = 2 * r + shift;
    sum += l.rise * smoothstep(mid - half, mid + half, u);
  }
  return sum;
}
