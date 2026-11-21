import {
  isCityStage,
  rallyIndex,
  stageSlot,
  STAGE_TYPES,
  STAGES_PER_LOOP,
  type StageTypeId,
} from '@/game/stage/regions';
import {
  generateStage,
  stageHasTown,
  type StageDef,
  type StageSlot,
} from '@/game/stage/StageGenerator';
import { createStageWorld, type StageWorld } from '@/game/stage/StageWorld';

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

/** The eight-type rally mix before Moorland joined it (save v14). */
const RALLY_CYCLE_V14: readonly StageTypeId[] = [...RALLY_CYCLE_V13, 'lakeland'];

function typeOn(cycle: readonly StageTypeId[], index: number): StageTypeId {
  const rally = rallyIndex(index);
  if (rally === null) return isCityStage(index) ? 'urban' : 'circuit';
  return cycle[rally % cycle.length]!;
}

function typeV13(index: number): StageTypeId {
  return typeOn(RALLY_CYCLE_V13, index);
}

/** Stage `index`'s type on the v14 calendar (Lakeland last, no Moorland). */
export function typeV14(index: number): StageTypeId {
  return typeOn(RALLY_CYCLE_V14, index);
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
    // v13's towns: every third rally stage, before they stepped on round the nine-type mix.
    town: rallyIndex(index) !== null && rallyIndex(index)! % 3 === 2 && def.towns,
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
 * that type on every calendar since: a record set there survives Lakeland's
 * arrival (v14) and Moorland's (v15).
 */
export function stableIndexV13(stageType: StageTypeId, nth = 0): number {
  let seen = 0;
  for (let i = 0; i < 2000; i++) {
    if (typeV13(i) !== stageType || typeV14(i) !== stageType || stageSlot(i) !== stageType)
      continue;
    // Nor did it gain or lose its town when the towns stepped round the nine-type mix (v15).
    const townBefore = rallyIndex(i)! % 3 === 2 && STAGE_TYPES[stageType].towns;
    if (townBefore !== stageHasTown(i)) continue;
    if (seen++ === nth) return i;
  }
  throw new Error(`no stable ${stageType} stage`);
}
