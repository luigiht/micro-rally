import { stageSlot, type RegionId } from '@/game/stage/regions';
import type { Surface } from '@/game/vehicle/surfaces';

/** The index of the `nth` stage (0-based) of `region` (on `surface`, where given) at or after `from`. */
export function stageIndexOf(region: RegionId, surface?: Surface, nth = 0, from = 0): number {
  let seen = 0;
  for (let i = from; i < 2000; i++) {
    const s = stageSlot(i);
    if (s.region !== region || (surface !== undefined && s.surface !== surface)) continue;
    if (seen++ === nth) return i;
  }
  throw new Error(`no ${region} stage`);
}
