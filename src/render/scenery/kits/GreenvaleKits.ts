import { Color, MeshStandardMaterial } from 'three';
import type { StagePalette } from '@/game/stage/regions';
import type { Prop } from '@/game/stage/SceneryScatter';
import {
  BROADLEAF_FORMS,
  broadleafGeometry,
  bushGeometry,
  CONIFER_FORMS,
  coniferGeometry,
  type BroadleafForm,
  type ConiferForm,
  type GreenvaleColours,
} from '../GreenvaleTreeGeometry';
import type { KindKit } from '../SceneryChunkManager';
import { spotHash } from '../TreeGeometry';

/**
 * The Greenvale's woods (`GreenvaleTreeGeometry`) in place of the stock
 * pine, broadleaf, bush and trunk: each `broadleaf` an oak, chestnut, stone
 * pine or linden and each `tree` a fir, spruce, cypress or young fir, chosen
 * by the prop's spot in the shares below, each detailed near the car and a
 * stand-in of the same shape beyond. No two stand quite alike: each is drawn
 * a little wider or narrower, taller or shorter and tipped a few degrees off
 * upright, and a shade lighter or darker, warmer or cooler, by its spot.
 */

const BROADLEAF_SHARE: Readonly<Record<BroadleafForm, number>> = {
  oak: 0.34,
  chestnut: 0.24,
  stonePine: 0.22,
  linden: 0.2,
};
const CONIFER_SHARE: Readonly<Record<ConiferForm, number>> = {
  fir: 0.38,
  spruce: 0.22,
  cypress: 0.22,
  youngFir: 0.18,
};

/** The form whose share the draw `r` (0..1) lands in. */
function pick<F extends string>(
  forms: readonly F[],
  share: Readonly<Record<F, number>>,
  r: number,
): F {
  let acc = 0;
  for (const f of forms) {
    acc += share[f];
    if (r < acc) return f;
  }
  return forms[forms.length - 1]!;
}

const WIDTH = [0.85, 1.15] as const;
const HEIGHT = [0.88, 1.15] as const;
const TILT = 0.06;
const SHADE = [0.9, 1.07] as const;
const CAST = 0.04;

const between = ([lo, hi]: readonly [number, number], t: number) => lo + (hi - lo) * t;

function place(
  p: Prop,
  dummy: { scale: { x: number; y: number; z: number }; rotation: { x: number } },
): void {
  const w = between(WIDTH, spotHash(p, 171));
  dummy.scale.x *= w;
  dummy.scale.z *= w;
  dummy.scale.y *= between(HEIGHT, spotHash(p, 173));
  dummy.rotation.x += (spotHash(p, 179) - 0.5) * 2 * TILT;
}

function colourAt(p: Prop, out: Color): void {
  const b = between(SHADE, spotHash(p, 183));
  const cast = (spotHash(p, 189) - 0.5) * 2 * CAST;
  out.setRGB(b * (1 + cast), b, b * (1 - cast));
}

const mat = () =>
  new MeshStandardMaterial({
    color: '#ffffff',
    flatShading: true,
    roughness: 0.9,
    vertexColors: true,
  });

export function greenvaleKits(palette: StagePalette, shadows: boolean): KindKit[] {
  const colours: GreenvaleColours = {
    leaf: new Color(palette.canopy),
    leafAlt: new Color(palette.canopyAlt),
    needle: new Color(palette.foliage),
    needleAlt: new Color(palette.foliageAlt),
    bark: new Color(palette.trunk),
  };
  const broadleafOf = (p: Prop) => pick(BROADLEAF_FORMS, BROADLEAF_SHARE, spotHash(p, 101));
  const coniferOf = (p: Prop) => pick(CONIFER_FORMS, CONIFER_SHARE, spotHash(p, 103));
  const kit = (
    source: Prop['kind'],
    geometry: (detail: 0 | 1) => KindKit['geometry'],
    accept: ((p: Prop) => boolean) | undefined,
    castShadow: boolean,
  ): KindKit[] =>
    ([1, 0] as const).map((detail) => ({
      sources: [source],
      geometry: geometry(detail),
      material: mat(),
      tint: null,
      vertexColors: true,
      castShadow,
      ...(accept ? { accept } : {}),
      place,
      colorAt: colourAt,
      lod: detail ? 'near' : 'far',
    }));
  return [
    ...BROADLEAF_FORMS.flatMap((form) =>
      kit(
        'broadleaf',
        (detail) => broadleafGeometry(form, colours, detail),
        (p) => broadleafOf(p) === form,
        shadows,
      ),
    ),
    ...CONIFER_FORMS.flatMap((form) =>
      kit(
        'tree',
        (detail) => coniferGeometry(form, colours, detail),
        (p) => coniferOf(p) === form,
        shadows,
      ),
    ),
    ...kit('bush', (detail) => bushGeometry(colours, detail), undefined, false),
  ];
}
