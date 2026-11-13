import { type Color, MeshStandardMaterial } from 'three';
import type { Prop } from '@/game/stage/SceneryScatter';
import type { KindKit } from '../SceneryChunkManager';
import {
  SPRUCE_BARE,
  SPRUCE_SNOWY,
  spruceFoliageGeometry,
  spruceSnowGeometry,
  spruceTrunkGeometry,
} from '../SpruceGeometry';

const mat = (color: string) =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });

/** Which spruce variants wear snow: the even ones, about half. */
const snowySpruce = (p: Prop) => p.variant % 2 === 0;

/** The Arctic's tall spruces (`SpruceGeometry`): snowy and bare foliage in the pine tint, the trunk, and the snow. */
export function spruceKits(pine: readonly Color[], trunk: string, shadows: boolean): KindKit[] {
  return [
    {
      sources: ['spruce'],
      geometry: spruceFoliageGeometry(SPRUCE_SNOWY, true),
      material: mat('#ffffff'),
      tint: pine,
      castShadow: shadows,
      accept: snowySpruce,
    },
    {
      sources: ['spruce'],
      geometry: spruceFoliageGeometry(SPRUCE_BARE, false),
      material: mat('#ffffff'),
      tint: pine,
      castShadow: shadows,
      accept: (p) => !snowySpruce(p),
    },
    {
      sources: ['spruce'],
      geometry: spruceTrunkGeometry(),
      material: mat(trunk),
      tint: null,
      castShadow: shadows,
    },
    {
      sources: ['spruce'],
      geometry: spruceSnowGeometry(SPRUCE_SNOWY),
      material: mat('#eef2f5'),
      tint: null,
      castShadow: false,
      accept: snowySpruce,
    },
  ];
}
