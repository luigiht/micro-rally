import { BufferAttribute, BufferGeometry, DoubleSide, MeshStandardMaterial } from 'three';
import { mulberry32 } from '@/game/rng';

const BLADES = 20;
/** Blades root around a few loose sub-tufts within this radius of the patch's centre, metres. */
const SPREAD = 0.5;
/** Each blade strays this far (at most) from its sub-tuft, metres. */
const STRAY = 0.3;
const TUFTS = 3;
const WIDTH = 0.07;
/** The patch leans with the wind towards local +x, each blade within this much of it, radians. */
const WIND_SPREAD = 0.7;
/** White-based ramp the instance tint multiplies: shaded at the root, sunlit and a little straw at the tip. */
const ROOT = [0.55, 0.62, 0.5] as const;
const MID = [0.88, 0.94, 0.78] as const;
const TIP = [1.2, 1.18, 0.86] as const;

/**
 * A loose patch of tall grass: blades rooted around three sub-tufts spread
 * over a metre or so, a quarter of them short, the rest up to about a metre
 * at scale 1, all bent the same way by the wind (local +x) give or take, so
 * neighbouring patches run together into drifts rather than round tufts.
 * Each blade is two tapering segments, the tip leaning further, with a
 * root-to-tip colour ramp; the material is double-sided, as a blade is a
 * single face.
 */
export function tallGrassGeometry(stride = 1): BufferGeometry {
  const rand = mulberry32(0x9a55);
  const pos: number[] = [];
  const col: number[] = [];
  const tufts: [number, number][] = [[0, 0]];
  for (let i = 1; i < TUFTS; i++) {
    const a = rand() * Math.PI * 2;
    const r = SPREAD * (0.5 + rand() * 0.5);
    // Spread along the wind more than across it, so a patch reads as a drift.
    tufts.push([Math.cos(a) * r * 1.3, Math.sin(a) * r * 0.8]);
  }
  for (let i = 0; i < BLADES; i++) {
    const [tx, tz] = tufts[i % TUFTS]!;
    const ox = tx + (rand() + rand() - 1) * STRAY;
    const oz = tz + (rand() + rand() - 1) * STRAY;
    const lean = (rand() - 0.5) * 2 * WIND_SPREAD;
    const lx = Math.cos(lean);
    const lz = Math.sin(lean);
    const h = rand() < 0.25 ? 0.3 + rand() * 0.25 : 0.55 + rand() * 0.5;
    const w = WIDTH * (0.8 + rand() * 0.4);
    // The blade's face turns across its lean, give or take, so it reads from every side.
    const face = lean + Math.PI / 2 + (rand() - 0.5) * 1.2;
    const sx = Math.cos(face) * w * 0.5;
    const sz = Math.sin(face) * w * 0.5;
    const out = h * (0.15 + rand() * 0.3);
    // A stand-in keeps every `stride`th blade of the very same patch.
    if (i % stride !== 0) continue;
    const mx = ox + lx * out * 0.3;
    const mz = oz + lz * out * 0.3;
    const my = h * 0.55;
    pos.push(
      ...[ox - sx, 0, oz - sz, ox + sx, 0, oz + sz, mx + sx * 0.6, my, mz + sz * 0.6],
      ...[ox - sx, 0, oz - sz, mx + sx * 0.6, my, mz + sz * 0.6, mx - sx * 0.6, my, mz - sz * 0.6],
      ...[mx - sx * 0.6, my, mz - sz * 0.6, mx + sx * 0.6, my, mz + sz * 0.6],
      ...[ox + lx * out, h, oz + lz * out],
    );
    col.push(...ROOT, ...ROOT, ...MID, ...ROOT, ...MID, ...MID, ...MID, ...MID, ...TIP);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(Float32Array.from(pos), 3));
  geo.setAttribute('color', new BufferAttribute(Float32Array.from(col), 3));
  geo.computeVertexNormals();
  return geo;
}

/** A distant stand-in: every third blade of the same patch, a third of the faces. */
export function tallGrassStandIn(): BufferGeometry {
  return tallGrassGeometry(3);
}

export function tallGrassMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    side: DoubleSide,
  });
}
