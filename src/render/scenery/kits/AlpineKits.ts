import { Color, IcosahedronGeometry, MeshStandardMaterial } from 'three';
import type { StagePalette } from '@/game/stage/regions';
import type { Prop } from '@/game/stage/SceneryScatter';
import { snowyBoulderGeometry, snowyStumpGeometry } from '../SnowyGroundGeometry';
import type { KindKit } from '../SceneryChunkManager';
import { PINE_SPECS, snowPineGeometry } from '../SnowPineGeometry';
import { spotHash } from '../TreeGeometry';

/**
 * The Alpine's winter woods (`SnowPineGeometry`, `SnowyGroundGeometry`), in
 * place of the stock pine, bush and rock: each `tree`, by the prop's spot,
 * one of the tiered snow pines (`SnowPineSpecs`); each bush the
 * stock bush under a cap of snow, or one in four a snowy stump; each rock a
 * boulder under snow (the region plants no broadleaves). No two pines stand quite alike: each is
 * drawn a little wider or narrower, taller or shorter and tipped a few
 * degrees off upright by its spot, and a shade lighter or darker, a touch
 * warmer or cooler. The bushes' green is the region's two-tone pine tint a
 * shade either way; their snow one white.
 */

const SNOW = '#eef2f5';
/** The stock bush (`rallyKits`): this big, its middle this high; its cap of snow an ellipsoid set high on it, a hair wider, covering its upper third. */
const BUSH_R = 0.9;
const BUSH_Y = 0.45;
const CAP_RISE = 0.45;
const CAP_HEIGHT = 0.6;
const CAP_WIDE = 1.04;

const mat = (color: string, vertexColors = false) =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, vertexColors });

/** A pine's own proportions by its spot: width and height apart, and a tilt off upright. */
const PINE_WIDTH = [0.75, 1.25] as const;
const PINE_HEIGHT = [0.8, 1.25] as const;
const PINE_TILT = 0.07;
/** A pine's own brightness, and how far its colour leans warm or cool. */
const PINE_SHADE = [0.9, 1.06] as const;
const PINE_CAST = 0.035;

const between = ([lo, hi]: readonly [number, number], t: number) => lo + (hi - lo) * t;

/** One bush in this many is a snowy stump. */
const STUMP_EVERY = 4;

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
  // Each pine's silhouette by its spot.
  const pine = (n: number) => (p: Prop) =>
    Math.min(PINE_SPECS.length - 1, Math.floor(spotHash(p, 19) * PINE_SPECS.length)) === n;
  const stump = (p: Prop) => Math.floor(spotHash(p, 67) * STUMP_EVERY) === 0;
  const pineKit = (geometry: KindKit['geometry'], accept: (p: Prop) => boolean): KindKit => ({
    sources: ['tree'],
    geometry,
    material: mat('#ffffff', true),
    tint: null,
    vertexColors: true,
    castShadow: shadows,
    accept,
    place: placePine,
    colorAt: pineColour,
  });
  const bushGreen = (p: Prop, out: Color) => {
    out.copy(greens[p.variant % 2]!);
    out.multiplyScalar(0.9 + spotHash(p, 61) * 0.2);
  };
  const bush = (p: Prop) => !stump(p);
  return [
    ...PINE_SPECS.map((spec, n) => pineKit(snowPineGeometry(spec, greens, trunk), pine(n))),
    {
      sources: ['bush'],
      geometry: new IcosahedronGeometry(BUSH_R, 0).translate(0, BUSH_Y, 0),
      material: mat('#ffffff'),
      tint: null,
      castShadow: false,
      accept: bush,
      colorAt: bushGreen,
    },
    {
      sources: ['bush'],
      geometry: new IcosahedronGeometry(1, 0)
        .scale(BUSH_R * CAP_WIDE, BUSH_R * CAP_HEIGHT, BUSH_R * CAP_WIDE)
        .translate(0, BUSH_Y + BUSH_R * CAP_RISE, 0),
      material: mat(SNOW),
      tint: null,
      castShadow: false,
      accept: bush,
    },
    {
      sources: ['bush'],
      geometry: snowyStumpGeometry(trunk),
      material: mat('#ffffff', true),
      tint: null,
      vertexColors: true,
      castShadow: shadows,
      accept: stump,
    },
    {
      // Boulders sit into the snow, turned any way about the vertical but never tumbled: the snow stays on top.
      sources: ['rock'],
      geometry: snowyBoulderGeometry(new Color(palette.boulder)),
      material: mat('#ffffff', true),
      tint: null,
      vertexColors: true,
      castShadow: shadows,
      place: (p, dummy) => {
        dummy.position.y -= 0.2 * p.scale;
      },
    },
  ];
}
