import type { CarId } from '@/game/vehicle/CarSpec';

/**
 * Per-car cabin: envelope, kit and palette. Dimensions are in the interior
 * frame, which sits `0.1 + cabinDrop` above and `cabinForward` ahead of the
 * root, so a hull height h maps to `h − 0.1 − cabinDrop` and a hull z to
 * `z − cabinForward`. The first-person eye is always at `EYE` in this frame.
 */
export const EYE = { x: 0.34, y: 1.14, z: -0.15 } as const;

export type DashStyle = 'period' | 'analogue' | 'digital';
export type LeverStyle = 'h' | 'sequential';

export interface InteriorPalette {
  dash: string;
  lining: string;
  door: string;
  cage: string;
  seat: string;
  seatAccent: string;
  harness: string;
  wheel: string;
  accent: string;
}

export interface InteriorSpec {
  /** Inner wall half-width. */
  halfWidth: number;
  roofY: number;
  floorY: number;
  /** Top of the dash; the cowl / screen base sits at `cowlZ`. */
  dashTopY: number;
  cowlZ: number;
  /**
   * Height of the hull's screen base (its belt at the cowl station). Where it
   * sits above `dashTopY` a scuttle ledge closes the gap, otherwise the engine
   * bay shows through the back-face-culled shell.
   */
  cowlY: number;
  /** Lift of the instrument binnacle above the dash top: deep truck dashes mount it high, a negative value sinks it. */
  clusterRise: number;
  /** How far the binnacle sits toward the cowl from its usual spot just behind the dash face. */
  clusterForward: number;
  /** Where the roof lining starts over the screen. */
  screenTopZ: number;
  /** Rear bulkhead or rear glass base. */
  rearZ: number;
  /** Co-driver seat centre (the driver sits at `EYE.x`). */
  coDriverX: number;
  wheelRadius: number;
  wheelRake: number;
  /** Hub position; the rim has to clear the binnacle hood ahead of it (see the interior tests). */
  wheelZ: number;
  wheelY: number;
  dash: DashStyle;
  lever: LeverStyle;
  fullCage: boolean;
  tripMeter: boolean;
  extinguisher: boolean;
  /** Rally-raid centre console with its gauge pod and the outboard tyre-pressure block (see `RaidKit`). */
  raidKit: boolean;
  /** Wiper arms parked across the screen. */
  wipers: boolean;
  palette: InteriorPalette;
}

const BLACK = '#2b2a33';
const GREY = '#5a5a63';
const LINING = '#d9d4c7';

const DEFAULTS: Omit<InteriorSpec, 'palette' | 'wheelY' | 'wheelZ'> = {
  halfWidth: 0.8,
  roofY: 1.36,
  floorY: 0.805,
  dashTopY: 0.99,
  cowlZ: 0.85,
  cowlY: 0.8,
  clusterRise: 0,
  clusterForward: 0,
  screenTopZ: 0.45,
  rearZ: -1.15,
  coDriverX: -EYE.x,
  wheelRadius: 0.17,
  wheelRake: 0.35,
  dash: 'analogue',
  lever: 'h',
  fullCage: true,
  tripMeter: true,
  extinguisher: true,
  raidKit: false,
  wipers: false,
};

/** Fill a cabin from the defaults; unless placed, the hub sits 9 cm under the dash top and 37 cm ahead of the eye. */
const base = (over: Partial<InteriorSpec> & { palette: InteriorPalette }): InteriorSpec => {
  const merged = { ...DEFAULTS, ...over };
  return {
    ...merged,
    wheelZ: over.wheelZ ?? 0.22,
    wheelY: over.wheelY ?? merged.dashTopY - 0.09,
  };
};

/** Starter hatch: a converted road car — grey cage, cloth seats, two dials, basic kit. */
const HATCHBACK = base({
  fullCage: false,
  tripMeter: false,
  palette: {
    dash: BLACK,
    lining: LINING,
    door: GREY,
    cage: '#8f8c86',
    seat: '#4a4650',
    seatAccent: '#e8623a',
    harness: '#2d5bd1',
    wheel: BLACK,
    accent: '#e8623a',
  },
});

