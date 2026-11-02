import { describe, expect, it } from 'vitest';
import {
  EYE,
  INTERIORS,
  NIGHTCITY_INTERIOR_PALETTE,
  nightcityInterior,
  type InteriorSpec,
} from '@/components/game/interior/interiorSpecs';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { createVehiclePose, interpolatePose } from '@/game/vehicle/interpolatePose';
import { createVehicleState } from '@/game/vehicle/VehicleSim';

describe('interior specs', () => {
  it('give every car a cabin the driver fits in, with the dash ahead of the eye', () => {
    for (const id of Object.keys(CAR_SPECS) as (keyof typeof CAR_SPECS)[]) {
      const s = INTERIORS[id];
      expect(s, id).toBeDefined();
      // Headroom over the eye, the floor well below it, and the dash top under the eye line.
      expect(s.roofY, id).toBeGreaterThan(EYE.y + 0.08);
      expect(s.floorY, id).toBeLessThan(EYE.y - 0.25);
      expect(s.dashTopY, id).toBeLessThan(EYE.y);
      // Cowl ahead of the eye, header between them, bulkhead behind the seats.
      expect(s.cowlZ, id).toBeGreaterThan(s.screenTopZ);
      // The eye clears the screen base, and the binnacle never climbs into the eye line.
      expect(s.cowlY, id).toBeLessThan(EYE.y - 0.08);
      expect(s.dashTopY + s.clusterRise, id).toBeLessThan(EYE.y - 0.1);
      expect(s.screenTopZ, id).toBeGreaterThan(EYE.z);
      expect(s.rearZ, id).toBeLessThanOrEqual(-0.5);
      // Room for the driver's seat inboard of the wall, and the co-driver on the other side.
      expect(s.halfWidth, id).toBeGreaterThan(EYE.x + 0.25);
      expect(s.coDriverX, id).toBeLessThan(0);
      expect(-s.coDriverX, id).toBeLessThan(s.halfWidth - 0.2);
    }
  });

  it('vary across the dealership rather than sharing one cabin', () => {
    const cages = new Set(Object.values(INTERIORS).map((s) => s.palette.cage));
    const dashes = new Set(Object.values(INTERIORS).map((s) => s.dash));
    expect(cages.size).toBeGreaterThanOrEqual(4);
    expect(dashes.size).toBe(3);
    // The raid kit belongs to the truck alone.
    expect(INTERIORS.dakar.raidKit).toBe(true);
    expect(Object.values(INTERIORS).filter((s) => s.raidKit)).toHaveLength(1);
  });

  it('keep the rim clear of the binnacle hood and the hub ahead of and below the eye', () => {
    for (const id of Object.keys(CAR_SPECS) as (keyof typeof CAR_SPECS)[]) {
      const s = INTERIORS[id];
      const rimTopZ = s.wheelZ + (s.wheelRadius + 0.02) * Math.sin(s.wheelRake);
      const hoodRearZ = s.cowlZ + s.clusterForward - 0.44;
      expect(rimTopZ, id).toBeLessThan(hoodRearZ - 0.02);
      expect(s.wheelZ, id).toBeGreaterThan(EYE.z + 0.2);
      expect(s.wheelY, id).toBeLessThan(s.dashTopY + 0.05);
      // The dash has some depth and the binnacle hood stands on it, at most 5 cm proud of its face.
      expect(s.dashDepth, id).toBeGreaterThan(0.1);
      expect(hoodRearZ, id).toBeGreaterThanOrEqual(s.cowlZ - s.dashDepth - 0.05);
    }
  });

  it('arc the rim above the binnacle hood in the two close cockpits, the Stratos and the truck', () => {
    // Angle below the eye line at which a point appears from the driver's seat.
    const down = (y: number, z: number) => Math.atan2(EYE.y - y, z - EYE.z);
    const rimTop = (s: InteriorSpec) =>
      down(
        s.wheelY + s.wheelRadius * Math.cos(s.wheelRake),
        s.wheelZ + s.wheelRadius * Math.sin(s.wheelRake),
      );
    const hoodTop = (s: InteriorSpec) =>
      down(s.dashTopY - 0.01 + s.clusterRise + 0.072, s.cowlZ + s.clusterForward - 0.44);
    for (const id of ['coupe', 'dakar'] as const) {
      const s = INTERIORS[id];
      expect(rimTop(s), id).toBeLessThan(hoodTop(s) - 0.03);
    }
  });
});

describe('Nightcity cabin', () => {
  it('keeps every car its own envelope and kit and swaps only the palette, which glows', () => {
    for (const id of Object.keys(CAR_SPECS) as (keyof typeof CAR_SPECS)[]) {
      const day = INTERIORS[id];
      const night = nightcityInterior(day);
      const { palette: dayPalette, ...dayRest } = day;
      const { palette: nightPalette, ...nightRest } = night;
      expect(nightRest, id).toEqual(dayRest);
      expect(nightPalette).toBe(NIGHTCITY_INTERIOR_PALETTE);
      expect(dayPalette.glow).toBeUndefined();
    }
    const p = NIGHTCITY_INTERIOR_PALETTE;
    expect(p.glow).toBeGreaterThan(1);
    // Dark trim, neon accents: the accents are not the trim colours.
    for (const dark of [p.dash, p.lining, p.door, p.seat, p.wheel]) {
      expect(parseInt(dark.slice(1), 16)).toBeLessThan(0x202030);
    }
    expect(new Set([p.accent, p.harness, p.seatAccent]).size).toBeGreaterThanOrEqual(2);
  });
});

describe('pose cabin fields', () => {
  it('carries the current gear and turbo state through interpolation', () => {
    const prev = createVehicleState();
    const curr = createVehicleState();
    curr.gear = 4;
    curr.turboActive = true;
    const pose = interpolatePose(createVehiclePose(), prev, curr, 0.5);
    expect(pose.gear).toBe(4);
    expect(pose.turboActive).toBe(true);
  });
});
