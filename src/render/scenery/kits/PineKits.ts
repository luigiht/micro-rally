import { Color, DoubleSide, MeshStandardMaterial } from 'three';
import type { Prop } from '@/game/stage/SceneryScatter';
import { PINE_SHAPES, pineFoliage, pineStandIn, pineTrunk, type PineShape } from '../PineGeometry';
import type { KindKit } from '../SceneryChunkManager';
import { spotHash } from '../TreeGeometry';

/** Reddish pine bark, a shade warmer than the palette's trunk brown. */
const BARK = '#6e4430';

/**
 * A pine wood's pines (palettes with `pines`): umbrella-tiered pines in four
 * builds (full, tall, sparse and young, picked by the scatter), each with
 * its own gently curved trunk that ends inside its crown, the detailed
 * foliage near the car and a cheap stand-in beyond; the saplings by the road
 * are the low-boughed shape drawn small. Each takes one of the palette's
 * greens, a little lighter or darker, over its geometry's root-to-tip ramp;
 * the green is chosen by the tree's spot, and its heading turns the lean.
 */
export function pineKits(greens: readonly string[], shadows: boolean): KindKit[] {
  const colors = greens.map((c) => new Color(c));
  const colorAt = (p: Prop, out: Color) => {
    out.copy(colors[Math.floor(spotHash(p, 41) * colors.length)]!);
    out.multiplyScalar(0.9 + spotHash(p, 42) * 0.2);
  };
  // The scatter picks each pine's build (`Prop.pine`); saplings are young pines.
  const shapeOf = (p: Prop): PineShape => (p.kind === 'sapling' ? 'young' : (p.pine ?? 'full'));
  // Double-sided: a strip is a single face, seen from above and below.
  const foliage = () =>
    new MeshStandardMaterial({
      color: '#ffffff',
      flatShading: true,
      roughness: 0.9,
      side: DoubleSide,
      vertexColors: true,
    });
  const kits: KindKit[] = [];
  for (const shape of PINE_SHAPES) {
    const sources: KindKit['sources'] = shape === 'young' ? ['tree', 'sapling'] : ['tree'];
    const accept = (p: Prop) => shapeOf(p) === shape;
    kits.push(
      {
        sources,
        geometry: pineFoliage(shape),
        material: foliage(),
        tint: null,
        vertexColors: true,
        castShadow: shadows,
        accept,
        colorAt,
        lod: 'near',
      },
      // Saplings only near the car: small, and hidden behind the wood further off.
      {
        sources: ['tree'],
        geometry: pineStandIn(shape),
        material: foliage(),
        tint: null,
        vertexColors: true,
        castShadow: shadows,
        accept,
        colorAt,
        lod: 'far',
      },
      {
        sources,
        geometry: pineTrunk(shape),
        material: new MeshStandardMaterial({ color: BARK, flatShading: true, roughness: 0.9 }),
        tint: null,
        castShadow: shadows,
        accept,
      },
    );
  }
  return kits;
}
