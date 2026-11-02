import type { RegionDef } from '@/game/stage/regions';
import type { Prop } from '@/game/stage/SceneryScatter';
import type { WorldTheme } from '../../theme/WorldTheme';
import type { KindKit } from '../SceneryChunkManager';
import { nightcityKits, type RoadNear } from './NightcityKits';
import { rallyKits } from './RallyKits';

/** The instanced prop kits a theme dresses a region's props in. */
export function sceneryKitsFor(
  theme: WorldTheme,
  region: RegionDef,
  shadows: boolean,
  near: (p: Prop) => RoadNear,
): KindKit[] {
  if (theme.scenery.kit === 'nightcity') return nightcityKits({ shadows, near });
  return rallyKits(region.palette, shadows, region.offroad === 'snow');
}
