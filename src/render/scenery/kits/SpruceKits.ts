import { Color, MeshStandardMaterial } from 'three';
import type { Prop } from '@/game/stage/SceneryScatter';
import type { KindKit } from '../SceneryChunkManager';
import { SPRUCE_SPECS, spruceGeometry } from '../SpruceGeometry';
import { spotHash } from '../TreeGeometry';

/**
 * The Arctic's tall spruces (`SpruceGeometry`): each spruce one of the
 * silhouettes in `SpruceSpecs` by its spot, in their shares (most snowed to
 * their rims, a few bare), detailed near the car and a
 * stand-in of the same shape beyond. No two stand quite alike: each is drawn
 * a little wider or narrower, taller or shorter and tipped a little off
 * upright, and a shade lighter or darker, warmer or cooler, by its spot.
 */

const WIDTH = [0.85, 1.15] as const;
const HEIGHT = [0.9, 1.12] as const;
const TILT = 0.04;
const SHADE = [0.92, 1.05] as const;
const CAST = 0.03;

const between = ([lo, hi]: readonly [number, number], t: number) => lo + (hi - lo) * t;

function place(
  p: Prop,
  dummy: { scale: { x: number; y: number; z: number }; rotation: { x: number } },
): void {
  const w = between(WIDTH, spotHash(p, 211));
  dummy.scale.x *= w;
  dummy.scale.z *= w;
  dummy.scale.y *= between(HEIGHT, spotHash(p, 213));
  dummy.rotation.x += (spotHash(p, 217) - 0.5) * 2 * TILT;
}

function colourAt(p: Prop, out: Color): void {
  const b = between(SHADE, spotHash(p, 219));
  const cast = (spotHash(p, 223) - 0.5) * 2 * CAST;
  out.setRGB(b * (1 + cast), b, b * (1 - cast));
}

/** Which silhouette a spruce takes, by its spot, in the silhouettes' shares. */
export function spruceForm(p: Pick<Prop, 'x' | 'z'>): number {
  const r = spotHash(p, 23);
  let acc = 0;
  for (let n = 0; n < SPRUCE_SPECS.length; n++) {
    acc += SPRUCE_SPECS[n]!.share;
    if (r < acc) return n;
  }
  return 0;
}

export function spruceKits(pine: readonly Color[], trunk: string, shadows: boolean): KindKit[] {
  const greens = [pine[0]!, pine[1] ?? pine[0]!] as const;
  const bark = new Color(trunk);
  return SPRUCE_SPECS.flatMap((spec, n) =>
    ([1, 0] as const).map((detail): KindKit => ({
      sources: ['spruce'],
      geometry: spruceGeometry(spec, greens, bark, detail),
      material: new MeshStandardMaterial({
        color: '#ffffff',
        flatShading: true,
        roughness: 0.9,
        vertexColors: true,
      }),
      tint: null,
      vertexColors: true,
      castShadow: shadows,
      accept: (p) => spruceForm(p) === n,
      place,
      colorAt: colourAt,
      lod: detail ? 'near' : 'far',
    })),
  );
}