export const INTERIORS: Readonly<Record<CarId, InteriorSpec>> = {
  hatchback: HATCHBACK,
  pickup: HATCHBACK,
  monster: HATCHBACK,
  /** 1970s wedge: tiny low cabin, white cage, tan lining, three period dials, red harness. */
  coupe: base({
    halfWidth: 0.72,
    roofY: 1.31,
    dashTopY: 1.02,
    cowlZ: 0.62,
    cowlY: 1.04,
    screenTopZ: 0.2,
    rearZ: -0.5,
    // Short dash: the wheel comes back to 0.23 m from the eye and the binnacle sinks so the rim passes above it.
    wheelRadius: 0.165,
    wheelZ: 0.08,
    clusterRise: -0.03,
    dash: 'period',
    palette: {
      dash: BLACK,
      lining: '#c9b48a',
      door: BLACK,
      cage: '#f4f1ea',
      seat: '#1f1e24',
      seatAccent: '#d9343a',
      harness: '#d9343a',
      wheel: BLACK,
      accent: '#157f4a',
    },
  }),
  /** Mid-engined 80s hatch: grey dash, white cage, blue seats with yellow harness. */
  t16: base({
    halfWidth: 0.72,
    roofY: 1.35,
    dashTopY: 0.98,
    cowlZ: 0.8,
    cowlY: 1.0,
    screenTopZ: 0.35,
    rearZ: -0.75,
    palette: {
      dash: GREY,
      lining: '#9a9a9a',
      door: '#1e5fb4',
      cage: '#f4f1ea',
      seat: '#1e5fb4',
      seatAccent: '#f2c230',
      harness: '#f2c230',
      wheel: BLACK,
      accent: '#d7262c',
    },
  }),
  /** Late-90s saloon: blue cage, digital dash, sequential lever, yellow harness. */
  saloon: base({
    halfWidth: 0.74,
    roofY: 1.32,
    dashTopY: 0.95,
    cowlZ: 0.85,
    cowlY: 1.04,
    screenTopZ: 0.25,
    rearZ: -1.6,
    dash: 'digital',
    lever: 'sequential',
    palette: {
      dash: BLACK,
      lining: '#3a3944',
      door: BLACK,
      cage: '#1c3fa8',
      seat: '#1f1e24',
      seatAccent: '#f2d43a',
      harness: '#f2d43a',
      wheel: '#1f1e24',
      accent: '#f2d43a',
    },
  }),
  /** Turn-of-the-century WRC hatch: navy cage, red seats, sky-blue harness, digital dash. */
  wrc: base({
    halfWidth: 0.88,
    roofY: 1.35,
    cowlZ: 1.05,
    cowlY: 0.82,
    screenTopZ: 0.55,
    rearZ: -1.25,
    dash: 'digital',
    lever: 'sequential',
    palette: {
      dash: BLACK,
      lining: '#6b6a72',
      door: '#1f2a7a',
      cage: '#1f2a7a',
      seat: '#e02a2a',
      seatAccent: '#f4f1ea',
      harness: '#5aa0e0',
      wheel: '#1f1e24',
      accent: '#5aa0e0',
    },
  }),
  /** Group B mid-engined: bare black cabin, grey cage, red seats, three dials. */
  groupb: base({
    roofY: 1.33,
    dashTopY: 1.0,
    cowlZ: 0.95,
    cowlY: 0.86,
    screenTopZ: 0.55,
    rearZ: -1.05,
    dash: 'period',
    palette: {
      dash: BLACK,
      lining: BLACK,
      door: BLACK,
      cage: '#8f8c86',
      seat: '#d9343a',
      seatAccent: '#1f1e24',
      harness: '#1f1e24',
      wheel: BLACK,
      accent: '#f4f1ea',
    },
  }),
  /** Group B coupé: white cage, grey seats with a yellow stripe, red harness, period dials. */
  s1: base({
    halfWidth: 0.75,
    roofY: 1.33,
    dashTopY: 1.02,
    cowlZ: 0.95,
    cowlY: 0.94,
    screenTopZ: 0.42,
    rearZ: -1.6,
    dash: 'period',
    palette: {
      dash: BLACK,
      lining: '#8a8d93',
      door: '#8a8d93',
      cage: '#f4f1ea',
      seat: '#8a8d93',
      seatAccent: '#f2c230',
      harness: '#d7262c',
      wheel: BLACK,
      accent: '#f2c230',
    },
  }),
  /** Mid-2000s WRC hatch: blue cage, black seats with lime harness, digital dash. */
  focus: base({
    halfWidth: 0.82,
    roofY: 1.35,
    cowlZ: 1.05,
    cowlY: 0.82,
    screenTopZ: 0.55,
    rearZ: -1.55,
    dash: 'digital',
    lever: 'sequential',
    palette: {
      dash: BLACK,
      lining: '#3a3944',
      door: BLACK,
      cage: '#1f3f9f',
      seat: '#1f1e24',
      seatAccent: '#8dc63f',
      harness: '#8dc63f',
      wheel: '#1f1e24',
      accent: '#8dc63f',
    },
  }),
  /**
   * Rally-raid truck: cab-over layout with the driver 0.8 m behind the screen
   * and 0.74 m above a floor the seats stand over on pedestals, a dark deep
   * dash with a raid console and gauge pod inboard and a tyre-pressure block
   * outboard, a big flat wheel 0.45 m ahead with its hub at the dash top and
   * its rim meeting the tall binnacle, whose display is read through the
   * upper half of the rim, and wipers parked across the screen. Orange cage,
   * co-driver far right.
   */
  dakar: base({
    halfWidth: 1.14,
    roofY: 1.65,
    floorY: 0.4,
    dashTopY: 0.84,
    cowlZ: 0.65,
    cowlY: 0.6,
    clusterRise: 0.075,
    clusterForward: 0.28,
    screenTopZ: 0.35,
    rearZ: -1.25,
    coDriverX: -0.76,
    wheelRadius: 0.24,
    wheelRake: 0.65,
    wheelZ: 0.3,
    wheelY: 0.85,
    dash: 'digital',
    raidKit: true,
    wipers: true,
    palette: {
      dash: BLACK,
      lining: '#5f5f66',
      door: '#3a3944',
      cage: '#f0741f',
      seat: '#1f1e24',
      seatAccent: '#f0741f',
      harness: '#f0741f',
      wheel: BLACK,
      accent: '#f0741f',
    },
  }),
};
