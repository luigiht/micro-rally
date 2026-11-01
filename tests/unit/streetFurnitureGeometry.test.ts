import { type BufferAttribute, type BufferGeometry, Color, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  arrowBoardGeometry,
  barrierGeometry,
  lampPostGeometry,
} from '@/render/scenery/StreetFurnitureGeometry';

/** Every kit is merged from BoxGeometry parts: 8 corners, 12 triangles, 36 non-indexed vertices each. */
const BOX_VERTICES = 36;
/** Bounding-box dimensions may drift this far from the brief. */
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

function colorMatches(col: Attribute, i: number, c: Color): boolean {
  return (
    Math.abs(col.getX(i) - c.r) < 1e-3 &&
    Math.abs(col.getY(i) - c.g) < 1e-3 &&
    Math.abs(col.getZ(i) - c.b) < 1e-3
  );
}

function hasColor(geo: BufferGeometry, hex: string): boolean {
  const col = geo.getAttribute('color') as Attribute;
  const c = new Color(hex);
  for (let i = 0; i < col.count; i++) if (colorMatches(col, i, c)) return true;
  return false;
}

/**
 * Fraction of triangles whose winding normal (counter-clockwise = front face)
 * points away from the centroid of the box they belong to. Also checks that
 * every part really is a box and that the winding agrees with the stored
 * normals, which a negative scale would silently break.
 */
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
      corners.add(`${a.x},${a.y},${a.z}`);
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

/** Mean x of the arrow vertices: dark, in front of the posts (z < 0.01), between the border strips. */
function arrowMeanX(geo: BufferGeometry): number {
  const pos = geo.getAttribute('position') as Attribute;
  const col = geo.getAttribute('color') as Attribute;
  const dark = new Color('#2b2a33');
  let sum = 0;
  let n = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (pos.getZ(i) < 0.01 && y > 0.78 && y < 1.42 && colorMatches(col, i, dark)) {
      sum += pos.getX(i);
      n++;
    }
  }
  expect(n).toBe(3 * BOX_VERTICES);
  return sum / n;
}

function sortedX(geo: BufferGeometry, sign: 1 | -1): number[] {
  const pos = geo.getAttribute('position') as Attribute;
  const out: number[] = [];
  for (let i = 0; i < pos.count; i++) out.push(sign * pos.getX(i));
  return out.sort((p, q) => p - q);
}

describe('StreetFurnitureGeometry', () => {
  const kits = {
    barrier: barrierGeometry(),
    left: arrowBoardGeometry('left'),
    right: arrowBoardGeometry('right'),
    lamp: lampPostGeometry(),
  };

  it('builds non-indexed, vertex-coloured geometry with matching attribute counts', () => {
    for (const [name, geo] of Object.entries(kits)) {
      expect(geo.index, name).toBeNull();
      const pos = geo.getAttribute('position');
      expect(pos.count, name).toBeGreaterThan(BOX_VERTICES);
      expect(geo.getAttribute('normal').count, name).toBe(pos.count);
      expect(geo.getAttribute('color').count, name).toBe(pos.count);
      expect(geo.getAttribute('uv').count, name).toBe(pos.count);
    }
  });

  it('winds every face counter-clockwise from outside its own part', () => {
    for (const [name, geo] of Object.entries(kits)) {
      expect(outwardFraction(geo), name).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('keeps the palette fixed: no pure-white vertex for an instance tint to recolour', () => {
    for (const [name, geo] of Object.entries(kits)) {
      expect(hasColor(geo, '#ffffff'), name).toBe(false);
    }
  });

  it('sizes the barrier 1.2 × 0.8 × 0.4 m on the ground with red and white stripes', () => {
    const e = extents(kits.barrier);
    expect(Math.abs(e.w - 1.2)).toBeLessThan(TOLERANCE);
    expect(Math.abs(e.h - 0.8)).toBeLessThan(TOLERANCE);
    expect(Math.abs(e.d - 0.4)).toBeLessThan(TOLERANCE);
    expect(Math.abs(e.min.y)).toBeLessThan(1e-6);
    expect(Math.abs(e.min.x + e.max.x)).toBeLessThan(1e-6);
    expect(Math.abs(e.min.z + e.max.z)).toBeLessThan(1e-6);
    expect(hasColor(kits.barrier, '#d9343a')).toBe(true);
    expect(hasColor(kits.barrier, '#f4f1e8')).toBe(true);
    expect(hasColor(kits.barrier, '#2b2a33')).toBe(true);
  });

  it('stands the arrow board 1.4 m wide and 1.5 m tall with the board 0.7 m up', () => {
    for (const geo of [kits.left, kits.right]) {
      const e = extents(geo);
      expect(Math.abs(e.w - 1.4)).toBeLessThan(TOLERANCE);
      expect(Math.abs(e.h - 1.5)).toBeLessThan(TOLERANCE);
      expect(Math.abs(e.min.y)).toBeLessThan(1e-6);
      // The posts start at z = 0.02, so the face is everything in front of z = 0.01.
      const pos = geo.getAttribute('position') as Attribute;
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getZ(i) >= 0.01) continue;
        lo = Math.min(lo, pos.getY(i));
        hi = Math.max(hi, pos.getY(i));
      }
      expect(Math.abs(lo - 0.7)).toBeLessThan(TOLERANCE);
      expect(Math.abs(hi - lo - 0.8)).toBeLessThan(TOLERANCE);
      expect(hasColor(geo, '#f2c14e')).toBe(true);
    }
  });

  it('points the arrow to +x for a left turn and mirrors it exactly for a right turn', () => {
    const lp = kits.left.getAttribute('position') as Attribute;
    const rp = kits.right.getAttribute('position') as Attribute;
    expect(rp.count).toBe(lp.count);
    expect(Array.from(rp.array)).not.toEqual(Array.from(lp.array));
    expect(arrowMeanX(kits.left)).toBeGreaterThan(0.1);
    expect(arrowMeanX(kits.right)).toBeLessThan(-0.1);
    const lx = sortedX(kits.left, 1);
    const rx = sortedX(kits.right, -1);
    for (let i = 0; i < lx.length; i++) {
      expect(Math.abs(lx[i]! - rx[i]!), `vertex ${i}`).toBeLessThan(1e-6);
    }
  });

  it('raises the lamp post 4.2 m with its head out on the -x arm', () => {
    const e = extents(kits.lamp);
    expect(Math.abs(e.h - 4.2)).toBeLessThan(TOLERANCE);
    expect(Math.abs(e.min.y)).toBeLessThan(1e-6);
    expect(e.min.x).toBeLessThan(-0.6);
    expect(e.max.x).toBeLessThan(0.3);
    const pos = kits.lamp.getAttribute('position') as Attribute;
    const col = kits.lamp.getAttribute('color') as Attribute;
    const cream = new Color('#fff1c9');
    let heads = 0;
    for (let i = 0; i < pos.count; i++) {
      if (!colorMatches(col, i, cream)) continue;
      heads++;
      expect(pos.getX(i)).toBeLessThan(-0.5);
      expect(pos.getY(i)).toBeGreaterThan(3.5);
    }
    expect(heads).toBe(BOX_VERTICES);
  });
});
