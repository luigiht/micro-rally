export type Surface = 'tarmac' | 'gravel' | 'mud' | 'snow' | 'grass';

export interface SurfaceProps {
  /** Friction coefficient multiplier. */
  grip: number;
  /** Extra speed-proportional drag, in 1/s (force = mass * drag * v). */
  drag: number;
}

export const SURFACES: Readonly<Record<Surface, SurfaceProps>> = {
  tarmac: { grip: 1.0, drag: 0.0 },
  gravel: { grip: 0.74, drag: 0.03 },
  grass: { grip: 0.62, drag: 0.12 },
  mud: { grip: 0.55, drag: 0.22 },
  snow: { grip: 0.42, drag: 0.05 },
};

export const SURFACE_LIST: readonly Surface[] = ['tarmac', 'gravel', 'grass', 'mud', 'snow'];
