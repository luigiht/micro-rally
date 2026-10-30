import { describe, expect, it } from 'vitest';
import { type Mesh, type BufferAttribute } from 'three';
import { createWheelContacts } from '@/game/vehicle/wheelContacts';
import { SkidMarks } from '@/render/effects/SkidMarks';

const DT = 1 / 60;

/** Drive the contacts straight down +Z at 30 m/s for `frames`, rear wheels scrubbing at `rear`. */
function drive(marks: SkidMarks, frames: number, rear: number, start = 0, time = 0): number {
  const contacts = createWheelContacts();
  let t = time;
  for (let f = 0; f < frames; f++) {
    const z = start + f * 0.5;
    contacts.forEach((c, i) => {
      c.x = i % 2 === 0 ? 0.75 : -0.75;
      c.z = i < 2 ? z + 1.2 : z - 1.3;
      c.y = 0;
      c.intensity = i < 2 ? 0 : rear;
    });
    t += DT;
    marks.update(contacts, 'tarmac', t, DT);
  }
  return t;
}

function drawn(marks: SkidMarks): number {
  return (marks.mesh as Mesh).geometry.drawRange.count / 6;
}

describe('SkidMarks', () => {
  it('writes nothing while the tyres grip', () => {
    const marks = new SkidMarks({ capacity: 16 });
    drive(marks, 30, 0);
    expect(marks.quadCount).toBe(0);
    expect(drawn(marks)).toBe(0);
    marks.dispose();
  });

  it('lays a strip behind each sliding wheel and tapers it when the slide ends', () => {
    const marks = new SkidMarks({ capacity: 64 });
    const t = drive(marks, 20, 1);
    expect(marks.quadCount).toBeGreaterThan(8);
    const before = marks.quadCount;
    drive(marks, 60, 0, 10, t);
    expect(marks.quadCount).toBeGreaterThan(before);
    const intensity = marks.mesh.geometry.getAttribute('aIntensity') as BufferAttribute;
    const last = (marks.quadCount - 1) * 4;
    expect(intensity.getX(last + 2)).toBe(0);
    expect(intensity.getX(last)).toBeGreaterThan(0);
    expect(marks.mesh.geometry.drawRange.count).toBe(marks.quadCount * 6);
    marks.dispose();
  });

  it('recycles the oldest quads instead of growing', () => {
    const marks = new SkidMarks({ capacity: 8 });
    const positions = marks.mesh.geometry.getAttribute('position') as BufferAttribute;
    const bytes = positions.array.length;
    drive(marks, 200, 1);
    expect(marks.quadCount).toBeGreaterThan(8);
    expect(drawn(marks)).toBe(8);
    expect(positions.array.length).toBe(bytes);
    marks.dispose();
  });

  it('starts a fresh strip after a respawn jump', () => {
    const marks = new SkidMarks({ capacity: 64 });
    const t = drive(marks, 10, 1);
    const n = marks.quadCount;
    drive(marks, 1, 1, 500, t);
    expect(marks.quadCount).toBe(n);
    marks.dispose();
  });
});
