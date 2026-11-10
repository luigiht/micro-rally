import { REGIONS, stagePalette } from '@/game/stage/regions';
import type { Prop } from '@/game/stage/SceneryScatter';
import type { StageBrief } from '@/game/stage/StageGenerator';
import type { KindKit } from '../SceneryChunkManager';
import { FURNITURE_KINDS, rallyKits } from './RallyKits';

/** The instanced prop kits for a stage: its region's palette, or its surface's (autumn on Forest mud). */
export function sceneryKitsFor(
  stage: Pick<StageBrief, 'region' | 'surface'>,
  shadows: boolean,
  furniture = true,
): KindKit[] {
  const kits = rallyKits(stagePalette(stage), shadows, REGIONS[stage.region].offroad === 'snow');
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
