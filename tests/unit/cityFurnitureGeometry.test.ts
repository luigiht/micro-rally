import { type BufferAttribute, type BufferGeometry, Color, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  benchGeometry,
  binGeometry,
  bollardGeometry,
  hydrantGeometry,
  manholeGeometry,
  trafficLensGlowGeometry,
  trafficLightGeometry,
  treePitGeometry,
} from '@/render/scenery/CityFurnitureGeometry';
import {
  PARKED_CAR_MODELS,
  parkedCarBodyGeometry,
  parkedCarLightsGeometry,
} from '@/render/scenery/CityVehicleGeometry';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';

/** Every kit is merged from BoxGeometry parts: 8 corners, 12 triangles, 36 non-indexed vertices each. */
const BOX_VERTICES = 36;
const TOLERANCE = 0.05;

type Attribute = BufferAttribute;

function extents(geo: BufferGeometry) {
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  return {
    w: b.max.x - b.min.x,
    h: b.max.y - b.min.y,
    d: b.max.z - b.min.z,
    min: b.min,
    max: b.max,
  };
}

function hasColor(geo: BufferGeometry, hex: string): boolean {
  const col = geo.getAttribute('color') as Attribute;
  const c = new Color(hex);
  for (let i = 0; i < col.count; i++)
    if (
      Math.abs(col.getX(i) - c.r) < 1e-3 &&
      Math.abs(col.getY(i) - c.g) < 1e-3 &&
      Math.abs(col.getZ(i) - c.b) < 1e-3
    )
      return true;
  return false;
}

/** Fraction of triangles wound away from the centroid of their own box; checks every part is a box with matching normals. */
function outwardFraction(geo: BufferGeometry): number {
  const pos = geo.getAttribute('position') as Attribute;
  const nor = geo.getAttribute('normal') as Attribute;
  expect(pos.count % BOX_VERTICES).toBe(0);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  const centre = new Vector3();
  const mid = new Vector3();
  const stored = new Vector3();
  let outward = 0;
  for (let start = 0; start < pos.count; start += BOX_VERTICES) {
    const corners = new Set<string>();
    centre.set(0, 0, 0);
    for (let i = start; i < start + BOX_VERTICES; i++) {
      a.fromBufferAttribute(pos, i);
      corners.add(`${a.x.toFixed(4)},${a.y.toFixed(4)},${a.z.toFixed(4)}`);
      centre.add(a);
    }
    expect(corners.size, `part ${start / BOX_VERTICES} is a box`).toBe(8);
    centre.divideScalar(BOX_VERTICES);
    for (let t = start; t < start + BOX_VERTICES; t += 3) {
      a.fromBufferAttribute(pos, t);
      b.fromBufferAttribute(pos, t + 1);
      c.fromBufferAttribute(pos, t + 2);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      const winding = ab.cross(ac);
      stored.fromBufferAttribute(nor, t);
      expect(winding.dot(stored), `face ${t / 3} winding matches its normal`).toBeGreaterThan(0);
      mid.copy(a).add(b).add(c).divideScalar(3).sub(centre);
      if (winding.dot(mid) > 0) outward++;
    }
  }
  return outward / (pos.count / 3);
}

describe('CityFurnitureGeometry', () => {
  const kits = {
    trafficLight: trafficLightGeometry(),
    lens: trafficLensGlowGeometry(),
    bench: benchGeometry(),
    bin: binGeometry(),
    hydrant: hydrantGeometry(),
    bollard: bollardGeometry(),
    treePit: treePitGeometry(),
    manhole: manholeGeometry(),
  };

  it('builds non-indexed, vertex-coloured box kits with matching attribute counts, every face outward', () => {
    for (const [name, geo] of Object.entries(kits)) {
      expect(geo.index, name).toBeNull();
      const pos = geo.getAttribute('position');
      expect(pos.count, name).toBeGreaterThanOrEqual(BOX_VERTICES);
      expect(geo.getAttribute('normal').count, name).toBe(pos.count);
      expect(geo.getAttribute('color').count, name).toBe(pos.count);
      expect(outwardFraction(geo), name).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('paints no part pure white, so instance tints leave the furniture its paint', () => {
    for (const [name, geo] of Object.entries(kits))
      expect(hasColor(geo, '#ffffff'), name).toBe(false);
  });

  it('stands each piece on the ground at its brief size, facing -z', () => {
    const light = extents(kits.trafficLight);
    expect(light.min.y).toBeCloseTo(0, 5);
    expect(light.h).toBeCloseTo(3.4, 1);
    expect(light.min.z).toBeLessThan(-0.2);
    const bench = extents(kits.bench);
    expect(bench.w).toBeCloseTo(1.8, 1);
    expect(bench.h).toBeLessThanOrEqual(0.9 + TOLERANCE);
    expect(extents(kits.treePit).h).toBeLessThanOrEqual(0.12 + TOLERANCE);
    expect(extents(kits.manhole).max.y).toBeLessThanOrEqual(0.03 + 1e-6);
    expect(extents(kits.bollard).h).toBeCloseTo(0.9, 1);
    for (const geo of Object.values(kits)) geo.dispose();
  });
});

describe('CityVehicleGeometry', () => {
  it.each(PARKED_CAR_MODELS)(
    'builds the %s hull in white with round wheels on the ground, nose at +z',
    (model) => {
      const body = parkedCarBodyGeometry(model);
      const lights = parkedCarLightsGeometry(model);
      const spec = CAR_SPECS[model];
      for (const geo of [body, lights]) {
        expect(geo.index).toBeNull();
        const pos = geo.getAttribute('position');
        expect(geo.getAttribute('normal').count).toBe(pos.count);
        expect(geo.getAttribute('color').count).toBe(pos.count);
      }
      // The hull takes the tint; the wheels and glass keep their colours.
      expect(hasColor(body, '#ffffff')).toBe(true);
      expect(hasColor(body, '#2b2a33')).toBe(true);
      expect(hasColor(lights, '#ffffff')).toBe(false);
      const b = extents(body);
      expect(b.min.y).toBeCloseTo(0, 3);
      expect(b.d).toBeGreaterThan(3.8);
      expect(b.d).toBeLessThan(4.4);
      expect(b.w).toBeLessThan(spec.trackWidth + 0.8);
      expect(b.h).toBeGreaterThan(1.3);
      expect(b.h).toBeLessThan(1.6);
      // Round wheels: the tyre cylinders put vertices at the wheel's full radius ahead of and behind each axle.
      const pos = body.getAttribute('position') as Attribute;
      let onRim = 0;
      for (let i = 0; i < pos.count; i++) {
        const dz = Math.abs(pos.getZ(i) - spec.cgToFront);
        const dy = pos.getY(i) - spec.wheelRadius;
        if (
          Math.abs(Math.hypot(dz, dy) - spec.wheelRadius) < 1e-3 &&
          Math.abs(pos.getX(i)) > spec.trackWidth / 2 - 0.3
        )
          onRim++;
      }
      expect(onRim).toBeGreaterThan(20);
      // Headlights at the nose (+z), tail lights at the back.
      const lp = lights.getAttribute('position') as Attribute;
      let nose = 0;
      for (let i = 0; i < lp.count; i++) if (lp.getZ(i) > 0) nose++;
      expect(nose).toBe(lp.count / 2);
      body.dispose();
      lights.dispose();
    },
  );
});
