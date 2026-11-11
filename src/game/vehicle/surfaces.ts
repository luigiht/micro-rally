export type Surface = 'tarmac' | 'track' | 'gravel' | 'mud' | 'snow' | 'grass' | 'sand' | 'dune';

export interface SurfaceProps {
  /** Friction coefficient multiplier. */
  grip: number;
  /** Extra speed-proportional drag, in 1/s (force = mass * drag * v). */
  drag: number;
  /**
   * Extra grip on the rear axle only, on top of the built-in understeer bias;
   * omitted = 1. Above 1 the tail stays planted when braking into a corner
   * or turning in hard, so the car slides less.
   */
  rearGrip?: number;
}

export const SURFACES: Readonly<Record<Surface, SurfaceProps>> = {
  tarmac: { grip: 1.0, drag: 0.0 },
  /**
   * A circuit's race asphalt: a quarter more grip than a public road, and a
   * planted rear (braking into a corner no longer swings the tail out), so
   * the car corners harder and slides much less.
   */
  track: { grip: 1.25, drag: 0.0, rearGrip: 1.5 },
  gravel: { grip: 0.74, drag: 0.03 },
  grass: { grip: 0.62, drag: 0.12 },
  mud: { grip: 0.55, drag: 0.18 },
  snow: { grip: 0.42, drag: 0.05 },
  /** A packed-sand piste: a little looser than gravel. */
  sand: { grip: 0.66, drag: 0.06 },
  /** Soft sand off the piste: the car wallows. */
  dune: { grip: 0.5, drag: 0.2 },
};

export const SURFACE_LIST: readonly Surface[] = [
  'tarmac',
  'gravel',
  'grass',
  'mud',
  'snow',
  'sand',
  'dune',
  // Appended, so the surface indices replays already store keep their meaning.
  'track',
];
