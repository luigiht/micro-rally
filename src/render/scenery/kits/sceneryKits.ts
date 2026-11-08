import { REGIONS, spectatorOutfit, stagePalette } from '@/game/stage/regions';
import type { Prop } from '@/game/stage/SceneryScatter';
import type { StageBrief } from '@/game/stage/StageGenerator';
import type { WorldTheme } from '../../theme/WorldTheme';
import type { KindKit } from '../SceneryChunkManager';
import { nightcityKits, type RoadNear } from './NightcityKits';
import { FURNITURE_KINDS, rallyKits } from './RallyKits';

/** The instanced prop kits a theme dresses a stage's props in: its region's palette, or its surface's (autumn on Forest mud). */
export function sceneryKitsFor(
  theme: WorldTheme,
  stage: Pick<StageBrief, 'region' | 'surface'>,
  shadows: boolean,
  near: (p: Prop) => RoadNear,
  furniture = true,
): KindKit[] {
  const kits =
    theme.scenery.kit === 'nightcity'
      ? nightcityKits({ shadows, near, outfit: spectatorOutfit(stage) })
      : rallyKits(stagePalette(stage), shadows, REGIONS[stage.region].offroad === 'snow');
  if (furniture) return kits;
  // Without the furniture its props are simply not drawn (their colliders stand either way).
  const drop = new Set<Prop['kind']>(FURNITURE_KINDS);
  return kits.filter((k) => {
    const keep = !k.sources.every((s) => drop.has(s));
    if (!keep) {
      k.geometry.dispose();
      k.material.dispose();
    }
    return keep;
  });
}
