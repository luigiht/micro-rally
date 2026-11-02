import type { CarSpec } from '@/game/vehicle/CarSpec';
import { NEON } from '../theme/WorldTheme';
import { wellsFor, type HullSpec, type HullStation } from './CarHull';

/**
 * The one Nightcity body, cut to whichever car the player is driving, in the
 * manner of the cyberpunk games' street machines: box flares over both axles
 * running to the bumpers with a pinched waist under the canopy, a blunt wide
 * nose under a long bonnet, a dark glass canopy set forward over the driver,
 * a long engine cover and a Kamm tail with a ducktail. Everything is sized
 * from the spec's axles, track, tyres and cabin offsets, so the wheels sit in
 * their wells on every catalogue car, the truck included. Neon is painted
 * into the hull (brow lines across the nose and tail, a shoulder line along
 * the flanks, a bonnet spine, vent slits in the bonnet and engine cover,
 * tail chevrons), all `glow` so `CarHullMesh` draws them unlit and HDR; the
 * light bars and the rest of the kit are parts in the body. Outside the
 * canopy the roof sits `LIP` over the belt, under the hull's cabin threshold,
 * so the glass lands on the canopy alone.
 */
export const NIGHTCITY_COLORS = {
  body: '#242837',
  trim: '#101218',
  /** Vents and intakes: the darkest tone, so they read as openings. */
  vent: '#07080c',
  steel: '#3a3f52',
  glass: '#0f1f2e',
  /** The canopy top: dark glass, so the cabin reads as a tinted dome. */
  roof: '#0d1824',
  rim: '#1a1c24',
  nose: NEON.cyan,
  tail: NEON.magenta,
  line: NEON.cyan,
  indicator: NEON.amber,
  accent: NEON.amber,
} as const;

/** The first-person eye in the root frame (`FirstPersonCameraRig` INTERIOR_VIEW plus the spec's cabin offsets). */
export function nightcityEye(spec: CarSpec): { x: number; y: number; z: number } {
  return { x: 0.34, y: 1.24 + spec.cabinDrop, z: spec.cabinForward - 0.15 };
}

/** Deck and bonnet height over the belt: under `CarHull`'s 5 cm cabin threshold, so these stations are not cabin. */
const LIP = 0.04;
/** How far the box flares stand out from the body between the wheels. */
const FLARE = 0.1;
/** The flares run this far past each tyre before blending into the waist. */
const FLARE_RUN = 0.35;
const FLARE_BLEND = 0.25;
/** The nose face narrows to this share of the body over its last half metre. */
const NOSE_FACE = 0.78;

export interface NightcityFrame {
  tail: number;
  nose: number;
  floor: number;
  sill: number;
  belt: number;
  /** Belt line at the nose, well below the main belt: the wedge. */
  noseBelt: number;
  roof: number;
  deck: number;
  /** Body half-width at the waist, and over the flares. */
  xBody: number;
  flare: number;
  xRoof: number;
  frontAxle: number;
  rearAxle: number;
  wheelRadius: number;
  scuttle: number;
  canopyFront: number;
  peak: number;
  rearGlass: number;
}

/** The key heights and lengths the body and its parts share, from the spec alone. */
export function nightcityFrame(spec: CarSpec): NightcityFrame {
  const r = spec.wheelRadius;
  const eye = nightcityEye(spec);
  const tail = -(spec.cgToRear + 1.9 * r);
  const nose = spec.cgToFront + 2.2 * r;
  const floor = 0.55 * r;
  const sill = floor + 0.25 * r;
  const belt = 2.4 * r + 0.05;
  // The canopy must clear the driver's eye, and stand a real cabin's height over the belt.
  const roof = Math.max(eye.y + 0.12, belt + 0.5);
  const xBody = spec.trackWidth / 2 + 0.11;
  const canopyFront = eye.z + 0.45;
  // The bonnet needs room for its wedge: on the cab-forward truck the scuttle moves back.
  const scuttle = Math.max(canopyFront + 0.2, Math.min(eye.z + 1.05, nose - 0.7));
  return {
    tail,
    nose,
    floor,
    sill,
    belt,
    noseBelt: belt - 0.3,
    roof,
    deck: belt + LIP,
    xBody,
    flare: xBody + FLARE,
    xRoof: Math.max(0.5, 0.62 * xBody),
    frontAxle: spec.cgToFront,
    rearAxle: -spec.cgToRear,
    wheelRadius: r,
    scuttle,
    canopyFront,
    peak: eye.z - 0.35,
    rearGlass: Math.max(eye.z - 1.0, tail + 0.6),
  };
}

/**
 * Flank half-width along the car: the flares over each axle, blending into
 * the waist between them, and the taper to the nose face. Parts on the
 * flanks seat themselves with this so nothing floats off the surface.
 */
export function sideAt(f: NightcityFrame, z: number): number {
  const r = f.wheelRadius;
  if (z >= f.nose - 0.5) {
    const t = Math.min(1, (z - (f.nose - 0.5)) / 0.5);
    return f.flare + (NOSE_FACE * f.xBody - f.flare) * t;
  }
  const rearEnd = f.rearAxle + r + FLARE_RUN;
  const frontStart = f.frontAxle - r - FLARE_RUN;
  const rear = z <= rearEnd ? 1 : Math.max(0, 1 - (z - rearEnd) / FLARE_BLEND);
  const front = z >= frontStart ? 1 : Math.max(0, 1 - (frontStart - z) / FLARE_BLEND);
  return f.xBody + FLARE * Math.max(rear, front);
}

