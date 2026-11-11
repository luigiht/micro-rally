import { STAGE_TYPES, stagePalette } from '@/game/stage/regions';
import type { Prop } from '@/game/stage/SceneryScatter';
import type { StageBrief } from '@/game/stage/StageGenerator';
import type { KindKit } from '../SceneryChunkManager';
import { FURNITURE_KINDS, rallyKits } from './RallyKits';

/** The instanced prop kits for a stage, tinted with its stage-type palette. */
export function sceneryKitsFor(
  stage: Pick<StageBrief, 'stageType'>,
  shadows: boolean,
  furniture = true,
): KindKit[] {
  const kits = rallyKits(
    stagePalette(stage.stageType),
    shadows,
    STAGE_TYPES[stage.stageType].offroad === 'snow',
  );
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
