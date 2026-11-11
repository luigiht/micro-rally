import {
  type BufferGeometry,
  ConeGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  Vector2,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Prop } from '@/game/stage/SceneryScatter';

/**
 * Tree silhouettes, all white for an instance colour: the stock cone pine and
 * round broadleaf every rally region uses, and the Autumnal woods' layered
 * fir, tall spire, oval and layered crowns, sized alike (foliage from about
 * 1.3 m up, crowns near 4–6 m) so the shared trunk kit fits them all.
 */

/** The stock pine: two stacked heptagonal cones. */
export function foliageGeometry(): BufferGeometry {
  // Foliage starts 1.3 m up so the trunk shows, in the tree and in its shadow.
  const low = new ConeGeometry(1.35, 2.6, 7).translate(0, 2.6, 0);
  const high = new ConeGeometry(0.95, 2.1, 7).translate(0, 3.8, 0);
  const merged = mergeGeometries([low, high])!;
  low.dispose();
  high.dispose();
  return merged;
}

/** The stock broadleaf: three faceted balls. */
export function canopyGeometry(): BufferGeometry {
  const parts = [
    new IcosahedronGeometry(1.5, 0).translate(0, 3.1, 0),
    new IcosahedronGeometry(1.05, 0).translate(0.9, 2.7, 0.3),
    new IcosahedronGeometry(0.95, 0).translate(-0.7, 3.6, -0.4),
  ];
  const merged = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return merged;
}

/** Merge into one non-indexed geometry; flat-shaded trees need no UVs, so parts built by hand fit too. */
function merge(parts: BufferGeometry[]): BufferGeometry {
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  for (const p of flat) p.deleteAttribute('uv');
  const merged = mergeGeometries(flat)!;
  for (const p of new Set([...parts, ...flat])) p.dispose();
  return merged;
}

/** A layered fir: three stacked heptagonal tiers, each skirt wider than the tier above. */
export function firGeometry(): BufferGeometry {
  return merge([
    new ConeGeometry(1.6, 1.8, 7).translate(0, 2.3, 0),
    new ConeGeometry(1.2, 1.6, 7).translate(0, 3.3, 0).rotateY(0.4),
    new ConeGeometry(0.8, 1.6, 7).translate(0, 4.3, 0).rotateY(0.9),
  ]);
}

/** A tall flame-shaped spire (a poplar or a cypress): a hexagonal lathe swelling low and drawing to a point. */
export function spireGeometry(): BufferGeometry {
  const profile = [
    new Vector2(0, 1.2),
    new Vector2(0.65, 1.8),
    new Vector2(0.85, 2.8),
    new Vector2(0.7, 4.0),
    new Vector2(0.4, 5.1),
    new Vector2(0, 6.0),
  ];
  return new LatheGeometry(profile, 6).toNonIndexed();
}

/** A tall oval broadleaf crown: an upright faceted egg with a smaller lobe off one shoulder. */
export function ovalCanopyGeometry(): BufferGeometry {
  return merge([
    new IcosahedronGeometry(1.25, 0).scale(1, 1.6, 1).translate(0, 3.5, 0),
    new IcosahedronGeometry(0.8, 0).translate(0.75, 2.8, -0.2),
  ]);
}

/** A layered broadleaf crown: two flattened faceted domes, the upper one smaller and turned. */
export function tieredCanopyGeometry(): BufferGeometry {
  return merge([
    new DodecahedronGeometry(1.7, 0).scale(1, 0.62, 1).translate(0, 2.8, 0),
    new DodecahedronGeometry(1.15, 0).scale(1, 0.7, 1).rotateY(0.5).translate(0.2, 3.75, 0.1),
  ]);
}

/** A stable 0..1 hash of a prop's spot, so its shape and colour never change between visits. */
export function spotHash(p: Pick<Prop, 'x' | 'z'>, salt: number): number {
  let h =
    Math.imul(Math.round(p.x * 8) ^ 0x9e3779b9, 374761393) +
    Math.imul(Math.round(p.z * 8), 668265263);
  h = Math.imul(h ^ salt ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
