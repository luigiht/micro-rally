import { BufferAttribute, BufferGeometry, Color, MeshStandardMaterial } from 'three';
import { mulberry32 } from '@/game/rng';

/** Autumn leaf colours, one per flake in turn: orange, rust, ochre, brown, gold. */
const LEAF_COLORS = ['#d8862c', '#b7432a', '#c48a2f', '#8a5a2b', '#e3b13c'];
const FLAKES = 14;
/** Flakes lie within this radius of the cluster's centre (× the prop's scale). */
const SPREAD = 0.8;
const LENGTH = 0.26;
const WIDTH = 0.15;
/** Each flake a hair above the last, so overlapping flakes never fight for depth. */
const STACK = 0.003;

/**
 * A cluster of fallen leaves: small flat diamonds in autumn colours, facing
 * up, scattered over a disc a metre and a half across. Laid in local x/z, so
 * a prop's heading and pitch tilt it into the ground's slope. Vertex
 * colours; an instance tint varies a cluster's warmth.
 */
export function leafLitterGeometry(): BufferGeometry {
  const rand = mulberry32(0x1eaf);
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  const c = new Color();
  for (let i = 0; i < FLAKES; i++) {
    const r = SPREAD * Math.sqrt(rand());
    const a = rand() * Math.PI * 2;
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    const turn = rand() * Math.PI;
    const ux = Math.cos(turn);
    const uz = Math.sin(turn);
    const y = i * STACK;
    const base = pos.length / 3;
    // Tip, side, tail, side: a leaf-shaped diamond along (ux, uz).
    pos.push(cx + ux * LENGTH * 0.5, y, cz + uz * LENGTH * 0.5);
    pos.push(cx - uz * WIDTH * 0.5, y, cz + ux * WIDTH * 0.5);
    pos.push(cx - ux * LENGTH * 0.5, y, cz - uz * LENGTH * 0.5);
    pos.push(cx + uz * WIDTH * 0.5, y, cz - ux * WIDTH * 0.5);
    c.set(LEAF_COLORS[i % LEAF_COLORS.length]!);
    for (let k = 0; k < 4; k++) col.push(c.r, c.g, c.b);
    // Wound to face up (+y): tip → side (+90°) → tail is clockwise from above, so take the other order.
    index.push(base, base + 3, base + 2, base, base + 2, base + 1);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(Float32Array.from(pos), 3));
  geo.setAttribute('color', new BufferAttribute(Float32Array.from(col), 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Matte, lit like the grass, and pulled a touch forward in depth so it always wins over the ground beneath. */
export function leafLitterMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}