export function nightcityHull(spec: CarSpec): HullSpec {
  const f = nightcityFrame(spec);
  const K = NIGHTCITY_COLORS;
  const st = (
    z: number,
    belt: number,
    roof: number,
    xRoof: number,
    extra: Partial<HullStation> = {},
  ): HullStation => {
    const side = sideAt(f, z);
    return {
      z,
      floor: f.floor,
      sill: f.sill,
      belt,
      roof,
      xSill: side - 0.06,
      xBody: side,
      xBelt: side + 0.03,
      xRoof: Math.min(xRoof, side - 0.04),
      ...extra,
    };
  };
  const bonnetDrop = 0.12;
  const xb = f.xBody;
  return {
    wells: wellsFor(spec),
    colors: {
      body: K.body,
      trim: K.trim,
      glass: K.glass,
      roof: K.roof,
      // A thin accent pinstripe under the belt crease over the dark skirt.
      stripe: [K.accent, K.trim, K.trim],
    },
    stripeBand: [0.16, 0.02],
    stations: [
      // Kamm tail: the deck steps down at the very edge, then rises into a ducktail.
      st(f.tail, f.belt - 0.04, f.belt, f.flare - 0.12),
      st(f.tail + 0.3, f.belt + 0.07, f.belt + 0.07 + LIP, f.flare - 0.14),
      // Rear glass rises from the engine cover to the canopy peak.
      st(f.rearGlass, f.belt, f.deck, f.flare - 0.16, { glass: true }),
      st(f.peak, f.belt, f.roof, f.xRoof, { glass: true }),
      st(f.canopyFront, f.belt, f.roof - 0.04, f.xRoof + 0.02, { glass: true }),
      // Scuttle, then the long bonnet falls to a low, wide, blunt nose.
      st(f.scuttle, f.belt - 0.02, f.belt - 0.02 + LIP, f.flare - 0.14),
      st(f.nose - 0.5, f.belt - bonnetDrop, f.belt - bonnetDrop + LIP, f.flare - 0.16),
      st(f.nose - 0.2, f.noseBelt + 0.1, f.noseBelt + 0.1 + LIP, xb * 0.72),
      st(f.nose, f.noseBelt, f.noseBelt + LIP, xb * 0.62, { xSill: xb * 0.62 }),
    ],
    // Brow lines across the top edge of the nose and tail panels.
    capDecals: [
      {
        end: 'nose',
        x0: -2,
        x1: 2,
        y0: f.noseBelt,
        y1: f.noseBelt + LIP,
        color: K.nose,
        glow: true,
      },
      { end: 'tail', x0: -2, x1: 2, y0: f.belt - 0.04, y1: f.belt, color: K.tail, glow: true },
    ],
    // A shoulder light line along the engine cover and bonnet sides (the canopy's sides are glass and skipped).
    sideDecals: [{ z0: f.tail, z1: f.nose, u0: 0, u1: 0.6, color: K.line, glow: true }],
    deck: [
      // Bonnet: a raised-looking centre panel, two vents with amber slits, the lit spine.
      { x0: -0.26 * xb, x1: 0.26 * xb, z0: f.scuttle + 0.1, z1: f.nose - 0.3, color: '#1e2230' },
      {
        x0: 0.3 * xb,
        x1: 0.62 * xb,
        z0: f.scuttle + 0.22,
        z1: f.scuttle + 0.5,
        color: K.vent,
        mirror: true,
      },
      {
        x0: 0.33 * xb,
        x1: 0.59 * xb,
        z0: f.scuttle + 0.28,
        z1: f.scuttle + 0.31,
        color: K.accent,
        glow: true,
        mirror: true,
      },
      {
        x0: 0.33 * xb,
        x1: 0.59 * xb,
        z0: f.scuttle + 0.38,
        z1: f.scuttle + 0.41,
        color: K.accent,
        glow: true,
        mirror: true,
      },
      { x0: -0.04, x1: 0.04, z0: f.scuttle + 0.15, z1: f.nose - 0.25, color: K.line, glow: true },
      // Engine cover: a dark panel with three magenta slits, chevrons at the tail corners.
      { x0: -0.4 * xb, x1: 0.4 * xb, z0: f.tail + 0.38, z1: f.rearGlass - 0.08, color: '#1a1d29' },
      ...[0, 1, 2].map((i) => ({
        x0: -0.34 * xb,
        x1: 0.34 * xb,
        z0: f.tail + 0.46 + i * 0.11,
        z1: f.tail + 0.49 + i * 0.11,
        color: K.tail,
        glow: true,
      })),
      {
        x0: 0.5 * xb,
        x1: 0.8 * xb,
        z0: f.tail + 0.1,
        z1: f.tail + 0.2,
        color: K.tail,
        glow: true,
        mirror: true,
      },
      // Roof: a dark panel strip down the canopy centre.
      { x0: -0.12, x1: 0.12, z0: f.peak - 0.1, z1: f.canopyFront - 0.1, color: '#0a1420' },
    ],
  };
}
