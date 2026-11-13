import { Color, MeshStandardMaterial } from 'three';
import type { StagePalette } from '@/game/stage/regions';
import type { Prop } from '@/game/stage/SceneryScatter';
import type { KindKit } from '../SceneryChunkManager';
import { bareTreeGeometry, snowyBushGreen, snowyBushSnow } from '../AlpineTreeGeometry';
import { PINE_SPECS, snowPineGeometry } from '../SnowPineGeometry';
import { spotHash } from '../TreeGeometry';

/**
 * The Alpine's winter woods (`SnowPineGeometry`, `AlpineTreeGeometry`), in
 * place of the stock pine, broadleaf and bush: each `tree` one of nine
 * snow pines chosen by the prop's spot, each `broadleaf` a bare tree, and
 * each bush under a cap of snow. No two pines stand quite alike: each is
 * drawn a little wider or narrower, taller or shorter and tipped a few
 * degrees off upright by its spot, and a shade lighter or darker, a touch
 * warmer or cooler. The bushes' green is the region's two-tone pine tint a
 * shade either way; the snow one white; the bare trees a weathered grey-brown.
 */

const SNOW = '#eef2f5';
const BARE_WOOD = '#8c7a64';

const mat = (color: string, vertexColors = false) =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, vertexColors });

/** A pine's own proportions by its spot: width and height apart, and a tilt off upright. */
const PINE_WIDTH = [0.8, 1.2] as const;
const PINE_HEIGHT = [0.85, 1.2] as const;
const PINE_TILT = 0.07;
/** A pine's own brightness, and how far its colour leans warm or cool. */
const PINE_SHADE = [0.9, 1.06] as const;
const PINE_CAST = 0.035;

const between = ([lo, hi]: readonly [number, number], t: number) => lo + (hi - lo) * t;

function placePine(
  p: Prop,
  dummy: { scale: { x: number; y: number; z: number }; rotation: { x: number } },
) {
  const w = between(PINE_WIDTH, spotHash(p, 71));
  dummy.scale.x *= w;
  dummy.scale.z *= w;
  dummy.scale.y *= between(PINE_HEIGHT, spotHash(p, 73));
  dummy.rotation.x += (spotHash(p, 79) - 0.5) * 2 * PINE_TILT;
}

function pineColour(p: Prop, out: Color) {
  const b = between(PINE_SHADE, spotHash(p, 83));
  const cast = (spotHash(p, 89) - 0.5) * 2 * PINE_CAST;
  out.setRGB(b * (1 + cast), b, b * (1 - cast));
}

export function alpineKits(palette: StagePalette, shadows: boolean): KindKit[] {
  const greens = [new Color(palette.foliage), new Color(palette.foliageAlt)] as const;
  const trunk = new Color(palette.trunk);
  const pine = (n: number) => (p: Prop) => Math.floor(spotHash(p, 19) * PINE_SPECS.length) === n;
  const bushGreen = (p: Prop, out: Color) => {
    out.copy(greens[p.variant % 2]!);
    out.multiplyScalar(0.9 + spotHash(p, 61) * 0.2);
  };
  return [
    ...PINE_SPECS.map((spec, n): KindKit => ({
      sources: ['tree'],
      geometry: snowPineGeometry(spec, greens, trunk),
      material: mat('#ffffff', true),
      tint: null,
      vertexColors: true,
      castShadow: shadows,
      accept: pine(n),
      place: placePine,
      colorAt: pineColour,
    })),
    {
      sources: ['broadleaf'],
      geometry: bareTreeGeometry(),
      material: mat(BARE_WOOD),
      tint: null,
      castShadow: shadows,
    },
    {
      sources: ['bush'],
      geometry: snowyBushGreen(),
      material: mat('#ffffff'),
      tint: null,
      castShadow: false,
      colorAt: bushGreen,
    },
    {
      sources: ['bush'],
      geometry: snowyBushSnow(),
      material: mat(SNOW),
      tint: null,
      castShadow: false,
    },
  ];
}
