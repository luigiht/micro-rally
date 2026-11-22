import {
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { StagePalette } from '@/game/stage/regions';
import type { Prop } from '@/game/stage/SceneryScatter';
import { merge, paint } from '../HouseGeometry';
import type { KindKit } from '../SceneryChunkManager';
import { spotHash } from '../TreeGeometry';

/**
 * The Savanna's plants in place of the stock woods: each `tree` a flat-topped
 * acacia (a forked trunk under a broad, thin, faceted umbrella crown, in two
 * builds), each `bush` either a sisal rosette of stiff blue-green blades or a
 * rounded thorn scrub. One vertex-coloured geometry per build, each instance a
 * shade lighter or darker and a little wider or narrower by its spot.
 */

const UP = new Vector3(0, 1, 0);

/** Share of the bushes that are sisal rosettes; the rest are thorn scrub. */
const SISAL_SHARE = 0.45;
const SISAL = new Color('#6b8f73');
const SISAL_TIP = new Color('#8aa585');

/** Jitter each vertex of `g` a little, the same for vertices sharing a place, so faces read hand-cut. */
function rough(g: BufferGeometry, amount: number, salt: number): BufferGeometry {
  const pos = g.getAttribute('position');
  const seen = new Map<string, [number, number, number]>();
  let s = salt >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)}|${pos.getY(i).toFixed(3)}|${pos.getZ(i).toFixed(3)}`;
    let d = seen.get(key);
    if (!d) {
      d = [next() * amount, next() * amount * 0.25, next() * amount];
      seen.set(key, d);
    }
    pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
  }
  g.computeVertexNormals();
  return g;
}

/** A limb from (x0, y0, z0) to (x1, y1, z1), `r` thick. */
function limb(
  [x0, y0, z0]: readonly [number, number, number],
  [x1, y1, z1]: readonly [number, number, number],
  r: number,
): BufferGeometry {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dy, dz);
  const g = new CylinderGeometry(r * 0.75, r, len, 5).translate(0, len / 2, 0);
  // Turn the upright cylinder to point along the limb.
  g.applyQuaternion(
    new Quaternion().setFromUnitVectors(UP, new Vector3(dx / len, dy / len, dz / len)),
  );
  return g.translate(x0, y0, z0);
}

/**
 * An acacia: a short trunk forking into two or three limbs that spread under a
 * broad, thin umbrella crown, itself a few overlapping flat slabs so its edge
 * is ragged. `wide` builds the broad old tree, else a younger, rounder one.
 */
function acaciaGeometry(palette: StagePalette, wide: boolean, salt: number): BufferGeometry {
  const bark = new Color(palette.trunk);
  const leaf = new Color(palette.canopy);
  const leafAlt = new Color(palette.canopyAlt);
  const top = wide ? 4.6 : 3.8;
  const spread = wide ? 1.4 : 0.9;
  const parts: BufferGeometry[] = [
    paint(limb([0, 0, 0], [0.1, 2.1, 0], 0.22), bark),
    paint(limb([0.1, 2, 0], [spread, top - 0.15, 0.3], 0.13), bark),
    paint(limb([0.1, 2, 0], [-spread * 0.8, top - 0.2, -0.4], 0.12), bark),
    paint(limb([0.1, 2.2, 0], [0.2, top - 0.1, spread * 0.7], 0.1), bark),
  ];
  // The crown: a solid flat core, and over it overlapping slabs that sink well into it and into
  // each other, so from any side it reads as one layered umbrella with no daylight between layers.
  parts.push(
    paint(
      rough(
        new CylinderGeometry(wide ? 2.7 : 1.95, wide ? 2.2 : 1.6, 0.7, 10).translate(
          0,
          top + 0.1,
          0,
        ),
        0.25,
        salt + 3,
      ),
      leaf,
    ),
  );
  const slabs: [number, number, number, number, Color][] = wide
    ? [
        [0, top - 0.05, 0, 3.4, leaf],
        [0.8, top + 0.3, 0.35, 2.4, leafAlt],
        [-0.9, top + 0.22, -0.5, 2.2, leaf],
      ]
    : [
        [0, top - 0.05, 0, 2.4, leaf],
        [0.35, top + 0.3, 0.2, 1.75, leafAlt],
      ];
  slabs.forEach(([x, y, z, r, c], i) => {
    const slab = new CylinderGeometry(r, r * 0.86, 0.75, 10).translate(x, y, z);
    // Ragged at the rim, but only a little up and down, so neighbouring slabs keep overlapping.
    parts.push(paint(rough(slab, 0.35, salt + i * 17), c));
  });
  return merge(parts);
}

/** A sisal rosette: stiff blades fanning out and up from the ground, blue-green, paler at the tips. */
export function sisalGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const blades = 16;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + (i % 2) * 0.2;
    const lean = 0.35 + (i % 3) * 0.22;
    const len = 1.05 + (i % 4) * 0.12;
    const blade = new ConeGeometry(0.07, len, 3).translate(0, len / 2, 0);
    blade.rotateX(lean);
    blade.rotateY(a);
    parts.push(paint(blade, i % 3 === 0 ? SISAL_TIP : SISAL));
  }
  return merge(parts);
}

const mat = () =>
  new MeshStandardMaterial({
    color: '#ffffff',
    flatShading: true,
    roughness: 0.92,
    vertexColors: true,
  });

const shade = (p: Prop, out: Color) => {
  const b = 0.88 + 0.22 * spotHash(p, 211);
  out.setRGB(b * 1.02, b, b * 0.96);
};

export function savannaKits(palette: StagePalette, shadows: boolean): KindKit[] {
  const isSisal = (p: Prop) => spotHash(p, 223) < SISAL_SHARE;
  const isWide = (p: Prop) => spotHash(p, 227) < 0.55;
  const widen = (p: Prop, dummy: { scale: { x: number; z: number } }) => {
    const w = 0.85 + 0.35 * spotHash(p, 229);
    dummy.scale.x *= w;
    dummy.scale.z *= w;
  };
  return [
    {
      sources: ['tree'],
      geometry: acaciaGeometry(palette, true, 31),
      material: mat(),
      tint: null,
      vertexColors: true,
      castShadow: shadows,
      accept: isWide,
      place: widen,
      colorAt: shade,
    },
    {
      sources: ['tree'],
      geometry: acaciaGeometry(palette, false, 57),
      material: mat(),
      tint: null,
      vertexColors: true,
      castShadow: shadows,
      accept: (p) => !isWide(p),
      place: widen,
      colorAt: shade,
    },
    {
      sources: ['bush'],
      geometry: sisalGeometry(),
      material: mat(),
      tint: null,
      vertexColors: true,
      castShadow: false,
      accept: isSisal,
      colorAt: shade,
    },
    {
      sources: ['bush'],
      geometry: paint(
        rough(new IcosahedronGeometry(0.95, 0).scale(1.2, 0.7, 1.2).translate(0, 0.5, 0), 0.2, 91),
        new Color(palette.foliage),
      ),
      material: mat(),
      tint: null,
      vertexColors: true,
      castShadow: false,
      accept: (p) => !isSisal(p),
      place: widen,
      colorAt: shade,
    },
  ];
}
