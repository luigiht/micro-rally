import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  SpotLight,
} from 'three';
import { CarLamps } from '@/render/car/CarLamps';

/** A 1.8 × 1.2 × 4 m white body (z −2 to +2) with a red stripe down it. */
function body(): Group {
  const g = new Group();
  g.add(new Mesh(new BoxGeometry(1.8, 1.2, 4), new MeshStandardMaterial({ color: '#f4f1ea' })));
  const livery = new Mesh(
    new BoxGeometry(0.3, 0.05, 4.02),
    new MeshStandardMaterial({ color: '#d9343a' }),
  );
  livery.position.y = 0.61;
  g.add(livery);
  return g;
}

/** A hull-style soup: one red glowing face at the tail, one at the nose, both in its unlit second group. */
function hull(): Mesh {
  const g = new BufferGeometry();
  const tri = (z: number) => [0.6, 0.3, z, 0.8, 0.3, z, 0.7, 0.45, z];
  g.setAttribute('position', new BufferAttribute(new Float32Array([...tri(-2), ...tri(2)]), 3));
  const red = [0.7, 0.03, 0.04];
  g.setAttribute(
    'color',
    new BufferAttribute(new Float32Array([...red, ...red, ...red, ...red, ...red, ...red]), 3),
  );
  g.addGroup(0, 0, 0);
  g.addGroup(0, 6, 1);
  return new Mesh(g, [
    new MeshStandardMaterial({ vertexColors: true }),
    new MeshBasicMaterial({ vertexColors: true }),
  ]);
}

describe('CarLamps', () => {
  it('adds only lights: two beams ahead from the nose, two red beams back from the tail when braking', () => {
    const root = new Group();
    root.position.set(30, 2, -5);
    root.rotation.y = 1.1;
    const b = body();
    root.add(b);
    const lamps = new CarLamps();
    b.add(lamps.group);
    lamps.fit(b, b);
    expect(lamps.group.children.some((o) => (o as Mesh).isMesh)).toBe(false);
    const spots = lamps.group.children.filter((o): o is SpotLight => (o as SpotLight).isSpotLight);
    const beams = spots.filter((s) => s.target.position.z > s.position.z);
    const brakes = spots.filter((s) => s.target.position.z < s.position.z);
    expect(beams).toHaveLength(2);
    expect(brakes).toHaveLength(2);
    expect(beams[0]!.position.x).toBeCloseTo(-beams[1]!.position.x, 5);
    for (const beam of beams) {
      expect(beam.position.z).toBeGreaterThan(1.9);
      expect(beam.target.position.z).toBeGreaterThan(beam.position.z + 10);
      expect(beam.target.position.y).toBeLessThan(beam.position.y);
    }
    for (const beam of brakes) {
      expect(beam.position.z).toBeLessThan(-2);
      expect(beam.target.position.y).toBeLessThan(beam.position.y);
      expect(beam.color.r).toBeGreaterThan(beam.color.g * 4);
    }
    expect(lamps.group.children.some((o) => (o as PointLight).isPointLight)).toBe(false);
    lamps.setBraking(0);
    for (const beam of brakes) expect(beam.intensity).toBe(0);
    lamps.setBraking(1);
    for (const beam of brakes) expect(beam.intensity).toBeGreaterThan(0);
    lamps.dispose();
    expect(lamps.group.parent).toBeNull();
  });

  it('brightens the body’s own glowing tail faces under braking, not the nose, and gives them back', () => {
    const b = body();
    const h = hull();
    b.add(h);
    const colors = h.geometry.getAttribute('color') as BufferAttribute;
    const lamps = new CarLamps();
    b.add(lamps.group);
    lamps.fit(b, b);
    lamps.setBraking(1);
    expect(colors.getX(0)).toBeGreaterThan(0.7 * 2);
    expect(colors.getX(3)).toBeCloseTo(0.7, 5);
    lamps.setBraking(0);
    expect(colors.getX(0)).toBeCloseTo(0.7, 5);
    lamps.setBraking(1);
    lamps.dispose();
    expect(colors.getX(0)).toBeCloseTo(0.7, 5);
  });

  it('lights a body’s painted tail lamp parts but never a red livery', () => {
    const b = body();
    const disc = new Mesh(
      new BoxGeometry(0.16, 0.16, 0.03),
      new MeshStandardMaterial({ color: '#d9343a' }),
    );
    disc.position.set(0.6, 0.5, -2.02);
    b.add(disc);
    const livery = b.children[1] as Mesh<BoxGeometry, MeshStandardMaterial>;
    const lamp = disc.material as MeshStandardMaterial;
    const lamps = new CarLamps();
    b.add(lamps.group);
    lamps.fit(b, b);
    expect(lamp.emissive.r).toBeGreaterThan(0);
    const idle = lamp.emissiveIntensity;
    lamps.setBraking(1);
    expect(lamp.emissiveIntensity).toBeGreaterThan(idle);
    expect(livery.material.emissive.r).toBe(0);
    lamps.dispose();
    expect(lamp.emissive.r).toBe(0);
  });
});
