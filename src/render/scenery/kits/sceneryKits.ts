import { REGIONS, stagePalette } from '@/game/stage/regions';
import type { Prop } from '@/game/stage/SceneryScatter';
import type { StageBrief } from '@/game/stage/StageGenerator';
import type { WorldTheme } from '../../theme/WorldTheme';
import type { KindKit } from '../SceneryChunkManager';
import { nightcityKits, type RoadNear } from './NightcityKits';
import { rallyKits } from './RallyKits';

/** The instanced prop kits a theme dresses a stage's props in: its region's palette, or its surface's (autumn on Forest mud). */
export function sceneryKitsFor(
  theme: WorldTheme,
  stage: Pick<StageBrief, 'region' | 'surface'>,
  shadows: boolean,
  near: (p: Prop) => RoadNear,
): KindKit[] {
  if (theme.scenery.kit === 'nightcity') return nightcityKits({ shadows, near });
  return rallyKits(stagePalette(stage), shadows, REGIONS[stage.region].offroad === 'snow');
}
