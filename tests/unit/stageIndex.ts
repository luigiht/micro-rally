import {
  isCityStage,
  rallyIndex,
  stageSlot,
  STAGE_TYPES,
  STAGES_PER_LOOP,
  type StageTypeId,
} from '@/game/stage/regions';
import { generateStage, type StageDef, type StageSlot } from '@/game/stage/StageGenerator';
import { createStageWorld, type StageWorld } from '@/game/stage/StageWorld';
import { hasTown } from '@/game/stage/TownPlan';

/** The index of the `nth` stage (0-based) of a stage type at or after `from`. */
export function stageIndexOf(stageType: StageTypeId, nth = 0, from = 0): number {
  let seen = 0;
  for (let i = from; i < 2000; i++) {
    if (stageSlot(i) !== stageType) continue;
    if (seen++ === nth) return i;
  }
  throw new Error(`no ${stageType} stage`);
}

/**
 * The seven-type rally mix before Lakeland joined it (save v13). Tests whose
 * stages were chosen and tuned on that calendar generate the same stages
 * here: a stage is fixed by its seed, index and slot, not by the calendar.
 */
const RALLY_CYCLE_V13: readonly StageTypeId[] = [
  'pinewood',
  'alpine',
  'forest',
  'coastal',
  'arctic',
  'autumnal',
  'desert',
];

function typeV13(index: number): StageTypeId {
  const rally = rallyIndex(index);
  if (rally === null) return isCityStage(index) ? 'urban' : 'circuit';
  return RALLY_CYCLE_V13[rally % RALLY_CYCLE_V13.length]!;
}

/** Stage `index`'s slot on the v13 calendar: its type, loop, town and dusk as they were then. */
export function slotV13(index: number): StageSlot {
  const stageType = typeV13(index);
  const def = STAGE_TYPES[stageType];
  let ordinal = 0;
  for (let j = 0; j < index; j++) if (typeV13(j) === stageType) ordinal++;
  return {
    stageType,
    loop: Math.floor(index / STAGES_PER_LOOP),
    town: hasTown(index) && def.towns,
    dusk: def.dusk === true && ordinal % 3 === 2,
  };
}

/** The index of the `nth` stage of a type on the v13 calendar, at or after `from`. */
export function indexV13(stageType: StageTypeId, nth = 0, from = 0): number {
  let seen = 0;
  for (let i = from; i < 2000; i++) {
    if (typeV13(i) !== stageType) continue;
    if (seen++ === nth) return i;
  }
  throw new Error(`no ${stageType} stage`);
}

/** The `nth` stage of a type as the v13 calendar laid it. */
export function stageV13(seed: number, stageType: StageTypeId, nth = 0, from = 0): StageDef {
  const index = indexV13(stageType, nth, from);
  return generateStage(seed, index, slotV13(index));
}

/** The `nth` stage of a type's world as the v13 calendar laid it. */
export function worldV13(seed: number, stageType: StageTypeId, nth = 0, from = 0): StageWorld {
  const index = indexV13(stageType, nth, from);
  return createStageWorld(seed, index, slotV13(index));
}

/**
 * The index of the `nth` stage of a type on the v13 calendar that is still
 * that type today: a record set there survives Lakeland's arrival (v14).
 */
export function stableIndexV13(stageType: StageTypeId, nth = 0): number {
  let seen = 0;
  for (let i = 0; i < 2000; i++) {
    if (typeV13(i) !== stageType || stageSlot(i) !== stageType) continue;
    if (seen++ === nth) return i;
  }
  throw new Error(`no stable ${stageType} stage`);
}
