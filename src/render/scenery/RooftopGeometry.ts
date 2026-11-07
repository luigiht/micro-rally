import { type BufferGeometry, Color } from 'three';
import { box } from './HouseGeometry';
import { CAP, IRON, RAIL, STONE } from './FacadeGeometry';

/**
 * Rooftop parts the city kits share: parapets, a stair bulkhead, a water
 * tower on legs, air-conditioning units, a roof garden in planters, a
 * pergola and an antenna. Pure white takes the roof tint; the rest is fixed.
 * Every part stands on the roof deck at `top` and rises no more than 4.5 m.
 */
const WHITE = new Color('#ffffff');
const TANK = new Color('#6e5a48');
const HEDGE = [new Color('#4f8a3b'), new Color('#67a048')] as const;
const TROUGH = new Color('#8c8a86');
const AC = new Color('#b9bcc0');
const WOOD = new Color('#8a6a4a');

/** The deck inside a parapet `h` tall and `t` thick, right round a `w` × `d` roof at `top`. */
export function parapet(w: number, d: number, top: number, h = 0.5, t = 0.3): BufferGeometry[] {
  return [
    box(w - 0.3, 0.3, d - 0.3, 0, top + 0.05, 0, WHITE),
    box(w + 2 * t - 0.4, h, t, 0, top + h / 2, -(d / 2) - t / 2 + 0.2, WHITE),
    box(w + 2 * t - 0.4, h, t, 0, top + h / 2, d / 2 + t / 2 - 0.2, WHITE),
    box(t, h - 0.02, d - 0.3, -(w / 2) - t / 2 + 0.2, top + h / 2, 0, WHITE),
    box(t, h - 0.02, d - 0.3, w / 2 + t / 2 - 0.2, top + h / 2, 0, WHITE),
    // Coping in stone over the parapet.
    box(w + 2 * t - 0.2, 0.08, t + 0.1, 0, top + h + 0.04, -(d / 2) - t / 2 + 0.2, STONE),
    box(w + 2 * t - 0.2, 0.08, t + 0.1, 0, top + h + 0.04, d / 2 + t / 2 - 0.2, STONE),
    box(t + 0.1, 0.06, d - 0.5, -(w / 2) - t / 2 + 0.2, top + h + 0.04, 0, STONE),
    box(t + 0.1, 0.06, d - 0.5, w / 2 + t / 2 - 0.2, top + h + 0.04, 0, STONE),
  ];
}

/** A stair bulkhead with a door on its -z face. */
export function stairBulkhead(
  x: number,
  z: number,
  top: number,
  w = 3.0,
  d = 2.4,
  h = 2.4,
): BufferGeometry[] {
  return [
    box(w, h, d, x, top + h / 2, z, WHITE),
    box(0.9, 2.0, 0.08, x, top + 1.0, z - d / 2 - 0.02, CAP),
    box(w + 0.2, 0.12, d + 0.2, x, top + h + 0.04, z, STONE),
  ];
}

/** A water tank on four legs under a flat cap, 4.2 m tall. */
export function waterTower(x: number, z: number, top: number): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  for (const sx of [-1, 1] as const)
    for (const sz of [-1, 1] as const)
      parts.push(box(0.14, 1.8, 0.14, x + sx * 0.75, top + 0.9, z + sz * 0.75, IRON));
  parts.push(
    box(1.9, 0.12, 1.9, x, top + 1.86, z, IRON),
    box(1.7, 1.7, 1.7, x, top + 2.75, z, TANK),
    box(1.5, 0.24, 1.5, x, top + 3.72, z, TANK),
    box(1.2, 0.28, 1.2, x, top + 3.98, z, CAP),
    box(0.4, 0.3, 0.4, x, top + 4.1, z + 0.7, CAP),
  );
  return parts;
}

/** `n` air-conditioning units in a row along x from `x0`, each a pale box with a dark grille. */
export function acUnits(x0: number, z: number, top: number, n = 2, pitch = 1.3): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * pitch;
    parts.push(
      box(1.0, 0.8, 1.0, x, top + 0.45, z, AC),
      box(0.7, 0.1, 0.7, x, top + 0.9, z, CAP),
      box(0.04, 0.5, 0.8, x - 0.52, top + 0.45, z, CAP),
    );
  }
  return parts;
}

/** A roof garden: planter troughs with two-tone hedges along `len` at (x, z), running along x. */
export function roofGarden(
  x: number,
  z: number,
  top: number,
  len: number,
  rows = 2,
): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  for (let r = 0; r < rows; r++) {
    const zz = z + (r - (rows - 1) / 2) * 1.4;
    parts.push(box(len, 0.4, 0.8, x, top + 0.2, zz, TROUGH));
    const n = Math.max(1, Math.round(len / 1.2));
    for (let i = 0; i < n; i++) {
      const cx = x - len / 2 + (len / n) * (i + 0.5);
      const h = 0.5 + ((i + r) % 2) * 0.2;
      parts.push(box(len / n - 0.1, h, 0.6, cx, top + 0.4 + h / 2, zz, HEDGE[(i + r) % 2]!));
    }
  }
  return parts;
}

/** A pergola: four posts under slats, `w` × `d`. */
export function pergola(x: number, z: number, top: number, w = 3.2, d = 2.4): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  for (const sx of [-1, 1] as const)
    for (const sz of [-1, 1] as const)
      parts.push(
        box(0.14, 2.3, 0.14, x + sx * (w / 2 - 0.1), top + 1.15, z + sz * (d / 2 - 0.1), WOOD),
      );
  parts.push(box(w + 0.3, 0.1, 0.14, x, top + 2.35, z - d / 2 + 0.1, WOOD));
  parts.push(box(w + 0.3, 0.1, 0.14, x, top + 2.35, z + d / 2 - 0.1, WOOD));
  for (let i = 0; i < 5; i++)
    parts.push(box(0.1, 0.08, d + 0.3, x - w / 2 + 0.2 + (i * (w - 0.4)) / 4, top + 2.46, z, WOOD));
  return parts;
}

/** A mast with a cross bar. */
export function antenna(x: number, z: number, top: number, h = 3.6): BufferGeometry[] {
  return [
    box(0.5, 0.2, 0.5, x, top + 0.1, z, CAP),
    box(0.12, h, 0.12, x, top + h / 2, z, RAIL),
    box(1.0, 0.06, 0.06, x, top + h - 0.4, z, RAIL),
  ];
}
