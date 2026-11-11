import { stageSlot, type StageTypeId } from '@/game/stage/regions';

/** The index of the `nth` stage (0-based) of a stage type at or after `from`. */
export function stageIndexOf(stageType: StageTypeId, nth = 0, from = 0): number {
  let seen = 0;
  for (let i = from; i < 2000; i++) {
    if (stageSlot(i) !== stageType) continue;
    if (seen++ === nth) return i;
  }
  throw new Error(`no ${stageType} stage`);
}
